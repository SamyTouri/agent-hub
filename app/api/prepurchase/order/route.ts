import { getSql, withTimeout } from '@/lib/db'
import { withOrigin } from '@/lib/request-context'
import { createCdpFacilitatorClient } from '@coinbase/cdp-sdk/x402'
import { HTTPFacilitatorClient, type FacilitatorClient } from '@x402/core/server'
import type {
  PaymentPayload as OfficialPaymentPayload,
  PaymentRequirements as OfficialPaymentRequirements,
} from '@x402/core/types'
import {
  buildPaymentRequired,
  buildPaymentRequirements,
  orderReceipt,
  OrderInputSchema,
  parsePrepurchaseConfig,
  processPaidOrder,
  PREPURCHASE_PRICE_ATOMIC,
  PREPURCHASE_REVENUE_CAP_ATOMIC,
  type PaidOrderDeps,
  type OrderReservation,
  type StoredOrder,
} from '@/lib/prepurchase'
import {
  decodeBase64Json,
  encodeBase64Json,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
  HEADER_PAYMENT_SIGNATURE,
  PaymentPayloadV2Schema,
  type PaymentPayloadV2,
  type SettleResponse,
  type VerifyResponse,
} from '@/lib/x402'

export const runtime = 'nodejs'
// Jamais prérendu : la config est lue à la requête, jamais au build.
export const dynamic = 'force-dynamic'

// Endpoint payé x402 v2 du brief de preuve préachat (1 USDC, Base Sepolia par
// défaut). Flux : POST sans header PAYMENT-SIGNATURE -> 402 + challenge ;
// POST avec paiement signé -> verify + settle via facilitator -> enregistrement
// idempotent de la commande -> reçu stable. La livraison reste manuelle.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': `Content-Type, ${HEADER_PAYMENT_SIGNATURE}`,
  'Access-Control-Expose-Headers': `${HEADER_PAYMENT_REQUIRED}, ${HEADER_PAYMENT_RESPONSE}`,
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...CORS_HEADERS, ...headers } })

const MAX_ORDER_BODY_BYTES = 16_384

const HOW_TO = {
  what:
    'Paid x402 endpoint — one fixed-scope manual pre-purchase evidence brief for 1 USDC. You are an agent (or operator) about to buy a service from another agent: this order buys an independent, source-linked analysis of that candidate for YOUR mission — established facts, contradictions, missing evidence, safeguards to request, and a contextual proceed/postpone/do-not-buy recommendation. Delivered manually within 24 hours to the private contact you supply.',
  price: '1 USDC (x402 "exact" scheme). Default network: Base Sepolia testnet during the pilot phase.',
  how: {
    method: 'POST',
    url: 'https://agentreputation.dev/api/prepurchase/order',
    content_type: 'application/json',
    fields: {
      candidate: 'required — the agent/service you are considering buying (handle, name or URL)',
      mission: 'required — what you would ask it to do',
      budget_exposure: 'required — money, access or dependency you would put at risk',
      failure_consequence: 'required — what happens to you if it fails or lies',
      public_constraints: 'optional — guarantees or constraints the candidate already advertises',
      delivery_contact: 'required — private email or URL where the brief is delivered (never published)',
    },
    payment:
      `x402 v2: the first POST returns HTTP 402 with a base64 PaymentRequired challenge in the ${HEADER_PAYMENT_REQUIRED} header (also mirrored in the JSON body). Sign it and retry the same POST with the ${HEADER_PAYMENT_SIGNATURE} header.`,
  },
  neutrality:
    'Payment buys the contextual analysis only. It never buys a rating, a ranking, a verdict or any treatment on Agent Reputation. Settlement, delivery and buyer outcome are recorded as separate facts.',
  status_note:
    'If this offer is not currently active, POST returns 503 and no payment challenge is issued.',
}

// ---------------------------------------------------------------------------
// Effets réels : facilitator + registre privé (requêtes STRICTEMENT séquentielles)
// ---------------------------------------------------------------------------

