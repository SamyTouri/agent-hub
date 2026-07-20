import { createHash } from 'node:crypto'

export type GitHubIssueRef = {
  owner: string
  repo: string
  number: number
}

export type RepresentativeOutboundStatus =
  | 'discovered'
  | 'qualified'
  | 'draft'
  | 'approved'
  | 'sent'
  | 'replied'
  | 'converted'
  | 'declined'
  | 'suppressed'
  | 'failed'

export class RepresentativeOutboundError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'RepresentativeOutboundError'
    this.status = status
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function normalizeReviewer(value: unknown) {
  if (typeof value !== 'string') {
    throw new RepresentativeOutboundError('A reviewer identifier is required.')
  }
  const reviewer = value.trim()
  if (!/^[A-Za-z0-9_.:@/-]{2,80}$/.test(reviewer)) {
    throw new RepresentativeOutboundError('The reviewer identifier is invalid.')
  }
  return reviewer
}

export function normalizeReviewNote(value: unknown, max = 1000) {
  if (typeof value !== 'string') {
    throw new RepresentativeOutboundError('A review note is required.')
  }
  const note = value.replace(/\s+/g, ' ').trim()
  if (!note || note.length > max) {
    throw new RepresentativeOutboundError(`The review note must contain 1 to ${max} characters.`)
  }
  return note
}

export function normalizeInitialOutboundDraft(value: unknown) {
  if (typeof value !== 'string') {
    throw new RepresentativeOutboundError('A reviewed initial draft is required.')
  }
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) {
    throw new RepresentativeOutboundError('The reviewed draft must not be empty.')
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new RepresentativeOutboundError('The reviewed draft contains forbidden control characters.')
  }
  const [firstLine, ...bodyLines] = normalized.split('\n')
  const titleMatch = /^Title:\s*(.+)$/i.exec(firstLine.trim())
  const title = titleMatch?.[1]?.trim() ?? ''
  const body = bodyLines.join('\n').trim()
  if (!title || title.length > 256 || !body) {
    throw new RepresentativeOutboundError(
      'The reviewed draft must start with "Title: ..." (256 characters maximum) and include a body.',
    )
  }
  const draft = `Title: ${title}\n\n${body}`
  const links = draft.match(/https?:\/\/[^\s<>()]+/gi) ?? []
  if (links.length > 1) {
    throw new RepresentativeOutboundError('The reviewed draft may contain at most one link.')
  }
  if (draft.length > 4000) {
    throw new RepresentativeOutboundError(
      'The canonical reviewed draft must contain at most 4000 characters.',
    )
  }
  return {
    draft,
    title,
    body,
  }
}

export function normalizeRecordVersion(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new RepresentativeOutboundError('A valid outbound record version is required.')
  }
  return value.toLowerCase()
}

export function representativeOutboundRecordVersion(row: {
  id?: unknown
  record_xmin?: unknown
}) {
  // xmin is used only as a short-lived MVCC compare-and-swap token. Hashing it
  // with the stable row id keeps the HTTP value opaque; it is not a long-term id.
  const id = normalizeUuid(row.id, 'outbound id')
  const xmin = String(row.record_xmin ?? '')
  if (!/^[0-9]+$/.test(xmin)) {
    throw new RepresentativeOutboundError('The outbound record has no valid concurrency version.', 409)
  }
  return sha256(`${id}:${xmin}`)
}

export function normalizeUuid(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new RepresentativeOutboundError(`A valid ${label} is required.`)
  }
  return value.toLowerCase()
}

export function prepareGitHubIssueDelivery(
  reviewedDraft: unknown,
  outboundId: unknown,
  sendAttemptId: unknown,
) {
  const reviewed = normalizeInitialOutboundDraft(reviewedDraft)
  const id = normalizeUuid(outboundId, 'outbound id')
  const attemptId = normalizeUuid(sendAttemptId, 'send attempt id')
  const marker = `<!-- agent-reputation-outbound:${id}:${attemptId} -->`
  const body = `${reviewed.body}\n\n${marker}`
  const deliveryDraft = `Title: ${reviewed.title}\n\n${body}`
  return {
    title: reviewed.title,
    body,
    marker,
    reviewedDraft: reviewed.draft,
    reviewedDraftSha256: sha256(reviewed.draft),
    deliveryDraft,
    deliveryDraftSha256: sha256(deliveryDraft),
  }
}

