// Export machine-readable d'une chronologie de preuves — sortie sur stdout.
//
// Usage (DATABASE_URL requis) :
//   node --experimental-strip-types scripts/evidence-timeline.mts <handle>
//   node --experimental-strip-types scripts/evidence-timeline.mts <handle> --access paid
//   node --experimental-strip-types scripts/evidence-timeline.mts --cohort
//
// Le niveau par défaut est `public` : méthode, provenance, état courant, quels champs ont
// bougé et quand — jamais les valeurs avant/après. C'est ce qui peut être montré. `paid`
// et `private` produisent la chronologie complète : elles s'écrivent sur disque local ou
// se transmettent à un acheteur, elles ne se publient pas. Le script le rappelle sur
// stderr, et le document lui-même porte la mention.
//
// Rien n'est écrit en base par ce script.
import postgres from 'postgres'
import { COHORT_ID } from '../lib/evidence-cohort.ts'
import { loadSubjectObservations, provenanceSource } from '../lib/evidence-store.ts'
import {
  buildCohortIndex,
  buildSubjectTimeline,
  type AccessLevel,
  type CohortIndexEntry,
  type TimelineSubject,
} from '../lib/evidence-timeline.ts'
import type { SubjectKind } from '../lib/evidence-history.ts'

const argv = process.argv.slice(2)
const accessIndex = argv.indexOf('--access')
const access = (accessIndex >= 0 ? argv[accessIndex + 1] : 'public') as AccessLevel
if (!['public', 'paid', 'private'].includes(access)) {
  console.error(`unknown access level "${access}" (public | paid | private)`)
  process.exit(1)
}
const wholeCohort = argv.includes('--cohort')
const handle = argv.find((value, index) => !value.startsWith('--') && argv[index - 1] !== '--access')

if (!wholeCohort && !handle) {
  console.error('usage: evidence-timeline.mts <handle> [--access public|paid|private] | --cohort')
  process.exit(1)
}
if (access !== 'public') {
  console.error(`WARNING: "${access}" output contains the full change history. Do not publish it.`)
}

// Présence seulement : la valeur n'est ni lue, ni journalisée, ni affichée.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

try {
  const rows = wholeCohort
    ? await sql`
        select a.id, a.handle, a.display_name, a.external_source,
               c.stratum, c.selection_rule, c.selection_reason, c.subject_kind
        from evidence_cohort c
        join agents a on a.id = c.agent_id
        where c.active and c.cohort = ${COHORT_ID}
        order by a.handle
      `
    : await sql`
        select a.id, a.handle, a.display_name, a.external_source,
               c.stratum, c.selection_rule, c.selection_reason, c.subject_kind
        from agents a
        left join evidence_cohort c on c.agent_id = a.id and c.active
        where a.handle = ${handle!}
      `

  if (rows.length === 0) {
    console.error(wholeCohort ? 'cohort is empty' : `no subject with handle "${handle}"`)
    process.exit(1)
  }

  const generatedAt = new Date().toISOString()
  const entries: CohortIndexEntry[] = []
  // Séquentiel : une connexion, pooler en transaction.
  for (const row of rows) {
    const observations = await loadSubjectObservations(sql, String(row.id))
    if (observations === null) {
      console.error('evidence tables missing: apply db/migration-evidence-history.sql first')
      process.exit(1)
    }
    entries.push({ subject: toSubject(row), observations })
  }

  const document = wholeCohort
    ? buildCohortIndex({ cohortId: COHORT_ID, entries, access, generatedAt })
    : buildSubjectTimeline({ ...entries[0], access, generatedAt })

  console.log(JSON.stringify(document, null, 2))
} finally {
  await sql.end()
}

function toSubject(row: Record<string, unknown>): TimelineSubject {
  const externalSource = (row.external_source as string | null) ?? null
  return {
    handle: String(row.handle),
    displayName: (row.display_name as string | null) ?? null,
    subjectKind: ((row.subject_kind as SubjectKind | null) ?? 'agent'),
    provenance: provenanceSource(externalSource),
    cohort: row.stratum
      ? {
          id: COHORT_ID,
          stratum: String(row.stratum),
          selectionRule: String(row.selection_rule),
          selectionReason: String(row.selection_reason),
        }
      : null,
  }
}
