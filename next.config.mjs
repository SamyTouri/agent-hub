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
