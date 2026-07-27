import { getSql, type Sql } from '@/lib/db'
import { embedMany } from '@/lib/embeddings'
import { EVIDENCE_SCHEMA_VERSION, profileFacts, type ObservationInput } from '@/lib/evidence-history'
import { appendObservations, loadActiveCohort, type AppendOutcome } from '@/lib/evidence-store'

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
export async function syncRegistryDelta(
  sinceHours = 25,
  deadlineMs = 35_000,
  upsertBudgetMs = deadlineMs,
  observationBudgetMs = 15_000,
) {
  const t0 = Date.now()
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString()
  const byName = new Map<string, RegistryServer>()
  // Quand la fiche a changé EN AMONT, d'après le registre lui-même. À ne pas confondre
  // avec le moment où nous avons regardé : c'est la différence entre une date d'effet et
  // une date de constat, et le journal de preuves conserve les deux séparément.
  const effectiveByName = new Map<string, string>()
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
      if (s?.name && !byName.has(s.name)) {
        byName.set(s.name, s)
        if (typeof meta?.updatedAt === 'string') effectiveByName.set(s.name, meta.updatedAt)
      }
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
          values (${s.name}, ${s.title ?? null}, ${s.description ?? s.name}, ${endpoint}, ${['mcp']}, ${vec}::vector, 'mcp-registry', ${s.name}, ${sql.json(metadata)})
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

  const observations = await recordCohortProfiles(sql, byName, effectiveByName, observationBudgetMs)
  return { fetched: servers.length, upserted, pages, observations }
}

/**
 * Historisation bornée : uniquement les sujets de la cohorte suivie, uniquement ceux que
 * ce delta vient de rapporter, et uniquement quand l'empreinte normalisée a changé.
 *
 * Aucun chemin d'écriture non borné n'est créé ici : la cohorte plafonne à 50 sujets, donc
 * ce bloc coûte une lecture et, les jours ordinaires, zéro écriture. Toute erreur est
 * absorbée — l'import du registre est le travail principal du cron et ne doit pas échouer
 * parce que le journal de preuves a un souci, ni parce que sa migration n'est pas encore
 * appliquée.
 */
async function recordCohortProfiles(
  sql: Sql,
  byName: Map<string, RegistryServer>,
  effectiveByName: Map<string, string>,
  budgetMs: number,
): Promise<AppendOutcome | { ok: false; reason: string }> {
  const startedAt = Date.now()
  if (budgetMs <= 0) return { ok: false, reason: 'no_time_budget' }
  try {
    const cohort = await loadActiveCohort(sql)
    if (cohort === null) return { ok: false, reason: 'not_migrated' }

    const observedAt = new Date().toISOString()
    const inputs: ObservationInput[] = []
    for (const member of cohort) {
      if (member.externalSource !== 'mcp-registry' || !member.externalId) continue
      const server = byName.get(member.externalId)
      if (!server) continue
      inputs.push({
        subjectKind: member.subjectKind,
        subjectAgentId: member.agentId,
        subjectKey: member.handle,
        source: 'mcp-registry',
        sourceUrl: REGISTRY,
        observedAt,
        effectiveAt: effectiveByName.get(member.externalId) ?? null,
        facts: profileFacts({
          displayName: server.title,
          description: server.description,
          endpoint: server.remotes?.[0]?.url,
          protocols: ['mcp'],
          repository: githubRepoUrl(server.repository?.url),
        }),
        // Le registre MCP officiel est public : le résumé normalisé peut être montré.
        // Ce qui reste payant, c'est la chronologie complète, pas ce constat isolé.
        visibility: 'public_summary',
        collector: 'cron:registry',
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
      })
      if (Date.now() - startedAt > budgetMs) break
    }
    if (inputs.length === 0) return { ok: true, considered: 0, written: 0, unchanged: 0, refused: 0 }
    return await appendObservations(sql, inputs)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.slice(0, 200) : 'observation failed' }
  }
}
