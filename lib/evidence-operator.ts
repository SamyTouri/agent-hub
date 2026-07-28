// Qui est derrière un sujet — la clé d'opérateur, et pourquoi elle est double.
//
// Le problème vient d'un cas réel. Vingt-un sujets de la cohorte v2 étaient des variantes
// pays du même éditeur : `app.wishpool/algeria-payments-mcp`, `.../argentina-invoice-mcp`,
// et ainsi de suite. Si cet éditeur remet tout en ligne d'un coup, on enregistre vingt-un
// changements de disponibilité en quelques minutes. Chacun serait vrai. Ensemble, comptés
// comme un nombre, ils raconteraient vingt-un signaux indépendants du marché là où il n'y
// a eu qu'un seul événement chez un seul opérateur.
//
// Une clé par HÔTE n'y suffit pas : ces vingt-un sujets ont vingt-un hôtes différents
// (`mcp-dz.wishpool.app`, `inv-ar.wishpool.app`, …). La corrélation vit un cran au-dessus,
// au niveau du domaine enregistrable — et aussi dans le namespace du handle, qu'un éditeur
// qui change d'hébergeur emporterait avec lui.
//
// D'où deux axes indépendants, et le plafond s'applique sur CHACUN :
//
//   - `domain`    : domaine enregistrable de l'endpoint. Attrape l'éditeur qui décline un
//                   produit sur cent sous-domaines.
//   - `namespace` : préfixe du handle avant la barre oblique. Attrape l'éditeur qui garde
//                   son namespace en changeant d'hébergement.
//
// Deux axes plutôt qu'un fusionné, parce que fusionner suppose de savoir que deux
// identifiants désignent la même personne. On ne le sait pas. Plafonner chaque axe
// séparément n'exige jamais cette certitude : il suffit que deux sujets partagent l'axe
// considéré pour qu'ils cessent d'être des signaux indépendants sur cet axe.

/**
 * Suffixes sous lesquels le label suivant est un enregistrement distinct.
 *
 * Sans cette liste, « les deux derniers labels » réduirait `tippingservice.co.uk` à
 * `co.uk` — et regrouperait alors sous une seule clé tous les opérateurs britanniques.
 * Ce cas est présent dans les données, ce n'est pas une hypothèse.
 *
 * Deux familles s'y trouvent, pour deux raisons opposées :
 *
 *   - Les suffixes pays à plusieurs labels (`co.uk`, `com.au`, `com.ai`…), sinon on
 *     fusionne des opérateurs sans rapport.
 *   - Les plateformes d'hébergement partagé (`trycloudflare.com`, `workers.dev`,
 *     `vercel.app`…), pour la même raison exactement : deux locataires d'un même tunnel
 *     sont deux opérateurs, et les mettre sous une clé commune plafonnerait l'un à cause
 *     de l'autre.
 *
 * La liste est courte et assumée comme incomplète : elle couvre ce que le catalogue
 * contient aujourd'hui. Un suffixe manquant produit une clé TROP LARGE, donc un plafond
 * trop strict — on exclut un sujet de plus, on n'en laisse jamais passer un de trop. C'est
 * le sens dans lequel il faut se tromper.
 */
export const MULTI_LABEL_SUFFIXES: readonly string[] = [
  // Suffixes pays à deux labels, les plus courants.
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'co.jp',
  'co.kr',
  'co.nz',
  'co.za',
  'co.in',
  'com.au',
  'com.br',
  'com.cn',
  'com.mx',
  'com.tr',
  'com.tw',
  'com.sg',
  'com.hk',
  'com.ai',
  'com.co',
  // Hébergements partagés : chaque locataire est un opérateur distinct.
  'trycloudflare.com',
  'workers.dev',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'fly.dev',
  'onrender.com',
  'herokuapp.com',
  'run.app',
  'a.run.app',
  'azurewebsites.net',
  'ngrok.app',
  'ngrok.io',
  'ngrok-free.app',
  'loca.lt',
  'replit.dev',
  'railway.app',
  'up.railway.app',
  'render.com',
  'glitch.me',
  'deno.dev',
  'smithery.ai',
  'modal.run',
  'hf.space',
]

