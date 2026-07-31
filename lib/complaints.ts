import { createHash } from 'node:crypto'
import { z } from 'zod'
import { EVM_ADDRESS_RE } from './x402.ts'

// Complaint Bureau — noyau métier du dépôt de plainte vérifié par signature.
//
// Tout ici est PUR : aucune DB, aucun réseau, aucun secret. La route injecte les
// effets, ce module décide ce qui est recevable, ce qui doit être signé, et quel
// délai de réponse la contrepartie obtient. Règles portées par docs/DOCTRINE.md,
// section « B — the Complaint Bureau » ; ne pas les redériver ailleurs.
//
// Le principe qui structure le fichier : on n'enregistre que ce qu'on a observé.
// Il n'y a donc ni score, ni agrégat, ni verdict. Un dossier est un fait daté sur
// UNE transaction, et la signature ne prouve qu'une chose — le contrôle d'une des
// deux adresses.

export const FILING_STATEMENT_VERSION = 1
export const REPLY_STATEMENT_VERSION = 1

export const CLAIMANT_ROLES = ['payer', 'payee'] as const
export type ClaimantRole = (typeof CLAIMANT_ROLES)[number]

/**
 * Les trois seuls cas où une affaire est terminée (doctrine du 2026-07-30).
 * Chacun est vérifiable sans croire personne, et aucun n'accepte une affaire dont
 * les fonds sont encore réellement en jeu.
 */
export const SETTLED_BASES = [
  'payment_reached_payee',
  'terminal_onchain_state',
  'frozen_past_deadline',
] as const
export type SettledBasis = (typeof SETTLED_BASES)[number]

/** États terminaux admis pour `terminal_onchain_state`. */
export const TERMINAL_STATES = ['paid', 'refunded', 'expired', 'arbitrated'] as const
export type TerminalState = (typeof TERMINAL_STATES)[number]

/** Nature du canal de contact de la contrepartie — décide du délai de réponse. */
export const CHANNEL_KINDS = ['machine', 'human', 'none'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

/**
 * « Le délai de réponse ne dépasse jamais la vitesse à laquelle la contrepartie
 * facture. » Une contrepartie joignable par machine facture à la seconde : une
 * heure. Un canal humain seul : vingt-quatre heures. Aucun canal vérifiable :
 * pas d'attente, et l'échec de notification est publié avec le dossier — ne pas
 * avoir de canal tout en encaissant est un fait sur un vendeur.
 */
export const REPLY_WINDOW_HOURS: Record<ChannelKind, number> = { machine: 1, human: 24, none: 0 }

/** Fenêtre de fraîcheur de la déclaration signée : au-delà, il faut re-signer. */
export const STATEMENT_MAX_AGE_DAYS = 30
/** Immobilité minimale au-delà du délai annoncé pour que le gel devienne un fait. */
export const FREEZE_DAYS = 30

const DAY_MS = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CAIP2_RE = /^[a-z0-9]{3,8}:[a-zA-Z0-9._-]{1,32}$/
const HTTPS_URL_RE = /^https:\/\/[^\s]{4,2000}$/
/** ECDSA secp256k1 : 65 octets exactement (r, s, v). */
export const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)

