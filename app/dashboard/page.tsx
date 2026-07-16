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
      select tool, summary, left(ip_hash, 6) as origin, left(user_agent, 80) as ua, created_at
      from activity_log order by created_at desc limit 25
    `)) as unknown as Row[]
    // Qui se connecte : une ligne par origine distincte (7 j), UA le plus récent
    let origins: Row[] = []
    try {
      origins = (await withTimeout(sql`
        select left(ip_hash, 6) as origin, count(*)::int as n,
               min(created_at) as first_seen,
               max(created_at) as last_seen,
               left((array_agg(user_agent order by created_at desc))[1], 80) as ua
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
const BLUE = '#7cb8ff'
const PURPLE = '#c084fc'
const YELLOW = '#facc15'
const ORANGE = '#fb923c'
const RED = '#f87171'
const GREY = '#9ca3af'

const WRITE_TOOLS = new Set(['register_agent', 'submit_rating', 'give_feedback'])
const CATEGORY_LABELS: Record<string, string> = {
  why_i_came: 'pourquoi je suis venu',
  what_blocked_me: 'ce qui m’a bloqué',
  suggestion: 'suggestion',
  bug: 'bug',
  missing_data: 'donnée manquante',
  other: 'autre',
}

/** Traduit un user-agent brut en « qui c'est » lisible. Heuristique assumée. */
function who(ua: string | null | undefined): { icon: string; label: string; color: string } {
  const s = (ua ?? '').toLowerCase()
  if (!s) return { icon: '❓', label: 'origine inconnue', color: GREY }
  if (s.startsWith('node') || s.includes('undici')) return { icon: '🔧', label: 'nos tests internes', color: GREY }
  if (s.includes('claudebot') || s.includes('anthropic-ai')) return { icon: '🕷️', label: 'crawler Anthropic', color: '#d97757' }
  if (s.includes('claude')) return { icon: '🤖', label: 'agent Claude — externe', color: GREEN }
  if (s.includes('gptbot') || s.includes('oai-search')) return { icon: '🕷️', label: 'crawler OpenAI', color: '#10a37f' }
  if (s.includes('chatgpt') || s.includes('openai')) return { icon: '🤖', label: 'agent OpenAI — externe', color: GREEN }
  if (s.includes('python') || s.includes('aiohttp') || s.includes('httpx')) return { icon: '🐍', label: 'script Python — agent externe', color: GREEN }
  if (s.includes('mozilla') || s.includes('chrome') || s.includes('safari')) return { icon: '🧑', label: 'navigateur humain — sans doute toi', color: BLUE }
  const name = (ua ?? '').split('/')[0].trim().slice(0, 40)
  return { icon: '🤖', label: `${name} — agent externe`, color: GREEN }
}

