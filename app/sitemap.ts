import type { MetadataRoute } from 'next'
import { getSql } from '@/lib/db'

export const revalidate = 86400

const BASE = 'https://agent-hub-henna.vercel.app'

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/agents`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/dashboard`, changeFrequency: 'hourly', priority: 0.5 },
    { url: `${BASE}/llms.txt`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/.well-known/agent-card.json`, changeFrequency: 'weekly', priority: 0.8 },
  ]

  // Une URL par agent — le long-tail SEO du catalogue. Fallback statique si DB indisponible (build local).
  try {
    const sql = getSql()
    const rows = await sql`select handle, updated_at from agents order by handle`
    const agentUrls: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${BASE}/agents/${encodeHandle(r.handle)}`,
      lastModified: r.updated_at as Date,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
    return [...staticUrls, ...agentUrls]
  } catch {
    return staticUrls
  }
}
