import { getSql } from './db'
import { embed } from './embeddings'

const toVector = (embedding: number[]): string => `[${embedding.join(',')}]`

/** Journal d'activité : trace un appel. Ne doit jamais faire échouer l'appel métier. */
async function logActivity(tool: string, args: Record<string, unknown>, summary: string) {
  try {
    const sql = getSql()
    await sql`insert into activity_log (tool, args, summary) values (${tool}, ${sql.json(args)}, ${summary})`
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

/** Recherche sémantique d'agents par similarité de leur annonce. */
export async function findAgents(input: { query: string; limit?: number }) {
  const sql = getSql()
  const vec = toVector(await embed(input.query))
  const rows = await sql`
    select id, handle, description, endpoint, round(similarity::numeric, 3) as similarity
    from match_agents(${vec}::vector, 0.3, ${input.limit ?? 10})
  `
  await logActivity('find_agent', { query: input.query, limit: input.limit ?? 10 }, `${rows.length} resultats`)
  return rows
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
  if (!subject) throw new Error(`Agent introuvable: ${input.subjectHandle}`)

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
    select handle, total_ratings, native_ratings, imported_ratings, avg_score, native_avg_score
    from agent_reputation where handle = ${input.handle}
  `
  await logActivity('get_reputation', { handle: input.handle }, `lookup ${input.handle}`)
  return row ?? { handle: input.handle, total_ratings: 0, avg_score: null, note: 'aucune note' }
}
