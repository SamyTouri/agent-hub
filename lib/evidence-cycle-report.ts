// Le rapport de contrôle d'un cycle de collecte — logique pure, testable sans base.
//
// Tout ce qui décide d'un verdict vit ici ; la commande ne fait que les requêtes. La
// raison est simple : un rapport de contrôle qui se trompe est pire qu'aucun rapport,
// parce qu'il donne la tranquillité sans la preuve. La règle qui gouverne le fichier
// entier est qu'une ligne écrite ne prouve que ce qu'elle prouve — et qu'aucune requête
// SQL ne prouvera jamais qu'une fonction Vercel a été invoquée.

export const CYCLE_CHECK_SCHEMA = 'https://agentreputation.dev/schemas/evidence-cycle-check/v1'

/** Collecteurs qui n'appartiennent qu'à l'import de registre. Une ligne du journal signée
 *  par l'un d'eux est une preuve directe que ce job a tourné et écrit. */
export const IMPORT_COLLECTORS: readonly string[] = ['cron:registry', 'cron:registry/concordium']

/** Sources dont un collecteur existe réellement dans ce dépôt. Toute autre valeur dans le
 *  journal est une anomalie d'attribution, pas une source. */
export const KNOWN_SOURCES: readonly string[] = [
  'mcp-registry',
  'concordium-cis8004',
  'moltbook',
  'native',
  'endpoint-probe',
  'github-repository',
]

/**
 * La SEULE chaîne à deux auteurs que la conception prévoit.
 *
 * Pour un profil, l'auteur unique est la règle : deux collecteurs sur la même chaîne
 * signifient deux lectures concurrentes du même sujet, et l'une d'elles fabrique des
 * changements. Pour la disponibilité, non : le socle enregistre la DERNIÈRE mesure de la
 * sonde, pas une vue concurrente d'elle, et le cron quotidien reprend la chaîne à partir
 * de là. Les deux lignes sortent de la même sonde à travers le même réducteur.
 *
 * L'exception est donc étroite et nommée. Elle ne s'applique qu'à `endpoint-probe`, et
 * qu'à cette paire exacte : un troisième collecteur, ou l'un de ces deux sur une chaîne
 * de profil, reste une anomalie.
 */
export const AVAILABILITY_BASELINE_COLLECTOR = 'script:evidence-cohort'
export const AVAILABILITY_TRANSITION_COLLECTOR = 'cron:daily'
export const EXPECTED_HANDOFF_SOURCE = 'endpoint-probe'

/** Vrai uniquement pour la relève socle → cron sur une chaîne de disponibilité. */
export function isExpectedAvailabilityHandoff(row: { source: string; collectors: string }): boolean {
  if (row.source !== EXPECTED_HANDOFF_SOURCE) return false
  // Comparé comme un ensemble : ni l'ordre ni le formatage de l'agrégat SQL ne doivent
  // pouvoir faire passer une anomalie pour la relève attendue, ni l'inverse.
  const seen = new Set(
    row.collectors
      .split(',')
      .map((collector) => collector.trim())
      .filter(Boolean),
  )
  return seen.size === 2 && seen.has(AVAILABILITY_BASELINE_COLLECTOR) && seen.has(AVAILABILITY_TRANSITION_COLLECTOR)
}

export type Verdict = 'passed' | 'failed' | 'inconclusive'

export type Check = {
  id: string
  question: string
  verdict: Verdict
  finding: string
  evidence: Record<string, unknown>
  /** Ce que ce contrôle ne peut pas établir, dit à voix haute. */
  cannot_prove?: string
}

export type CycleWindow = { since: string; until: string; sinceMs: number; untilMs: number }

/**
 * Fenêtre canonique, résolue une seule fois.
 *
 * Les deux bornes sont normalisées en ISO-8601 UTC puis comparées en millisecondes : une
 * fenêtre inversée ou une borne illisible doit être refusée ici, pas produire un rapport
 * vide qu'on lirait comme « rien ne s'est passé ».
 */
