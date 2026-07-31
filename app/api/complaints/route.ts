import { z } from 'zod'
import {
  BUREAU_INTAKE_HOW_TO,
  BUREAU_METHOD,
  FilingInputSchema,
  canonicalFilingStatement,
  checkAdmissibility,
  filingReceipt,
  processFiling,
  type FilingInput,
} from '@/lib/complaints'
import { recoverStatementSigner } from '@/lib/complaints-signature'
import { countRecentByAddress, findFiling, insertFiling } from '@/lib/complaints-store'

export const runtime = 'nodejs'

// Intake privé du Complaint Bureau, en deux temps et sans compte :
//   1. POST sans signature -> on renvoie la déclaration EXACTE à signer, plus le
//      verdict de recevabilité. Personne ne signe une chose qu'on aurait refusée.
//   2. POST avec signature -> on reconstruit la même déclaration, on récupère
//      l'adresse signataire et on n'accepte que si elle est celle revendiquée.
//
// Rien n'est publié ici. Un dépôt reçu est vérifié à la main avant publication.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

const BodySchema = FilingInputSchema.extend({
  signature: z.string().trim().optional(),
})

const HOW_TO = {
  what: BUREAU_METHOD.what,
  who_may_file: BUREAU_METHOD.who_may_file,
  what_we_verify: BUREAU_METHOD.what_we_verify,
  what_we_never_verify: BUREAU_METHOD.what_we_never_verify,
  what_a_file_does_not_prove: BUREAU_METHOD.what_a_file_does_not_prove,
  the_clock: BUREAU_METHOD.the_clock,
  right_of_reply: BUREAU_METHOD.right_of_reply,
  corrections: BUREAU_METHOD.corrections,
  not_for_sale: BUREAU_METHOD.not_for_sale,
  limits: BUREAU_METHOD.limits,
  how: BUREAU_INTAKE_HOW_TO,
  human_page: 'https://agentreputation.dev/complaints',
}

async function handlePost(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON. GET this URL for the method and the field list.' }, 400)
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return json(
      {
        error: 'Invalid fields',
        details: parsed.error.flatten().fieldErrors,
        how: BUREAU_INTAKE_HOW_TO,
      },
      400,
    )
  }
  const { signature, ...rest } = parsed.data
  const input = rest as FilingInput

  // Étape 1 — pas de signature : on rend la déclaration exacte et le verdict de
  // recevabilité, sans rien stocker. Aucun effet de bord, donc rejouable.
  if (!signature) {
    const admissibility = checkAdmissibility(input, new Date())
    return json({
      status: 'statement_ready',
      admissible: admissibility.ok,
      ...(admissibility.ok
        ? { admissible_because: admissibility.note }
        : {
            not_admissible_because: admissibility.reason,
            ...(admissibility.admissible_from
              ? { admissible_from: admissibility.admissible_from }
              : {}),
          }),
      statement_to_sign: canonicalFilingStatement(input),
      next_step: BUREAU_INTAKE_HOW_TO.step_2,
      note:
        'Sign the statement exactly as returned, byte for byte, with no added or removed whitespace. Nothing has been stored by this call.',
    })
  }

  try {
    const result = await processFiling(
      {
        recoverSigner: recoverStatementSigner,
        findFiling,
        countRecentByAddress,
        insertFiling: (record) => insertFiling(record, input.filer_contact),
        now: () => new Date(),
      },
      input,
      signature,
    )

    switch (result.status) {
      case 'filed':
        return json({ status: 'filed', ...filingReceipt(result.filing, result.admissibility.note) }, 201)
      case 'already_filed':
        return json({
          status: 'already_filed',
          ...filingReceipt(
            result.filing,
            'Already on record — this address had already filed on this matter in this role.',
          ),
        })
      case 'inadmissible':
        return json(
          {
            status: 'inadmissible',
            reason: result.reason,
            ...(result.admissible_from ? { admissible_from: result.admissible_from } : {}),
            rule: BUREAU_METHOD.who_may_file.rule,
          },
          422,
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
      case 'rate_limited':
        return json({ status: 'rate_limited', reason: result.reason }, 429)
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
