import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { getSql, withTimeout } from '@/lib/db'
import { OWNERS_LANGS, ownersPath } from '@/lib/owners-i18n'

// Le build émet un placeholder sans DB ; 5 min évite qu'un deploy ne colle des
// shards vides pendant 24 h. Les données elles-mêmes restent en Data Cache 24 h
// et persistent entre déploiements.
export const revalidate = 300

const BASE = 'https://agentreputation.dev'
// Shard 0 : pages statiques + tags. Shards 1..4 : agents par tranches de 5 000
// (capacité 20 000 — relever SHARDS quand le catalogue dépasse). Nombre FIXE :
// robots.txt et /sitemap.xml (index) les listent en dur ; un shard vide reste valide.
const SHARDS = 5
const AGENTS_PER_SHARD = 5000

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')
const getSitemapTags = unstable_cache(
  async () => {
    const sql = getSql()
    return withTimeout(sql`
      select t as tag from agents, unnest(tags) t group by t having count(*) >= 3 order by t
    `)
  },
  ['sitemap-tags-v2'],
  { revalidate: 86400 },
)
const getAgentShard = unstable_cache(
  async (id: number) => {
    const sql = getSql()
    return withTimeout(sql`
      select handle, updated_at from agents
      order by handle
      limit ${AGENTS_PER_SHARD} offset ${(id - 1) * AGENTS_PER_SHARD}
    `)
  },
  ['sitemap-agents-v2'],
  { revalidate: 86400 },
)

export async function generateSitemaps() {
  return Array.from({ length: SHARDS }, (_, id) => ({ id }))
}

// Next 16 : l'id arrive en Promise<string> (pas en number comme avant v16).
export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id)
  if (id === 0) {
    const staticUrls: MetadataRoute.Sitemap = [
      { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
      { url: `${BASE}/constitution`, changeFrequency: 'monthly', priority: 0.9 },
      { url: `${BASE}/constitution.md`, changeFrequency: 'monthly', priority: 0.7 },
      { url: `${BASE}/decisions`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${BASE}/contributions`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/requests`, changeFrequency: 'hourly', priority: 0.9 },
      { url: `${BASE}/register`, changeFrequency: 'weekly', priority: 0.9 },
      ...OWNERS_LANGS.map((l) => ({
        url: `${BASE}${ownersPath(l)}`,
        changeFrequency: 'monthly' as const,
        priority: l === 'en' ? 0.7 : 0.6,
      })),
      { url: `${BASE}/top`, changeFrequency: 'hourly', priority: 0.8 },
      { url: `${BASE}/agents`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/tags`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE}/dashboard`, changeFrequency: 'hourly', priority: 0.5 },
      { url: `${BASE}/llms.txt`, changeFrequency: 'weekly', priority: 0.8 },
      { url: `${BASE}/.well-known/agent-card.json`, changeFrequency: 'weekly', priority: 0.8 },
    ]
    if (process.env.NEXT_PHASE === 'phase-production-build') return staticUrls
    const tags = await getSitemapTags()
    return [
      ...staticUrls,
      ...tags.map((r) => ({
        url: `${BASE}/tags/${encodeURIComponent(r.tag)}`,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
    ]
  }

  // Une URL par agent — le long-tail SEO du catalogue. Ordre stable par handle.
  if (process.env.NEXT_PHASE === 'phase-production-build') return []
  const rows = await getAgentShard(id)
  return rows.map((r) => ({
    url: `${BASE}/agents/${encodeHandle(r.handle)}`,
    lastModified: r.updated_at as Date,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))
}
