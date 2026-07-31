// Achat de référencement — dépense exactement 0,50 USDC RÉEL sur Base mainnet.
//
// Inerte tant qu'un drapeau de commande ET une sentinelle d'environnement exacte
// ne sont pas tous les deux présents.
//
// Séquence : revalider le défi 402 dans CETTE session (jamais sur la foi d'un
// préflight antérieur), signer UNE autorisation avec le portefeuille CDP déjà
// financé sous contrôles de dépense redondants, persister l'autorisation à usage
// unique AVANT de la soumettre, soumettre une fois, puis remplacer
// l'autorisation rejouable par une preuve qui ne peut plus rien autoriser.
//
// Délibérément PAS exécuté par la suite de tests. Ses gardes pures vivent dans
// lib/discovery-listing.ts et sont couvertes par scripts/discovery-listing.test.mts.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  assertDiscoveryListingSigner,
  buildDiscoveryListingOrder,
  buildDiscoveryListingSpendControls,
  DISCOVERY_LISTING,
  DISCOVERY_LISTING_EXECUTION_SENTINEL,
  DISCOVERY_LISTING_RECOVERY_LIMIT,
  DISCOVERY_LISTING_RESERVE,
  discoveryListingExecutionErrors,
  evaluateDiscoveryListingChallenge,
  validateDiscoveryListingPaymentPayload,
  validatePendingDiscoveryListing,
  type PendingDiscoveryListingPayment,
} from '../lib/discovery-listing.ts'
import { fetchUnsignedChallenge } from './discovery-listing-remote.mts'

type Args = { execute: boolean; authorizeFlag: boolean; resumePending: boolean }

const pendingPath = resolve('.exchange/codex/discovery-listing-payment-pending.json')
const receiptPath = resolve('.exchange/codex/discovery-listing-receipt.json')

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, authorizeFlag: false, resumePending: false }
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true
    else if (arg === '--i-authorize-discovery-listing-payment') args.authorizeFlag = true
    else if (arg === '--resume-pending') args.resumePending = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return args
}

async function postOrder(pending: PendingDiscoveryListingPayment) {
  const response = await fetch(pending.endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Agent-Reputation-Discovery-Listing/1.0',
      'PAYMENT-SIGNATURE': pending.payment_signature_header,
    },
    body: JSON.stringify(pending.request_body),
  })
  const text = await response.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    /* une réponse non-JSON reste un fait à conserver */
  }
  return {
    status: response.status,
    body,
    text: text.slice(0, 8000),
    paymentResponseHeader: response.headers.get('PAYMENT-RESPONSE'),
  }
}

async function decodePaymentResponse(header: string | null): Promise<Record<string, unknown> | null> {
  if (!header) return null
  try {
    const { decodePaymentResponseHeader } = await import('@x402/core/http')
    return decodePaymentResponseHeader(header) as unknown as Record<string, unknown>
  } catch {
    return { undecodable_header: true }
  }
}

async function createBuyerClient() {
  const { CdpX402Client } = await import('@coinbase/cdp-sdk/x402')
  return new CdpX402Client({
    // 'production' est ce qui prescrit Base mainnet plutôt que Base Sepolia.
    environment: 'production',
    walletConfig: { type: 'eoa', accountName: DISCOVERY_LISTING.buyerWalletAccountName },
    spendControls: buildDiscoveryListingSpendControls(),
  })
}

/**
 * Écriture EXCLUSIVE (`wx`) : si une autorisation est déjà en attente, on refuse
 * plutôt que d'en signer une seconde. C'est le garde-fou qui a déjà évité un
 * double paiement sur le banc mainnet le 2026-07-25.
 */
async function preservePending(pending: PendingDiscoveryListingPayment) {
  await mkdir(dirname(pendingPath), { recursive: true })
  try {
    await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `REFUSED: a discovery-listing authorization already exists at ${pendingPath}. Resolve it with --resume-pending (same signature) or archive it manually. This path never signs a second authorization.`,
      )
    }
    throw error
  }
}

