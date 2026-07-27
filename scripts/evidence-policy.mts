// Évalue une chronologie contre une politique d'activation fournie — sortie sur stdout.
//
// Usage :
//   node --experimental-strip-types scripts/evidence-policy.mts --demo
//   node --experimental-strip-types scripts/evidence-policy.mts --demo --scenario strict/reading-too-old
//   node --experimental-strip-types scripts/evidence-policy.mts <handle> --policy <fichier.json>
//   node --experimental-strip-types scripts/evidence-policy.mts <handle> --example strict
//
// `--demo` ne touche aucune base : il rejoue les scénarios SYNTHÉTIQUES et sert à montrer
// la forme du résultat sans inventer d'historique réel. Toute autre invocation lit la base
// en LECTURE SEULE (DATABASE_URL requis) et n'écrit jamais rien.
//
// Le résultat est un appui à la décision relatif aux critères fournis. Ce n'est ni une
// note, ni un classement, ni une certification, et il ne se publie pas : l'adéquation à
// une politique est une surface payante, pas une page publique.
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { loadSubjectObservations, provenanceSource } from '../lib/evidence-store.ts'
import { COHORT_ID } from '../lib/evidence-cohort.ts'
import {
  currentStateFreshness,
  evaluatePolicy,
  parsePolicyDocument,
  type ActivationPolicy,
} from '../lib/evidence-policy.ts'
import {
  DEMO_CUTOFF,
  EXAMPLE_POLICIES,
  PRAGMATIC_ACTIVATION_POLICY,
  STRICT_ACTIVATION_POLICY,
  syntheticScenarios,
} from '../lib/evidence-policy-examples.ts'
import type { SubjectKind } from '../lib/evidence-history.ts'
import type { TimelineSubject } from '../lib/evidence-timeline.ts'

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}
const DEMO = argv.includes('--demo')
const SCENARIO = flag('--scenario')
const POLICY_FILE = flag('--policy')
const EXAMPLE = flag('--example')
const CUTOFF = flag('--cutoff')

console.error('NOT FOR PUBLICATION: policy fit is an internal/paid surface, never a public page.')

if (DEMO) {
  const scenarios = syntheticScenarios().filter((scenario) => !SCENARIO || scenario.name === SCENARIO)
  if (scenarios.length === 0) {
    console.error(`unknown scenario "${SCENARIO}". Available: ${syntheticScenarios().map((s) => s.name).join(', ')}`)
    process.exit(1)
  }
  const byId = new Map(EXAMPLE_POLICIES.map((policy) => [policy.id, policy]))
  const results = scenarios.map((scenario) => ({
    scenario: scenario.name,
    synthetic: true,
    question: scenario.question,
    expected: scenario.expected,
    evaluation: evaluatePolicy({ dossier: scenario.dossier, policy: byId.get(scenario.policyId)!, cutoff: CUTOFF ?? DEMO_CUTOFF }),
  }))
  console.log(
    JSON.stringify(
      { mode: 'demo', synthetic: true, note: 'Invented subjects and dates. No real supplier is described here.', results },
      null,
      2,
    ),
  )
  process.exit(0)
}

const handle = argv.find((value, index) => !value.startsWith('--') && !argv[index - 1]?.startsWith('--'))
if (!handle) {
  console.error('usage: evidence-policy.mts <handle> (--policy <file.json> | --example strict|pragmatic) [--cutoff <iso>]')
  process.exit(1)
}

// La politique est validée AVANT toute lecture de base : un document mal formé ne doit
// même pas coûter une connexion, et surtout jamais franchir la validation par un cast.
const policy = loadPolicy()

// Présence seulement : la valeur n'est ni lue, ni journalisée, ni affichée.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in this environment')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

try {
  // Séquentiel, lecture seule : une connexion, pooler en transaction.
  const [row] = await sql`
    select a.id, a.handle, a.display_name, a.external_source,
           a.metadata->'endpoint_check'->>'checked_at' as endpoint_checked_at,
           -- Pas de a.updated_at : ce n'est pas une date de contrôle par source, et la
           -- laisser à portée de main invite à la recâbler. Voir currentStateFreshness.
           c.stratum, c.selection_rule, c.selection_reason, c.subject_kind
    from agents a
    left join evidence_cohort c on c.agent_id = a.id and c.active and c.cohort = ${COHORT_ID}
    where a.handle = ${handle}
  `
  if (!row) {
    console.error(`no subject with handle "${handle}"`)
    process.exit(1)
  }

  const observations = await loadSubjectObservations(sql, String(row.id))
  if (observations === null) {
    console.error('evidence tables missing: apply db/migration-evidence-history.sql first')
    process.exit(1)
  }

  const externalSource = (row.external_source as string | null) ?? null
  const subject: TimelineSubject = {
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

  // « Quand a-t-on regardé » ne vient JAMAIS du journal — il n'enregistre que les
  // changements. Et surtout, pas de agents.updated_at : un trigger générique rafraîchit
  // cette colonne à la moindre écriture sur la ligne, sonde comprise, donc elle
  // certifierait une relecture du registre qui n'a jamais eu lieu. La fraîcheur registre
  // reste inconnue tant qu'un collecteur n'écrit pas sa propre trace de contrôle.
  const lastCheckedAt = currentStateFreshness({
    endpointCheckedAt: (row.endpoint_checked_at as string | null) ?? null,
  })

  const cutoff = CUTOFF ?? new Date().toISOString()
  const evaluation = evaluatePolicy({ dossier: { subject, observations, lastCheckedAt }, policy, cutoff })
  console.log(JSON.stringify({ mode: 'subject', synthetic: false, evaluation }, null, 2))
} finally {
  await sql.end()
}

function loadPolicy(): ActivationPolicy {
  if (EXAMPLE) {
    if (EXAMPLE === 'strict') return STRICT_ACTIVATION_POLICY
    if (EXAMPLE === 'pragmatic') return PRAGMATIC_ACTIVATION_POLICY
    console.error(`unknown example policy "${EXAMPLE}" (strict | pragmatic)`)
    process.exit(1)
  }
  if (!POLICY_FILE) {
    console.error('supply a policy with --policy <file.json> or --example strict|pragmatic')
    process.exit(1)
  }
  let document: unknown
  try {
    document = JSON.parse(readFileSync(POLICY_FILE, 'utf8')) as unknown
  } catch (error) {
    console.error(`cannot read policy file: ${error instanceof Error ? error.message : 'unreadable'}`)
    process.exit(1)
  }
  // Fail-closed : rien n'est supposé, tout est reconnu. Un `requirement: "Required"` mal
  // capitalisé ne doit pas disparaître silencieusement de l'ensemble décisionnel et
  // ressortir en « critères satisfaits ».
  const parsed = parsePolicyDocument(document)
  if (!parsed.ok) {
    for (const problem of parsed.problems) console.error(`policy problem — ${problem.code}: ${problem.detail}`)
    process.exit(1)
  }
  return parsed.policy
}
