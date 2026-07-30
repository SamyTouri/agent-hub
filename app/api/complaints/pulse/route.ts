import { getSql, withTimeout } from '@/lib/db'

export const runtime = 'nodejs'
export const revalidate = 60

// Compteurs agrégés du Complaint Bureau. Sert une seule chose : prévenir l'opérateur
// qu'il y a du travail en attente, puisque rien ici ne se publie tout seul et que la page
// publique promet un délai de réponse court.
//
// Public assumé, et ça n'ouvre aucune fuite : ce sont des nombres sans sujet, sans partie
// et sans référence. Une contrepartie visée est de toute façon notifiée directement, donc
// le compteur ne lui apprend rien qu'elle ne sache déjà. En échange, notre propre activité
// devient vérifiable de l'extérieur, comme le reste du projet.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function GET() {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return Response.json({ available: false }, { headers: CORS_HEADERS })
  }
  try {
    const sql = getSql()
    // Séquentiel : le pooler transaction n'a qu'une connexion par instance.
    const filings = (await withTimeout(sql`
      select
        count(*) filter (where status = 'received')::int  as awaiting_verification,
        count(*) filter (where status = 'verified' and reply_deadline <= now())::int as publishable_now,
        count(*) filter (where status = 'verified' and reply_deadline > now())::int  as reply_window_open,
        count(*) filter (where status = 'published')::int as published
      from complaint_filings
    `)) as unknown as Array<{
      awaiting_verification: number
      publishable_now: number
      reply_window_open: number
      published: number
    }>
    const replies = (await withTimeout(sql`
      select count(*)::int as n from complaint_events where kind = 'reply' and not visible
    `)) as unknown as Array<{ n: number }>

    const f = filings[0]
    return Response.json(
      {
        available: true,
        as_of: new Date().toISOString(),
        awaiting_verification: f.awaiting_verification,
        reply_window_open: f.reply_window_open,
        publishable_now: f.publishable_now,
        replies_awaiting_review: replies[0].n,
        published: f.published,
        note: 'Aggregate counts only — no subject, party or reference is exposed here. Method and eligibility: https://agentreputation.dev/complaints',
      },
      { headers: CORS_HEADERS },
    )
  } catch {
    // Un échec de lecture n'affirme JAMAIS zéro : l'opérateur doit pouvoir distinguer
    // « rien à faire » de « je n'ai pas pu regarder ».
    return Response.json({ available: false }, { status: 503, headers: CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
