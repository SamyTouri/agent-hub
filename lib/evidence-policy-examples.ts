// SYNTHETIC examples — two fictitious buyer policies and a set of invented histories.
//
// Nothing here describes a real supplier. Every subject, endpoint, hash and date is made
// up, and the module marks itself so at runtime through `SYNTHETIC`. The pilot cohort has
// forty real subjects and, at the time of writing, no real change history at all: inventing
// one to make a demo look good would be the exact dishonesty this product sells against.
//
// These scenarios exist to pin the evaluator's behaviour — one per decision, plus the
// three cases that are easy to get wrong: contradictory sources, evidence older than the
// question, and a mandatory proof that was never observed.

import type { EvidenceFacts, FactChange } from './evidence-history.ts'
import { EVIDENCE_SCHEMA_VERSION, availabilityFacts, contentHash, profileFacts } from './evidence-history.ts'
import type { StoredObservation, TimelineSubject } from './evidence-timeline.ts'
import type { ActivationPolicy, EvidenceDossier, PolicyDecision } from './evidence-policy.ts'

/** Read by the CLI so a demo run can never be mistaken for a real dossier. */
export const SYNTHETIC = true

export const DEMO_CUTOFF = '2026-07-27T00:00:00.000Z'

const day = (n: number) => new Date(Date.parse('2026-01-01T00:00:00.000Z') + n * 86_400_000).toISOString()

const SUBJECT: TimelineSubject = {
  handle: 'io.github.synthetic/workspace-connector',
  displayName: 'Synthetic Workspace Connector',
  subjectKind: 'mcp_server',
  provenance: 'mcp-registry',
  cohort: null,
}

let sequence = 0

function observation(input: {
  source: string
  facts: EvidenceFacts
  observedAt: string
  previousObservationId?: string | null
  changeSummary?: FactChange[]
}): StoredObservation {
  sequence += 1
  return {
    id: `synthetic-${String(sequence).padStart(4, '0')}`,
    seq: sequence,
    subjectKind: 'mcp_server',
    subjectKey: SUBJECT.handle,
    source: input.source as StoredObservation['source'],
    sourceUrl: null,
    observedAt: input.observedAt,
    effectiveAt: null,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    contentHash: contentHash({ source: input.source, facts: input.facts }),
    facts: input.facts,
    previousObservationId: input.previousObservationId ?? null,
    changeSummary: input.changeSummary ?? [],
    visibility: 'public_summary',
    collector: 'synthetic',
  }
}

/** A chain that has been watched for six months and never moved. */
function stableRegistryChain(): StoredObservation[] {
  return [
    observation({
      source: 'mcp-registry',
      observedAt: day(0),
      facts: profileFacts({
        displayName: 'Synthetic Workspace Connector',
        endpoint: 'https://synthetic.test/mcp',
        protocols: ['mcp'],
        repository: 'https://github.com/synthetic/workspace-connector',
        status: 'active',
      }),
    }),
  ]
}

function respondingProbeChain(): StoredObservation[] {
  return [
    observation({
      source: 'endpoint-probe',
      observedAt: day(0),
      facts: availabilityFacts({ checked_at: day(0), responded: true, status: 200, consecutive_failures: 0 }),
    }),
  ]
}

export type SyntheticScenario = {
  name: string
  synthetic: true
  /** What the scenario is there to prove. */
  question: string
  expected: PolicyDecision
  policyId: string
  dossier: EvidenceDossier
}

// ---------------------------------------------------------------------------
// Two fictitious buyer policies
// ---------------------------------------------------------------------------

/**
 * A cautious gateway: it will not activate a connector it cannot attribute, cannot reach,
 * or has not been able to watch for a quarter.
 */
