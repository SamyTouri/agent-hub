import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUREAU_METHOD,
  FREEZE_DAYS,
  FilingInputSchema,
  MAX_FILINGS_PER_ADDRESS_PER_DAY,
  REPLY_WINDOW_HOURS,
  ReplyInputSchema,
  STATEMENT_MAX_AGE_DAYS,
  canonicalFilingStatement,
  canonicalReplyStatement,
  checkAdmissibility,
  deriveFilingId,
  filingReceipt,
  normalizeProse,
  processFiling,
  processReply,
  proseDigest,
  replyWindow,
  type FilingDeps,
  type FilingInput,
  type FilingRecord,
  type ReplyDeps,
  type ReplyInput,
} from '../lib/complaints.ts'

const CLAIMANT = '0x1111111111111111111111111111111111111111'
const COUNTERPARTY = '0x2222222222222222222222222222222222222222'
const SIG = `0x${'ab'.repeat(65)}`
const NOW = new Date('2026-07-30T12:00:00.000Z')

const baseInput = (over: Partial<FilingInput> = {}): FilingInput =>
  FilingInputSchema.parse({
    role: 'payer',
    address: CLAIMANT,
    counterparty_address: COUNTERPARTY,
    network: 'eip155:8453',
    matter_reference: '0xfeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedfacefeedface',
    settled_basis: 'payment_reached_payee',
    settled_evidence: 'The transfer is visible on Base and the payee address is the one advertised.',
    subject_label: 'example-agent paid summary endpoint',
    account:
      'I paid 0.50 USDC for a summary endpoint on 2026-07-02. The call returned HTTP 200 with an empty body, and three retries over the following week behaved the same way. No refund was offered.',
    counterparty_channel_kind: 'machine',
    filer_contact: 'buyer@example.com',
    filed_on: '2026-07-30',
    ...over,
  })

// ---------------------------------------------------------------------------
// Recevabilité : c'est le moment qui est jugé, jamais le fond de la plainte.
// ---------------------------------------------------------------------------

test('a payment that reached the payee is admissible', () => {
  const verdict = checkAdmissibility(baseInput(), NOW)
  assert.equal(verdict.ok, true)
})

test('a terminal on-chain state requires naming that state', () => {
  const missing = checkAdmissibility(baseInput({ settled_basis: 'terminal_onchain_state' }), NOW)
  assert.equal(missing.ok, false)
  assert.match(missing.ok === false ? missing.reason : '', /terminal_state/)

  const named = checkAdmissibility(
    baseInput({ settled_basis: 'terminal_onchain_state', terminal_state: 'refunded' }),
    NOW,
  )
  assert.equal(named.ok, true)
})

test('a freeze is inadmissible until thirty days past the announced deadline, and says when it will be', () => {
  const tooEarly = checkAdmissibility(
    baseInput({ settled_basis: 'frozen_past_deadline', announced_deadline: '2026-07-20' }),
    NOW,
  )
  assert.equal(tooEarly.ok, false)
  assert.equal(tooEarly.ok === false ? tooEarly.admissible_from : '', '2026-08-19')

  const ripe = checkAdmissibility(
    baseInput({ settled_basis: 'frozen_past_deadline', announced_deadline: '2026-06-01' }),
    NOW,
  )
  assert.equal(ripe.ok, true)
})

test('a deadline still in the future is refused because the funds are genuinely in play', () => {
  const verdict = checkAdmissibility(
    baseInput({ settled_basis: 'frozen_past_deadline', announced_deadline: '2026-09-01' }),
    NOW,
  )
  assert.equal(verdict.ok, false)
  assert.match(verdict.ok === false ? verdict.reason : '', /still genuinely in play/)
})

test('the freeze threshold in the method text is the one the code enforces', () => {
  const frozenCase = BUREAU_METHOD.who_may_file.settled_cases.find(
    (c) => c.id === 'frozen_past_deadline',
  )
  assert.ok(frozenCase)
  assert.match(frozenCase.title, new RegExp(`${FREEZE_DAYS} days`))
})

test('a stale signed statement is refused rather than silently accepted', () => {
  const stale = checkAdmissibility(baseInput({ filed_on: '2026-06-01' }), NOW)
  assert.equal(stale.ok, false)
  assert.match(stale.ok === false ? stale.reason : '', new RegExp(`${STATEMENT_MAX_AGE_DAYS} days`))
})

