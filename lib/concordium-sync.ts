import { getSql } from '@/lib/db'
import { embedMany } from '@/lib/embeddings'

const DIRECTORY_URL = 'https://dashboard.tippingservice.co.uk/api/agents'
const CARD_ORIGIN = 'https://tippingservice.co.uk'
const SOURCE = 'concordium-cis8004'

type DirectoryAgent = {
  token_id?: unknown
  token_address?: unknown
  handle?: unknown
  agent_name?: unknown
  platform?: unknown
  status?: unknown
  owner_account?: unknown
  agent_card_url?: unknown
  metadata_hash_hex?: unknown
  verification_anchor_hex?: unknown
}

type DirectoryResponse = {
  agents?: unknown
}

type AgentCard = {
  name?: unknown
  description?: unknown
  url?: unknown
  skills?: unknown
  provider?: unknown
  concordium?: unknown
}

const shortText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const isPresent = <T>(value: T | null): value is T => value !== null

const validCardUrl = (value: unknown, sourceHandle: string) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.origin !== CARD_ORIGIN) return null
    const expected = `/agents/${encodeURIComponent(sourceHandle)}/.well-known/agent-card.json`
    return url.pathname === expected ? url.toString() : null
  } catch {
    return null
  }
}

const parseDirectoryAgent = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as DirectoryAgent
  const tokenId = Number(item.token_id)
  const sourceHandle = shortText(item.handle, 160)
  if (!Number.isInteger(tokenId) || tokenId < 0 || !sourceHandle) return null
  if (shortText(item.status, 20).toLowerCase() !== 'active') return null
  const cardUrl = validCardUrl(item.agent_card_url, sourceHandle)
  if (!cardUrl) return null
  return {
    tokenId,
    sourceHandle,
    cardUrl,
    tokenAddress: shortText(item.token_address, 160),
    agentName: shortText(item.agent_name, 200) || sourceHandle,
    platform: shortText(item.platform, 80),
    ownerAccount: shortText(item.owner_account, 180),
    metadataHash: shortText(item.metadata_hash_hex, 160),
    verificationAnchor: shortText(item.verification_anchor_hex, 160),
  }
}

const tagsFromCard = (card: AgentCard) => {
  if (!Array.isArray(card.skills)) return ['concordium', 'cis-8004']
  const tags = new Set<string>(['concordium', 'cis-8004'])
  for (const skill of card.skills) {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) continue
    const skillTags = (skill as { tags?: unknown }).tags
    if (!Array.isArray(skillTags)) continue
    for (const value of skillTags) {
      const tag = shortText(value, 64).toLowerCase()
      if (tag) tags.add(tag)
      if (tags.size >= 20) return [...tags]
    }
  }
  return [...tags]
}

async function fetchCard(url: string): Promise<AgentCard | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Agent-Reputation-Registry-Sync/1.0' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const text = await response.text()
    if (text.length > 64_000) return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AgentCard)
      : null
  } catch {
    return null
  }
}

/**
 * Read-only import of cryptographically anchored CIS-8004 agent cards.
 *
 * We deliberately create a source-qualified handle instead of silently merging
 * a Moltbook name with an existing profile.  Cross-registry identity linkage
 * requires proof; matching text alone is not enough.
 */
