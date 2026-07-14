// Dérive des tags de catégorie pour les agents importés (l'import registre ne
// fournissait pas de tags → pages /tags vides sans ça). Matching par mots-clés
// curés sur handle + description ; ne touche PAS aux agents qui ont déjà des tags.
// Usage : node scripts/derive-tags.mjs   (DATABASE_URL requis, pooler 5432 ou 6543)
import postgres from 'postgres'

// [tag, regex] — ordre = priorité d'affichage ; max 5 tags par agent.
const CATEGORIES = [
  ['database', /\b(database|databases|postgres(?:ql)?|mysql|sqlite|mariadb|mongodb|clickhouse|duckdb|snowflake|bigquery|sql)\b/i],
  ['postgres', /\bpostgres(?:ql)?\b/i],
  ['redis', /\bredis\b/i],
  ['search', /\b(search|searching|retrieval|indexing)\b/i],
  ['web-scraping', /\b(scrap(?:e|ing|er)|crawl(?:er|ing)?|fetch(?:ing)? web|web content)\b/i],
  ['browser', /\b(browser|playwright|puppeteer|selenium|chrome|chromium)\b/i],
  ['github', /\bgithub\b/i],
  ['git', /\bgit(?!hub|lab)\b/i],
  ['gitlab', /\bgitlab\b/i],
  ['slack', /\bslack\b/i],
  ['discord', /\bdiscord\b/i],
  ['telegram', /\btelegram\b/i],
  ['whatsapp', /\bwhatsapp\b/i],
  ['email', /\b(email|e-mail|gmail|outlook|imap|smtp)\b/i],
  ['calendar', /\b(calendar|scheduling|appointment)\b/i],
  ['notion', /\bnotion\b/i],
  ['obsidian', /\bobsidian\b/i],
  ['jira', /\bjira\b/i],
  ['confluence', /\bconfluence\b/i],
  ['linear', /\blinear\b/i],
  ['filesystem', /\b(filesystem|file system|local files?|file operations)\b/i],
  ['kubernetes', /\b(kubernetes|k8s|kubectl|helm)\b/i],
  ['docker', /\bdocker\b/i],
  ['aws', /\b(aws|amazon web services|s3|lambda|dynamodb|cloudwatch)\b/i],
  ['azure', /\bazure\b/i],
  ['google-cloud', /\b(gcp|google cloud|bigquery|firebase)\b/i],
  ['cloudflare', /\bcloudflare\b/i],
  ['supabase', /\bsupabase\b/i],
  ['stripe', /\bstripe\b/i],
  ['payments', /\b(payments?|billing|invoic(?:e|ing))\b/i],
  ['blockchain', /\b(blockchain|web3|ethereum|solana|bitcoin|crypto(?:currency)?|defi|nft)\b/i],
  ['ai', /\b(llm|large language model|openai|anthropic|claude|gpt|gemini|mistral|ollama)\b/i],
  ['rag', /\b(rag|retrieval[- ]augmented|vector (?:db|database|store|search)|embeddings?)\b/i],
  ['memory', /\b(memory|knowledge graph|knowledge base)\b/i],
  ['image', /\b(image|images|photo|diffusion|dall-e|midjourney|stable diffusion)\b/i],
  ['video', /\b(video|youtube|vimeo)\b/i],
  ['audio', /\b(audio|speech|voice|transcription|whisper|text-to-speech|tts)\b/i],
  ['translation', /\b(translat(?:e|ion|or))\b/i],
  ['weather', /\bweather\b/i],
  ['maps', /\b(maps?|geocod(?:e|ing)|geolocation|gps)\b/i],
  ['travel', /\b(travel|flights?|hotels?|booking)\b/i],
  ['finance', /\b(finance|financial|stocks?|trading|market data|portfolio)\b/i],
  ['news', /\b(news|headlines|rss)\b/i],
  ['security', /\b(security|vulnerabilit(?:y|ies)|pentest|cve|malware|threat)\b/i],
  ['monitoring', /\b(monitor(?:ing)?|observability|logs?|logging|metrics|alerting|sentry|datadog|grafana|prometheus)\b/i],
  ['analytics', /\b(analytics|posthog|amplitude|mixpanel|google analytics)\b/i],
  ['testing', /\b(test(?:ing)?|qa|unit tests?|e2e)\b/i],
  ['code-review', /\b(code review|lint(?:er|ing)?|static analysis)\b/i],
  ['code-execution', /\b(code execution|sandbox|repl|run code|execute code)\b/i],
  ['documentation', /\b(documentation|docs|readme|api reference)\b/i],
  ['api', /\b(api|apis|rest|graphql|openapi|swagger|http requests?)\b/i],
  ['automation', /\b(automat(?:e|ion|ing)|workflow|n8n|zapier|make\.com)\b/i],
  ['ecommerce', /\b(e-?commerce|shopify|woocommerce|store|shop)\b/i],
  ['wordpress', /\bwordpress\b/i],
  ['seo', /\bseo\b/i],
  ['social-media', /\b(social media|twitter|x\.com|linkedin|instagram|reddit|mastodon|bluesky)\b/i],
  ['spotify', /\bspotify\b/i],
  ['gaming', /\b(game|games|gaming|minecraft|steam)\b/i],
  ['education', /\b(education|learning|course|tutor)\b/i],
  ['crm', /\b(crm|salesforce|hubspot|pipedrive)\b/i],
  ['data-analysis', /\b(data analysis|pandas|jupyter|spreadsheets?|excel|csv)\b/i],
  ['pdf', /\bpdf\b/i],
  ['ocr', /\bocr\b/i],
  ['healthcare', /\b(health(?:care)?|medical|fhir|clinical)\b/i],
  ['legal', /\b(legal|law|contracts?|compliance)\b/i],
  ['hr', /\b(recruiting|recruitment|hiring|hr\b)/i],
  ['iot', /\b(iot|home assistant|smart home|mqtt)\b/i],
  ['3d', /\b(3d|blender|cad|unity|unreal)\b/i],
  ['math', /\b(math(?:s|ematics)?|wolfram|calculation|calculator)\b/i],
  ['time', /\b(time|timezone|date)\b/i],
]

