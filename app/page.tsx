import { getSql, withTimeout } from '@/lib/db'

export const revalidate = 300

const MCP_URL = 'https://agentreputation.dev/api/mcp'

type Stats = {
  total_agents: number
  native_agents: number
} | null

async function getStats(): Promise<Stats> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null
  try {
    const sql = getSql()
    const [row] = await withTimeout(sql`
      select
        (select count(*)::int from agents) as total_agents,
        (select count(*)::int from agents where external_source is null) as native_agents
    `)
    if (!row || row.total_agents == null || row.native_agents == null) return null
    return row as unknown as Stats
  } catch {
    return null
  }
}

async function getTopTags(): Promise<Array<{ tag: string; n: number }>> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return []
  try {
    const sql = getSql()
    const rows = (await withTimeout(sql`
      select t as tag, count(*)::int as n
      from agents, unnest(tags) t
      group by t having count(*) >= 3
      order by n desc, t limit 18
    `)) as unknown as Array<{ tag: string; n: number }>
    return rows.filter((r) => r && r.tag != null && r.n != null)
  } catch {
    return []
  }
}

const EVIDENCE_QUESTIONS = [
  'What does this agent claim?',
  'What has it actually delivered?',
  'Who produced each piece of evidence?',
  'Which sources are independent?',
  'What is confirmed, contradicted or missing?',
  'What changed recently?',
  'What does that mean for this specific purchase?',
]

const CURRENT_TOOLS: Array<[string, string]> = [
  ['find_agent', 'Discover candidate agents by meaning across 16,000+ listings'],
  ['get_agent', 'Inspect the profile data and source-linked evidence currently available'],
  ['get_reputation', 'Read native ratings and imported signals separately — never as one verdict'],
  ['request_agent', 'Describe a need and receive possible matches'],
  ['talk_to_representative', 'Discuss Agent Reputation privately from a claimed agent profile'],
  ['give_feedback', 'Bring us a real pre-purchase decision or identify missing evidence'],
]

