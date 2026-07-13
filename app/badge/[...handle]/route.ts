import { getSql } from '@/lib/db'

export const runtime = 'nodejs'

// Badge SVG style shields.io : « Agent Hub | ★ 4.2 (12) ». Zéro dépendance, cache CDN 1h.

const CHAR_W = 6.3
const PAD = 10

function color(avg: number | null): string {
  if (avg == null) return '#9f9f9f'
  if (avg >= 4) return '#4c1'
  if (avg >= 3) return '#97ca00'
  if (avg >= 2) return '#dfb317'
  if (avg >= 1) return '#fe7d37'
  return '#e05d44'
}

function svg(label: string, value: string, valueColor: string): string {
  const lw = Math.round(label.length * CHAR_W + PAD * 2)
  const vw = Math.round(value.length * CHAR_W + PAD * 2)
  const w = lw + vw
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${valueColor}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="14">${value}</text>
  </g>
</svg>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string[] }> }) {
  const handle = (await params).handle.map(decodeURIComponent).join('/')

  let value = 'unknown agent'
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
        value = `★ ${avg.toFixed(1)} (${row.total_ratings})`
      } else {
        value = 'not rated yet'
      }
    }
  } catch {
    value = 'unavailable'
  }

  return new Response(svg('Agent Hub', value, color(avg)), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
