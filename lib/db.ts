import postgres from 'postgres'

type Sql = ReturnType<typeof postgres>

let _sql: Sql | null = null

/**
 * Client Postgres partagé (singleton) vers Supabase via le pooler transaction (port 6543).
 * - prepare:false requis en mode transaction pooling
 * - max:1 : une fonction serverless = une connexion réutilisée entre invocations chaudes
 * DATABASE_URL attendu : postgresql://postgres.<ref>:<pwd>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
 */
export function getSql(): Sql {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL manquant (pooler transaction Supabase)')
  _sql = postgres(url, {
    prepare: false,
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Annule réellement côté Postgres. Promise.race seul rendrait la main mais
    // laisserait la requête occuper l'unique connexion et grossir la file.
    connection: { statement_timeout: 10_000, lock_timeout: 5_000 },
  })
  return _sql
}

/**
 * Borne une requête de page dans le temps : sous charge (vague de crawlers), une
 * requête qui pend ne doit jamais bloquer un render ISR ni un prerender de build
 * au-delà de quelques secondes — on préfère le fallback de la page.
 */
export function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  const clientAtStart = _sql
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      // Promise.race ne cancelle pas une requête postgres.js : elle continuerait à
      // bloquer max:1 et toutes les requêtes suivantes pourraient mourir à 300 s.
      // On détruit ce client et le prochain appel repart sur une connexion saine.
      if (_sql === clientAtStart) _sql = null
      if (clientAtStart) void clientAtStart.end({ timeout: 0.1 }).catch(() => {})
      reject(new Error(`db timeout ${ms}ms; connection reset`))
    }, ms)

    p.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        // Connexion morte (CONNECTION_ENDED/CLOSED, reset réseau) : sans reset, le
        // client mort reste le singleton et toutes les requêtes suivantes de la
        // lambda chaude échouent en boucle — l'ISR ne se répare jamais (incident
        // /dashboard 18/07). On jette le client ; le prochain appel reconnecte.
        const code = (error as { code?: string })?.code ?? ''
        if (/^CONNECTION_|^ECONNRESET$|^EPIPE$/.test(code)) {
          if (_sql === clientAtStart) _sql = null
          if (clientAtStart) void clientAtStart.end({ timeout: 0.1 }).catch(() => {})
        }
        reject(error)
      },
    )
  })
}
