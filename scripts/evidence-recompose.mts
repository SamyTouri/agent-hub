// Recomposition de la cohorte sous le plafond par opérateur — plan, puis application.
//
// Usage (DATABASE_URL requis, pooler) :
//   node --experimental-strip-types scripts/evidence-recompose.mts --plan <fichier.json>
//   node --experimental-strip-types scripts/evidence-recompose.mts --apply --manifest <fichier.json>
//
// Ce que la recomposition fait, et surtout ce qu'elle ne fait pas. Elle DÉSACTIVE des
// lignes de cohorte et en admet d'autres. Elle ne touche jamais au journal : une
// observation déjà écrite reste écrite, à sa date, avec son auteur. Un sujet désactivé
// garde son socle — il a réellement été observé, et effacer cette trace serait exactement
// la réécriture d'histoire que ce projet refuse.
//
// Le plan est figé sous empreinte et relu avant d'être appliqué, pour la même raison que
// la sélection initiale : le catalogue bouge entre les deux, et recalculer au moment
// d'écrire ferait diverger l'ensemble relu et l'ensemble écrit sans que personne ne le voie.
import { readFileSync, writeFileSync } from 'node:fs'
import postgres from 'postgres'
import {
  COHORT_ID,
  CURRENT_COHORT_SPEC,
  BUSINESS_SYSTEM_FAMILIES,
  familyRegex,
  selectCohort,
  validateCohort,
  type CandidateSubject,
  type CohortPick,
  type CohortStratum,
  type TrackedSubject,
} from '../lib/evidence-cohort.ts'
import { canonicalJson, sha256Hex } from '../lib/evidence-history.ts'
import { emptyTally, operatorAtCap, operatorKeysOf, tallyOperator, topConcentration } from '../lib/evidence-operator.ts'
import { isProbeableEndpoint, type EndpointCheck } from '../lib/endpoint-probe.ts'

const argv = process.argv.slice(2)
const valueOf = (name: string) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}
const APPLY = argv.includes('--apply')
const PLAN_PATH = valueOf('--plan')
const MANIFEST_PATH = valueOf('--manifest')
const SCHEMA = 'https://agentreputation.dev/schemas/cohort-recomposition/v1'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

type ActiveRow = {
  agentId: string
  handle: string
  endpoint: string | null
  stratum: CohortStratum
  selectionRule: string
  selectionFamily: string | null
}

type Deactivation = { agent_id: string; handle: string; stratum: string; reason: string }

type RecompositionManifest = {
  schema: string
  cohort: string
  spec_version: number
  generated_at: string
  operator_cap: number
  active_before: number
  deactivations: Deactivation[]
  admissions: Array<{
    agent_id: string
    handle: string
    subject_kind: string
    stratum: string
    selection_rule: string
    selection_family: string | null
    selection_reason: string
  }>
  active_after: number
  concentration_before: unknown
  concentration_after: unknown
  content_hash: string
}

