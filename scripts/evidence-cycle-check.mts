// Contrôle du premier cycle automatique — LECTURE SEULE, aucune écriture, aucun cron
// déclenché.
//
// Usage :
//   node --experimental-strip-types scripts/evidence-cycle-check.mts
//   node --experimental-strip-types scripts/evidence-cycle-check.mts --since 2026-07-28T00:00:00Z --until 2026-07-28T06:00:00Z
//
// Ce fichier ne fait que les requêtes. Tous les verdicts vivent dans
// lib/evidence-cycle-report.ts, pour être testables sans base — un rapport de contrôle qui
// se trompe est pire qu'aucun rapport, parce qu'il donne la tranquillité sans la preuve.
//
// Règle épistémique : ZÉRO nouvelle observation est un cycle réussi. Le journal n'écrit
// que sur changement, donc l'absence de ligne ne prouve rien. Et aucune requête SQL ne
// prouvera jamais qu'une fonction Vercel a été invoquée : le rapport le dit au lieu
// d'inventer une télémétrie.
import postgres from 'postgres'
import { COHORT_ID } from '../lib/evidence-cohort.ts'
import { isMissingTable } from '../lib/evidence-store.ts'
import { isProbeableEndpoint } from '../lib/endpoint-probe.ts'
import { KNOWN_SOURCES, buildCycleReport, resolveWindow, type CycleFacts } from '../lib/evidence-cycle-report.ts'

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

const resolved = resolveWindow({ since: flag('--since'), until: flag('--until'), now: new Date().toISOString() })
if (!resolved.ok) {
  console.error(resolved.error)
  process.exit(1)
}
const window = resolved.window

// Présence seulement : la valeur n'est ni lue, ni journalisée, ni affichée.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
const num = (value: unknown) => Number(value ?? 0)
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value === null || value === undefined ? null : String(value))

