/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['postgres'],
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
