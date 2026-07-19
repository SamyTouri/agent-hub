import { isAuthorizedRepresentativeTick, runRepresentativeTick } from '@/lib/representative'

export const runtime = 'nodejs'
export const maxDuration = 60
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
