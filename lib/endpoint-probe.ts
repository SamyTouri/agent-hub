// Fraîcheur des endpoints annoncés dans l'annuaire.
//
// Promis publiquement dans le premier dossier écrit par nous (2026-07-25) : un vendeur
// dont l'hôte avait disparu restait affiché ici avec son endpoint mort, sans le moindre
// avertissement. Publier une adresse sans jamais dire si elle répond, ni même si on a
// regardé, c'est le défaut que le dossier reproche à l'écosystème.
//
// Ce que la sonde mesure, et RIEN de plus : est-ce que l'hôte répond encore ? Tout statut
// HTTP compte comme une réponse — un 401, un 404 ou un 405 prouvent qu'il y a quelqu'un au
// bout, et la plupart des endpoints MCP refusent légitimement un GET. L'échec, c'est
// l'absence de réponse : DNS mort, connexion refusée, délai dépassé. C'est exactement le
// cas du vendeur du dossier, dont le tunnel temporaire ne résolvait plus.
//
// Ce que la sonde ne dit PAS : que le service fonctionne, qu'il livre, qu'il est honnête ou
// qu'il convient à une mission. Un hôte qui répond n'est pas un hôte qui tient ses promesses.

export type EndpointCheck = {
  /** ISO date de la dernière tentative. */
  checked_at: string
  /** L'hôte a répondu quelque chose (n'importe quel statut HTTP). */
  responded: boolean
  /** Statut HTTP observé, si l'hôte a répondu. */
  status?: number
  /** Échecs consécutifs. Remis à 0 dès que l'hôte répond. */
  consecutive_failures: number
  /** ISO date du premier échec de la série en cours. Absent si l'hôte répond. */
  failing_since?: string
}

/** Deux échecs consécutifs avant d'annoncer quoi que ce soit : un incident passager ne
 *  doit pas faire dire publiquement qu'un agent a disparu. */
export const UNREACHABLE_AFTER = 2

export type ProbeOutcome = { responded: boolean; status?: number }

/** Transition d'état : ancienne observation + résultat de la sonde → nouvelle observation. */
export function nextCheck(
  previous: EndpointCheck | null | undefined,
  outcome: ProbeOutcome,
  now: string,
): EndpointCheck {
  if (outcome.responded) {
    return {
      checked_at: now,
      responded: true,
      ...(outcome.status == null ? {} : { status: outcome.status }),
      consecutive_failures: 0,
    }
  }
  const previousFailures = previous?.responded === false ? (previous.consecutive_failures ?? 0) : 0
  return {
    checked_at: now,
    responded: false,
    consecutive_failures: previousFailures + 1,
    failing_since: (previous?.responded === false && previous.failing_since) || now,
  }
}

export type EndpointStatus =
  | { kind: 'unchecked' }
  | { kind: 'responding'; checkedOn: string }
  | { kind: 'flaky'; checkedOn: string }
  | { kind: 'unreachable'; since: string; failures: number }

/** Ce qu'on a le droit d'affirmer publiquement à partir d'une observation. */
export function readStatus(check: EndpointCheck | null | undefined): EndpointStatus {
  if (!check?.checked_at) return { kind: 'unchecked' }
  const day = (iso: string) => iso.slice(0, 10)
  if (check.responded) return { kind: 'responding', checkedOn: day(check.checked_at) }
  if ((check.consecutive_failures ?? 0) >= UNREACHABLE_AFTER) {
    return {
      kind: 'unreachable',
      since: day(check.failing_since ?? check.checked_at),
      failures: check.consecutive_failures,
    }
  }
  return { kind: 'flaky', checkedOn: day(check.checked_at) }
}

/** Phrase publique correspondante — même texte sur la page et dans l'API. */
export function describeStatus(status: EndpointStatus): string {
  switch (status.kind) {
    case 'unchecked':
      return 'We have not checked whether this endpoint responds. Verify it yourself before relying on it.'
    case 'responding':
      return `The host answered our last check on ${status.checkedOn}. That proves the host is alive, nothing about delivery or quality.`
    case 'flaky':
      return `The host did not answer our check on ${status.checkedOn}. One miss is not a disappearance; we report it without concluding.`
    case 'unreachable':
      return `The host has not answered since ${status.since}, across ${status.failures} consecutive checks. An offer can outlive the agent behind it: a payment page may still take your money after delivery has become impossible.`
  }
}

/** Sonde réseau. Aucune exception ne remonte : une sonde qui casse ne casse pas un cron. */
export async function probeEndpoint(url: string, timeoutMs = 3000): Promise<ProbeOutcome> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'AgentReputationBot/1.0 (+https://agentreputation.dev)' },
    })
    return { responded: true, status: res.status }
  } catch {
    return { responded: false }
  }
}

/** Seules les URLs http(s) publiques sont sondées. */
export function isProbeableEndpoint(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return host !== 'localhost' && !host.endsWith('.local') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
  } catch {
    return false
  }
}
