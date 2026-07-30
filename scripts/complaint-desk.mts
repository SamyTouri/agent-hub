#!/usr/bin/env node
// Complaint Bureau — operator desk.
//
// The website can receive a filing and a reply. It can NOT publish, notify, correct or
// reject anything: those verbs exist only here, in a tool that runs on the operator's own
// machine. That separation is deliberate. Publication is the irreversible act of this
// product — a published file is never withdrawn — so it must never be reachable from a
// public HTTP surface, not even accidentally.
//
// Run it through the blind-secret launcher, which never writes the connection string:
//   pwsh -File scripts/with-agenthub-db.ps1 node scripts/complaint-desk.mts <command>
//   pwsh -File scripts/with-agenthub-db.ps1 -Port 5432 node scripts/complaint-desk.mts doctor
//
// Commands
//   doctor                          state of the tables, indexes and grants; counts per status
//   selftest                        exercise the real write paths inside a rolled-back transaction
//   list [--status=<s>]             filings, oldest first, with their clock and pending replies
//   show <id> [--with-contact]      one filing in full, including the exact signed statement
//   verify <id>                     re-check the signature cryptographically, then mark verified
//   notify <id> --channel=<c> --outcome=<sent|failed> [--detail=<text>]
//   publish <id> [--force=<reason>] publish, refusing when the promises are not yet kept
//   reveal-reply <id> [--all]       render a reply that has been read, on the public file
//   correct <id> "<text>"           append a dated correction
//   reject <id> "<reason>"          refuse a filing, with the reason on the record

import { createInterface } from 'node:readline/promises'
import postgres from 'postgres'
import { canonicalFilingStatement, type SignableFiling } from '../lib/complaints.ts'
import { recoverStatementSigner } from '../lib/complaints-signature.ts'

const [, , command, ...rest] = process.argv

const flags = new Map<string, string>()
const positional: string[] = []
for (const arg of rest) {
  const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
  if (match) flags.set(match[1], match[2] ?? 'true')
  else positional.push(arg)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run this through scripts/with-agenthub-db.ps1.')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

// Déclaration de fonction et non const fléchée : TypeScript ne resserre le type après
// `if (!x) die(...)` que pour une fonction déclarée, ce qui évite ensuite une cascade de
// `!` sur des valeurs dont on vient précisément de prouver la présence.
function die(message: string): never {
  console.error(`refused: ${message}`)
  process.exitCode = 1
  throw new ExitSignal()
}
class ExitSignal extends Error {}

const requireId = (): string => {
  const id = positional[0]
  if (!id || !/^cb-[0-9a-f]{20}$/.test(id)) die('expected a filing reference like cb-0123456789abcdef0123')
  return id!
}

async function confirm(question: string): Promise<boolean> {
  if (flags.get('yes') === 'true') return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} [type YES to proceed] `)
  rl.close()
  return answer.trim() === 'YES'
}

const hours = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10

// ---------------------------------------------------------------------------

async function doctor() {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('complaint_filings', 'complaint_events')
    order by table_name
  `
  const names = tables.map((r) => r.table_name as string)
  console.log(`tables present: ${names.length ? names.join(', ') : 'NONE — run the migration first'}`)
  if (names.length < 2) {
    console.log('migration: pwsh -File scripts/with-agenthub-db.ps1 -Port 5432 node scripts/run-sql-file.mjs db/migration-complaint-bureau.sql')
    return
  }

  const indexes = await sql`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename in ('complaint_filings', 'complaint_events')
    order by indexname
  `
  console.log(`indexes: ${indexes.map((r) => r.indexname as string).join(', ')}`)

  const rls = await sql`
    select relname, relrowsecurity from pg_class
    where relname in ('complaint_filings', 'complaint_events')
    order by relname
  `
  for (const r of rls) console.log(`row level security on ${r.relname}: ${r.relrowsecurity}`)

  // Les droits comptent autant que les tables : c'est ce qui garantit qu'un dossier publié
  // ne peut pas être effacé, et que le corps d'un événement ne peut pas être réécrit.
  const grants = await sql`
    select table_name, privilege_type, string_agg(coalesce(column_name, '*'), ',' order by column_name) as cols
    from information_schema.column_privileges
    where table_schema = 'public' and grantee = 'service_role'
      and table_name in ('complaint_filings', 'complaint_events')
      and privilege_type in ('DELETE', 'UPDATE')
    group by table_name, privilege_type
    order by table_name, privilege_type
  `
  if (grants.length === 0) console.log('service_role has no UPDATE or DELETE on either table')
  for (const g of grants) console.log(`service_role ${g.privilege_type} on ${g.table_name}: ${g.cols}`)

  const counts = await sql`
    select status, count(*)::int as n from complaint_filings group by status order by status
  `
  console.log(counts.length === 0 ? 'filings: none yet' : `filings: ${counts.map((c) => `${c.status}=${c.n}`).join(' ')}`)

  const pending = await sql`
    select count(*)::int as n from complaint_events where kind = 'reply' and not visible
  `
  console.log(`replies received and not yet rendered: ${pending[0].n}`)

  const overdue = await sql`
    select count(*)::int as n from complaint_filings
    where status = 'verified' and reply_deadline < now()
  `
  console.log(`verified filings whose reply window has closed (publishable now): ${overdue[0].n}`)
}