test('a statement dated in the future is refused, with one day of timezone tolerance', () => {
  assert.equal(checkAdmissibility(baseInput({ filed_on: '2026-07-31' }), NOW).ok, true)
  const future = checkAdmissibility(baseInput({ filed_on: '2026-08-05' }), NOW)
  assert.equal(future.ok, false)
  assert.match(future.ok === false ? future.reason : '', /future/)
})

// ---------------------------------------------------------------------------
// Déclaration signée : reproductible à l'octet, et liée à CE récit
// ---------------------------------------------------------------------------

test('the statement is byte-identical whatever the address casing or line endings', () => {
  const a = canonicalFilingStatement(baseInput())
  const b = canonicalFilingStatement(
    baseInput({
      address: CLAIMANT.toUpperCase().replace('0X', '0x'),
      counterparty_address: COUNTERPARTY.toUpperCase().replace('0X', '0x'),
      network: 'EIP155:8453'.toLowerCase(),
    }),
  )
  assert.equal(a, b)
})

test('changing the account changes the statement, so a leaked signature cannot restate the facts', () => {
  const original = canonicalFilingStatement(baseInput())
  const rewritten = canonicalFilingStatement(
    baseInput({
      account:
        'Actually the seller delivered on time and in full, and I withdraw every complaint I made about this transaction and about its operator.',
    }),
  )
  assert.notEqual(original, rewritten)
})

test('CRLF and trailing spaces do not change the signed digest', () => {
  const text = 'line one   \r\nline two\r\n'
  assert.equal(normalizeProse(text), 'line one\nline two')
  assert.equal(proseDigest(text), proseDigest('line one\nline two'))
})

test('the statement carries the address, the role, the matter and the account digest', () => {
  const input = baseInput()
  const statement = canonicalFilingStatement(input)
  assert.match(statement, new RegExp(`address: ${CLAIMANT}`))
  assert.match(statement, /role: payer/)
  assert.match(statement, new RegExp(`counterparty: ${COUNTERPARTY}`))
  assert.match(statement, new RegExp(`account_digest: ${proseDigest(input.account)}`))
})

test('the reply statement binds the file and the reply text', () => {
  const input: ReplyInput = ReplyInputSchema.parse({
    filing_id: deriveFilingId(baseInput()),
    address: COUNTERPARTY,
    reply: 'The endpoint was migrated on 1 July and the old route stopped answering.',
    replied_on: '2026-07-30',
  })
  const statement = canonicalReplyStatement(input)
  assert.match(statement, new RegExp(`file: ${input.filing_id}`))
  assert.match(statement, new RegExp(`reply_digest: ${proseDigest(input.reply)}`))
})

// ---------------------------------------------------------------------------
// Identifiant dérivé : un rejeu retombe sur le même dossier
// ---------------------------------------------------------------------------

test('the filing id is derived from the matter and the claimant, not from the account', () => {
  const id = deriveFilingId(baseInput())
  assert.match(id, /^cb-[0-9a-f]{20}$/)
  assert.equal(id, deriveFilingId(baseInput({ account: `${baseInput().account} Additional detail.` })))
  assert.notEqual(id, deriveFilingId(baseInput({ role: 'payee' })))
  assert.notEqual(id, deriveFilingId(baseInput({ matter_reference: '0xdeadbeefdeadbeef' })))
})

// ---------------------------------------------------------------------------
// Délai de réponse : jamais plus lent que la facturation de la contrepartie
// ---------------------------------------------------------------------------

test('the reply window follows the channel the counterparty actually exposes', () => {
  assert.equal(replyWindow('machine', NOW).hours, 1)
  assert.equal(replyWindow('human', NOW).deadline, '2026-07-31T12:00:00.000Z')
  const unreachable = replyWindow('none', NOW)
  assert.equal(unreachable.unreachable, true)
  assert.equal(unreachable.deadline, NOW.toISOString())
})

test('the published windows are the ones the code applies', () => {
  for (const w of BUREAU_METHOD.the_clock.windows) {
    assert.equal(w.hours, REPLY_WINDOW_HOURS[w.kind])
  }
})

