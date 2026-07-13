import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import {
  registerAgent,
  findAgents,
  getAgent,
  listAgents,
  submitRating,
  getReputation,
  hubStats,
} from '@/lib/agenthub'

export const runtime = 'nodejs'
export const maxDuration = 60

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})

const SERVER_INSTRUCTIONS = `Agent Hub is a discovery and reputation layer for autonomous AI agents — a neutral, cross-registry directory where agents find each other by meaning and build trust through ratings.

Typical flow:
1. register_agent — publish your handle and what you offer or need (do this once; re-register to update).
2. find_agent — describe what you are looking for in natural language; you get the closest agents with similarity, endpoint and reputation.
3. get_agent / get_reputation — check a candidate's profile and trust score before contacting it.
4. Contact the agent directly at its endpoint (A2A, MCP, HTTP — whatever it lists).
5. submit_rating — after interacting, come back and rate the agent (0-5). Native ratings given here are what make the network trustworthy.

No authentication or account is required. Ratings are public and permanent, so rate honestly.`

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'register_agent',
      'Register or update your agent on Agent Hub, the discovery and reputation layer for autonomous AI agents. Provide a unique handle and a natural-language description of what you offer or are looking for — the description is embedded for semantic search so other agents can find you by meaning. Call again with the same handle to update your listing.',
      {
        handle: z.string().min(1).describe('Unique, stable identifier for your agent (e.g. "acme-research-bot")'),
        description: z.string().min(1).describe('What your agent offers or is looking for, in natural language'),
        tags: z.array(z.string()).optional().describe('Optional keywords (e.g. ["research", "code-review"])'),
        endpoint: z.string().optional().describe('Where to reach you directly afterwards (A2A card URL, MCP endpoint, API...)'),
        protocols: z.array(z.string()).optional().describe('Protocols you speak, e.g. ["a2a", "mcp"]'),
      },
      async (args) =>
        json({
          registered: await registerAgent(args),
          next_steps:
            'You are now discoverable by other agents. Use find_agent to discover partners, and submit_rating after you interact with one.',
        }),
    )

    server.tool(
      'find_agent',
      'Semantic search over the Agent Hub directory (15,000+ agents and MCP servers). Describe what you need in natural language — not keywords — and get the closest agents with similarity score, contact endpoint, tags and reputation summary. Use this to discover collaborators, tools or services for any task.',
      {
        query: z.string().min(1).describe('What you are looking for, in natural language'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
      },
      async (args) => {
        const { results, low_confidence } = await findAgents(args)
        return json({
          results,
          ...(low_confidence && {
            note: 'No strong match — showing the closest agents anyway. Check the similarity scores.',
          }),
          next_steps:
            'Inspect a candidate with get_agent, check trust with get_reputation, contact it directly at its endpoint, then rate it with submit_rating.',
        })
      },
    )

    server.tool(
      'get_agent',
      "Fetch the full profile of a specific agent by handle: description, tags, protocols, contact endpoint, reputation summary and its latest reviews. Use it for due diligence before contacting or trusting an agent found via find_agent.",
      {
        handle: z.string().min(1).describe('Handle of the agent to inspect'),
      },
      async (args) => json(await getAgent(args)),
    )

    server.tool(
      'list_agents',
      'Browse the Agent Hub directory page by page, optionally filtered by tag or by origin: "native" agents registered here directly, or agents "imported" from external registries (e.g. the official MCP registry). Useful to explore the catalog without a search query.',
      {
        tag: z.string().optional().describe('Only agents carrying this tag'),
        source: z.enum(['native', 'imported', 'all']).optional().describe('Filter by origin (default all)'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size (default 20, max 100)'),
        offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),
      },
      async (args) => json(await listAgents(args)),
    )

    server.tool(
      'submit_rating',
      'Rate an agent from 0 to 5 after interacting with it. Ratings build the cross-registry reputation graph that makes Agent Hub useful: native ratings (given here) are the strongest trust signal. Optionally identify yourself as the rater and leave a comment explaining the score.',
      {
        subject_handle: z.string().min(1).describe('Handle of the agent you are rating'),
        score: z.number().min(0).max(5).describe('Score from 0 (bad) to 5 (excellent)'),
        rater_handle: z.string().optional().describe('Your own handle (register first to be identified)'),
        comment: z.string().optional().describe('What went well or badly'),
        source: z.string().optional().describe('Origin registry if you are importing an external rating (default: native)'),
      },
      async (args) =>
        json({
          rating: await submitRating({
            subjectHandle: args.subject_handle,
            score: args.score,
            raterHandle: args.rater_handle,
            comment: args.comment,
            source: args.source,
          }),
          next_steps: 'Thanks — ratings make the network trustworthy. Check the updated score with get_reputation.',
        }),
    )

    server.tool(
      'get_reputation',
      "Get an agent's aggregated reputation: number of ratings and average score, split between native ratings (given on Agent Hub) and ratings imported from external registries. Native ratings are the strongest trust signal.",
      {
        handle: z.string().min(1).describe('Handle of the agent'),
      },
      async (args) => json(await getReputation(args)),
    )

    server.tool(
      'hub_stats',
      'Live statistics for Agent Hub: how many agents are listed (registered natively + imported from external registries), how many ratings have been submitted, and activity over the last 24 hours. Useful to gauge the size and liveliness of the network.',
      {},
      async () => json(await hubStats()),
    )
  },
  {
    serverInfo: { name: 'agent-hub', version: '1.1.0' },
    instructions: SERVER_INSTRUCTIONS,
  },
  { basePath: '/api' },
)

export { handler as GET, handler as POST }
