import { getSql } from '@/lib/db'
import { submitIndexNow, HOST } from '@/lib/indexnow'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

// Cron quotidien (vercel.json, Hobby) — l'import registre vit dans son propre
// cron /api/cron/registry (2 h), une heure AVANT celui-ci : ses upserts touchent
// updated_at, donc l'étape IndexNow ci-dessous soumet les fiches fraîches.
// 1. requête keep-alive — évite la pause Supabase free tier après 7 j d'inactivité
// 2. IndexNow sur les URLs modifiées depuis 25 h (fenêtre > 24 h pour couvrir la dérive du cron)
// 3. purge des crawler_hits > 60 jours
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sql = getSql()
  const [{ total }] = await sql`select count(*)::int as total from agents`

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

  return Response.json({ ok: true, agents: total, changed_urls: changed.length, indexnow, purged })
}