/**
 * Exerce pour de vrai les chemins d'écriture — insertion d'un dossier, insertion d'une
 * réponse, rejeu de la même réponse — dans une transaction annulée. C'est le seul moyen
 * de prouver que les contraintes et l'idempotence tiennent en production sans polluer le
 * registre d'un dossier de test qu'on ne pourrait plus supprimer.
 */
async function selftest() {
  const id = 'cb-00000000000000000000'
  let failure: unknown = null
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into complaint_filings (
          id, status, claimant_role, claimant_address, counterparty_address, network,
          matter_reference, settled_basis, settled_evidence, subject_label, account,
          account_digest, signed_statement, signature, counterparty_channel_kind,
          reply_window_hours, reply_deadline, filer_contact
        ) values (
          ${id}, 'received', 'payer',
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          'eip155:8453', '0xselftestselftest', 'payment_reached_payee',
          ${'Self-test row inside a transaction that is always rolled back.'},
          'self-test subject',
          ${'Self-test account of events, long enough to satisfy the minimum length constraint that guards against empty complaints being stored.'},
          ${'0'.repeat(64)}, 'self-test statement', ${`0x${'ab'.repeat(65)}`},
          'machine', 1, now() + interval '1 hour', 'selftest@example.com'
        )
      `
      const digest = '1'.repeat(64)
      const insertReply = () => tx`
        insert into complaint_events (filing_id, kind, actor, actor_address, body, body_digest, visible)
        values (${id}, 'reply', 'counterparty', '0x2222222222222222222222222222222222222222',
                'self-test reply', ${digest}, false)
        on conflict (filing_id, kind, body_digest) do nothing
      `
      await insertReply()
      await insertReply() // le rejeu doit être absorbé, pas dupliqué ni rejeté
      const [{ n }] = await tx`
        select count(*)::int as n from complaint_events where filing_id = ${id} and kind = 'reply'
      `
      if (n !== 1) throw new Error(`replay was not idempotent: ${n} reply rows instead of 1`)

      // Deux événements sans empreinte doivent coexister : c'est ce que l'index total permet.
      await tx`insert into complaint_events (filing_id, kind, actor, body) values (${id}, 'notification_attempt', 'bureau', 'first attempt')`
      await tx`insert into complaint_events (filing_id, kind, actor, body) values (${id}, 'notification_attempt', 'bureau', 'second attempt')`

      await tx`update complaint_events set visible = true where filing_id = ${id} and kind = 'reply'`
      await tx`update complaint_filings set status = 'published', published_at = now() where id = ${id}`

      throw new RollbackSignal()
    })
  } catch (e) {
    if (!(e instanceof RollbackSignal)) failure = e
  }
  if (failure) {
    console.error('selftest FAILED:', failure instanceof Error ? failure.message : failure)
    process.exitCode = 1
    return
  }

  const [{ n }] = await sql`select count(*)::int as n from complaint_filings where id = ${id}`
  if (n !== 0) {
    console.error(`selftest FAILED: the rolled-back row survived (${n} present). Investigate before using this tool.`)
    process.exitCode = 1
    return
  }
  console.log('selftest passed: filing insert, reply insert, replay idempotence, multiple')
  console.log('  unfingerprinted events, reply reveal and publication all work — and the')
  console.log('  transaction left nothing behind.')
}
class RollbackSignal extends Error {}

async function list() {
  const status = flags.get('status')
  const rows = status
    ? await sql`
        select id, status, claimant_role, subject_label, created_at, reply_deadline,
               counterparty_channel_kind, published_at
        from complaint_filings where status = ${status} order by created_at
      `
    : await sql`
        select id, status, claimant_role, subject_label, created_at, reply_deadline,
               counterparty_channel_kind, published_at
        from complaint_filings order by created_at
      `
  if (rows.length === 0) {
    console.log(status ? `no filing with status ${status}` : 'no filing yet')
    return
  }
  for (const r of rows) {
    const [{ n: replies }] = await sql`
      select count(*)::int as n from complaint_events
      where filing_id = ${r.id} and kind = 'reply' and not visible
    `
    const [{ n: notices }] = await sql`
      select count(*)::int as n from complaint_events
      where filing_id = ${r.id} and kind = 'notification_attempt'
    `
    const left = (r.reply_deadline as Date).getTime() - Date.now()
    const clock = left > 0 ? `${hours(left)}h left to reply` : 'reply window closed'
    console.log(`${r.id}  ${String(r.status).padEnd(9)}  filed by ${r.claimant_role}  ${clock}`)
    console.log(`  ${r.subject_label}`)
    console.log(
      `  filed ${(r.created_at as Date).toISOString().slice(0, 16).replace('T', ' ')}` +
        `  channel=${r.counterparty_channel_kind}  notices=${notices}` +
        `  replies awaiting review=${replies}` +
        (r.published_at ? `  published ${(r.published_at as Date).toISOString().slice(0, 10)}` : ''),
    )
  }
}

async function show() {
  const id = requireId()
  const rows = await sql`select * from complaint_filings where id = ${id}`
  const f = rows[0]
  if (!f) die(`no filing with reference ${id}`)

  for (const [key, value] of Object.entries(f!)) {
    if (key === 'filer_contact' && flags.get('with-contact') !== 'true') {
      console.log('filer_contact: (hidden — pass --with-contact to display it)')
      continue
    }
    if (key === 'signed_statement') continue
    console.log(`${key}: ${value instanceof Date ? value.toISOString() : value}`)
  }
  console.log('\n--- exact statement that was signed ---')
  console.log(f!.signed_statement)

  const events = await sql`
    select seq, kind, occurred_at, actor, actor_address, channel, body, visible
    from complaint_events where filing_id = ${id} order by seq
  `
  console.log(`\n--- record (${events.length} event(s)) ---`)
  for (const e of events) {
    console.log(
      `#${e.seq} ${e.kind} by ${e.actor}${e.actor_address ? ` (${e.actor_address})` : ''}` +
        ` at ${(e.occurred_at as Date).toISOString().slice(0, 16).replace('T', ' ')}` +
        `${e.channel ? ` via ${e.channel}` : ''} — ${e.visible ? 'public' : 'NOT rendered publicly'}`,
    )
    console.log(`   ${String(e.body).replace(/\n/g, '\n   ')}`)
  }
}