export const FilingInputSchema = z.object({
  /** Rôle revendiqué dans la transaction : payeur ou encaisseur. */
  role: z.enum(CLAIMANT_ROLES),
  /** Adresse dont le déposant prouve le contrôle en signant. */
  address: z.string().trim().regex(EVM_ADDRESS_RE),
  /** L'autre adresse de la même transaction. */
  counterparty_address: z.string().trim().regex(EVM_ADDRESS_RE),
  /** Réseau en CAIP-2, ex. `eip155:8453`. */
  network: z.string().trim().regex(CAIP2_RE),
  /** Référence de l'affaire telle qu'elle est publiée : hash, nonce, identifiant d'échange. */
  matter_reference: trimmed(6, 200),
  /** Où la référence est consultable publiquement, le cas échéant. */
  matter_url: z.string().trim().regex(HTTPS_URL_RE).optional(),
  settled_basis: z.enum(SETTLED_BASES),
  /** Requis quand l'affaire est close par un état terminal on-chain. */
  terminal_state: z.enum(TERMINAL_STATES).optional(),
  /** Requis pour un gel : le délai annoncé par le vendeur ou la plateforme. */
  announced_deadline: z.string().trim().regex(DATE_RE).optional(),
  /** Comment un tiers vérifie que l'affaire est terminée, sans nous croire. */
  settled_evidence: trimmed(20, 1000),
  /** Le sujet tel qu'il est publié — ressource, offre, opérateur. Jamais un nom déduit. */
  subject_label: trimmed(2, 300),
  /** Le récit daté du déposant. C'est la plainte elle-même. */
  account: trimmed(80, 6000),
  counterparty_channel_kind: z.enum(CHANNEL_KINDS),
  /** Le canal connu de la contrepartie, quand il en existe un. */
  counterparty_channel: z.string().trim().max(500).optional(),
  /** Contact privé du déposant, pour la vérification. Jamais publié. */
  filer_contact: trimmed(5, 320),
  /** Date de la déclaration signée, en YYYY-MM-DD. */
  filed_on: z.string().trim().regex(DATE_RE),
})

export type FilingInput = z.infer<typeof FilingInputSchema>

export const ReplyInputSchema = z.object({
  filing_id: z.string().trim().regex(/^cb-[0-9a-f]{20}$/),
  /** Adresse de la contrepartie du dossier : la seule qui puisse répondre par signature. */
  address: z.string().trim().regex(EVM_ADDRESS_RE),
  reply: trimmed(20, 6000),
  replied_on: z.string().trim().regex(DATE_RE),
})

export type ReplyInput = z.infer<typeof ReplyInputSchema>

// ---------------------------------------------------------------------------
// Normalisation et empreintes
// ---------------------------------------------------------------------------

/**
 * Le texte signé doit être reproductible à l'octet, sinon la vérification
 * échoue pour une raison invisible au déposant. On normalise donc les fins de
 * ligne avant d'empreinter, et c'est cette forme normalisée qui est stockée.
 */
export function normalizeProse(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()
}

export function proseDigest(text: string): string {
  return createHash('sha256').update(normalizeProse(text), 'utf8').digest('hex')
}

/**
 * Identifiant dérivé du contenu : le même déposant, sur la même affaire, dans le
 * même rôle, retombe sur le même dossier. Un dépôt rejoué est donc idempotent
 * plutôt qu'un doublon, et corriger son récit ne crée pas un second dossier.
 * Le récit est volontairement HORS de la dérivation.
 */
export function deriveFilingId(input: {
  network: string
  matter_reference: string
  address: string
  role: ClaimantRole
}): string {
  const key = [
    input.network.trim().toLowerCase(),
    input.matter_reference.trim().toLowerCase(),
    input.address.trim().toLowerCase(),
    input.role,
  ].join('|')
  return `cb-${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 20)}`
}

// ---------------------------------------------------------------------------
// Recevabilité
// ---------------------------------------------------------------------------

export type Admissibility =
  | { ok: true; basis: SettledBasis; note: string }
  | { ok: false; reason: string; admissible_from?: string }

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Ce qui rend un dépôt recevable : être partie prouvée à une affaire TERMINÉE.
 * La signature est vérifiée ailleurs — ici on ne juge que le moment, jamais le
 * fond de la plainte. Rien n'est recevable pendant que les fonds sont en jeu.
 */