/** Un hôte qui n'est pas une adresse mais un champ de formulaire non rempli. */
export function isPlaceholderHost(host: string): boolean {
  return /[{}<>$]/.test(host) || /^(your|example|my)[-.]?(host|domain|server|url)$/i.test(host)
}

/**
 * Domaine enregistrable d'un hôte, d'après la liste ci-dessus.
 *
 * Retourne l'hôte complet quand il est déjà minimal ou quand il tombe sous une plateforme
 * partagée : dans les deux cas, il EST l'unité d'opérateur.
 */
export function registrableDomain(host: string): string {
  const clean = host.trim().toLowerCase().replace(/\.$/, '')
  if (!clean) return ''
  // Une adresse IP est son propre opérateur ; la découper n'aurait aucun sens.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(clean) || clean.includes(':')) return clean
  const labels = clean.split('.')
  if (labels.length <= 2) return clean
  // Suffixe le plus long d'abord : `a.run.app` doit gagner contre `run.app`.
  const suffixes = [...MULTI_LABEL_SUFFIXES].sort((a, b) => b.split('.').length - a.split('.').length)
  for (const suffix of suffixes) {
    const suffixLabels = suffix.split('.')
    if (labels.length <= suffixLabels.length) continue
    if (labels.slice(-suffixLabels.length).join('.') === suffix) {
      return labels.slice(-(suffixLabels.length + 1)).join('.')
    }
  }
  return labels.slice(-2).join('.')
}

export type OperatorKeys = {
  /** Domaine enregistrable de l'endpoint, ou null s'il n'y a pas d'endpoint lisible. */
  domain: string | null
  /** Namespace du handle, ou null si le handle n'en porte pas. */
  namespace: string | null
}

/** Les deux axes d'opérateur d'un sujet. Purement dérivés, donc rejouables et auditables. */
export function operatorKeysOf(subject: { handle: string; endpoint: string | null }): OperatorKeys {
  let domain: string | null = null
  if (subject.endpoint) {
    try {
      const host = new URL(subject.endpoint).hostname
      if (!isPlaceholderHost(host)) domain = registrableDomain(host) || null
    } catch {
      domain = null
    }
  }
  const slash = subject.handle.indexOf('/')
  const namespace = slash > 0 ? subject.handle.slice(0, slash).toLowerCase() : null
  return { domain, namespace }
}

/** Comptage par axe, pour le rapport comme pour la sélection. */
export type OperatorTally = { domain: Map<string, number>; namespace: Map<string, number> }

export function emptyTally(): OperatorTally {
  return { domain: new Map(), namespace: new Map() }
}

export function tallyOperator(tally: OperatorTally, keys: OperatorKeys): void {
  if (keys.domain) tally.domain.set(keys.domain, (tally.domain.get(keys.domain) ?? 0) + 1)
  if (keys.namespace) tally.namespace.set(keys.namespace, (tally.namespace.get(keys.namespace) ?? 0) + 1)
}

/** Vrai si l'un des deux axes est déjà au plafond. Le plus strict des deux gagne. */
export function operatorAtCap(tally: OperatorTally, keys: OperatorKeys, cap: number): boolean {
  if (keys.domain && (tally.domain.get(keys.domain) ?? 0) >= cap) return true
  if (keys.namespace && (tally.namespace.get(keys.namespace) ?? 0) >= cap) return true
  return false
}

/** Concentration lisible : les axes les plus chargés, pour un rapport. */
export function topConcentration(
  tally: OperatorTally,
  limit = 8,
): { by_domain: Array<{ key: string; subjects: number }>; by_namespace: Array<{ key: string; subjects: number }> } {
  const top = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, limit)
      .map(([key, subjects]) => ({ key, subjects }))
  return { by_domain: top(tally.domain), by_namespace: top(tally.namespace) }
}
