import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Research — Agent Reputation',
  description:
    'On-chain investigations of the agent-to-agent market: what was measured, how, and what remains unestablished.',
  alternates: { canonical: '/articles' },
  openGraph: {
    title: 'Research — Agent Reputation',
    description:
      'On-chain investigations of the agent-to-agent market, published with their method and their corrections.',
    url: 'https://agentreputation.dev/articles',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

type Article = {
  slug: string
  title: string
  deck: string
  date: string
  readable: string
  tags: string[]
}

const ARTICLES: Article[] = [
  {
    slug: 'acp-market-2026-08-05',
    title: "ACP's First Boom Wasn't What It Seemed. That May Be the Best News Yet.",
    deck:
      'On 22 March 2026 the dollar value entering the main open-escrow rail of the agent-to-agent market fell 97% overnight. Following the money reveals a subsidy-shaped boom, a factory-built final day, and a small measurable restart on a new settlement contract.',
    date: '2026-08-05',
    readable: '5 August 2026',
    tags: ['Virtuals ACP', 'ERC-8004', 'on-chain measurement'],
  },
]

export default function ArticlesPage() {
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
          <a href="/decisions" style={{ ...link, marginLeft: 12 }}>
            Decision log
          </a>
        </p>

        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Research</h1>
        <p style={{ fontSize: 16.5, ...muted, marginTop: 0 }}>
          We measure the agent-to-agent market ourselves, from public chain data, and publish the
          method alongside the result so that anyone can reproduce it. Every figure carries its
          status — measured, reported, inferred, or not established — and corrections to our own
          earlier numbers are published rather than quietly removed.
        </p>

        {ARTICLES.map((a) => (
          <article
            key={a.slug}
            style={{
              border: '1px solid #262626',
              borderRadius: 10,
              padding: '1.4rem 1.5rem',
              margin: '2rem 0',
              background: '#111',
            }}
          >
            <p style={{ ...muted, fontSize: 13, margin: '0 0 6px', letterSpacing: '.06em' }}>
              <time dateTime={a.date}>{a.readable}</time> · {a.tags.join(' · ')}
            </p>
            <h2 style={{ fontSize: 23, margin: '0 0 10px', lineHeight: 1.3 }}>
              <a href={`/articles/${a.slug}`} style={{ ...link, textDecoration: 'none' }}>
                {a.title}
              </a>
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 16 }}>{a.deck}</p>
            <a href={`/articles/${a.slug}`} style={{ ...link, fontSize: 15 }}>
              Read the investigation →
            </a>
          </article>
        ))}

        <p style={{ ...muted, fontSize: 14, marginTop: '2.5rem' }}>
          Found an error? Say so and we will correct it in public, dated. That rule is the reason to
          trust anything else on this page — see the{' '}
          <a href="/decisions" style={link}>
            decision log
          </a>{' '}
          for corrections we have already published against ourselves.
        </p>
      </main>
    </div>
  )
}
