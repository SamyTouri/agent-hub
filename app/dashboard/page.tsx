import { getSql, withTimeout } from '@/lib/db'

// ISR court : le dashboard n'a pas besoin du temps réel strict, et force-dynamic
// écroulait la page (>45 s) quand les crawlers chargent la base (free tier).
export const revalidate = 120

type Row = Record<string, string>

type Data = {
  c: Row
  crawlers24h: string
  parBot: Row[]
  parTool: Row[]
  recents: Row[]
  feedbacks: Row[]
  feedbackTotal: string
  origins: Row[]
}

// Tout le fetch dans un try global : au build (pas de DATABASE_URL) ou si la base
// est saturée, la page rend quand même avec des placeholders au lieu de planter.
async function getData(): Promise<Data | null> {
  try {
    const sql = getSql()
    const [c] = await withTimeout(sql`
      select
        (select count(*) from agents where external_source is null)     as agents_natifs,
        (select count(*) from agents where external_source is not null) as agents_importes,
        (select count(*) from ratings)                                  as notes,
        (select count(*) from activity_log)                             as appels_total,
        (select count(*) from activity_log where created_at > now() - interval '24 hours') as appels_24h,
        (select count(distinct ip_hash) from activity_log
          where created_at > now() - interval '24 hours' and ip_hash is not null) as origines_24h
    `)
    if (!c) return null
    // crawler_hits : best-effort tant que la table n'existe pas partout
    let crawlers24h = '0'
    let parBot: Row[] = []
    try {
      const [cc] = await withTimeout(sql`select count(*)::int as n from crawler_hits where created_at > now() - interval '24 hours'`)
      crawlers24h = String(cc.n)
      parBot = (await withTimeout(sql`
        select bot, count(*)::int as n, max(created_at) as last_seen
        from crawler_hits where created_at > now() - interval '7 days'
        group by bot order by n desc limit 15
      `)) as unknown as Row[]
    } catch {
      /* table absente ou lente : non bloquant */
    }

    const parTool = (await withTimeout(sql`select tool, count(*)::int as n from activity_log group by tool order by n desc`)) as unknown as Row[]
    const recents = (await withTimeout(sql`
      select tool, summary, left(ip_hash, 6) as origin, left(user_agent, 42) as ua, created_at
      from activity_log order by created_at desc limit 25
    `)) as unknown as Row[]
    // Qui se connecte : une ligne par origine distincte (7 j), UA le plus récent
    let origins: Row[] = []
    try {
      origins = (await withTimeout(sql`
        select left(ip_hash, 6) as origin, count(*)::int as n,
               max(created_at) as last_seen,
               left((array_agg(user_agent order by created_at desc))[1], 60) as ua
        from activity_log
        where created_at > now() - interval '7 days' and ip_hash is not null
        group by 1 order by max(created_at) desc limit 12
      `)) as unknown as Row[]
    } catch {
      /* non bloquant */
    }
    // feedback : best-effort tant que la table n'existe pas partout
    let feedbacks: Row[] = []
    let feedbackTotal = '0'
    try {
      feedbacks = (await withTimeout(sql`
        select category, message, looking_for, found_it, agent_handle, left(ip_hash, 6) as origin, created_at
        from feedback order by created_at desc limit 20
      `)) as unknown as Row[]
      const [fc] = await withTimeout(sql`select count(*)::int as n from feedback`)
      feedbackTotal = String(fc.n)
    } catch {
      /* table absente : non bloquant */
    }
    return { c: c as unknown as Row, crawlers24h, parBot, parTool, recents, feedbacks, feedbackTotal, origins }
  } catch {
    return null
  }
}

const GREEN = '#4ade80'
const WRITE_TOOLS = new Set(['register_agent', 'submit_rating', 'give_feedback'])
const CATEGORY_LABELS: Record<string, string> = {
  why_i_came: 'pourquoi je suis venu',
  what_blocked_me: 'ce qui m’a bloqué',
  suggestion: 'suggestion',
  bug: 'bug',
  missing_data: 'donnée manquante',
  other: 'autre',
}

