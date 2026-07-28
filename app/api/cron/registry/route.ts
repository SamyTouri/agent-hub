import { getSql } from '@/lib/db'
import { syncRegistryDelta } from '@/lib/registry-sync'
import { syncConcordiumAgents } from '@/lib/concordium-sync'
import { CATALOGUE_LEASE_NAME, CATALOGUE_LEASE_TTL_MS, withLease } from '@/lib/single-flight'

export const runtime = 'nodejs'
// Fluid compute : Hobby autorise jusqu'à 300 s — l'import delta (fetch registre
// lent + embeddings + upserts) ne tient pas dans les 60 s du cron daily.
//
// Littéral obligatoire : Next analyse cette valeur statiquement. Un test relit les deux
// routes protégées pour que la durée du bail ne puisse pas se désynchroniser d'elles.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Cron quotidien dédié : delta-import du registre MCP officiel (modifiés < 26 h).
// Les upserts touchent agents.updated_at → le cron daily (3 h plus tard côté
// planning inverse : registry à 2 h, daily à 3 h) soumet les URLs à IndexNow.
//
// Sous le MÊME bail que l'entretien quotidien : les deux tâches écrivent dans `agents`, et
// chaque instance ne dispose que d'une connexion vers le pooler transactionnel. Se protéger
// seulement contre soi-même aurait laissé intact le cas où les deux écrivent ensemble.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const startedAt = Date.now()
  const sql = getSql()

  // Un import qui échoue reste un cron en ÉCHEC, comme avant le bail : `withLease` rend le
  // bail puis laisse remonter l'erreur du travail, et c'est ici qu'elle redevient un 500.
  let run
  try {
    run = await withLease(sql, CATALOGUE_LEASE_NAME, CATALOGUE_LEASE_TTL_MS, () => runImports())
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'failed' },
      { status: 500 },
    )
  }

  if (run.status === 'unavailable') {
    // Impossible de prouver qu'on est seul : on n'importe pas. Refuser bruyamment vaut
    // mieux que retomber dans la concurrence que ce garde existe pour empêcher.
    return Response.json(
      { ok: false, skipped: 'lock_unavailable', error: run.error, elapsed_ms: Date.now() - startedAt },
      { status: 503 },
    )
  }

  if (run.status === 'busy') {
    // L'autre tâche du catalogue travaille : on repart sans fetcher le registre amont,
    // sans embeddings et sans un seul upsert. HTTP 200 — c'est un résultat prévu, pas une
    // panne, et marquer le cron en échec ici apprendrait à ignorer ses propres alertes.
    return Response.json({
      ok: true,
      skipped: 'already_running',
      lock: run.lock,
      elapsed_ms: Date.now() - startedAt,
    })
  }

  return Response.json({
    ...run.result,
    lease: { holder: run.holder, expires_at: run.expiresAt, released: run.release.released },
    elapsed_ms: Date.now() - startedAt,
  })
}

/** Les deux imports, inchangés : ils ne s'exécutent que sous bail. */
async function runImports() {
  const registry = await syncRegistryDelta(26, 120_000)
  // Sequential on purpose: the Supabase transaction pool is max:1, and the
  // two imports both write embeddings and profiles.
  let concordium
  try {
    concordium = await syncConcordiumAgents(120_000)
  } catch (error) {
    // Concordium is an additive provenance source. A temporary upstream
    // outage must not turn a successful official MCP registry sync into a
    // failed cron run.
    concordium = {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 200) : 'failed',
    }
  }
  return { ok: true, registry, concordium }
}
