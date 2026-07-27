// Sélection de la cohorte pilote et capture du socle historique — idempotent.
//
// Usage (DATABASE_URL requis, pooler) :
//   node --experimental-strip-types scripts/evidence-cohort.mts              # simulation
//   node --experimental-strip-types scripts/evidence-cohort.mts --apply      # écrit cohorte + socle
//   node --experimental-strip-types scripts/evidence-cohort.mts --baseline   # socle seul
//
// La simulation est le mode par défaut : rien n'est écrit tant que --apply ou --baseline
// n'est pas passé explicitement. Relancer --apply ne réécrit jamais une raison de
// sélection déjà enregistrée (on conflict do nothing) — l'auditabilité de la cohorte
// suppose que la justification reste celle du jour où le sujet a été retenu.
//
// Aucun secret n'est lu ni affiché : la connexion vient de l'environnement.
import postgres from 'postgres'
import {
  BUSINESS_SYSTEM_FAMILIES,
  COHORT_ID,
  familyRegex,
  selectCohort,
  validateCohort,
  type CandidateSubject,
  type CohortPick,
} from '../lib/evidence-cohort.ts'
import { EVIDENCE_SCHEMA_VERSION, availabilityFacts, profileFacts, type ObservationInput } from '../lib/evidence-history.ts'
import { appendObservations, loadActiveCohort, provenanceSource } from '../lib/evidence-store.ts'
import type { EndpointCheck } from '../lib/endpoint-probe.ts'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const BASELINE_ONLY = !APPLY && args.has('--baseline')
for (const arg of args) {
  if (arg !== '--apply' && arg !== '--baseline') console.error(`ignoring unknown argument "${arg}"`)
}

// Présence seulement : la valeur n'est ni lue, ni journalisée, ni affichée.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

try {
  if (BASELINE_ONLY) {
    // Le socle travaille sur la cohorte DÉJÀ écrite : il ne recalcule pas la sélection et
    // n'a donc pas à dépendre de l'état actuel du catalogue. Un sujet remis en ligne ne
    // doit pas empêcher de rafraîchir l'historique d'une cohorte valide.
    const baseline = await captureBaseline()
    console.log(JSON.stringify({ mode: 'baseline', cohort: COHORT_ID, baseline }, null, 2))
  } else {
    const picks = await selectFromCatalogue()
    const problems = validateCohort(picks)

    console.error(`\nselected ${picks.length} subjects`)
    for (const pick of picks) {
      console.error(`  [${pick.stratum}${pick.selectionFamily ? `/${pick.selectionFamily}` : ''}] ${pick.handle}`)
    }
    if (problems.length > 0) {
      console.error('\ncohort invariants violated:')
      for (const problem of problems) console.error(`  ${problem.code}: ${problem.detail}`)
    }

    if (!APPLY) {
      console.log(JSON.stringify({ mode: 'dry-run', cohort: COHORT_ID, selected: picks.length, problems, picks }, null, 2))
    } else if (problems.length > 0) {
      // Une cohorte hors invariants ne s'écrit pas « en attendant » : elle serait citée
      // plus tard comme si elle avait été validée.
      console.error('\nrefusing to write: fix the invariants first')
      process.exitCode = 1
    } else {
      const inserted = await writeCohort(picks)
      const baseline = await captureBaseline()
      console.log(JSON.stringify({ mode: 'apply', cohort: COHORT_ID, inserted, baseline }, null, 2))
    }
  }
} finally {
  await sql.end()
}

type Row = Record<string, unknown>

function toCandidate(row: Row): CandidateSubject {
  return {
    agentId: String(row.id),
    handle: String(row.handle),
    displayName: (row.display_name as string | null) ?? null,
    description: String(row.description ?? ''),
    externalSource: (row.external_source as string | null) ?? null,
    externalId: (row.external_id as string | null) ?? null,
    endpoint: (row.endpoint as string | null) ?? null,
    repository: (row.repository as string | null) ?? null,
    hasRepositoryObservation: row.has_repository_observation === true,
    endpointCheck: (row.endpoint_check as EndpointCheck | null) ?? null,
  }
}

/**
 * Les requêtes ci-dessous ne font que PRÉ-FILTRER. La règle de sélection vit dans
 * lib/evidence-cohort.ts et est réappliquée sur l'union des candidats, donc la cohorte est
 * reproductible sans base : les mêmes lignes donnent toujours la même cohorte. Le tri est
 * alphabétique, jamais par popularité, et chaque requête est bornée.
 */
