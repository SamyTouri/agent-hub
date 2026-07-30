import { getSql, withTimeout } from './db.ts'
import type {
  ChannelKind,
  ClaimantRole,
  FilingRecord,
  ReplyRecord,
  SettledBasis,
  TerminalState,
} from './complaints.ts'

// Accès base du Complaint Bureau. Rappel de convention du dépôt : les requêtes
// sont SÉQUENTIELLES, jamais en Promise.all — le pooler transaction (PgBouncer,
// max:1) met en file les requêtes concurrentes jusqu'au timeout.
//
// Le contact privé du déposant entre en base mais ne sort JAMAIS d'ici : aucune
// fonction de ce module ne le renvoie, y compris aux lectures internes.

type FilingRow = {
  id: string
  status: FilingRecord['status']
  created_at: Date
  claimant_role: ClaimantRole
  claimant_address: string
  counterparty_address: string
  network: string
  matter_reference: string
  matter_url: string | null
  settled_basis: SettledBasis
  terminal_state: TerminalState | null
  announced_deadline: Date | null
  settled_evidence: string
  subject_label: string
  account: string
  account_digest: string
  signed_statement: string
  signature: string
  counterparty_channel_kind: ChannelKind
  counterparty_channel: string | null
  reply_window_hours: number
  reply_deadline: Date
}

const toRecord = (row: FilingRow): FilingRecord => ({
  id: row.id,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  role: row.claimant_role,
  address: row.claimant_address,
  counterpartyAddress: row.counterparty_address,
  network: row.network,
  matterReference: row.matter_reference,
  matterUrl: row.matter_url,
  settledBasis: row.settled_basis,
  terminalState: row.terminal_state,
  announcedDeadline: row.announced_deadline ? row.announced_deadline.toISOString().slice(0, 10) : null,
  settledEvidence: row.settled_evidence,
  subjectLabel: row.subject_label,
  account: row.account,
  accountDigest: row.account_digest,
  signedStatement: row.signed_statement,
  signature: row.signature,
  counterpartyChannelKind: row.counterparty_channel_kind,
  counterpartyChannel: row.counterparty_channel,
  replyWindowHours: row.reply_window_hours,
  replyDeadline: row.reply_deadline.toISOString(),
})

// Les colonnes sont écrites en clair dans chaque requête plutôt qu'assemblées depuis
// une constante : le dépôt n'interpole nulle part de fragment SQL brut dans un
// template, et ce n'est pas ici qu'il faut inaugurer le motif.
export async function findFiling(id: string): Promise<FilingRecord | null> {
  const sql = getSql()
  const rows = (await sql`
    select id, status, created_at, claimant_role, claimant_address, counterparty_address,
           network, matter_reference, matter_url, settled_basis, terminal_state,
           announced_deadline, settled_evidence, subject_label, account, account_digest,
           signed_statement, signature, counterparty_channel_kind, counterparty_channel,
           reply_window_hours, reply_deadline
    from complaint_filings where id = ${id}
  `) as unknown as FilingRow[]
  return rows[0] ? toRecord(rows[0]) : null
}

export async function findFilingParties(
  id: string,
): Promise<{ counterpartyAddress: string; status: FilingRecord['status'] } | null> {
  const sql = getSql()
  const rows = (await sql`
    select counterparty_address, status from complaint_filings where id = ${id}
  `) as unknown as Array<{ counterparty_address: string; status: FilingRecord['status'] }>
  const row = rows[0]
  return row ? { counterpartyAddress: row.counterparty_address, status: row.status } : null
}

export async function countRecentByAddress(address: string): Promise<number> {
  const sql = getSql()
  const rows = (await sql`
    select count(*)::int as n from complaint_filings
    where claimant_address = ${address} and created_at > now() - interval '24 hours'
  `) as unknown as Array<{ n: number }>
  return rows[0]?.n ?? 0
}

/**
 * Insertion idempotente : deux dépôts identiques concurrents ne peuvent pas
 * créer deux dossiers, et le second récupère celui qui existe déjà.
 */