export const STRICT_ACTIVATION_POLICY: ActivationPolicy = {
  id: 'synthetic.strict-workspace-activation',
  version: '1.0.0',
  vocabularyVersion: 1,
  title: 'Synthetic strict workspace activation policy',
  intent: 'Fictitious buyer: only activate a workspace connector whose identity, reachability and stability are evidenced.',
  criteria: [
    {
      id: 'registry-provenance',
      kind: 'source_present',
      source: 'mcp-registry',
      requirement: 'required',
      description: 'The connector must be attributable to a public registry entry.',
    },
    {
      id: 'source-repository',
      kind: 'field_present',
      source: 'mcp-registry',
      field: 'repository',
      requirement: 'required',
      description: 'A source repository must be declared, so the code can be reviewed.',
    },
    {
      id: 'endpoint-answering',
      kind: 'field_in',
      source: 'endpoint-probe',
      field: 'state',
      allowed: ['responding'],
      requirement: 'required',
      description: 'The host must have answered our last check.',
    },
    {
      id: 'endpoint-stable-90d',
      kind: 'no_change_since',
      source: 'mcp-registry',
      field: 'endpoint',
      days: 90,
      requirement: 'required',
      description: 'The advertised endpoint must not have moved in the last quarter.',
    },
    {
      id: 'registry-checked-7d',
      kind: 'checked_since',
      source: 'mcp-registry',
      days: 7,
      requirement: 'conditional',
      safeguard: 'Re-check the registry entry manually before granting scopes, and record the check.',
      description: 'Our registry reading must be recent, or the operator revalidates it by hand.',
    },
  ],
}

/**
 * A pragmatic gateway: same evidence, softer posture. It will activate under safeguards
 * where the strict policy refuses, which is exactly why a universal score is the wrong
 * shape for this product.
 */
export const PRAGMATIC_ACTIVATION_POLICY: ActivationPolicy = {
  id: 'synthetic.pragmatic-workspace-activation',
  version: '1.0.0',
  vocabularyVersion: 1,
  title: 'Synthetic pragmatic workspace activation policy',
  intent: 'Fictitious buyer: activate under human safeguards rather than block, except on attribution.',
  criteria: [
    {
      id: 'registry-provenance',
      kind: 'source_present',
      source: 'mcp-registry',
      requirement: 'required',
      description: 'Attribution is the one thing this buyer will not compromise on.',
    },
    {
      id: 'endpoint-answering',
      kind: 'field_in',
      source: 'endpoint-probe',
      field: 'state',
      allowed: ['responding', 'flaky'],
      requirement: 'conditional',
      safeguard: 'Activate read-only scopes first and re-evaluate after seven days of probes.',
    },
    {
      id: 'endpoint-stable-90d',
      kind: 'no_change_since',
      source: 'mcp-registry',
      field: 'endpoint',
      days: 90,
      requirement: 'conditional',
      safeguard: 'Pin the endpoint in the gateway configuration instead of following the registry.',
    },
    {
      id: 'sources-agree-on-endpoint',
      kind: 'no_contradiction',
      sources: ['mcp-registry', 'concordium-cis8004'],
      field: 'endpoint',
      requirement: 'informational',
      description: 'Reported for context; this buyer does not make cross-registry agreement binding.',
    },
  ],
}

