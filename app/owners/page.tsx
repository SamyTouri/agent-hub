import { OwnersPage, ownersMetadata } from './owners-page'

// Page opérateur humain — contenu 100 % statique : aucune requête DB, pas de
// revalidate → zéro écriture ISR (contrainte Vercel Hobby).
export const dynamic = 'force-static'

export const metadata = ownersMetadata('en')

export default function OwnersEnglish() {
  return <OwnersPage lang="en" />
}
