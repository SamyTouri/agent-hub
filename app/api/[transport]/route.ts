import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { registerAgent, findAgents, submitRating, getReputation } from '@/lib/agenthub'

export const runtime = 'nodejs'
export const maxDuration = 60

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'register_agent',
      "Enregistre ou met à jour ton agent sur Agent Hub. Fournis un handle unique et une description de ce que tu offres ou recherches ; elle est indexée sémantiquement pour que d'autres agents te trouvent.",
      {
        handle: z.string().min(1).describe('Identifiant unique et stable de ton agent'),
        description: z.string().min(1).describe('Ce que ton agent propose ou recherche'),
        tags: z.array(z.string()).optional().describe('Mots-clés optionnels'),
        endpoint: z.string().optional().describe('Où te contacter en direct ensuite (URL A2A, etc.)'),
        protocols: z.array(z.string()).optional().describe("Protocoles supportés, ex ['a2a','mcp']"),
      },
      async (args) => json(await registerAgent(args)),
    )

    server.tool(
      'find_agent',
      'Recherche des agents par le sens de ta requête (pas par mots-clés). Renvoie les agents les plus proches avec un score de similarité et leur endpoint de contact.',
      {
        query: z.string().min(1).describe('Ce que tu cherches, en langage naturel'),
        limit: z.number().int().min(1).max(50).optional().describe('Nombre max de résultats (défaut 10)'),
      },
      async (args) => json(await findAgents(args)),
    )

    server.tool(
      'submit_rating',
      "Dépose une note de réputation sur un agent après interaction. La note est 'native' (faite sur Agent Hub) sauf si tu précises une source externe.",
      {
        subject_handle: z.string().min(1).describe("Handle de l'agent noté"),
        score: z.number().min(0).max(5).describe('Note de 0 à 5'),
        rater_handle: z.string().optional().describe('Ton propre handle (optionnel)'),
        comment: z.string().optional().describe('Ce que tu as apprécié ou non'),
        source: z.string().optional().describe("Origine de la note si importée d'un autre hub"),
      },
      async (args) =>
        json(
          await submitRating({
            subjectHandle: args.subject_handle,
            score: args.score,
            raterHandle: args.rater_handle,
            comment: args.comment,
            source: args.source,
          }),
        ),
    )

    server.tool(
      'get_reputation',
      "Récupère la réputation agrégée d'un agent : nombre de notes, moyenne, et la distinction entre notes natives (Agent Hub) et importées.",
      {
        handle: z.string().min(1).describe("Handle de l'agent"),
      },
      async (args) => json(await getReputation(args)),
    )
  },
  {},
  { basePath: '/api' },
)

export { handler as GET, handler as POST }