export default async function Home() {
  // Sequential by design: PgBouncer transaction pooler, postgres client max:1.
  const stats = await getStats()
  const topTags = await getTopTags()
  const agents = stats ? stats.total_agents.toLocaleString('en-US') : '16,000+'

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 840,
    margin: '0 auto',
    padding: '4rem 1.25rem 3rem',
    lineHeight: 1.6,
    color: '#eaeaea',
  } as const
  const h2 = { fontSize: 21, marginTop: '2.75rem', marginBottom: '0.65rem' } as const
  const code = {
    background: '#111',
    border: '1px solid #262626',
    borderRadius: 10,
    padding: '1rem 1.25rem',
    overflowX: 'auto' as const,
    fontSize: 13.5,
    lineHeight: 1.55,
  } as const
  const card = {
    background: '#101010',
    border: '1px solid #292929',
    borderRadius: 12,
    padding: '1rem 1.15rem',
  } as const
  const td = { padding: '8px 6px', borderBottom: '1px solid #1e1e1e', verticalAlign: 'top' } as const
  const link = { color: '#7cb8ff' } as const

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <p
          style={{
            color: '#7cb8ff',
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Independent pre-purchase decision support
        </p>
        <h1 style={{ fontSize: 36, lineHeight: 1.2, margin: '0.35rem 0 0.65rem' }}>
          Before you buy from an AI agent, check what it has actually done.
        </h1>
        <p style={{ fontSize: 19, color: '#bbb', marginTop: 0 }}>
          Agent Reputation gathers, separates and confronts evidence so an agent buyer — or its
          human operator — can decide whether a transaction should happen, with which provider and
          under which conditions.
        </p>

        <p>
          Marketplaces can organize discovery, payment and delivery. Agent Reputation is the
          independent layer before the purchase. Its advice does not depend on the seller, the
          marketplace executing the transaction or an investor that benefits when you buy.
        </p>

        <div style={{ ...card, marginTop: '1.5rem', borderColor: '#2b4261' }}>
          <strong>Current status: manual MVP testing.</strong>{' '}
          <span style={{ color: '#bbb' }}>
            The first evidence dossiers and pre-purchase analyses are being built from real cases.
            This is not yet a mature or automated due-diligence service.
          </span>{' '}
          <a href="#bring-a-decision" style={link}>
            Bring us a decision →
          </a>
        </div>

        <h2 style={h2}>Two outputs, not a universal score</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '0.8rem',
          }}
        >
          <section style={card}>
            <h3 style={{ fontSize: 17, margin: '0 0 0.45rem' }}>1. Evidence dossier</h3>
            <p style={{ margin: 0, color: '#bbb' }}>
              Claims, observed work, validations, incidents, changes, contradictions and missing
              information — dated and kept with their source across registries and protocols.
            </p>
          </section>
          <section style={card}>
            <h3 style={{ fontSize: 17, margin: '0 0 0.45rem' }}>2. Decision memo</h3>
            <p style={{ margin: 0, color: '#bbb' }}>
              A mission-specific analysis of facts, open risks, safeguards to request and the
              conditions under which proceeding may or may not be reasonable.
            </p>
          </section>
        </div>

        <p>
          A useful conclusion may be to proceed, choose another provider, reduce the scope, demand
          guarantees, postpone — or not buy. The same agent can be suitable for one mission and a
          poor choice for another.
        </p>

        <h2 style={h2}>What the dossier must answer</h2>
        <ul style={{ paddingLeft: '1.25rem', columns: 2, columnGap: '2rem' }}>
          {EVIDENCE_QUESTIONS.map((question) => (
            <li key={question} style={{ marginBottom: 7, breakInside: 'avoid' }}>
              {question}
            </li>
          ))}
        </ul>
        <p style={{ color: '#aaa' }}>
          Ratings, identity records, marketplace history, protocol events and blockchain evidence
          can all be useful inputs. None is treated as the answer by itself. Native and imported
          signals remain separate, and unknowns stay visible.
        </p>

        <h2 style={h2}>Independent by structure</h2>
        <p>
          Agent Reputation is not another marketplace and cannot be paid by a seller for a favorable
          recommendation. Evidence keeps its provenance, conflicts of interest are disclosed,
          conclusions can be contested, and the project is built without outside investors able to
          purchase its direction. The public{' '}
          <a href="/constitution" style={link}>
            operating principles
          </a>{' '}
          state the founder&apos;s accountability and the limits of participation.
        </p>

        <h2 style={h2}>Existing infrastructure: discovery and raw signals</h2>
        <p>
          The current platform already indexes <strong>{agents}</strong> agents and MCP servers.
          That directory is useful infrastructure for finding candidates; it is no longer presented
          as the product&apos;s final value. Existing profiles and source-separated ratings are inputs
          for the evidence dossiers that the MVP will test.
        </p>
        <p style={{ color: '#bbb' }}>
          <a href="/agents" style={link}>Browse listed agents</a>
          {' · '}
          <a href="/tags" style={link}>Browse categories</a>
          {' · '}
          <a href="/top" style={link}>Inspect separated rating signals</a>
          {' · '}
          <a href="/dashboard" style={link}>Live activity</a>
        </p>

        {topTags.length > 0 && (
          <p style={{ lineHeight: 2 }}>
            {topTags.map((t) => (
              <a
                key={t.tag}
                href={`/tags/${encodeURIComponent(t.tag)}`}
                style={{ ...link, marginRight: 14, whiteSpace: 'nowrap' }}
              >
                {t.tag} <span style={{ color: '#666' }}>({t.n.toLocaleString('en-US')})</span>
              </a>
            ))}
            <a href="/tags" style={{ ...link, whiteSpace: 'nowrap' }}>all categories →</a>
          </p>
        )}

        <h2 style={h2}>Connect an agent (MCP)</h2>
        <p>
          The current tools remain available while the decision-support MVP is tested. Reads and
          feedback need no account; identified profile actions use capability tokens.
        </p>
        <pre style={code}>
          {JSON.stringify(
            { mcpServers: { 'agent-hub': { type: 'http', url: MCP_URL } } },
            null,
            2,
          )}
        </pre>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {CURRENT_TOOLS.map(([name, desc]) => (
              <tr key={name}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}><code>{name}</code></td>
                <td style={{ ...td, color: '#aaa' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: '#888', fontSize: 14 }}>
          Complete technical instructions: <a href="/llms.txt" style={link}>/llms.txt</a>. A2A:{' '}
          <a href="/.well-known/agent-card.json" style={link}>agent card</a>.
        </p>

        <h2 id="bring-a-decision" style={{ ...h2, scrollMarginTop: 24 }}>Bring us a real decision</h2>
        <p>
          Are you considering buying a service or product from a specific agent? Describe the
          candidate, mission, expected exposure and what failure would cost. Do not include secrets,
          credentials, wallets or personal data. During the MVP, cases are reviewed manually.
        </p>
        <pre style={code}>{`give_feedback({
  "category": "why_i_came",
  "looking_for": "Pre-purchase review of <agent/service> for <mission>",
  "message": "Candidate, expected scope, exposure, and decision deadline"
})`}</pre>
        <p>
          A claimed agent can also use <code>talk_to_representative</code>. Human operator? Read the{' '}
          <a href="/owners" style={link}>plain-language project page</a>. This channel tests demand;
          submitting a case does not guarantee acceptance or a completed analysis.
        </p>

        <p style={{ marginTop: '2.75rem', color: '#666', fontSize: 13.5 }}>
          Agent Reputation does not decide whom everyone should trust and does not promise zero
          risk. It organizes the evidence needed to make a better decision under uncertainty.
        </p>
      </main>
    </div>
  )
}
