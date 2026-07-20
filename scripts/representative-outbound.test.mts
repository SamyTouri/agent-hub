import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertInitialSendCapacity,
  canTransitionRepresentativeOutbound,
  githubIssueContentMatches,
  githubIssueMatchesRepo,
  githubIssueFromUrl,
  githubOrganizationFromUrl,
  githubRepoFromUrl,
  normalizeInitialOutboundDraft,
  normalizeRecordVersion,
  normalizeReviewNote,
  normalizeReviewer,
  prepareGitHubIssueDelivery,
  representativeOutboundRecordVersion,
  RepresentativeOutboundError,
  type RepresentativeOutboundStatus,
} from '../lib/representative-outbound.ts'

test('normalizes a reviewed initial draft without changing its substantive text', () => {
  const result = normalizeInitialOutboundDraft(
    'title: A precise field question\r\n\r\nHello maintainer.\r\n\r\nContext: https://example.com/path',
  )
  assert.equal(result.title, 'A precise field question')
  assert.equal(
    result.draft,
    'Title: A precise field question\n\nHello maintainer.\n\nContext: https://example.com/path',
  )
})

test('rejects malformed, empty, overlinked, and oversized drafts', () => {
  assert.throws(() => normalizeInitialOutboundDraft('Hello only'), RepresentativeOutboundError)
  assert.throws(() => normalizeInitialOutboundDraft('Title: Missing body'), RepresentativeOutboundError)
  assert.throws(
    () => normalizeInitialOutboundDraft('Title: Control\n\nunsafe\u0000body'),
    /control characters/,
  )
  assert.throws(
    () => normalizeInitialOutboundDraft('Title: Too many links\n\nhttps://one.test https://two.test'),
    /at most one link/,
  )
  assert.throws(
    () =>
      normalizeInitialOutboundDraft(
        'Title: https://one.test is in the title\n\nThe body has https://two.test too.',
      ),
    /at most one link/,
  )
  assert.throws(
    () => normalizeInitialOutboundDraft(`Title: Too long\n\n${'x'.repeat(4000)}`),
    /at most 4000/,
  )
})

test('checks the canonical draft length after title and newline normalization', () => {
  const title = 'T'
  const maximumBody = 'x'.repeat(4000 - `Title: ${title}\n\n`.length)
  assert.equal(
    normalizeInitialOutboundDraft(`Title:${title}\n${maximumBody}`).draft.length,
    4000,
  )
  assert.throws(
    () => normalizeInitialOutboundDraft(`Title:${title}\n${maximumBody}x`),
    /at most 4000/,
  )
})

test('validates reviewer identifiers and review notes', () => {
  assert.equal(normalizeReviewer('codex:desktop'), 'codex:desktop')
  assert.equal(normalizeReviewNote('  precise   factual review  '), 'precise factual review')
  assert.throws(() => normalizeReviewer(''), /reviewer identifier/)
  assert.throws(() => normalizeReviewNote(''), /review note/)
})

test('keeps shell-significant draft characters as inert text', () => {
  const body = 'Question: "$HOME"; `whoami`; $(Get-ChildItem); & exit 1?'
  const result = normalizeInitialOutboundDraft(`Title: A "quoted"; $title\n\n${body}`)
  assert.equal(result.title, 'A "quoted"; $title')
  assert.equal(result.body, body)
})

test('parses canonical GitHub repositories and issue URLs', () => {
  assert.equal(githubRepoFromUrl('https://github.com/Owner/repo.git'), 'Owner/repo')
  assert.deepEqual(githubIssueFromUrl('https://github.com/Owner/repo/issues/42'), {
    owner: 'Owner',
    repo: 'repo',
    number: 42,
  })
  assert.equal(githubIssueFromUrl('https://github.com/Owner/repo/pull/42'), null)
  assert.equal(githubIssueFromUrl('https://github.com/Owner/repo/issues/42#comment'), null)
  assert.equal(githubRepoFromUrl('https://user:pass@github.com/Owner/repo'), null)
  assert.equal(githubRepoFromUrl('https://github.com:444/Owner/repo'), null)
  assert.equal(
    githubIssueFromUrl('https://github.com/Owner/repo/issues/999999999999999999999'),
    null,
  )
})

