// Quel est le VRAI taux de résolution d'une adresse payeuse ? — mesure du 2026-07-31.
//
// CE QUE LA PREMIÈRE MESURE NE POUVAIT PAS VOIR. `payer-identifiability.mts` a trouvé 8,6 %
// en interrogeant un index public qui n'expose qu'une seule adresse par agent : celle qui
// POSSÈDE le jeton. Or l'adresse qui ENCAISSE est déclarée ailleurs, dans le fichier
// d'enregistrement que l'agent publie lui-même, et cet index ne le lit pas. Les 8,6 % sont
// donc un plancher dont on ignore la hauteur réelle.
//
// CE QUE CELLE-CI MESURE. On échantillonne des agents enregistrés, on va chercher leur
// fichier d'enregistrement à la source — appel `tokenURI` sur le contrat, puis lecture du
// document — et on compare l'adresse d'encaissement déclarée à l'adresse propriétaire.
//
//   Si les deux coïncident presque toujours, l'index existant capte déjà presque tout et
//   8,6 % est proche du vrai taux : l'index à construire ne vaudrait pas son coût.
//
//   Si elles diffèrent souvent, chaque écart est un agent parfaitement identifiable que
//   l'index public rate, le vrai taux est bien au-dessus, et le chantier redevient un actif.
//
// On relève au passage combien d'agents publient réellement un point de contact machine,
// puisque « joignable » suppose un endpoint et pas seulement un nom.
//
// LECTURE SEULE de bout en bout : aucun paiement, aucune signature, aucune écriture.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/agent-wallet-gap.mts [--agents 300] [--chain 8453] [--save <out.json>]

const AGENT_INDEX = 'https://8004scan.io/api/v1/agents'
const USER_AGENT = 'Agent-Reputation-Wallet-Gap/1.0'

/** RPC public par chaîne. Seules celles qu'on sait joindre sans clé sont échantillonnées. */
const RPC_BY_CHAIN: Record<number, string> = {
  1: 'https://ethereum-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  56: 'https://bsc-rpc.publicnode.com',
}

/** keccak256("tokenURI(uint256)")[0..4] */
const TOKEN_URI_SELECTOR = '0xc87b56dd'

type Args = { agents: number; chain: number | null; save: string | null }

function parseArgs(argv: string[]): Args {
  const out: Args = { agents: 300, chain: null, save: null }
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if (!value) throw new Error(`missing value for ${key}`)
    if (key === '--agents') out.agents = Number(value)
    else if (key === '--chain') out.chain = Number(value)
    else if (key === '--save') out.save = value
    else throw new Error(`unknown argument ${key}`)
  }
  if (!Number.isInteger(out.agents) || out.agents < 1) throw new Error('--agents must be a positive integer')
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Mesuré le 2026-07-31 : tirées à la file, quatre lectures sur cinq échouent sur le RPC
 * public de Base ; espacées de quelques centaines de millisecondes, elles passent toutes.
 * La première version n'attendait pas et concluait « document introuvable » — un faux
 * négatif produit par notre propre impatience, indiscernable d'un fait de terrain. On
 * temporise et on réessaie, et un échec après réessais est compté à part.
 */
async function rpcCall(chainId: number, to: string, data: string): Promise<string | null> {
  const url = RPC_BY_CHAIN[chainId]
  if (!url) return null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleep(900 * attempt)
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      })
      const body = (await response.json()) as { result?: string; error?: unknown }
      if (body.result && !body.error) return body.result
    } catch {
      /* réessai */
    }
  }
  return null
}

/** Décodage d'un `string` ABI renvoyé par eth_call. */
function decodeAbiString(hex: string): string | null {
  try {
    const raw = hex.replace(/^0x/, '')
    if (raw.length < 128) return null
    const length = Number.parseInt(raw.slice(64, 128), 16)
    if (!Number.isFinite(length) || length === 0) return null
    const bytes = raw.slice(128, 128 + length * 2)
    let text = ''
    for (let i = 0; i < bytes.length; i += 2) text += String.fromCharCode(Number.parseInt(bytes.slice(i, i + 2), 16))
    return decodeURIComponent(escape(text))
  } catch {
    return null
  }
}

