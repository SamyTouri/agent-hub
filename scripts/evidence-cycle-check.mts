// Contrôle du premier cycle automatique — LECTURE SEULE, aucune écriture, aucun cron
// déclenché.
//
// Usage :
//   node --experimental-strip-types scripts/evidence-cycle-check.mts
//   node --experimental-strip-types scripts/evidence-cycle-check.mts --since 2026-07-28T00:00:00Z --until 2026-07-28T06:00:00Z
//
// Règle épistémique qui gouverne tout ce fichier : ZÉRO nouvelle observation est un
// cycle réussi. Le journal n'écrit que sur changement, donc l'absence de ligne ne prouve
// rien — ni que le cron a tourné, ni qu'il a échoué. Chaque contrôle rend donc
// `passed`, `failed` ou `inconclusive`, et jamais « tout va bien » par défaut.
//
// Ce que la base NE PEUT PAS prouver : qu'une fonction Vercel a été invoquée. Aucune
// télémétrie n'est inventée ici ; le rapport dit explicitement quand il faut aller
// regarder les logs Vercel, et lesquels.
import postgres from 'postgres'
import { COHORT_ID } from '../lib/evidence-cohort.ts'
import { isMissingTable } from '../lib/evidence-store.ts'
import { isProbeableEndpoint } from '../lib/endpoint-probe.ts'

const CHECK_SCHEMA = 'https://agentreputation.dev/schemas/evidence-cycle-check/v1'

/** Sources dont un collecteur existe réellement dans ce dépôt. Toute autre valeur dans le
 *  journal est une anomalie d'attribution, pas une source. */
const KNOWN_SOURCES = ['mcp-registry', 'concordium-cis8004', 'moltbook', 'native', 'endpoint-probe', 'github-repository']

type Verdict = 'passed' | 'failed' | 'inconclusive'
type Check = {
  id: string
  question: string
  verdict: Verdict
  finding: string
  evidence: Record<string, unknown>
  /** Ce que ce contrôle ne peut pas établir, dit à voix haute. */
  cannot_prove?: string
}

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

const until = flag('--until') ?? new Date().toISOString()
const since = flag('--since') ?? new Date(Date.parse(until) - 24 * 3600 * 1000).toISOString()
if (!Number.isFinite(Date.parse(since)) || !Number.isFinite(Date.parse(until))) {
  console.error('--since and --until must be ISO timestamps')
  process.exit(1)
}

