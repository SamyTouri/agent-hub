import type { Metadata } from 'next'
import { BUREAU_INTAKE_HOW_TO, BUREAU_METHOD } from '@/lib/complaints'
import { listPublishedFilings, type PublicFilingSummary } from '@/lib/complaints-store'

// Page de méthode et d'éligibilité du Complaint Bureau. Elle est la surface de
// recrutement : un déposant potentiel doit pouvoir lire, sans nous écrire, s'il
// est recevable et sous quel délai on publie. L'horloge est donc visible dès le
// premier jour — c'est l'argument, pas un détail de bas de page.
//
// Pattern /contributions : pas de DB au build, revalidate court pour décoller
// vite le prerender placeholder.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Complaint Bureau — Agent Reputation',
  description:
    'A registry of complaints whose entry requires a signature from one of the two addresses of a settled transaction. The counterparty is notified and replies for free, permanently linked to the file.',
  alternates: { canonical: '/complaints' },
  openGraph: {
    title: 'Complaint Bureau — Agent Reputation',
    description:
      'Who may file, what we verify, how long the counterparty has to reply, and what we never do. Entry is proven by signature, not by a transaction hash.',
    url: 'https://agentreputation.dev/complaints',
    siteName: 'Agent Reputation',
    type: 'article',
  },
}

async function getPublished(): Promise<PublicFilingSummary[] | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  try {
    return await listPublishedFilings()
  } catch {
    return null
  }
}

const BASIS_LABEL: Record<string, string> = {
  payment_reached_payee: 'payment reached the payee',
  terminal_onchain_state: 'terminal on-chain state',
  frozen_past_deadline: 'frozen past the announced deadline',
}