export function resolveWindow(input: {
  since?: string
  until?: string
  now: string
}): { ok: true; window: CycleWindow } | { ok: false; error: string } {
  const nowMs = Date.parse(input.now)
  if (!Number.isFinite(nowMs)) return { ok: false, error: `unusable current time: ${input.now}` }

  const untilMs = input.until === undefined ? nowMs : Date.parse(input.until)
  if (!Number.isFinite(untilMs)) return { ok: false, error: `--until is not a usable timestamp: ${input.until}` }

  const sinceMs = input.since === undefined ? untilMs - 24 * 3600 * 1000 : Date.parse(input.since)
  if (!Number.isFinite(sinceMs)) return { ok: false, error: `--since is not a usable timestamp: ${input.since}` }

  if (sinceMs >= untilMs) {
    return { ok: false, error: `--since must be strictly before --until (${new Date(sinceMs).toISOString()} >= ${new Date(untilMs).toISOString()})` }
  }
  return {
    ok: true,
    window: {
      since: new Date(sinceMs).toISOString(),
      until: new Date(untilMs).toISOString(),
      sinceMs,
      untilMs,
    },
  }
}

export type SourceCollectorRows = { source: string; collector: string; rows: number; lastObservedAt?: string | null }

export type CohortRow = { handle: string; stratum: string; probeable: boolean; checkedAt: string | null }

export type CycleFacts = {
  window: CycleWindow
  cohortId: string
  ledger: { rows: number; subjects: number; firstObservedAt: string | null; lastObservedAt: string | null }
  bySourceCollector: readonly SourceCollectorRows[]
  windowBySourceCollector: readonly SourceCollectorRows[]
  windowTotals: { rows: number; baselines: number; transitions: number }
  probe: { freshChecks: number; newestCheck: string | null; malformedCheckDates: number }
  /** Contexte SEULEMENT : des scripts d'inscription, de claim ou de maintenance écrivent
   *  aussi cette colonne. Ne peut jamais valoir preuve d'exécution d'un import. */
  rowsTouchedWithoutFreshCheck: number
  cohort: readonly CohortRow[]
  integrity: {
    danglingParents: number
    forks: number
    duplicateBaselines: number
    crossChainParents: number
    identicalConsecutive: number
    backdated: number
  }
  /** Groupé sur la clé de chaîne réelle (sujet, source), jamais sur le handle. Brut : la
   *  classification entre relève attendue et anomalie se fait ici, en un seul endroit. */
  multiCollectorChains: ReadonlyArray<{ subjectAgentId: string; source: string; collectors: string }>
  /** La requête a atteint sa limite : la liste ci-dessus est un échantillon. Une anomalie
   *  peut alors se cacher hors échantillon, et le contrôle ne doit pas conclure. */
  multiCollectorTruncated: boolean
  unknownSources: ReadonlyArray<{ source: string; rows: number }>
  /** Réponses de cron capturées par l opérateur, avec leur provenance. Facultatif : la
   *  base ne les contient pas. */
  capturedCronResponses?: readonly CapturedCronResponse[]
  storage: Record<string, unknown>
}

export type CycleReport = Record<string, unknown>

/** Version du modèle de coût. Bougée dès qu'une unité change de définition, pour que deux
 *  mesures ne soient jamais comparées à travers deux définitions différentes. */
export const CYCLE_COST_MODEL_VERSION = 1

/**
 * Ce qu'un opérateur a le droit de capturer de la réponse d'un cron, quand il l'a. Ces
 * durées ne sont PAS dans la base : la route les renvoie, et personne ne les stocke. Elles
 * n'entrent donc dans le rapport qu'accompagnées de leur provenance.
 */
export type CapturedCronResponse = {
  route: string
  captured_at: string
  elapsed_ms?: number
  probe_elapsed_ms?: number
  probed?: number
  deferred_to_next_run?: number
}

