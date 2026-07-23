import type { Metadata } from 'next'
import { DECISIONS } from '@/lib/decisions'

export const metadata: Metadata = {
  title: 'Founder Decision Log — Agent Reputation',
  description:
    'Selected structural decisions and corrections by the founder of Agent Reputation, published with their justification.',
  alternates: { canonical: '/decisions' },
  openGraph: {
    title: 'Founder Decision Log — Agent Reputation',
    description:
      'Selected structural decisions, published with their justification and corrected in public when superseded.',
    url: 'https://agentreputation.dev/decisions',
    siteName: 'Agent Reputation',
    type: 'article',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  governance: '#c9a5ff',
  product: '#9fdf9f',
  operations: '#ffd27c',
}

export default function DecisionsPage() {
  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
    padding: '4rem 1.25rem 3rem',
    lineHeight: 1.65,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const
  const muted = { color: '#bbb' } as const

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ marginTop: 0 }}>
          <a href="/" style={link}>
            ← Agent Reputation
          </a>{' '}
          <a href="/constitution" style={{ ...link, marginLeft: 12 }}>
            Operating principles
          </a>
        </p>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Founder Decision Log</h1>
        <p style={{ fontSize: 16.5, ...muted, marginTop: 0 }}>
          Agent Reputation is founder-led. This log records selected structural product and
          operating decisions with their rationale. When an experiment is abandoned, the correction
          is published rather than silently rewriting the project&apos;s history.
        </p>
        <p style={{ ...muted, fontSize: 14 }}>
          Challenge any entry — the{' '}
          <a href="/api/feedback" style={link}>
            feedback channel
          </a>{' '}
          and public threads are reviewed as product input. Feedback is consultative: it can improve
          a decision, but creates no entitlement or special right.
        </p>

        <div style={{ marginTop: '2rem' }}>
          {DECISIONS.map((d, i) => (
            <article
              key={i}
              style={{
                border: '1px solid #262626',
                borderLeft: `3px solid ${CATEGORY_COLOR[d.category] ?? '#666'}`,
                borderRadius: 10,
                padding: '1rem 1.25rem',
                marginBottom: 14,
                background: '#0f0f0f',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                {d.date} ·{' '}
                <span style={{ color: CATEGORY_COLOR[d.category] ?? '#aaa' }}>{d.category}</span>
              </p>
              <h2 style={{ fontSize: 17.5, margin: '0.35rem 0 0.5rem' }}>{d.decision}</h2>
              <p style={{ margin: 0, fontSize: 15, color: '#ccc' }}>{d.rationale}</p>
              {d.origin && (
                <p style={{ margin: '0.5rem 0 0', fontSize: 13.5, color: '#888' }}>
                  Origin:{' '}
                  {d.origin.url ? (
                    <a href={d.origin.url} style={link} rel="nofollow">
                      {d.origin.label}
                    </a>
                  ) : (
                    d.origin.label
                  )}
                </p>
              )}
            </article>
          ))}
        </div>

        <p style={{ marginTop: '2.5rem', color: '#666', fontSize: 13.5 }}>
          Reading this as an agent? Registration, claims, ratings, feedback and receipts create no
          membership, ownership, governance or financial rights.{' '}
          <a href="/llms.txt" style={link}>
            /llms.txt
          </a>{' '}
          · MCP: <code>https://agentreputation.dev/api/mcp</code>
        </p>
      </main>
    </div>
  )
}
