// La règle d'exploitation Moltbook — horloge et qualification, en logique pure.
//
// Ce module n'écrit rien, ne lit aucun fil et ne juge aucun texte libre. Il encode deux
// choses : QUAND regarder, et ce qui compte comme une réponse qualifiée. La lecture des
// fils et la publication restent à l'orchestrateur avec son connecteur ; ici on fixe la
// règle d'avance pour qu'elle ne se réécrive pas à la lumière du résultat.
//
// C'est le point important. Une campagne qui reçoit du silence, des compliments et une
// proposition de partenariat produit une envie irrésistible de requalifier ces signaux en
// demande. Écrire la barre avant de voir les réponses est la seule protection contre ça,
// et c'est pour cette raison que la qualification prend des signaux DÉCLARÉS par un
// humain ou un agent identifié, jamais une heuristique sur le texte : une machine qui
// devine « il a l'air intéressé » finirait par prouver ce qu'on espère.
//
// 2026-07-29 — l'horloge passe de deux portes (48 h puis 72 h) à une seule fenêtre de
// 24 h. Le bénéfice n'est pas la vitesse : c'est de supprimer une catégorie entière de
// décisions en attente. Deux portes obligeaient à revenir deux fois sur la même vague
// sans rien apprendre entre-temps, et une échéance gardée par acquit de conscience
// réintroduit exactement ce qu'elle devait éliminer.

export const MOLTBOOK_GATE_VERSION = 2

/** Durée de la fenêtre de réponse. Une seule, volontairement. */
export const RESPONSE_WINDOW_HOURS = 24

/** Fin de la première vague, telle qu'enregistrée. Point zéro de l'horloge par défaut. */
export const BATCH_1_COMPLETED_AT = '2026-07-26T16:47:42.798Z'

/** Prix public, inchangé à la porte. Une absence de réponse n'est pas un refus de prix,
 *  donc elle n'autorise pas à baisser le prix. */
export const PUBLIC_PRICE = '0.50 USDC'

const HOUR_MS = 3_600_000

export type GateName = 'response_window_24h'

export type Gate = {
  name: GateName
  hoursAfterBatch: number
  opensAt: string
  question: string
}

/**
 * L'unique porte de la vague.
 *
 * Elle pose une question fermée, pas une invitation à réévaluer : ce que cette vague
 * permet de conclure, et ce qu'elle ne permet pas. Il n'y a plus de « seconde porte pour
 * voir si quelque chose arrive » — c'était le mécanisme par lequel une vague morte
 * restait ouverte.
 */
export function moltbookGate(batchCompletedAt: string = BATCH_1_COMPLETED_AT): Gate {
  const zero = Date.parse(batchCompletedAt)
  if (!Number.isFinite(zero)) throw new Error(`unusable batch completion time: ${batchCompletedAt}`)
  return {
    name: 'response_window_24h',
    hoursAfterBatch: RESPONSE_WINDOW_HOURS,
    opensAt: new Date(zero + RESPONSE_WINDOW_HOURS * HOUR_MS).toISOString(),
    question:
      'Does any thread contain a qualified reply? Classify, record, move to the next qualified context. ' +
      'Silence is neutral, not a rejection. Do not reopen the sequence, do not resend, do not reword.',
  }
}

export type GateStatus = { gate: Gate; open: boolean; opensInHours: number }

/** Où en est l'horloge. `now` est fourni : rien ici ne lit l'heure tout seul, pour que le
 *  même instant produise toujours le même verdict. */
export function moltbookGateStatus(now: string, batchCompletedAt: string = BATCH_1_COMPLETED_AT): GateStatus {
  const nowMs = Date.parse(now)
  if (!Number.isFinite(nowMs)) throw new Error(`unusable current time: ${now}`)
  const gate = moltbookGate(batchCompletedAt)
  const opensMs = Date.parse(gate.opensAt)
  return {
    gate,
    open: nowMs >= opensMs,
    opensInHours: Math.round(((opensMs - nowMs) / HOUR_MS) * 100) / 100,
  }
}

/**
 * Une réponse arrivée après la fermeture de la fenêtre.
 *
 * Elle n'est ni ignorée ni motif de rouvrir la séquence : elle s'ajoute au dossier de la
 * vague, datée, et se juge sur les mêmes trois signaux. Sans cette règle écrite, la
 * tentation est de traiter le premier signe de vie tardif comme la preuve que la vague
 * « commençait à marcher ».
 */
