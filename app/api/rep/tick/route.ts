import { isAuthorizedRepresentativeTick, runRepresentativeTick } from '@/lib/representative'

export const runtime = 'nodejs'
// Worst case per tick: up to 10 GitHub fetches (10 s timeout each) plus two
// 45 s-bounded LLM calls — more than 60 s. A mid-run kill leaves the run row
// 'running' and the lease held for 12 minutes. Fluid compute allows 300 s on
// Hobby (same as /api/cron/registry).
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!isAuthorizedRepresentativeTick(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    return Response.json(await runRepresentativeTick('supabase-cron'))
  } catch {
    return Response.json({ error: 'representative tick failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ error: 'not found' }, { status: 404 })
}