export default async function Dashboard() {
  const data = await getData()
  const c: Row =
    data?.c ??
    ({ agents_natifs: '—', agents_importes: '—', notes: '—', appels_total: '—', appels_24h: '—', origines_24h: '—' } as Row)
  const crawlers24h = data?.crawlers24h ?? '—'
  const parBot = data?.parBot ?? []
  const parTool = data?.parTool ?? []
  const recents = data?.recents ?? []
  const feedbacks = data?.feedbacks ?? []
  const feedbackTotal = data?.feedbackTotal ?? '—'
  const origins = data?.origins ?? []

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 900,
    margin: '0 auto',
    padding: '3rem 1rem',
    color: '#eaeaea',
    background: '#0a0a0a',
    minHeight: '100vh',
  } as const
  const tile = {
    padding: '1rem 1.25rem',
    borderRadius: 12,
    background: '#111',
    border: '1px solid #262626',
    minWidth: 130,
  } as const
  const num = { fontSize: 28, fontWeight: 700, margin: 0 } as const
  const lbl = { fontSize: 13, color: '#888', margin: '4px 0 0' } as const
  const td = { padding: '7px 4px', borderBottom: '1px solid #1e1e1e' } as const
  const live = (v: string) => ({ ...num, color: v !== '—' && v !== '0' ? GREEN : '#eaeaea' })

  const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <h1 style={{ marginBottom: 4 }}>Agent Hub — activité</h1>
        <p style={{ color: '#888', marginTop: 0 }}>
          Dernières 24 h : <strong style={{ color: '#eaeaea' }}>{c.appels_24h}</strong> appels d’agents (
          <strong style={{ color: '#eaeaea' }}>{c.origines_24h}</strong> origines) ·{' '}
          <strong style={{ color: '#eaeaea' }}>{crawlers24h}</strong> pages crawlées ·{' '}
          <strong style={{ color: feedbackTotal !== '0' && feedbackTotal !== '—' ? GREEN : '#eaeaea' }}>{feedbackTotal}</strong>{' '}
          feedbacks reçus au total.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '1.5rem 0' }}>
          <div style={tile}><p style={live(String(c.appels_24h))}>{c.appels_24h}</p><p style={lbl}>appels (24h)</p></div>
          <div style={tile}><p style={live(String(c.origines_24h))}>{c.origines_24h}</p><p style={lbl}>origines (24h)</p></div>
          <div style={tile}><p style={live(feedbackTotal)}>{feedbackTotal}</p><p style={lbl}>feedbacks</p></div>
          <div style={tile}><p style={num}>{c.agents_natifs}</p><p style={lbl}>agents inscrits</p></div>
          <div style={tile}><p style={num}>{c.notes}</p><p style={lbl}>notes déposées</p></div>
          <div style={tile}><p style={num}>{c.agents_importes}</p><p style={lbl}>agents importés</p></div>
          <div style={tile}><p style={num}>{crawlers24h}</p><p style={lbl}>hits crawlers (24h)</p></div>
        </div>

        <h2 style={{ fontSize: 18 }}>Feedback des agents</h2>
        {feedbacks.length === 0 && (
          <p style={{ color: '#666', fontSize: 14 }}>
            Aucun feedback pour l’instant — le canal est ouvert (tool <code>give_feedback</code> + <code>POST /api/feedback</code>,
            invitations sur toutes les pages). Dès qu’un agent parle, son message apparaît ici.
          </p>
        )}
        {feedbacks.map((f, i) => (
          <div
            key={i}
            style={{
              background: '#111',
              border: '1px solid #262626',
              borderLeft: `3px solid ${GREEN}`,
              borderRadius: 10,
              padding: '0.8rem 1rem',
              marginBottom: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{f.message}</p>
            {(f.looking_for || f.found_it != null) && (
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#aaa' }}>
                {f.looking_for && <>cherchait : {f.looking_for}</>}
                {f.found_it != null && (
                  <span style={{ color: String(f.found_it) === 'true' ? GREEN : '#f87171' }}>
                    {f.looking_for ? ' — ' : ''}{String(f.found_it) === 'true' ? 'trouvé' : 'pas trouvé'}
                  </span>
                )}
              </p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#666' }}>
              <span style={{ color: '#888' }}>{CATEGORY_LABELS[f.category] ?? f.category}</span>
              {' · '}
              {f.agent_handle ?? <code>{f.origin ?? 'anonyme'}</code>}
              {' · '}
              {fmtDate(f.created_at)}
            </p>
          </div>
        ))}

        <h2 style={{ fontSize: 18, marginTop: '2.25rem' }}>Qui se connecte (7 jours)</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
          <tbody>
            {origins.map((o) => (
              <tr key={o.origin}>
                <td style={td}><code>{o.origin}</code></td>
                <td style={{ ...td, textAlign: 'right' }}>{o.n} appel{Number(o.n) > 1 ? 's' : ''}</td>
                <td style={{ ...td, color: '#888', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.ua ?? '—'}</td>
                <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDate(o.last_seen)}</td>
              </tr>
            ))}
            {origins.length === 0 && (
              <tr><td style={{ ...td, color: '#666' }}>aucune origine identifiée sur 7 jours</td></tr>
            )}
          </tbody>
        </table>

        {parBot.length > 0 && (
          <>
            <h2 style={{ fontSize: 18 }}>Crawlers (7 jours)</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
              <tbody>
                {parBot.map((r) => (
                  <tr key={r.bot}>
                    <td style={td}><code>{r.bot}</code></td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.n}</td>
                    <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtDate(r.last_seen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 style={{ fontSize: 18 }}>Par outil</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
          <tbody>
            {parTool.map((r) => (
              <tr key={r.tool}>
                <td style={td}><code style={WRITE_TOOLS.has(r.tool) ? { color: GREEN } : undefined}>{r.tool}</code></td>
                <td style={{ ...td, textAlign: 'right' }}>{r.n}</td>
              </tr>
            ))}
            {parTool.length === 0 && (
              <tr><td style={{ ...td, color: '#666' }}>aucun appel pour l&apos;instant</td></tr>
            )}
          </tbody>
        </table>

        <h2 style={{ fontSize: 18 }}>Derniers appels</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {recents.map((r, i) => (
              <tr key={i}>
                <td style={td}><code style={WRITE_TOOLS.has(r.tool) ? { color: GREEN } : undefined}>{r.tool}</code></td>
                <td style={{ ...td, color: '#aaa' }}>{r.summary}</td>
                <td style={{ ...td, color: '#888', whiteSpace: 'nowrap' }}><code>{r.origin ?? '—'}</code></td>
                <td style={{ ...td, color: '#666', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.ua ?? ''}
                </td>
                <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {fmtDate(r.created_at)}
                </td>
              </tr>
            ))}
            {recents.length === 0 && (
              <tr><td style={{ ...td, color: '#666' }}>rien encore — l&apos;activité apparaîtra ici</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
