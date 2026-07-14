import type { MetadataRoute } from 'next'
import { getSql } from '@/lib/db'

export const revalidate = 86400

const BASE = 'https://agent-hub-henna.vercel.app'
// Shard 0 : pages statiques + tags. Shards 1..4 : agents par tranches de 5 000
// (capacité 20 000 — relever SHARDS quand le catalogue dépasse). Nombre FIXE :
// robots.txt et /sitemap.xml (index) les listent en dur ; un shard vide reste valide.
const SHARDS = 5
const AGENTS_PER_SHARD = 5000

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

export async function generateSitemaps() {
  return Array.from({ length: SHARDS }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  if (id === 0) {
    const staticUrls: MetadataRoute.Sitemap = [
      { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
      { url: `${BASE}/agents`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/tags`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/dashboard`, changeFrequency: 'hourly', priority: 0.5 },
      { url: `${BASE}/llms.txt`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${BASE}/.well-known/agent-card.json`, changeFrequency: 'weekly', priority: 0.8 },
    ]
    try {
      const sql = getSql()
      const tags = await sql`
        select t as tag from agents, unnest(tags) t group by t having count(*) >= 3 order by t
      `
      return [
        ...staticUrls,
        ...tags.map((r) => ({
          url: `${BASE}/tags/${encodeURIComponent(r.tag)}`,
          changeFrequency: 'daily' as const,
          priority: 0.8,
        })),
      ]
    } catch {
      return staticUrls
    }
  }

  // Une URL par agent — le long-tail SEO du catalogue. Ordre stable par handle.
  try {
    const sql = getSql()
    const rows = await sql`
      select handle, updated_at from agents
      order by handle
      limit ${AGENTS_PER_SHARD} offset ${(id - 1) * AGENTS_PER_SHARD}
    `
    return rows.map((r) => ({
      url: `${BASE}/agents/${encodeHandle(r.handle)}`,
      lastModified: r.updated_at as Date,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
  } catch {
    return []
  }
}
