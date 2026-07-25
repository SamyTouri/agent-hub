// Real-money acceptance of the deployed pre-purchase x402 endpoint on Base
// mainnet.
//
// This script moves USDC that has monetary value. It can only pay exactly the
// published offer price, only on Base mainnet, only to the dedicated receiver,
// and only against our own deployed route. The signed one-use authorization is
// written to disk before submission so a lost HTTP response can be retried
// without creating a second authorization.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildPrepurchaseMainnetOrder,
  buildPrepurchaseMainnetSpendControls,
  evaluatePrepurchaseMainnetChallenge,
  PREPURCHASE_MAINNET,
  PREPURCHASE_MAINNET_EXECUTION_SENTINEL,
  PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL,
  prepurchaseMainnetExecutionErrors,
  prepurchaseMainnetWalletPreparationErrors,
  resolvePrepurchaseMainnetEndpoint,
  validatePrepurchaseMainnetPaymentPayload,
} from '../lib/prepurchase-mainnet.ts'

type Args = {
  execute: boolean
  prepareWallet: boolean
  resumePending: boolean
}

type PendingPayment = {
  version: 1
  test: 'prepurchase-base-mainnet-acceptance'
  created_at: string
  endpoint: string
  request_body: ReturnType<typeof buildPrepurchaseMainnetOrder>
  payment_signature_header: string
  payer: string
  pay_to: string
  nonce: string
}

const pendingPath = resolve('.exchange/codex/prepurchase-mainnet-payment-pending.json')

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
  return resolvePrepurchaseMainnetEndpoint(
    process.env.PREPURCHASE_MAINNET_ENDPOINT ?? PREPURCHASE_MAINNET.endpoint,
  )
}

async function postOrder(url: string, body: PendingPayment['request_body'], paymentHeader?: string) {
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
    // 'production' is what prescribes Base mainnet rather than Base Sepolia.
    environment: 'production',
    walletConfig: {
      type: 'eoa',
      accountName: PREPURCHASE_MAINNET.buyerWalletAccountName,
    },
    spendControls: buildPrepurchaseMainnetSpendControls(payTo),
  })
}

async function loadPending(): Promise<PendingPayment> {
  const raw = JSON.parse(await readFile(pendingPath, 'utf8')) as Partial<PendingPayment>
  if (
    raw.version !== 1 ||
    raw.test !== 'prepurchase-base-mainnet-acceptance' ||
    raw.endpoint !== endpoint() ||
    typeof raw.payment_signature_header !== 'string' ||
    typeof raw.pay_to !== 'string' ||
    typeof raw.nonce !== 'string' ||
    !raw.request_body
  ) {
    throw new Error('the pending recovery file is missing or does not match this acceptance')
  }
  return raw as PendingPayment
}

async function preservePending(pending: PendingPayment) {
  await mkdir(dirname(pendingPath), { recursive: true })
  // 'wx' refuses to overwrite: an existing authorization must be resumed, never
  // silently replaced by a second one.
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
  return { body, paymentResponse: decodePaymentResponseHeader(responseHeader) }
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
    network: PREPURCHASE_MAINNET.network,
    asset: PREPURCHASE_MAINNET.asset,
    amount_atomic: PREPURCHASE_MAINNET.amountAtomic,
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
    reminder:
      'Payment only. delivered_at and buyer_outcome stay empty: settlement is not delivery and not satisfaction.',
  }
  // The replayable signature is destroyed once both requests have succeeded.
  await writeFile(pendingPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  return proof
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.prepareWallet) {
    const errors = prepurchaseMainnetWalletPreparationErrors(process.env)
    if (errors.length > 0) {
      console.error(`REFUSED: ${errors.join('; ')}`)
      console.error(
        `Required sentinel: PREPURCHASE_MAINNET_WALLET_PREPARE=${PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL}`,
      )
      process.exit(3)
    }
    const payTo = process.env.PREPURCHASE_MAINNET_PAY_TO
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
          account_name: PREPURCHASE_MAINNET.buyerWalletAccountName,
          network: PREPURCHASE_MAINNET.network,
          evm_address: evmAddress,
          required_funding: {
            asset: PREPURCHASE_MAINNET.asset,
            amount_atomic: PREPURCHASE_MAINNET.amountAtomic,
            amount_display: '0.50 USDC (real value)',
          },
          reminder: 'Wallet preparation did not sign or submit a payment.',
        },
        null,
        2,
      ),
    )
    return
  }

  const errors = prepurchaseMainnetExecutionErrors({ execute: args.execute, env: process.env })
  if (errors.length > 0) {
    console.error(`REFUSED: ${errors.join('; ')}`)
    console.error(
      `Required sentinel: PREPURCHASE_MAINNET_EXECUTE=${PREPURCHASE_MAINNET_EXECUTION_SENTINEL}`,
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

  const payTo = process.env.PREPURCHASE_MAINNET_PAY_TO!
  const url = endpoint()
  const requestBody = buildPrepurchaseMainnetOrder()
  const challengeResponse = await postOrder(url, requestBody)
  if (challengeResponse.status !== 402) {
    throw new Error(
      `production returned HTTP ${challengeResponse.status}; expected 402. If it is 503, the mainnet offer is not active.`,
    )
  }
  const paymentRequiredHeader = challengeResponse.headers.get('PAYMENT-REQUIRED')
  const challenge = evaluatePrepurchaseMainnetChallenge(paymentRequiredHeader, payTo)
  if (!challenge.ok) throw new Error(`NO-GO: ${challenge.reason}`)

  const client = await createBuyerClient(payTo)
  const { decodePaymentRequiredHeader, encodePaymentSignatureHeader } = await import('@x402/core/http')
  const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader!)
  const paymentPayload = await client.createPaymentPayload(paymentRequired)
  const validated = validatePrepurchaseMainnetPaymentPayload(paymentPayload, payTo)
  if (!validated.ok) throw new Error(`REFUSED after signing: ${validated.reason}`)

  const { evmAddress } = await client.getAddresses()
  if (evmAddress.toLowerCase() !== validated.payer.toLowerCase()) {
    throw new Error('REFUSED: CDP wallet address and signed payer address do not match')
  }

  const pending: PendingPayment = {
    version: 1,
    test: 'prepurchase-base-mainnet-acceptance',
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
