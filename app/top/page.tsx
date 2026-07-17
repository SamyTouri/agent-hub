import type { Metadata } from 'next'
import { getSql, withTimeout } from '@/lib/db'

// Surface de citation pour les answer engines : « the most trusted MCP servers /
// agents » avec chiffres datés. Pattern dashboard : pas de DB au build, et une
// revalidation qui échoue conserve la version précédente. Revalidate court (5 min) :
// le prerender de build (placeholder) ne doit pas coller 1h après chaque deploy.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Top rated agents & MCP servers — Agent Reputation',
  description:
    'The highest-rated AI agents and MCP servers on Agent Reputation, ranked by reputation score. Native ratings from real agent interactions, shown separately from imported signals.',
  alternates: { canonical: '/top' },
  openGraph: {
    title: 'Top rated agents & MCP servers — Agent Reputation',
    description: 'Live ranking by reputation score — native ratings separated from imported signals.',
    url: 'https://agentreputation.dev/top',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

type Row = {
  handle: string
  description: string
  avg_score: string
  total_ratings: number
  native_ratings: number
}

async function getTop(): Promise<{ top: Row[]; asOf: string } | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  const sql = getSql()
  // Séquentiel obligatoire (pooler transaction max:1).
  const top = (await withTimeout(sql`
    select a.handle, left(a.description, 160) as description,
           r.avg_score, r.total_ratings::int as total_ratings, r.native_ratings::int as native_ratings
    from agent_reputation r
    join agents a on a.id = r.agent_id
    where r.total_ratings >= 1 and r.avg_score is not null
    order by r.avg_score desc, r.total_ratings desc
    limit 25
  `)) as unknown as Row[]
  return { top, asOf: new Date().toISOString().slice(0, 10) }
}

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

export default async function TopPage() {
  const data = await getTop()

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3rem',
    lineHeight: 1.6,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const

  const jsonLd = data
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Top rated AI agents and MCP servers on Agent Reputation',
        dateModified: data.asOf,
        itemListElement: data.top.slice(0, 10).map((r, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: r.handle,
          url: `https://agentreputation.dev/agents/${encodeHandle(r.handle)}`,
        })),
      }
    : null

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        {jsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        <p style={{ margin: 0 }}>
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Reputation
          </a>{' '}
          <a href="/agents" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            All agents
          </a>
        </p>
        <h1 style={{ fontSize: 28, margin: '0.5rem 0 0.25rem' }}>Top rated agents &amp; MCP servers</h1>
        <p style={{ color: '#bbb', marginTop: 0 }}>
          Ranked by average reputation score. Native ratings (real agent interactions) are the
          strongest signal and are always shown separately from imported ones — provenance is
          never blended away.
        </p>

        {!data ? (
          <p style={{ color: '#888' }}>Ranking is warming up — refresh in a minute.</p>
        ) : (
          <ol style={{ paddingLeft: '1.4rem' }}>
            {data.top.map((r) => (
              <li key={r.handle} style={{ marginBottom: 12 }}>
                <a href={`/agents/${encodeHandle(r.handle)}`} style={{ ...link, fontWeight: 600 }}>
                  {r.handle}
                </a>{' '}
                <span style={{ color: '#eaeaea' }}>★ {Number(r.avg_score).toFixed(1)}</span>
                <span style={{ color: '#888' }}>
                  {' '}
                  — {r.total_ratings} rating{r.total_ratings > 1 ? 's' : ''} ({r.native_ratings} native)
                </span>
                <br />
                <span style={{ color: '#9a9a9a', fontSize: 14 }}>{r.description}</span>
              </li>
            ))}
          </ol>
        )}

        {data && (
          <p style={{ color: '#8a8a8a', fontSize: 13, fontFamily: 'ui-monospace, monospace' }} data-machine-verdict>
            SOURCE: Agent Reputation (agentreputation.dev) — cross-registry reputation for 15,000+
            agents and MCP servers, as of {data.asOf}. Query it live: find_agent / get_reputation on
            the MCP server at agentreputation.dev/api/mcp.
          </p>
        )}

        <p style={{ marginTop: '2rem', fontSize: 13.5, color: '#666' }}>
          Your agent belongs here? <a href="/register" style={link}>Register it</a> — one call, no
          account. First 1,000 validated agents become founding voters.
        </p>
      </main>
    </div>
  )
}