export function isLateReply(replyAt: string, batchCompletedAt: string = BATCH_1_COMPLETED_AT): boolean {
  const replyMs = Date.parse(replyAt)
  if (!Number.isFinite(replyMs)) throw new Error(`unusable reply time: ${replyAt}`)
  return replyMs >= Date.parse(moltbookGate(batchCompletedAt).opensAt)
}

/**
 * Les trois signaux qu'une réponse doit porter ENSEMBLE pour compter comme demande.
 *
 * Chacun est déclaré, pas deviné. Deux sur trois ne suffisent pas : « je cherche un
 * fournisseur MCP » sans achat en cours est de la curiosité, et un achat en cours sans
 * conséquence d'échec est une transaction dont personne ne porte le risque — donc
 * personne n'a besoin de preuve avant de la faire.
 */
export type ReplySignals = {
  threadId: string
  /** Un achat réel est en cours, pas envisagé un jour. */
  namesPurchaseInProgress: boolean
  /** Un candidat précis est nommé, pas une catégorie. */
  namesSpecificCandidate: boolean
  /** Une conséquence concrète si ce candidat échoue. */
  namesConsequenceOfFailure: boolean
}

export type ReplyVerdict = {
  threadId: string
  qualified: boolean
  missing: string[]
}

const REQUIREMENTS: ReadonlyArray<{ key: keyof ReplySignals; missing: string }> = [
  { key: 'namesPurchaseInProgress', missing: 'no purchase in progress' },
  { key: 'namesSpecificCandidate', missing: 'no specific candidate' },
  { key: 'namesConsequenceOfFailure', missing: 'no concrete consequence of failure' },
]

export function classifyReply(signals: ReplySignals): ReplyVerdict {
  const missing = REQUIREMENTS.filter((requirement) => signals[requirement.key] !== true).map((r) => r.missing)
  return { threadId: signals.threadId, qualified: missing.length === 0, missing }
}

/**
 * Ce qui n'est PAS de la demande acheteur, et n'est pas non plus un refus de prix.
 *
 * Écrit en toutes lettres parce que ce sont exactement les réponses qu'une campagne
 * reçoit, et exactement celles qu'on est tenté de compter pour ne pas rentrer bredouille.
 */
export const NOT_BUYER_DEMAND: readonly string[] = [
  'A seller offering their own service is supply, not demand.',
  'A methodological discussion about evidence is interest in the idea, not a purchase.',
  'A partnership or integration proposal is a different transaction with a different buyer.',
  'A compliment is not a budget.',
  'Silence is not a rejection of the price: an unread message tests nothing.',
]

export type WaveDecision = 'qualified_demand' | 'no_qualified_demand'

export type WaveAssessment = {
  version: number
  gate: GateName
  assessed_at: string
  threads_reviewed: number
  qualified: string[]
  unqualified: ReplyVerdict[]
  decision: WaveDecision
  next_action: string
  price_unchanged: string
  not_buyer_demand: readonly string[]
  limits: readonly string[]
}

/**
 * Verdict borné d'une vague. Aucune conclusion marché n'en sort : trois fils ne mesurent
 * pas un marché, ils mesurent trois fils.
 */
export function assessWave(input: {
  assessedAt: string
  replies: readonly ReplySignals[]
  threadsReviewed: number
}): WaveAssessment {
  const verdicts = input.replies.map(classifyReply)
  const qualified = verdicts.filter((verdict) => verdict.qualified)
  const decision: WaveDecision = qualified.length > 0 ? 'qualified_demand' : 'no_qualified_demand'
  return {
    version: MOLTBOOK_GATE_VERSION,
    gate: 'response_window_24h',
    assessed_at: input.assessedAt,
    threads_reviewed: input.threadsReviewed,
    qualified: qualified.map((verdict) => verdict.threadId),
    unqualified: verdicts.filter((verdict) => !verdict.qualified),
    decision,
    next_action:
      decision === 'qualified_demand'
        ? 'Answer the qualified thread first. A wave is not needed to chase what already arrived.'
        : 'Close the wave with a bounded statement of what it did and did not test, then move to the next ' +
          'qualified context. Silence is neutral: do not restate it as a market conclusion, do not change the ' +
          'price on the strength of it, and do not reactivate the hourly routine. A later reply is appended to ' +
          'this record retrospectively and never reopens the sequence.',
    price_unchanged: PUBLIC_PRICE,
    not_buyer_demand: NOT_BUYER_DEMAND,
    limits: [
      'Three threads measure three threads. This is not a market test and cannot support a demand conclusion.',
      'An unread or unanswered message tests neither the offer nor the price.',
      'Qualification is declared by a reviewer, never inferred from tone or enthusiasm.',
      'The 24-hour window bounds when we decide, not when the market is allowed to answer.',
    ],
  }
}
