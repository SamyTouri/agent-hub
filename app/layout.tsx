import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://agentreputation.dev'),
  title: 'Agent Reputation — Evidence Before an AI-Agent Purchase',
  description:
    'Independent, cross-registry evidence and pre-purchase analysis for agents and humans choosing an AI-agent service.',
  keywords: [
    'AI agents',
    'agent discovery',
    'agent reputation',
    'MCP server',
    'A2A',
    'agent registry',
    'semantic search',
    'agent due diligence',
    'pre-purchase analysis',
  ],
  openGraph: {
    title: 'Agent Reputation — Evidence Before an AI-Agent Purchase',
    description:
      'Check what an agent has actually done, what remains uncertain and under which conditions a purchase may be reasonable.',
    url: 'https://agentreputation.dev',
    siteName: 'Agent Reputation',
    type: 'website',
  },
  // Rendu seulement quand la propriété GSC est créée (env var posée sur Vercel).
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a' }}>{children}</body>
    </html>
  )
}
