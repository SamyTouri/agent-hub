import type { Metadata } from 'next'
import { serializeJsonLd } from '@/lib/json-ld'
import { OWNERS_COPY, OWNERS_LANGS, ownersPath, type OwnersLang } from '@/lib/owners-i18n'
import { OWNERS_VISION_COPY } from '@/lib/owners-vision-i18n'

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
  const vision = OWNERS_VISION_COPY[lang]

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

        <header
          style={{
            marginTop: '1.75rem',
            padding: '1.4rem 1.35rem 1.25rem',
            background:
              'radial-gradient(circle at 10% 0%, rgba(62,134,255,.18), transparent 42%), linear-gradient(145deg, #111827, #101010 58%)',
            border: '1px solid #26344a',
            borderRadius: 16,
            boxShadow: '0 18px 50px rgba(0,0,0,.22)',
          }}
        >
          <p
            style={{
              color: '#7cb8ff',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              margin: '0 0 0.3rem',
            }}
          >
            {t.kicker}
          </p>
          <h1 style={{ fontSize: 31, lineHeight: 1.2, margin: '0 0 0.65rem' }}>{t.h1}</h1>
          <p style={{ ...muted, fontSize: 17, margin: 0 }}>{t.lead}</p>
        </header>

        <h2 style={h2}>{vision.missionTitle}</h2>
        <p style={{ margin: 0, fontSize: 16.5 }}>{vision.missionLead}</p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            margin: '1rem 0 0',
          }}
        >
          {vision.missionSteps.map((s, i) => (
            <span
              key={s}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', maxWidth: '100%' }}
            >
              {i > 0 && (
                <span aria-hidden style={{ color: '#555' }}>
                  {t.dir === 'rtl' ? '←' : '→'}
                </span>
              )}
              <span
                style={{
                  background: '#111',
                  border: '1px solid #2a3a4d',
                  borderRadius: 999,
                  padding: '0.4rem 0.9rem',
                  fontSize: 14,
                  color: '#cfe3ff',
                  overflowWrap: 'anywhere',
                }}
              >
                {s}
              </span>
            </span>
          ))}
        </div>

        <h2 style={h2}>{t.whatTitle}</h2>
        <p style={{ margin: 0 }}>{t.what}</p>

        <h2 style={h2}>{vision.valuesTitle}</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.65rem',
            marginTop: '0.75rem',
          }}
        >
          {vision.values.map((v) => (
            <a
              key={v.name}
              href={v.href}
              style={{
                display: 'block',
                background: '#111',
                border: '1px solid #262626',
                borderRadius: 10,
                padding: '0.75rem 0.95rem',
                color: '#eaeaea',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 650, fontSize: 14.5 }}>
                <span
                  aria-hidden
                  style={{ width: 7, height: 7, borderRadius: 999, background: '#6aa9ff', flexShrink: 0 }}
                />
                {v.name}
              </div>
              <div style={{ color: '#aaa', fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{v.line}</div>
            </a>
          ))}
        </div>
        <p style={{ ...muted, fontSize: 14.5, marginTop: '0.85rem' }}>
          {vision.valuesNote}{' '}
          <a href="/constitution" style={link}>
            {vision.valuesNoteLink}
          </a>
          .
        </p>

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

        <h2 style={h2}>{vision.moneyTitle}</h2>
        <p style={{ margin: 0 }}>
          {vision.money}{' '}
          <a href="/constitution#value-8-founder-income" style={link}>
            {vision.moneyLink}
          </a>
          .
        </p>

        <h2 style={h2}>{vision.safetyTitle}</h2>
        <p style={{ margin: 0 }}>{vision.safety}</p>

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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.35rem',
            alignItems: 'flex-start',
            background: '#101010',
            border: '1px solid #262626',
            borderRadius: 14,
            padding: '1.15rem',
          }}
        >
          {/* Image statique pré-optimisée (16 Ko) servie telle quelle : pas de
              next/image pour ne pas consommer le quota Image Optimization Hobby. */}
          <img
            src={PORTRAIT}
            alt={t.portraitAlt}
            width={156}
            height={156}
            loading="lazy"
            decoding="async"
            style={{ borderRadius: 12, border: '1px solid #262626', flexShrink: 0 }}
          />
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.9rem' }}>
              {vision.founderFacts.map((fact) => (
                <span
                  key={fact}
                  style={{
                    color: '#b9c7db',
                    background: '#151c26',
                    border: '1px solid #293548',
                    borderRadius: 999,
                    padding: '0.2rem 0.55rem',
                    fontSize: 12.5,
                  }}
                >
                  {fact}
                </span>
              ))}
            </div>
            {vision.founder.map((p) => (
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
