import { getSql } from '@/lib/db'
import { submitIndexNow, HOST } from '@/lib/indexnow'
import { syncRegistryDelta } from '@/lib/registry-sync'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

// Cron quotidien (vercel.json, Hobby = 1×/jour) :
// 1. requête keep-alive — évite la pause Supabase free tier après 7 j d'inactivité
// 2. delta-import du registre MCP officiel (serveurs modifiés depuis 25 h) —
//    le catalogue reste frais sans re-import manuel ; les upserts touchent
//    updated_at, donc l'étape IndexNow ci-dessous les soumet automatiquement
// 3. IndexNow sur les URLs modifiées depuis 25 h (fenêtre > 24 h pour couvrir la dérive du cron)
// 4. purge des crawler_hits > 60 jours
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sql = getSql()
  const [{ total }] = await sql`select count(*)::int as total from agents`

  let registry: unknown
  try {
    registry = await syncRegistryDelta()
  } catch (e) {
    registry = { error: e instanceof Error ? e.message.slice(0, 120) : 'failed' }
  }

  const changed = await sql`
    select handle from agents where updated_at > now() - interval '25 hours' order by handle limit 10000
  `
  let indexnow: unknown = { submitted: 0, batches: 0 }
  if (changed.length > 0) {
    try {
      indexnow = await submitIndexNow(changed.map((r) => `https://${HOST}/agents/${encodeHandle(r.handle)}`))
    } catch (e) {
      indexnow = { error: e instanceof Error ? e.message : 'failed' }
    }
  }

  let purged = 0
  try {
    const res = await sql`delete from crawler_hits where created_at < now() - interval '60 days'`
    purged = res.count
  } catch {
    /* table pas encore créée : non bloquant */
  }

  return Response.json({ ok: true, agents: total, registry, changed_urls: changed.length, indexnow, purged })
}
