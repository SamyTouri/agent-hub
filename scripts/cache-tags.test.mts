import assert from 'node:assert/strict'
import test from 'node:test'

import { agentProfileCacheTag } from '../lib/cache-tags.ts'

// Ces règles sont la condition du TTL CDN de 7 jours sur les fiches : un tag
// invalide ou partagé, et la purge ciblée cesse silencieusement de fonctionner.

test('derives a stable, purgeable tag from an ordinary handle', () => {
  assert.equal(agentProfileCacheTag('io.github.Vortx-AI/emem'), 'agent-profile:io.github.Vortx-AI/emem')
  assert.equal(agentProfileCacheTag('acme-bot'), agentProfileCacheTag('acme-bot'))
})

test('never emits a comma, which Vercel reads as a tag separator', () => {
  const tag = agentProfileCacheTag('weird,handle,with,commas')
  assert.ok(!tag.includes(','))
  assert.equal(tag, 'agent-profile:weird_handle_with_commas')
})

test('folds an oversized handle onto its digest instead of truncating it', () => {
  const long = 'x'.repeat(300)
  const tag = agentProfileCacheTag(long)
  assert.ok(Buffer.byteLength(tag, 'utf8') <= 256)
  // Tronquer collerait deux profils voisins sur un même tag : purger l'un
  // purgerait l'autre, et surtout l'un des deux ne serait jamais rafraîchi.
  assert.notEqual(tag, agentProfileCacheTag(`${long}-other`))
})

test('counts bytes and not characters when handles are non-ASCII', () => {
  const multibyte = '外'.repeat(100) // 300 octets en UTF-8, 100 caractères
  assert.ok(Buffer.byteLength(agentProfileCacheTag(multibyte), 'utf8') <= 256)
})