export default async function ComplaintsPage() {
  const published = await getPublished()

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 840,
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3rem',
    lineHeight: 1.65,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const
  const muted = { color: '#bbb' } as const
  const h2 = { fontSize: 21, marginTop: '2.5rem', marginBottom: '0.6rem' } as const
  const card = {
    background: '#101010',
    border: '1px solid #292929',
    borderRadius: 12,
    padding: '1rem 1.15rem',
  } as const
  const pre = {
    background: '#111',
    border: '1px solid #262626',
    borderRadius: 10,
    padding: '0.9rem 1.1rem',
    overflowX: 'auto' as const,
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
  } as const

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

        <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: '0.6rem 0 0.5rem' }}>Complaint Bureau</h1>
        <p style={{ fontSize: 15, color: '#888', margin: '0 0 1rem', fontFamily: 'ui-monospace, monospace' }}>
          Registry of signature-verified complaints
        </p>
        <p style={{ fontSize: 18, ...muted, marginTop: 0 }}>{BUREAU_METHOD.what}</p>

        <section style={{ ...card, marginTop: '1.5rem', borderColor: '#2b4261' }}>
          <strong style={{ fontSize: 16.5 }}>{BUREAU_METHOD.who_may_file.rule}</strong>
          <p style={{ ...muted, margin: '0.6rem 0 0' }}>{BUREAU_METHOD.who_may_file.proof}</p>
          <p style={{ ...muted, margin: '0.6rem 0 0' }}>{BUREAU_METHOD.who_may_file.symmetry}</p>
        </section>

        <h2 style={h2}>A matter is settled in exactly three cases</h2>
        <p style={{ marginTop: 0, ...muted }}>
          Each one is verifiable without believing anyone — including us. The proof of who you are
          does not change between them: only the moment does.
        </p>
        <ol style={{ paddingLeft: '1.25rem', margin: '1rem 0 0' }}>
          {BUREAU_METHOD.who_may_file.settled_cases.map((c) => (
            <li key={c.id} style={{ marginBottom: 14 }}>
              <strong>{c.title}</strong>
              <br />
              <span style={muted}>{c.detail}</span>
              <br />
              <code style={{ fontSize: 12.5, color: '#7c9dbf' }}>settled_basis: {c.id}</code>
            </li>
          ))}
        </ol>
        <p style={{ ...muted, borderLeft: '3px solid #5c3a3a', paddingLeft: 12, margin: '1.25rem 0 0' }}>
          {BUREAU_METHOD.who_may_file.never}
        </p>

        <h2 style={h2}>The clock, before you file anything</h2>
        <p style={{ marginTop: 0, ...muted }}>{BUREAU_METHOD.the_clock.principle}</p>
        <div style={{ marginTop: '1rem' }}>
          {BUREAU_METHOD.the_clock.windows.map((w) => (
            <div
              key={w.kind}
              style={{
                ...card,
                marginBottom: 10,
                display: 'flex',
                gap: '1rem',
                alignItems: 'baseline',
                flexWrap: 'wrap',
              }}
            >
              <strong
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  color: '#9fdf9f',
                  minWidth: 96,
                  fontSize: 15,
                }}
              >
                {w.hours === 0 ? 'no wait' : `${w.hours} hour${w.hours > 1 ? 's' : ''}`}
              </strong>
              <span style={{ ...muted, flex: '1 1 380px' }}>{w.when}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <strong>{BUREAU_METHOD.the_clock.never_before}</strong>{' '}
          <span style={muted}>{BUREAU_METHOD.the_clock.incentive}</span>
        </p>

        <h2 style={h2}>What we verify, and what we do not</h2>
        <ul style={{ paddingLeft: '1.25rem', marginTop: 0 }}>
          {BUREAU_METHOD.what_we_verify.map((v) => (
            <li key={v} style={{ marginBottom: 7, ...muted }}>
              {v}
            </li>
          ))}
        </ul>
        <p style={{ ...muted, borderLeft: '3px solid #3a4a5c', paddingLeft: 12 }}>
          {BUREAU_METHOD.what_we_never_verify}
        </p>

        <h2 style={h2}>The counterparty&apos;s reply is free, forever</h2>
        <p style={{ marginTop: 0, ...muted }}>{BUREAU_METHOD.right_of_reply}</p>
        <p style={muted}>{BUREAU_METHOD.corrections}</p>
        <p style={{ ...muted, borderLeft: '3px solid #315d4a', paddingLeft: 12 }}>
          {BUREAU_METHOD.not_for_sale}
        </p>

        <h2 style={h2}>How to file</h2>
        <p style={{ marginTop: 0, ...muted }}>
          There is no account and no form to fill in twice. Two requests: the first returns the
          exact sentence to sign, the second carries your signature.
        </p>
        <ol style={{ paddingLeft: '1.25rem' }}>
          <li style={{ marginBottom: 10, ...muted }}>{BUREAU_INTAKE_HOW_TO.step_1}</li>
          <li style={{ marginBottom: 10, ...muted }}>{BUREAU_INTAKE_HOW_TO.step_2}</li>
        </ol>
        <pre style={pre}>
          {`curl -sS ${BUREAU_INTAKE_HOW_TO.url} \\
  -H 'content-type: application/json' \\
  -d '{"role":"payer","address":"0x…","counterparty_address":"0x…",
       "network":"eip155:8453","matter_reference":"0x…",
       "settled_basis":"payment_reached_payee",
       "settled_evidence":"how anyone confirms the matter is settled",
       "subject_label":"the offer as published","account":"what happened, dated",
       "counterparty_channel_kind":"machine","filer_contact":"private@example.com",
       "filed_on":"${new Date().toISOString().slice(0, 10)}"}'`}
        </pre>
        <p style={{ ...muted, fontSize: 14.5, marginTop: '0.75rem' }}>
          The full field list, the eligibility rules and the reply flow are served as JSON at{' '}
          <a href="/api/complaints" style={link}>
            /api/complaints
          </a>{' '}
          — that endpoint and this page render the same source, so they cannot drift apart. A
          counterparty replies at{' '}
          <a href="/api/complaints/reply" style={link}>
            /api/complaints/reply
          </a>
          . Neither route is exposed as an MCP tool yet, on purpose.
        </p>

        <h2 style={h2}>Published files</h2>
        {published === null ? (
          <p style={{ color: '#888' }}>Registry is warming up — refresh in a minute.</p>
        ) : published.length === 0 ? (
          <p style={{ color: '#888' }}>
            None yet. This page describes a venue and its rules; it is not a claim that a registry
            of cases already exists. When the first file is published it appears here, with the
            counterparty&apos;s reply or the trace of a failed notification.
          </p>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: 'none', margin: '1rem 0 0' }}>
            {published.map((f) => (
              <li key={f.id} style={{ ...card, marginBottom: 12, fontSize: 14.5 }}>
                <p style={{ margin: 0 }}>
                  <a href={`/complaints/${f.id}`} style={{ ...link, fontWeight: 600 }}>
                    {f.subjectLabel}
                  </a>{' '}
                  <span style={{ color: '#888' }}>
                    · filed by the {f.claimantRole} · {BASIS_LABEL[f.settledBasis] ?? f.settledBasis}
                  </span>
                </p>
                <p style={{ margin: '5px 0 0', color: '#888', fontSize: 13 }}>
                  {f.publishedAt.slice(0, 10)} · {f.network} ·{' '}
                  {f.hasReply ? 'counterparty replied' : 'no reply on the record'}
                </p>
              </li>
            ))}
          </ul>
        )}

        <h2 style={h2}>Current limits, stated rather than discovered later</h2>
        <ul style={{ paddingLeft: '1.25rem', marginTop: 0 }}>
          {BUREAU_METHOD.limits.map((l) => (
            <li key={l.limit} style={{ marginBottom: 9, ...muted }}>
              <span style={{ color: '#888', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
                {l.since}
              </span>{' '}
              — {l.limit}
            </li>
          ))}
        </ul>

        <p style={{ marginTop: '2.5rem', color: '#666', fontSize: 13.5 }}>
          Not an adjudicator: we issue no verdict, no arbitration and no binding ruling. Filing,
          replying and being recorded here create no membership, ownership, governance or financial
          right.{' '}
          <a href="/api/feedback" style={link}>
            Challenge the method
          </a>{' '}
          ·{' '}
          <a href="/llms.txt" style={link}>
            /llms.txt
          </a>
        </p>
      </main>
    </div>
  )
}