// Présence seulement : la valeur n'est ni lue, ni journalisée, ni affichée.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
const checks: Check[] = []
const num = (value: unknown) => Number(value ?? 0)

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
    where observed_at >= ${since}::timestamptz and observed_at <= ${until}::timestamptz
  `

  const windowBySource = await sql`
    select source, collector, count(*)::int as rows
    from evidence_observations
    where observed_at >= ${since}::timestamptz and observed_at <= ${until}::timestamptz
    group by source, collector
    order by source, collector
  `

  // Le sondeur écrit endpoint_check.checked_at à CHAQUE passage, même quand rien ne
  // change : c'est la seule trace d'exécution que la base porte réellement.
  const [probeTrace] = await sql`
    select count(*)::int as fresh_checks,
           max(metadata->'endpoint_check'->>'checked_at') as newest_check
    from agents
    where metadata->'endpoint_check'->>'checked_at' >= ${since}
      and metadata->'endpoint_check'->>'checked_at' <= ${until}
  `

  // Une fiche touchée dans la fenêtre SANS sonde fraîche a été écrite par autre chose que
  // le sondeur — c'est-à-dire par l'import registre ou Concordium.
  const [importTrace] = await sql`
    select count(*)::int as touched
    from agents
    where updated_at >= ${since}::timestamptz and updated_at <= ${until}::timestamptz
      and coalesce(metadata->'endpoint_check'->>'checked_at', '') < ${since}
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

  const attribution = await sql`
    select subject_key, source, count(distinct collector)::int as collectors,
           string_agg(distinct collector, ',' order by collector) as names
    from evidence_observations
    group by subject_key, source
    having count(distinct collector) > 1
    order by subject_key, source
    limit 20
  `

  const unknownSources = await sql`
    select source, count(*)::int as rows
    from evidence_observations
    where source <> all(${KNOWN_SOURCES}::text[])
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

  // -------------------------------------------------------------------------
  // 1. Les fenêtres de collecte ont-elles laissé une trace d'exécution ?
  // -------------------------------------------------------------------------
  const importTouched = num(importTrace?.touched)
  checks.push({
    id: 'registry-and-concordium-ran',
    question: 'Did the registry / Concordium import leave evidence that it ran in this window?',
    verdict: importTouched > 0 ? 'passed' : 'inconclusive',
    finding:
      importTouched > 0
        ? `${importTouched} catalogue row(s) were written in the window by something other than the endpoint probe, which only the import does.`
        : 'No catalogue row was written by the import in this window. An empty upstream delta produces no write at all, so the database cannot tell "ran with nothing to do" from "did not run".',
    evidence: { rows_touched_by_import: importTouched, window: { since, until } },
    cannot_prove:
      importTouched > 0
        ? undefined
        : 'Whether /api/cron/registry was invoked. Check the Vercel cron logs for that route over this window.',
  })

  const freshChecks = num(probeTrace?.fresh_checks)
  checks.push({
    id: 'daily-endpoint-probe-ran',
    question: 'Did the daily endpoint probe leave evidence that it ran in this window?',
    // The probe writes the current-state check on every pass, changed or not. No fresh
    // check at all therefore means the probe step left no trace, which is a real finding.
    verdict: freshChecks > 0 ? 'passed' : 'failed',
    finding:
      freshChecks > 0
        ? `${freshChecks} catalogue row(s) carry a check dated inside the window; the newest is ${probeTrace?.newest_check}.`
        : 'No catalogue row carries a check dated inside the window. The probe writes on every pass, so its step left no trace at all.',
    evidence: { rows_with_fresh_check: freshChecks, newest_check: probeTrace?.newest_check ?? null },
    cannot_prove:
      freshChecks > 0
        ? undefined
        : 'Whether /api/cron/daily was never invoked, or was invoked and failed before writing. Only the Vercel logs separate those.',
  })

  // -------------------------------------------------------------------------
  // 2. Combien de sujets suivis ont réellement été examinés ?
  // -------------------------------------------------------------------------
  const cohort = cohortRows.map((row) => ({
    handle: String(row.handle),
    stratum: String(row.stratum),
    probeable: isProbeableEndpoint(row.endpoint as string | null),
    checkedAt: (row.checked_at as string | null) ?? null,
  }))
  const probeable = cohort.filter((member) => member.probeable)
  const freshCohort = probeable.filter((member) => member.checkedAt !== null && member.checkedAt >= since && member.checkedAt <= until)
  const staleCohort = probeable.filter((member) => !(member.checkedAt !== null && member.checkedAt >= since && member.checkedAt <= until))
  checks.push({
    id: 'cohort-examined',
    question: 'How many tracked subjects were actually examined in this window?',
    verdict: probeable.length === 0 ? 'inconclusive' : freshCohort.length === probeable.length ? 'passed' : freshCohort.length === 0 ? 'failed' : 'inconclusive',
    finding: `${freshCohort.length} of ${probeable.length} cohort subject(s) with a public endpoint carry a check inside the window (cohort size ${cohort.length}).`,
    evidence: {
      cohort_size: cohort.length,
      with_public_endpoint: probeable.length,
      freshly_checked: freshCohort.length,
      // Named, because "some were missed" is only actionable if you know which.
      not_freshly_checked: staleCohort.map((member) => member.handle),
    },
    cannot_prove:
      'Subjects without a public endpoint are not probed at all; their profile history depends on the import, not on this window.',
  })

  // -------------------------------------------------------------------------
  // 3. Déduplication contre transitions conservées
  // -------------------------------------------------------------------------
  const identicalConsecutive = num(integrity?.identical_consecutive)
  const availabilityWritten = windowBySource
    .filter((row) => row.source === 'endpoint-probe')
    .reduce((total, row) => total + num(row.rows), 0)
  checks.push({
    id: 'deduplication-and-transitions',
    question: 'Were identical states deduplicated while genuine transitions were kept?',
    verdict: identicalConsecutive === 0 ? 'passed' : 'failed',
    finding:
      identicalConsecutive === 0
        ? `No chain contains two consecutive identical states. ${freshCohort.length} subject(s) were checked and ${availabilityWritten} availability observation(s) were written, so ${Math.max(0, freshCohort.length - availabilityWritten)} identical state(s) were correctly not stored.`
        : `${identicalConsecutive} chain(s) contain two consecutive identical states, which the deduplication rule should have refused.`,
    evidence: {
      identical_consecutive_pairs: identicalConsecutive,
      observations_written_in_window: num(inWindow?.rows),
      baselines_in_window: num(inWindow?.baselines),
      transitions_in_window: num(inWindow?.transitions),
      availability_observations_in_window: availabilityWritten,
      deduplicated_estimate: Math.max(0, freshCohort.length - availabilityWritten),
    },
    cannot_prove:
      'Zero new observations is a normal successful cycle. This check says nothing about whether a cron ran; see the execution checks above.',
  })

  // -------------------------------------------------------------------------
  // 4. Défauts de chaîne et anomalies d'attribution
  // -------------------------------------------------------------------------
  const defects = {
    dangling_parents: num(integrity?.dangling_parents),
    forks: num(integrity?.forks),
    duplicate_baselines: num(integrity?.duplicate_baselines),
    cross_chain_parents: num(integrity?.cross_chain_parents),
    identical_consecutive: identicalConsecutive,
    backdated: num(integrity?.backdated),
    multi_collector_chains: attribution.length,
    unknown_sources: unknownSources.length,
  }
  const defectTotal = Object.values(defects).reduce((total, value) => total + value, 0)
  checks.push({
    id: 'ledger-integrity',
    question: 'Are there broken chains, forks, duplicate successors or attribution anomalies?',
    verdict: defectTotal === 0 ? 'passed' : 'failed',
    finding:
      defectTotal === 0
        ? 'No broken chain, fork, duplicate baseline, cross-chain parent, backdated row, multi-author chain or unknown source.'
        : `${defectTotal} integrity finding(s) across ${Object.entries(defects).filter(([, value]) => value > 0).map(([key]) => key).join(', ')}.`,
    evidence: {
      ...defects,
      multi_collector_examples: attribution.map((row) => ({ subject: row.subject_key, source: row.source, collectors: row.names })),
      unknown_source_rows: unknownSources.map((row) => ({ source: row.source, rows: num(row.rows) })),
    },
  })

  // -------------------------------------------------------------------------
  // 5. Inventaire
  // -------------------------------------------------------------------------
  checks.push({
    id: 'inventory',
    question: 'What rows, sources, collectors and storage are involved?',
    verdict: 'passed',
    finding: `${num(ledger?.rows)} observation(s) over ${num(ledger?.subjects)} subject(s), from ${bySource.length} source/collector pair(s).`,
    evidence: {
      observations: num(ledger?.rows),
      subjects: num(ledger?.subjects),
      first_observed_at: ledger?.first_observed_at ?? null,
      last_observed_at: ledger?.last_observed_at ?? null,
      by_source_and_collector: bySource.map((row) => ({
        source: row.source,
        collector: row.collector,
        rows: num(row.rows),
        last_observed_at: row.last_observed_at,
      })),
      in_window_by_source_and_collector: windowBySource.map((row) => ({
        source: row.source,
        collector: row.collector,
        rows: num(row.rows),
      })),
      storage,
    },
  })

  const failed = checks.filter((check) => check.verdict === 'failed')
  const inconclusive = checks.filter((check) => check.verdict === 'inconclusive')
  const overall: Verdict = failed.length > 0 ? 'failed' : inconclusive.length > 0 ? 'inconclusive' : 'passed'

  console.log(
    JSON.stringify(
      {
        schema: CHECK_SCHEMA,
        generated_at: new Date().toISOString(),
        window: { since, until },
        cohort: COHORT_ID,
        read_only: true,
        overall,
        overall_basis:
          failed.length > 0
            ? `failing checks: ${failed.map((check) => check.id).join(', ')}`
            : inconclusive.length > 0
              ? `the database cannot settle: ${inconclusive.map((check) => check.id).join(', ')}`
              : 'every check the database can settle is satisfied',
        vercel_check_required: [
          'The database cannot prove that a Vercel function was invoked, only that something wrote.',
          'Confirm the invocations of /api/cron/registry and /api/cron/daily in the Vercel cron logs for this window.',
          'A cron that ran and legitimately wrote nothing is indistinguishable here from one that never ran.',
        ],
        checks,
      },
      null,
      2,
    ),
  )
  if (overall === 'failed') process.exitCode = 1
} finally {
  await sql.end()
}
