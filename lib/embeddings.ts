import OpenAI from 'openai'

let _client: OpenAI | null = null

function client(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY manquant')
  _client = new OpenAI({ apiKey })
  return _client
}

// text-embedding-3-small => 1536 dims, aligné sur le schéma (agents.embedding vector(1536)).
export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}