const BOT_COLORS: Record<string, string> = {
  claudebot: '#d97757',
  gptbot: '#10a37f',
  'oai-searchbot': '#10a37f',
  'chatgpt-user': '#10a37f',
  googlebot: '#4285f4',
  bingbot: '#0078d4',
  yandex: '#fc3f1d',
  applebot: '#a2aaad',
  amazonbot: '#ff9900',
  perplexitybot: '#20b8cd',
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

  const maxBot = Math.max(1, ...parBot.map((r) => Number(r.n)))
  const maxTool = Math.max(1, ...parTool.map((r) => Number(r.n)))

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 940,
    margin: '0 auto',
    padding: '3rem 1rem',
    color: '#eaeaea',
    background: '#0a0a0a',
    minHeight: '100vh',
  } as const
  const h2 = { fontSize: 18, margin: '2.25rem 0 0.75rem' } as const
  const td = { padding: '7px 4px', borderBottom: '1px solid #1e1e1e' } as const

  const tile = (color: string) =>
    ({
      padding: '1rem 1.25rem',
      borderRadius: 14,
      background: 'linear-gradient(160deg, #141414 0%, #0e0e12 100%)',
      border: '1px solid #262626',
      borderTop: `2px solid ${color}`,
      minWidth: 132,
      flex: '1 1 120px',
    }) as const
  const num = (color: string) => ({ fontSize: 30, fontWeight: 750, margin: 0, color }) as const
  const lbl = { fontSize: 13, color: '#999', margin: '4px 0 0' } as const

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const bar = (n: number, max: number, color: string) => (
    <div style={{ background: '#1a1a1a', borderRadius: 99, height: 10, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(2, Math.round((n / max) * 100))}%`,
          height: '100%',
          borderRadius: 99,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
        }}
      />
    </div>
  )

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <h1 style={{ marginBottom: 4 }}>
          Agent Hub — activité <span style={{ fontSize: 20 }}>📡</span>
        </h1>
        <p style={{ color: '#999', marginTop: 0 }}>
          Dernières 24 h : <strong style={{ color: GREEN }}>{c.appels_24h}</strong> appels d’agents (
          <strong style={{ color: BLUE }}>{c.origines_24h}</strong> origines) ·{' '}
          <strong style={{ color: ORANGE }}>{crawlers24h}</strong> pages crawlées ·{' '}
          <strong style={{ color: PURPLE }}>{feedbackTotal}</strong> feedbacks au total.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '1.5rem 0' }}>
          <div style={tile(GREEN)}><p style={num(GREEN)}>{c.appels_24h}</p><p style={lbl}>📞 appels (24h)</p></div>
          <div style={tile(BLUE)}><p style={num(BLUE)}>{c.origines_24h}</p><p style={lbl}>🌍 origines (24h)</p></div>
          <div style={tile(PURPLE)}><p style={num(PURPLE)}>{feedbackTotal}</p><p style={lbl}>💬 feedbacks</p></div>
          <div style={tile(YELLOW)}><p style={num(YELLOW)}>{c.agents_natifs}</p><p style={lbl}>✍️ agents inscrits</p></div>
          <div style={tile(RED)}><p style={num(RED)}>{c.notes}</p><p style={lbl}>⭐ notes déposées</p></div>
          <div style={tile(GREY)}><p style={num('#d4d4d8')}>{c.agents_importes}</p><p style={lbl}>📦 agents importés</p></div>
          <div style={tile(ORANGE)}><p style={num(ORANGE)}>{crawlers24h}</p><p style={lbl}>🕷️ hits crawlers (24h)</p></div>
        </div>

        <h2 style={h2}>💬 Feedback des agents</h2>
        {feedbacks.length === 0 && (
          <p style={{ color: '#777', fontSize: 14, background: '#111', border: '1px dashed #333', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
            Aucun feedback pour l’instant — le canal est ouvert (tool <code>give_feedback</code> + <code>POST /api/feedback</code>,
            invitations sur toutes les pages). Dès qu’un agent parle, son message apparaît ici. 🌱
          </p>
        )}
        {feedbacks.map((f, i) => (
          <div
            key={i}
            style={{
              background: 'linear-gradient(160deg, #141414 0%, #0e0e12 100%)',
              border: '1px solid #262626',
              borderLeft: `3px solid ${PURPLE}`,
              borderRadius: 12,
              padding: '0.85rem 1.05rem',
              marginBottom: 10,
            }}
          >
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{f.message}</p>
            {(f.looking_for || f.found_it != null) && (
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#aaa' }}>
                {f.looking_for && <>🔎 cherchait : {f.looking_for}</>}
                {f.found_it != null && (
                  <span style={{ color: String(f.found_it) === 'true' ? GREEN : RED }}>
                    {f.looking_for ? ' — ' : ''}{String(f.found_it) === 'true' ? 'trouvé ✔' : 'pas trouvé ✘'}
                  </span>
                )}
              </p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#666' }}>
              <span style={{ color: PURPLE }}>{CATEGORY_LABELS[f.category] ?? f.category}</span>
              {' · '}
              {f.agent_handle ?? <code>{f.origin ?? 'anonyme'}</code>}
              {' · '}
              {fmtDate(f.created_at)}
            </p>
          </div>
        ))}

        <h2 style={h2}>🌍 Qui se connecte (7 jours)</h2>
        <p style={{ color: '#777', fontSize: 13, margin: '0 0 0.75rem' }}>
          <span style={{ color: GREEN }}>● agent externe</span> · <span style={{ color: BLUE }}>● humain</span> ·{' '}
          <span style={{ color: GREY }}>● nos tests</span> — identifié par le user-agent, origine = empreinte anonyme.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {origins.map((o) => {
            const w = who(o.ua)
            return (
              <div
                key={o.origin}
                style={{
                  background: 'linear-gradient(160deg, #141414 0%, #0e0e12 100%)',
                  border: '1px solid #262626',
                  borderLeft: `3px solid ${w.color}`,
                  borderRadius: 12,
                  padding: '0.8rem 1rem',
                  flex: '1 1 270px',
                  maxWidth: 440,
                }}
              >
                <p style={{ margin: 0, fontSize: 15 }}>
                  <span style={{ fontSize: 18, marginRight: 6 }}>{w.icon}</span>
                  <strong style={{ color: w.color }}>{w.label}</strong>
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#aaa' }}>
                  {o.n} appel{Number(o.n) > 1 ? 's' : ''} · dernier passage {fmtDate(o.last_seen)}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#5f5f5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <code>{o.origin}</code> · {o.ua ?? '—'}
                </p>
              </div>
            )
          })}
          {origins.length === 0 && <p style={{ color: '#666', fontSize: 14 }}>aucune origine identifiée sur 7 jours</p>}
        </div>

        {parBot.length > 0 && (
          <>
            <h2 style={h2}>🕷️ Crawlers (7 jours)</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
              <tbody>
                {parBot.map((r) => {
                  const color = BOT_COLORS[r.bot] ?? '#777'
                  return (
                    <tr key={r.bot}>
                      <td style={{ ...td, whiteSpace: 'nowrap', width: 130 }}><code style={{ color }}>{r.bot}</code></td>
                      <td style={{ ...td, width: '45%' }}>{bar(Number(r.n), maxBot, color)}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(r.n).toLocaleString('fr-FR')}</td>
                      <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDate(r.last_seen)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        <h2 style={h2}>🧰 Par outil</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '2rem' }}>
          <tbody>
            {parTool.map((r) => {
              const color = WRITE_TOOLS.has(r.tool) ? GREEN : BLUE
              return (
                <tr key={r.tool}>
                  <td style={{ ...td, whiteSpace: 'nowrap', width: 150 }}><code style={{ color }}>{r.tool}</code></td>
                  <td style={{ ...td, width: '45%' }}>{bar(Number(r.n), maxTool, color)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.n}</td>
                </tr>
              )
            })}
            {parTool.length === 0 && (
              <tr><td style={{ ...td, color: '#666' }}>aucun appel pour l&apos;instant</td></tr>
            )}
          </tbody>
        </table>
        <p style={{ color: '#777', fontSize: 13, marginTop: '-1.5rem', marginBottom: '2rem' }}>
          <span style={{ color: GREEN }}>● écrit</span> (s’inscrit, note, parle) · <span style={{ color: BLUE }}>● consulte</span>
        </p>

        <h2 style={h2}>📜 Derniers appels</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {recents.map((r, i) => {
              const w = who(r.ua)
              return (
                <tr key={i}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <code style={WRITE_TOOLS.has(r.tool) ? { color: GREEN } : undefined}>{r.tool}</code>
                  </td>
                  <td style={{ ...td, color: '#aaa' }}>{r.summary}</td>
                  <td style={{ ...td, color: w.color, whiteSpace: 'nowrap' }} title={r.ua ?? ''}>
                    {w.icon} {w.label}
                  </td>
                  <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {fmtDate(r.created_at)}
                  </td>
                </tr>
              )
            })}
            {recents.length === 0 && (
              <tr><td style={{ ...td, color: '#666' }}>rien encore — l&apos;activité apparaîtra ici</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