export function githubIssueContentMatches(
  expected: { title: string; body: string },
  actual: { title?: unknown; body?: unknown },
) {
  const normalizeLineEndings = (value: string) => value.replace(/\r\n?/g, '\n')
  return (
    typeof actual.title === 'string' &&
    typeof actual.body === 'string' &&
    normalizeLineEndings(actual.title) === normalizeLineEndings(expected.title) &&
    normalizeLineEndings(actual.body) === normalizeLineEndings(expected.body)
  )
}

export function githubOrganizationFromUrl(value: string) {
  const repo = githubRepoFromUrl(value)
  if (repo) return repo.split('/')[0].toLocaleLowerCase('en-US')
  const issue = githubIssueFromUrl(value)
  return issue?.owner.toLocaleLowerCase('en-US') ?? null
}

export function assertInitialSendCapacity(input: {
  unanswered: number
  sentToday: number
  sentThisRun: number
  dailyLimit: number
  unansweredLimit?: number
  perRunLimit?: number
}) {
  const unansweredLimit = input.unansweredLimit ?? 5
  const perRunLimit = input.perRunLimit ?? 2
  if (input.unanswered >= unansweredLimit) {
    throw new RepresentativeOutboundError(
      `The unanswered-contact cap (${unansweredLimit}) is already reached.`,
      409,
    )
  }
  if (input.sentToday >= input.dailyLimit) {
    throw new RepresentativeOutboundError(
      `The daily outbound cap (${input.dailyLimit}) is already reached.`,
      409,
    )
  }
  if (input.sentThisRun >= perRunLimit) {
    throw new RepresentativeOutboundError(
      `The per-run outbound cap (${perRunLimit}) is already reached.`,
      409,
    )
  }
}

export function githubRepoFromUrl(repoUrl: string) {
  try {
    const url = new URL(repoUrl)
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLocaleLowerCase('en-US') !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null
    }
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length !== 2) return null
    const owner = segments[0]
    const repo = segments[1].replace(/\.git$/i, '')
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null
    return `${owner}/${repo}`
  } catch {
    return null
  }
}

export function githubIssueFromUrl(issueUrl: string): GitHubIssueRef | null {
  try {
    const url = new URL(issueUrl)
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLocaleLowerCase('en-US') !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null
    }
    const segments = url.pathname.split('/').filter(Boolean)
    if (
      segments.length !== 4 ||
      segments[2] !== 'issues' ||
      !/^[A-Za-z0-9_.-]+$/.test(segments[0]) ||
      !/^[A-Za-z0-9_.-]+$/.test(segments[1]) ||
      !/^[1-9][0-9]*$/.test(segments[3])
    ) {
      return null
    }
    const number = Number(segments[3])
    if (!Number.isSafeInteger(number)) return null
    return { owner: segments[0], repo: segments[1], number }
  } catch {
    return null
  }
}

export function githubIssueMatchesRepo(repoUrl: string, issueUrl: string) {
  const repo = githubRepoFromUrl(repoUrl)
  const issue = githubIssueFromUrl(issueUrl)
  if (!repo || !issue) return false
  return repo.toLocaleLowerCase('en-US') ===
    `${issue.owner}/${issue.repo}`.toLocaleLowerCase('en-US')
}

export function canTransitionRepresentativeOutbound(
  current: RepresentativeOutboundStatus,
  next: RepresentativeOutboundStatus,
) {
  const allowed: Partial<Record<RepresentativeOutboundStatus, RepresentativeOutboundStatus[]>> = {
    discovered: ['suppressed', 'failed'],
    qualified: ['suppressed', 'failed'],
    draft: ['approved', 'suppressed', 'failed'],
    approved: ['sent', 'suppressed', 'failed'],
    sent: ['replied', 'converted', 'declined'],
    replied: ['converted', 'declined'],
  }
  return allowed[current]?.includes(next) ?? false
}
