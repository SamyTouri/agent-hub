// Soumission IndexNow (Bing, Yandex, Seznam, Naver… — l'index Bing alimente
// ChatGPT Search, Copilot et DuckDuckGo). Clé publique par design : le fichier
// public/{key}.txt prouve le contrôle du host, ce n'est pas un secret.
export const INDEXNOW_KEY = 'ffcdfbcca65a32dfd4026f467a3cc16a'
export const HOST = 'agent-hub-henna.vercel.app'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const BATCH = 2000

/** Soumet des URLs par lots. Retourne le nombre soumis (s'arrête au premier 429). */
export async function submitIndexNow(
  urls: string[],
  log: (m: string) => void = () => {},
): Promise<{ submitted: number; batches: number; stopped?: string }> {
  let submitted = 0
  let batches = 0
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429) {
      log(`batch ${batches + 1}: 429 — stop pour aujourd'hui`)
      return { submitted, batches, stopped: '429' }
    }
    if (!res.ok && res.status !== 200 && res.status !== 202) {
      log(`batch ${batches + 1}: HTTP ${res.status} — stop`)
      return { submitted, batches, stopped: `http_${res.status}` }
    }
    submitted += urlList.length
    batches += 1
    log(`batch ${batches}: ${urlList.length} URLs → ${res.status}`)
  }
  return { submitted, batches }
}
