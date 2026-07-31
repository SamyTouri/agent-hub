// Effets réseau PARTAGÉS entre le préflight et la vérification d'après-coup.
//
// Tout ce qui est ici est en LECTURE SEULE : aucune signature, aucun paiement,
// aucune écriture distante. Les deux lectures qui demandent les clés CDP (solde
// du portefeuille acheteur, catalogue de découverte) sont volontairement
// FAIL-SOFT : leur indisponibilité renseigne, elle ne bloque pas — et surtout
// elle n'autorise jamais rien.

import {
  buildDiscoveryListingOrder,
  DISCOVERY_LISTING,
  findDiscoveryListing,
  type CatalogLookup,
} from '../lib/discovery-listing.ts'

const USER_AGENT = 'Agent-Reputation-Discovery-Listing/1.0'

export type ObservedChallenge = {
  status: number
  paymentRequiredHeader: string | null
  bodyText: string
}

/** POST NON SIGNÉ : provoque le défi 402 sans qu'aucun règlement soit possible. */
export async function fetchUnsignedChallenge(): Promise<ObservedChallenge> {
  const response = await fetch(DISCOVERY_LISTING.endpoint, {
    method: 'POST',
    // `error` : une redirection ne doit jamais nous emmener payer ailleurs.
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify(buildDiscoveryListingOrder()),
  })
  return {
    status: response.status,
    paymentRequiredHeader: response.headers.get('PAYMENT-REQUIRED'),
    bodyText: (await response.text()).slice(0, 4000),
  }
}

export type OfferStatus = { active: boolean; network: string | null; raw: unknown }

/** Lecture publique de l'offre telle qu'elle est réellement exigible maintenant. */
export async function fetchOfferStatus(): Promise<OfferStatus> {
  const response = await fetch(DISCOVERY_LISTING.endpoint, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': USER_AGENT },
  })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  return {
    active: body?.active === true,
    network: typeof body?.network === 'string' ? body.network : null,
    raw: body,
  }
}

export type BalanceReading =
  | { readable: true; atomic: string; sufficient: boolean; address: string }
  | { readable: false; reason: string; address: string }

/**
 * Solde USDC du portefeuille acheteur. Nécessite les clés CDP en lecture ; leur
 * absence n'est pas une erreur, c'est une information manquante.
 */
export async function readBuyerBalance(): Promise<BalanceReading> {
  const address = DISCOVERY_LISTING.buyerAddress
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    return { readable: false, reason: 'CDP API credentials are not present in this process', address }
  }
  try {
    const { CdpClient } = await import('@coinbase/cdp-sdk')
    const cdp = new CdpClient()
    const balances = await cdp.evm.listTokenBalances({
      address: address as `0x${string}`,
      network: DISCOVERY_LISTING.cdpNetwork,
    })
    const usdc = balances.balances.find(
      (item) =>
        item.token.network === DISCOVERY_LISTING.cdpNetwork &&
        item.token.contractAddress.toLowerCase() === DISCOVERY_LISTING.asset.toLowerCase(),
    )
    const atomic = usdc?.amount.amount ?? 0n
    return {
      readable: true,
      atomic: atomic.toString(),
      sufficient: atomic >= BigInt(DISCOVERY_LISTING.amountAtomic),
      address,
    }
  } catch (error) {
    return { readable: false, reason: error instanceof Error ? error.message : String(error), address }
  }
}

export type CatalogReading =
  | {
      readable: true
      lookup: CatalogLookup
      scanned: number
      total: number | null
      /** Vrai seulement si TOUT le catalogue annoncé a été parcouru. */
      complete: boolean
      truncation_reason: string | null
    }
  | { readable: false; reason: string }

/** Plafond dur de pages, très au-dessus de la taille observée (≈154 pages le 2026-07-30). */
const MAX_CATALOG_PAGES = 400
const CATALOG_PAGE_SIZE = 100

