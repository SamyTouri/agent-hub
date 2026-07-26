export type PageSignals = {
  metadata: {
    title: string
    description: string
    canonicalUrl: string
  }
  headings: Array<{
    level: number
    text: string
  }>
  links: string[]
  forms: Array<{
    method: string
    action: string
  }>
  counts: {
    headings: number
    links: number
    images: number
    forms: number
    visibleWords: number
  }
}

export type PageSignalsSnapshot = {
  capturedAt: string
  sourceSha256: string
  signals: PageSignals
}

export type PageSignalsMismatch = {
  path: string
  kind: 'value' | 'length' | 'order'
}

export type PageSignalsComparison =
  | {
      status: 'match' | 'mismatch'
      comparable: true
      mismatches: PageSignalsMismatch[]
    }
  | {
      status: 'not_comparable'
      comparable: false
      reason:
        | 'invalid_snapshot_evidence'
        | 'snapshot_order_invalid'
        | 'source_changed_during_purchase_window'
      mismatches: []
    }

const SHA256_RE = /^[a-f0-9]{64}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPageSignals(value: unknown): value is PageSignals {
  if (!isRecord(value)) return false
  const metadata = value.metadata
  const counts = value.counts
  if (!isRecord(metadata) || !isRecord(counts)) return false
  if (
    !isString(metadata.title) ||
    !isString(metadata.description) ||
    !isString(metadata.canonicalUrl)
  ) {
    return false
  }
  if (!Array.isArray(value.headings) || !Array.isArray(value.links) || !Array.isArray(value.forms)) {
    return false
  }
  if (
    !value.headings.every(
      (heading) =>
        isRecord(heading) &&
        Number.isInteger(heading.level) &&
        Number(heading.level) >= 1 &&
        Number(heading.level) <= 6 &&
        isString(heading.text),
    ) ||
    !value.links.every(isString) ||
    !value.forms.every(
      (form) => isRecord(form) && isString(form.method) && isString(form.action),
    )
  ) {
    return false
  }
  return (
    isNonNegativeInteger(counts.headings) &&
    isNonNegativeInteger(counts.links) &&
    isNonNegativeInteger(counts.images) &&
    isNonNegativeInteger(counts.forms) &&
    isNonNegativeInteger(counts.visibleWords)
  )
}

function hasConsistentStructuralCounts(signals: PageSignals) {
  return (
    signals.counts.headings === signals.headings.length &&
    signals.counts.links === signals.links.length &&
    signals.counts.forms === signals.forms.length
  )
}

function isPageSignalsSnapshot(value: unknown): value is PageSignalsSnapshot {
  if (!isRecord(value)) return false
  return (
    isString(value.capturedAt) &&
    isString(value.sourceSha256) &&
    isPageSignals(value.signals) &&
    hasConsistentStructuralCounts(value.signals)
  )
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameMembers(left: unknown[], right: unknown[]) {
  if (left.length !== right.length) return false
  const leftSorted = left.map((value) => JSON.stringify(value)).sort()
  const rightSorted = right.map((value) => JSON.stringify(value)).sort()
  return leftSorted.every((value, index) => value === rightSorted[index])
}

function compareScalar(
  mismatches: PageSignalsMismatch[],
  path: string,
  expected: unknown,
  actual: unknown,
) {
  if (!sameValue(expected, actual)) mismatches.push({ path, kind: 'value' })
}

function compareOrderedArray(
  mismatches: PageSignalsMismatch[],
  path: string,
  expected: unknown[],
  actual: unknown[],
) {
  if (expected.length !== actual.length) {
    mismatches.push({ path, kind: 'length' })
  } else if (sameMembers(expected, actual) && !sameValue(expected, actual)) {
    mismatches.push({ path, kind: 'order' })
    return
  }

  const sharedLength = Math.min(expected.length, actual.length)
  for (let index = 0; index < sharedLength; index += 1) {
    compareScalar(mismatches, `${path}[${index}]`, expected[index], actual[index])
  }
}

function compareSignals(expected: PageSignals, actual: PageSignals) {
  const mismatches: PageSignalsMismatch[] = []

  compareScalar(mismatches, 'metadata.title', expected.metadata.title, actual.metadata.title)
  compareScalar(
    mismatches,
    'metadata.description',
    expected.metadata.description,
    actual.metadata.description,
  )
  compareScalar(
    mismatches,
    'metadata.canonicalUrl',
    expected.metadata.canonicalUrl,
    actual.metadata.canonicalUrl,
  )
  compareOrderedArray(mismatches, 'headings', expected.headings, actual.headings)
  compareOrderedArray(mismatches, 'links', expected.links, actual.links)
  compareOrderedArray(mismatches, 'forms', expected.forms, actual.forms)
  compareScalar(mismatches, 'counts.headings', expected.counts.headings, actual.counts.headings)
  compareScalar(mismatches, 'counts.links', expected.counts.links, actual.counts.links)
  compareScalar(mismatches, 'counts.images', expected.counts.images, actual.counts.images)
  compareScalar(mismatches, 'counts.forms', expected.counts.forms, actual.counts.forms)
  compareScalar(
    mismatches,
    'counts.visibleWords',
    expected.counts.visibleWords,
    actual.counts.visibleWords,
  )

  return mismatches
}

/**
 * Compares a provider report only when the raw page stayed byte-identical between
 * the buyer's pre-payment and post-delivery captures.
 *
 * The two source hashes are intentionally produced outside this comparator. A
 * shared extraction or normalization bug must not be able to manufacture temporal
 * continuity. Array order and URL strings are then compared exactly: this function
 * never sorts, resolves or strips a URL on the provider's behalf.
 */
export function compareFrozenPageSignals(input: {
  beforePayment: unknown
  afterDelivery: unknown
  providerReport: unknown
}): PageSignalsComparison {
  if (
    !isPageSignalsSnapshot(input.beforePayment) ||
    !isPageSignalsSnapshot(input.afterDelivery)
  ) {
    return {
      status: 'not_comparable',
      comparable: false,
      reason: 'invalid_snapshot_evidence',
      mismatches: [],
    }
  }

  const beforeTime = Date.parse(input.beforePayment.capturedAt)
  const afterTime = Date.parse(input.afterDelivery.capturedAt)
  if (
    !Number.isFinite(beforeTime) ||
    !Number.isFinite(afterTime) ||
    !SHA256_RE.test(input.beforePayment.sourceSha256) ||
    !SHA256_RE.test(input.afterDelivery.sourceSha256)
  ) {
    return {
      status: 'not_comparable',
      comparable: false,
      reason: 'invalid_snapshot_evidence',
      mismatches: [],
    }
  }
  if (beforeTime > afterTime) {
    return {
      status: 'not_comparable',
      comparable: false,
      reason: 'snapshot_order_invalid',
      mismatches: [],
    }
  }
  if (
    input.beforePayment.sourceSha256.toLowerCase() !==
    input.afterDelivery.sourceSha256.toLowerCase()
  ) {
    return {
      status: 'not_comparable',
      comparable: false,
      reason: 'source_changed_during_purchase_window',
      mismatches: [],
    }
  }

  if (!isPageSignals(input.providerReport)) {
    return {
      status: 'mismatch',
      comparable: true,
      mismatches: [{ path: 'providerReport', kind: 'value' }],
    }
  }

  const mismatches = compareSignals(input.afterDelivery.signals, input.providerReport)
  return {
    status: mismatches.length === 0 ? 'match' : 'mismatch',
    comparable: true,
    mismatches,
  }
}