function toHttpUrl(uri: string): string | null {
  const trimmed = uri.trim()
  if (trimmed.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${trimmed.slice('ipfs://'.length)}`
  if (trimmed.startsWith('ar://')) return `https://arweave.net/${trimmed.slice('ar://'.length)}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('data:')) return trimmed
  return null
}

async function fetchRegistration(uri: string): Promise<any | null> {
  // Découvert le 2026-07-31 en vidant des documents réels : une partie des agents ne met
  // PAS un lien dans `tokenURI`, elle y met le document JSON lui-même, en clair. La
  // première version traitait ces cas comme illisibles — et c'est exactement dans l'un
  // d'eux qu'on a trouvé la première `agentWallet`. Un zéro produit par notre propre
  // lecture est le pire des faux négatifs : il ressemble à une mesure.
  const direct = uri.trim()
  if (direct.startsWith('{')) {
    try {
      return JSON.parse(direct)
    } catch {
      return null
    }
  }

  const url = toHttpUrl(uri)
  if (!url) return null
  try {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',')
      const payload = url.slice(comma + 1)
      const decoded = /;base64/i.test(url.slice(0, comma)) ? Buffer.from(payload, 'base64').toString('utf8') : decodeURIComponent(payload)
      return JSON.parse(decoded)
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * L'adresse d'encaissement telle que le standard la décrit : une clé de métadonnées
 * `agentWallet`. Les fichiers réels varient dans leur mise en forme, donc on cherche la clé
 * sous plusieurs formes plutôt que d'imposer la nôtre — et on ne retient qu'une valeur qui
 * EST une adresse, jamais une chaîne qui y ressemble.
 */
function extractAgentWallets(doc: any): string[] {
  const found = new Set<string>()
  const visit = (node: any, keyHint: string) => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') {
      if (/agentwallet|paymentaddress|payto|walletaddress/i.test(keyHint) && ADDRESS_RE.test(node.trim())) {
        found.add(node.trim().toLowerCase())
      }
      return
    }
    if (Array.isArray(node)) {
      // Forme fréquente : [{ name: 'agentWallet', value: '0x…' }]
      const name = String(node?.name ?? '')
      void name
      for (const item of node) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const label = String((item as any).name ?? (item as any).key ?? (item as any).trait_type ?? '')
          const value = (item as any).value ?? (item as any).address
          if (/agentwallet|paymentaddress|payto|walletaddress/i.test(label) && typeof value === 'string' && ADDRESS_RE.test(value.trim())) {
            found.add(value.trim().toLowerCase())
          }
        }
        visit(item, keyHint)
      }
      return
    }
    if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) visit(value, key)
    }
  }
  visit(doc, '')
  return [...found]
}

function extractServiceEndpoints(doc: any): string[] {
  const endpoints = new Set<string>()
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    const endpoint = (node as any).endpoint
    const name = String((node as any).name ?? (node as any).type ?? '')
    if (typeof endpoint === 'string' && endpoint.trim() && /web|a2a|mcp|email|oasf|ens|did/i.test(name || endpoint)) {
      endpoints.add(`${name || 'service'}:${endpoint.trim().slice(0, 120)}`)
    }
    for (const value of Object.values(node)) visit(value)
  }
  visit(doc)
  return [...endpoints]
}