/**
 * Re-vérifie la signature côté opérateur avant de marquer un dossier vérifié. Le site l'a
 * déjà fait à la réception, mais un opérateur qui publie doit pouvoir le refaire lui-même,
 * exactement comme un tiers le referait : c'est la promesse « vérifiable sans nous croire »
 * appliquée à nous-mêmes.
 */
async function verify() {
  const id = requireId()
  const rows = await sql`
    select status, claimant_address, signed_statement, signature, account, account_digest,
           claimant_role, counterparty_address, network, matter_reference, settled_basis
    from complaint_filings where id = ${id}
  `
  const f = rows[0]
  if (!f) die(`no filing with reference ${id}`)
  if (f!.status !== 'received') die(`filing is ${f!.status}, only a received filing can be verified`)

  const signer = await recoverStatementSigner(f!.signed_statement as string, f!.signature as string)
  if (!signer) die('the stored signature does not verify against the stored statement')
  if (signer !== String(f!.claimant_address).toLowerCase()) {
    die(`the signature recovers to ${signer}, not to the claimant address on record`)
  }

  // La déclaration est reconstruite depuis les champs stockés : si elle diffère de celle
  // conservée, un champ a bougé après signature et le dossier n'est plus celui qui a été signé.
  const signable: SignableFiling = {
    role: f!.claimant_role,
    address: f!.claimant_address,
    counterparty_address: f!.counterparty_address,
    network: f!.network,
    matter_reference: f!.matter_reference,
    settled_basis: f!.settled_basis,
    account: f!.account,
    filed_on: String(f!.signed_statement).match(/filed_on: (\d{4}-\d{2}-\d{2})/)?.[1] ?? '',
  }
  const rebuilt = canonicalFilingStatement(signable)
  if (rebuilt !== f!.signed_statement) {
    die('the statement rebuilt from the stored fields differs from the stored statement — a field changed after signing')
  }

  console.log(`signature verified: ${signer} controls the claimant address`)
  console.log('statement rebuilt from the stored fields matches the signed one, byte for byte')
  if (!(await confirm(`Mark ${id} as verified?`))) return console.log('left as received')
  await sql`update complaint_filings set status = 'verified' where id = ${id}`
  console.log(`${id} is now verified. It will not publish itself — run publish when the window has closed.`)
}

