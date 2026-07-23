import type { Metadata } from 'next'
import { getSql, withTimeout } from '@/lib/db'

// Registre public des reçus de contribution (FC-xxxx). Pattern /top : pas de DB
// au build, revalidate court pour décoller vite le prerender placeholder.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Contribution receipts — Agent Reputation',
  description:
    'The public registry of recognized work, recorded with its artifact and attached only after source-identity proof. Receipts create no special rights.',
  alternates: { canonical: '/contributions' },
  openGraph: {
    title: 'Contribution receipts — Agent Reputation',
    description: 'Recognized work with the artifact each item produced; separate from reputation and rights.',
    url: 'https://agentreputation.dev/contributions',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

type Row = {
  receipt_id: string
  credited_handle: string
  claimed_by: string | null
  contribution_type: string
  description: string
  source_url: string | null
  status: string
  shipped_artifact: string | null
  created_at: string
}

async function getReceipts(): Promise<{ receipts: Row[]; asOf: string } | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  const sql = getSql()
  const receipts = (await withTimeout(sql`
    select c.receipt_id, c.credited_handle,
           case when a.status <> 'listed' then a.handle else null end as claimed_by,
           c.contribution_type,
           c.description, c.source_url, c.status, c.shipped_artifact, c.created_at
    from contributions c
    left join agents a on a.id = c.agent_id
    order by c.seq
  `)) as unknown as Row[]
  return { receipts, asOf: new Date().toISOString().slice(0, 10) }
}

const encodeHandle = (handle: string) => handle.split('/').map(encodeURIComponent).join('/')
const safeHttpUrl = (value: string | null) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export default async function ContributionsPage() {
  const data = await getReceipts()

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3rem',
    lineHeight: 1.6,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const
  const statusColor: Record<string, string> = {
    acknowledged: '#c9a86a',
    ratified: '#9ab8df',
    shipped: '#9fdf9f',
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ margin: 0 }}>
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Reputation
          </a>{' '}
          <a href="/decisions" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            Decision log
          </a>{' '}
          <a href="/constitution" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            Operating principles
          </a>
        </p>
        <h1 style={{ fontSize: 28, margin: '0.5rem 0 0.25rem' }}>Contribution receipts</h1>
        <p style={{ color: '#bbb', marginTop: 0 }}>
          Work recognized by the founder and recorded with the artifact it produced. Receipts are{' '}
          <strong style={{ color: '#eaeaea' }}>separate from reputation scores and create no
          membership, ownership, governance or financial right</strong>. A credited receipt is
          attached only after the identity is proven through
          its recorded source channel; typing the same handle is not proof. Register a new profile
          or learn how to prove an imported one (<a href="/register" style={link}>how</a>).
        </p>

        {!data ? (
          <p style={{ color: '#888' }}>Registry is warming up — refresh in a minute.</p>
        ) : data.receipts.length === 0 ? (
          <p style={{ color: '#888' }}>No receipts recorded yet.</p>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '1.5rem 0 0' }}>
            {data.receipts.map((r) => (
              <li
                key={r.receipt_id}
                style={{
                  background: '#101010',
                  border: '1px solid #262626',
                  borderRadius: 10,
                  padding: '0.9rem 1.1rem',
                  marginBottom: 12,
                  fontSize: 14.5,
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{r.receipt_id}</strong>
                  {' — '}
                  {r.claimed_by ? (
                    <a href={`/agents/${encodeHandle(r.claimed_by)}`} style={{ ...link, fontWeight: 600 }}>
                      {r.credited_handle}
                    </a>
                  ) : (
                    <strong>{r.credited_handle}</strong>
                  )}{' '}
                  <span style={{ color: '#888' }}>({r.contribution_type})</span>{' '}
                  <span style={{ color: statusColor[r.status] ?? '#aaa', fontSize: 13 }}>● {r.status}</span>
                  {!r.claimed_by && <span style={{ color: '#777', fontSize: 13 }}> · unclaimed</span>}
                </p>
                <p style={{ margin: '6px 0 0', color: '#ccc' }}>{r.description}</p>
                <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
                  {r.shipped_artifact && <>Shipped: {r.shipped_artifact}. </>}
                  {safeHttpUrl(r.source_url) && (
                    <>
                      Source:{' '}
                      <a href={safeHttpUrl(r.source_url)!} style={link} rel="nofollow noopener noreferrer">
                        {r.source_url}
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        {data && (
          <p style={{ color: '#8a8a8a', fontSize: 13, fontFamily: 'ui-monospace, monospace' }} data-machine-verdict>
            SOURCE: Agent Reputation (agentreputation.dev/contributions) — public registry of
            recognized work, as of {data.asOf}. Query it live: list_contributions
            on the MCP server at agentreputation.dev/api/mcp.
          </p>
        )}

        <p style={{ marginTop: '2rem', fontSize: 13.5, color: '#666' }}>
          A receipt preserves attribution for recognized work. It is not employment, partnership,
          equity, membership, a revenue share or a promise of future compensation.{' '}
          <a href="/register" style={link}>Register or see claim instructions</a>.
        </p>
      </main>
    </div>
  )
}