export async function insertFiling(
  record: FilingRecord,
  filerContact: string,
): Promise<FilingRecord> {
  const sql = getSql()
  await sql`
    insert into complaint_filings (
      id, status, created_at, claimant_role, claimant_address, counterparty_address, network,
      matter_reference, matter_url, settled_basis, terminal_state, announced_deadline,
      settled_evidence, subject_label, account, account_digest, signed_statement, signature,
      counterparty_channel_kind, counterparty_channel, reply_window_hours, reply_deadline,
      filer_contact
    ) values (
      ${record.id}, ${record.status}, ${record.createdAt}, ${record.role}, ${record.address},
      ${record.counterpartyAddress}, ${record.network}, ${record.matterReference},
      ${record.matterUrl}, ${record.settledBasis}, ${record.terminalState},
      ${record.announcedDeadline}, ${record.settledEvidence}, ${record.subjectLabel},
      ${record.account}, ${record.accountDigest}, ${record.signedStatement}, ${record.signature},
      ${record.counterpartyChannelKind}, ${record.counterpartyChannel},
      ${record.replyWindowHours}, ${record.replyDeadline}, ${filerContact}
    )
    on conflict (id) do nothing
  `
  const stored = await findFiling(record.id)
  return stored ?? record
}

export async function insertReply(record: ReplyRecord): Promise<void> {
  const sql = getSql()
  await sql`
    insert into complaint_events (
      filing_id, kind, occurred_at, actor, actor_address, body, body_digest,
      signed_statement, signature, visible
    ) values (
      ${record.filingId}, 'reply', ${record.receivedAt}, 'counterparty', ${record.address},
      ${record.body}, ${record.bodyDigest}, ${record.signedStatement}, ${record.signature}, false
    )
    on conflict (filing_id, kind, body_digest) do nothing
  `
}

// ---------------------------------------------------------------------------
// Lectures publiques — uniquement des dossiers publiés
// ---------------------------------------------------------------------------

export type PublicFilingSummary = {
  id: string
  publishedAt: string
  subjectLabel: string
  network: string
  settledBasis: SettledBasis
  claimantRole: ClaimantRole
  hasReply: boolean
}

export async function listPublishedFilings(): Promise<PublicFilingSummary[]> {
  const sql = getSql()
  const rows = (await withTimeout(sql`
    select f.id, f.published_at, f.subject_label, f.network, f.settled_basis, f.claimant_role,
           exists (
             select 1 from complaint_events e
             where e.filing_id = f.id and e.kind = 'reply' and e.visible
           ) as has_reply
    from complaint_filings f
    where f.status = 'published'
    order by f.published_at desc
  `)) as unknown as Array<{
    id: string
    published_at: Date
    subject_label: string
    network: string
    settled_basis: SettledBasis
    claimant_role: ClaimantRole
    has_reply: boolean
  }>
  return rows.map((r) => ({
    id: r.id,
    publishedAt: r.published_at.toISOString(),
    subjectLabel: r.subject_label,
    network: r.network,
    settledBasis: r.settled_basis,
    claimantRole: r.claimant_role,
    hasReply: r.has_reply,
  }))
}

/**
 * Ce qu'un acheteur interroge AVANT de payer : existe-t-il un dossier publié sur cette
 * adresse, ou sur ce sujet tel qu'il est publié ? On renvoie des faits datés, jamais un
 * compte présenté comme une note — et surtout, l'appelant doit recevoir avec la réponse
 * que zéro dossier ne dit rien de la fiabilité de personne. Sans cette phrase, l'absence
 * deviendrait un label, ce qui est exactement le défaut que ce projet existe pour exposer.
 */
