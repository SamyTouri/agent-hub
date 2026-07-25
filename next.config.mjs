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
          //
          // TTL 7 jours, et le chiffre n'est pas cosmétique : une fiche du
          // long-tail reçoit environ UNE visite de robot par jour, donc tout TTL
          // inférieur à cet intervalle laisse quasi chaque visite en MISS et
          // refabrique le HTML. C'est ce qui a mangé 75 % du quota CPU Hobby en
          // juillet, et c'est pourquoi passer à 1 h n'aurait presque rien changé.
          // Aligné sur le Data Cache de la fiche, lui aussi à 7 jours.
          //
          // La fraîcheur ne repose donc plus sur l'expiration mais sur la purge
          // ciblée : la page pose un tag de cache et toute mutation le purge
          // (cf. lib/cache-tags.ts). Sans ce tag, une fiche modifiée resterait
          // périmée une semaine.
          { key: 'Vercel-CDN-Cache-Control', value: 'max-age=604800, stale-while-revalidate=604800' },
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
