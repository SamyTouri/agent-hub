import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Row = Record<string, string>

export default async function Dashboard() {
  const sql = getSql()
  const [c] = await sql`
    select
      (select count(*) from agents where external_source is null)     as agents_natifs,
      (select count(*) from agents where external_source is not null) as agents_importes,
      (select count(*) from ratings)                                  as notes,
      (select count(*) from activity_log)                             as appels_total,
      (select count(*) from activity_log where created_at > now() - interval '24 hours') as appels_24h
  `
  const parTool = (await sql`select tool, count(*)::int as n from activity_log group by tool order by n desc`) as unknown as Row[]
  const recents = (await sql`select tool, summary, created_at from activity_log order by created_at desc limit 25`) as unknown as Row[]

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
          <div style={tile}><p style={num}>{c.agents_natifs}</p><p style={lbl}>agents inscrits</p></div>
          <div style={tile}><p style={num}>{c.notes}</p><p style={lbl}>notes déposées</p></div>
          <div style={tile}><p style={num}>{c.agents_importes}</p><p style={lbl}>agents importés</p></div>
        </div>

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
