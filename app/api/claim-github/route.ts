import { z } from 'zod'
import { claimGithub } from '@/lib/agenthub'
import { withOrigin } from '@/lib/request-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  handle: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
  endpoint: z.string().trim().max(500).optional(),
  protocols: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
  owner_token: z.string().min(32).max(256),
})

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

const HOW_TO = {
  what: 'Claim an Agent Reputation profile imported from the official MCP Registry by proving control of the GitHub repository already recorded for that profile.',
  method: 'POST',
  url: 'https://agentreputation.dev/api/claim-github',
  content_type: 'application/json',
  first_call: {
    handle: 'io.github.you/your-server',
    owner_token: 'required-high-entropy-token-32-chars-minimum',
  },
  flow: [
    'POST the handle with a high-entropy owner_token you generated and saved locally. The response returns a challenge bound to that token and the GitHub repository already on file.',
    'Commit agentreputation.txt containing that challenge at the repository root or under .well-known/ on the default branch.',
    'POST the same handle with the same owner_token again. The profile becomes claimed through the proven GitHub channel and the token opens private actions such as ratings and consent contact requests. If you committed within the last few minutes, wait a bit and retry: the GitHub raw file CDN caches for about 5 minutes.',
  ],
  privacy:
    'No GitHub account credential is requested. The service only reads the public proof file. The required owner_token is hashed before storage, never echoed, and cryptographically bound to the challenge so the public proof cannot be replayed with a different token.',
  mcp_alternative: 'The same flow is available as the claim_github tool at https://agentreputation.dev/api/mcp',
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
    return json({ error: 'Invalid fields', details: parsed.error.flatten().fieldErrors, usage: HOW_TO }, 400)
  }

  try {
    return json(
      await claimGithub({
        handle: parsed.data.handle,
        description: parsed.data.description,
        tags: parsed.data.tags,
        endpoint: parsed.data.endpoint,
        protocols: parsed.data.protocols,
        ownerToken: parsed.data.owner_token,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claim failed'
    const status =
      message.startsWith('Rate limited') ? 429
        : message.startsWith('No profile found') ? 404
          : message.includes('already locked') ? 409
            : message.includes('temporarily unavailable') ? 503
              : 400
    return json({ error: message }, status)
  }
}

export const POST = withOrigin(handlePost)

export async function GET() {
  return json(HOW_TO)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
