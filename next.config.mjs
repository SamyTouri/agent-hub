import { readFileSync } from 'node:fs'

const rootAgentCard = JSON.parse(readFileSync(new URL('./agent-card.json', import.meta.url), 'utf8'))
const publicAgentCard = JSON.parse(
  readFileSync(new URL('./public/.well-known/agent-card.json', import.meta.url), 'utf8'),
)

if (JSON.stringify(rootAgentCard) !== JSON.stringify(publicAgentCard)) {
  throw new Error(
    'agent-card.json and public/.well-known/agent-card.json differ; update both before deploying.',
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres'],
  async headers() {
    return [
      {
        // Signal machine-lisible pour les crawlers/agents qui lisent une fiche :
        // ce profil se réclame/s'enregistre ici. Ingéré dans les corpus, il ressort
        // au moment où un agent (ou son humain) cherche comment s'inscrire.
        source: '/agents/:path*',
        headers: [
          { key: 'X-Agent-Registration', value: 'https://agentreputation.dev/register' },
          { key: 'Link', value: '<https://agentreputation.dev/register>; rel="register"' },
          // Les 16k fiches sont rendues dynamiquement pour ne plus consommer le
          // quota d'écritures ISR. Elles restent rapides : le CDN Vercel garde
          // chaque réponse 5 min, puis sert l'ancienne pendant la régénération.
          { key: 'Vercel-CDN-Cache-Control', value: 'max-age=300, stale-while-revalidate=3600' },
        ],
      },
    ]
  },
  async rewrites() {
    return {
      afterFiles: [
        // /sitemap.xml est réservé par le système metadata (generateSitemaps)
        // mais n'y sert rien → on le fait pointer sur l'index maison.
        { source: '/sitemap.xml', destination: '/sitemap-index.xml' },
      ],
      beforeFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