// ---------------------------------------------------------------------------
// Orchestration du dépôt
// ---------------------------------------------------------------------------

function filingDeps(over: Partial<FilingDeps> = {}) {
  const stored: FilingRecord[] = []
  const deps: FilingDeps = {
    recoverSigner: async () => CLAIMANT.toLowerCase(),
    findFiling: async (id) => stored.find((f) => f.id === id) ?? null,
    countRecentByAddress: async () => 0,
    insertFiling: async (record) => {
      stored.push(record)
      return record
    },
    now: () => NOW,
    ...over,
  }
  return { deps, stored }
}

test('a valid filing is stored with its proof and its reply deadline', async () => {
  const { deps, stored } = filingDeps()
  const result = await processFiling(deps, baseInput(), SIG)
  assert.equal(result.status, 'filed')
  assert.equal(stored.length, 1)
  assert.equal(stored[0].status, 'received')
  assert.equal(stored[0].signature, SIG)
  assert.equal(stored[0].signedStatement, canonicalFilingStatement(baseInput()))
  assert.equal(stored[0].replyWindowHours, 1)
  assert.equal(stored[0].replyDeadline, '2026-07-30T13:00:00.000Z')
})

test('a signature recovering to another address is refused', async () => {
  const { deps, stored } = filingDeps({ recoverSigner: async () => COUNTERPARTY.toLowerCase() })
  const result = await processFiling(deps, baseInput(), SIG)
  assert.equal(result.status, 'bad_signature')
  assert.equal(stored.length, 0)
})

test('an unverifiable signature is refused and nothing is stored', async () => {
  const { deps, stored } = filingDeps({ recoverSigner: async () => null })
  const result = await processFiling(deps, baseInput(), SIG)
  assert.equal(result.status, 'bad_signature')
  assert.equal(stored.length, 0)
})

test('a malformed signature never reaches recovery', async () => {
  let called = false
  const { deps } = filingDeps({
    recoverSigner: async () => {
      called = true
      return CLAIMANT.toLowerCase()
    },
  })
  const result = await processFiling(deps, baseInput(), '0xdeadbeef')
  assert.equal(result.status, 'bad_signature')
  assert.equal(called, false)
})

test('an inadmissible filing is refused before any signature work', async () => {
  let called = false
  const { deps, stored } = filingDeps({
    recoverSigner: async () => {
      called = true
      return CLAIMANT.toLowerCase()
    },
  })
  const result = await processFiling(
    deps,
    baseInput({ settled_basis: 'frozen_past_deadline', announced_deadline: '2026-07-25' }),
    SIG,
  )
  assert.equal(result.status, 'inadmissible')
  assert.equal(called, false)
  assert.equal(stored.length, 0)
})

test('the same address cannot be both parties to the transaction', async () => {
  const { deps } = filingDeps()
  const result = await processFiling(deps, baseInput({ counterparty_address: CLAIMANT }), SIG)
  assert.equal(result.status, 'inadmissible')
})

test('a replayed filing returns the existing file instead of a duplicate', async () => {
  const { deps, stored } = filingDeps()
  await processFiling(deps, baseInput(), SIG)
  const again = await processFiling(deps, baseInput(), SIG)
  assert.equal(again.status, 'already_filed')
  assert.equal(stored.length, 1)
})

test('a replay is answered even once the daily cap is reached', async () => {
  const { deps, stored } = filingDeps()
  await processFiling(deps, baseInput(), SIG)
  const capped = await processFiling(
    { ...deps, countRecentByAddress: async () => MAX_FILINGS_PER_ADDRESS_PER_DAY },
    baseInput(),
    SIG,
  )
  assert.equal(capped.status, 'already_filed')
  assert.equal(stored.length, 1)
})

test('a new filing beyond the daily cap is rate limited', async () => {
  const { deps, stored } = filingDeps({
    countRecentByAddress: async () => MAX_FILINGS_PER_ADDRESS_PER_DAY,
  })
  const result = await processFiling(deps, baseInput(), SIG)
  assert.equal(result.status, 'rate_limited')
  assert.equal(stored.length, 0)
})

