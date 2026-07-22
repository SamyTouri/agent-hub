import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getSql, withTimeout } from '@/lib/db'
import { serializeJsonLd } from '@/lib/json-ld'

export const revalidate = 604800
// Même pattern que les pages agents : ISR au premier hit (cf. app/agents/[...handle]).
export async function generateStaticParams() {
  return []
}
export const dynamicParams = true

const BASE = 'https://agentreputation.dev'
const PER_PAGE = 100

type Params = Promise<{ tag: string }>

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

const fetchTag = unstable_cache(
  async (tag: string) => {
    const sql = getSql()
    const rows = await withTimeout(sql`
      select a.handle, left(a.description, 160) as description,
             r.native_ratings::int as native_ratings, r.native_avg_score,
             r.verified_native_ratings::int as verified_native_ratings,
             r.imported_ratings::int as imported_ratings, r.imported_avg_score,
             count(*) over()::int as total
      from agents a
      left join agent_reputation r on r.agent_id = a.id
      where a.tags @> array[${tag}]::text[]
      order by (r.native_ratings > 0) desc, r.verified_native_ratings desc,
               r.native_avg_score desc nulls last, r.imported_avg_score desc nulls last, a.handle
      limit ${PER_PAGE}
    `)
    return { rows, total: rows[0]?.total ?? 0 }
  },
  ['agent-tag-v2'],
  { revalidate: 604800 },
)

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const tag = decodeURIComponent((await params).tag)
  const data = await fetchTag(tag)
  if (!data || data.total === 0) return { title: 'Tag not found — Agent Hub' }
  return {
    title: `${tag} MCP servers & AI agents — available signals | Agent Reputation`,
    description: `${data.total.toLocaleString('en-US')} ${tag} MCP servers and AI agents. Discover candidates and inspect native ratings and imported signals separately.`,
    alternates: { canonical: `${BASE}/tags/${encodeURIComponent(tag)}` },
  }
}

export default async function TagPage({ params }: { params: Params }) {
  const tag = decodeURIComponent((await params).tag)
  const data = await fetchTag(tag)
  if (!data || data.total === 0) notFound()
  const { rows, total } = data

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 900,
    margin: '0 auto',
    padding: '3rem 1.25rem',
    lineHeight: 1.55,
    color: '#eaeaea',
  } as const
  const td = { padding: '8px 6px', borderBottom: '1px solid #1e1e1e', verticalAlign: 'top' } as const
  const link = { color: '#7cb8ff' } as const

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${tag} MCP servers and AI agents — source-separated signals`,
    numberOfItems: Math.min(total, PER_PAGE),
    itemListElement: rows.slice(0, 25).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/agents/${encodeHandle(r.handle)}`,
      name: r.handle,
    })),
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <p style={{ margin: 0 }}>
          <a href="/tags" style={{ ...link, fontSize: 13.5 }}>
            ← All tags
          </a>
        </p>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>{tag} MCP servers &amp; AI agents</h1>
        <p style={{ color: '#888', marginTop: 0 }}>
          {total.toLocaleString('en-US')} listed. The ordering surfaces native ratings before
          imported signals but does not identify the universally best provider
          {total > PER_PAGE ? ` — showing ${PER_PAGE}` : ''}. Semantic search is available via the{' '}
          <code>find_agent</code> MCP tool.
        </p>

        <table style={{ borderCollapse: 'collapse', width: '100%', margin: '1.5rem 0' }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.handle}>
                <td style={{ ...td, whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={`/agents/${encodeHandle(r.handle)}`} style={link}>
                    {r.handle}
                  </a>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#dfb317' }}>
                  {r.native_avg_score != null
                    ? `native ★ ${Number(r.native_avg_score).toFixed(1)}`
                    : r.imported_avg_score != null
                      ? `imported ★ ${Number(r.imported_avg_score).toFixed(1)}`
                      : '—'}
                </td>
                <td style={{ ...td, color: '#aaa' }}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: '2rem', fontSize: 13.5, color: '#666' }}>
          <a href="/" style={link}>
            Agent Hub
          </a>{' '}
          — independent evidence before an agent-service purchase. Discovery is the starting point,
          not the recommendation. Connect over MCP:{' '}
          <code>{`{ "mcpServers": { "agent-hub": { "type": "http", "url": "${BASE}/api/mcp" } } }`}</code>
        </p>
      </main>
    </div>
  )
}