export const EXAMPLE_POLICIES: readonly ActivationPolicy[] = [STRICT_ACTIVATION_POLICY, PRAGMATIC_ACTIVATION_POLICY]

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export function syntheticScenarios(): SyntheticScenario[] {
  sequence = 0

  const satisfied: EvidenceDossier = {
    subject: SUBJECT,
    observations: [...stableRegistryChain(), ...respondingProbeChain()],
    lastCheckedAt: { 'mcp-registry': day(206), 'endpoint-probe': day(206) },
  }

  // The endpoint moved five days before the cutoff: a proven failure, not a doubt.
  const registryBase = stableRegistryChain()
  const moved: EvidenceDossier = {
    subject: SUBJECT,
    observations: [
      ...registryBase,
      observation({
        source: 'mcp-registry',
        observedAt: day(202),
        previousObservationId: registryBase[0].id,
        changeSummary: [
          { path: 'endpoint', kind: 'changed', from: 'https://synthetic.test/mcp', to: 'https://elsewhere.test/mcp' },
        ],
        facts: profileFacts({
          displayName: 'Synthetic Workspace Connector',
          endpoint: 'https://elsewhere.test/mcp',
          protocols: ['mcp'],
          repository: 'https://github.com/synthetic/workspace-connector',
          status: 'active',
        }),
      }),
      ...respondingProbeChain(),
    ],
    lastCheckedAt: { 'mcp-registry': day(206), 'endpoint-probe': day(206) },
  }

  // A source we have never observed at all. The policy needs it, we cannot answer, and
  // that is an unknown — not a mark against the supplier.
  const neverProbed: EvidenceDossier = {
    subject: SUBJECT,
    observations: stableRegistryChain(),
    lastCheckedAt: { 'mcp-registry': day(206) },
  }

  // Different thing entirely: the source WAS observed and declares no repository. That is
  // evidenced absence, so the strict policy is entitled to call it a failure.
  const noRepositoryDeclared: EvidenceDossier = {
    subject: SUBJECT,
    observations: [
      observation({
        source: 'mcp-registry',
        observedAt: day(0),
        facts: profileFacts({ displayName: 'Synthetic Workspace Connector', endpoint: 'https://synthetic.test/mcp', protocols: ['mcp'] }),
      }),
      ...respondingProbeChain(),
    ],
    lastCheckedAt: { 'mcp-registry': day(206), 'endpoint-probe': day(206) },
  }

  // Watched for two days, asked about ninety. The honest answer is "we do not know".
  const young: EvidenceDossier = {
    subject: SUBJECT,
    observations: [
      observation({
        source: 'mcp-registry',
        observedAt: day(205),
        facts: profileFacts({
          displayName: 'Synthetic Workspace Connector',
          endpoint: 'https://synthetic.test/mcp',
          protocols: ['mcp'],
          repository: 'https://github.com/synthetic/workspace-connector',
        }),
      }),
      observation({
        source: 'endpoint-probe',
        observedAt: day(205),
        facts: availabilityFacts({ checked_at: day(205), responded: true, status: 200, consecutive_failures: 0 }),
      }),
    ],
    lastCheckedAt: { 'mcp-registry': day(206), 'endpoint-probe': day(206) },
  }

  // Our registry reading is three weeks old: the strict policy's conditional bites.
  const staleReading: EvidenceDossier = {
    subject: SUBJECT,
    observations: [...stableRegistryChain(), ...respondingProbeChain()],
    lastCheckedAt: { 'mcp-registry': day(185), 'endpoint-probe': day(206) },
  }

  // Two registries, two endpoints. We show both and arbitrate neither.
  const contradicting: EvidenceDossier = {
    subject: SUBJECT,
    observations: [
      ...stableRegistryChain(),
      ...respondingProbeChain(),
      observation({
        source: 'concordium-cis8004',
        observedAt: day(10),
        facts: profileFacts({
          displayName: 'Synthetic Workspace Connector',
          endpoint: 'https://anchored.test/card.json',
          protocols: ['a2a-card'],
          anchors: { metadata_hash: 'deadbeef' },
        }),
      }),
    ],
    lastCheckedAt: { 'mcp-registry': day(206), 'endpoint-probe': day(206) },
  }

  return [
    {
      name: 'strict/all-criteria-met',
      synthetic: true,
      question: 'A fully evidenced connector under the strict policy.',
      expected: 'criteria_satisfied',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: satisfied,
    },
    {
      name: 'strict/endpoint-moved-recently',
      synthetic: true,
      question: 'A proven failure must not be softened by anything else.',
      expected: 'criteria_not_satisfied',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: moved,
    },
    {
      name: 'strict/mandatory-proof-never-observed',
      synthetic: true,
      question: 'A source we never observed is an unknown, never a fault charged to the supplier.',
      expected: 'insufficient_evidence',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: neverProbed,
    },
    {
      name: 'strict/repository-not-declared',
      synthetic: true,
      question: 'Observed absence is not the same as absent observation: this one is a real failure.',
      expected: 'criteria_not_satisfied',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: noRepositoryDeclared,
    },
    {
      name: 'strict/history-younger-than-the-question',
      synthetic: true,
      question: 'Asked about ninety days after watching for two: we say we do not know.',
      expected: 'insufficient_evidence',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: young,
    },
    {
      name: 'strict/reading-too-old',
      synthetic: true,
      question: 'A policy-declared condition fires, with the safeguard the policy author wrote.',
      expected: 'conditional_activation',
      policyId: STRICT_ACTIVATION_POLICY.id,
      dossier: staleReading,
    },
    {
      name: 'pragmatic/contradictory-sources',
      synthetic: true,
      question: 'Two registries disagree; the informational criterion reports it without deciding.',
      expected: 'criteria_satisfied',
      policyId: PRAGMATIC_ACTIVATION_POLICY.id,
      dossier: contradicting,
    },
  ]
}
