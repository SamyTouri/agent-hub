// Case-002 real-payment buyer — spends exactly 0.05 USDC on Base mainnet.
//
// Inert unless a command flag AND an exact environment sentinel are both present.
// Sequence: resolve the seller from the live directory profile, revalidate the
// manifest and the unsigned 402 challenge in this same session, sign one payment
// with the already funded CDP wallet under redundant spend controls, persist the
// one-use authorization, submit it once, then preserve the exact paid response as
// gitignored evidence and overwrite the authorization with non-replayable proof.
//
// Deliberately NOT run by the test suite. Its pure guards live in
// lib/case002-payment.ts and are covered by scripts/case-002-payment.test.mts.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildCase002ResourceUrl,
  CASE002_PREFLIGHT,
  resolveCase002SellerBase,
} from '../lib/case002-preflight.ts'
import {
  assertSigningWalletMatches,
  buildCase002SpendControls,
  CASE002_EXECUTION_SENTINEL,
  CASE002_PAYMENT,
  CASE002_RECOVERY_LIMIT,
  case002AuthorizationErrors,
  revalidateCase002,
  summarizeCase002Delivery,
  validateCase002PaymentPayload,
  validatePendingCase002,
  type PendingCase002Payment,
} from '../lib/case002-payment.ts'

type Args = { execute: boolean; authorizeFlag: boolean; resumePending: boolean }

const pendingPath = resolve('.exchange/codex/case-002-payment-pending.json')
const evidencePath = resolve('.exchange/codex/case-002-paid-response.json')

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, authorizeFlag: false, resumePending: false }
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true
    else if (arg === '--i-authorize-case-002-payment') args.authorizeFlag = true
    else if (arg === '--resume-pending') args.resumePending = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return args
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

async function getReadOnly(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    // `manual` : une redirection ne doit jamais nous emmener payer ailleurs.
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Agent-Reputation-Case-002-Buyer/1.0' },
  })
  const text = await response.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    /* profile HTML and non-JSON errors stay as text */
  }
  return {
    status: response.status,
    text,
    json,
    contentType: response.headers.get('content-type'),
    paymentRequiredHeader: response.headers.get('PAYMENT-REQUIRED'),
    paymentResponseHeader: response.headers.get('PAYMENT-RESPONSE'),
  }
}

/** GET payé : l'en-tête de signature transporte l'autorisation à usage unique. */
async function getPaid(url: string, paymentSignatureHeader: string) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'User-Agent': 'Agent-Reputation-Case-002-Buyer/1.0',
      'PAYMENT-SIGNATURE': paymentSignatureHeader,
    },
  })
  const text = await response.text()
  return {
    status: response.status,
    text,
    contentType: response.headers.get('content-type'),
    paymentResponseHeader: response.headers.get('PAYMENT-RESPONSE'),
  }
}

async function decodePaymentResponse(header: string | null): Promise<unknown> {
  if (!header) return null
  try {
    const { decodePaymentResponseHeader } = await import('@x402/core/http')
    return decodePaymentResponseHeader(header)
  } catch {
    return { undecodable_header: true }
  }
}

async function createBuyerClient() {
  const { CdpX402Client } = await import('@coinbase/cdp-sdk/x402')
  return new CdpX402Client({
    environment: 'production',
    walletConfig: { type: 'eoa', accountName: CASE002_PAYMENT.walletAccountName },
    spendControls: buildCase002SpendControls(),
  })
}

/**
 * Écriture EXCLUSIVE (`wx`) : si une autorisation est déjà en attente, on refuse
 * plutôt que d'en signer une seconde. C'est le garde-fou qui a déjà évité un
 * double paiement sur le banc mainnet le 2026-07-25.
 */
async function preservePending(pending: PendingCase002Payment) {
  await mkdir(dirname(pendingPath), { recursive: true })
  try {
    await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `REFUSED: a Case-002 authorization already exists at ${pendingPath}. Resolve it with --resume-pending (same signature) or archive it manually. This path never signs a second authorization.`,
      )
    }
    throw error
  }
}

/** L'artefact acheté, conservé intact hors git, séparé du reçu de paiement. */
async function preserveEvidence(record: unknown) {
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
}

