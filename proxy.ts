import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

// Journal des passages de crawlers (Google, Bing, bots IA…) : seule vue possible
// sur le crawl des pages ISR — le proxy (ex-middleware) tourne AVANT le cache Vercel.
// Insert best-effort via l'API REST Supabase (le runtime edge n'a pas de TCP postgres).

const BOT_PATTERNS: Array<[string, RegExp]> = [
  ['googlebot', /googlebot|google-inspectiontool/i],
  ['bingbot', /bingbot/i],
  ['gptbot', /gptbot/i],
  ['oai-searchbot', /oai-searchbot/i],
  ['chatgpt-user', /chatgpt-user/i],
  ['claudebot', /claudebot/i],
  ['claude-user', /claude-user/i],
  ['claude-searchbot', /claude-searchbot/i],
  ['anthropic', /anthropic-ai/i],
  ['perplexity', /perplexitybot|perplexity-user/i],
  ['ccbot', /ccbot/i],
  ['duckduckbot', /duckduckbot/i],
  ['yandex', /yandex/i],
  ['seznambot', /seznambot/i],
  ['applebot', /applebot/i],
  ['amazonbot', /amazonbot/i],
  ['bytespider', /bytespider/i],
  ['meta', /meta-external|facebookexternalhit/i],
  ['mojeekbot', /mojeekbot/i],
  ['mistral', /mistralai/i],
  ['other-bot', /bot|crawler|spider|slurp/i], // filet générique, en dernier
]

function botName(ua: string): string | null {
  for (const [name, re] of BOT_PATTERNS) if (re.test(ua)) return name
  return null
}

export function proxy(req: NextRequest, event: NextFetchEvent) {
  const ua = req.headers.get('user-agent') ?? ''
  const bot = ua ? botName(ua) : null
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (bot && url && key) {
    event.waitUntil(
      fetch(`${url}/rest/v1/crawler_hits`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
          // Supabase refuse les clés secrètes sur des requêtes « navigateur » (UA Mozilla)
          'User-Agent': 'agent-hub-proxy/1.0',
        },
        body: JSON.stringify({
          bot,
          path: req.nextUrl.pathname.slice(0, 300),
          user_agent: ua.slice(0, 200),
        }),
      }).catch(() => {}),
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/agents/:path*',
    '/tags/:path*',
    '/llms.txt',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap/:path*',
    '/badge/:path*',
    '/.well-known/:path*',
  ],
}
