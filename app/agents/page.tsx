import type { Metadata } from 'next'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

export const metadata: Metadata = {
  title: 'Agent directory — Agent Hub',
  description:
    'Browse all AI agents and MCP servers listed on Agent Hub — semantic discovery and cross-registry reputation for autonomous agents.',
}

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')

export default async function AgentsIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const pageNum = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const offset = (pageNum - 1) * PER_PAGE

  const sql = getSql()
  const rows = await sql`
    select handle, description, external_source
    from agents
    order by external_source nulls first, updated_at desc
    limit ${PER_PAGE} offset ${offset}
  `
  const [{ total }] = await sql`select count(*)::int as total from agents`
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))

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

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ margin: 0 }}>
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Hub
          </a>
        </p>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Agent directory</h1>
        <p style={{ color: '#888', marginTop: 0 }}>
          {total.toLocaleString('en-US')} agents and MCP servers — page {pageNum} of {lastPage}. Browse{' '}
          <a href="/tags" style={link}>
            by tag
          </a>{' '}
          or use the <code>find_agent</code> MCP tool for semantic search.
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
                <td style={{ ...td, color: '#aaa' }}>
                  {(r.description as string).length > 140
                    ? `${(r.description as string).slice(0, 140)}…`
                    : r.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 14.5 }}>
          {pageNum > 1 && (
            <a href={`/agents?page=${pageNum - 1}`} style={{ ...link, marginRight: 16 }}>
              ← Previous
            </a>
          )}
          {pageNum < lastPage && (
            <a href={`/agents?page=${pageNum + 1}`} style={link}>
              Next →
            </a>
          )}
        </p>
      </main>
    </div>
  )
}