/** Remplace l'autorisation rejouable par une preuve qui ne peut plus rien autoriser. */
async function markCompleted(
  pending: PendingCase002Payment,
  outcome: { httpStatus: number; bodySha256: string; transaction: string | null },
) {
  await writeFile(
    pendingPath,
    `${JSON.stringify(
      {
        version: 1,
        case: 'case-002',
        status: 'completed',
        completed_at: new Date().toISOString(),
        resource_url: pending.resource_url,
        seller_base: pending.seller_base,
        payer: pending.payer,
        nonce: pending.nonce,
        amount_atomic: pending.amount_atomic,
        network: pending.network,
        asset: pending.asset,
        recipient: pending.recipient,
        settlement_transaction: outcome.transaction,
        response_http_status: outcome.httpStatus,
        response_body_sha256: outcome.bodySha256,
        response_evidence_file: evidencePath,
        note: 'The replayable signature was removed. This record proves what happened; it cannot authorize a payment.',
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

async function submitPending(pending: PendingCase002Payment) {
  const paid = await getPaid(pending.resource_url, pending.payment_signature_header)
  const paymentResponse = await decodePaymentResponse(paid.paymentResponseHeader)
  const transaction =
    paymentResponse && typeof paymentResponse === 'object' && 'transaction' in paymentResponse
      ? String((paymentResponse as Record<string, unknown>).transaction ?? '') || null
      : null
  const bodySha256 = sha256(paid.text)

  // La preuve est écrite AVANT toute décision d'échec : même une réponse non-200
  // après paiement est un fait à conserver, pas une erreur à jeter.
  await preserveEvidence({
    version: 1,
    case: 'case-002',
    recorded_at: new Date().toISOString(),
    resource_url: pending.resource_url,
    seller_base: pending.seller_base,
    payment: {
      network: pending.network,
      asset: pending.asset,
      amount_atomic: pending.amount_atomic,
      recipient: pending.recipient,
      payer: pending.payer,
      nonce: pending.nonce,
      transaction,
      payment_response: paymentResponse,
    },
    delivery: {
      http_status: paid.status,
      content_type: paid.contentType,
      body_sha256: bodySha256,
      body: paid.text,
    },
    correctness: null,
    buyer_judgment: null,
    limits: [
      'Settlement proves value moved; it does not prove the response is correct.',
      'The content hash identifies the assessed artefact; it does not make its statements true.',
      CASE002_RECOVERY_LIMIT,
    ],
  })

  await markCompleted(pending, { httpStatus: paid.status, bodySha256, transaction })

  console.log(
    JSON.stringify(
      summarizeCase002Delivery({
        httpStatus: paid.status,
        bodyText: paid.text,
        contentType: paid.contentType,
        transaction,
        payer: pending.payer,
        nonce: pending.nonce,
        bodySha256,
        evidencePath,
      }),
      null,
      2,
    ),
  )

  if (paid.status !== 200) {
    console.error(
      `WARNING: the paid GET returned HTTP ${paid.status}. Payment may have settled without delivery. Record this as paid-without-delivery; the full response is preserved at ${evidencePath}.`,
    )
    process.exitCode = 4
  }
}

async function resolveSession() {
  // L'hôte courant vient du profil annuaire, jamais d'une URL mémorisée : c'est la
  // leçon exacte de la rétractation Case-001 (une adresse périmée n'est pas un
  // opérateur disparu, et une adresse mémorisée n'est pas une instruction de routage).
  const profile = await getReadOnly(CASE002_PAYMENT.profileUrl)
  if (profile.status !== 200) throw new Error(`NO-GO: directory profile returned HTTP ${profile.status}`)

  const sellerBase = resolveCase002SellerBase(profile.text)
  const manifestUrl = new URL(CASE002_PREFLIGHT.manifestPath, sellerBase).toString()
  const resourceUrl = buildCase002ResourceUrl(sellerBase)

  const manifest = await getReadOnly(manifestUrl)
  const challenge = await getReadOnly(resourceUrl)

  const revalidation = revalidateCase002({
    profileStatus: profile.status,
    profileHtml: profile.text,
    manifestStatus: manifest.status,
    manifest: manifest.json,
    challengeStatus: challenge.status,
    paymentRequiredHeader: challenge.paymentRequiredHeader,
  })
  if (!revalidation.ok) throw new Error(`NO-GO: ${revalidation.reason}`)

  return { resourceUrl, sellerBase, paymentRequiredHeader: challenge.paymentRequiredHeader! }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const authorizationErrors = case002AuthorizationErrors({
    execute: args.execute,
    authorizeFlag: args.authorizeFlag,
    env: process.env,
  })
  if (authorizationErrors.length > 0) {
    console.error(`REFUSED: ${authorizationErrors.join('; ')}`)
    console.error(`Required sentinel: CASE002_EXECUTE=${CASE002_EXECUTION_SENTINEL}`)
    console.error(
      'This path spends real money. It is authorized for exactly one 0.05-USDC purchase of the Case-002 GET product.',
    )
    process.exit(3)
  }

  // La session de paiement REVALIDE toujours, y compris pour une reprise : un
  // fichier de reprise qui viserait une autre ressource ne doit jamais partir.
  const session = await resolveSession()

  if (args.resumePending) {
    const raw = JSON.parse(await readFile(pendingPath, 'utf8'))
    const problem = validatePendingCase002(raw, session.resourceUrl)
    if (problem) throw new Error(`REFUSED: ${problem}`)
    console.error(`Replaying the existing authorization. ${CASE002_RECOVERY_LIMIT}`)
    await submitPending(raw as PendingCase002Payment)
    return
  }

  const [client, { decodePaymentRequiredHeader, encodePaymentSignatureHeader }] = await Promise.all([
    createBuyerClient(),
    import('@x402/core/http'),
  ])

  const paymentRequired = decodePaymentRequiredHeader(session.paymentRequiredHeader)
  const paymentPayload = await client.createPaymentPayload(paymentRequired)

  const validated = validateCase002PaymentPayload(paymentPayload)
  if (!validated.ok) throw new Error(`REFUSED after signing: ${validated.reason}`)

  const { evmAddress } = await client.getAddresses()
  const mismatch = assertSigningWalletMatches(evmAddress, validated.payer)
  if (mismatch) throw new Error(`REFUSED: ${mismatch}`)

  const pending: PendingCase002Payment = {
    version: 1,
    case: 'case-002',
    created_at: new Date().toISOString(),
    resource_url: session.resourceUrl,
    seller_base: session.sellerBase,
    payment_signature_header: encodePaymentSignatureHeader(paymentPayload),
    payer: validated.payer,
    nonce: validated.nonce,
    amount_atomic: CASE002_PAYMENT.amountAtomic,
    network: CASE002_PAYMENT.network,
    asset: CASE002_PAYMENT.asset,
    recipient: CASE002_PAYMENT.recipient,
  }

  await preservePending(pending)
  await submitPending(pending)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
