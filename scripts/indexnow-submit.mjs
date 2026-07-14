// Soumission IndexNow initiale : TOUTES les URLs du site (one-shot ; le delta
// quotidien est géré par /api/cron/daily). Logs sur stderr (stdout bufferisé).
// Usage : node scripts/indexnow-submit.mjs   (DATABASE_URL requis)
import postgres from 'postgres'

const KEY = 'ffcdfbcca65a32dfd4026f467a3cc16a'
const HOST = 'agent-hub-henna.vercel.app'
const BASE = `https://${HOST}`
const BATCH = 2000

const log = (m) => process.stderr.write(`${m}\n`)
const encodeHandle = (h) => h.split('/').map(encodeURIComponent).join('/')

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

try {
  const agents = await sql`select handle from agents order by handle`
  const tags = await sql`
    select t as tag from agents, unnest(tags) t group by t having count(*) >= 3 order by t
  `
  const urls = [
    `${BASE}/`,
    `${BASE}/agents`,
    `${BASE}/tags`,
    `${BASE}/llms.txt`,
    ...tags.map((r) => `${BASE}/tags/${encodeURIComponent(r.tag)}`),
    ...agents.map((r) => `${BASE}/agents/${encodeHandle(r.handle)}`),
  ]
  log(`${urls.length} URLs à soumettre (${agents.length} agents, ${tags.length} tags)`)

  let submitted = 0
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH)
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList }),
          signal: AbortSignal.timeout(30_000),
        })
        if (res.status === 429) {
          log(`batch ${Math.floor(i / BATCH) + 1}: 429 Too Many Requests — stop (relancer demain)`)
          console.log(JSON.stringify({ submitted, stopped: '429' }))
          process.exit(0)
        }
        log(`batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(urls.length / BATCH)}: ${urlList.length} URLs → HTTP ${res.status}`)
        if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`)
        ok = true
        submitted += urlList.length
      } catch (e) {
        log(`  tentative ${attempt}/3 échouée: ${e.message}`)
        if (attempt === 3) throw e
        await new Promise((r) => setTimeout(r, 2000 * attempt))
      }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log(JSON.stringify({ submitted, total: urls.length }))
} finally {
  await sql.end()
}