async function selectFromCatalogue(): Promise<CohortPick[]> {
  const candidates = new Map<string, CandidateSubject>()
  const add = (rows: readonly Row[]) => {
    for (const row of rows) {
      const candidate = toCandidate(row)
      if (!candidates.has(candidate.agentId)) candidates.set(candidate.agentId, candidate)
    }
  }

  // Le pré-filtre SQL utilise EXACTEMENT la même expression que la règle (familyRegex) et
  // le même champ : dernier segment du handle + nom affiché, jamais la description ni le
  // préfixe de namespace. Un pré-filtre plus large affamerait la famille — les soixante
  // premières lignes « %box% » par ordre alphabétique peuvent toutes être des `sandbox-*`.
  for (const { family, keywords } of BUSINESS_SYSTEM_FAMILIES) {
    const pattern = familyRegex(keywords)
    const rows = await sql`
      select id, handle, display_name, description, external_source, external_id, endpoint,
             metadata->>'repo'           as repository,
             (metadata ? 'github_stars') as has_repository_observation,
             metadata->'endpoint_check'  as endpoint_check
      from agents
      where external_source = 'mcp-registry'
        and (endpoint ilike 'http%' or metadata ? 'repo')
        and (
          lower(regexp_replace(handle, '^.*/', '')) ~ ${pattern}
          or lower(coalesce(display_name, '')) ~ ${pattern}
        )
      order by handle asc
      limit 60
    `
    console.error(`candidates ${family}: ${rows.length}`)
    add(rows)
  }

  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo'           as repository,
           (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check'  as endpoint_check
    from agents
    where external_source = 'mcp-registry'
      and metadata ? 'repo'
      and metadata ? 'github_stars'
      and endpoint ilike 'http%'
    order by handle asc
    limit 80
  `)

  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo'           as repository,
           (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check'  as endpoint_check
    from agents
    where endpoint ilike 'http%'
      and metadata->'endpoint_check'->>'responded' = 'false'
    order by handle asc
    limit 80
  `)

  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo'           as repository,
           (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check'  as endpoint_check
    from agents
    where external_source is distinct from 'mcp-registry'
      -- Même exigence que les autres strates : un sujet sans rien à regarder ne produirait
      -- qu'un socle, éternellement. Le pré-filtre le dit aussi, pour ne pas remonter des
      -- candidats que la règle écartera de toute façon.
      and (endpoint ilike 'http%' or metadata ? 'repo')
    order by handle asc
    limit 80
  `)

  console.error(`\ncandidate pool: ${candidates.size}`)
  return selectCohort([...candidates.values()])
}

async function writeCohort(picks: readonly CohortPick[]) {
  let inserted = 0
  // Séquentiel : pooler en transaction, max:1.
  for (const pick of picks) {
    const result = await sql`
      insert into evidence_cohort (
        agent_id, subject_key, cohort, stratum, selection_rule, selection_family,
        selection_reason, subject_kind
      ) values (
        ${pick.agentId}::uuid, ${pick.handle}, ${COHORT_ID}, ${pick.stratum}, ${pick.selectionRule},
        ${pick.selectionFamily}, ${pick.selectionReason}, ${pick.subjectKind}
      )
      on conflict (agent_id) do nothing
    `
    inserted += result.count
  }
  console.error(`cohort rows inserted: ${inserted} (already present: ${picks.length - inserted})`)
  return inserted
}

/**
 * Socle historique : la PREMIÈRE observation de chaque sujet, et rien d'autre.
 *
 * Le socle lit la fiche déjà stockée en base ; les crons, eux, lisent la charge utile
 * fraîche du registre. Ce sont deux lectures de la même réalité, jamais strictement
 * identiques — un champ qu'un import n'a pas encore répercuté suffit. Si le socle avait le
 * droit de PROLONGER une chaîne, relancer la commande écrirait un « changement » qui n'a
 * jamais eu lieu chez le vendeur, et le journal étant immuable, cette fausse preuve serait
 * définitive. D'où `initializeOnly` : toute chaîne déjà commencée est sautée, quel que
 * soit son contenu.
 *
 * Relancer la commande est donc sûr et sans effet sur les sujets déjà amorcés ; elle ne
 * sert plus qu'à amorcer les sujets ajoutés depuis.
 */
async function captureBaseline() {
  const cohort = await loadActiveCohort(sql)
  if (cohort === null) {
    console.error('evidence tables missing: apply db/migration-evidence-history.sql first')
    process.exitCode = 1
    return { skipped: 'not_migrated' }
  }

  const observedAt = new Date().toISOString()
  const profiles: ObservationInput[] = cohort.map((member) => ({
    subjectKind: member.subjectKind,
    subjectAgentId: member.agentId,
    subjectKey: member.handle,
    source: provenanceSource(member.externalSource),
    sourceUrl: member.endpoint,
    observedAt,
    effectiveAt: null,
    facts: profileFacts({
      displayName: member.displayName,
      description: member.description,
      endpoint: member.endpoint,
      protocols: member.protocols,
      repository: member.repository,
    }),
    visibility: 'public_summary',
    collector: 'script:evidence-cohort',
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
  }))

  const availability: ObservationInput[] = cohort
    .filter((member) => member.endpointCheck?.checked_at)
    .map((member) => ({
      subjectKind: member.subjectKind,
      subjectAgentId: member.agentId,
      subjectKey: member.handle,
      source: 'endpoint-probe',
      sourceUrl: member.endpoint,
      observedAt,
      effectiveAt: null,
      facts: availabilityFacts(member.endpointCheck),
      visibility: 'public_summary',
      collector: 'script:evidence-cohort',
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
    }))

  const profileOutcome = await appendObservations(sql, profiles, { initializeOnly: true })
  const availabilityOutcome = await appendObservations(sql, availability, { initializeOnly: true })
  console.error(
    `baseline: profiles started=${profileOutcome.written} already-tracked=${profileOutcome.skipped}, ` +
      `availability started=${availabilityOutcome.written} already-tracked=${availabilityOutcome.skipped}`,
  )
  if (!profileOutcome.ok || !availabilityOutcome.ok) {
    console.error(`baseline reported a problem: ${profileOutcome.error ?? availabilityOutcome.error ?? 'see output'}`)
    process.exitCode = 1
  }
  return { profiles: profileOutcome, availability: availabilityOutcome }
}
