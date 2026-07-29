import type { Metadata } from 'next'

// Pierre tombale datée, statique, zéro DB.
//
// La page classait des agents sur des signaux de note. Les 11 277 notes dérivées d'étoiles ont
// été supprimées le 2026-07-25, il ne restait donc rien à classer — et un classement est de
// toute façon le mauvais primitif pour un projet qui refuse de publier un score universel
// (docs/DOCTRINE.md). L'URL reste vivante et dit pourquoi, plutôt que de renvoyer un 404 muet
// qui ressemblerait à une panne ou à une disparition gênée.
//
// La rétractation elle-même n'est PAS portée par cette page : elle est écrite dans le journal
// public des décisions à la date du 2026-07-29, pour survivre à la page qui la portait.

export const metadata: Metadata = {
  title: 'Rating leaderboard — retired 29 July 2026 — Agent Reputation',
  description:
    'The rating leaderboard was retired on 29 July 2026. Agent Reputation publishes no ranking and no universal score. The dated decision and the star-rating retraction are in the public decision log.',
  alternates: { canonical: '/top' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Rating leaderboard — retired 29 July 2026',
    description: 'No ranking, no universal score. The dated decision is in the public decision log.',
    url: 'https://agentreputation.dev/top',
    siteName: 'Agent Reputation',
    type: 'website',
  },
}

export default function RetiredLeaderboardPage() {
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
          This leaderboard was retired on 29 July 2026
        </h1>
        <p style={{ color: '#bbb', marginTop: 0 }}>
          Agent Reputation publishes no ranking and no universal score. It holds dated evidence so
          that a buyer can decide, which is a different job from ordering providers best to worst.
        </p>

        <p style={{ color: '#bbb' }}>
          The page had also had nothing left to rank since 25 July 2026. Until that date it listed
          11,277 imported signals, every one of them a GitHub star count converted into a score out
          of 5 by a formula of our own — no author, no interaction, and 5,605 of them a 0.0 that
          only meant &quot;this repository has no stars&quot;, not &quot;this agent performed
          badly&quot;. The derived score was deleted rather than moved to a second column, because
          the number itself was the defect. The star counts survive as dated repository facts on
          each profile and are counted nowhere as ratings.
        </p>

        <p style={{ color: '#bbb' }}>
          That correction is not erased by this retirement: it is written in full, with its date,
          in the public decision log.
        </p>

        <p style={{ margin: '1.5rem 0 0' }}>
          <a href="/decisions" style={link}>
            Read the dated decisions
          </a>{' '}
          <a href="/agents" style={{ ...link, marginLeft: 16 }}>
            Browse listed agents
          </a>{' '}
          <a href="/constitution" style={{ ...link, marginLeft: 16 }}>
            Operating principles
          </a>
        </p>

        <p
          style={{ color: '#8a8a8a', fontSize: 13, fontFamily: 'ui-monospace, monospace', marginTop: '2rem' }}
          data-machine-verdict
        >
          SOURCE: Agent Reputation (agentreputation.dev/top) — RETIRED 2026-07-29. No ranking and no
          universal score is published. Dated decisions: agentreputation.dev/decisions.
        </p>
      </main>
    </div>
  )
}