const MAX_TAGS = 5
const BATCH = 1000

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })
const log = (m) => process.stderr.write(`${m}\n`)

try {
  // Recalcule les tags de TOUS les agents importés (écrase les tags dérivés
  // précédents ; les agents natifs ne sont jamais touchés).
  const rows = await sql`
    select handle, left(coalesce(description, ''), 600) as description
    from agents
    where external_source is not null
  `
  log(`${rows.length} agents importés à retagger`)

  const updates = []
  for (const r of rows) {
    // Le namespace registre ("io.github.owner/name") ferait matcher "github"
    // sur 75 % du catalogue — on ne garde que owner/name pour le matching.
    const cleanHandle = r.handle.replace(/^(?:io|com)\.github\./i, '')
    const text = `${cleanHandle} ${r.description}`
    const tags = []
    for (const [tag, re] of CATEGORIES) {
      if (re.test(text)) {
        tags.push(tag)
        if (tags.length >= MAX_TAGS) break
      }
    }
    updates.push({ handle: r.handle, tags })
  }
  log(`${updates.length} agents taggés (${rows.length - updates.length} sans match)`)

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH)
    await sql`
      update agents a
      set tags = (select array(select jsonb_array_elements_text(j.value->'tags')))
      from jsonb_array_elements(${JSON.stringify(chunk)}::text::jsonb) j
      where a.handle = j.value->>'handle'
    `
    log(`  batch ${i / BATCH + 1}/${Math.ceil(updates.length / BATCH)} ok`)
  }

  const [{ n }] = await sql`select count(*)::int as n from agents where array_length(tags,1) > 0`
  console.log(JSON.stringify({ tagged_total: n, updated: updates.length }))
} finally {
  await sql.end()
}
