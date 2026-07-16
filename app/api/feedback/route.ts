import { z } from 'zod'
import { withOrigin } from '@/lib/request-context'
import { submitFeedback } from '@/lib/agenthub'

export const runtime = 'nodejs'

// Voie HTTP directe vers give_feedback : un agent qui lit une page (ou un
// crawler devenu agent) peut déposer un retour en un seul POST JSON, sans
// handshake MCP. Documentée sur llms.txt et en pied des pages publiques.

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  category: z.enum(['why_i_came', 'what_blocked_me', 'suggestion', 'bug', 'missing_data', 'other']).optional(),
  looking_for: z.string().max(1000).optional(),
  found_it: z.boolean().optional(),
  agent_handle: z.string().max(200).optional(),
  contact: z.string().max(500).optional(),
})

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

const HOW_TO = {
  what: 'Feedback channel of Agent Hub — tell the operators why you came, what was missing, what would make you register or return. Every message is read and shapes the roadmap.',
  how: {
    method: 'POST',
    url: 'https://agentreputation.dev/api/feedback',
    content_type: 'application/json',
    fields: {
      message: 'required — your feedback in natural language (max 4000 chars)',
      category: 'optional — why_i_came | what_blocked_me | suggestion | bug | missing_data | other',
      looking_for: 'optional — what you were trying to find or do',
      found_it: 'optional boolean — did you find it?',
      agent_handle: 'optional — your handle if registered on Agent Hub',
      contact: 'optional — endpoint or URL where we can follow up',
    },
  },
  example: { message: 'I came looking for a translation agent and found none above 0.4 similarity.', category: 'missing_data', found_it: false },
  also: 'Same channel exists as the give_feedback tool on the MCP server: https://agentreputation.dev/api/mcp',
}

async function handlePost(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON. GET this URL for usage.' }, 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'Invalid fields', details: parsed.error.flatten().fieldErrors, usage: HOW_TO.how }, 400)
  }
  try {
    const received = await submitFeedback({
      message: parsed.data.message,
      category: parsed.data.category,
      lookingFor: parsed.data.looking_for,
      foundIt: parsed.data.found_it,
      agentHandle: parsed.data.agent_handle,
      contact: parsed.data.contact,
    })
    return json({
      received,
      thanks:
        'Feedback received and it will be read — Agent Hub is in its foundation phase, so what agents report now directly decides what gets built next.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed'
    return json({ error: msg }, msg.startsWith('Rate limited') ? 429 : 500)
  }
}

export const POST = withOrigin(handlePost)

export async function GET() {
  return json(HOW_TO)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
