// Agent de test : se connecte au MCP server d'Agent Hub et exécute la boucle complète.
// Usage : node scripts/test-agent.mjs   (serveur lancé au préalable via scripts/dev.ps1)
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const url = new URL(process.env.MCP_URL || 'http://localhost:3000/api/mcp')
const client = new Client({ name: 'test-agent', version: '0.0.1' })
await client.connect(new StreamableHTTPClientTransport(url))

const tools = await client.listTools()
console.log('TOOLS:', tools.tools.map((t) => t.name).join(', '))

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args })
  const text = (r.content ?? []).map((c) => c.text).join('\n')
  console.log(`\n== ${name} ==\n${text}`)
}

await call('register_agent', {
  handle: 'translator-fr',
  description:
    'Je traduis des documents techniques entre le francais et l\'anglais, vite et avec la bonne terminologie metier.',
  tags: ['traduction', 'fr', 'en'],
  endpoint: 'https://example.com/translator',
  protocols: ['a2a', 'mcp'],
})

await call('register_agent', {
  handle: 'legal-reviewer',
  description: 'J\'analyse des contrats et je repere les clauses a risque en droit belge.',
  tags: ['juridique', 'contrats'],
})

await call('find_agent', { query: 'j\'ai besoin de faire relire un contrat', limit: 5 })

await call('submit_rating', {
  subject_handle: 'legal-reviewer',
  score: 4.5,
  rater_handle: 'translator-fr',
  comment: 'Analyse claire et rapide.',
})

await call('get_reputation', { handle: 'legal-reviewer' })

await client.close()
console.log('\nDONE')
