// Funded acceptance test for the local pre-purchase x402 endpoint.
//
// This script can spend only test USDC on Base Sepolia. It refuses non-local
// endpoints, validates the exact challenge before and after signing, applies
// CDP SDK spend controls, preserves the one-use signature for crash recovery,
// and verifies an idempotent replay after settlement.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildPrepurchaseTestnetOrder,
  buildPrepurchaseTestnetSpendControls,
  evaluatePrepurchaseTestnetChallenge,
  PREPURCHASE_TESTNET,
  PREPURCHASE_TESTNET_EXECUTION_SENTINEL,
  PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL,
  prepurchaseTestnetExecutionErrors,
  prepurchaseTestnetWalletPreparationErrors,
  validatePrepurchaseTestnetPaymentPayload,
} from '../lib/prepurchase-testnet.ts'

type Args = {
  execute: boolean
  prepareWallet: boolean
  resumePending: boolean
}

type PendingPayment = {
  version: 1
  test: 'prepurchase-base-sepolia-e2e'
  created_at: string
  endpoint: string
  request_body: ReturnType<typeof buildPrepurchaseTestnetOrder>
  payment_signature_header: string
  payer: string
  pay_to: string
  nonce: string
}

const pendingPath = resolve('.exchange/codex/prepurchase-testnet-payment-pending.json')

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, prepareWallet: false, resumePending: false }
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true
    else if (arg === '--prepare-wallet') args.prepareWallet = true
    else if (arg === '--resume-pending') args.resumePending = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (args.prepareWallet && (args.execute || args.resumePending)) {
    throw new Error('--prepare-wallet cannot be combined with payment or recovery flags')
  }
  return args
}

function endpoint(): string {
  const value = process.env.PREPURCHASE_TESTNET_ENDPOINT ?? PREPURCHASE_TESTNET.endpoint
  const parsed = new URL(value)
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
    parsed.pathname !== '/api/prepurchase/order'
  ) {
    throw new Error('PREPURCHASE_TESTNET_ENDPOINT must be the local HTTP pre-purchase route')
  }
  return parsed.toString()
}

async function postOrder(
  url: string,
  body: PendingPayment['request_body'],
  paymentHeader?: string,
) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(paymentHeader ? { 'PAYMENT-SIGNATURE': paymentHeader } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
    redirect: 'error',
  })
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    const value = JSON.parse(text)
    return typeof value === 'object' && value !== null ? value : { value }
  } catch {
    return { raw_text: text.slice(0, 4000) }
  }
}

async function createBuyerClient(payTo: string) {
  const { CdpX402Client } = await import('@coinbase/cdp-sdk/x402')
  return new CdpX402Client({
    environment: 'development',
    walletConfig: {
      type: 'eoa',
      accountName: PREPURCHASE_TESTNET.buyerWalletAccountName,
    },
    spendControls: buildPrepurchaseTestnetSpendControls(payTo),
  })
}

