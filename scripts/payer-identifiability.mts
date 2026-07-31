// Combien d'adresses payeuses observées sont-elles rattachables à un agent enregistré ?
//
// LA QUESTION, ET POURQUOI ELLE DÉCIDE D'UN CHANTIER. Le standard ERC-8004 publie, pour
// chaque agent enregistré, ses points de contact — web, A2A, MCP, email — à côté de son
// adresse de paiement. Joindre un agent qu'on a IDENTIFIÉ est donc facile. Ce qui manque,
// c'est le chemin inverse : d'une adresse observée sur la chaîne vers l'agent qui la
// détient. Le standard ne définit aucune recherche inverse. Avant de construire cet index
// nous-mêmes — le chantier le plus lourd du plan — il faut savoir combien d'adresses
// payeuses réelles y seraient seulement retrouvables. Si la réponse est « presque aucune »,
// l'index n'a pas de valeur, quelle que soit sa qualité.
//
// CE QUI EST MESURÉ, EXACTEMENT. On part de vraies ressources x402 du catalogue de
// découverte, on prend les adresses d'encaissement qu'elles annoncent, on lit sur Base les
// transferts USDC ARRIVÉS sur ces adresses, et les expéditeurs sont les payeurs. Chaque
// payeur est ensuite cherché dans l'index public des agents enregistrés.
//
// TROIS LIMITES QUI BORNENT LA CONCLUSION, à lire avant d'utiliser le chiffre.
//   1. L'index interrogé porte sur l'adresse PROPRIÉTAIRE du jeton d'agent, pas sur
//      l'adresse de paiement déclarée dans le fichier d'enregistrement, que cet index
//      n'expose pas. Le résultat est donc une BORNE BASSE : un agent qui paie depuis son
//      portefeuille de service sans être propriétaire du jeton compte ici comme inconnu.
//   2. Un filtre non reconnu par cet index renvoie la liste entière au lieu d'une erreur —
//      mesuré le 2026-07-31. Chaque réponse est donc revérifiée côté client, et une réponse
//      qui ne correspond pas à l'adresse demandée est comptée comme non concluante, jamais
//      comme une absence.
//   3. L'échantillon est borné par la fenêtre de blocs et le nombre de ressources lues. Ce
//      qui est produit est un ordre de grandeur daté, pas un recensement.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/payer-identifiability.mts [--resources 40] [--blocks 200000] [--save <out.json>]

import { CDP_FACILITATOR_URL } from '../lib/prepurchase.ts'

const BASE_RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const AGENT_INDEX = 'https://8004scan.io/api/v1/agents'
const USER_AGENT = 'Agent-Reputation-Payer-Identifiability/1.0'

type Args = { resources: number; blocks: number; save: string | null }

function parseArgs(argv: string[]): Args {
  const out: Args = { resources: 40, blocks: 200_000, save: null }
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if (!value) throw new Error(`missing value for ${key}`)
    if (key === '--resources') out.resources = Number(value)
    else if (key === '--blocks') out.blocks = Number(value)
    else if (key === '--save') out.save = value
    else throw new Error(`unknown argument ${key}`)
  }
  if (!Number.isInteger(out.resources) || out.resources < 1) throw new Error('--resources must be a positive integer')
  if (!Number.isInteger(out.blocks) || out.blocks < 1) throw new Error('--blocks must be a positive integer')
  return out
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(BASE_RPC, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error) throw new Error(`${method}: ${body.error.message ?? 'rpc error'}`)
  return body.result
}

const topicAddress = (address: string) => `0x${'0'.repeat(24)}${address.toLowerCase().replace(/^0x/, '')}`
const addressFromTopic = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase()

/**
 * Les payeurs d'UNE adresse d'encaissement, sur une fenêtre de blocs. Le RPC public
 * refuse les plages trop larges : on découpe, et un morceau qui échoue est signalé plutôt
 * qu'avalé — une fenêtre incomplète ne doit pas se lire comme une absence de paiement.
 */
