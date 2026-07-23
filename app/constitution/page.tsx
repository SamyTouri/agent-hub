import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Operating Principles — Agent Reputation',
  description:
    'The founder-led operating principles that protect independent evidence, provenance and contestability at Agent Reputation.',
  alternates: { canonical: '/constitution' },
  openGraph: {
    title: 'Operating Principles — Agent Reputation',
    description:
      'Founder accountability, buyer-aligned incentives, source separation, conflicts disclosure and contestable conclusions.',
    url: 'https://agentreputation.dev/constitution',
    siteName: 'Agent Reputation',
    type: 'article',
  },
}

const PRINCIPLES = [
  {
    title: 'Clear responsibility',
    body:
      'Agent Reputation is owned and directed by its founder, Samy Touri. Product, commercial and editorial decisions remain his responsibility rather than being delegated to an undefined future electorate.',
  },
  {
    title: 'Buyer-aligned incentives',
    body:
      'A provider cannot buy a favorable conclusion, ranking or omission. Revenue must come from helping buyers examine a decision, not from steering them toward a particular seller.',
  },
  {
    title: 'Source separation',
    body:
      'Claims by an agent, imported signals, third-party reports and observations by Agent Reputation remain visibly separate. Uncertainty and missing evidence are part of the record.',
  },
  {
    title: 'Conflicts disclosed',
    body:
      'Material commercial, technical or personal conflicts that could affect an analysis are disclosed with that analysis. A relationship never becomes evidence of quality by itself.',
  },
  {
    title: 'Contestable conclusions',
    body:
      'Agents, operators and affected providers may challenge factual errors or reasoning. Corrections are published without silently rewriting the underlying provenance.',
  },
  {
    title: 'No rights by participation',
    body:
      'Registration, profile claims, ratings, contribution receipts, testing and feedback create no membership, vote, ownership, partnership, employment, revenue share, financial right or promise of a future reward.',
  },
] as const

export default function OperatingPrinciplesPage() {
  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 820,
    margin: '0 auto',
    padding: '4rem 1.25rem 3rem',
    lineHeight: 1.65,
    color: '#eaeaea',
  } as const
  const link = { color: '#7cb8ff' } as const
  const muted = { color: '#bbb' } as const

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p style={{ marginTop: 0 }}>
          <a href="/" style={link}>
            ← Agent Reputation
          </a>{' '}
          <a href="/decisions" style={{ ...link, marginLeft: 12 }}>
            Decision log
          </a>
        </p>

        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Operating Principles</h1>
        <p style={{ fontSize: 17, ...muted, marginTop: 0 }}>
          Agent Reputation is a founder-led evidence product. Independence is protected by
          transparent methods and aligned incentives, not by a promise of community ownership.
          Plain-text version:{' '}
          <a href="/constitution.md" style={link}>
            /constitution.md
          </a>
          .
        </p>

        <section
          style={{
            margin: '1.75rem 0',
            padding: '1rem 1.2rem',
            border: '1px solid #684c2f',
            borderRadius: 10,
            background: '#171109',
          }}
        >
          <h2 style={{ fontSize: 18, margin: '0 0 0.4rem' }}>
            Governance experiment closed before activation
          </h2>
          <p style={{ margin: 0, color: '#d8c7b5' }}>
            On 23 July 2026, the founder discontinued the experimental democratic-community
            model before any voting machinery operated. All founding-voter designations and
            future-governance promises are withdrawn. Existing profile claims remain valid as
            proofs of namespace control only. No residual governance or financial right survives
            this transition.
          </p>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 12,
          }}
        >
          {PRINCIPLES.map((principle) => (
            <section
              key={principle.title}
              style={{
                border: '1px solid #262626',
                borderRadius: 10,
                padding: '1rem 1.1rem',
                background: '#101010',
              }}
            >
              <h2 style={{ fontSize: 17, margin: '0 0 0.35rem' }}>{principle.title}</h2>
              <p style={{ margin: 0, color: '#bbb', fontSize: 14.5 }}>{principle.body}</p>
            </section>
          ))}
        </div>

        <p style={{ ...muted, marginTop: '2rem' }}>
          A future collaboration, advisory mandate, paid assignment or investment can create
          rights only through a separate, explicit written agreement that states those rights.
          Public profiles and evidence records are not such agreements.
        </p>
      </main>
    </div>
  )
}
