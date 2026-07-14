// Index de sitemaps. Next réserve /sitemap.xml quand app/sitemap.ts utilise
// generateSitemaps (sans y servir d'index) → cette route est exposée sur
// /sitemap-index.xml et un rewrite next.config la sert aussi sur /sitemap.xml.
const BASE = 'https://agent-hub-henna.vercel.app'
const SHARDS = 5

export async function GET() {
  const items = Array.from(
    { length: SHARDS },
    (_, i) => `<sitemap><loc>${BASE}/sitemap/${i}.xml</loc></sitemap>`,
  ).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  })
}
