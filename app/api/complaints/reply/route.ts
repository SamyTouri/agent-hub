import { z } from 'zod'
import {
  BUREAU_METHOD,
  ReplyInputSchema,
  canonicalReplyStatement,
  processReply,
  type ReplyInput,
} from '@/lib/complaints'
import { recoverStatementSigner } from '@/lib/complaints-signature'
import { findFilingParties, insertReply } from '@/lib/complaints-store'

export const runtime = 'nodejs'

// Droit de réponse de la contrepartie. Même mécanique en deux temps que l'intake,
// et surtout : aucun compte, aucun paiement, aucun accord de notre part. La seule
// condition est de contrôler l'AUTRE adresse de la même transaction.
//
// C'est le point où le guichet cesse d'être à sens unique : sans cet endpoint, la
// réponse dépendrait de notre bon vouloir, et « gratuit et inconditionnel »
// serait une intention plutôt qu'un mécanisme.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

const BodySchema = ReplyInputSchema.extend({
  signature: z.string().trim().optional(),
})

const HOW_TO = {
  what: BUREAU_METHOD.right_of_reply,
  how: {
    method: 'POST',
    url: 'https://agentreputation.dev/api/complaints/reply',
    content_type: 'application/json',
    step_1: 'POST without a signature field to receive the exact statement to sign.',
    step_2: 'Sign it with the counterparty address of the file (personal_sign / EIP-191) and POST again with the signature.',
    fields: {
      filing_id: 'required — the file reference, e.g. cb-0123456789abcdef0123',
      address: 'required — the counterparty address recorded on that file',
      reply: 'required — your reply, in your own words (20 to 6000 characters)',
      replied_on: 'required — YYYY-MM-DD, the date of the statement you sign',
      signature: 'step 2 only — the 65-byte hex signature over the exact statement',
    },
  },
  cost: 'Nothing. Replying is free, unconditional and permanent, before or after publication.',
  editing: 'Your reply is published as your own words. We never edit it to change its meaning.',
  disagreement:
    'A complaint you dispute without contrary evidence stays published as disputed, with your reply linked. Denial alone does not remove it, and a threat sent instead of a reply is published verbatim with the file.',
  human_page: 'https://agentreputation.dev/complaints',
}

async function handlePost(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON. GET this URL for the field list.' }, 400)
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'Invalid fields', details: parsed.error.flatten().fieldErrors, how: HOW_TO.how }, 400)
  }
  const { signature, ...rest } = parsed.data
  const input = rest as ReplyInput

  if (!signature) {
    return json({
      status: 'statement_ready',
      statement_to_sign: canonicalReplyStatement(input),
      next_step: HOW_TO.how.step_2,
      note: 'Sign the statement exactly as returned, byte for byte. Nothing has been stored by this call.',
    })
  }

  try {
    const result = await processReply(
      {
        recoverSigner: recoverStatementSigner,
        findFilingParties,
        insertReply,
        now: () => new Date(),
      },
      input,
      signature,
    )

    switch (result.status) {
      case 'received':
        return json(
          {
            status: 'received',
            filing_id: result.record.filingId,
            received_at: result.record.receivedAt,
            reply_digest: result.record.bodyDigest,
            what_happens_next:
              'Your reply is on the file permanently. While the bureau is operated by hand, it is read before it is rendered on the public page; the file states that a reply was received and on which date, so silence and an answer are never shown as the same thing.',
            editing: HOW_TO.editing,
          },
          201,
        )
      case 'unknown_filing':
        return json({ status: 'unknown_filing', reason: 'No file carries that reference.' }, 404)
      case 'not_the_counterparty':
        return json(
          {
            status: 'not_the_counterparty',
            reason:
              'That address is not the counterparty recorded on this file. Only the other address of the same transaction can reply by signature.',
            note: 'If you are the seller behind that address but cannot sign with it, use the feedback channel and it is handled by hand: https://agentreputation.dev/api/feedback',
          },
          403,
        )
      case 'bad_signature':
        return json(
          {
            status: 'bad_signature',
            reason: result.reason,
            note: 'POST the same body without the signature field to get the exact statement to sign.',
          },
          401,
        )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed'
    return json({ error: msg }, 500)
  }
}

export const POST = handlePost

export async function GET() {
  return json(HOW_TO)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