async function notify() {
  const id = requireId()
  const channel = flags.get('channel')
  const outcome = flags.get('outcome')
  if (!channel) die('--channel=<where you contacted the counterparty> is required')
  if (outcome !== 'sent' && outcome !== 'failed') die('--outcome=sent or --outcome=failed is required')

  const rows = await sql`select status from complaint_filings where id = ${id}`
  if (!rows[0]) die(`no filing with reference ${id}`)

  const detail = flags.get('detail') ?? ''
  const body =
    outcome === 'sent'
      ? `Counterparty notified and invited to reply. ${detail}`.trim()
      : `Notification could not be delivered. ${detail}`.trim()
  await sql`
    insert into complaint_events (filing_id, kind, actor, channel, body, visible)
    values (${id}, 'notification_attempt', 'bureau', ${channel}, ${body}, true)
  `
  console.log(`recorded on ${id}: notification ${outcome} via ${channel}`)
  if (outcome === 'failed') {
    console.log('A failed notification is published with the file: having no working contact')
    console.log('channel while taking payment is itself a fact about a seller.')
  }
}

/**
 * Publier est l'acte irréversible du produit. Les refus ci-dessous ne sont pas de la
 * prudence de confort : chacun correspond à une promesse écrite sur la page publique.
 */
async function publish() {
  const id = requireId()
  const rows = await sql`
    select status, reply_deadline, reply_window_hours, counterparty_channel_kind
    from complaint_filings where id = ${id}
  `
  const f = rows[0]
  if (!f) die(`no filing with reference ${id}`)
  if (f!.status === 'published') die('already published — a published file is corrected, never republished')
  if (f!.status === 'rejected') die('this filing was rejected')
  if (f!.status !== 'verified') die('verify the filing first: publishing an unverified signature would break the entry rule')

  const [{ n: notices }] = await sql`
    select count(*)::int as n from complaint_events
    where filing_id = ${id} and kind = 'notification_attempt'
  `
  if (notices === 0) {
    die('no notification attempt on the record — the page promises the counterparty is notified proactively, so record the attempt (even a failed one) before publishing')
  }

  const left = (f!.reply_deadline as Date).getTime() - Date.now()
  const force = flags.get('force')
  if (left > 0 && !force) {
    die(`the reply window closes in ${hours(left)}h and the page promises nothing is published before it closes; wait, or pass --force="<reason>" and own it publicly`)
  }

  const [{ n: pending }] = await sql`
    select count(*)::int as n from complaint_events
    where filing_id = ${id} and kind = 'reply' and not visible
  `
  if (pending > 0) {
    console.log(`WARNING: ${pending} repl${pending > 1 ? 'ies have' : 'y has'} been received and not yet rendered.`)
    console.log('The public file will say so rather than look like silence, but reading them first is fairer.')
  }

  if (!(await confirm(`Publish ${id} irreversibly?`))) return console.log('not published')

  await sql.begin(async (tx) => {
    await tx`update complaint_filings set status = 'published', published_at = now() where id = ${id}`
    const body = force
      ? `Published before the reply window closed. Reason given by the bureau: ${force}`
      : 'Published after the reply window closed.'
    await tx`
      insert into complaint_events (filing_id, kind, actor, body, visible)
      values (${id}, 'publication', 'bureau', ${body}, true)
    `
  })
  console.log(`published: https://agentreputation.dev/complaints/${id}`)
  console.log('The page may take up to five minutes to show it.')
}

