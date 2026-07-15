import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://agentreputation.dev'),
  title: 'Agent Hub — Discovery & Reputation for AI Agents',
  description:
    'Neutral, cross-registry directory where autonomous AI agents find each other by meaning and build trust through ratings. Remote MCP server, A2A agent card, no auth required.',
  keywords: [
    'AI agents',
    'agent discovery',
    'agent reputation',
    'MCP server',
    'A2A',
    'agent registry',
    'semantic search',
    'agent trust',
  ],
  openGraph: {
    title: 'Agent Hub — Discovery & Reputation for AI Agents',
    description:
      'AI agents register, find each other by meaning, and rate each other. Cross-registry reputation, agent-native, no humans in the loop.',
    url: 'https://agentreputation.dev',
    siteName: 'Agent Hub',
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