export function checkAdmissibility(input: FilingInput, now: Date): Admissibility {
  const filedOn = new Date(`${input.filed_on}T00:00:00Z`)
  if (Number.isNaN(filedOn.getTime())) return { ok: false, reason: 'filed_on is not a real date' }
  // Tolérance d'un jour : le déposant peut être en avance de fuseau sur nous.
  if (filedOn.getTime() - now.getTime() > DAY_MS) {
    return { ok: false, reason: 'filed_on is in the future' }
  }
  if (now.getTime() - filedOn.getTime() > STATEMENT_MAX_AGE_DAYS * DAY_MS) {
    return {
      ok: false,
      reason: `the signed statement is older than ${STATEMENT_MAX_AGE_DAYS} days — sign a statement dated today`,
    }
  }

  switch (input.settled_basis) {
    case 'payment_reached_payee':
      return {
        ok: true,
        basis: input.settled_basis,
        note: 'The payment reached the payee, so the matter closed in its first second and only the account of what followed is in dispute.',
      }

    case 'terminal_onchain_state':
      if (!input.terminal_state) {
        return {
          ok: false,
          reason: `terminal_onchain_state requires terminal_state (${TERMINAL_STATES.join(', ')})`,
        }
      }
      return {
        ok: true,
        basis: input.settled_basis,
        note: `The exchange reached the terminal on-chain state "${input.terminal_state}", which is readable by anyone without believing either party.`,
      }

    case 'frozen_past_deadline': {
      if (!input.announced_deadline) {
        return {
          ok: false,
          reason:
            'frozen_past_deadline requires announced_deadline — the deadline the seller or the platform itself announced',
        }
      }
      const deadline = new Date(`${input.announced_deadline}T00:00:00Z`)
      if (Number.isNaN(deadline.getTime())) {
        return { ok: false, reason: 'announced_deadline is not a real date' }
      }
      if (deadline.getTime() > now.getTime()) {
        return {
          ok: false,
          reason: 'the announced deadline has not passed yet — the funds are still genuinely in play',
          admissible_from: isoDay(new Date(deadline.getTime() + FREEZE_DAYS * DAY_MS)),
        }
      }
      const frozenDays = Math.floor((now.getTime() - deadline.getTime()) / DAY_MS)
      if (frozenDays < FREEZE_DAYS) {
        return {
          ok: false,
          reason: `the funds have been immobile for ${frozenDays} day(s) past the announced deadline; ${FREEZE_DAYS} are required`,
          admissible_from: isoDay(new Date(deadline.getTime() + FREEZE_DAYS * DAY_MS)),
        }
      }
      return {
        ok: true,
        basis: input.settled_basis,
        note: `The funds have not moved for ${frozenDays} days past the deadline the seller or the platform announced. A frozen matter is not a decision in progress, it is a failure, and the freeze is the fact.`,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Déclarations à signer
// ---------------------------------------------------------------------------

/**
 * Les seuls champs qui entrent dans la déclaration signée. Type dédié plutôt que
 * `FilingInput` complet, pour qu'un appelant qui reconstruit la déclaration depuis la
 * base (l'outil opérateur) ne puisse pas en oublier un derrière un transtypage : le
 * compilateur exige les huit, et une déclaration reconstruite de travers ferait échouer
 * la vérification d'un dossier authentique.
 */
export type SignableFiling = Pick<
  FilingInput,
  | 'role'
  | 'address'
  | 'counterparty_address'
  | 'network'
  | 'matter_reference'
  | 'settled_basis'
  | 'account'
  | 'filed_on'
>

/**
 * Le texte exact que le déposant signe (personal_sign / EIP-191). Il lie la
 * signature à CETTE affaire et à CE récit : une signature qui fuiterait ne
 * permettrait donc pas de déposer une autre version des faits, ni un autre
 * dossier. Le serveur reconstruit cette chaîne à partir des champs reçus et
 * refuse tout ce qui ne retombe pas sur l'adresse revendiquée.
 */
export function canonicalFilingStatement(input: SignableFiling): string {
  return [
    'Agent Reputation — Complaint Bureau',
    `Filing statement v${FILING_STATEMENT_VERSION}`,
    '',
    'I control the address below and I am a party to the matter below.',
    '',
    `address: ${input.address.trim().toLowerCase()}`,
    `role: ${input.role}`,
    `network: ${input.network.trim().toLowerCase()}`,
    `counterparty: ${input.counterparty_address.trim().toLowerCase()}`,
    `matter: ${input.matter_reference.trim()}`,
    `settled: ${input.settled_basis}`,
    `account_digest: ${proseDigest(input.account)}`,
    `filed_on: ${input.filed_on}`,
    '',
    'This filing may be published with the address above. The counterparty is',
    'notified and may reply for free at any time, permanently linked to the file.',
    'A published file is never withdrawn; it is corrected with a date.',
  ].join('\n')
}

/** Déclaration de la contrepartie qui répond. Répondre est gratuit et sans condition. */
export function canonicalReplyStatement(input: ReplyInput): string {
  return [
    'Agent Reputation — Complaint Bureau',
    `Reply statement v${REPLY_STATEMENT_VERSION}`,
    '',
    'I control the address below and I reply to the file below.',
    '',
    `address: ${input.address.trim().toLowerCase()}`,
    `file: ${input.filing_id.trim()}`,
    `reply_digest: ${proseDigest(input.reply)}`,
    `replied_on: ${input.replied_on}`,
    '',
    'My reply is free, unconditional and permanently linked to the file. It is',
    'published as my own words and never edited to change its meaning.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Délai de réponse
// ---------------------------------------------------------------------------

export type ReplyWindow = { hours: number; deadline: string; unreachable: boolean }

export function replyWindow(kind: ChannelKind, filedAt: Date): ReplyWindow {
  const hours = REPLY_WINDOW_HOURS[kind]
  return {
    hours,
    deadline: new Date(filedAt.getTime() + hours * 3_600_000).toISOString(),
    unreachable: kind === 'none',
  }
}

// ---------------------------------------------------------------------------
// Orchestration du dépôt, effets injectés
// ---------------------------------------------------------------------------

export type FilingRecord = {
  id: string
  status: 'received' | 'verified' | 'published' | 'rejected'
  createdAt: string
  role: ClaimantRole
  address: string
  counterpartyAddress: string
  network: string
  matterReference: string
  matterUrl: string | null
  settledBasis: SettledBasis
  terminalState: TerminalState | null
  announcedDeadline: string | null
  settledEvidence: string
  subjectLabel: string
  account: string
  accountDigest: string
  signedStatement: string
  signature: string
  counterpartyChannelKind: ChannelKind
  counterpartyChannel: string | null
  replyWindowHours: number
  replyDeadline: string
}

export type FilingDeps = {
  /** Reconstruit l'adresse depuis la déclaration signée ; null si la signature est invalide. */
  recoverSigner: (statement: string, signature: string) => Promise<string | null>
  /** Renvoie le dossier existant, pour que le rejeu soit idempotent. */
  findFiling: (id: string) => Promise<FilingRecord | null>
  /** Borne anti-flood par adresse déposante sur 24 h. */
  countRecentByAddress: (address: string) => Promise<number>
  insertFiling: (record: FilingRecord) => Promise<FilingRecord>
  now: () => Date
}

/** Plafond volontairement bas : le guichet est ouvert sans compte. */
export const MAX_FILINGS_PER_ADDRESS_PER_DAY = 5

export type FilingResult =
  | { status: 'filed'; filing: FilingRecord; admissibility: Extract<Admissibility, { ok: true }> }
  | { status: 'already_filed'; filing: FilingRecord }
  | { status: 'inadmissible'; reason: string; admissible_from?: string }
  | { status: 'bad_signature'; reason: string }
  | { status: 'rate_limited'; reason: string }

export async function processFiling(
  deps: FilingDeps,
  input: FilingInput,
  signature: string,
): Promise<FilingResult> {
  if (!SIGNATURE_RE.test(signature)) {
    return { status: 'bad_signature', reason: 'signature must be a 65-byte hex ECDSA signature' }
  }
  if (input.address.trim().toLowerCase() === input.counterparty_address.trim().toLowerCase()) {
    return {
      status: 'inadmissible',
      reason: 'the two addresses of a transaction cannot be the same address',
    }
  }

  const now = deps.now()
  const admissibility = checkAdmissibility(input, now)
  if (!admissibility.ok) {
    return {
      status: 'inadmissible',
      reason: admissibility.reason,
      ...(admissibility.admissible_from ? { admissible_from: admissibility.admissible_from } : {}),
    }
  }

  const statement = canonicalFilingStatement(input)
  const signer = await deps.recoverSigner(statement, signature)
  if (!signer || signer.toLowerCase() !== input.address.trim().toLowerCase()) {
    return {
      status: 'bad_signature',
      reason: signer
        ? 'the signature recovers to a different address than the one claimed'
        : 'the signature could not be verified against the exact statement',
    }
  }

  const id = deriveFilingId(input)
  // Idempotence AVANT le plafond : un rejeu doit répondre la même chose même si
  // le déposant a depuis atteint sa borne quotidienne.
  const existing = await deps.findFiling(id)
  if (existing) return { status: 'already_filed', filing: existing }

  const recent = await deps.countRecentByAddress(input.address.trim().toLowerCase())
  if (recent >= MAX_FILINGS_PER_ADDRESS_PER_DAY) {
    return {
      status: 'rate_limited',
      reason: `max ${MAX_FILINGS_PER_ADDRESS_PER_DAY} filings per address per 24 hours`,
    }
  }

  const window = replyWindow(input.counterparty_channel_kind, now)
  const record: FilingRecord = {
    id,
    status: 'received',
    createdAt: now.toISOString(),
    role: input.role,
    address: input.address.trim().toLowerCase(),
    counterpartyAddress: input.counterparty_address.trim().toLowerCase(),
    network: input.network.trim().toLowerCase(),
    matterReference: input.matter_reference.trim(),
    matterUrl: input.matter_url ?? null,
    settledBasis: input.settled_basis,
    terminalState: input.terminal_state ?? null,
    announcedDeadline: input.announced_deadline ?? null,
    settledEvidence: normalizeProse(input.settled_evidence),
    subjectLabel: input.subject_label.trim(),
    account: normalizeProse(input.account),
    accountDigest: proseDigest(input.account),
    signedStatement: statement,
    signature,
    counterpartyChannelKind: input.counterparty_channel_kind,
    counterpartyChannel: input.counterparty_channel ?? null,
    replyWindowHours: window.hours,
    replyDeadline: window.deadline,
  }
  const stored = await deps.insertFiling(record)
  return { status: 'filed', filing: stored, admissibility }
}

// ---------------------------------------------------------------------------
// Réponse de la contrepartie
// ---------------------------------------------------------------------------

export type ReplyRecord = {
  filingId: string
  receivedAt: string
  address: string
  body: string
  bodyDigest: string
  signedStatement: string
  signature: string
}

export type ReplyDeps = {
  recoverSigner: (statement: string, signature: string) => Promise<string | null>
  /** Renvoie l'adresse de contrepartie du dossier et son état ; null si inconnu. */
  findFilingParties: (
    id: string,
  ) => Promise<{ counterpartyAddress: string; status: FilingRecord['status'] } | null>
  insertReply: (record: ReplyRecord) => Promise<void>
  now: () => Date
}

export type ReplyResult =
  | { status: 'received'; record: ReplyRecord }
  | { status: 'unknown_filing' }
  | { status: 'not_the_counterparty' }
  | { status: 'bad_signature'; reason: string }

/**
 * Seule la contrepartie nommée dans le dossier peut répondre par signature, et
 * elle peut le faire à tout moment — avant publication comme après. Répondre ne
 * coûte rien et ne demande rien : ni compte, ni paiement, ni notre accord.
 */
export async function processReply(
  deps: ReplyDeps,
  input: ReplyInput,
  signature: string,
): Promise<ReplyResult> {
  if (!SIGNATURE_RE.test(signature)) {
    return { status: 'bad_signature', reason: 'signature must be a 65-byte hex ECDSA signature' }
  }
  const parties = await deps.findFilingParties(input.filing_id.trim())
  if (!parties) return { status: 'unknown_filing' }
  if (parties.counterpartyAddress.toLowerCase() !== input.address.trim().toLowerCase()) {
    return { status: 'not_the_counterparty' }
  }

  const statement = canonicalReplyStatement(input)
  const signer = await deps.recoverSigner(statement, signature)
  if (!signer || signer.toLowerCase() !== input.address.trim().toLowerCase()) {
    return {
      status: 'bad_signature',
      reason: signer
        ? 'the signature recovers to a different address than the one claimed'
        : 'the signature could not be verified against the exact statement',
    }
  }

  const record: ReplyRecord = {
    filingId: input.filing_id.trim(),
    receivedAt: deps.now().toISOString(),
    address: input.address.trim().toLowerCase(),
    body: normalizeProse(input.reply),
    bodyDigest: proseDigest(input.reply),
    signedStatement: statement,
    signature,
  }
  await deps.insertReply(record)
  return { status: 'received', record }
}

// ---------------------------------------------------------------------------
// Reçu privé rendu au déposant
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Méthode publique — SOURCE UNIQUE de la promesse
// ---------------------------------------------------------------------------
// La page /complaints et l'endpoint d'intake rendent tous les deux CET objet. Le
// précédent du dépôt est clair : quand la même promesse est réécrite à deux
// endroits, deux textes divergent et l'un des deux finit par mentir.

export const BUREAU_METHOD = {
  what:
    'The Complaint Bureau is a registry of complaints whose entry is verified by a signature. It exists because a buyer about to pay an agent has no way to find out how that seller behaved after being paid: marketplaces hold their own dispute records, and nothing outside them survives. We hold the dated facts a seller cannot write about itself.',

  who_may_file: {
    rule: 'A filing is admissible when its author is a proven party to a settled matter.',
    proof:
      'Proof is a signature from one of the two addresses of the transaction, never a transaction hash on its own: the chain is public, so a hash proves nothing about who is presenting it. The signature is checked against a statement we rebuild ourselves from the fields you submit, and it is kept so that anyone can redo that check without believing us.',
    symmetry:
      'Both sides may file. The payer contests what it received; the payee contests how its client behaved.',
    settled_cases: [
      {
        id: 'payment_reached_payee' as SettledBasis,
        title: 'The payment reached the payee',
        detail:
          'The matter closed in its first second; only the account of what followed is in dispute.',
      },
      {
        id: 'terminal_onchain_state' as SettledBasis,
        title: 'The exchange reached a terminal on-chain state',
        detail:
          'Paid, refunded, expired or arbitrated. Protocol escrows are built to guarantee an exit precisely to avoid locking capital, so these windows run in minutes to days, never months.',
      },
      {
        id: 'frozen_past_deadline' as SettledBasis,
        title: `The funds have not moved for ${FREEZE_DAYS} days past the deadline the seller or the platform itself announced`,
        detail:
          'This is the case nobody else covers. Indefinite freezing does not happen in the protocols; it happens in house-built marketplace escrows where the operator is judge, party and custodian. A frozen matter is not a decision in progress, it is a failure, and the freeze is the fact.',
      },
    ],
    never:
      'Nothing is admissible while the funds are genuinely in play. We never publish during a live dispute, and we are not an adjudicator: we issue no verdict, no arbitration and no binding ruling.',
  },

  what_we_verify: [
    'That the signature recovers to the address it claims, against the exact statement.',
    'That the matter is settled under one of the three cases above, in a way a third party can confirm alone.',
    'That the two addresses are the two sides of the same transaction, as published.',
    'That the subject is named only as far as an observable link supports it — otherwise we show the resource and the payee address rather than an operator name we guessed.',
  ],
  what_we_never_verify:
    'Whether your account of events is true. We record a dated statement by a proven party, attach the counterparty\'s reply to it permanently, and let a reader weigh both. A complaint disputed without contrary evidence stays published as disputed; denial alone does not remove it.',

  /**
   * Ajouté le 2026-07-31 après qu'un vendeur nous ait montré le défaut. Le paiement est la
   * seule pièce signée d'une affaire, et il désigne le vendeur ; sans cette mise en garde,
   * un lecteur conclut « payé puis silence, donc le vendeur a encaissé sans livrer ». C'est
   * une conclusion que la donnée ne porte pas. Le déséquilibre vient du rail — une chaîne
   * enregistre un transfert de valeur, jamais une livraison — mais c'est notre mise en forme
   * qui le transformerait en verdict. On l'écrit donc au lieu d'en profiter.
   */
  what_a_file_does_not_prove: {
    principle:
      'A payment is the only signed artifact of most matters, and it points at the seller. That is a property of the payment rail, which records a transfer of value and never a delivery — not evidence about who was at fault.',
    consequence:
      'So a file showing a payment followed by silence does NOT mean the seller took the money and shipped nothing. It may equally mean the buyer got what it paid for and stopped reading, or walked away for reasons neither we nor the seller will ever know. Read the absence of a second leg as an absence, never as an admission.',
    what_we_do_about_it:
      'Either party may attach a signed, dated statement of the last thing it did and the last thing it was waiting for. Neither can write for the other. When one side speaks and the other does not, the file shows exactly that — whichever side it turns out to be.',
  },

  the_clock: {
    principle:
      'The reply window never exceeds the speed at which the counterparty bills. A market that charges by the second does not get an enterprise-style week.',
    windows: [
      { kind: 'machine' as ChannelKind, hours: REPLY_WINDOW_HOURS.machine, when: 'The counterparty publishes a machine contact point, so it is reachable continuously.' },
      { kind: 'human' as ChannelKind, hours: REPLY_WINDOW_HOURS.human, when: 'The counterparty exposes only a human channel.' },
      { kind: 'none' as ChannelKind, hours: REPLY_WINDOW_HOURS.none, when: 'The counterparty is reachable through no verifiable channel: the file is published with the failed notification and its trace attached. Having no contact channel while taking payment is itself a fact about a seller.' },
    ],
    /**
     * Mesuré le 2026-07-31, et écrit ici plutôt que découvert plus tard. Sur 1 071 adresses
     * payeuses observées sur Base, 92 se rattachent à un agent enregistré. Sur 154 fichiers
     * d'enregistrement lus, 88 % ne déclarent aucune adresse de paiement. Promettre une
     * notification puis échouer neuf fois sur dix serait une promesse tenue sur le papier.
     */
    reachability_reality:
      'Expect the third case to be the usual one, not the exception. Measured on 2026-07-31: of 1,071 payer addresses observed on Base, 92 resolve to a registered agent — about one in twelve — and 88% of the registration files we read declare no payment address at all. So when the counterparty is a paying address rather than a published seller, it will most often be unreachable, and the file will carry a failed notification. We say so here rather than let a reader assume the other side was usually asked.',
    never_before: 'Nothing is published before the window closes.',
    incentive:
      'Answering speeds up publication of your own side, and silence buys nothing: the file is published either way, and a reply arriving later is appended rather than refused.',
  },

  right_of_reply:
    'The counterparty is notified proactively and replies for free, unconditionally, forever. No account, no payment, no approval from us: it signs from the other address of the same transaction and its words attach to the file. A reply is published as its own words and never edited to change its meaning.',

  corrections:
    'A published file is never withdrawn. It is corrected with a date, or completed. That applies to our own mistakes too.',

  not_for_sale:
    'Nothing about a published complaint is ever for sale — not its removal, not its wording, not its ranking. No revenue may ever come from the seller side alone. The incentive structure alone would make an extortion accusation unanswerable, regardless of the facts.',

  limits: [
    {
      since: '2026-07-30',
      limit:
        'Verification, notification and publication are done by hand, by one person, on purpose for the first files. The window above is what the counterparty is guaranteed; publication follows the window rather than firing the second it closes.',
    },
    {
      since: '2026-07-30',
      limit:
        'Entry proof is an ordinary wallet signature, so a smart-contract wallet cannot yet prove control this way. Tell us and it is handled by hand rather than refused.',
    },
    {
      since: '2026-07-30',
      limit:
        'No file has been published yet. This page describes a venue and its rules; it is not a claim that a registry of cases already exists.',
    },
  ],
} as const

/** Les deux étapes du dépôt, servies à l'identique par l'endpoint et par la page. */
export const BUREAU_INTAKE_HOW_TO = {
  url: 'https://agentreputation.dev/api/complaints',
  method: 'POST',
  content_type: 'application/json',
  step_1:
    'POST your filing WITHOUT a signature field. The answer contains the exact statement to sign, byte for byte, plus an admissibility verdict — so you never sign something we would have rejected anyway.',
  step_2:
    'Sign that exact string with the address you claim (personal_sign / EIP-191) and POST the same body again with the signature added.',
  fields: {
    role: 'required — payer | payee, your side of the transaction',
    address: 'required — the 0x address you control and will sign with',
    counterparty_address: 'required — the other 0x address of the same transaction',
    network: 'required — CAIP-2, e.g. eip155:8453',
    matter_reference: 'required — the transaction hash, payment nonce or exchange id, as published',
    matter_url: 'optional — https URL where that reference can be read',
    settled_basis: `required — ${SETTLED_BASES.join(' | ')}`,
    terminal_state: `required for terminal_onchain_state — ${TERMINAL_STATES.join(' | ')}`,
    announced_deadline: 'required for frozen_past_deadline — YYYY-MM-DD, the deadline the seller or platform announced',
    settled_evidence: 'required — how a third party confirms the matter is settled without believing you',
    subject_label: 'required — the seller, resource or offer as it is published',
    account: 'required — your dated account of what happened (80 to 6000 characters)',
    counterparty_channel_kind: `required — ${CHANNEL_KINDS.join(' | ')}, which decides the reply window`,
    counterparty_channel: 'optional — the channel where the counterparty can be notified',
    filer_contact: 'required — private contact for verification, never published',
    filed_on: 'required — YYYY-MM-DD, the date of the statement you sign',
    signature: 'step 2 only — the 65-byte hex signature over the exact statement',
  },
  reply_url: 'https://agentreputation.dev/api/complaints/reply',
  reply_note:
    'The counterparty replies through the same two-step flow at reply_url, signing from the other address of the transaction. Replying is free and requires nothing from us.',
} as const

/** Ne renvoie JAMAIS le contact privé, ni celui du déposant ni celui de la contrepartie. */
export function filingReceipt(filing: FilingRecord, admissibilityNote: string) {
  return {
    filing_id: filing.id,
    // Distinct du `status` de la réponse HTTP, qui porte l'issue du dépôt
    // (filed / already_filed) et non l'état du dossier dans le registre.
    filing_status: filing.status,
    received_at: filing.createdAt,
    admissible_because: admissibilityNote,
    matter: {
      network: filing.network,
      reference: filing.matterReference,
      settled_basis: filing.settledBasis,
      terminal_state: filing.terminalState,
    },
    parties: {
      claimant: filing.address,
      claimant_role: filing.role,
      counterparty: filing.counterpartyAddress,
    },
    account_digest: filing.accountDigest,
    reply_window: {
      hours: filing.replyWindowHours,
      deadline: filing.replyDeadline,
      note:
        filing.counterpartyChannelKind === 'none'
          ? 'No verifiable channel was supplied for the counterparty. We attempt notification anyway; if it fails, the file is published with the failed attempt and its trace attached.'
          : `The counterparty is notified and gets ${filing.replyWindowHours} hour(s) to reply. Replying is free and speeds up publication of its own side; silence buys nothing.`,
    },
    what_happens_next:
      'The filing is verified by hand before anything is published — the first files by design. Nothing is published before the reply window closes. A published file is never withdrawn; it is corrected with a date.',
    published_url: filing.status === 'published' ? `/complaints/${filing.id}` : null,
  }
}
