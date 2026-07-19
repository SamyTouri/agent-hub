import type { Metadata } from 'next'
import { OWNERS_LANGS, type OwnersLang } from '@/lib/owners-i18n'
import { OwnersPage, ownersMetadata } from '../owners-page'

// Variantes linguistiques — toutes prérendues au build, aucune route dynamique
// au runtime (dynamicParams=false → lang inconnue = 404), zéro écriture ISR.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return OWNERS_LANGS.filter((l) => l !== 'en').map((lang) => ({ lang }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return ownersMetadata(lang as OwnersLang)
}

export default async function OwnersLocalized({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return <OwnersPage lang={lang as OwnersLang} />
}