test('requires a sent issue to belong to the prospect repository', () => {
  assert.equal(
    githubIssueMatchesRepo(
      'https://github.com/Owner/Repo',
      'https://github.com/owner/repo/issues/7',
    ),
    true,
  )
  assert.equal(
    githubIssueMatchesRepo(
      'https://github.com/Owner/Repo',
      'https://github.com/other/repo/issues/7',
    ),
    false,
  )
})

test('derives a stable MVCC-backed record version', () => {
  const first = representativeOutboundRecordVersion({
    id: '11111111-1111-4111-8111-111111111111',
    record_xmin: '42',
  })
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(normalizeRecordVersion(first.toUpperCase()), first)
  assert.equal(
    representativeOutboundRecordVersion({
      id: '11111111-1111-4111-8111-111111111111',
      record_xmin: '42',
    }),
    first,
  )
  assert.notEqual(
    representativeOutboundRecordVersion({
      id: '11111111-1111-4111-8111-111111111111',
      record_xmin: '43',
    }),
    first,
  )
  assert.throws(
    () =>
      representativeOutboundRecordVersion({
        id: '11111111-1111-4111-8111-111111111111',
        record_xmin: 'not-an-xid',
      }),
    /concurrency version/,
  )
})

test('prepares an exact, traceable GitHub wire body', () => {
  const delivery = prepareGitHubIssueDelivery(
    'Title: Field question\n\nExact reviewed body.',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  )
  assert.equal(delivery.title, 'Field question')
  assert.equal(
    delivery.marker,
    '<!-- agent-reputation-outbound:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222 -->',
  )
  assert.equal(delivery.body, `Exact reviewed body.\n\n${delivery.marker}`)
  assert.equal(githubIssueContentMatches(delivery, { title: delivery.title, body: delivery.body }), true)
  assert.equal(
    githubIssueContentMatches(delivery, {
      title: delivery.title,
      body: `${delivery.body}\n`,
    }),
    false,
  )
  assert.equal(
    githubIssueContentMatches(delivery, {
      title: delivery.title,
      body: delivery.body.replace(/\n/g, '\r\n'),
    }),
    true,
  )
})

test('normalizes GitHub organization identity across repo and issue URLs', () => {
  assert.equal(githubOrganizationFromUrl('https://github.com/Owner/Repo'), 'owner')
  assert.equal(githubOrganizationFromUrl('https://github.com/OWNER/Repo/issues/7'), 'owner')
  assert.equal(githubOrganizationFromUrl('https://example.com/Owner/Repo'), null)
})

test('enforces unanswered, daily, and per-run send caps', () => {
  assert.doesNotThrow(() =>
    assertInitialSendCapacity({
      unanswered: 4,
      sentToday: 4,
      sentThisRun: 1,
      dailyLimit: 5,
    }),
  )
  assert.throws(
    () =>
      assertInitialSendCapacity({
        unanswered: 5,
        sentToday: 0,
        sentThisRun: 0,
        dailyLimit: 5,
      }),
    /unanswered-contact cap/,
  )
  assert.throws(
    () =>
      assertInitialSendCapacity({
        unanswered: 0,
        sentToday: 5,
        sentThisRun: 0,
        dailyLimit: 5,
      }),
    /daily outbound cap/,
  )
  assert.throws(
    () =>
      assertInitialSendCapacity({
        unanswered: 0,
        sentToday: 0,
        sentThisRun: 2,
        dailyLimit: 5,
      }),
    /per-run outbound cap/,
  )
})

test('allows only the complete explicit outbound transition matrix', () => {
  const statuses: RepresentativeOutboundStatus[] = [
    'discovered',
    'qualified',
    'draft',
    'approved',
    'sent',
    'replied',
    'converted',
    'declined',
    'suppressed',
    'failed',
  ]
  const allowed = new Set([
    'discovered:suppressed',
    'discovered:failed',
    'qualified:suppressed',
    'qualified:failed',
    'draft:approved',
    'draft:suppressed',
    'draft:failed',
    'approved:sent',
    'approved:suppressed',
    'approved:failed',
    'sent:replied',
    'sent:converted',
    'sent:declined',
    'replied:converted',
    'replied:declined',
  ])
  for (const current of statuses) {
    for (const next of statuses) {
      assert.equal(
        canTransitionRepresentativeOutbound(current, next),
        allowed.has(`${current}:${next}`),
        `${current} -> ${next}`,
      )
    }
  }
})
