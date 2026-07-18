import { getSql } from '@/lib/db'
import { embedMany } from '@/lib/embeddings'

const REGISTRY = 'https://registry.modelcontextprotocol.io/v0.1/servers'

type RegistryServer = {
  name: string
  title?: string
  description?: string
  remotes?: Array<{ url?: string }>
  repository?: { url?: string }
}

const githubRepoUrl = (value: string | undefined) => {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part.replace(/\.git$/i, '')))) return null
    return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`
  } catch {
    return null
  }
}

// Delta-import quotidien du registre MCP officiel (même mapping que
// scripts/import-mcp-registry.mjs, mais filtré par updated_since et borné par
// un budget temps : la route cron Vercel Hobby plafonne à 60 s au total).
export async function syncRegistryDelta(sinceHours = 25, deadlineMs = 35_000, upsertBudgetMs = deadlineMs) {
  const t0 = Date.now()
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()
  const byName = new Map<string, RegistryServer>()
  let cursor: string | null = null
  let pages = 0

  while (Date.now() - t0 < deadlineMs && pages < 30) {
    const url = new URL(REGISTRY)
    url.searchParams.set('limit', '100')
    url.searchParams.set('updated_since', since)
    if (cursor) url.searchParams.set('cursor', cursor)
    // Le registre répond parfois lentement (>10 s au premier hit) : timeout large + 1 retry.
    let res: Response | null = null
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      } catch {
        if (attempt === 1 || Date.now() - t0 > deadlineMs) return { fetched: byName.size, upserted: 0, pages, note: 'registry fetch timeout' }
      }
    }
    if (!res || !res.ok) break
    const data = await res.json()
    for (const item of data.servers ?? []) {
      const s = item.server as RegistryServer | undefined
      const meta = item._meta?.['io.modelcontextprotocol.registry/official']
      if (meta?.isLatest === false) continue
      if (meta?.status && meta.status !== 'active') continue
      if (s?.name && !byName.has(s.name)) byName.set(s.name, s)
    }
    cursor = data.metadata?.nextCursor ?? null
    pages++
    if (!cursor) break
  }

  const servers = [...byName.values()]
  if (servers.length === 0) return { fetched: 0, upserted: 0, pages }

  const sql = getSql()
  let upserted = 0
  const BATCH = 100
  // Budget séparé pour la phase upsert : le fetch du registre peut consommer tout
  // deadlineMs à lui seul (pages lentes), il ne doit pas priver les inserts.
  const t1 = Date.now()
  for (let i = 0; i < servers.length && Date.now() - t1 < upsertBudgetMs; i += BATCH) {
    const chunk = servers.slice(i, i + BATCH)
    const vectors = await embedMany(chunk.map((s) => `${s.title || s.name}: ${s.description || ''}`))
    for (let j = 0; j < chunk.length; j++) {
      const s = chunk[j]
      const vec = `[${vectors[j].join(',')}]`
      const endpoint = s.remotes?.[0]?.url ?? null
      const repo = githubRepoUrl(s.repository?.url)
      const metadata = repo ? { repo } : {}
      try {
        await sql`
          insert into agents (handle, display_name, description, endpoint, protocols, embedding, external_source, external_id, metadata)
          values (${s.name}, ${s.title ?? null}, ${s.description ?? s.name}, ${endpoint}, ${['mcp']}, ${vec}::vector, 'mcp-registry', ${s.name}, ${JSON.stringify(metadata)}::jsonb)
          on conflict (external_source, external_id) do update set
            description = excluded.description,
            endpoint = excluded.endpoint,
            embedding = excluded.embedding,
            metadata = agents.metadata || excluded.metadata,
            updated_at = now()
        `
        upserted++
      } catch {
        /* handle en conflit avec un agent natif : skip, comme l'import initial */
      }
    }
  }
  return { fetched: servers.length, upserted, pages }
}
