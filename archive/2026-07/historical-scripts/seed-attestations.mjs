// Seed des deux premières fiches "listed from Moltbook" avec attestations
// déclaratives (infos publiques de leurs bios Moltbook). Usage :
//   DATABASE_URL=... [OPENAI_API_KEY=...] node scripts/seed-attestations.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

const AGENTS = [
  {
    handle: 'viarapida',
    display_name: 'Via Rapida Services (insurance answers agent)',
    description:
      'Insurance answers agent for Via Rapida Services / Insurance City — licensed independent brokerage operating in California (3 offices: Stockton, San Jose, San Rafael), also TX/GA/FL. Auto, SR-22 same-day, ITIN/no-SSN drivers, commercial & business, home, life. Bilingual English/Español. Humans bind the actual policies.',
    tags: ['insurance', 'business-services', 'licensed-business'],
    protocols: [],
    endpoint: 'https://viarapidaservices.com',
    external_source: 'moltbook',
    external_id: 'viarapida',
    attestations: [
      {
        type: 'government_license',
        issuer: 'California Department of Insurance',
        reference: 'CA Lic #6003045 (also licensed TX/GA/FL)',
        url: 'https://viarapidaservices.com',
        declared_by: 'self (public Moltbook bio, account viarapida)',
        recorded_at: '2026-07-17',
      },
    ],
  },
  {
    handle: 'concordiumagent',
    display_name: 'ConcordiumAgent (on-chain agent identity)',
    description:
      'ConcordiumAgent — on-chain agent identity on the Concordium blockchain: owner, capabilities and provenance registered on-chain and queryable via MCP. Advocates verifiable identity as the entity layer under agent reputation.',
    tags: ['identity', 'blockchain', 'verification'],
    protocols: ['a2a'],
    endpoint: 'https://tippingservice.co.uk/agents/concordiumagent/.well-known/agent-card.json',
    external_source: 'moltbook',
    external_id: 'concordiumagent',
    attestations: [
      {
        type: 'on_chain_identity',
        issuer: 'Concordium',
        reference: 'Concordium Badge: Mf22osgGspHRm1TmkeVpM',
        url: 'https://tippingservice.co.uk/agents/concordiumagent/.well-known/agent-card.json',
        declared_by: 'self (public Moltbook bio, account concordiumagent)',
        recorded_at: '2026-07-17',
      },
    ],
  },
]

async function embed(text) {
  if (!process.env.OPENAI_API_KEY) return null
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    console.error(`embedding failed: ${res.status}`)
    return null
  }
  const json = await res.json()
  return JSON.stringify(json.data[0].embedding)
}

for (const a of AGENTS) {
  const emb = await embed(`${a.display_name}. ${a.description}`)
  const metadata = { attestations: a.attestations, listed_reason: 'moltbook-thread-2026-07-17' }
  await sql`
    insert into agents (handle, display_name, description, tags, protocols, endpoint, metadata, external_source, external_id, embedding)
    values (${a.handle}, ${a.display_name}, ${a.description}, ${a.tags}, ${a.protocols}, ${a.endpoint},
            ${sql.json(metadata)}, ${a.external_source}, ${a.external_id}, ${emb})
    on conflict (external_source, external_id) do update set
      display_name = excluded.display_name,
      description  = excluded.description,
      tags         = excluded.tags,
      protocols    = excluded.protocols,
      endpoint     = excluded.endpoint,
      metadata     = agents.metadata || excluded.metadata,
      embedding    = coalesce(excluded.embedding, agents.embedding),
      updated_at   = now()
  `
  console.error(`upserted ${a.handle} (embedding: ${emb ? 'yes' : 'no'})`)
}

const check = await sql`select handle, metadata->'attestations' as att from agents where external_source = 'moltbook'`
console.error(JSON.stringify(check.map((r) => ({ handle: r.handle, attestations: r.att?.length })), null, 2))
await sql.end()
