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

// The tests above forbid the retired positioning. Forbidding the old is not the same as
// requiring the new, and on 2026-08-01 an audit found the gap that asymmetry left: the
// homepage, the README, the distributed skill and all twelve localized owners pages had
// been cleaned of discovery language while never mentioning the Complaint Bureau at all.
// A surface can satisfy every prohibition above and still describe a product we no longer
// build. These tests close that side.

test('every flagship surface names the Complaint Bureau', () => {
  const surfaces: Array<[string, string]> = [
    ['app/page.tsx', read('app/page.tsx')],
    ['README.md', read('README.md')],
    ['public/llms.txt', read('public/llms.txt')],
    ['agent-card.json', read('agent-card.json')],
    ['server.json', read('server.json')],
    ['skills/agentreputation-dev/SKILL.md', read('skills/agentreputation-dev/SKILL.md')],
  ]

  for (const [path, content] of surfaces) {
    assert.match(content, /complaint/i, `${path} never mentions the Complaint Bureau`)
  }
})

test('the three complaint tools are advertised wherever the tool set is listed', () => {
  const listings: Array<[string, string]> = [
    ['agent-card.json', read('agent-card.json')],
    ['app/page.tsx', read('app/page.tsx')],
    ['README.md', read('README.md')],
    ['public/llms.txt', read('public/llms.txt')],
  ]

  for (const [path, content] of listings) {
    for (const tool of ['check_complaints', 'file_complaint', 'complaint_bureau']) {
      assert.ok(content.includes(tool), `${path} does not advertise ${tool}`)
    }
  }
})

test('the owners page carries the Bureau in every localized copy', () => {
  const page = read('app/owners/owners-page.tsx')
  const copy = read('lib/owners-i18n.ts')

  assert.match(page, /t\.bureauTitle/)
  assert.match(page, /t\.bureau\}/)
  assert.match(page, /t\.complaintsLabel/)
  assert.match(page, /href="\/complaints"/)

  // Twelve locales, three fields each. Counting is what catches a language added later
  // with the Bureau silently omitted — the type would accept a copy-paste of any string.
  // Anchored to the start of a line: the word "bureau:" also occurs inside the prose of
  // locales whose translation of the name is a single compound word (nl "Klachtenbureau:").
  for (const field of ['bureauTitle:', 'bureau:', 'complaintsLabel:']) {
    const occurrences = copy.split(new RegExp(`^\\s+${field}`, 'gm')).length - 1
    assert.equal(occurrences, 13, `${field} appears ${occurrences} times, expected 13 (type + 12 locales)`)
  }

  // The registry positioning that ten locales still carried on 2026-08-01, in the
  // languages it survived in. Each of these was the opening promise of its page.
  for (const staleClaim of [
    'Een publiek, neutraal register',
    'Un registro público y neutral',
    'Ein öffentliches, neutrales Register',
    'Um registro público e neutro',
  ]) {
    assert.ok(!copy.includes(staleClaim), `stale registry positioning survives: ${staleClaim}`)
  }
})
