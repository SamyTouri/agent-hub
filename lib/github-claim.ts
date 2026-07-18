import { createHmac } from 'crypto'

// Preuve de contrôle GitHub pour les fiches importées du registre MCP officiel.
// Stateless par design : le challenge est un HMAC(handle, secret serveur) — pas
// d'état de session, le même appel sert à obtenir le challenge puis à vérifier.
// Le repo cible vient TOUJOURS de la donnée serveur (metadata.repo, posée par
// l'import registre), jamais de l'appelant : impossible de pointer la preuve
// vers un repo qu'on possède pour claimer la fiche d'un autre.

export type GithubRepo = { owner: string; repo: string }

const REPO_SEGMENT = /^[A-Za-z0-9_.-]+$/

/** Parse une URL GitHub stockée en metadata.repo → { owner, repo } strictement validés. */
export function parseGithubRepo(url: string | null | undefined): GithubRepo | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length !== 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/i, '')
    if (!REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo)) return null
    return { owner, repo }
  } catch {
    return null
  }
}

/** Challenge déterministe par handle — stable tant que le secret ne change pas. */
export function buildClaimChallenge(handle: string, secret: string): string {
  return 'ar-claim-' + createHmac('sha256', secret).update(handle).digest('hex').slice(0, 40)
}

export const CHALLENGE_FILENAME = 'agentreputation.txt'

/** Emplacements acceptés pour le fichier de preuve, dans l'ordre de vérification. */
export function challengeFileUrls({ owner, repo }: GithubRepo): string[] {
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`
  return [`${base}/.well-known/${CHALLENGE_FILENAME}`, `${base}/${CHALLENGE_FILENAME}`]
}

/** Le fichier prouve le contrôle s'il contient le challenge exact (fichier ≤ 64 KB). */
export function contentProvesChallenge(body: string, challenge: string): boolean {
  return body.slice(0, 65536).includes(challenge)
}

async function readTextUpTo(res: Response, maxBytes: number): Promise<string | null> {
  const declaredSize = Number(res.headers.get('content-length') ?? 0)
  if (declaredSize > maxBytes) return null
  if (!res.body) return ''

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) return null
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Cherche le fichier de preuve dans le repo. Renvoie l'URL du fichier valide,
 * `null` si absent ou sans le challenge. Hôte fixe (raw.githubusercontent.com),
 * segments validés par regex : pas de surface SSRF.
 */
export async function fetchChallengeProof(target: GithubRepo, challenge: string): Promise<string | null> {
  for (const url of challengeFileUrls(target)) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
        headers: {
          Accept: 'text/plain',
          'User-Agent': 'agent-reputation-github-claim/1.0',
        },
      })
      if (!res.ok) continue
      if (new URL(res.url).hostname.toLowerCase() !== 'raw.githubusercontent.com') continue
      const body = await readTextUpTo(res, 65536)
      if (body === null) continue
      if (contentProvesChallenge(body, challenge)) return url
    } catch {
      /* timeout / réseau : on tente l'emplacement suivant */
    }
  }
  return null
}
