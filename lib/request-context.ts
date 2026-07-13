import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'

export type RequestOrigin = { ipHash: string | null; userAgent: string | null }

/** Contexte par requête : logActivity y lit l'origine sans que chaque tool la propage. */
export const requestOrigin = new AsyncLocalStorage<RequestOrigin>()

/** IP hashée (jamais stockée en clair) + user-agent tronqué. */
export function originFromRequest(req: Request): RequestOrigin {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  return {
    ipHash: ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null,
    userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
  }
}

export const withOrigin =
  (handler: (req: Request) => Promise<Response>) =>
  (req: Request): Promise<Response> =>
    requestOrigin.run(originFromRequest(req), () => handler(req))
