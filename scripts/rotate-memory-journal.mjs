import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_THRESHOLD_BYTES = 30 * 1024
const DEFAULT_ARCHIVE_MAX_BYTES = 60 * 1024
const DEFAULT_KEEP_ENTRIES = 10

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8')
}

function assertMemoryFilename(filename) {
  if (!/^[a-z0-9][a-z0-9-]*\.md$/i.test(filename)) {
    throw new Error(`Invalid journal filename: ${filename}`)
  }
}

function entryStarts(content) {
  return [...content.matchAll(/^## .+$/gm)].map((match) => match.index)
}

function entryDate(content, start) {
  return content.slice(start).match(/^## (\d{4}-\d{2}-\d{2})/)?.[1] ?? 'unknown'
}

function archiveNumber(filename, stem) {
  const match = filename.match(new RegExp(`^${stem}-archive-(\\d{3})\\.md$`))
  return match ? Number(match[1]) : null
}

function archivePreamble(stem, number, firstDate, lastDate) {
  const suffix = String(number).padStart(3, '0')
  return `---
name: ${stem}-archive-${suffix}
description: "Archive ${suffix} de ${stem} (entrees ${firstDate} -> ${lastDate}) - ne lire que sur besoin explicite"
metadata:
  type: project
---

# Archive ${suffix} — ${stem}

Entrees deplacees automatiquement (regle [[memory-structure]] : archivage par quantite).
Le fichier vivant est \`${stem}.md\`. Rien n'a ete resume ni supprime : deplacement verbatim.

---
`
}

function addArchiveReference(living, archiveStem, firstDate, lastDate) {
  const reference = `[[${archiveStem}]] (${firstDate} -> ${lastDate})`
  if (living.includes(`[[${archiveStem}]]`)) return living

  const archiveLine = /^\*\*Archives\*\* : .+$/m
  if (!archiveLine.test(living)) {
    throw new Error('Living journal has no **Archives** header line to update')
  }
  return living.replace(archiveLine, (line) => `${line} · ${reference}`)
}

async function atomicWrite(filepath, content) {
  const temporary = `${filepath}.rotate-${process.pid}.tmp`
  await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' })
  await rename(temporary, filepath)
}

export async function rotateJournal({
  memoryDir = path.resolve('.context', 'memory'),
  journal = 'codex-journal.md',
  thresholdBytes = DEFAULT_THRESHOLD_BYTES,
  archiveMaxBytes = DEFAULT_ARCHIVE_MAX_BYTES,
  keepEntries = DEFAULT_KEEP_ENTRIES,
} = {}) {
  assertMemoryFilename(journal)
  const stem = journal.slice(0, -3)
  const journalPath = path.join(memoryDir, journal)
  const content = await readFile(journalPath, 'utf8')

  if (content.charCodeAt(0) === 0xfeff) throw new Error(`${journal} contains a UTF-8 BOM`)
  if (content.includes('\r')) throw new Error(`${journal} is not LF-only`)

  const beforeBytes = byteLength(content)
  if (beforeBytes <= thresholdBytes) {
    return { rotated: false, journal, beforeBytes, afterBytes: beforeBytes, movedEntries: 0 }
  }

  const starts = entryStarts(content)
  if (starts.length <= 1) {
    throw new Error(`${journal} exceeds ${thresholdBytes} bytes but has too few entries to rotate`)
  }

  let kept = Math.min(keepEntries, starts.length - 1)
  let splitIndex = starts[starts.length - kept]
  let living = content.slice(0, starts[0]) + content.slice(splitIndex)

  while (byteLength(living) > thresholdBytes && kept > 1) {
    kept -= 1
    splitIndex = starts[starts.length - kept]
    living = content.slice(0, starts[0]) + content.slice(splitIndex)
  }
  if (byteLength(living) > thresholdBytes) {
    throw new Error(`${journal} cannot fit below ${thresholdBytes} bytes while retaining one entry`)
  }

  const moved = content.slice(starts[0], splitIndex)
  const movedEntries = starts.length - kept
  const firstDate = entryDate(content, starts[0])
  const lastDate = entryDate(content, starts[movedEntries - 1])

  const files = await readdir(memoryDir)
  const archives = files
    .map((filename) => ({ filename, number: archiveNumber(filename, stem) }))
    .filter((item) => item.number !== null)
    .sort((a, b) => a.number - b.number)

  let archiveNumberToUse = archives.at(-1)?.number ?? 1
  let archiveFilename = `${stem}-archive-${String(archiveNumberToUse).padStart(3, '0')}.md`
  let archivePath = path.join(memoryDir, archiveFilename)
  let archiveContent = ''
  let createdArchive = archives.length === 0

  if (!createdArchive) {
    archiveContent = await readFile(archivePath, 'utf8')
    if (archiveContent.charCodeAt(0) === 0xfeff || archiveContent.includes('\r')) {
      throw new Error(`${archiveFilename} must be UTF-8 without BOM and LF-only`)
    }
    const separator = archiveContent.endsWith('\n') ? '' : '\n'
    if (byteLength(archiveContent + separator + moved) > archiveMaxBytes) {
      archiveNumberToUse += 1
      archiveFilename = `${stem}-archive-${String(archiveNumberToUse).padStart(3, '0')}.md`
      archivePath = path.join(memoryDir, archiveFilename)
      archiveContent = ''
      createdArchive = true
    }
  }

  const archiveStem = archiveFilename.slice(0, -3)
  const archivePayload = createdArchive
    ? archivePreamble(stem, archiveNumberToUse, firstDate, lastDate) + moved
    : archiveContent + (archiveContent.endsWith('\n') ? '' : '\n') + moved

  if (byteLength(archivePayload) > archiveMaxBytes) {
    throw new Error(`${archiveFilename} would exceed ${archiveMaxBytes} bytes`)
  }
  if (createdArchive) living = addArchiveReference(living, archiveStem, firstDate, lastDate)

  await atomicWrite(archivePath, archivePayload)
  await atomicWrite(journalPath, living)

  const verifiedJournal = await readFile(journalPath, 'utf8')
  const verifiedArchive = await readFile(archivePath, 'utf8')
  if (byteLength(verifiedJournal) > thresholdBytes) throw new Error('Journal verification failed')
  if (!verifiedArchive.includes(moved)) throw new Error('Archive verification failed')

  return {
    rotated: true,
    journal,
    archive: archiveFilename,
    beforeBytes,
    afterBytes: byteLength(verifiedJournal),
    movedEntries,
    keptEntries: kept,
  }
}

function parseCli(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--memory-dir') options.memoryDir = path.resolve(argv[++index])
    else if (arg === '--threshold-bytes') options.thresholdBytes = Number(argv[++index])
    else if (arg === '--archive-max-bytes') options.archiveMaxBytes = Number(argv[++index])
    else if (arg === '--keep-entries') options.keepEntries = Number(argv[++index])
    else if (!options.journal) options.journal = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return options
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const result = await rotateJournal(parseCli(process.argv.slice(2)))
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