/**
 * Interroge le catalogue de découverte du facilitateur CDP et cherche NOTRE URL.
 *
 * Mesuré le 2026-07-30 : le facilitateur IGNORE les filtres `payTo`, `network` et
 * `type` — la réponse annonce le même `total` (15 393) avec ou sans eux. Les
 * passer donnerait l'illusion d'une recherche ciblée alors que la comparaison
 * réelle se fait côté client sur l'URL exacte. On ne les passe donc pas, et on
 * pagine tout.
 *
 * Conséquence directe : une absence n'est concluante QUE si le parcours est
 * complet. Un scan partiel remonte `complete: false`, jamais un « non listé »
 * qui n'aurait pas été vérifié.
 */
export async function readDiscoveryCatalog(): Promise<CatalogReading> {
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    return { readable: false, reason: 'CDP API credentials are not present in this process' }
  }
  try {
    const [{ createCdpFacilitatorClient }, { withBazaar }] = await Promise.all([
      import('@coinbase/cdp-sdk/x402'),
      import('@x402/extensions/bazaar'),
    ])
    const client = withBazaar(
      createCdpFacilitatorClient({ baseUrl: DISCOVERY_LISTING.facilitatorUrl }) as never,
    ) as unknown as {
      extensions: {
        bazaar: {
          listResources: (params: Record<string, unknown>) => Promise<{
            items?: unknown[]
            pagination?: { total?: number; limit?: number; offset?: number }
          }>
        }
      }
    }

    const collected: unknown[] = []
    let total: number | null = null
    let truncation: string | null = null

    for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
      const offset = page * CATALOG_PAGE_SIZE
      const body = await client.extensions.bazaar.listResources({
        limit: CATALOG_PAGE_SIZE,
        offset,
      })
      const items = Array.isArray(body.items) ? body.items : []
      if (typeof body.pagination?.total === 'number') total = body.pagination.total
      collected.push(...items)

      // Sortie anticipée dès qu'on nous a répondu : inutile de parcourir la
      // suite du catalogue une fois notre entrée trouvée.
      if (findDiscoveryListing(collected).listed) break
      if (items.length === 0) break
      if (total !== null && collected.length >= total) break
      if (page === MAX_CATALOG_PAGES - 1) {
        truncation = `stopped at the hard bound of ${MAX_CATALOG_PAGES} pages (${collected.length} entries)`
      }
    }

    const lookup = findDiscoveryListing(collected)
    const complete = lookup.listed || (total !== null && collected.length >= total)
    return {
      readable: true,
      lookup,
      scanned: collected.length,
      total,
      complete,
      truncation_reason:
        truncation ?? (complete ? null : `scanned ${collected.length} of ${total ?? 'an unknown number of'} entries`),
    }
  } catch (error) {
    return { readable: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

export type ReceiptReading =
  | { readable: true; status: 'success' | 'reverted'; blockNumber: number; confirmations: number }
  | { readable: false; reason: string }

/**
 * Confirmation on-chain du règlement, via le RPC public Base. Aucune clé requise ;
 * l'hôte peut être remplacé par BASE_RPC_URL si le public rate-limite.
 */
export async function readTransactionReceipt(transaction: string): Promise<ReceiptReading> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(transaction)) {
    return { readable: false, reason: `not a transaction hash: ${transaction}` }
  }
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  const call = async (method: string, params: unknown[]) => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`)
    const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
    if (body.error) throw new Error(`${method}: ${body.error.message ?? 'RPC error'}`)
    return body.result
  }

  try {
    const receipt = (await call('eth_getTransactionReceipt', [transaction])) as {
      status?: string
      blockNumber?: string
    } | null
    if (!receipt) {
      return { readable: false, reason: 'the node has no receipt for this hash yet (pending, dropped, or wrong chain)' }
    }
    const head = (await call('eth_blockNumber', [])) as string
    const blockNumber = Number(BigInt(receipt.blockNumber ?? '0x0'))
    return {
      readable: true,
      status: receipt.status === '0x1' ? 'success' : 'reverted',
      blockNumber,
      confirmations: Math.max(0, Number(BigInt(head)) - blockNumber + 1),
    }
  } catch (error) {
    return { readable: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
