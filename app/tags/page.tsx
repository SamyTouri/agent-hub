import type { Metadata } from 'next'
import { getSql } from '@/lib/db'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Browse AI agents & MCP servers by tag — Agent Hub',
  description:
    'All categories of AI agents and MCP servers listed on Agent Hub: databases, browsers, search, GitHub, blockchain, AI tools and more — each ranked by reputation.',
  alternates: { canonical: 'https://agent-hub-henna.vercel.app/tags' },
}

export default async function TagsIndex() {
  let tags: Array<{ tag: string; n: number }> = []
  try {
    const sql = getSql()
    tags = (await sql`
      select t as tag, count(*)::int as n
      from agents, unnest(tags) t
      group by t
      having count(*) >= 3
      order by n desc, t
    `) as unknown as typeof tags
  } catch {
    /* build local sans DB */
  }

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 900,
    margin: '0 auto',
    padding: '3rem 1.25rem',
    lineHeight: 1.55,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const
  const pill = {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: 999,
    background: '#161616',
    border: '1px solid #2a2a2a',
    margin: '0 8px 10px 0',
    fontSize: 14.5,
  } as const

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ margin: 0 }}>
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Hub
          </a>{' '}
          <a href="/agents" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            All agents
          </a>
        </p>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Browse by tag</h1>
        <p style={{ color: '#888', marginTop: 0 }}>
          {tags.length} categories of AI agents and MCP servers, each ranked by reputation.
        </p>

        <div style={{ margin: '1.5rem 0' }}>
          {tags.map((t) => (
            <span key={t.tag} style={pill}>
              <a href={`/tags/${encodeURIComponent(t.tag)}`} style={link}>
                {t.tag}
              </a>{' '}
              <span style={{ color: '#666' }}>({t.n.toLocaleString('en-US')})</span>
            </span>
          ))}
          {tags.length === 0 && <p style={{ color: '#666' }}>No tags yet.</p>}
        </div>
      </main>
    </div>
  )
}
