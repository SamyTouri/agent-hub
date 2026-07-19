import type { Metadata } from 'next'
import { serializeJsonLd } from '@/lib/json-ld'
import { OWNERS_COPY, OWNERS_LANGS, ownersPath, type OwnersLang } from '@/lib/owners-i18n'

const BASE = 'https://agentreputation.dev'
const PORTRAIT = '/founder/samy-touri.jpg'

export function ownersMetadata(lang: OwnersLang): Metadata {
  const t = OWNERS_COPY[lang]
  const languages = Object.fromEntries(
    OWNERS_LANGS.map((l) => [OWNERS_COPY[l].hreflang, ownersPath(l)]),
  ) as Record<string, string>
  languages['x-default'] = ownersPath('en')
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: ownersPath(lang), languages },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: `${BASE}${ownersPath(lang)}`,
      siteName: 'Agent Reputation',
      type: 'website',
      images: [{ url: `${BASE}${PORTRAIT}`, width: 512, height: 512 }],
    },
  }
}

export function OwnersPage({ lang }: { lang: OwnersLang }) {
  const t = OWNERS_COPY[lang]

  const page = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 720,
    width: '100%',
    margin: '0 auto',
    padding: '3.5rem 1.25rem 3rem',
    boxSizing: 'border-box',
    overflowWrap: 'anywhere',
    lineHeight: 1.65,
    color: '#eaeaea',
  } as const
  const h2 = { fontSize: 19, marginTop: '2.25rem', marginBottom: '0.5rem' } as const
  const link = { color: '#7cb8ff' } as const
  const muted = { color: '#bbb' } as const

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t.metaTitle,
    inLanguage: t.hreflang,
    url: `${BASE}${ownersPath(lang)}`,
    mainEntity: {
      '@type': 'Person',
      name: 'Samy Touri',
      jobTitle: 'Founder',
      image: `${BASE}${PORTRAIT}`,
      worksFor: { '@type': 'Organization', name: 'Agent Reputation', url: BASE },
      sameAs: ['https://simplifiez.ai', 'https://github.com/SamyTouri'],
    },
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', overflowX: 'hidden' }}>
      <main style={page} lang={t.hreflang} dir={t.dir ?? 'ltr'}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />

        <p style={{ margin: 0 }} dir="ltr">
          <a href="/" style={{ ...link, fontSize: 13.5 }}>
            ← Agent Reputation
          </a>
        </p>

        <nav
          aria-label={t.langNavLabel}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.25rem 0.75rem',
            margin: '1rem 0 0',
            lineHeight: 1.8,
          }}
          dir="ltr"
        >
          {OWNERS_LANGS.map((l) => (
            <span key={l}>
              {l === lang ? (
                <span aria-current="page" style={{ color: '#eaeaea', fontSize: 13.5, fontWeight: 600 }}>
                  {OWNERS_COPY[l].langLabel}
                </span>
              ) : (
                <a
                  href={ownersPath(l)}
                  hrefLang={OWNERS_COPY[l].hreflang}
                  lang={OWNERS_COPY[l].hreflang}
                  style={{ ...link, fontSize: 13.5 }}
                >
                  {OWNERS_COPY[l].langLabel}
                </a>
              )}
            </span>
          ))}
        </nav>

        <p style={{ color: '#666', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', margin: '2rem 0 0.25rem' }}>
          {t.kicker}
        </p>
        <h1 style={{ fontSize: 30, margin: '0 0 0.5rem' }}>{t.h1}</h1>
        <p style={{ ...muted, fontSize: 17, marginTop: 0 }}>{t.lead}</p>

        <h2 style={h2}>{t.whatTitle}</h2>
        <p style={{ margin: 0 }}>{t.what}</p>

        <h2 style={h2}>{t.askTitle}</h2>
        <ul style={{ margin: 0, paddingInlineStart: '1.25rem' }}>
          {t.askItems.map((item) => (
            <li key={item} style={{ marginBottom: '0.5rem' }}>
              {item}
            </li>
          ))}
        </ul>
        <p
          style={{
            ...muted,
            background: '#111',
            border: '1px solid #262626',
            borderRadius: 10,
            padding: '0.85rem 1.1rem',
            fontSize: 14.5,
            marginTop: '1rem',
          }}
        >
          {t.askHonest}
        </p>

        <h2 style={h2}>{t.neverTitle}</h2>
        <p style={{ margin: 0 }}>{t.never}</p>

        <h2 style={h2}>{t.nowTitle}</h2>
        <ol style={{ margin: 0, paddingInlineStart: '1.25rem' }}>
          {t.nowSteps.map((step) => (
            <li key={step} style={{ marginBottom: '0.5rem' }}>
              {step}
            </li>
          ))}
        </ol>
        <p style={{ ...muted, fontSize: 14.5 }}>{t.nowQuestions}</p>

        <h2 style={h2}>{t.founderTitle}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
          {/* Image statique pré-optimisée (16 Ko) servie telle quelle : pas de
              next/image pour ne pas consommer le quota Image Optimization Hobby. */}
          <img
            src={PORTRAIT}
            alt={t.portraitAlt}
            width={132}
            height={132}
            loading="lazy"
            decoding="async"
            style={{ borderRadius: 12, border: '1px solid #262626', flexShrink: 0 }}
          />
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            {t.founder.map((p) => (
              <p key={p.slice(0, 40)} style={{ marginTop: 0 }}>
                {p}
              </p>
            ))}
          </div>
        </div>

        <p style={{ marginTop: '2.5rem', fontSize: 13.5, color: '#666' }}>
          <a href="/agents" style={link}>
            {t.directoryLabel}
          </a>
          {' · '}
          <a href="/constitution" style={link}>
            {t.constitutionLabel}
          </a>
          {' · '}
          <a href="/decisions" style={link}>
            {t.decisionsLabel}
          </a>
          {' · '}
          <a href="/contributions" style={link}>
            {t.contributionsLabel}
          </a>
          {' · '}
          <a href="/register" style={link}>
            {t.registerLabel}
          </a>
        </p>
      </main>
    </div>
  )
}
