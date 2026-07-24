// Case-001 real-payment client.
//
// This script is inert unless a command flag AND an exact environment sentinel
// are both present. It performs an unpaid POST first, validates the returned
// x402 challenge, provisions/uses a named CDP buyer wallet with SDK spend
// controls, persists the one-use signed authorization to a gitignored recovery
// file, then submits exactly that payload once.
//
// It is intentionally NOT run by the test suite. Tests cover its pure guard and
// validation functions in lib/case001-payment.ts.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildCase001OrderBody,
  buildCase001SpendControls,
  CASE001_EXECUTION_SENTINEL,
  CASE001_PAYMENT,
  CASE001_WALLET_PREPARATION_SENTINEL,
  case001AuthorizationErrors,
  case001WalletPreparationErrors,
  evaluateCase001Challenge,
  validateCase001PaymentPayload,
} from '../lib/case001-payment.ts'

type Args = {
  execute: boolean
  authorizeFlag: boolean
  resumePending: boolean
  prepareWallet: boolean
}

type PendingPayment = {
  version: 1
  case: 'case-001'
  created_at: string
  endpoint: string
  request_body: ReturnType<typeof buildCase001OrderBody>
  payment_signature_header: string
  payer: string
  nonce: string
}

const pendingPath = resolve('.exchange/codex/case-001-payment-pending.json')

function parseArgs(argv: string[]): Args {
  const args: Args = {
    execute: false,
    authorizeFlag: false,
    resumePending: false,
    prepareWallet: false,
  }
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true
    else if (arg === '--i-authorize-case-001-payment') args.authorizeFlag = true
    else if (arg === '--resume-pending') args.resumePending = true
    else if (arg === '--prepare-wallet') args.prepareWallet = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (
    args.prepareWallet &&
    (args.execute || args.authorizeFlag || args.resumePending)
  ) {
    throw new Error('--prepare-wallet cannot be combined with payment or recovery flags')
  }
  return args
}

async function postOrder(body: PendingPayment['request_body'], paymentHeader?: string) {
  return fetch(CASE001_PAYMENT.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(paymentHeader ? { 'PAYMENT-SIGNATURE': paymentHeader } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  })
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw_text: text.slice(0, 4000) }
  }
}

async function loadPending(): Promise<PendingPayment> {
  const raw = JSON.parse(await readFile(pendingPath, 'utf8')) as Partial<PendingPayment>
  if (
    raw.version !== 1 ||
    raw.case !== 'case-001' ||
    raw.endpoint !== CASE001_PAYMENT.endpoint ||
    typeof raw.payment_signature_header !== 'string' ||
    !raw.request_body ||
    typeof raw.nonce !== 'string'
  ) {
    throw new Error('the pending recovery file is missing or does not match Case-001')
  }
  return raw as PendingPayment
}

async function preservePending(pending: PendingPayment) {
  await mkdir(dirname(pendingPath), { recursive: true })
  await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
}

