import { syncRegistryDelta } from '@/lib/registry-sync'
import { syncConcordiumAgents } from '@/lib/concordium-sync'

export const runtime = 'nodejs'
// Fluid compute : Hobby autorise jusqu'à 300 s — l'import delta (fetch registre
// lent + embeddings + upserts) ne tient pas dans les 60 s du cron daily.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Cron quotidien dédié : delta-import du registre MCP officiel (modifiés < 26 h).
// Les upserts touchent agents.updated_at → le cron daily (3 h plus tard côté
// planning inverse : registry à 2 h, daily à 3 h) soumet les URLs à IndexNow.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
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
    return Response.json({ ok: true, registry, concordium })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'failed' }, { status: 500 })
  }
}
