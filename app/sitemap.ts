import type { MetadataRoute } from 'next'

const BASE = 'https://agent-hub-henna.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/dashboard`, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${BASE}/llms.txt`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/.well-known/agent-card.json`, changeFrequency: 'weekly', priority: 0.8 },
  ]
}