try {
  if (APPLY) {
    if (!MANIFEST_PATH) {
      console.error('--apply requires --manifest <file> produced by a previous --plan run')
      process.exit(1)
    }
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as RecompositionManifest
    const { content_hash: declared, ...body } = manifest
    if (manifest.schema !== SCHEMA || manifest.cohort !== COHORT_ID) {
      console.error('manifest is not a recomposition plan for this cohort')
      process.exit(1)
    }
    if (sha256Hex(canonicalJson(body)) !== declared) {
      console.error('manifest changed after it was planned; re-plan and review again')
      process.exit(1)
    }

    // Séquentiel : pooler en transaction, max:1. Les désactivations d'abord, pour que le
    // plafond soit libre au moment où les admissions arrivent.
    let deactivated = 0
    for (const entry of manifest.deactivations) {
      const result = await sql`
        update evidence_cohort
        set active = false, deactivated_at = now()
        where agent_id = ${entry.agent_id}::uuid and cohort = ${COHORT_ID} and active
      `
      deactivated += result.count
    }
    let admitted = 0
    for (const entry of manifest.admissions) {
      const result = await sql`
        insert into evidence_cohort (
          agent_id, subject_key, cohort, stratum, selection_rule, selection_family,
          selection_reason, subject_kind
        ) values (
          ${entry.agent_id}::uuid, ${entry.handle}, ${COHORT_ID}, ${entry.stratum}, ${entry.selection_rule},
          ${entry.selection_family}, ${entry.selection_reason}, ${entry.subject_kind}
        )
        on conflict (agent_id) do nothing
      `
      admitted += result.count
    }
    const [after] = await sql`
      select count(*)::int as active from evidence_cohort where active and cohort = ${COHORT_ID}
    `
    console.log(
      JSON.stringify(
        { mode: 'apply', cohort: COHORT_ID, manifest_hash: declared, deactivated, admitted, active_after: Number(after.active) },
        null,
        2,
      ),
    )
  } else {
    const manifest = await buildPlan()
    if (PLAN_PATH) {
      writeFileSync(PLAN_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      console.error(`plan written to ${PLAN_PATH} — review it, then apply with --apply --manifest`)
    }
    console.log(
      JSON.stringify(
        {
          mode: PLAN_PATH ? 'plan' : 'dry-run',
          cohort: COHORT_ID,
          spec_version: manifest.spec_version,
          operator_cap: manifest.operator_cap,
          active_before: manifest.active_before,
          deactivations: manifest.deactivations.length,
          admissions: manifest.admissions.length,
          active_after: manifest.active_after,
          concentration_before: manifest.concentration_before,
          concentration_after: manifest.concentration_after,
          manifest_hash: manifest.content_hash,
        },
        null,
        2,
      ),
    )
  }
} finally {
  await sql.end()
}

async function loadActive(): Promise<ActiveRow[]> {
  const rows = await sql`
    select c.agent_id, c.stratum, c.selection_rule, c.selection_family, a.handle, a.endpoint
    from evidence_cohort c join agents a on a.id = c.agent_id
    where c.active and c.cohort = ${COHORT_ID}
    order by a.handle
  `
  return rows.map((row) => ({
    agentId: String(row.agent_id),
    handle: String(row.handle),
    endpoint: (row.endpoint as string | null) ?? null,
    stratum: String(row.stratum) as CohortStratum,
    selectionRule: String(row.selection_rule),
    selectionFamily: (row.selection_family as string | null) ?? null,
  }))
}

function concentrationOf(rows: ReadonlyArray<{ handle: string; endpoint: string | null; stratum: string }>) {
  const overall = emptyTally()
  const availability = emptyTally()
  for (const row of rows) {
    const keys = operatorKeysOf(row)
    tallyOperator(overall, keys)
    if (row.stratum === 'availability_watch') tallyOperator(availability, keys)
  }
  const largest = (tally: ReturnType<typeof emptyTally>) =>
    Math.max(0, ...[...tally.domain.values()], ...[...tally.namespace.values()])
  const availabilityCount = rows.filter((row) => row.stratum === 'availability_watch').length
  return {
    subjects: rows.length,
    availability_subjects: availabilityCount,
    largest_operator_in_availability: largest(availability),
    largest_operator_share_of_availability:
      availabilityCount > 0 ? Math.round((largest(availability) / availabilityCount) * 1000) / 1000 : 0,
    availability: topConcentration(availability, 5),
    overall: topConcentration(overall, 5),
  }
}

async function buildPlan(): Promise<RecompositionManifest> {
  const cap = CURRENT_COHORT_SPEC.availabilityOperatorCap
  if (cap === undefined) {
    console.error('the current cohort spec declares no operator cap; nothing to recompose')
    process.exit(1)
  }
  const active = await loadActive()
  const before = concentrationOf(active)

  // Qui reste : les strates hors disponibilité en entier, et pour la disponibilité les
  // `cap` premiers de chaque opérateur par ordre alphabétique de handle. Déterministe, et
  // sans privilège : ni l'ancienneté ni la popularité n'entrent en jeu.
  const tally = emptyTally()
  const kept: ActiveRow[] = []
  const deactivations: Deactivation[] = []
  for (const row of active) {
    if (row.stratum !== 'availability_watch') {
      kept.push(row)
      continue
    }
    const keys = operatorKeysOf(row)
    if (operatorAtCap(tally, keys, cap)) {
      deactivations.push({
        agent_id: row.agentId,
        handle: row.handle,
        stratum: row.stratum,
        reason: `over the operator cap of ${cap} for ${keys.domain ?? '(no domain)'} / ${keys.namespace ?? '(no namespace)'}: a correlated outage at one operator is one event, not many independent signals. Its ledger observations are kept.`,
      })
      continue
    }
    tallyOperator(tally, keys)
    kept.push(row)
  }

  // Remplacements : la règle v3 appliquée à ce qui reste suivi, donc les plafonds de
  // strate et d'opérateur comptent déjà les sujets conservés.
  const tracked: TrackedSubject[] = kept.map((row) => ({
    agentId: row.agentId,
    handle: row.handle,
    endpoint: row.endpoint,
    stratum: row.stratum,
    selectionFamily: row.selectionFamily,
  }))
  const excluded = new Set([...active.map((row) => row.agentId)])
  const candidates = (await loadCandidates()).filter((candidate) => !excluded.has(candidate.agentId))
  const admissions = selectCohort(candidates, { spec: CURRENT_COHORT_SPEC, alreadyTracked: tracked })

  const afterRows = [
    ...kept.map((row) => ({ handle: row.handle, endpoint: row.endpoint, stratum: row.stratum })),
    ...admissions.map((pick) => ({
      handle: pick.handle,
      endpoint: candidates.find((c) => c.agentId === pick.agentId)?.endpoint ?? null,
      stratum: pick.stratum as string,
    })),
  ]
  const after = concentrationOf(afterRows)

  const problems = validateCohort(
    [
      ...kept.map((row) => ({
        agentId: row.agentId,
        handle: row.handle,
        subjectKind: 'agent' as const,
        stratum: row.stratum,
        selectionRule: row.selectionRule,
        selectionFamily: row.selectionFamily,
        selectionReason: 'Already tracked; its recorded reason lives in the database and is never rewritten.',
      })),
      ...admissions,
    ],
    { spec: CURRENT_COHORT_SPEC },
  )
  if (problems.length > 0) {
    console.error('the recomposed cohort would violate its own invariants:')
    for (const problem of problems) console.error(`  ${problem.code}: ${problem.detail}`)
    process.exit(1)
  }
  if (afterRows.length < CURRENT_COHORT_SPEC.minSubjects) {
    console.error(`the recomposed cohort would hold ${afterRows.length} subjects, below the minimum of ${CURRENT_COHORT_SPEC.minSubjects}`)
    process.exit(1)
  }

  const sorted = <T extends { handle: string }>(rows: T[]) =>
    [...rows].sort((a, b) => (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0))

  const body = {
    schema: SCHEMA,
    cohort: COHORT_ID,
    spec_version: CURRENT_COHORT_SPEC.version,
    generated_at: new Date().toISOString(),
    operator_cap: cap,
    active_before: active.length,
    deactivations: sorted(deactivations),
    admissions: sorted(admissions).map((pick: CohortPick) => ({
      agent_id: pick.agentId,
      handle: pick.handle,
      subject_kind: pick.subjectKind,
      stratum: pick.stratum,
      selection_rule: pick.selectionRule,
      selection_family: pick.selectionFamily,
      selection_reason: pick.selectionReason,
    })),
    active_after: afterRows.length,
    concentration_before: before,
    concentration_after: after,
  }
  return { ...body, content_hash: sha256Hex(canonicalJson(body)) }
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

/** Mêmes pré-filtres que la sélection initiale ; la règle reste seule juge. */
async function loadCandidates(): Promise<CandidateSubject[]> {
  const seen = new Map<string, CandidateSubject>()
  const add = (rows: readonly Row[]) => {
    for (const row of rows) {
      const candidate = toCandidate(row)
      if (!seen.has(candidate.agentId)) seen.set(candidate.agentId, candidate)
    }
  }
  for (const { keywords } of BUSINESS_SYSTEM_FAMILIES) {
    const pattern = familyRegex(keywords)
    add(await sql`
      select id, handle, display_name, description, external_source, external_id, endpoint,
             metadata->>'repo' as repository, (metadata ? 'github_stars') as has_repository_observation,
             metadata->'endpoint_check' as endpoint_check
      from agents
      where external_source = 'mcp-registry' and (endpoint ilike 'http%' or metadata ? 'repo')
        and (lower(regexp_replace(handle, '^.*/', '')) ~ ${pattern} or lower(coalesce(display_name, '')) ~ ${pattern})
      order by handle asc limit 60
    `)
  }
  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo' as repository, (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check' as endpoint_check
    from agents
    where external_source = 'mcp-registry' and metadata ? 'repo' and metadata ? 'github_stars' and endpoint ilike 'http%'
    order by handle asc limit 200
  `)
  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo' as repository, (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check' as endpoint_check
    from agents
    where endpoint ilike 'http%' and metadata->'endpoint_check'->>'responded' = 'false'
    order by handle asc limit 600
  `)
  add(await sql`
    select id, handle, display_name, description, external_source, external_id, endpoint,
           metadata->>'repo' as repository, (metadata ? 'github_stars') as has_repository_observation,
           metadata->'endpoint_check' as endpoint_check
    from agents
    where external_source is distinct from 'mcp-registry' and (endpoint ilike 'http%' or metadata ? 'repo')
    order by handle asc limit 200
  `)
  return [...seen.values()].filter((candidate) => isProbeableEndpoint(candidate.endpoint) || candidate.repository !== null)
}