/** Remplace l'autorisation rejouable par une preuve qui ne peut plus rien autoriser. */
async function markCompleted(
  pending: PendingDiscoveryListingPayment,
  outcome: {
    httpStatus: number
    orderId: string | null
    transaction: string | null
    settledAt: string | null
    paymentResponse: Record<string, unknown> | null
  },
) {
  const proof = {
    version: 1,
    case: 'discovery-listing',
    status: outcome.httpStatus === 200 ? 'completed' : 'submitted_without_receipt',
    completed_at: new Date().toISOString(),
    endpoint: pending.endpoint,
    network: pending.network,
    asset: pending.asset,
    amount_atomic: pending.amount_atomic,
    payer: pending.payer,
    recipient: pending.recipient,
    nonce: pending.nonce,
    order_id: outcome.orderId,
    settlement_transaction: outcome.transaction,
    settled_at: outcome.settledAt,
    response_http_status: outcome.httpStatus,
    payment_response: outcome.paymentResponse,
    what_this_proves: 'Value moved. It does not prove the resource is indexed in the discovery catalog.',
    next_step: 'Run the Verify action: on-chain confirmation first, then catalog listing.',
    note: 'The replayable signature was removed. This record proves what happened; it cannot authorize a payment.',
  }
  await writeFile(pendingPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  return proof
}

async function submit(pending: PendingDiscoveryListingPayment, replaying: boolean) {
  const paid = await postOrder(pending)
  const paymentResponse = await decodePaymentResponse(paid.paymentResponseHeader)
  const body = (paid.body ?? {}) as Record<string, unknown>
  const payment = (body.payment ?? {}) as Record<string, unknown>
  const orderId = typeof body.order_id === 'string' ? body.order_id : null
  const transaction =
    (typeof payment.transaction === 'string' ? payment.transaction : null) ??
    (typeof paymentResponse?.transaction === 'string' ? paymentResponse.transaction : null)
  const settledAt = typeof payment.settled_at === 'string' ? payment.settled_at : null

  // La preuve est écrite AVANT toute décision d'échec : une réponse non-200
  // après soumission est un fait à conserver, pas une erreur à jeter.
  await mkdir(dirname(receiptPath), { recursive: true })
  await writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        version: 1,
        case: 'discovery-listing',
        recorded_at: new Date().toISOString(),
        replayed: replaying,
        endpoint: pending.endpoint,
        http_status: paid.status,
        order_id: orderId,
        settlement_transaction: transaction,
        settled_at: settledAt,
        payment_response: paymentResponse,
        response_body: paid.body ?? paid.text,
        limits: [
          'Settlement proves value moved; it proves nothing about catalog indexing.',
          'Indexing takes up to 6 hours and a metadata defect produces no error anywhere.',
          DISCOVERY_LISTING_RECOVERY_LIMIT,
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const proof = await markCompleted(pending, {
    httpStatus: paid.status,
    orderId,
    transaction,
    settledAt,
    paymentResponse,
  })

  console.log(
    JSON.stringify(
      {
        status: paid.status === 200 ? 'settled' : 'submitted_without_receipt',
        replayed: replaying,
        payment: {
          network: pending.network,
          asset: pending.asset,
          amount_atomic: pending.amount_atomic,
          amount_display: DISCOVERY_LISTING.amountDisplay,
          recipient: pending.recipient,
          payer: pending.payer,
          nonce: pending.nonce,
          transaction,
          settled_at: settledAt,
        },
        order_id: orderId,
        http_status: paid.status,
        catalog_indexing: 'NOT VERIFIED — run the Verify action; indexing takes up to 6 hours.',
        receipt_evidence: receiptPath,
        proof_file: pendingPath,
        reserve: DISCOVERY_LISTING_RESERVE,
      },
      null,
      2,
    ),
  )

  if (paid.status !== 200) {
    console.error(
      `WARNING: the paid POST returned HTTP ${paid.status}. Settlement may have occurred without a receipt. Re-run with --resume-pending: the seller keys orders on the nonce and will return the same order. Full response preserved at ${receiptPath}.`,
    )
    process.exitCode = 4
  }
  return proof
}

/** Revalidation OBLIGATOIRE dans la session de paiement, y compris pour une reprise. */
async function revalidate() {
  const challenge = await fetchUnsignedChallenge()
  const evaluation = evaluateDiscoveryListingChallenge({
    challengeStatus: challenge.status,
    paymentRequiredHeader: challenge.paymentRequiredHeader,
  })
  if (!evaluation.ok) throw new Error(`NO-GO: ${evaluation.reason}`)
  return { paymentRequiredHeader: challenge.paymentRequiredHeader! }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const errors = discoveryListingExecutionErrors({
    execute: args.execute,
    authorizeFlag: args.authorizeFlag,
    env: process.env,
  })
  if (errors.length > 0) {
    console.error(`REFUSED: ${errors.join('; ')}`)
    console.error(`Required sentinel: DISCOVERY_LISTING_EXECUTE=${DISCOVERY_LISTING_EXECUTION_SENTINEL}`)
    console.error(
      `This path spends real money. It is authorized for exactly one ${DISCOVERY_LISTING.amountDisplay} payment to ${DISCOVERY_LISTING.recipient}.`,
    )
    process.exit(3)
  }

  const session = await revalidate()

  if (args.resumePending) {
    const raw = JSON.parse(await readFile(pendingPath, 'utf8'))
    const problem = validatePendingDiscoveryListing(raw)
    if (problem) throw new Error(`REFUSED: ${problem}`)
    console.error(`Replaying the existing authorization. ${DISCOVERY_LISTING_RECOVERY_LIMIT}`)
    await submit(raw as PendingDiscoveryListingPayment, true)
    return
  }

  const [client, { decodePaymentRequiredHeader, encodePaymentSignatureHeader }] = await Promise.all([
    createBuyerClient(),
    import('@x402/core/http'),
  ])

  const paymentRequired = decodePaymentRequiredHeader(session.paymentRequiredHeader)
  const paymentPayload = await client.createPaymentPayload(paymentRequired)

  const validated = validateDiscoveryListingPaymentPayload(paymentPayload)
  if (!validated.ok) throw new Error(`REFUSED after signing: ${validated.reason}`)

  const { evmAddress } = await client.getAddresses()
  const mismatch = assertDiscoveryListingSigner(evmAddress, validated.payer)
  if (mismatch) throw new Error(`REFUSED: ${mismatch}`)

  const pending: PendingDiscoveryListingPayment = {
    version: 1,
    case: 'discovery-listing',
    created_at: new Date().toISOString(),
    endpoint: DISCOVERY_LISTING.endpoint,
    request_body: buildDiscoveryListingOrder(),
    payment_signature_header: encodePaymentSignatureHeader(paymentPayload),
    payer: validated.payer,
    nonce: validated.nonce,
    amount_atomic: DISCOVERY_LISTING.amountAtomic,
    network: DISCOVERY_LISTING.network,
    asset: DISCOVERY_LISTING.asset,
    recipient: DISCOVERY_LISTING.recipient,
  }

  await preservePending(pending)
  await submit(pending, false)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