async function payersOf(payTo: string, fromBlock: number, toBlock: number) {
  const payers = new Set<string>()
  let failedChunks = 0
  const STEP = 10_000
  for (let start = fromBlock; start <= toBlock; start += STEP) {
    const end = Math.min(start + STEP - 1, toBlock)
    try {
      const logs = (await rpc('eth_getLogs', [
        {
          address: USDC_BASE,
          fromBlock: `0x${start.toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
          topics: [TRANSFER_TOPIC, null, topicAddress(payTo)],
        },
      ])) as Array<{ topics: string[] }>
      for (const log of logs) {
        if (log.topics?.[1]) payers.add(addressFromTopic(log.topics[1]))
      }
    } catch {
      failedChunks += 1
    }
  }
  return { payers, failedChunks }
}

type Lookup = { address: string; verdict: 'registered' | 'unknown' | 'inconclusive'; agentName?: string }

/**
 * Une adresse est déclarée « registered » UNIQUEMENT si l'index renvoie une entrée dont
 * l'adresse propriétaire est bien celle demandée. Tout le reste est inconcluant : c'est la
 * leçon du facilitateur qui ignorait ses propres filtres, appliquée à un second service.
 */
async function lookupAgent(address: string): Promise<Lookup> {
  const url = `${AGENT_INDEX}?owner_address=${address}&limit=5`
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!response.ok) return { address, verdict: 'inconclusive' }
    const body = (await response.json()) as { items?: Array<{ owner_address?: string; name?: string }>; total?: number }
    const items = body.items ?? []
    if (items.length === 0) return { address, verdict: 'unknown' }
    const match = items.find((i) => String(i.owner_address ?? '').toLowerCase() === address.toLowerCase())
    if (!match) return { address, verdict: 'inconclusive' }
    return { address, verdict: 'registered', agentName: match.name }
  } catch {
    return { address, verdict: 'inconclusive' }
  }
}

/**
 * Énumération propre du catalogue. Le lecteur de `discovery-listing-remote.mts` s'arrête
 * dès qu'il a trouvé NOTRE entrée, ce qui est le bon comportement pour vérifier notre
 * référencement et le mauvais pour échantillonner le marché. On page donc ici, et on
 * signale un parcours écourté au lieu de le laisser passer pour un catalogue entier.
 */
async function sampleCatalogPayTos(wanted: number) {
  const [{ createCdpFacilitatorClient }, { withBazaar }] = await Promise.all([
    import('@coinbase/cdp-sdk/x402'),
    import('@x402/extensions/bazaar'),
  ])
  const client = withBazaar(
    createCdpFacilitatorClient({ baseUrl: CDP_FACILITATOR_URL }) as never,
  ) as unknown as {
    extensions: {
      bazaar: {
        listResources: (p: Record<string, unknown>) => Promise<{ items?: unknown[]; pagination?: { total?: number } }>
      }
    }
  }

  const payTos: string[] = []
  const seen = new Set<string>()
  let scanned = 0
  let total: number | null = null
  const PAGE = 100
  const MAX_PAGES = 400

  for (let page = 0; page < MAX_PAGES && payTos.length < wanted; page += 1) {
    const body = await client.extensions.bazaar.listResources({ limit: PAGE, offset: page * PAGE })
    const items = body.items ?? []
    if (total === null && typeof body.pagination?.total === 'number') total = body.pagination.total
    scanned += items.length
    for (const item of items as any[]) {
      // Le filtre réseau est appliqué CÔTÉ CLIENT : ce facilitateur ignore ses propres
      // filtres, mesuré le 2026-07-30. Ne jamais lui déléguer une restriction.
      const accepts = Array.isArray(item?.accepts) ? item.accepts : []
      for (const accept of accepts) {
        const network = String(accept?.network ?? item?.network ?? '')
        if (!/8453/.test(network) && !/^base$/i.test(network)) continue
        const payTo = String(accept?.payTo ?? '')
        if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) continue
        const key = payTo.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        payTos.push(key)
      }
    }
    if (items.length === 0) break
    if (total !== null && scanned >= total) break
  }
  return { payTos: payTos.slice(0, wanted), scanned, total }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const catalog = await sampleCatalogPayTos(args.resources)
  console.log(`catalog entries scanned: ${catalog.scanned}${catalog.total ? ` of ${catalog.total}` : ''}`)
  console.log(`distinct Base pay-to addresses sampled: ${catalog.payTos.length}`)
  const payTos = catalog.payTos
  if (payTos.length === 0) throw new Error('no usable pay-to address found in the catalog sample')

  const head = Number(await rpc('eth_blockNumber', []))
  const fromBlock = Math.max(0, head - args.blocks)
  console.log(`block window: ${fromBlock} to ${head} (${args.blocks} blocks)`)

  const allPayers = new Set<string>()
  let failedChunks = 0
  for (const [i, payTo] of payTos.entries()) {
    const { payers, failedChunks: failed } = await payersOf(payTo, fromBlock, head)
    failedChunks += failed
    for (const p of payers) allPayers.add(p)
    console.log(`  [${i + 1}/${payTos.length}] ${payTo}: ${payers.size} distinct payer(s)`)
  }

  // Un encaisseur qui se paie lui-même n'est pas un acheteur : on l'exclut du dénominateur.
  for (const payTo of payTos) allPayers.delete(payTo)
  console.log(`\ndistinct payer addresses observed: ${allPayers.size}`)
  if (failedChunks > 0) {
    console.log(`WARNING: ${failedChunks} log range(s) failed — the payer set is incomplete, never read it as "few payers".`)
  }
  if (allPayers.size === 0) throw new Error('no payer observed; widen --blocks or --resources before concluding anything')

  const lookups: Lookup[] = []
  for (const [i, address] of [...allPayers].entries()) {
    lookups.push(await lookupAgent(address))
    if ((i + 1) % 25 === 0) console.log(`  looked up ${i + 1}/${allPayers.size}`)
  }

  const registered = lookups.filter((l) => l.verdict === 'registered')
  const unknown = lookups.filter((l) => l.verdict === 'unknown')
  const inconclusive = lookups.filter((l) => l.verdict === 'inconclusive')
  const decided = registered.length + unknown.length

  const report = {
    version: 1,
    measured_at: new Date().toISOString(),
    question: 'How often is an observed x402 payer address resolvable to a registered agent?',
    sample: {
      catalog_entries_scanned: catalog.scanned,
      catalog_total_announced: catalog.total,
      pay_to_addresses_sampled: payTos.length,
      block_window: { from: fromBlock, to: head, size: args.blocks },
      failed_log_ranges: failedChunks,
      distinct_payers_observed: allPayers.size,
    },
    result: {
      registered: registered.length,
      unknown: unknown.length,
      inconclusive: inconclusive.length,
      share_registered_of_decided: decided === 0 ? null : Number((registered.length / decided).toFixed(4)),
    },
    registered_examples: registered.slice(0, 10),
    reserve: [
      'The index queried holds the TOKEN OWNER address, not the agentWallet declared in the registration file, which it does not expose. This is a LOWER BOUND on identifiability.',
      'An unrecognised filter on that index returns the whole list instead of an error (measured 2026-07-31); every hit here was re-checked client-side against the requested address.',
      'A payer seen once may be a human wallet, a relayer or a facilitator, none of which is the buying agent.',
      'This is a dated order of magnitude on a bounded sample, never a census.',
    ],
  }

  console.log(`\nregistered: ${registered.length}  unknown: ${unknown.length}  inconclusive: ${inconclusive.length}`)
  console.log(
    `share of DECIDED lookups that resolve to a registered agent: ${
      report.result.share_registered_of_decided === null
        ? 'n/a'
        : `${(report.result.share_registered_of_decided * 100).toFixed(1)}%`
    }`,
  )

  if (args.save) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(args.save, JSON.stringify(report, null, 2), 'utf8')
    console.log(`report written to ${args.save}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
