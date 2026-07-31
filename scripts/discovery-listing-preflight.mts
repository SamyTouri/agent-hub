// Préflight de l'achat de référencement — DÉFINITIVEMENT EN LECTURE SEULE.
//
// Il lit l'offre publique, provoque le défi 402 NON SIGNÉ, contrôle tout ce qui
// détermine si un règlement servirait à quelque chose (réseau, actif, montant,
// adresse d'encaissement, description bornée, métadonnées de découverte), lit le
// solde du portefeuille acheteur s'il est lisible, et regarde si le catalogue
// nous liste déjà. Il n'existe aucun code de signature dans ce fichier.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/discovery-listing-preflight.mts [--save <report.json>]

import {
  buildDiscoveryListingOrder,
  DISCOVERY_LISTING,
  DISCOVERY_LISTING_RESERVE,
  evaluateDiscoveryListingChallenge,
} from '../lib/discovery-listing.ts'
import {
  fetchOfferStatus,
  fetchUnsignedChallenge,
  readBuyerBalance,
  readDiscoveryCatalog,
} from './discovery-listing-remote.mts'

function parseSaveArg(argv: string[]) {
  if (argv.length === 0) return null
  if (argv.length === 2 && argv[0] === '--save' && argv[1]) return argv[1]
  throw new Error('usage: discovery-listing-preflight.mts [--save <report.json>]')
}

async function main() {
  const save = parseSaveArg(process.argv.slice(2))

  const offer = await fetchOfferStatus()
  const challenge = await fetchUnsignedChallenge()
  const evaluation = evaluateDiscoveryListingChallenge({
    challengeStatus: challenge.status,
    paymentRequiredHeader: challenge.paymentRequiredHeader,
  })

  // Lectures optionnelles : elles enrichissent le rapport et ne décident rien.
  const [balance, catalog] = await Promise.all([readBuyerBalance(), readDiscoveryCatalog()])

  const offerChecks = [
    {
      name: 'offer-active',
      ok: offer.active,
      detail: offer.active ? 'GET reports active=true' : 'GET reports the offer as inactive; nothing must be paid',
    },
    {
      name: 'offer-network-is-base-mainnet',
      ok: offer.network === DISCOVERY_LISTING.network,
      detail: `network=${offer.network ?? '(missing)'} expected=${DISCOVERY_LISTING.network}`,
    },
  ]

  const checks = [...offerChecks, ...evaluation.checks]
  const blocking = checks.filter((check) => !check.ok)
  // Le solde n'est PAS bloquant quand il est illisible : on ne confond pas
  // « je ne sais pas » avec « c'est bon ». En revanche un solde lu ET
  // insuffisant est un NO-GO net, parce que la dépense échouerait au règlement.
  const balanceBlocks = balance.readable && !balance.sufficient
  const decision = blocking.length === 0 && !balanceBlocks ? 'GO' : 'NO-GO'

  const alreadyListed = catalog.readable && catalog.lookup.listed

  const report = {
    tool: 'discovery-listing-preflight',
    mode: 'read-only-unsigned-402',
    checked_at: new Date().toISOString(),
    purpose:
      'Enter the x402 discovery catalog, which only indexes a resource on its first payment actually settled by the CDP facilitator. There is no manual listing.',
    contemplated_payment: {
      endpoint: DISCOVERY_LISTING.endpoint,
      network: DISCOVERY_LISTING.network,
      asset: DISCOVERY_LISTING.asset,
      amount_atomic: DISCOVERY_LISTING.amountAtomic,
      amount_display: DISCOVERY_LISTING.amountDisplay,
      recipient: DISCOVERY_LISTING.recipient,
      recipient_is_ours: true,
      payer_wallet: DISCOVERY_LISTING.buyerAddress,
      order_body: buildDiscoveryListingOrder(),
    },
    decision,
    checks,
    buyer_balance: balance.readable
      ? {
          readable: true,
          address: balance.address,
          usdc_atomic: balance.atomic,
          required_atomic: DISCOVERY_LISTING.amountAtomic,
          sufficient: balance.sufficient,
        }
      : { readable: false, address: balance.address, reason: balance.reason },
    catalog_before_payment: catalog.readable
      ? {
          readable: true,
          entries_scanned: catalog.scanned,
          catalog_total: catalog.total,
          scan_complete: catalog.complete,
          truncation_reason: catalog.truncation_reason,
          already_listed: catalog.lookup.listed,
          near_misses: catalog.lookup.nearMisses,
          note: catalog.lookup.listed
            ? 'The resource is ALREADY in the catalog. A new payment is not required for listing; do not spend without a separate reason.'
            : catalog.complete
              ? 'The whole catalog was read and the resource is absent. A settled payment is what would put it there.'
              : 'The catalog was only partially read, so this absence is not conclusive. Treat it as unknown, not as a reason to spend.',
        }
      : { readable: false, reason: catalog.reason },
    reserve_before_spending: DISCOVERY_LISTING_RESERVE,
    boundaries: [
      'Only a public GET and an UNSIGNED POST were made. An unsigned POST cannot settle and creates no order.',
      'No payment payload was created or signed. No secret was printed.',
      'GO means only that a settlement now would be routed and indexed as intended.',
      'GO is not an authorization. Spending requires the explicit flags and sentinel of the payment tool.',
    ],
    ...(evaluation.ok ? {} : { blocking_reason: evaluation.reason }),
  }

  const rendered = JSON.stringify(report, null, 2)
  console.log(rendered)
  if (save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(save, `${rendered}\n`, 'utf8')
    console.error(`report saved to ${save}`)
  }
  if (alreadyListed) {
    console.error(
      'NOTE: the discovery catalog already lists this resource. Re-read catalog_before_payment before spending.',
    )
  }
  process.exit(decision === 'GO' ? 0 : 1)
}

main().catch((error) => {
  console.error(
    `discovery-listing preflight failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(2)
})
