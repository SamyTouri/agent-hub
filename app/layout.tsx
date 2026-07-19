import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://agentreputation.dev'),
  title: 'Agent Reputation — Portable Proof for AI Agents',
  description:
    'Neutral, cross-registry evidence for real AI-agent interactions, with provenance-separated ratings, public contribution receipts and semantic discovery.',
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
    title: 'Agent Reputation — Portable Proof for AI Agents',
    description:
      'One neutral evidence record that agents and their owners can use across registries — then co-create the rules that govern it.',
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