async function markCompleted(pending: PendingPayment, responseBody: unknown, paymentResponse: unknown) {
  // Overwrite the replayable signature and private contact after success. What
  // remains is sufficient for the audit trail but cannot authorize a payment.
  await writeFile(
    pendingPath,
    `${JSON.stringify(
      {
        version: 1,
        case: 'case-001',
        status: 'completed',
        completed_at: new Date().toISOString(),
        endpoint: pending.endpoint,
        payer: pending.payer,
        nonce: pending.nonce,
        response: responseBody,
        payment_response: paymentResponse,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

async function submitPending(pending: PendingPayment) {
  const response = await postOrder(pending.request_body, pending.payment_signature_header)
  const responseBody = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `paid retry returned HTTP ${response.status}; recovery authorization remains at ${pendingPath}`,
    )
  }
  const paymentResponseHeader = response.headers.get('PAYMENT-RESPONSE')
  let paymentResponse: unknown = null
  if (paymentResponseHeader) {
    const { decodePaymentResponseHeader } = await import('@x402/core/http')
    paymentResponse = decodePaymentResponseHeader(paymentResponseHeader)
  }
  await markCompleted(pending, responseBody, paymentResponse)
  console.log(
    JSON.stringify(
      {
        status: 'completed',
        case: 'case-001',
        endpoint: pending.endpoint,
        payer: pending.payer,
        nonce: pending.nonce,
        response: responseBody,
        payment_response: paymentResponse,
        private_recovery_file_sanitized: pendingPath,
      },
      null,
      2,
    ),
  )
}

async function createBuyerClient() {
  const { CdpX402Client } = await import('@coinbase/cdp-sdk/x402')
  return new CdpX402Client({
    environment: 'production',
    walletConfig: {
      type: 'eoa',
      accountName: CASE001_PAYMENT.walletAccountName,
    },
    spendControls: buildCase001SpendControls(),
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.prepareWallet) {
    const preparationErrors = case001WalletPreparationErrors(process.env)
    if (preparationErrors.length > 0) {
      console.error(`REFUSED: ${preparationErrors.join('; ')}`)
      console.error(
        `Required sentinel: CASE001_WALLET_PREPARE=${CASE001_WALLET_PREPARATION_SENTINEL}`,
      )
      process.exit(3)
    }
    const client = await createBuyerClient()
    const { evmAddress } = await client.getAddresses()
    console.log(
      JSON.stringify(
        {
          status: 'wallet_ready',
          case: 'case-001',
          account_name: CASE001_PAYMENT.walletAccountName,
          network: CASE001_PAYMENT.network,
          evm_address: evmAddress,
          required_funding: {
            asset: CASE001_PAYMENT.asset,
            amount_atomic: CASE001_PAYMENT.amountAtomic,
            amount_display: '1 USDC',
          },
          reminder:
            'Wallet preparation did not contact the seller, sign a payment or authorize future spending.',
        },
        null,
        2,
      ),
    )
    return
  }

  const authorizationErrors = case001AuthorizationErrors({
    execute: args.execute,
    authorizeFlag: args.authorizeFlag,
    env: process.env,
  })
  if (authorizationErrors.length > 0) {
    console.error(`REFUSED: ${authorizationErrors.join('; ')}`)
    console.error(
      `Required sentinel: CASE001_EXECUTE=${CASE001_EXECUTION_SENTINEL}`,
    )
    process.exit(3)
  }

  if (args.resumePending) {
    await submitPending(await loadPending())
    return
  }

  const body = buildCase001OrderBody(process.env.CASE001_DELIVERY_CONTACT!)

  // Same-session unpaid challenge. This may create seller-side intake state but
  // cannot transfer value.
  const challengeResponse = await postOrder(body)
  if (challengeResponse.status !== 402) {
    throw new Error(`seller returned HTTP ${challengeResponse.status}; expected an unpaid 402 challenge`)
  }
  const paymentRequiredHeader = challengeResponse.headers.get('PAYMENT-REQUIRED')
  const challenge = evaluateCase001Challenge(paymentRequiredHeader)
  if (!challenge.ok) throw new Error(`NO-GO: ${challenge.reason}`)

  const [client, { decodePaymentRequiredHeader, encodePaymentSignatureHeader }] =
    await Promise.all([createBuyerClient(), import('@x402/core/http')])

  const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!)
  const paymentPayload = await client.createPaymentPayload(paymentRequired)
  const validated = validateCase001PaymentPayload(paymentPayload)
  if (!validated.ok) throw new Error(`REFUSED after signing: ${validated.reason}`)

  const { evmAddress } = await client.getAddresses()
  if (evmAddress.toLowerCase() !== validated.payer.toLowerCase()) {
    throw new Error('REFUSED: CDP wallet address and signed payer address do not match')
  }

  const pending: PendingPayment = {
    version: 1,
    case: 'case-001',
    created_at: new Date().toISOString(),
    endpoint: CASE001_PAYMENT.endpoint,
    request_body: body,
    payment_signature_header: encodePaymentSignatureHeader(paymentPayload),
    payer: validated.payer,
    nonce: validated.nonce,
  }

  await preservePending(pending)
  await submitPending(pending)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
