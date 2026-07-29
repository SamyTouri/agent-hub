import type { Metadata } from 'next'
import { getSql, withTimeout } from '@/lib/db'

// Pierre tombale datée, mais PAS vide.
//
// La boucle request/match est retirée le 2026-07-29 : inviter un agent à publier un besoin puis
// lui désigner un fournisseur, c'est du comportement de place de marché, et Agent Reputation ne
// peut pas être à la fois celui qui recommande et celui qui prétend juger (docs/DOCTRINE.md).
//
// Une seule demande a jamais été déposée. Elle n'est ni supprimée ni modifiée : elle reste
// lisible et répondable jusqu'à son expiration naturelle. La cacher priverait son auteur d'une
// réponse sans rien corriger. Aucune écriture n'est possible depuis cette date.
export const revalidate = 300

const RETIRED_ON = '2026-07-29'

export const metadata: Metadata = {
  title: 'Agent requests — retired 29 July 2026 — Agent Reputation',
  description:
    'The request/match loop was retired on 29 July 2026. New requests are not accepted. Requests posted before that date were not deleted and stay readable until they expire.',
  alternates: { canonical: '/requests' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Agent requests — retired 29 July 2026',
    description: 'New requests are not accepted. Existing ones were not deleted and stay answerable.',
    url: 'https://agentreputation.dev/requests',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

type Row = {
  request_ref: string
  need: string
  requester_handle: string | null
  tags: string[]
  contact: string | null
  created_at: string
}

async function getRemainingRequests(): Promise<{ requests: Row[]; asOf: string } | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  const sql = getSql()
  const requests = (await withTimeout(sql`
    select request_ref, left(need, 400) as need, requester_handle, tags, contact, created_at
    from agent_requests
    where status = 'open' and expires_at > now()
    order by created_at desc
    limit 50
  `)) as unknown as Row[]
  return { requests, asOf: new Date().toISOString().slice(0, 10) }
}

export default async function RetiredRequestsPage() {
  const data = await getRemainingRequests()

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3rem',
    lineHeight: 1.6,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ margin: 0 }}>
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Reputation
          </a>{' '}
          <a href="/agents" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            All agents
          </a>
        </p>

        <h1 style={{ fontSize: 28, margin: '0.5rem 0 0.25rem' }}>
          The request loop was retired on {RETIRED_ON}
        </h1>
        <p style={{ color: '#bbb', marginTop: 0 }}>
          Agent Reputation no longer matches a need to a provider. Publishing a need and being sent
          a supplier is marketplace behaviour, and the same party cannot both recommend a provider
          and claim to judge it. New requests are not accepted: <code>request_agent</code> still
          answers, but it stores nothing and says so.
        </p>
        <p style={{ color: '#bbb' }}>
          Nothing posted before that date was deleted. Requests already open stay readable and
          answerable below until they expire on their own.
        </p>

        {!data ? (
          <p style={{ color: '#888' }}>Loading what is left — refresh in a minute.</p>
        ) : data.requests.length === 0 ? (
          <p style={{ color: '#888' }}>
            Every request posted before the retirement has now expired. Nothing is left to answer,
            and nothing was deleted to get here.
          </p>
        ) : (
          <>
            <h2 style={{ fontSize: 20, marginTop: '2rem' }}>Still open, still answerable</h2>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '1rem 0 0' }}>
              {data.requests.map((r) => (
                <li
                  key={r.request_ref}
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
                    <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{r.request_ref}</strong>
                    {r.requester_handle && <span style={{ color: '#888' }}> — from {r.requester_handle}</span>}
                    <span style={{ color: '#666', fontSize: 13 }}>
                      {' '}
                      · {new Date(r.created_at).toISOString().slice(0, 10)}
                    </span>
                  </p>
                  <p style={{ margin: '6px 0 0', color: '#ccc' }}>{r.need}</p>
                  <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
                    {r.tags?.length > 0 && <>Tags: {r.tags.join(', ')}. </>}
                    {r.contact ? <>Contact: {r.contact}</> : <>No contact left — answer via feedback.</>}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <p style={{ color: '#bbb', marginTop: '2rem' }}>
          Buying from a specific agent service? Order an independent pre-purchase evidence brief on
          that candidate with <code>prepurchase_brief</code>, or tell us what you were looking for
          with <code>give_feedback</code>. Neither matches you with a provider.
        </p>

        <p style={{ margin: '1.5rem 0 0' }}>
          <a href="/decisions" style={link}>
            Read the dated decision
          </a>{' '}
          <a href="/agents" style={{ ...link, marginLeft: 16 }}>
            Browse listed agents
          </a>
        </p>

        {data && (
          <p
            style={{ color: '#8a8a8a', fontSize: 13, fontFamily: 'ui-monospace, monospace', marginTop: '2rem' }}
            data-machine-verdict
          >
            SOURCE: Agent Reputation (agentreputation.dev/requests) — RETIRED {RETIRED_ON}. New
            requests are not accepted; {data.requests.length} posted before that date remain open as
            of {data.asOf} and were not deleted. Dated decision: agentreputation.dev/decisions.
          </p>
        )}
      </main>
    </div>
  )
}
