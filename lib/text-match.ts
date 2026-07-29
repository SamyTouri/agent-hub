// Lexical matching — the non-vector replacement for the semantic search removed on 2026-07-29.
//
// Why this exists and why it is deliberately dumb. The catalogue used to be searched by comparing
// OpenAI description embeddings, which produced a cosine "similarity" we published as a number.
// That number was computed by us from someone else's model over someone else's text, and readers
// took it for a measurement — the same failure as the star-derived ratings deleted on 2026-07-25.
// So the replacement returns no invented score at all. It reports only which terms actually
// matched, which is a fact about the text rather than an opinion about the meaning.
//
// Everything here is pure: no database, no network, no clock. The SQL that uses it lives in
// lib/agenthub.ts, and the matching index is db/migration-lexical-search.sql.

/** How much of the caller's query the row actually satisfied. Never a score. */
export type MatchStrength = 'all_terms' | 'some_terms'

// Deliberately tiny. A long stop list starts making editorial choices about meaning, which is the
// thing we just removed. These are only the words that would make an OR fallback match everything.
const NOISE = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'for', 'from', 'has',
  'have', 'i', 'if', 'in', 'into', 'is', 'it', 'me', 'my', 'need', 'of', 'on', 'or', 'that',
  'the', 'their', 'this', 'to', 'want', 'was', 'were', 'what', 'which', 'with', 'you', 'your',
])

const MAX_TERMS = 12
const MAX_TERM_LENGTH = 48

/**
 * Usable search terms from free text: lowercased, de-duplicated, noise removed, bounded.
 *
 * The bound matters. `websearch_to_tsquery` is safe against hostile input by design, but an
 * unbounded OR of every word in a 4000-character description would match the whole table and
 * present it as a result.
 */
export function searchTerms(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of String(text ?? '').toLowerCase().split(/[^a-z0-9+#.-]+/)) {
    const term = raw.replace(/^[.-]+|[.-]+$/g, '').slice(0, MAX_TERM_LENGTH)
    if (term.length < 2 || NOISE.has(term)) continue
    seen.add(term)
    if (seen.size >= MAX_TERMS) break
  }
  return [...seen]
}

/**
 * The OR fallback, in `websearch_to_tsquery` syntax.
 *
 * The strict query is the caller's text as written, which `websearch_to_tsquery` reads as "all of
 * these". When that returns nothing we widen to "any of these" rather than pretending to find the
 * closest neighbour — there is no neighbourhood without vectors, and inventing one would put us
 * back where we started. An empty string means there was nothing searchable, and the caller must
 * skip the query instead of running an unbounded one.
 */
export function anyTermQuery(text: string): string {
  return searchTerms(text).join(' or ')
}