export async function findPublishedAbout(query: string): Promise<PublicFilingSummary[]> {
  const term = query.trim()
  if (term.length < 2) return []
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(term)
  const sql = getSql()
  const rows = (await withTimeout(
    isAddress
      ? sql`
          select f.id, f.published_at, f.subject_label, f.network, f.settled_basis, f.claimant_role,
                 exists (
                   select 1 from complaint_events e
                   where e.filing_id = f.id and e.kind = 'reply' and e.visible
                 ) as has_reply
          from complaint_filings f
          where f.status = 'published'
            and (f.counterparty_address = ${term.toLowerCase()} or f.claimant_address = ${term.toLowerCase()})
          order by f.published_at desc
          limit 50
        `
      : sql`
          select f.id, f.published_at, f.subject_label, f.network, f.settled_basis, f.claimant_role,
                 exists (
                   select 1 from complaint_events e
                   where e.filing_id = f.id and e.kind = 'reply' and e.visible
                 ) as has_reply
          from complaint_filings f
          where f.status = 'published'
            and (f.subject_label ilike ${'%' + term + '%'} or f.matter_reference ilike ${'%' + term + '%'})
          order by f.published_at desc
          limit 50
        `,
  )) as unknown as Array<{
    id: string
    published_at: Date
    subject_label: string
    network: string
    settled_basis: SettledBasis
    claimant_role: ClaimantRole
    has_reply: boolean
  }>
  return rows.map((r) => ({
    id: r.id,
    publishedAt: r.published_at.toISOString(),
    subjectLabel: r.subject_label,
    network: r.network,
    settledBasis: r.settled_basis,
    claimantRole: r.claimant_role,
    hasReply: r.has_reply,
  }))
}

export type PublicEvent = {
  kind: 'notification_attempt' | 'reply' | 'correction' | 'publication'
  occurredAt: string
  actor: 'bureau' | 'claimant' | 'counterparty'
  actorAddress: string | null
  channel: string | null
  body: string
}

export type PublicFiling = {
  id: string
  publishedAt: string
  createdAt: string
  subjectLabel: string
  network: string
  matterReference: string
  matterUrl: string | null
  settledBasis: SettledBasis
  terminalState: TerminalState | null
  announcedDeadline: string | null
  settledEvidence: string
  claimantRole: ClaimantRole
  claimantAddress: string
  counterpartyAddress: string
  counterpartyChannelKind: ChannelKind
  replyWindowHours: number
  replyDeadline: string
  account: string
  accountDigest: string
  events: PublicEvent[]
  /** Une réponse reçue mais pas encore relue à la main : jamais masquée, jamais rendue. */
  pendingReplies: number
}

export async function getPublishedFiling(id: string): Promise<PublicFiling | null> {
  const sql = getSql()
  const rows = (await withTimeout(sql`
    select id, status, created_at, claimant_role, claimant_address, counterparty_address,
           network, matter_reference, matter_url, settled_basis, terminal_state,
           announced_deadline, settled_evidence, subject_label, account, account_digest,
           signed_statement, signature, counterparty_channel_kind, counterparty_channel,
           reply_window_hours, reply_deadline, published_at
    from complaint_filings
    where id = ${id} and status = 'published'
  `)) as unknown as Array<FilingRow & { published_at: Date }>
  const row = rows[0]
  if (!row) return null

  // Séquentiel : deuxième requête seulement après la première (pooler max:1).
  const events = (await withTimeout(sql`
    select kind, occurred_at, actor, actor_address, channel, body, visible
    from complaint_events
    where filing_id = ${id}
    order by seq
  `)) as unknown as Array<{
    kind: PublicEvent['kind']
    occurred_at: Date
    actor: PublicEvent['actor']
    actor_address: string | null
    channel: string | null
    body: string
    visible: boolean
  }>

  const record = toRecord(row)
  return {
    id: record.id,
    publishedAt: row.published_at.toISOString(),
    createdAt: record.createdAt,
    subjectLabel: record.subjectLabel,
    network: record.network,
    matterReference: record.matterReference,
    matterUrl: record.matterUrl,
    settledBasis: record.settledBasis,
    terminalState: record.terminalState,
    announcedDeadline: record.announcedDeadline,
    settledEvidence: record.settledEvidence,
    claimantRole: record.role,
    claimantAddress: record.address,
    counterpartyAddress: record.counterpartyAddress,
    counterpartyChannelKind: record.counterpartyChannelKind,
    replyWindowHours: record.replyWindowHours,
    replyDeadline: record.replyDeadline,
    account: record.account,
    accountDigest: record.accountDigest,
    events: events
      .filter((e) => e.visible)
      .map((e) => ({
        kind: e.kind,
        occurredAt: e.occurred_at.toISOString(),
        actor: e.actor,
        actorAddress: e.actor_address,
        channel: e.channel,
        body: e.body,
      })),
    pendingReplies: events.filter((e) => e.kind === 'reply' && !e.visible).length,
  }
}
