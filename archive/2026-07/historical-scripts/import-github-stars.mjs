// Importe les stars GitHub des serveurs du registre MCP comme FAIT DE DÉPÔT daté.
// Écrit uniquement agents.metadata : { repo, github_stars, github_stars_at }.
//
// N'ÉCRIT PLUS AUCUNE NOTE — décision produit du 2026-07-25 publiée sur /decisions.
// Le script convertissait auparavant un compteur d'étoiles en note sur 5
// (min(5, log10(stars+1) * 1.25)) : une formule inventée par nous, sans auteur, dans la
// colonne qu'un lecteur interprète comme de la fiabilité. Le score dérivé a été supprimé,
// pas déplacé ; le fait brut survit, daté et attribué à GitHub. Une contrainte en base
// (ratings_no_derived_source) refuse désormais toute note de source 'github-stars'.
//
// Env requis : DATABASE_URL (pooler). GITHUB_TOKEN (PAT lecture repos publics) requis
// seulement pour la phase stars : sans lui, le script persiste le mapping name→repo
// en DB (agents.metadata.repo) et s'arrête — le run suivant saute le fetch registre.
// Idempotent : chaque run rafraîchit le compteur et sa date d'observation.
import postgres from 'postgres'

const { DATABASE_URL, GITHUB_TOKEN } = process.env
if (!DATABASE_URL) { console.error('MISSING_ENV'); process.exit(1) }

const sql = postgres(DATABASE_URL, { prepare: false, ssl: 'require', max: 4 })

// fetch avec timeout 30s + 3 tentatives : node fetch n'a PAS de timeout par défaut
// (un hang du registre a suspendu le script indéfiniment au premier run).
// Logs de progression sur stderr : non bufferisé, visible en direct.
async function fetchRetry(url, options = {}, tries = 3) {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) })
      if (res.ok || t >= tries) return res
    } catch (e) {
      if (t >= tries) throw e
    }
    console.error(`retry ${t} ${String(url).slice(0, 80)}`)
    await new Promise((r) => setTimeout(r, 2000 * t))
  }
}

// 1. Mapping name -> repo : depuis la DB si déjà persisté, sinon fetch registre + persistance
const repoByName = new Map()
const parseRepo = (url) => {
  const m = url?.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null
}

const cached = await sql`
  select external_id as name, metadata->>'repo' as repo_url
  from agents
  where external_source = 'mcp-registry' and metadata->>'repo' is not null
`
if (cached.length > 5000) {
  for (const r of cached) {
    const parsed = parseRepo(r.repo_url)
    if (parsed) repoByName.set(r.name, parsed)
  }
  console.error(`REGISTRY: ${repoByName.size} repos lus depuis la DB (fetch registre sauté)`)
} else {
  const base = 'https://registry.modelcontextprotocol.io/v0.1/servers'
  let cursor = null, pages = 0
  for (;;) {
    const url = new URL(base)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetchRetry(url)
    if (!res.ok) { console.error('REGISTRY_FETCH_FAIL', res.status, '- on continue avec le partiel'); break }
    const data = await res.json()
    for (const item of data.servers ?? []) {
      const s = item.server
      const meta = item._meta?.['io.modelcontextprotocol.registry/official']
      if (meta?.isLatest === false) continue
      if (meta?.status && meta.status !== 'active') continue
      const parsed = parseRepo(s?.repository?.url)
      if (s?.name && parsed && !repoByName.has(s.name)) repoByName.set(s.name, parsed)
    }
    cursor = data.metadata?.nextCursor
    pages++
    if (pages % 20 === 0) console.error(`... registry ${pages} pages, ${repoByName.size} repos`)
    if (!cursor) break
  }
  console.error(`REGISTRY: ${repoByName.size} serveurs avec repo GitHub (${pages} pages)`)

  // Persistance du mapping en DB (batch) : un futur run saute le fetch registre.
  const list = [...repoByName.entries()].map(([name, { owner, repo }]) => ({ name, url: `https://github.com/${owner}/${repo}` }))
  for (let i = 0; i < list.length; i += 1000) {
    const c = list.slice(i, i + 1000)
    await sql`
      update agents a
      set metadata = a.metadata || jsonb_build_object('repo', v.repo)
      from (select unnest(${c.map((r) => r.name)}::text[]) as name, unnest(${c.map((r) => r.url)}::text[]) as repo) v
      where a.external_source = 'mcp-registry' and a.external_id = v.name
    `
  }
  console.error(`PERSIST: mapping repo écrit en DB (${list.length})`)
}

if (!GITHUB_TOKEN) {
  console.error('NO_TOKEN: mapping persisté ; relancer avec GITHUB_TOKEN pour importer les stars.')
  await sql.end({ timeout: 5 })
  process.exit(0)
}

// 2. Stars par batch GraphQL (100 aliases/requête)
const entries = [...repoByName.entries()]
const starsByName = new Map()
const BATCH = 100
for (let i = 0; i < entries.length; i += BATCH) {
  const chunk = entries.slice(i, i + BATCH)
  const q = chunk
    .map(([, { owner, repo }], j) =>
      `r${j}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { stargazerCount }`)
    .join('\n')
  const res = await fetchRetry('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query {\n${q}\n}` }),
  })
  if (res.status === 401 || res.status === 403) { console.error('GITHUB_AUTH_FAIL', res.status); process.exit(1) }
  const data = await res.json()
  chunk.forEach(([name], j) => {
    const count = data.data?.[`r${j}`]?.stargazerCount
    if (typeof count === 'number') starsByName.set(name, count)
  })
  if ((i / BATCH) % 10 === 0) console.error(`... stars ${Math.min(i + BATCH, entries.length)}/${entries.length}`)
}
console.error(`GITHUB: stars récupérées pour ${starsByName.size} repos (repos supprimés/privés ignorés)`)

// 3. Écriture du fait de dépôt sur agents.metadata — en batch (unnest) pour éviter 30k
// allers-retours. Aucune écriture dans `ratings` : un compteur d'étoiles est un fait de
// popularité de dépôt, pas une note d'interaction, et les deux ne se mélangent jamais.
const observedAt = new Date().toISOString()
const all = [...starsByName.entries()].map(([name, stars]) => {
  const { owner, repo } = repoByName.get(name)
  return { name, stars, repo: `https://github.com/${owner}/${repo}` }
})
const CHUNK = 1000
let done = 0
for (let i = 0; i < all.length; i += CHUNK) {
  const c = all.slice(i, i + CHUNK)
  const names = c.map((r) => r.name)
  const repos = c.map((r) => r.repo)
  const stars = c.map((r) => r.stars)
  await sql`
    update agents a
    set metadata = a.metadata || jsonb_build_object(
      'repo', v.repo, 'github_stars', v.stars, 'github_stars_at', ${observedAt}::text)
    from (select unnest(${names}::text[]) as name, unnest(${repos}::text[]) as repo, unnest(${stars}::int[]) as stars) v
    where a.external_source = 'mcp-registry' and a.external_id = v.name
  `
  done += c.length
  console.error(`... upsert ${done}/${all.length}`)
}
const [{ count }] = await sql`
  select count(*) from ratings where source = 'github-stars'
`
if (Number(count) > 0) console.error(`WARNING: ${count} derived star ratings still present — should be 0`)
console.error(`DONE processed=${done} observed_at=${observedAt} derived_ratings=${count}`)
await sql.end({ timeout: 5 })