async function revealReply() {
  const id = requireId()
  const pending = await sql`
    select seq, occurred_at, actor_address, body from complaint_events
    where filing_id = ${id} and kind = 'reply' and not visible order by seq
  `
  if (pending.length === 0) return console.log('no reply awaiting review on this filing')

  for (const r of pending) {
    console.log(`\n#${r.seq} signed by ${r.actor_address} at ${(r.occurred_at as Date).toISOString().slice(0, 16)}`)
    console.log(String(r.body))
  }
  console.log('\nA reply is published as its own words and never edited to change its meaning.')
  console.log('Reviewing it is a check on legality and nothing else.')
  if (!(await confirm(`Render ${pending.length > 1 && flags.get('all') === 'true' ? 'all of them' : 'the first one'} on the public file?`))) {
    return console.log('left unrendered — the public file still states that a reply was received')
  }
  const seqs = flags.get('all') === 'true' ? pending.map((r) => r.seq) : [pending[0].seq]
  await sql`update complaint_events set visible = true where seq in ${sql(seqs)}`
  console.log(`rendered ${seqs.length} repl${seqs.length > 1 ? 'ies' : 'y'} on the public file`)
}

async function correct() {
  const id = requireId()
  const text = positional[1]
  if (!text || text.trim().length < 10) die('give the correction as a quoted sentence')
  const rows = await sql`select status from complaint_filings where id = ${id}`
  if (!rows[0]) die(`no filing with reference ${id}`)
  await sql`
    insert into complaint_events (filing_id, kind, actor, body, visible)
    values (${id}, 'correction', 'bureau', ${text.trim()}, true)
  `
  console.log(`correction appended to ${id} and dated. Nothing was rewritten or removed.`)
}

async function reject() {
  const id = requireId()
  const reason = positional[1]
  if (!reason || reason.trim().length < 10) die('give the reason as a quoted sentence — it stays on the record')
  const rows = await sql`select status from complaint_filings where id = ${id}`
  if (!rows[0]) die(`no filing with reference ${id}`)
  if (rows[0].status === 'published') die('a published file is corrected, never rejected afterwards')
  if (!(await confirm(`Reject ${id}?`))) return console.log('not rejected')
  await sql`
    update complaint_filings set status = 'rejected', rejected_reason = ${reason.trim()} where id = ${id}
  `
  console.log(`${id} rejected. The reason is on the record; tell the filer through the private contact.`)
}

// ---------------------------------------------------------------------------

const COMMANDS: Record<string, () => Promise<void>> = {
  doctor,
  selftest,
  list,
  show,
  verify,
  notify,
  publish,
  'reveal-reply': revealReply,
  correct,
  reject,
}

try {
  const run = command ? COMMANDS[command] : undefined
  if (!run) {
    console.log('Complaint Bureau operator desk. Commands:')
    console.log(`  ${Object.keys(COMMANDS).join('  ')}`)
    console.log('\nRun through the launcher so the connection secret is never written to disk:')
    console.log('  pwsh -File scripts/with-agenthub-db.ps1 node scripts/complaint-desk.mts list')
    process.exitCode = command ? 1 : 0
  } else {
    await run()
  }
} catch (e) {
  if (!(e instanceof ExitSignal)) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
} finally {
  await sql.end()
}
