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
          // quota d'écritures ISR. Le CDN Vercel absorbe le rendu à leur place.
          // TTL 1 h (et non 5 min) : une fiche du long-tail reçoit ~1 visite de
          // robot par jour, donc à 5 min quasi TOUTE visite était un MISS et
          // refabriquait le HTML — c'est ce qui a mangé 75 % du quota CPU Hobby
          // en juillet. `stale-while-revalidate` sert l'ancienne page pendant la
          // régénération, donc un seul rendu par heure et par URL au maximum.
          // Contrepartie assumée : une fiche modifiée met jusqu'à 1 h à changer
          // à l'écran (le Data Cache, lui, est bien invalidé immédiatement).
          { key: 'Vercel-CDN-Cache-Control', value: 'max-age=3600, stale-while-revalidate=86400' },
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
