import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('public contracts describe the catalogue as compatibility, not the product', () => {
  const contracts = [
    read('agent-card.json'),
    read('public/.well-known/agent-card.json'),
    read('server.json'),
    read('app/api/a2a/route.ts'),
    read('app/api/[transport]/route.ts'),
    read('public/llms.txt'),
    read('README.md'),
    read('app/page.tsx'),
    read('OUTREACH-ROUTINE.md'),
    read('lib/representative.ts'),
    read('skills/agentreputation-dev/SKILL.md'),
  ].join('\n')

  for (const staleClaim of [
    'agent discovery',
    'discovery across 16k+',
    'make yourself discoverable',
    'Discover candidate agents',
    'find work',
    'ratings make the network trustworthy',
  ]) {
    assert.ok(!contracts.includes(staleClaim), `stale public claim: ${staleClaim}`)
  }

  assert.match(contracts, /compatibility/i)
  assert.match(contracts, /not a (purchase )?recommendation/i)
})

test('tag catalogue has no computed reputation ranking', () => {
  const page = read('app/tags/[tag]/page.tsx')

  assert.ok(!page.includes('agent_reputation'))
  assert.ok(!page.includes('native_avg_score'))
  assert.ok(!page.includes('imported_avg_score'))
  assert.match(page, /not a ranking/i)
})

test('owners page renders current safeguards and carries no withdrawn governance copy', () => {
  const page = read('app/owners/owners-page.tsx')
  const copy = read('lib/owners-i18n.ts')

  assert.match(page, /t\.askHonest/)
  assert.match(page, /t\.nowSteps\.map/)
  assert.match(page, /t\.constitutionLabel/)
  assert.ok(!copy.includes('founderTitle:'))
  assert.ok(!copy.includes('portraitAlt:'))
  assert.ok(!copy.includes('power to block but never impose'))
  assert.ok(!copy.includes('the service is free'))
})

test('root and published agent cards remain identical and contain no frozen catalogue count', () => {
  const rootCard = read('agent-card.json')
  const publishedCard = read('public/.well-known/agent-card.json')

  assert.equal(rootCard, publishedCard)
  assert.ok(!/\b(?:16k|16[,.]?000|17[,.]?000|17[,.]?497)\+?\b/i.test(rootCard))
})

test('MCP Registry metadata stays inside the published schema limit', () => {
  const metadata = JSON.parse(read('server.json')) as { description?: unknown }

  assert.equal(typeof metadata.description, 'string')
  assert.ok(metadata.description.length <= 100)
})
