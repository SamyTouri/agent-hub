// Vérification d'APRÈS-COUP du référencement — lecture seule, aucune dépense.
//
// C'est le seul moyen de savoir si le paiement a servi à quelque chose, parce
// que le mode d'échec principal est SILENCIEUX : un défaut de métadonnées ne
// produit aucune erreur, ni au règlement, ni à l'indexation, ni nulle part.
//
// Deux faits distincts, dans cet ordre, jamais fusionnés :
//   1. la transaction est-elle confirmée on-chain ?
//   2. le catalogue de découverte nous liste-t-il ?
//
// Un règlement confirmé n'implique PAS une inscription. L'indexation prend
// jusqu'à six heures ; avant ce délai, une absence ne prouve rien.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/discovery-listing-verify.mts [--save <report.json>]

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  DISCOVERY_LISTING,
  DISCOVERY_LISTING_RESERVE,
  judgeIndexing,
} from '../lib/discovery-listing.ts'
import { readDiscoveryCatalog, readTransactionReceipt } from './discovery-listing-remote.mts'

const proofPath = resolve('.exchange/codex/discovery-listing-payment-pending.json')

function parseSaveArg(argv: string[]) {
  if (argv.length === 0) return null
  if (argv.length === 2 && argv[0] === '--save' && argv[1]) return argv[1]
  throw new Error('usage: discovery-listing-verify.mts [--save <report.json>]')
}

type Proof = {
  status?: string
  order_id?: string | null
  settlement_transaction?: string | null
  settled_at?: string | null
  completed_at?: string
  payer?: string
  nonce?: string
}

async function readProof(): Promise<{ proof: Proof | null; reason: string | null }> {
  try {
    return { proof: JSON.parse(await readFile(proofPath, 'utf8')) as Proof, reason: null }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { proof: null, reason: `no payment record at ${proofPath}; nothing has been paid by this tool` }
    }
    return { proof: null, reason: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  const save = parseSaveArg(process.argv.slice(2))
  const { proof, reason } = await readProof()

  const transaction = proof?.settlement_transaction ?? null
  // La date de règlement du vendeur fait foi ; l'horodatage local ne sert que de
  // repli, et il est signalé comme tel plutôt que présenté comme équivalent.
  const settledAt = proof?.settled_at ?? proof?.completed_at ?? null
  const settledAtSource = proof?.settled_at ? 'seller receipt' : proof?.completed_at ? 'local completion timestamp (fallback)' : null

  const receipt = transaction ? await readTransactionReceipt(transaction) : null
  const catalog = await readDiscoveryCatalog()

  const indexing = catalog.readable
    ? judgeIndexing({
        listed: catalog.lookup.listed,
        settledAt,
        now: new Date(),
        scanComplete: catalog.complete,
      })
    : { verdict: 'inconclusive_scan' as const, detail: `the catalog could not be read: ${catalog.reason}` }

  const report = {
    tool: 'discovery-listing-verify',
    mode: 'read-only',
    checked_at: new Date().toISOString(),
    payment_record: proof
      ? {
          found: true,
          status: proof.status ?? null,
          order_id: proof.order_id ?? null,
          transaction,
          settled_at: settledAt,
          settled_at_source: settledAtSource,
        }
      : { found: false, reason },
    fact_1_settlement: receipt
      ? receipt.readable
        ? {
            readable: true,
            confirmed: receipt.status === 'success',
            status: receipt.status,
            block_number: receipt.blockNumber,
            confirmations: receipt.confirmations,
            explorer: `https://basescan.org/tx/${transaction}`,
          }
        : { readable: false, reason: receipt.reason }
      : { readable: false, reason: 'no transaction hash in the payment record' },
    fact_2_catalog: catalog.readable
      ? {
          readable: true,
          entries_scanned: catalog.scanned,
          catalog_total: catalog.total,
          scan_complete: catalog.complete,
          truncation_reason: catalog.truncation_reason,
          listed: catalog.lookup.listed,
          near_misses: catalog.lookup.nearMisses,
          matched_entry: catalog.lookup.matched,
        }
      : { readable: false, reason: catalog.reason },
    indexing_verdict: indexing.verdict,
    indexing_detail: indexing.detail,
    separation_note:
      'Settlement and listing are two distinct facts. A confirmed transaction never implies an indexed resource, and an indexed resource never implies a buyer.',
    reserve: DISCOVERY_LISTING_RESERVE,
    if_overdue: [
      'Re-read the challenge that was actually paid: the discovery extension and the description cap are what decide indexing.',
      'Re-run the preflight — it validates both against the official Bazaar validators.',
      'Do not pay again to "retry": a second settlement from the same wallet adds a payment, never a second distinct buyer.',
    ],
    catalog_caveat:
      'Measured 2026-07-30: the CDP facilitator ignores its own payTo/network/type filters, so the whole catalog (15k+ entries) is paginated and matched client-side on the exact resource URL. An incomplete scan is reported as inconclusive, never as absence.',
  }

  const rendered = JSON.stringify(report, null, 2)
  console.log(rendered)
  if (save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(save, `${rendered}\n`, 'utf8')
    console.error(`report saved to ${save}`)
  }

  if (indexing.verdict === 'listed') process.exit(0)
  if (indexing.verdict === 'pending') {
    console.error(
      `Not listed yet, and that is expected: indexing takes up to ${DISCOVERY_LISTING.indexingWindowHours}h.`,
    )
    process.exit(0)
  }
  process.exit(1)
}

main().catch((error) => {
  console.error(
    `discovery-listing verify failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(2)
})