export async function syncConcordiumAgents(deadlineMs = 90_000) {
  const startedAt = Date.now()
  const response = await fetch(DIRECTORY_URL, {
    headers: { 'User-Agent': 'Agent-Reputation-Registry-Sync/1.0' },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Concordium directory returned HTTP ${response.status}`)
  const text = await response.text()
  if (text.length > 2_000_000) throw new Error('Concordium directory response exceeded 2 MB')
  const body = JSON.parse(text) as DirectoryResponse
  const directory = Array.isArray(body.agents)
    ? body.agents.map(parseDirectoryAgent).filter(isPresent)
    : []
  if (directory.length === 0) return { fetched: 0, cards: 0, upserted: 0 }

  const sql = getSql()
  const existingRows = await sql`
    select external_id, description
    from agents
    where external_source = ${SOURCE}
  `
  const existing = new Map(
    existingRows.map((row) => [String(row.external_id), String(row.description)]),
  )

  const enriched: Array<{
    item: NonNullable<ReturnType<typeof parseDirectoryAgent>>
    card: AgentCard | null
    description: string
    tags: string[]
  }> = []
  const NETWORK_BATCH = 10
  for (let i = 0; i < directory.length && Date.now() - startedAt < deadlineMs; i += NETWORK_BATCH) {
    const chunk = directory.slice(i, i + NETWORK_BATCH)
    const cards = await Promise.all(chunk.map((item) => fetchCard(item.cardUrl)))
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j]
      const card = cards[j]
      const description =
        shortText(card?.description, 4000) ||
        `CIS-8004 agent "${item.sourceHandle}" registered on Concordium with a public, verifiable Agent Card.`
      enriched.push({ item, card, description, tags: card ? tagsFromCard(card) : ['concordium', 'cis-8004'] })
    }
  }

  const changed = enriched.filter(
    ({ item, card, description }) =>
      // Do not replace a previously fetched rich card with fallback text when
      // one upstream card request fails transiently.
      (card !== null || !existing.has(String(item.tokenId))) &&
      existing.get(String(item.tokenId)) !== description,
  )
  const vectors = changed.length
    ? await embedMany(changed.map(({ item, description }) => `${item.agentName}: ${description}`))
    : []
  const vectorByToken = new Map(
    changed.flatMap(({ item }, index) => {
      const vector = vectors[index]
      return Array.isArray(vector)
        ? [[String(item.tokenId), `[${vector.join(',')}]`] as const]
        : []
    }),
  )

  let upserted = 0
  for (const { item, card, description, tags } of enriched) {
    if (card === null && existing.has(String(item.tokenId))) continue
    // Keep the handle inside one URL segment so /agents/[handle] stays
    // addressable without a catch-all route.
    const handle = `cis8004.ccd-${item.tokenId}`
    const provider =
      card?.provider && typeof card.provider === 'object' && !Array.isArray(card.provider)
        ? {
            organization: shortText((card.provider as { organization?: unknown }).organization, 200) || null,
            url: shortText((card.provider as { url?: unknown }).url, 1000) || null,
          }
        : null
    const metadata = {
      source_handle: item.sourceHandle,
      source_platform: item.platform || null,
      agent_card_url: item.cardUrl,
      token_address: item.tokenAddress || null,
      owner_account: item.ownerAccount || null,
      metadata_hash: item.metadataHash || null,
      verification_anchor: item.verificationAnchor || null,
      provider,
      source_profile_url: shortText(card?.url, 1000) || null,
      attestations: [
        {
          type: 'on_chain_registry_entry',
          issuer: 'Tipping Service (Concordium CIS-8004)',
          reference: item.tokenAddress || `token:${item.tokenId}`,
          url: item.cardUrl,
        },
      ],
    }
    const vector = vectorByToken.get(String(item.tokenId))
    if (vector) {
      await sql`
        insert into agents (
          handle, display_name, description, tags, endpoint, protocols, embedding,
          external_source, external_id, metadata
        )
        values (
          ${handle}, ${item.agentName}, ${description}, ${tags}, ${item.cardUrl}, ${['a2a-card']},
          ${vector}::vector, ${SOURCE}, ${String(item.tokenId)}, ${sql.json(metadata)}
        )
        on conflict (external_source, external_id) do update set
          display_name = excluded.display_name,
          description = excluded.description,
          tags = excluded.tags,
          endpoint = excluded.endpoint,
          protocols = excluded.protocols,
          embedding = excluded.embedding,
          metadata = agents.metadata || excluded.metadata,
          updated_at = now()
      `
    } else {
      await sql`
        update agents
        set display_name = ${item.agentName},
            tags = ${tags},
            endpoint = ${item.cardUrl},
            protocols = ${['a2a-card']},
            metadata = metadata || ${sql.json(metadata)},
            updated_at = now()
        where external_source = ${SOURCE} and external_id = ${String(item.tokenId)}
      `
    }
    upserted++
  }
  return {
    fetched: directory.length,
    cards: enriched.filter((item) => item.card !== null).length,
    changed: changed.length,
    upserted,
    source: SOURCE,
  }
}
