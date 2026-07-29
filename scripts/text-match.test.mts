// Ce que ces tests protègent : la frontière avec SQL, pas une notion de pertinence.
//
// `lib/text-match.ts` construit la chaîne passée à `websearch_to_tsquery`. Trois façons de
// se tromper y ont des conséquences réelles et silencieuses. Une chaîne vide fait renvoyer
// à Postgres une tsquery vide qui ne matche rien — le code appelant DOIT donc pouvoir
// détecter ce cas au lieu de lancer une requête inutile sur tout le catalogue. Une liste de
// termes non bornée transforme le repli « au moins un terme » en balayage de la table
// présenté comme un résultat. Et un opérateur de la syntaxe websearch laissé dans le texte
// d'un appelant changerait le sens de sa propre requête.
//
// Aucun test ici ne vérifie qu'un résultat est « pertinent » : il n'y a plus de score, et
// c'était le point de la suppression des vecteurs.
import assert from 'node:assert/strict'
import test from 'node:test'

import { anyTermQuery, searchTerms } from '../lib/text-match.ts'

// ---------------------------------------------------------------------------
// Vide et bruit pur : le seul contrat qui protège la base
// ---------------------------------------------------------------------------

test('empty and whitespace-only input produce no query at all', () => {
  for (const input of ['', '   ', '\n\t ', '!!!', '---', '...']) {
    assert.deepEqual(searchTerms(input), [], `${JSON.stringify(input)} must yield no term`)
    assert.equal(anyTermQuery(input), '', `${JSON.stringify(input)} must yield an empty query`)
  }
})

test('noise-only input is empty, so the caller can skip the query instead of scanning', () => {
  // C'est LE cas dangereux : « what is the » a des mots, donc une implémentation naïve
  // lancerait une requête. Une chaîne vide est le signal convenu pour ne rien lancer.
  assert.equal(anyTermQuery('what is the'), '')
  assert.equal(anyTermQuery('I want to have a'), '')
})

test('a single usable term survives among noise', () => {
  assert.deepEqual(searchTerms('I need a translation'), ['translation'])
  assert.equal(anyTermQuery('I need a translation'), 'translation')
})

// ---------------------------------------------------------------------------
// Déduplication et bornes
// ---------------------------------------------------------------------------

test('repeated terms are counted once, whatever their case', () => {
  assert.deepEqual(searchTerms('Postgres postgres POSTGRES database'), ['postgres', 'database'])
})

test('tag operands stay exact instead of inheriting full-text stemming', () => {
  // These values are passed unchanged to the indexed text[] operators. A controlled tag
  // named "database" must not silently become equivalent to the distinct tag "databases".
  assert.deepEqual(searchTerms('Database databases DATABASE'), ['database', 'databases'])
})

test('the term list is bounded, so the OR fallback cannot become a table scan', () => {
  const long = Array.from({ length: 200 }, (_, i) => `term${i}`).join(' ')
  const terms = searchTerms(long)
  assert.equal(terms.length, 12)
  assert.equal(anyTermQuery(long).split(' or ').length, 12)
})

test('an absurdly long single word is truncated rather than passed through', () => {
  const [term] = searchTerms('x'.repeat(500))
  assert.equal(term.length, 48)
})

// ---------------------------------------------------------------------------
// Ponctuation : ce qui fait partie d'un nom technique et ce qui sépare
// ---------------------------------------------------------------------------

test('punctuation splits terms without shredding real technical names', () => {
  assert.deepEqual(searchTerms('c++, c#, node.js'), ['c++', 'c#', 'node.js'])
  assert.deepEqual(searchTerms('agent-hub/registry:sync'), ['agent-hub', 'registry', 'sync'])
})

test('leading and trailing separators are stripped from a term', () => {
  assert.deepEqual(searchTerms('--flag-- ...dots...'), ['flag', 'dots'])
})

test('accents and non-latin scripts are dropped rather than mangled into fragments', () => {
  // Le tokenizer ne garde que a-z0-9+#.- : un mot accentué se scinderait en morceaux
  // trompeurs. Mieux vaut ne rien produire que produire « caf » et « e ».
  assert.deepEqual(searchTerms('日本語'), [])
  assert.ok(!searchTerms('café').includes('e'))
})

// ---------------------------------------------------------------------------
// Entrée hostile : la syntaxe websearch appartient à nous, pas à l'appelant
// ---------------------------------------------------------------------------

test('websearch operators inside caller text never survive into the built query', () => {
  // `or`, `-` et les guillemets ont un sens pour websearch_to_tsquery. Un appelant qui les
  // écrit ne doit pas pouvoir réécrire la requête que nous construisons : ils sont soit
  // filtrés comme bruit, soit réduits à des termes ordinaires.
  const built = anyTermQuery('database or -postgres "exact phrase"')
  for (const term of built.split(' or ')) {
    assert.notEqual(term, '', 'no empty term may reach the query')
    assert.ok(!term.includes('"'), `quote leaked into ${JSON.stringify(term)}`)
    assert.ok(!term.startsWith('-'), `negation leaked into ${JSON.stringify(term)}`)
    assert.notEqual(term, 'or', 'a bare operator must never become a term')
  }
  assert.ok(built.includes('database') && built.includes('postgres'))
})

test('quotes, backslashes and SQL-looking input are reduced to ordinary terms', () => {
  const hostile = `'; drop table agents; -- "select"`
  const built = anyTermQuery(hostile)
  for (const character of ['"', "'", ';', '\\']) {
    assert.ok(!built.includes(character), `${character} leaked into ${JSON.stringify(built)}`)
  }
  assert.ok(built.includes('drop') && built.includes('agents'))
})

test('the built query is always a clean OR chain, never a dangling operator', () => {
  for (const input of ['a b c', 'one', 'x or or y', '- - -']) {
    const built = anyTermQuery(input)
    if (built === '') continue
    assert.ok(!built.startsWith(' or '), `${JSON.stringify(built)} starts with an operator`)
    assert.ok(!built.endsWith(' or '), `${JSON.stringify(built)} ends with an operator`)
    assert.ok(!built.includes('or  or'), `${JSON.stringify(built)} has a doubled operator`)
  }
})

// ---------------------------------------------------------------------------
// Le repli OR
// ---------------------------------------------------------------------------

test('the OR fallback joins every retained term with the websearch or-operator', () => {
  assert.equal(anyTermQuery('postgres redis search'), 'postgres or redis or search')
})
