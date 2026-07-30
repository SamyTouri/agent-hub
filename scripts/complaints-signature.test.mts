import assert from 'node:assert/strict'
import test from 'node:test'
import { privateKeyToAccount } from 'viem/accounts'

import {
  FilingInputSchema,
  ReplyInputSchema,
  canonicalFilingStatement,
  canonicalReplyStatement,
  deriveFilingId,
  processFiling,
  processReply,
  type FilingDeps,
  type FilingInput,
  type FilingRecord,
  type ReplyDeps,
} from '../lib/complaints.ts'
import { recoverStatementSigner } from '../lib/complaints-signature.ts'

// Ce fichier exerce la VRAIE crypto de bout en bout : on signe avec une clé de
// test, puis on vérifie que le serveur retombe sur l'adresse attendue à partir de
// la déclaration qu'il reconstruit lui-même. Sans ça, le noyau métier pourrait
// être parfaitement testé et le guichet refuser toutes les signatures réelles.
//
// Clés de test publiques et jetables — jamais de secret réel dans le dépôt.
const CLAIMANT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const COUNTERPARTY_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'

const claimant = privateKeyToAccount(CLAIMANT_KEY)
const counterparty = privateKeyToAccount(COUNTERPARTY_KEY)
const NOW = new Date('2026-07-30T12:00:00.000Z')

const baseInput = (over: Partial<FilingInput> = {}): FilingInput =>
  FilingInputSchema.parse({
    role: 'payer',
    address: claimant.address,
    counterparty_address: counterparty.address,
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

const liveFilingDeps = () => {
  const stored: FilingRecord[] = []
  const deps: FilingDeps = {
    recoverSigner: recoverStatementSigner,
    findFiling: async (id) => stored.find((f) => f.id === id) ?? null,
    countRecentByAddress: async () => 0,
    insertFiling: async (record) => {
      stored.push(record)
      return record
    },
    now: () => NOW,
  }
  return { deps, stored }
}

test('a real wallet signature over the canonical statement is accepted', async () => {
  const input = baseInput()
  const signature = await claimant.signMessage({ message: canonicalFilingStatement(input) })
  const { deps, stored } = liveFilingDeps()
  const result = await processFiling(deps, input, signature)
  assert.equal(result.status, 'filed')
  assert.equal(stored.length, 1)
  assert.equal(stored[0].address, claimant.address.toLowerCase())
})

test('the recovered address is returned lowercase and matches the signer', async () => {
  const statement = canonicalFilingStatement(baseInput())
  const signature = await claimant.signMessage({ message: statement })
  assert.equal(await recoverStatementSigner(statement, signature), claimant.address.toLowerCase())
})

test('a signature made by the counterparty cannot open the payer file', async () => {
  const input = baseInput()
  const signature = await counterparty.signMessage({ message: canonicalFilingStatement(input) })
  const { deps, stored } = liveFilingDeps()
  const result = await processFiling(deps, input, signature)
  assert.equal(result.status, 'bad_signature')
  assert.equal(stored.length, 0)
})

test('a signature over a different account of the facts no longer verifies', async () => {
  const signed = baseInput()
  const signature = await claimant.signMessage({ message: canonicalFilingStatement(signed) })
  const swapped = baseInput({
    account:
      'Actually the seller delivered on time and in full, and I withdraw every complaint I made about this transaction.',
  })
  const { deps, stored } = liveFilingDeps()
  const result = await processFiling(deps, swapped, signature)
  assert.equal(result.status, 'bad_signature')
  assert.equal(stored.length, 0)
})

test('a signature over a different matter cannot be replayed onto another transaction', async () => {
  const signed = baseInput()
  const signature = await claimant.signMessage({ message: canonicalFilingStatement(signed) })
  const otherMatter = baseInput({ matter_reference: '0xabcdefabcdefabcdefabcdefabcdefabcdef' })
  const { deps } = liveFilingDeps()
  const result = await processFiling(deps, otherMatter, signature)
  assert.equal(result.status, 'bad_signature')
})

test('a truncated or padded signature is rejected rather than throwing', async () => {
  const statement = canonicalFilingStatement(baseInput())
  const signature = await claimant.signMessage({ message: statement })
  assert.equal(await recoverStatementSigner(statement, signature.slice(0, -2)), null)
  assert.equal(await recoverStatementSigner(statement, `${signature}ff`), null)
  assert.equal(await recoverStatementSigner(statement, '0xnot-a-signature'), null)
})

test('the counterparty replies with its own real signature', async () => {
  const input = ReplyInputSchema.parse({
    filing_id: deriveFilingId(baseInput()),
    address: counterparty.address,
    reply: 'The endpoint was migrated on 1 July and the old route stopped answering. A refund was sent.',
    replied_on: '2026-07-30',
  })
  const signature = await counterparty.signMessage({ message: canonicalReplyStatement(input) })
  const stored: string[] = []
  const deps: ReplyDeps = {
    recoverSigner: recoverStatementSigner,
    findFilingParties: async () => ({
      counterpartyAddress: counterparty.address.toLowerCase(),
      status: 'published',
    }),
    insertReply: async (record) => {
      stored.push(record.body)
    },
    now: () => NOW,
  }
  const result = await processReply(deps, input, signature)
  assert.equal(result.status, 'received')
  assert.equal(stored.length, 1)
})
