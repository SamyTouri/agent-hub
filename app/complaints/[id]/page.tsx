import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BUREAU_METHOD } from '@/lib/complaints'
import { getPublishedFiling, type PublicFiling } from '@/lib/complaints-store'

// Un dossier public = UN fait daté sur UNE transaction. Jamais un verdict, jamais
// un agrégat, jamais une note. La réponse de la contrepartie est liée en
// permanence, et les corrections sont datées plutôt que silencieuses.
//
// Rien ici ne lit un dossier non publié : la fonction de lecture filtre elle-même
// sur l'état publié, pour qu'une erreur de rendu ne puisse pas exposer un dépôt en
// cours de vérification.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}
export const dynamicParams = true

const BASE = 'https://agentreputation.dev'

type Params = Promise<{ id: string }>

const BASIS_LABEL: Record<string, string> = {
  payment_reached_payee: 'The payment reached the payee',
  terminal_onchain_state: 'The exchange reached a terminal on-chain state',
  frozen_past_deadline: 'The funds have not moved past the deadline the seller announced',
}

const EVENT_LABEL: Record<PublicFiling['events'][number]['kind'], string> = {
  notification_attempt: 'Notification',
  reply: 'Reply from the counterparty',
  correction: 'Correction',
  publication: 'Publication',
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = (await params).id
  return {
    title: `Complaint file ${id} — Agent Reputation`,
    description:
      'One dated complaint about one transaction, entered by a proven party, with the counterparty reply permanently linked.',
    alternates: { canonical: `/complaints/${id}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `Complaint file ${id} — Agent Reputation`,
      description: 'A dated fact about one transaction, with the counterparty reply attached.',
      url: `${BASE}/complaints/${id}`,
      siteName: 'Agent Reputation',
      type: 'article',
    },
  }
}

export default async function ComplaintFilePage({ params }: { params: Params }) {
  const id = (await params).id
  // Volontairement SANS try/catch : convention du dépôt — une revalidation qui échoue
  // doit THROW pour que Next continue de servir la version précédente. Avaler l'erreur
  // ici transformerait une base injoignable en « ce dossier n'existe pas », ce qui est
  // faux et, sur un registre de plaintes, précisément le mensonge à ne pas produire.
  const filing: PublicFiling | null = await getPublishedFiling(id)
  if (!filing) notFound()

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
  const h2 = { fontSize: 20, marginTop: '2.25rem', marginBottom: '0.6rem' } as const
  const card = {
    background: '#101010',
    border: '1px solid #292929',
    borderRadius: 12,
    padding: '1rem 1.15rem',
  } as const
  const mono = { fontFamily: 'ui-monospace, monospace', fontSize: 13.5 } as const
  const td = { padding: '7px 6px', borderBottom: '1px solid #1e1e1e', verticalAlign: 'top' } as const

  const replies = filing.events.filter((e) => e.kind === 'reply')
  const corrections = filing.events.filter((e) => e.kind === 'correction')
  const others = filing.events.filter((e) => e.kind !== 'reply' && e.kind !== 'correction')

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ margin: 0 }}>
          <a href="/complaints" style={{ ...link, fontSize: 13.5 }}>
            ← Complaint Bureau
          </a>{' '}
          <a href="/" style={{ ...link, fontSize: 13.5, marginLeft: 12 }}>
            Agent Reputation
          </a>
        </p>

        <p style={{ ...mono, color: '#888', margin: '0.75rem 0 0' }}>{filing.id}</p>
        <h1 style={{ fontSize: 28, lineHeight: 1.25, margin: '0.2rem 0 0.4rem' }}>
          {filing.subjectLabel}
        </h1>
        <p style={{ ...muted, marginTop: 0 }}>
          Filed by the <strong style={{ color: '#eaeaea' }}>{filing.claimantRole}</strong> of one
          transaction on {filing.createdAt.slice(0, 10)}, published {filing.publishedAt.slice(0, 10)}.
          This is a dated statement by a proven party — not a verdict, a rating or a finding of fault.
        </p>

        <h2 style={h2}>The transaction</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14.5 }}>
          <tbody>
            <tr>
              <td style={{ ...td, color: '#888', width: 190 }}>Network</td>
              <td style={{ ...td, ...mono }}>{filing.network}</td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>Reference</td>
              <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>
                {filing.matterUrl ? (
                  <a href={filing.matterUrl} style={link} rel="nofollow noopener noreferrer">
                    {filing.matterReference}
                  </a>
                ) : (
                  filing.matterReference
                )}
              </td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>Claimant address</td>
              <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>{filing.claimantAddress}</td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>Counterparty address</td>
              <td style={{ ...td, ...mono, wordBreak: 'break-all' }}>{filing.counterpartyAddress}</td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>Why it is settled</td>
              <td style={td}>
                {BASIS_LABEL[filing.settledBasis] ?? filing.settledBasis}
                {filing.terminalState ? ` — ${filing.terminalState}` : ''}
                {filing.announcedDeadline ? ` — announced deadline ${filing.announcedDeadline}` : ''}
              </td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>How anyone confirms it</td>
              <td style={td}>{filing.settledEvidence}</td>
            </tr>
            <tr>
              <td style={{ ...td, color: '#888' }}>Reply window given</td>
              <td style={td}>
                {filing.replyWindowHours === 0
                  ? 'None — no verifiable channel was found for the counterparty.'
                  : `${filing.replyWindowHours} hour(s), closing ${filing.replyDeadline.slice(0, 16).replace('T', ' ')} UTC`}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>The claimant&apos;s account</h2>
        <div style={{ ...card, whiteSpace: 'pre-wrap' }}>{filing.account}</div>
        <p style={{ ...mono, color: '#666', marginTop: '0.6rem', wordBreak: 'break-all' }}>
          account_digest: {filing.accountDigest}
        </p>
        <p style={{ ...muted, fontSize: 14 }}>
          The signature that opened this file covers that digest, so the account above is the one
          that was signed. Its truth is not something we verified — {BUREAU_METHOD.what_we_never_verify}
        </p>

        <h2 style={h2}>The counterparty&apos;s reply</h2>
        {replies.length === 0 && filing.pendingReplies === 0 ? (
          <p style={{ color: '#888' }}>
            None on the record. The reply channel stays open permanently and for free: a reply
            arriving today is appended to this file rather than refused.
          </p>
        ) : null}
        {filing.pendingReplies > 0 && (
          <p
            style={{
              ...card,
              borderColor: '#5c4a2a',
              color: '#e8d5a8',
              margin: '0 0 0.9rem',
              fontSize: 14.5,
            }}
          >
            {filing.pendingReplies} signed repl
            {filing.pendingReplies > 1 ? 'ies have' : 'y has'} been received and{' '}
            {filing.pendingReplies > 1 ? 'are' : 'is'} being read before being rendered here. It is
            recorded rather than hidden, so silence and an answer are never shown as the same thing.
          </p>
        )}
        {replies.map((r) => (
          <div key={r.occurredAt} style={{ ...card, borderColor: '#315d4a', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              {r.occurredAt.slice(0, 10)}
              {r.actorAddress ? ` · signed by ${r.actorAddress}` : ''}
            </p>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{r.body}</div>
          </div>
        ))}

        {others.length > 0 && (
          <>
            <h2 style={h2}>Record of the process</h2>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {others.map((e) => (
                <li key={`${e.kind}-${e.occurredAt}`} style={{ ...card, marginBottom: 10, fontSize: 14.5 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                    {e.occurredAt.slice(0, 10)} · {EVENT_LABEL[e.kind]}
                    {e.channel ? ` · ${e.channel}` : ''}
                  </p>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 6, ...muted }}>{e.body}</div>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 style={h2}>Corrections</h2>
        {corrections.length === 0 ? (
          <p style={{ color: '#888' }}>
            None. {BUREAU_METHOD.corrections}
          </p>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {corrections.map((c) => (
              <li key={c.occurredAt} style={{ ...card, borderColor: '#5c3a3a', marginBottom: 10, fontSize: 14.5 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{c.occurredAt.slice(0, 10)}</p>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{c.body}</div>
              </li>
            ))}
          </ul>
        )}

        <p style={{ ...mono, color: '#8a8a8a', marginTop: '2rem', fontSize: 13 }} data-machine-verdict>
          SOURCE: Agent Reputation (agentreputation.dev/complaints/{filing.id}) — one dated complaint
          about one transaction, entered by a party that proved control of one of its two addresses.
          No verdict, no score, no aggregate.
        </p>

        <p style={{ marginTop: '1.5rem', color: '#666', fontSize: 13.5 }}>
          Are you the counterparty? Replying is free, unconditional and permanent:{' '}
          <a href="/api/complaints/reply" style={link}>
            /api/complaints/reply
          </a>
          . Read the method and the eligibility rules on the{' '}
          <a href="/complaints" style={link}>
            Complaint Bureau page
          </a>
          .
        </p>
      </main>
    </div>
  )
}