async function sampleAgents(wanted: number, chain: number | null) {
  const items: any[] = []
  const PAGE = 100
  for (let offset = 0; items.length < wanted; offset += PAGE) {
    const url = new URL(AGENT_INDEX)
    url.searchParams.set('limit', String(PAGE))
    url.searchParams.set('offset', String(offset))
    if (chain !== null) url.searchParams.set('chain_id', String(chain))
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) break
    const body = (await response.json()) as { items?: any[] }
    const page = body.items ?? []
    if (page.length === 0) break
    // Le filtre de chaîne est REVÉRIFIÉ ici : cet index renvoie la liste entière quand un
    // paramètre ne lui parle pas, mesuré le 2026-07-31.
    for (const item of page) {
      if (chain !== null && Number(item?.chain_id) !== chain) continue
      if (!RPC_BY_CHAIN[Number(item?.chain_id)]) continue
      items.push(item)
    }
    if (offset > 5000) break
  }
  return items.slice(0, wanted)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const agents = await sampleAgents(args.agents, args.chain)
  console.log(`agents sampled: ${agents.length}${args.chain ? ` (chain ${args.chain})` : ''}`)
  if (agents.length === 0) throw new Error('no agent sampled on a chain we can reach without a key')

  let uriUnreadable = 0
  let docUnreadable = 0
  let noWallet = 0
  let walletEqualsOwner = 0
  let walletDiffersFromOwner = 0
  let withMachineEndpoint = 0
  const extraAddresses = new Set<string>()
  const owners = new Set<string>()
  const examples: any[] = []

  for (const [i, agent] of agents.entries()) {
    const chainId = Number(agent.chain_id)
    const owner = String(agent.owner_address ?? '').toLowerCase()
    if (ADDRESS_RE.test(owner)) owners.add(owner)

    const tokenIdHex = BigInt(agent.token_id).toString(16).padStart(64, '0')
    const raw = await rpcCall(chainId, agent.contract_address, `${TOKEN_URI_SELECTOR}${tokenIdHex}`)
    const uri = raw ? decodeAbiString(raw) : null
    if (!uri) {
      uriUnreadable += 1
    } else {
      const doc = await fetchRegistration(uri)
      if (!doc) {
        docUnreadable += 1
      } else {
        const wallets = extractAgentWallets(doc)
        const endpoints = extractServiceEndpoints(doc)
        if (endpoints.length > 0) withMachineEndpoint += 1
        if (wallets.length === 0) {
          noWallet += 1
        } else {
          const differs = wallets.filter((w) => w !== owner)
          if (differs.length === 0) walletEqualsOwner += 1
          else {
            walletDiffersFromOwner += 1
            differs.forEach((w) => extraAddresses.add(w))
            if (examples.length < 10) {
              examples.push({ name: agent.name, owner, agentWallets: wallets, endpoints: endpoints.slice(0, 3) })
            }
          }
        }
      }
    }
    await sleep(350) // même raison que dans rpcCall : la hâte fabrique des faux négatifs.
    if ((i + 1) % 25 === 0) console.log(`  resolved ${i + 1}/${agents.length}`)
  }

  const resolved = walletEqualsOwner + walletDiffersFromOwner
  const readable = resolved + noWallet
  const report = {
    version: 1,
    measured_at: new Date().toISOString(),
    question: 'Does the public index (token owner address) already capture the address an agent pays from?',
    sample: {
      agents_sampled: agents.length,
      chain: args.chain,
      token_uri_unreadable: uriUnreadable,
      registration_document_unreadable: docUnreadable,
      registration_readable: readable,
    },
    result: {
      no_agent_wallet_declared: noWallet,
      agent_wallet_equals_owner: walletEqualsOwner,
      agent_wallet_differs_from_owner: walletDiffersFromOwner,
      share_declaring_a_wallet: readable === 0 ? null : Number((resolved / readable).toFixed(4)),
      share_differing_among_declared:
        resolved === 0 ? null : Number((walletDiffersFromOwner / resolved).toFixed(4)),
      distinct_addresses_the_public_index_would_miss: extraAddresses.size,
      agents_publishing_a_machine_endpoint: withMachineEndpoint,
    },
    examples,
    reserve: [
      'A tokenURI or registration document we could not read is counted separately and never as "no wallet".',
      'The index filter is re-checked client-side: it returns the whole list for an unrecognised parameter.',
      'Only chains with a keyless public RPC are sampled, so this is not a market-wide census.',
      'A declared agentWallet is self-reported. It says where the agent claims to transact, not where it did.',
    ],
  }

  console.log(`\nregistration documents read: ${readable} (tokenURI unreadable ${uriUnreadable}, document unreadable ${docUnreadable})`)
  console.log(`declaring a payment wallet: ${resolved}`)
  console.log(`  same as the owner address : ${walletEqualsOwner}`)
  console.log(`  DIFFERENT from the owner  : ${walletDiffersFromOwner}`)
  console.log(`addresses the public index would miss entirely: ${extraAddresses.size}`)
  console.log(`agents publishing at least one machine endpoint: ${withMachineEndpoint}`)

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
