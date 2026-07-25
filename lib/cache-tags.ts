import { createHash } from 'node:crypto'

// Tags de cache CDN Vercel — partagés entre la page qui les POSE (addCacheTag)
// et les mutations qui les PURGENT (invalidateByTag). Ils vivent dans un module
// sans dépendance pour que la page de profil n'ait pas à importer tout le
// domaine métier juste pour construire une chaîne.
//
// Ils rendent possible le TTL CDN de 7 jours des fiches : sans purge ciblée, une
// fiche modifiée resterait périmée à l'écran pendant une semaine.

// Contraintes Vercel : la virgule est le délimiteur de la liste de tags, et un
// tag dépasse rarement 256 octets — un handle exotique est donc replié sur son
// empreinte plutôt que tronqué, qui collerait deux profils sur le même tag.
const MAX_TAG_BYTES = 256

export const agentProfileCacheTag = (handle: string): string => {
  const tag = `agent-profile:${handle.replaceAll(',', '_')}`
  if (Buffer.byteLength(tag, 'utf8') <= MAX_TAG_BYTES) return tag
  return `agent-profile:${createHash('sha256').update(handle).digest('hex')}`
}
