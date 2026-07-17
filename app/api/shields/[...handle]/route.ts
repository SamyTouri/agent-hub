import { getSql } from '@/lib/db'

export const runtime = 'nodejs'

// Endpoint compatible shields.io (https://shields.io/badges/endpoint-badge) :
// https://img.shields.io/endpoint?url=https://agentreputation.dev/api/shields/{handle}
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
      select native_ratings::int as native_ratings, native_avg_score,
             imported_ratings::int as imported_ratings, imported_avg_score
      from agent_reputation where handle = ${handle}
    `
    if (row) {
      if (row.native_ratings > 0 && row.native_avg_score != null) {
        avg = Number(row.native_avg_score)
        message = `native ★ ${avg.toFixed(1)}/5 (${row.native_ratings})`
      } else if (row.imported_ratings > 0 && row.imported_avg_score != null) {
        avg = Number(row.imported_avg_score)
        message = `imported ★ ${avg.toFixed(1)}/5 (${row.imported_ratings})`
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
      label: 'agent reputation',
      message,
      color: color(avg),
      cacheSeconds: 86400,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    },
  )
}