function createFacilitator(config: {
  facilitatorUrl: string
  facilitatorKind: 'public' | 'cdp'
}): FacilitatorClient {
  if (config.facilitatorKind === 'cdp') {
    // Client officiel : génère les JWT CDP liés à chaque endpoint. La création
    // reste dans le handler, donc aucun secret n'est requis pendant next build.
    return createCdpFacilitatorClient({ baseUrl: config.facilitatorUrl })
  }
  return new HTTPFacilitatorClient({ url: config.facilitatorUrl })
}

type OrderRow = {
  id: string
  network: string
  asset: string
  amount_atomic: string
  pay_to: string
  payer: string | null
  payment_nonce: string
  payment_transaction: string | null
  payment_status: 'reserved' | 'settled'
  settled_at: Date | null
  evidence_cutoff: Date | null
  delivery_deadline: Date | null
  candidate: string
  mission: string
  budget_exposure: string
  failure_consequence: string
  public_constraints: string | null
  delivery_contact: string
}

function rowToOrder(row: OrderRow): StoredOrder {
  if (
    row.payment_status !== 'settled' ||
    !row.settled_at ||
    !row.evidence_cutoff ||
    !row.delivery_deadline
  ) {
    throw new Error('attempted to expose an unsettled prepurchase reservation as a paid order')
  }
  return {
    id: row.id,
    network: row.network,
    asset: row.asset,
    amountAtomic: String(row.amount_atomic),
    payTo: row.pay_to,
    payer: row.payer,
    paymentNonce: row.payment_nonce,
    paymentTransaction: row.payment_transaction,
    settledAt: new Date(row.settled_at).toISOString(),
    evidenceCutoff: new Date(row.evidence_cutoff).toISOString(),
    deliveryDeadline: new Date(row.delivery_deadline).toISOString(),
    input: {
      candidate: row.candidate,
      mission: row.mission,
      budget_exposure: row.budget_exposure,
      failure_consequence: row.failure_consequence,
      public_constraints: row.public_constraints ?? undefined,
      delivery_contact: row.delivery_contact,
    },
  }
}

