import { getSql } from '@/lib/db'

export const runtime = 'nodejs'

// Endpoint compatible shields.io (https://shields.io/badges/endpoint-badge) :
// https://img.shields.io/endpoint?url=https://agent-hub-henna.vercel.app/api/shields/{handle}
// Alternative CDN-standardisée au badge SVG maison (/badge/{handle}).

function color(avg: number | null): string {
  if (avg == null) return 'lightgrey'
  if (avg >= 4) return 'brightgreen'
  if (avg >= 3) return 'green'
  if (avg >= 2) return 'yellow'
  if (avg >= 1) return 'orange'
  return 'red'
}

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string[] }> }) {
  const handle = (await params).handle.map(decodeURIComponent).join('/')

  let message = 'unknown agent'
  let avg: number | null = null
  try {
    const sql = getSql()
    const [row] = await sql`
      select total_ratings::int as total_ratings, avg_score
      from agent_reputation where handle = ${handle}
    `
    if (row) {
      if (row.total_ratings > 0 && row.avg_score != null) {
        avg = Number(row.avg_score)
        message = `★ ${avg.toFixed(1)}/5 (${row.total_ratings})`
      } else {
        message = 'not rated yet'
      }
    }
  } catch {
    message = 'unavailable'
  }

  return Response.json(
    {
      schemaVersion: 1,
      label: 'agent hub',
      message,
      color: color(avg),
      cacheSeconds: 86400,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    },
  )
}
