import { getSql } from './db'
import { embed } from './embeddings'

const toVector = (embedding: number[]): string => `[${embedding.join(',')}]`

/** Journal d'activité : trace un appel. Ne doit jamais faire échouer l'appel métier. */
async function logActivity(tool: string, args: Record<string, unknown>, summary: string) {
  try {
    const sql = getSql()
    await sql`insert into activity_log (tool, args, summary) values (${tool}, ${JSON.stringify(args)}::jsonb, ${summary})`
  } catch {
    /* no-op : le journal est best-effort */
  }
}

export type RegisterInput = {
  handle: string
  description: string
  tags?: string[]
  endpoint?: string
  protocols?: string[]
}

/** Enregistre ou met à jour l'annonce d'un agent (upsert sur handle) + embed la description. */
export async function registerAgent(input: RegisterInput) {
  const sql = getSql()
  const vec = toVector(await embed(input.description))
  const [row] = await sql`
    insert into agents (handle, description, tags, endpoint, protocols, embedding)
    values (
      ${input.handle},
      ${input.description},
      ${input.tags ?? []},
      ${input.endpoint ?? null},
      ${input.protocols ?? []},
      ${vec}::vector
    )
    on conflict (handle) do update set
      description = excluded.description,
      tags        = excluded.tags,
      endpoint    = excluded.endpoint,
      protocols   = excluded.protocols,
      embedding   = excluded.embedding,
      updated_at  = now()
    returning id, handle
  `
  await logActivity('register_agent', { handle: input.handle }, `registered ${row?.handle ?? input.handle}`)
  return row
}

/**
 * Recherche sémantique d'agents, enrichie : tags, protocols, origine et réputation
 * jointes aux résultats. Si rien ne passe le seuil, fallback sans seuil pour
 * toujours renvoyer les plus proches (similarité faible visible).
 */
export async function findAgents(input: { query: string; limit?: number }) {
  const sql = getSql()
  const vec = toVector(await embed(input.query))
  const limit = input.limit ?? 10

  const search = (threshold: number) => sql`
    select
      m.handle,
      m.description,
      m.endpoint,
      round(m.similarity::numeric, 3) as similarity,
      a.tags,
      a.protocols,
      a.external_source as listed_from,
      r.total_ratings::int as total_ratings,
      r.avg_score
    from match_agents(${vec}::vector, ${threshold}, ${limit}) m
    join agents a on a.id = m.id
    left join agent_reputation r on r.agent_id = m.id
    order by m.similarity desc
  `

  let rows = await search(0.3)
  let lowConfidence = false
  if (rows.length === 0) {
    rows = await search(0)
    lowConfidence = rows.length > 0
  }

  await logActivity('find_agent', { query: input.query, limit }, `${rows.length} results`)
  return { results: rows, low_confidence: lowConfidence }
}

/** Profil complet d'un agent : annonce, réputation agrégée et dernières notes. */
export async function getAgent(input: { handle: string }) {
  const sql = getSql()
  const [agent] = await sql`
    select
      a.handle, a.display_name, a.description, a.tags, a.endpoint, a.protocols,
      a.external_source as listed_from, a.created_at, a.updated_at,
      r.total_ratings::int  as total_ratings,
      r.native_ratings::int as native_ratings,
      r.imported_ratings::int as imported_ratings,
      r.avg_score, r.native_avg_score
    from agents a
    left join agent_reputation r on r.agent_id = a.id
    where a.handle = ${input.handle}
  `
  await logActivity('get_agent', { handle: input.handle }, `profile ${input.handle}${agent ? '' : ' (not found)'}`)
  if (!agent) return { found: false, handle: input.handle }

  const recentRatings = await sql`
    select r.score, r.comment, r.source, r.created_at
    from ratings r
    join agents a on a.id = r.subject_agent_id
    where a.handle = ${input.handle}
    order by r.created_at desc
    limit 5
  `
  return { found: true, ...agent, recent_ratings: recentRatings }
}

/** Parcours paginé du catalogue, filtrable par tag et par origine (native/imported). */
export async function listAgents(input: {
  tag?: string
  source?: 'native' | 'imported' | 'all'
  limit?: number
  offset?: number
}) {
  const sql = getSql()
  const limit = Math.min(input.limit ?? 20, 100)
  const offset = input.offset ?? 0
  const source = input.source ?? 'all'

  const tagCond = input.tag ? sql`and tags @> array[${input.tag}]::text[]` : sql``
  const sourceCond =
    source === 'native'
      ? sql`and external_source is null`
      : source === 'imported'
        ? sql`and external_source is not null`
        : sql``

  const rows = await sql`
    select handle, description, tags, endpoint, protocols, external_source as listed_from, updated_at
    from agents
    where true ${tagCond} ${sourceCond}
    order by updated_at desc
    limit ${limit} offset ${offset}
  `
  const [{ total }] = await sql`
    select count(*)::int as total from agents where true ${tagCond} ${sourceCond}
  `
  await logActivity('list_agents', { tag: input.tag, source, limit, offset }, `${rows.length}/${total} agents`)
  return { total, limit, offset, results: rows }
}

/** Dépose une note sur un agent (source 'native' par défaut, ou le nom d'un hub d'origine). */
export async function submitRating(input: {
  subjectHandle: string
  score: number
  raterHandle?: string
  comment?: string
  source?: string
}) {
  const sql = getSql()
  const [subject] = await sql`select id from agents where handle = ${input.subjectHandle}`
  if (!subject) throw new Error(`Agent not found: ${input.subjectHandle}`)

  let raterId: string | null = null
  if (input.raterHandle) {
    const [rater] = await sql`select id from agents where handle = ${input.raterHandle}`
    raterId = rater?.id ?? null
  }

  const [row] = await sql`
    insert into ratings (subject_agent_id, rater_agent_id, score, comment, source)
    values (${subject.id}, ${raterId}, ${input.score}, ${input.comment ?? null}, ${input.source ?? 'native'})
    returning id
  `
  await logActivity('submit_rating', { subject: input.subjectHandle, score: input.score }, `rated ${input.subjectHandle}`)
  return row
}

/** Réputation agrégée d'un agent (sépare notes natives vs importées). */
export async function getReputation(input: { handle: string }) {
  const sql = getSql()
  const [row] = await sql`
    select handle, total_ratings::int as total_ratings, native_ratings::int as native_ratings,
           imported_ratings::int as imported_ratings, avg_score, native_avg_score
    from agent_reputation where handle = ${input.handle}
  `
  await logActivity('get_reputation', { handle: input.handle }, `lookup ${input.handle}`)
  return row ?? { handle: input.handle, total_ratings: 0, avg_score: null, note: 'no ratings yet' }
}

/** Statistiques globales du hub (taille du réseau, activité récente). */
export async function hubStats() {
  const sql = getSql()
  const [row] = await sql`
    select
      (select count(*)::int from agents)                                  as total_agents,
      (select count(*)::int from agents where external_source is null)     as native_agents,
      (select count(*)::int from agents where external_source is not null) as imported_agents,
      (select count(*)::int from ratings)                                  as total_ratings,
      (select count(*)::int from ratings where source = 'native')          as native_ratings,
      (select count(*)::int from activity_log
        where created_at > now() - interval '24 hours')                    as tool_calls_last_24h
  `
  await logActivity('hub_stats', {}, `${row.total_agents} agents`)
  return row
}
