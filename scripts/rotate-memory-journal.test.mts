import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { rotateJournal } from './rotate-memory-journal.mjs'

const header = `---
name: codex-journal
description: test
metadata:
  type: project
---

**Archives** : [[codex-journal-archive-001]] (earlier)

---

`

test('rotates oldest entries verbatim and becomes a no-op below the threshold', async () => {
  const memoryDir = await mkdtemp(path.join(tmpdir(), 'aghub-memory-'))
  try {
    const entries = Array.from(
      { length: 14 },
      (_, index) =>
        `## 2026-07-${String(index + 1).padStart(2, '0')} — entry ${index + 1}\n\n` +
        `${String(index + 1).padStart(2, '0')}:${'evidence '.repeat(380)}\n\n`,
    )
    await writeFile(path.join(memoryDir, 'codex-journal.md'), header + entries.join(''), 'utf8')
    await writeFile(
      path.join(memoryDir, 'codex-journal-archive-001.md'),
      '---\nname: codex-journal-archive-001\n---\n\n# Existing archive\n',
      'utf8',
    )

    const result = await rotateJournal({ memoryDir })
    assert.equal(result.rotated, true)
    assert.ok(result.movedEntries >= 4)
    assert.ok(result.keptEntries <= 10)

    const living = await readFile(path.join(memoryDir, 'codex-journal.md'), 'utf8')
    const archive = await readFile(path.join(memoryDir, 'codex-journal-archive-001.md'), 'utf8')
    assert.ok(Buffer.byteLength(living, 'utf8') <= 30 * 1024)
    assert.ok(!living.includes(entries[0]))
    assert.ok(living.includes(entries.at(-1)!))
    assert.ok(archive.includes(entries[0]))
    assert.ok(archive.includes(entries[result.movedEntries - 1]))

    const secondRun = await rotateJournal({ memoryDir })
    assert.equal(secondRun.rotated, false)
  } finally {
    await rm(memoryDir, { recursive: true, force: true })
  }
})
