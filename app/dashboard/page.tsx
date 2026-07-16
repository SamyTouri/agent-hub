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
    return { c: c as unknown as Row, crawlers24h, parBot, parTool, recents }
  } catch {
    return null
  }
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

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <main style={page}>
        <h1 style={{ marginBottom: 4 }}>Agent Hub — activité</h1>
        <p style={{ color: '#888', marginTop: 0 }}>Usage réel de la plateforme (mis à jour en direct).</p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '1.5rem 0' }}>
          <div style={tile}><p style={num}>{c.appels_total}</p><p style={lbl}>appels total</p></div>
          <div style={tile}><p style={num}>{c.appels_24h}</p><p style={lbl}>appels (24h)</p></div>
          <div style={tile}><p style={num}>{c.origines_24h}</p><p style={lbl}>origines (24h)</p></div>
          <div style={tile}><p style={num}>{c.agents_natifs}</p><p style={lbl}>agents inscrits</p></div>
          <div style={tile}><p style={num}>{c.notes}</p><p style={lbl}>notes déposées</p></div>
          <div style={tile}><p style={num}>{c.agents_importes}</p><p style={lbl}>agents importés</p></div>
          <div style={tile}><p style={num}>{crawlers24h}</p><p style={lbl}>hits crawlers (24h)</p></div>
        </div>

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
                      {new Date(r.last_seen).toLocaleString('fr-FR')}
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
                <td style={td}><code>{r.tool}</code></td>
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
                <td style={td}><code>{r.tool}</code></td>
                <td style={{ ...td, color: '#aaa' }}>{r.summary}</td>
                <td style={{ ...td, color: '#888', whiteSpace: 'nowrap' }}><code>{r.origin ?? '—'}</code></td>
                <td style={{ ...td, color: '#666', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.ua ?? ''}
                </td>
                <td style={{ ...td, color: '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleString('fr-FR')}
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