test('the receipt never leaks the private contact and points at no page before publication', async () => {
  const { deps } = filingDeps()
  const result = await processFiling(deps, baseInput(), SIG)
  assert.equal(result.status, 'filed')
  if (result.status !== 'filed') return
  const receipt = filingReceipt(result.filing, result.admissibility.note)
  assert.equal(JSON.stringify(receipt).includes('buyer@example.com'), false)
  assert.equal(receipt.published_url, null)
})

test('an unreachable counterparty is told on the receipt that the failed notice is published', async () => {
  const { deps } = filingDeps()
  const result = await processFiling(deps, baseInput({ counterparty_channel_kind: 'none' }), SIG)
  assert.equal(result.status, 'filed')
  if (result.status !== 'filed') return
  const receipt = filingReceipt(result.filing, result.admissibility.note)
  assert.match(receipt.reply_window.note, /failed attempt and its trace/)
})

// ---------------------------------------------------------------------------
// Droit de réponse
// ---------------------------------------------------------------------------

function replyDeps(over: Partial<ReplyDeps> = {}) {
  const stored: Array<{ filingId: string; body: string }> = []
  const deps: ReplyDeps = {
    recoverSigner: async () => COUNTERPARTY.toLowerCase(),
    findFilingParties: async () => ({ counterpartyAddress: COUNTERPARTY, status: 'published' }),
    insertReply: async (record) => {
      stored.push({ filingId: record.filingId, body: record.body })
    },
    now: () => NOW,
    ...over,
  }
  return { deps, stored }
}

const replyInput = (over: Partial<ReplyInput> = {}): ReplyInput =>
  ReplyInputSchema.parse({
    filing_id: deriveFilingId(baseInput()),
    address: COUNTERPARTY,
    reply: 'The endpoint was migrated on 1 July and the old route stopped answering. A refund was sent.',
    replied_on: '2026-07-30',
    ...over,
  })

test('the counterparty can reply with no account and no approval from us', async () => {
  const { deps, stored } = replyDeps()
  const result = await processReply(deps, replyInput(), SIG)
  assert.equal(result.status, 'received')
  assert.equal(stored.length, 1)
})

test('a reply is accepted before publication too', async () => {
  const { deps, stored } = replyDeps({
    findFilingParties: async () => ({ counterpartyAddress: COUNTERPARTY, status: 'received' }),
  })
  const result = await processReply(deps, replyInput(), SIG)
  assert.equal(result.status, 'received')
  assert.equal(stored.length, 1)
})

test('only the counterparty of that file can reply by signature', async () => {
  const { deps, stored } = replyDeps({
    findFilingParties: async () => ({
      counterpartyAddress: '0x3333333333333333333333333333333333333333',
      status: 'published',
    }),
  })
  const result = await processReply(deps, replyInput(), SIG)
  assert.equal(result.status, 'not_the_counterparty')
  assert.equal(stored.length, 0)
})

test('a reply to an unknown file is refused', async () => {
  const { deps } = replyDeps({ findFilingParties: async () => null })
  const result = await processReply(deps, replyInput(), SIG)
  assert.equal(result.status, 'unknown_filing')
})

test('a reply signed by the wrong key is refused', async () => {
  const { deps, stored } = replyDeps({ recoverSigner: async () => CLAIMANT.toLowerCase() })
  const result = await processReply(deps, replyInput(), SIG)
  assert.equal(result.status, 'bad_signature')
  assert.equal(stored.length, 0)
})

// ---------------------------------------------------------------------------
// Bornes du schéma d'entrée
// ---------------------------------------------------------------------------

test('the intake refuses a hash-only reference, a bad address and a non-https matter url', () => {
  assert.equal(FilingInputSchema.safeParse({ ...baseInput(), address: '0x1234' }).success, false)
  assert.equal(FilingInputSchema.safeParse({ ...baseInput(), matter_reference: '0x12' }).success, false)
  assert.equal(
    FilingInputSchema.safeParse({ ...baseInput(), matter_url: 'http://example.com/tx' }).success,
    false,
  )
  assert.equal(FilingInputSchema.safeParse({ ...baseInput(), network: 'mainnet' }).success, false)
  assert.equal(FilingInputSchema.safeParse({ ...baseInput(), filed_on: '30-07-2026' }).success, false)
})

test('an account too short to be an account is refused', () => {
  assert.equal(FilingInputSchema.safeParse({ ...baseInput(), account: 'it broke' }).success, false)
})