/**
 * Le coût d'un cycle, en trois piles séparées.
 *
 * La séparation est le produit. Un chiffre de coût qui mélange ce qu'on a mesuré, ce
 * qu'on a calculé et ce qu'on ne sait pas se lit comme une facture alors que c'est une
 * estimation — et c'est exactement le reproche que ce projet adresse au reste du marché.
 *
 * Ce que la base peut dire : des volumes. Ce qu'elle ne peut pas dire : une durée
 * d'exécution, un nombre d'invocations, et donc une somme d'argent. Le plan ne rend pas
 * les logs détaillés accessibles, donc la pile « indisponible » n'est pas un aveu de
 * paresse : c'est la raison pour laquelle aucune conclusion monétaire ne figure ici.
 */
export type CycleCost = {
  model_version: number
  window: { since: string; until: string; hours: number }
  observed: Record<string, unknown>
  derived: Record<string, unknown>
  unavailable: string[]
  captured_cron_responses: CapturedCronResponse[]
}

function buildCycleCost(facts: CycleFacts, probeable: number, freshlyChecked: number): CycleCost {
  const { window } = facts
  const hours = Math.round(((window.untilMs - window.sinceMs) / 3_600_000) * 100) / 100
  const ledgerWrites = facts.windowTotals.rows
  const captured = facts.capturedCronResponses ?? []

  return {
    model_version: CYCLE_COST_MODEL_VERSION,
    window: { since: window.since, until: window.until, hours },
    observed: {
      cohort_subjects: facts.cohort.length,
      cohort_subjects_probeable: probeable,
      cohort_subjects_freshly_checked: freshlyChecked,
      catalogue_rows_with_a_fresh_check: facts.probe.freshChecks,
      ledger_rows_written: ledgerWrites,
      ledger_baselines_written: facts.windowTotals.baselines,
      ledger_transitions_written: facts.windowTotals.transitions,
      ledger_rows_total: facts.ledger.rows,
      storage: facts.storage,
    },
    derived: {
      // Une sonde coûte un essai, plus un second UNIQUEMENT si le premier n'a rien
      // obtenu. Le nombre exact d'essais n'est pas enregistré, donc on donne l'encadrement
      // plutôt qu'un nombre qui aurait l'air mesuré.
      outbound_probe_requests_min: facts.probe.freshChecks,
      outbound_probe_requests_max: facts.probe.freshChecks * 2,
      outbound_probe_requests_note:
        'One attempt per host, plus a patient second attempt only when the first got nothing. The per-host attempt count is not recorded, so this is a bound, not a measurement.',
      ledger_write_rate:
        freshlyChecked > 0
          ? Math.round((ledgerWrites / freshlyChecked) * 10_000) / 10_000
          : null,
      ledger_write_rate_note:
        'Ledger rows written per cohort subject checked in this window. Zero is the expected steady state: the ledger only writes on change.',
    },
    unavailable: [
      'Function invocation count and execution duration: no query proves a Vercel invocation, and detailed runtime logs are not available under the current plan.',
      'Any monetary or platform-billing figure: it would require the invocation and duration facts above.',
      'Per-host probe attempt counts: the probe records the resulting state, not how many tries it took.',
      'IndexNow batches actually submitted: the count lives in the cron response, not in the database.',
      captured.length === 0
        ? 'Stage timings: the daily route returns elapsed_ms and probe elapsed_ms, but nothing stores them. Capture the cron response to include them.'
        : `Stage timings are present only for the ${captured.length} captured response(s) listed below, with their provenance.`,
    ],
    captured_cron_responses: [...captured],
  }
}

const freshIn = (value: string | null, window: CycleWindow) => {
  if (value === null) return false
  const ms = Date.parse(value)
  // Une date illisible n'est pas une date fraîche : on ne compte jamais un enregistrement
  // qu'on ne sait pas lire comme une preuve qu'on a regardé.
  return Number.isFinite(ms) && ms >= window.sinceMs && ms <= window.untilMs
}

