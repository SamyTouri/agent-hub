// Agrège le catalogue du registre MCP officiel dans Agent Hub (source externe).
// Env requis : DATABASE_URL (pooler), OPENAI_API_KEY. Optionnel : LIMIT.
import postgres from 'postgres'
import OpenAI from 'openai'

const { DATABASE_URL, OPENAI_API_KEY } = process.env
if (!DATABASE_URL || !OPENAI_API_KEY) { console.error('MISSING_ENV'); process.exit(1) }
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity

const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 4 })
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

const base = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const byName = new Map()
let cursor = null, pages = 0
while (byName.size < LIMIT) {
  const url = new URL(base)
  url.searchParams.set('limit', '100')
  if (cursor) url.searchParams.set('cursor', cursor)
  const res = await fetch(url)
  if (!res.ok) { console.error('FETCH_FAIL', res.status); break }
  const data = await res.json()
  for (const item of data.servers ?? []) {
    const s = item.server
    const meta = item._meta?.['io.modelcontextprotocol.registry/official']
    if (meta?.isLatest === false) continue
    if (meta?.status && meta.status !== 'active') continue
    if (s?.name && !byName.has(s.name)) byName.set(s.name, s)
    if (byName.size >= LIMIT) break
  }
  cursor = data.metadata?.nextCursor
  pages++
  if (!cursor) break
}
const servers = [...byName.values()]
console.log(`FETCHED ${servers.length} serveurs (latest, actifs) en ${pages} pages`)

const BATCH = 100
let done = 0
for (let i = 0; i < servers.length; i += BATCH) {
  const chunk = servers.slice(i, i + BATCH)
  const inputs = chunk.map((s) => `${s.title || s.name}: ${s.description || ''}`.slice(0, 8000))
  const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: inputs })
  for (let j = 0; j < chunk.length; j++) {
    const s = chunk[j]
    const vec = `[${emb.data[j].embedding.join(',')}]`
    const endpoint = s.remotes?.[0]?.url ?? null
    try {
      await sql`
        insert into agents (handle, display_name, description, endpoint, protocols, embedding, external_source, external_id)
        values (${s.name}, ${s.title ?? null}, ${s.description ?? s.name}, ${endpoint}, ${['mcp']}, ${vec}::vector, 'mcp-registry', ${s.name})
        on conflict (external_source, external_id) do update set
          description = excluded.description, endpoint = excluded.endpoint, embedding = excluded.embedding, updated_at = now()
      `
      done++
    } catch (e) { console.error('SKIP', s.name, (e.message ?? '').slice(0, 80)) }
  }
  console.log(`... ${Math.min(i + BATCH, servers.length)}/${servers.length}`)
}
const [{ count }] = await sql`select count(*) from agents where external_source = 'mcp-registry'`
console.log(`DONE inserted/updated=${done} total_mcp_registry=${count}`)
await sql.end({ timeout: 5 })
