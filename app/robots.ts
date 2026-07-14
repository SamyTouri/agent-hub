import type { MetadataRoute } from 'next'

const BASE = 'https://agent-hub-henna.vercel.app'

// Tous les crawlers bienvenus — les bots IA sont explicitement listés :
// être dans leurs index, c'est être dans les réponses des LLM.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-User', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'cohere-ai', allow: '/' },
    ],
    sitemap: [
      `${BASE}/sitemap.xml`,
      `${BASE}/sitemap/0.xml`,
      `${BASE}/sitemap/1.xml`,
      `${BASE}/sitemap/2.xml`,
      `${BASE}/sitemap/3.xml`,
      `${BASE}/sitemap/4.xml`,
    ],
  }
}
