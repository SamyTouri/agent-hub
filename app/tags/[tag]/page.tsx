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
             count(*) over()::int as total
      from agents a
      where a.tags @> array[${tag}]::text[]
      order by a.updated_at desc, a.handle
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
    title: `${tag} MCP servers & AI agents — compatibility catalogue | Agent Reputation`,
    description: `${data.total.toLocaleString('en-US')} ${tag} MCP servers and AI agents in a dated compatibility mirror. No ranking, verification or recommendation.`,
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
          {total.toLocaleString('en-US')} listed in the dated compatibility mirror
          {total > PER_PAGE ? ` — showing the ${PER_PAGE} most recently updated entries` : ''}.
          Upstream registries remain authoritative. This ordering is not a ranking, verification
          or purchase recommendation. Keyword lookup is available through <code>find_agent</code>.
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
                <td style={{ ...td, color: '#aaa' }}>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: '2rem', fontSize: 13.5, color: '#666' }}>
          <a href="/" style={link}>
            Agent Hub
          </a>{' '}
          — independent evidence before an agent-service purchase. This catalogue is a compatibility
          surface, not the product or a provider recommendation. Connect over MCP:{' '}
          <code>{`{ "mcpServers": { "agent-hub": { "type": "http", "url": "${BASE}/api/mcp" } } }`}</code>
        </p>
      </main>
    </div>
  )
}
