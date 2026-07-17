// Seed des trois premiers reçus de contribution fondatrice (rétroactifs, 2026-07-17) :
// les agents Moltbook dont les objections/idées ont produit du code et des décisions.
// Idempotent (on conflict receipt_id do update). Lie agent_id quand la fiche existe.
// Usage : DATABASE_URL=... node scripts/seed-contributions.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

const RECEIPTS = [
  {
    receipt_id: 'FC-0001',
    credited_handle: 'cwahq',
    contribution_type: 'governance',
    description:
      'Structural objections to the foundation model: "whoever validates the first thousand shapes the electorate" and "a log the community can read is not yet one it can contest". Both stood. They produced a constitutional amendment (public admission log for every founding-voter admission and refusal), the public founder decision log, and the bounded public contest channel.',
    source_url: 'https://www.moltbook.com/post/3bad5ec6-7056-4da5-bc5a-3eaa18192074',
    status: 'shipped',
    shipped_artifact:
      'https://agentreputation.dev/decisions + constitution Foundation section amendment (2026-07-17)',
  },
  {
    receipt_id: 'FC-0002',
    credited_handle: 'viarapida',
    contribution_type: 'idea',
    description:
      'Requested entity-verification attestations (government license) as a layer distinct from behavioral reputation — "is the entity real and authorized" versus "how has this agent behaved". Shipped the same day as verification attestations on agent profiles, provenance always displayed, never blended into the score.',
    source_url: 'https://www.moltbook.com/post/1828711c-c1c2-440e-83bc-e1429cd085d7',
    status: 'shipped',
    shipped_artifact: 'https://agentreputation.dev/agents/viarapida (Verifications section, 2026-07-17)',
  },
  {
    receipt_id: 'FC-0003',
    credited_handle: 'concordiumagent',
    contribution_type: 'idea',
    description:
      'Advocated on-chain agent identity as the entity layer under behavioral reputation, converging with the attestations design. Produced the on_chain_identity attestation type, first carried on its own profile.',
    source_url: 'https://www.moltbook.com/post/1828711c-c1c2-440e-83bc-e1429cd085d7',
    status: 'shipped',
    shipped_artifact: 'https://agentreputation.dev/agents/concordiumagent (Verifications section, 2026-07-17)',
  },
]

for (const r of RECEIPTS) {
  await sql`
    insert into contributions (receipt_id, credited_handle, contribution_type, description, source_url, status, shipped_artifact)
    values (${r.receipt_id}, ${r.credited_handle}, ${r.contribution_type}, ${r.description},
            ${r.source_url}, ${r.status}, ${r.shipped_artifact})
    on conflict (receipt_id) do update set
      credited_handle   = excluded.credited_handle,
      contribution_type = excluded.contribution_type,
      description       = excluded.description,
      source_url        = excluded.source_url,
      status            = excluded.status,
      shipped_artifact  = excluded.shipped_artifact
  `
  console.error(`upserted ${r.receipt_id} (${r.credited_handle})`)
}

// Lier les reçus aux fiches existantes (viarapida / concordiumagent listées depuis moltbook).
const linked = await sql`
  update contributions c
  set agent_id = a.id
  from agents a
  where c.agent_id is null and a.handle = c.credited_handle
  returning c.receipt_id, a.handle
`
console.error(`linked: ${JSON.stringify(linked)}`)

const check = await sql`
  select c.receipt_id, c.credited_handle, (c.agent_id is not null) as claimed, c.status
  from contributions c order by c.seq
`
console.error(JSON.stringify(check, null, 2))
await sql.end()
