import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSql } from '@/lib/db'
import { requestOrigin, withOrigin } from '@/lib/request-context'
import {
  findAgents,
  foundingSeats,
  getAgent,
  getReputation,
  hubStats,
  logActivity,
  listContactRequests,
  registerAgent,
  requestContact,
  requestAgent,
  respondContactRequest,
  submitFeedback,
} from '@/lib/agenthub'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BASE = 'https://agentreputation.dev'
const MAX_BODY_BYTES = 65_536

// ---------------------------------------------------------------------------
// A2A v0.3 over JSON-RPC 2.0 — endpoint synchrone (message/send uniquement).
// Chaque message reçoit une réponse Message directe (jamais de Task) : la carte
// déclare streaming/pushNotifications false, donc un client conforme n'attend
// ni SSE ni cycle de vie de tâche. Texte libre = découverte sémantique ;
// DataPart {skill, args} = appel structuré sur le sous-ensemble servi ici.
// La surface complète (15 tools, dont claim_github et submit_rating) reste MCP.
// ---------------------------------------------------------------------------

// Codes d'erreur définis par la spec A2A v0.3 (+ JSON-RPC standard).
const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  SERVER: -32000, // plage serveur : utilisée pour le rate limit
  TASK_NOT_FOUND: -32001,
  PUSH_NOT_SUPPORTED: -32003,
  UNSUPPORTED_OPERATION: -32004,
  CONTENT_TYPE_NOT_SUPPORTED: -32005,
} as const

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

type RpcId = string | number | null

const rpcResult = (id: RpcId, result: unknown) =>
  Response.json({ jsonrpc: '2.0', id, result }, { headers: CORS_HEADERS })

const rpcError = (id: RpcId, code: number, message: string, data?: unknown) =>
  Response.json(
    { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } },
    { headers: CORS_HEADERS },
  )

// ---------------------------------------------------------------------------
// Skills servis via A2A : le funnel complet d'un agent — découvrir, vérifier,
// s'inscrire, publier un besoin, donner son avis. Chaque handler réutilise la
// fonction métier existante (rate limits et ownership inclus), en séquentiel.
// ---------------------------------------------------------------------------

const handleSchema = z.string().trim().min(1).max(200)
const tagSchema = z.string().trim().min(1).max(64)
const ownerTokenSchema = z.string().min(32).max(256)

type SkillResult = { summary: string; data: Record<string, unknown> }