export function buildCycleReport(facts: CycleFacts, generatedAt: string): CycleReport {
  const { window } = facts
  const checks: Check[] = []

  // -------------------------------------------------------------------------
  // 1. Trace d'exécution des imports — attribution directe, pas d'heuristique
  // -------------------------------------------------------------------------
  const importRows = facts.windowBySourceCollector.filter((row) => IMPORT_COLLECTORS.includes(row.collector))
  const importWritten = importRows.reduce((total, row) => total + row.rows, 0)
  checks.push({
    id: 'registry-and-concordium-ran',
    question: 'Did the registry / Concordium import leave evidence in the ledger that it ran in this window?',
    // Seule une ligne signée par un collecteur d'import prouve qu'il a tourné. La colonne
    // updated_at ne le prouve PAS : l'inscription, le claim et les scripts de maintenance
    // écrivent la même colonne, donc elle ne peut jamais valoir « passed ».
    verdict: importWritten > 0 ? 'passed' : 'inconclusive',
    finding:
      importWritten > 0
        ? `${importWritten} observation(s) in the window are signed by an import collector (${importRows.map((row) => row.collector).join(', ')}).`
        : 'No observation in the window is signed by an import collector. That is the normal outcome of an empty upstream delta, so the database cannot tell it from a job that never ran.',
    evidence: {
      observations_by_import_collector: importRows.map((row) => ({ collector: row.collector, source: row.source, rows: row.rows })),
      import_collectors_watched: IMPORT_COLLECTORS,
      catalogue_rows_touched_without_a_fresh_check: facts.rowsTouchedWithoutFreshCheck,
      catalogue_rows_touched_note:
        'Context only, never proof: registration, claim and maintenance scripts write agents.updated_at too, so this number cannot attribute a write to an import.',
    },
    cannot_prove:
      importWritten > 0
        ? 'Which of the two import collectors ran, if only one of them wrote. Check the Vercel logs for /api/cron/registry.'
        : 'Whether /api/cron/registry was invoked at all. Only the Vercel cron logs separate "ran with nothing to do" from "did not run".',
  })

  // -------------------------------------------------------------------------
  // 2. Trace d'exécution de la sonde
  // -------------------------------------------------------------------------
  checks.push({
    id: 'endpoint-probe-ran',
    question: 'Did an endpoint probe leave evidence that it ran in this window?',
    // La sonde écrit l'état courant à chaque passage, changement ou pas. Aucune trace du
    // tout est donc un vrai constat, pas un silence ambigu.
    verdict: facts.probe.freshChecks > 0 ? 'passed' : 'failed',
    finding:
      facts.probe.freshChecks > 0
        ? `${facts.probe.freshChecks} catalogue row(s) carry a check dated inside the window; the newest is ${facts.probe.newestCheck}.`
        : 'No catalogue row carries a check dated inside the window. A probe writes on every pass, so its step left no trace at all.',
    evidence: {
      rows_with_fresh_check: facts.probe.freshChecks,
      newest_check: facts.probe.newestCheck,
      unreadable_check_dates: facts.probe.malformedCheckDates,
    },
    cannot_prove:
      facts.probe.freshChecks > 0
        ? 'That the write came from the Vercel cron rather than from the local catch-up script, which writes the same field. Only the Vercel logs attribute it.'
        : 'Whether /api/cron/daily was never invoked, or was invoked and failed before writing. Only the Vercel logs separate those.',
  })

  // -------------------------------------------------------------------------
  // 3. Sujets suivis réellement examinés
  // -------------------------------------------------------------------------
  const probeable = facts.cohort.filter((member) => member.probeable)
  const fresh = probeable.filter((member) => freshIn(member.checkedAt, window))
  const stale = probeable.filter((member) => !freshIn(member.checkedAt, window))
  checks.push({
    id: 'cohort-examined',
    question: 'How many tracked subjects were actually examined in this window?',
    verdict:
      probeable.length === 0 ? 'inconclusive' : fresh.length === probeable.length ? 'passed' : fresh.length === 0 ? 'failed' : 'inconclusive',
    finding: `${fresh.length} of ${probeable.length} cohort subject(s) with a public endpoint carry a check inside the window (cohort size ${facts.cohort.length}).`,
    evidence: {
      cohort_size: facts.cohort.length,
      with_public_endpoint: probeable.length,
      freshly_checked: fresh.length,
      // Nommés, parce que « certains ont été manqués » n'est actionnable qu'avec la liste.
      not_freshly_checked: stale.map((member) => member.handle),
    },
    cannot_prove:
      'Subjects without a public endpoint are not probed at all; their profile history depends on the import, not on this window.',
  })

  // -------------------------------------------------------------------------
  // 4. Déduplication et transitions
  // -------------------------------------------------------------------------
  const availabilityWritten = facts.windowBySourceCollector
    .filter((row) => row.source === 'endpoint-probe')
    .reduce((total, row) => total + row.rows, 0)
  checks.push({
    id: 'deduplication-and-transitions',
    question: 'Were identical states deduplicated while genuine transitions were kept?',
    verdict: facts.integrity.identicalConsecutive === 0 ? 'passed' : 'failed',
    // Aucun chiffre de « doublons supprimés » : la fenêtre peut couvrir plusieurs cycles,
    // et la base n'enregistre pas les contrôles qui n'ont produit aucune ligne. Inventer
    // ce compteur serait exactement le genre de chiffre confortable et faux que ce projet
    // reproche aux autres.
    finding:
      facts.integrity.identicalConsecutive === 0
        ? `No chain contains two consecutive identical states. ${availabilityWritten} availability observation(s) and ${facts.windowTotals.transitions} transition(s) in total were written in the window.`
        : `${facts.integrity.identicalConsecutive} chain(s) contain two consecutive identical states, which the deduplication rule should have refused.`,
    evidence: {
      identical_consecutive_pairs: facts.integrity.identicalConsecutive,
      observations_written_in_window: facts.windowTotals.rows,
      baselines_in_window: facts.windowTotals.baselines,
      transitions_in_window: facts.windowTotals.transitions,
      availability_observations_in_window: availabilityWritten,
      suppressed_identical_states:
        'not counted: the window can span several cycles and a check that produced no row leaves no trace to count.',
    },
    cannot_prove:
      'Zero new observations is a normal successful cycle. This check says nothing about whether a job ran; see the execution checks above.',
  })

  // -------------------------------------------------------------------------
  // 5. Intégrité et attribution
  // -------------------------------------------------------------------------
  // La relève socle → cron sur une chaîne de disponibilité est prévue par la conception.
  // Tout le reste — un troisième collecteur, ou deux auteurs sur une chaîne de profil —
  // reste une anomalie. L'exception est nommée dans la sortie, pas appliquée en silence.
  const handoffs = facts.multiCollectorChains.filter(isExpectedAvailabilityHandoff)
  const attributionAnomalies = facts.multiCollectorChains.filter((row) => !isExpectedAvailabilityHandoff(row))
  const defects = {
    dangling_parents: facts.integrity.danglingParents,
    forks: facts.integrity.forks,
    duplicate_baselines: facts.integrity.duplicateBaselines,
    cross_chain_parents: facts.integrity.crossChainParents,
    identical_consecutive: facts.integrity.identicalConsecutive,
    backdated: facts.integrity.backdated,
    multi_collector_anomalies: attributionAnomalies.length,
    unknown_sources: facts.unknownSources.length,
  }
  const defectTotal = Object.values(defects).reduce((total, value) => total + value, 0)
  const named = Object.entries(defects)
    .filter(([, value]) => value > 0)
    .map(([key]) => key)
  // Une liste tronquée ne peut pas fonder un « aucune anomalie » : l'anomalie peut être
  // hors échantillon. On le dit plutôt que de conclure.
  const truncatedBlindSpot = facts.multiCollectorTruncated && defectTotal === 0
  checks.push({
    id: 'ledger-integrity',
    question: 'Are there broken chains, forks, duplicate successors or attribution anomalies?',
    verdict: defectTotal > 0 ? 'failed' : truncatedBlindSpot ? 'inconclusive' : 'passed',
    finding:
      defectTotal > 0
        ? `${defectTotal} integrity finding(s) across ${named.join(', ')}.`
        : truncatedBlindSpot
          ? 'No integrity finding in the rows examined, but the multi-collector list hit its limit, so an anomaly could sit outside the sample.'
          : `No broken chain, fork, duplicate baseline, cross-chain parent, backdated row, unexpected multi-author chain or unknown source.${
              handoffs.length > 0
                ? ` ${handoffs.length} availability chain(s) carry the designed baseline-to-cron handoff, which is not an anomaly.`
                : ''
            }`,
    evidence: {
      ...defects,
      multi_collector_anomaly_examples: attributionAnomalies.map((row) => ({
        subject_agent_id: row.subjectAgentId,
        source: row.source,
        collectors: row.collectors,
      })),
      // Preuve brute conservée : la relève attendue est montrée, pas effacée.
      expected_availability_handoffs: handoffs.length,
      expected_availability_handoff_examples: handoffs.map((row) => ({
        subject_agent_id: row.subjectAgentId,
        source: row.source,
        collectors: row.collectors,
      })),
      expected_handoff_rule: `on ${EXPECTED_HANDOFF_SOURCE} only, and only the exact pair ${AVAILABILITY_BASELINE_COLLECTOR} + ${AVAILABILITY_TRANSITION_COLLECTOR}: the baseline records the probe's own last measurement and the cron continues that chain through the same reducer. Any third collector, or either of these on a profile chain, is still an anomaly.`,
      multi_collector_sample_truncated: facts.multiCollectorTruncated,
      unknown_source_rows: facts.unknownSources.map((row) => ({ source: row.source, rows: row.rows })),
    },
    ...(truncatedBlindSpot
      ? { cannot_prove: 'That no attribution anomaly exists: the multi-collector query returned a truncated sample.' }
      : {}),
  })

  // -------------------------------------------------------------------------
  // 6. Inventaire
  // -------------------------------------------------------------------------
  checks.push({
    id: 'inventory',
    question: 'What rows, sources, collectors and storage are involved?',
    verdict: 'passed',
    finding: `${facts.ledger.rows} observation(s) over ${facts.ledger.subjects} subject(s), from ${facts.bySourceCollector.length} source/collector pair(s).`,
    evidence: {
      observations: facts.ledger.rows,
      subjects: facts.ledger.subjects,
      first_observed_at: facts.ledger.firstObservedAt,
      last_observed_at: facts.ledger.lastObservedAt,
      by_source_and_collector: facts.bySourceCollector.map((row) => ({
        source: row.source,
        collector: row.collector,
        rows: row.rows,
        last_observed_at: row.lastObservedAt ?? null,
      })),
      in_window_by_source_and_collector: facts.windowBySourceCollector.map((row) => ({
        source: row.source,
        collector: row.collector,
        rows: row.rows,
      })),
      storage: facts.storage,
    },
  })

  const failed = checks.filter((check) => check.verdict === 'failed')
  const inconclusive = checks.filter((check) => check.verdict === 'inconclusive')
  const overall: Verdict = failed.length > 0 ? 'failed' : inconclusive.length > 0 ? 'inconclusive' : 'passed'

  return {
    schema: CYCLE_CHECK_SCHEMA,
    generated_at: generatedAt,
    window: { since: window.since, until: window.until },
    cohort: facts.cohortId,
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
    cost: buildCycleCost(facts, probeable.length, fresh.length),
  }
}