try {
  // Toutes les requêtes sont séquentielles (pooler max:1) et toutes sont des SELECT.
  const [ledger] = await sql`
    select count(*)::int as rows,
           count(distinct subject_agent_id)::int as subjects,
           min(observed_at) as first_observed_at,
           max(observed_at) as last_observed_at
    from evidence_observations
  `.catch((error: unknown) => {
    if (isMissingTable(error)) {
      console.error('evidence tables missing: apply db/migration-evidence-history.sql first')
      process.exit(1)
    }
    throw error
  })

  const bySource = await sql`
    select source, collector, count(*)::int as rows, max(observed_at) as last_observed_at
    from evidence_observations
    group by source, collector
    order by source, collector
  `

  const [inWindow] = await sql`
    select count(*)::int as rows,
           count(*) filter (where previous_observation_id is null)::int as baselines,
           count(*) filter (where previous_observation_id is not null)::int as transitions
    from evidence_observations
    where observed_at >= ${window.since}::timestamptz and observed_at <= ${window.until}::timestamptz
  `

  const windowBySource = await sql`
    select source, collector, count(*)::int as rows
    from evidence_observations
    where observed_at >= ${window.since}::timestamptz and observed_at <= ${window.until}::timestamptz
    group by source, collector
    order by source, collector
  `

  // La sonde écrit endpoint_check.checked_at à CHAQUE passage, même quand rien ne change.
  // Le CASE garantit que la conversion en timestamp ne s'exécute que sur une valeur de la
  // bonne forme : une seule ligne malformée ne doit pas faire échouer tout le rapport.
  const [probeTrace] = await sql`
    select
      count(*) filter (where checked_at is not null
                         and checked_at >= ${window.since}::timestamptz
                         and checked_at <= ${window.until}::timestamptz)::int as fresh_checks,
      max(checked_at) filter (where checked_at is not null
                                and checked_at >= ${window.since}::timestamptz
                                and checked_at <= ${window.until}::timestamptz) as newest_check,
      count(*) filter (where raw is not null and checked_at is null)::int as malformed
    from (
      select metadata->'endpoint_check'->>'checked_at' as raw,
             case when metadata->'endpoint_check'->>'checked_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
                  then (metadata->'endpoint_check'->>'checked_at')::timestamptz
             end as checked_at
      from agents
    ) t
  `

  // CONTEXTE SEULEMENT. L'inscription, le claim et les scripts de maintenance écrivent
  // aussi updated_at : ce nombre ne peut jamais attribuer une écriture à un import.
  const [touched] = await sql`
    select count(*)::int as rows
    from agents
    where updated_at >= ${window.since}::timestamptz and updated_at <= ${window.until}::timestamptz
      and (
        metadata->'endpoint_check'->>'checked_at' is null
        or metadata->'endpoint_check'->>'checked_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
        or (metadata->'endpoint_check'->>'checked_at')::timestamptz < ${window.since}::timestamptz
      )
  `

  const cohortRows = await sql`
    select a.handle, a.endpoint, c.stratum,
           a.metadata->'endpoint_check'->>'checked_at' as checked_at
    from evidence_cohort c
    join agents a on a.id = c.agent_id
    where c.active and c.cohort = ${COHORT_ID}
    order by a.handle
  `

  const [integrity] = await sql`
    select
      (select count(*)::int from evidence_observations o
         where o.previous_observation_id is not null
           and not exists (select 1 from evidence_observations p where p.id = o.previous_observation_id)
      ) as dangling_parents,
      (select count(*)::int from (
         select previous_observation_id from evidence_observations
         where previous_observation_id is not null
         group by previous_observation_id having count(*) > 1
       ) f) as forks,
      (select count(*)::int from (
         select subject_agent_id, source from evidence_observations
         where previous_observation_id is null
         group by subject_agent_id, source having count(*) > 1
       ) b) as duplicate_baselines,
      (select count(*)::int from evidence_observations o
         join evidence_observations p on p.id = o.previous_observation_id
         where p.subject_agent_id <> o.subject_agent_id or p.source <> o.source
      ) as cross_chain_parents,
      (select count(*)::int from evidence_observations o
         join evidence_observations p on p.id = o.previous_observation_id
         where p.content_hash = o.content_hash
      ) as identical_consecutive,
      (select count(*)::int from evidence_observations o
         join evidence_observations p on p.id = o.previous_observation_id
         where o.observed_at < p.observed_at
      ) as backdated
  `

  // Groupé sur la clé de chaîne RÉELLE. subject_key est le handle du jour de
  // l'observation : il change, et deux sujets peuvent en partager un.
  const attribution = await sql`
    select subject_agent_id, source, string_agg(distinct collector, ',' order by collector) as names
    from evidence_observations
    group by subject_agent_id, source
    having count(distinct collector) > 1
    order by subject_agent_id, source
    limit 20
  `

  const unknownSources = await sql`
    select source, count(*)::int as rows
    from evidence_observations
    where source <> all(${[...KNOWN_SOURCES]}::text[])
    group by source
    order by source
  `

  let storage: Record<string, unknown> = { note: 'not readable with the current privileges' }
  try {
    const [sizes] = await sql`
      select pg_total_relation_size('public.evidence_observations') as observations_total_bytes,
             pg_indexes_size('public.evidence_observations')        as observations_index_bytes,
             pg_total_relation_size('public.evidence_cohort')       as cohort_total_bytes
    `
    storage = {
      observations_total_bytes: num(sizes.observations_total_bytes),
      observations_index_bytes: num(sizes.observations_index_bytes),
      cohort_total_bytes: num(sizes.cohort_total_bytes),
    }
  } catch {
    /* privilège manquant : on le dit, on n'invente pas un chiffre */
  }

  const facts: CycleFacts = {
    window,
    cohortId: COHORT_ID,
    ledger: {
      rows: num(ledger?.rows),
      subjects: num(ledger?.subjects),
      firstObservedAt: iso(ledger?.first_observed_at),
      lastObservedAt: iso(ledger?.last_observed_at),
    },
    bySourceCollector: bySource.map((row) => ({
      source: String(row.source),
      collector: String(row.collector),
      rows: num(row.rows),
      lastObservedAt: iso(row.last_observed_at),
    })),
    windowBySourceCollector: windowBySource.map((row) => ({
      source: String(row.source),
      collector: String(row.collector),
      rows: num(row.rows),
    })),
    windowTotals: {
      rows: num(inWindow?.rows),
      baselines: num(inWindow?.baselines),
      transitions: num(inWindow?.transitions),
    },
    probe: {
      freshChecks: num(probeTrace?.fresh_checks),
      newestCheck: iso(probeTrace?.newest_check),
      malformedCheckDates: num(probeTrace?.malformed),
    },
    rowsTouchedWithoutFreshCheck: num(touched?.rows),
    cohort: cohortRows.map((row) => ({
      handle: String(row.handle),
      stratum: String(row.stratum),
      probeable: isProbeableEndpoint(row.endpoint as string | null),
      checkedAt: (row.checked_at as string | null) ?? null,
    })),
    integrity: {
      danglingParents: num(integrity?.dangling_parents),
      forks: num(integrity?.forks),
      duplicateBaselines: num(integrity?.duplicate_baselines),
      crossChainParents: num(integrity?.cross_chain_parents),
      identicalConsecutive: num(integrity?.identical_consecutive),
      backdated: num(integrity?.backdated),
    },
    multiCollectorChains: attribution.map((row) => ({
      subjectAgentId: String(row.subject_agent_id),
      source: String(row.source),
      collectors: String(row.names),
    })),
    unknownSources: unknownSources.map((row) => ({ source: String(row.source), rows: num(row.rows) })),
    storage,
  }

  const report = buildCycleReport(facts, new Date().toISOString())
  console.log(JSON.stringify(report, null, 2))
  if (report.overall === 'failed') process.exitCode = 1
} finally {
  await sql.end()
}