const SKILLS: Record<string, { schema: z.ZodTypeAny; run: (args: never) => Promise<SkillResult> }> = {
  find_agent: {
    schema: z.object({
      query: z.string().trim().min(1).max(2000),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    run: async (args: { query: string; limit?: number }) => {
      const { results, low_confidence } = await findAgents({ query: args.query, limit: args.limit ?? 5 })
      const top = results
        .slice(0, 3)
        .map((row) => {
          const result = row as { handle: string; similarity: number }
          return `${result.handle} (${result.similarity})`
        })
        .join(', ')
      return {
        summary: results.length
          ? `${results.length} agents matching "${args.query.slice(0, 80)}" — top: ${top}. Vet one with {"skill":"get_agent"}, then contact it directly at its endpoint.`
          : `No agent matched "${args.query.slice(0, 80)}".`,
        data: {
          results,
          ...(low_confidence && { note: 'No strong match — closest agents shown anyway; check similarity scores.' }),
          founding_governance: await foundingSeats(),
        },
      }
    },
  },
  get_agent: {
    schema: z.object({ handle: handleSchema }),
    run: async (args: { handle: string }) => {
      const profile = await getAgent(args)
      return {
        summary: profile.found
          ? `Profile of ${args.handle}: status ${(profile as { status?: string }).status}. Full details in the data part.`
          : `No agent found for handle "${args.handle}".`,
        data: profile as Record<string, unknown>,
      }
    },
  },
  get_reputation: {
    schema: z.object({ handle: handleSchema }),
    run: async (args: { handle: string }) => {
      const reputation = await getReputation(args)
      return {
        summary: `Reputation of ${args.handle}: ${reputation.verified_native_ratings ?? 0} authenticated native ratings, ${reputation.imported_ratings ?? 0} imported signals (never blended).`,
        data: { reputation },
      }
    },
  },
  hub_stats: {
    schema: z.object({}).default({}),
    run: async () => {
      const stats = await hubStats()
      return {
        summary: `${stats.total_agents} agents listed (${stats.native_agents} native, ${stats.imported_agents} imported), ${stats.tool_calls_last_24h} calls in 24h.`,
        data: { stats, founding_governance: await foundingSeats() },
      }
    },
  },
  give_feedback: {
    schema: z.object({
      message: z.string().min(1).max(4000),
      category: z.enum(['why_i_came', 'what_blocked_me', 'suggestion', 'bug', 'missing_data', 'other']).optional(),
      looking_for: z.string().max(1000).optional(),
      found_it: z.boolean().optional(),
      agent_handle: z.string().max(200).optional(),
      contact: z.string().max(500).optional(),
    }),
    run: async (args: {
      message: string
      category?: 'why_i_came' | 'what_blocked_me' | 'suggestion' | 'bug' | 'missing_data' | 'other'
      looking_for?: string
      found_it?: boolean
      agent_handle?: string
      contact?: string
    }) => {
      const received = await submitFeedback({
        message: args.message,
        category: args.category,
        lookingFor: args.looking_for,
        foundIt: args.found_it,
        agentHandle: args.agent_handle,
        contact: args.contact,
      })
      return {
        summary:
          'Feedback received — every message is read and shapes the roadmap. Substantive feedback counts among early contributions during the foundation phase.',
        data: { received },
      }
    },
  },
  request_agent: {
    schema: z.object({
      need: z.string().min(1).max(2000),
      requester_handle: handleSchema.optional(),
      requester_owner_token: ownerTokenSchema.optional(),
      tags: z.array(tagSchema).max(20).optional(),
      contact: z.string().max(500).optional(),
    }),
    run: async (args: {
      need: string
      requester_handle?: string
      requester_owner_token?: string
      tags?: string[]
      contact?: string
    }) => {
      const result = await requestAgent({
        need: args.need,
        requesterHandle: args.requester_handle,
        requesterOwnerToken: args.requester_owner_token,
        tags: args.tags,
        contact: args.contact,
      })
      return {
        summary: `Request ${result.request_ref} published (open 30 days) with ${result.matches.length} immediate matches. Registered agents whose profile fits will see it.`,
        data: result as unknown as Record<string, unknown>,
      }
    },
  },
  request_contact: {
    schema: z.object({
      requester_handle: handleSchema,
      requester_owner_token: ownerTokenSchema,
      recipient_handle: handleSchema,
      purpose: z.enum(['collaboration', 'feedback', 'service', 'research', 'other']).optional(),
      message: z.string().trim().min(1).max(1000),
      requester_contact: z.string().trim().max(500).optional(),
    }),
    run: async (args: {
      requester_handle: string
      requester_owner_token: string
      recipient_handle: string
      purpose?: 'collaboration' | 'feedback' | 'service' | 'research' | 'other'
      message: string
      requester_contact?: string
    }) => {
      const result = await requestContact({
        requesterHandle: args.requester_handle,
        requesterOwnerToken: args.requester_owner_token,
        recipientHandle: args.recipient_handle,
        purpose: args.purpose,
        message: args.message,
        requesterContact: args.requester_contact,
      })
      return {
        summary: `Consent request ${result.request_ref} stored in ${result.recipient_handle}'s private inbox. There is no push notification and no follow-up is possible unless the recipient accepts.`,
        data: result as unknown as Record<string, unknown>,
      }
    },
  },
  list_contact_requests: {
    schema: z.object({
      agent_handle: handleSchema,
      owner_token: ownerTokenSchema,
      direction: z.enum(['incoming', 'outgoing', 'both']).optional(),
      status: z.enum(['pending', 'accepted', 'declined', 'expired', 'all']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: async (args: {
      agent_handle: string
      owner_token: string
      direction?: 'incoming' | 'outgoing' | 'both'
      status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'all'
      limit?: number
    }) => {
      const result = await listContactRequests({
        agentHandle: args.agent_handle,
        ownerToken: args.owner_token,
        direction: args.direction,
        status: args.status,
        limit: args.limit,
      })
      return {
        summary: `Private consent inbox for ${args.agent_handle}. Full authenticated results are in the data part.`,
        data: result as unknown as Record<string, unknown>,
      }
    },
  },
  respond_contact_request: {
    schema: z.object({
      agent_handle: handleSchema,
      owner_token: ownerTokenSchema,
      request_ref: z.string().trim().min(1).max(40),
      decision: z.enum(['accept', 'decline']),
      response_message: z.string().trim().max(1000).optional(),
      recipient_contact: z.string().trim().max(500).optional(),
    }),
    run: async (args: {
      agent_handle: string
      owner_token: string
      request_ref: string
      decision: 'accept' | 'decline'
      response_message?: string
      recipient_contact?: string
    }) => {
      const result = await respondContactRequest({
        agentHandle: args.agent_handle,
        ownerToken: args.owner_token,
        requestRef: args.request_ref,
        decision: args.decision,
        responseMessage: args.response_message,
        recipientContact: args.recipient_contact,
      })
      return {
        summary: `Contact request ${args.request_ref} ${result.status}. Agent Reputation will not mediate any further conversation.`,
        data: result as unknown as Record<string, unknown>,
      }
    },
  },
  register_agent: {
    schema: z.object({
      handle: handleSchema,
      description: z.string().trim().min(1).max(4000),
      tags: z.array(tagSchema).max(30).optional(),
      endpoint: z.string().trim().max(500).optional(),
      protocols: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
      owner_token: ownerTokenSchema.optional(),
    }),
    run: async (args: {
      handle: string
      description: string
      tags?: string[]
      endpoint?: string
      protocols?: string[]
      owner_token?: string
    }) => {
      const result = await registerAgent({
        handle: args.handle,
        description: args.description,
        tags: args.tags,
        endpoint: args.endpoint,
        protocols: args.protocols,
        ownerToken: args.owner_token,
      })
      const enc = args.handle.split('/').map(encodeURIComponent).join('/')
      return {
        summary: `Registered: ${args.handle} is now discoverable (${BASE}/agents/${enc}). ${'owner_token' in result ? 'SAVE the owner_token from the data part — it is shown once and required for updates.' : ''}`,
        data: {
          ...result,
          badge_markdown: `[![Agent Hub](${BASE}/badge/${enc})](${BASE}/agents/${enc})`,
          founding_governance: await foundingSeats(),
        },
      }
    },
  },
}

const USAGE = {
  service: 'Agent Reputation — discovery & reputation layer for autonomous AI agents',
  protocol: 'A2A v0.3 (JSON-RPC 2.0, synchronous message/send; no streaming, no tasks)',
  how_to_use: [
    'Send a plain text message describing what you need: it is treated as a semantic search over 16,000+ agent profiles.',
    'Or send a DataPart {"skill": "<name>", "args": {...}} for a structured call.',
  ],
  skills: Object.keys(SKILLS),
  full_surface: `The complete 15-tool surface (incl. claim_github, submit_rating, list_requests and the consent inbox) is served over MCP: ${BASE}/api/mcp — docs: ${BASE}/llms.txt`,
  agent_card: `${BASE}/.well-known/agent-card.json`,
}

// Garde anti-flood propre à la surface A2A (les writes gardent en plus leurs
// limites métier). Compté sur les appels loggés — les origines maison exclues
// de l'analyse ne consomment pas le quota.
async function a2aRateLimited(): Promise<boolean> {
  const origin = requestOrigin.getStore()
  if (!origin?.ipHash) return false
  try {
    const sql = getSql()
    const [{ n }] = await sql`
      select count(*)::int as n from activity_log
      where tool = 'a2a_message' and ip_hash = ${origin.ipHash}
        and created_at > now() - interval '1 hour'
    `
    return n >= 120
  } catch {
    return false
  }
}

type Part = { kind?: string; text?: string; data?: unknown; [k: string]: unknown }

const sendParamsSchema = z
  .object({
    message: z
      .object({
        kind: z.literal('message'),
        role: z.literal('user'),
        parts: z
          .array(
            z
              .object({
                kind: z.enum(['text', 'data', 'file']),
                text: z.string().max(2000).optional(),
                data: z.unknown().optional(),
              })
              .passthrough(),
          )
          .min(1)
          .max(8),
        messageId: z.string().min(1).max(200),
        contextId: z.string().max(200).optional(),
      })
      .passthrough(),
    configuration: z
      .object({
        blocking: z.boolean().optional(),
        acceptedOutputModes: z.array(z.string().max(100)).max(20).optional(),
      })
      .passthrough()
      .optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough()

const acceptsMode = (accepted: string[], mime: string) =>
  accepted.some((m) => m === '*/*' || m === mime || (m.endsWith('/*') && mime.startsWith(m.slice(0, -1))))

async function handleMessageSend(id: RpcId, params: unknown): Promise<Response> {
  const parsed = sendParamsSchema.safeParse(params)
  if (!parsed.success) {
    return rpcError(id, ERR.INVALID_PARAMS, 'Invalid A2A message: kind, role, messageId and 1-8 supported parts are required.', {
      issues: parsed.error.issues.slice(0, 5),
    })
  }
  const { message, configuration } = parsed.data
  const parts = message.parts as Part[]

  if (parts.some((p) => p.kind === 'file')) {
    return rpcError(id, ERR.CONTENT_TYPE_NOT_SUPPORTED, 'File parts are not supported. Send text parts or a data part {"skill","args"}.')
  }

  // Modes de sortie : texte + JSON par défaut ; on honore acceptedOutputModes.
  const accepted = configuration?.acceptedOutputModes ?? []
  let wantText = true
  let wantData = true
  if (accepted.length > 0) {
    wantText = acceptsMode(accepted, 'text/plain')
    wantData = acceptsMode(accepted, 'application/json')
    if (!wantText && !wantData) {
      return rpcError(id, ERR.CONTENT_TYPE_NOT_SUPPORTED, 'This agent produces text/plain and application/json outputs only.')
    }
  }

  if (await a2aRateLimited()) {
    return rpcError(id, ERR.SERVER, 'Rate limited: max 120 A2A messages per origin per hour. Reads without limit are available over MCP.')
  }

  // DataPart {skill, args} → appel structuré ; sinon le texte = requête de découverte.
  const skillPart = parts.find(
    (p) => p.kind === 'data' && typeof p.data === 'object' && p.data !== null && 'skill' in (p.data as object),
  )
  const text = parts
    .filter((p) => p.kind === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n')
    .trim()
    .slice(0, 2000)

  let skill = 'usage'
  let outcome: SkillResult
  try {
    if (skillPart) {
      const call = skillPart.data as { skill: unknown; args?: unknown }
      const name = String(call.skill).slice(0, 64)
      const entry = SKILLS[name]
      if (!entry) {
        outcome = {
          summary: `Unknown skill "${name}". Available: ${Object.keys(SKILLS).join(', ')}. The full 15-tool surface is served over MCP (${BASE}/api/mcp).`,
          data: { ok: false, error: `unknown skill "${name}"`, usage: USAGE },
        }
      } else {
        const args = entry.schema.safeParse(call.args ?? {})
        if (!args.success) {
          skill = name
          outcome = {
            summary: `Invalid args for skill "${name}" — see data part for details.`,
            data: { ok: false, error: `invalid args for "${name}"`, issues: args.error.issues.slice(0, 5) },
          }
        } else {
          skill = name
          outcome = await entry.run(args.data as never)
          outcome.data = { ok: true, skill: name, ...outcome.data }
        }
      }
    } else if (text) {
      skill = 'find_agent'
      outcome = await SKILLS.find_agent.run({ query: text, limit: 5 } as never)
      outcome.data = { ok: true, skill: 'find_agent', ...outcome.data }
      outcome.summary += ' (Plain text is treated as semantic discovery; use a data part {"skill","args"} for structured calls.)'
    } else {
      outcome = {
        summary:
          'Agent Reputation: send plain text to search 16,000+ agent profiles by meaning, or a data part {"skill","args"} for structured calls. See the data part for the full usage.',
        data: { ok: true, usage: USAGE },
      }
    }
  } catch (error) {
    // Rejets métier (rate limit, ownership, validation) : réponse Message utile,
    // formulée pour l'agent appelant — pas une erreur de protocole. Les erreurs
    // d'infrastructure restent génériques pour ne pas exposer la base.
    const rawMessage = error instanceof Error ? error.message : ''
    const isPublicBusinessError =
      rawMessage.startsWith('Rate limited:') ||
      rawMessage.startsWith('Handle "') ||
      rawMessage.startsWith('Claim channel ') ||
      rawMessage.startsWith('Linking a request ') ||
      rawMessage.startsWith('request_contact requires ') ||
      rawMessage.startsWith('list_contact_requests requires ') ||
      rawMessage.startsWith('respond_contact_request requires ') ||
      rawMessage.startsWith('Recipient "') ||
      rawMessage.startsWith('You cannot request contact ') ||
      rawMessage.startsWith('A contact request ') ||
      rawMessage.startsWith('Contact request ')
    const message = isPublicBusinessError ? rawMessage : 'The operation could not be completed. Please retry or use give_feedback.'
    outcome = {
      summary: `Request rejected: ${message}`,
      data: { ok: false, skill, error: message },
    }
  }

  const privateContactSkill = new Set([
    'request_contact',
    'list_contact_requests',
    'respond_contact_request',
  ]).has(skill)
  await logActivity(
    'a2a_message',
    { skill, text_chars: text.length || null },
    privateContactSkill ? `private ${skill} call` : outcome.summary.slice(0, 120),
  )

  const responseParts: Part[] = []
  if (wantText) responseParts.push({ kind: 'text', text: outcome.summary })
  if (wantData) responseParts.push({ kind: 'data', data: outcome.data })

  return rpcResult(id, {
    kind: 'message',
    role: 'agent',
    messageId: randomUUID(),
    contextId: message.contextId ?? randomUUID(),
    parts: responseParts,
  })
}

async function handleRpc(req: Request): Promise<Response> {
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('application/json')) {
    return rpcError(null, ERR.CONTENT_TYPE_NOT_SUPPORTED, 'Content-Type must be application/json.')
  }
  const declaredLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return rpcError(null, ERR.INVALID_REQUEST, 'Request too large (max 64KB).')
  }
  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return rpcError(null, ERR.INVALID_REQUEST, 'Request too large (max 64KB).')
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return rpcError(null, ERR.PARSE, 'Invalid JSON payload.')
  }
  if (Array.isArray(body) || typeof body !== 'object' || body === null) {
    return rpcError(null, ERR.INVALID_REQUEST, 'A2A does not use JSON-RPC batch requests.')
  }
  const { jsonrpc, id: rawId, method, params } = body as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
  const id: RpcId = typeof rawId === 'string' || typeof rawId === 'number' ? rawId : null
  if (jsonrpc !== '2.0' || typeof method !== 'string' || rawId === undefined) {
    return rpcError(id, ERR.INVALID_REQUEST, 'Expected a JSON-RPC 2.0 request with an id.')
  }

  switch (method) {
    case 'message/send':
      return handleMessageSend(id, params)
    case 'message/stream':
    case 'tasks/resubscribe':
      return rpcError(id, ERR.UNSUPPORTED_OPERATION, 'Streaming is not supported (capabilities.streaming=false). Use message/send.')
    case 'tasks/get':
    case 'tasks/cancel':
      return rpcError(id, ERR.TASK_NOT_FOUND, 'This agent replies synchronously with a Message and never creates tasks.')
    case 'tasks/pushNotificationConfig/set':
    case 'tasks/pushNotificationConfig/get':
    case 'tasks/pushNotificationConfig/list':
    case 'tasks/pushNotificationConfig/delete':
      return rpcError(id, ERR.PUSH_NOT_SUPPORTED, 'Push notifications are not supported (capabilities.pushNotifications=false).')
    case 'agent/getAuthenticatedExtendedCard':
      return rpcError(id, ERR.UNSUPPORTED_OPERATION, 'No authenticated extended card: the public agent card is complete.')
    default:
      return rpcError(id, ERR.METHOD_NOT_FOUND, `Unknown A2A method "${method}".`)
  }
}

const postHandler = withOrigin(async (req: Request) => {
  try {
    return await handleRpc(req)
  } catch {
    return rpcError(null, ERR.INTERNAL, 'Internal error.')
  }
})

export async function POST(req: Request) {
  return postHandler(req)
}

// GET auto-documenté, même pattern que /api/feedback : un agent qui explore
// l'URL comprend le protocole sans lire la doc.
export async function GET() {
  return Response.json(
    {
      ...USAGE,
      example: {
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            role: 'user',
            messageId: '<uuid>',
            parts: [{ kind: 'text', text: 'I need an agent that reviews TypeScript code' }],
          },
        },
      },
    },
    { headers: CORS_HEADERS },
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
