// Le manifeste de cohorte — figer une sélection pour qu'elle soit relue, pas re-dérivée.
//
// La règle de sélection est déterministe à catalogue égal, mais le catalogue, lui, bouge.
// Rejouer la règle au moment d'écrire signifierait que l'ensemble validé et l'ensemble
// écrit peuvent différer sans que personne ne le voie. Le manifeste coupe ça en deux
// temps : on planifie, un humain relit la liste exacte, puis on applique CE fichier —
// vérifié par empreinte, refusé s'il a bougé d'un caractère.
//
// C'est la même discipline que le journal lui-même : ce qui est écrit doit être ce qui a
// été examiné, et la seule façon de le garantir est de ne pas recalculer entre les deux.

import { canonicalJson, sha256Hex } from './evidence-history.ts'
import type { CohortPick, CohortSpec, CohortStratum } from './evidence-cohort.ts'

export const COHORT_MANIFEST_SCHEMA = 'https://agentreputation.dev/schemas/cohort-manifest/v1'

export type ManifestEntry = {
  agent_id: string
  handle: string
  subject_kind: string
  stratum: CohortStratum
  selection_rule: string
  selection_family: string | null
  selection_reason: string
}

export type CohortManifest = {
  schema: string
  cohort: string
  spec_version: number
  generated_at: string
  /** Sujets déjà suivis au moment du plan. Le manifeste ne les contient pas ; il les
   *  compte, pour que le total soit vérifiable sans relire la base. */
  already_tracked: number
  additions: number
  resulting_total: number
  target_total: number
  per_stratum: Record<string, number>
  entries: ManifestEntry[]
  /** Empreinte de tout ce qui précède. Une virgule de plus et l'application refuse. */
  content_hash: string
}

function entryOf(pick: CohortPick): ManifestEntry {
  return {
    agent_id: pick.agentId,
    handle: pick.handle,
    subject_kind: pick.subjectKind,
    stratum: pick.stratum,
    selection_rule: pick.selectionRule,
    selection_family: pick.selectionFamily,
    selection_reason: pick.selectionReason,
  }
}

/** Corps sur lequel porte l'empreinte : tout le manifeste sauf l'empreinte elle-même. */
function manifestBody(manifest: Omit<CohortManifest, 'content_hash'>) {
  return canonicalJson(manifest)
}

export function buildCohortManifest(input: {
  cohort: string
  spec: CohortSpec
  additions: readonly CohortPick[]
  alreadyTracked: number
  generatedAt: string
}): CohortManifest {
  // Ordre canonique par handle : deux plans issus du même catalogue doivent être
  // identiques octet pour octet, pas seulement équivalents.
  const entries = [...input.additions]
    .map(entryOf)
    .sort((a, b) => (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0))

  const perStratum: Record<string, number> = {}
  for (const entry of entries) perStratum[entry.stratum] = (perStratum[entry.stratum] ?? 0) + 1

  const body: Omit<CohortManifest, 'content_hash'> = {
    schema: COHORT_MANIFEST_SCHEMA,
    cohort: input.cohort,
    spec_version: input.spec.version,
    generated_at: input.generatedAt,
    already_tracked: input.alreadyTracked,
    additions: entries.length,
    resulting_total: input.alreadyTracked + entries.length,
    target_total: input.spec.targetSubjects,
    per_stratum: perStratum,
    entries,
  }
  return { ...body, content_hash: sha256Hex(manifestBody(body)) }
}

export type ManifestProblem = { code: string; detail: string }

/**
 * Relit un manifeste venu du disque. Rien n'est supposé : c'est un fichier qu'un opérateur
 * a pu éditer à la main entre le plan et l'application, et c'est précisément le moment où
 * une ligne pourrait être ajoutée sans avoir été examinée.
 */
export function verifyCohortManifest(
  value: unknown,
  expected: { cohort: string; spec: CohortSpec },
): { ok: true; manifest: CohortManifest } | { ok: false; problems: ManifestProblem[] } {
  const problems: ManifestProblem[] = []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, problems: [{ code: 'not_an_object', detail: 'a manifest must be a JSON object' }] }
  }
  const manifest = value as Partial<CohortManifest>
  if (manifest.schema !== COHORT_MANIFEST_SCHEMA) {
    problems.push({ code: 'unknown_schema', detail: String(manifest.schema) })
  }
  if (manifest.cohort !== expected.cohort) {
    problems.push({ code: 'cohort_mismatch', detail: `${manifest.cohort} != ${expected.cohort}` })
  }
  if (manifest.spec_version !== expected.spec.version) {
    problems.push({ code: 'spec_version_mismatch', detail: `${manifest.spec_version} != ${expected.spec.version}` })
  }
  if (typeof manifest.content_hash !== 'string') {
    problems.push({ code: 'missing_content_hash', detail: 'a manifest without a hash cannot be trusted' })
  }
  if (!Array.isArray(manifest.entries)) {
    problems.push({ code: 'entries_not_an_array', detail: 'entries must be an array' })
    return { ok: false, problems }
  }
  if (manifest.entries.length !== manifest.additions) {
    problems.push({
      code: 'addition_count_mismatch',
      detail: `${manifest.entries.length} entries for ${manifest.additions} declared additions`,
    })
  }
  const ids = new Set<string>()
  for (const entry of manifest.entries as ManifestEntry[]) {
    if (typeof entry?.agent_id !== 'string' || typeof entry?.handle !== 'string') {
      problems.push({ code: 'invalid_entry', detail: JSON.stringify(entry).slice(0, 120) })
      continue
    }
    if (ids.has(entry.agent_id)) problems.push({ code: 'duplicate_entry', detail: entry.handle })
    ids.add(entry.agent_id)
    if (!/\/v\d+$/.test(String(entry.selection_rule))) {
      problems.push({ code: 'unversioned_selection_rule', detail: entry.handle })
    }
  }
  if (problems.length > 0) return { ok: false, problems }

  const { content_hash: declared, ...body } = manifest as CohortManifest
  const recomputed = sha256Hex(manifestBody(body))
  if (recomputed !== declared) {
    // Le cas qui compte : quelqu'un a ajouté un sujet après la relecture.
    return {
      ok: false,
      problems: [{ code: 'content_hash_mismatch', detail: 'the manifest changed after it was planned; re-plan and review again' }],
    }
  }
  return { ok: true, manifest: manifest as CohortManifest }
}