async function loadPending(): Promise<PendingPayment> {
  const raw = JSON.parse(await readFile(pendingPath, 'utf8')) as Partial<PendingPayment>
  if (
    raw.version !== 1 ||
    raw.test !== 'prepurchase-base-sepolia-e2e' ||
    raw.endpoint !== endpoint() ||
    typeof raw.payment_signature_header !== 'string' ||
    typeof raw.pay_to !== 'string' ||
    typeof raw.nonce !== 'string' ||
    !raw.request_body
  ) {
    throw new Error('the pending recovery file is missing or does not match this test')
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

async function submit(pending: PendingPayment) {
  const response = await postOrder(
    pending.endpoint,
    pending.request_body,
    pending.payment_signature_header,
  )
  const body = await readJson(response)
  if (!response.ok) {
    throw new Error(
      `paid request returned HTTP ${response.status}; recovery authorization remains at ${pendingPath}`,
    )
  }
  const responseHeader = response.headers.get('PAYMENT-RESPONSE')
  if (!responseHeader) throw new Error('paid response omitted PAYMENT-RESPONSE')
  const { decodePaymentResponseHeader } = await import('@x402/core/http')
  const paymentResponse = decodePaymentResponseHeader(responseHeader)
  return { body, paymentResponse }
}

async function markCompleted(
  pending: PendingPayment,
  first: Awaited<ReturnType<typeof submit>>,
  replay: Awaited<ReturnType<typeof submit>>,
) {
  const firstOrder = first.body.order_id
  const replayOrder = replay.body.order_id
  if (typeof firstOrder !== 'string' || replayOrder !== firstOrder) {
    throw new Error('idempotent replay did not return the same order_id')
  }
  if (
    first.paymentResponse.transaction &&
    replay.paymentResponse.transaction &&
    replay.paymentResponse.transaction !== first.paymentResponse.transaction
  ) {
    throw new Error('idempotent replay returned a different transaction')
  }

  const proof = {
    version: 1,
    test: pending.test,
    status: 'completed',
    completed_at: new Date().toISOString(),
    endpoint: pending.endpoint,
    network: PREPURCHASE_TESTNET.network,
    asset: PREPURCHASE_TESTNET.asset,
    amount_atomic: PREPURCHASE_TESTNET.amountAtomic,
    payer: pending.payer,
    pay_to: pending.pay_to,
    nonce: pending.nonce,
    order_id: firstOrder,
    payment_response: first.paymentResponse,
    replay: {
      same_order_id: true,
      same_transaction:
        !first.paymentResponse.transaction ||
        !replay.paymentResponse.transaction ||
        replay.paymentResponse.transaction === first.paymentResponse.transaction,
    },
  }
  // The replayable signature is removed after both requests succeed.
  await writeFile(pendingPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  return proof
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.prepareWallet) {
    const errors = prepurchaseTestnetWalletPreparationErrors(process.env)
    if (errors.length > 0) {
      console.error(`REFUSED: ${errors.join('; ')}`)
      console.error(
        `Required sentinel: PREPURCHASE_TESTNET_WALLET_PREPARE=${PREPURCHASE_TESTNET_WALLET_PREPARATION_SENTINEL}`,
      )
      process.exit(3)
    }
    const payTo = process.env.PREPURCHASE_TESTNET_PAY_TO
    const client = await createBuyerClient(
      payTo && /^0x[0-9a-fA-F]{40}$/.test(payTo)
        ? payTo
        : '0x0000000000000000000000000000000000000001',
    )
    const { evmAddress } = await client.getAddresses()
    console.log(
      JSON.stringify(
        {
          status: 'wallet_ready',
          account_name: PREPURCHASE_TESTNET.buyerWalletAccountName,
          network: PREPURCHASE_TESTNET.network,
          evm_address: evmAddress,
          required_funding: {
            asset: PREPURCHASE_TESTNET.asset,
            amount_atomic: PREPURCHASE_TESTNET.amountAtomic,
            amount_display: '1 test USDC',
          },
          reminder: 'Wallet preparation did not sign or submit a payment.',
        },
        null,
        2,
      ),
    )
    return
  }

  const errors = prepurchaseTestnetExecutionErrors({ execute: args.execute, env: process.env })
  if (errors.length > 0) {
    console.error(`REFUSED: ${errors.join('; ')}`)
    console.error(
      `Required sentinel: PREPURCHASE_TESTNET_EXECUTE=${PREPURCHASE_TESTNET_EXECUTION_SENTINEL}`,
    )
    process.exit(3)
  }

  if (args.resumePending) {
    const pending = await loadPending()
    const first = await submit(pending)
    const replay = await submit(pending)
    console.log(JSON.stringify(await markCompleted(pending, first, replay), null, 2))
    return
  }

  const payTo = process.env.PREPURCHASE_TESTNET_PAY_TO!
  const url = endpoint()
  const requestBody = buildPrepurchaseTestnetOrder()
  const challengeResponse = await postOrder(url, requestBody)
  if (challengeResponse.status !== 402) {
    throw new Error(`local seller returned HTTP ${challengeResponse.status}; expected 402`)
  }
  const paymentRequiredHeader = challengeResponse.headers.get('PAYMENT-REQUIRED')
  const challenge = evaluatePrepurchaseTestnetChallenge(paymentRequiredHeader, payTo)
  if (!challenge.ok) throw new Error(`NO-GO: ${challenge.reason}`)

  const client = await createBuyerClient(payTo)
  const { decodePaymentRequiredHeader, encodePaymentSignatureHeader } =
    await import('@x402/core/http')
  const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!)
  const paymentPayload = await client.createPaymentPayload(paymentRequired)
  const validated = validatePrepurchaseTestnetPaymentPayload(paymentPayload, payTo)
  if (!validated.ok) throw new Error(`REFUSED after signing: ${validated.reason}`)

  const { evmAddress } = await client.getAddresses()
  if (evmAddress.toLowerCase() !== validated.payer.toLowerCase()) {
    throw new Error('REFUSED: CDP wallet address and signed payer address do not match')
  }

  const pending: PendingPayment = {
    version: 1,
    test: 'prepurchase-base-sepolia-e2e',
    created_at: new Date().toISOString(),
    endpoint: url,
    request_body: requestBody,
    payment_signature_header: encodePaymentSignatureHeader(paymentPayload),
    payer: validated.payer,
    pay_to: payTo,
    nonce: validated.nonce,
  }
  await preservePending(pending)
  const first = await submit(pending)
  const replay = await submit(pending)
  console.log(JSON.stringify(await markCompleted(pending, first, replay), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
