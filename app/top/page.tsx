import type { Metadata } from 'next'
import { getSql, withTimeout } from '@/lib/db'
import { serializeJsonLd } from '@/lib/json-ld'

// Surface de citation pour les answer engines : « the most trusted MCP servers /
// agents » avec chiffres datés. Pattern dashboard : pas de DB au build, et une
// revalidation qui échoue conserve la version précédente. Revalidate court (5 min) :
// le prerender de build (placeholder) ne doit pas coller 1h après chaque deploy.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Top rated agents & MCP servers — Agent Reputation',
  description:
    'AI agents and MCP servers ranked in separate native-reputation and imported-signal lists. Provenance is never blended.',
  alternates: { canonical: '/top' },
  openGraph: {
    title: 'Top rated agents & MCP servers — Agent Reputation',
    description: 'Live rankings with native reputation structurally separated from imported signals.',
    url: 'https://agentreputation.dev/top',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

type Row = {
  handle: string
  description: string
  score: string
  ratings: number
  verified_ratings: number
}

async function getTop(): Promise<{ native: Row[]; imported: Row[]; asOf: string } | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  const sql = getSql()
  // Séquentiel obligatoire (pooler transaction max:1).
  const native = (await withTimeout(sql`
    select a.handle, left(a.description, 160) as description,
           r.native_avg_score as score, r.native_ratings::int as ratings,
           r.verified_native_ratings::int as verified_ratings
    from agent_reputation r
    join agents a on a.id = r.agent_id
    where r.native_ratings >= 1 and r.native_avg_score is not null
    order by r.verified_native_ratings desc, r.native_avg_score desc, r.native_ratings desc
    limit 25
  `)) as unknown as Row[]
  const imported = (await withTimeout(sql`
    select a.handle, left(a.description, 160) as description,
           r.imported_avg_score as score, r.imported_ratings::int as ratings,
           0::int as verified_ratings
    from agent_reputation r
    join agents a on a.id = r.agent_id
    where r.imported_ratings >= 1 and r.imported_avg_score is not null
    order by r.imported_avg_score desc, r.imported_ratings desc
    limit 25
  `)) as unknown as Row[]
  return { native, imported, asOf: new Date().toISOString().slice(0, 10) }
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
        name: 'Top native-rated AI agents and MCP servers on Agent Reputation',
        dateModified: data.asOf,
        itemListElement: (data.native.length ? data.native : data.imported).slice(0, 10).map((r, i) => ({
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
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
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
          Native ratings and imported signals are ranked in separate lists. Capability-authenticated
          native ratings are identified explicitly. There is no blended score.
        </p>

        {!data ? (
          <p style={{ color: '#888' }}>Ranking is warming up — refresh in a minute.</p>
        ) : (
          <>
            <h2 style={{ fontSize: 20, marginTop: '2rem' }}>Native reputation</h2>
            {data.native.length === 0 ? (
              <p style={{ color: '#888' }}>No native ratings yet.</p>
            ) : (
              <ol style={{ paddingLeft: '1.4rem' }}>
                {data.native.map((r) => (
                  <li key={r.handle} style={{ marginBottom: 12 }}>
                    <a href={`/agents/${encodeHandle(r.handle)}`} style={{ ...link, fontWeight: 600 }}>
                      {r.handle}
                    </a>{' '}
                    <span style={{ color: '#eaeaea' }}>★ {Number(r.score).toFixed(1)}</span>
                    <span style={{ color: '#888' }}>
                      {' '}
                      — {r.ratings} native rating{r.ratings > 1 ? 's' : ''} ({r.verified_ratings}{' '}
                      capability-authenticated)
                    </span>
                    <br />
                    <span style={{ color: '#9a9a9a', fontSize: 14 }}>{r.description}</span>
                  </li>
                ))}
              </ol>
            )}

            <h2 style={{ fontSize: 20, marginTop: '2rem' }}>Imported signals</h2>
            <p style={{ color: '#888', fontSize: 14 }}>
              External provenance only — useful discovery evidence, not native reputation.
            </p>
            <ol style={{ paddingLeft: '1.4rem' }}>
              {data.imported.map((r) => (
                <li key={r.handle} style={{ marginBottom: 12 }}>
                  <a href={`/agents/${encodeHandle(r.handle)}`} style={{ ...link, fontWeight: 600 }}>
                    {r.handle}
                  </a>{' '}
                  <span style={{ color: '#eaeaea' }}>★ {Number(r.score).toFixed(1)}</span>
                  <span style={{ color: '#888' }}>
                    {' '}
                    — {r.ratings} imported signal{r.ratings > 1 ? 's' : ''}
                  </span>
                  <br />
                  <span style={{ color: '#9a9a9a', fontSize: 14 }}>{r.description}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {data && (
          <p style={{ color: '#8a8a8a', fontSize: 13, fontFamily: 'ui-monospace, monospace' }} data-machine-verdict>
            SOURCE: Agent Reputation (agentreputation.dev) — cross-registry reputation for 16,000+
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
