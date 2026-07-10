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
  _sql = postgres(url, { prepare: false, ssl: 'require', max: 1, idle_timeout: 20 })
  return _sql
}