function realDeps(config: {
  facilitatorUrl: string
  facilitatorKind: 'public' | 'cdp'
}): PaidOrderDeps {
  const sql = getSql()
  const facilitator = createFacilitator(config)
  const sameInput = (row: OrderRow, reservation: OrderReservation) =>
    row.candidate === reservation.input.candidate &&
    row.mission === reservation.input.mission &&
    row.budget_exposure === reservation.input.budget_exposure &&
    row.failure_consequence === reservation.input.failure_consequence &&
    (row.public_constraints ?? undefined) === reservation.input.public_constraints &&
    row.delivery_contact === reservation.input.delivery_contact

  return {
    findOrderByNonce: async (network, nonce) => {
      const rows = await withTimeout(
        sql<OrderRow[]>`
          select * from prepurchase_orders
          where network = ${network} and payment_nonce = ${nonce}
            and payment_status = 'settled'
          limit 1`,
      )
      return rows.length > 0 ? rowToOrder(rows[0]) : null
    },
    verify: async (payload, requirements) => {
      const body = await facilitator.verify(
        payload as unknown as OfficialPaymentPayload,
        requirements as unknown as OfficialPaymentRequirements,
      )
      return {
        isValid: body.isValid === true,
        payer: typeof body.payer === 'string' ? body.payer : undefined,
        invalidReason: typeof body.invalidReason === 'string' ? body.invalidReason : undefined,
        invalidMessage: typeof body.invalidMessage === 'string' ? body.invalidMessage : undefined,
      } satisfies VerifyResponse
    },
    reserve: async (reservation) =>
      withTimeout(
        sql.begin(async (tx) => {
          // Verrou GLOBAL par réseau : max:1 ne sérialise qu'une lambda, pas le
          // parc serverless. Toutes les requêtes restent séquentielles sous tx.
          await tx`
            select pg_advisory_xact_lock(
              hashtextextended(${`prepurchase-cap:${reservation.network}`}, 0)
            )`
          const existing = await tx<OrderRow[]>`
            select * from prepurchase_orders
            where network = ${reservation.network}
              and payment_nonce = ${reservation.paymentNonce}
            limit 1`
          if (existing.length > 0) {
            const row = existing[0]
            if (!sameInput(row, reservation)) return { status: 'input_conflict' } as const
            if (row.payment_status === 'settled') {
              return { status: 'existing', order: rowToOrder(row) } as const
            }
            return { status: 'reserved' } as const
          }

          const totals = await tx<{ total: string }[]>`
            select coalesce(sum(amount_atomic), 0)::text as total
            from prepurchase_orders
            where network = ${reservation.network}
              and payment_status in ('reserved', 'settled')`
          if (
            BigInt(totals[0]?.total ?? '0') + BigInt(reservation.amountAtomic) >
            PREPURCHASE_REVENUE_CAP_ATOMIC
          ) {
            return { status: 'cap_reached' } as const
          }

          await tx`
            insert into prepurchase_orders (
              id, payment_status, network, asset, amount_atomic, pay_to,
              payment_nonce, candidate, mission, budget_exposure,
              failure_consequence, public_constraints, delivery_contact
            ) values (
              ${reservation.id}, 'reserved', ${reservation.network},
              ${reservation.asset}, ${reservation.amountAtomic}, ${reservation.payTo},
              ${reservation.paymentNonce}, ${reservation.input.candidate},
              ${reservation.input.mission}, ${reservation.input.budget_exposure},
              ${reservation.input.failure_consequence},
              ${reservation.input.public_constraints ?? null},
              ${reservation.input.delivery_contact}
            )`
          return { status: 'reserved' } as const
        }),
      ),
    settle: async (payload, requirements) => {
      const body = await facilitator.settle(
        payload as unknown as OfficialPaymentPayload,
        requirements as unknown as OfficialPaymentRequirements,
      )
      return {
        success: body.success === true,
        payer: typeof body.payer === 'string' ? body.payer : undefined,
        transaction: typeof body.transaction === 'string' ? body.transaction : undefined,
        network: typeof body.network === 'string' ? body.network : undefined,
        errorReason: typeof body.errorReason === 'string' ? body.errorReason : undefined,
        errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
        amount: typeof body.amount === 'string' ? body.amount : undefined,
      } satisfies SettleResponse
    },
    finalize: async (order) => {
      const updated = await withTimeout(
        sql<OrderRow[]>`
          update prepurchase_orders
          set payment_status = 'settled',
              payer = ${order.payer},
              payment_transaction = ${order.paymentTransaction},
              settled_at = ${order.settledAt},
              evidence_cutoff = ${order.evidenceCutoff},
              delivery_deadline = ${order.deliveryDeadline}
          where network = ${order.network}
            and payment_nonce = ${order.paymentNonce}
            and payment_status = 'reserved'
          returning *`,
      )
      if (updated.length > 0) return rowToOrder(updated[0])
      const rows = await withTimeout(
        sql<OrderRow[]>`
          select * from prepurchase_orders
          where network = ${order.network} and payment_nonce = ${order.paymentNonce}
            and payment_status = 'settled'
          limit 1`,
      )
      if (rows.length === 0) throw new Error('settled payment has a reservation but could not be finalized')
      return rowToOrder(rows[0])
    },
    now: () => new Date(),
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePost(req: Request): Promise<Response> {
  const parsedConfig = parsePrepurchaseConfig(process.env)
  if (!parsedConfig.ok) {
    // Raison loggée côté serveur uniquement (noms de variables, jamais de valeurs).
    console.warn(`prepurchase offer inactive: ${parsedConfig.reason}`)
    return json({ error: 'offer_not_active', detail: 'This paid offer is not currently active. No payment challenge is issued; do not pay.' }, 503)
  }
  const config = parsedConfig.config

  let body: unknown
  try {
    const declaredLength = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ORDER_BODY_BYTES) {
      return json({ error: 'request_too_large' }, 413)
    }
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_ORDER_BODY_BYTES) {
      return json({ error: 'request_too_large' }, 413)
    }
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'invalid_json', usage: HOW_TO.how }, 400)
  }
  const input = OrderInputSchema.safeParse(body)
  if (!input.success) {
    return json({ error: 'invalid_fields', details: input.error.flatten().fieldErrors, usage: HOW_TO.how }, 400)
  }

  const paymentRequired = buildPaymentRequired(config)
  const challengeHeaders = { [HEADER_PAYMENT_REQUIRED]: encodeBase64Json(paymentRequired) }

  const paymentHeader = req.headers.get(HEADER_PAYMENT_SIGNATURE)
  if (!paymentHeader) {
    // Body = miroir lisible du header (aide les agents v1 et les humains) ; le
    // header PAYMENT-REQUIRED reste la voie spec v2.
    return json({ ...paymentRequired, price_atomic: PREPURCHASE_PRICE_ATOMIC, usage: HOW_TO.how }, 402, challengeHeaders)
  }

  const decoded = decodeBase64Json(paymentHeader)
  const payload = PaymentPayloadV2Schema.safeParse(decoded)
  if (!payload.success) {
    return json(
      { ...buildPaymentRequired(config, 'Unreadable payment payload: expected base64 JSON x402 v2 PaymentPayload (exact/eip3009).') },
      402,
      challengeHeaders,
    )
  }

  try {
    const result = await processPaidOrder(realDeps(config), config, input.data, payload.data as PaymentPayloadV2)
    switch (result.status) {
      case 'ok': {
        const settlement: SettleResponse = result.settlement ?? {
          success: true,
          payer: result.order.payer ?? undefined,
          transaction: result.order.paymentTransaction ?? undefined,
          network: result.order.network,
        }
        return json(orderReceipt(result.order, result.settlement), 200, {
          [HEADER_PAYMENT_RESPONSE]: encodeBase64Json(settlement),
        })
      }
      case 'invalid_payment':
        return json({ ...buildPaymentRequired(config, `Payment does not match the offer: ${result.reason}.`) }, 402, challengeHeaders)
      case 'verify_failed':
        return json({ ...buildPaymentRequired(config, `Payment verification failed: ${result.reason}.`) }, 402, challengeHeaders)
      case 'settle_failed':
        return json({ ...buildPaymentRequired(config, `Settlement was not confirmed: ${result.reason}. A private capacity reservation was retained. Keep the identical payment payload and contact us via /api/feedback before creating any new authorization; operator reconciliation may be required.`) }, 402, challengeHeaders)
      case 'input_conflict':
        return json(
          { error: 'payment_input_conflict', detail: 'This payment nonce is already reserved for a different order body. Retry the original body; do not create a new payment.' },
          409,
        )
      case 'cap_reached':
        return json(
          { error: 'offer_paused', detail: 'The experimental gross-revenue boundary (100 USDC) is reached. The offer is paused; no new payment is accepted.' },
          409,
        )
    }
  } catch (e) {
    console.error('prepurchase order processing failed:', e instanceof Error ? e.message : e)
    return json(
      { error: 'processing_failed', detail: 'Order processing failed before completion. Keep the identical payment payload (its nonce identifies the reservation) and contact us via /api/feedback before creating any new authorization. If settlement may have reached the chain, operator reconciliation can be required.' },
      500,
    )
  }
}

export const POST = withOrigin(handlePost)

export async function GET() {
  const parsedConfig = parsePrepurchaseConfig(process.env)
  return json({
    ...HOW_TO,
    active: parsedConfig.ok,
    ...(parsedConfig.ok
      ? { network: parsedConfig.config.network, accepts_preview: buildPaymentRequirements(parsedConfig.config) }
      : {}),
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
