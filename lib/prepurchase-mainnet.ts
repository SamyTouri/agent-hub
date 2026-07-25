import {
  buildPaymentRequirements,
  checkPaymentAgainstRequirements,
  PREPURCHASE_PRICE_ATOMIC,
  PREPURCHASE_RESOURCE_URL,
  CDP_FACILITATOR_URL,
  type OrderInput,
  type PrepurchaseConfig,
} from './prepurchase.ts'
import {
  evaluateOffers,
  normalizeChallenges,
  PaymentPayloadV2Schema,
  USDC_NETWORKS,
  type PaymentPayloadV2,
} from './x402.ts'

/**
 * Acceptance réelle de l'offre préachat sur Base mainnet, avec de l'USDC qui a
 * une valeur monétaire.
 *
 * Ce module est un JUMEAU délibéré de `prepurchase-testnet.ts`, pas une
 * généralisation. Les deux chemins restent physiquement séparés — constantes,
 * sentinelles, comptes et scripts distincts — pour qu'aucune autorisation
 * testnet ne puisse jamais faire partir de l'argent réel, et pour qu'une
 * erreur de paramètre ne suffise jamais à franchir la frontière.
 *
 * Le montant n'est pas épinglé ici : il est repris de l'offre réelle, donc un
 * changement de prix ne peut pas laisser le banc de validation derrière lui.
 */
export const PREPURCHASE_MAINNET = {
  /** L'acceptation mainnet ne vise QUE notre route déployée. */
  endpoint: PREPURCHASE_RESOURCE_URL,
  network: 'eip155:8453',
  asset: USDC_NETWORKS['eip155:8453'].usdc,
  amountAtomic: PREPURCHASE_PRICE_ATOMIC,
  facilitatorUrl: CDP_FACILITATOR_URL,
  buyerWalletAccountName: 'aghub-prepurchase-mainnet-buyer',
  receiverWalletAccountName: 'aghub-prepurchase-mainnet-receiver',
  /** Nom réseau CDP correspondant, pour la lecture des soldes. */
  cdpNetwork: 'base',
} as const

/**
 * Sentinelles distinctes de celles du testnet, mot pour mot. Copier une
 * autorisation testnet ne peut donc rien déclencher ici.
 */
export const PREPURCHASE_MAINNET_EXECUTION_SENTINEL =
  'I-AUTHORIZE-EXACTLY-0.50-REAL-USDC-ON-BASE-MAINNET'

export const PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL =
  'I-AUTHORIZE-CDP-MAINNET-WALLET-PROVISIONING'

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Contrairement au testnet, aucun endpoint local n'est accepté : une
 * acceptation mainnet qui ne traverse pas la production ne prouverait pas la
 * chose qu'on cherche à prouver.
 */
export function resolvePrepurchaseMainnetEndpoint(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('PREPURCHASE_MAINNET_ENDPOINT is not a valid URL')
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'agentreputation.dev' ||
    parsed.pathname !== '/api/prepurchase/order' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error(
      'PREPURCHASE_MAINNET_ENDPOINT must be exactly the agentreputation.dev HTTPS pre-purchase route',
    )
  }
  return parsed.toString()
}

export function buildPrepurchaseMainnetOrder(): OrderInput {
  return {
    candidate: 'agent-reputation-mainnet-acceptance',
    mission:
      'Validate the Agent Reputation x402 pre-purchase order flow end to end with real USDC on Base mainnet.',
    budget_exposure:
      'Exactly 0.50 USDC of real value, paid by Agent Reputation to its own dedicated receiver.',
    failure_consequence:
      'The paid rail is not proven in real conditions and no outreach may claim that it is.',
    public_constraints:
      'Base mainnet only; native Circle USDC; dedicated receiver; no public delivery and no seller contact.',
    delivery_contact: 'mainnet-acceptance@invalid.example',
  }
}

export function prepurchaseMainnetExecutionErrors(input: {
  execute: boolean
  env: Record<string, string | undefined>
}): string[] {
  const errors: string[] = []
  if (!input.execute) errors.push('missing --execute')
  if (input.env.PREPURCHASE_MAINNET_EXECUTE !== PREPURCHASE_MAINNET_EXECUTION_SENTINEL) {
    errors.push(`PREPURCHASE_MAINNET_EXECUTE must equal ${PREPURCHASE_MAINNET_EXECUTION_SENTINEL}`)
  }
  if (!EVM_ADDRESS_RE.test(input.env.PREPURCHASE_MAINNET_PAY_TO ?? '')) {
    errors.push('PREPURCHASE_MAINNET_PAY_TO must be a valid dedicated EVM receiver')
  }
  if (!input.env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!input.env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!input.env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

export function prepurchaseMainnetWalletPreparationErrors(
  env: Record<string, string | undefined>,
): string[] {
  const errors: string[] = []
  if (
    env.PREPURCHASE_MAINNET_WALLET_PREPARE !== PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL
  ) {
    errors.push(
      `PREPURCHASE_MAINNET_WALLET_PREPARE must equal ${PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL}`,
    )
  }
  if (!env.CDP_API_KEY_ID) errors.push('missing CDP_API_KEY_ID')
  if (!env.CDP_API_KEY_SECRET) errors.push('missing CDP_API_KEY_SECRET')
  if (!env.CDP_WALLET_SECRET) errors.push('missing CDP_WALLET_SECRET')
  return errors
}

export function evaluatePrepurchaseMainnetChallenge(
  paymentRequiredHeader: string | null,
  expectedPayTo: string,
) {
  const evaluation = evaluateOffers(normalizeChallenges({ paymentRequiredHeader }), {
    maxAmountAtomic: BigInt(PREPURCHASE_MAINNET.amountAtomic),
    allowedNetworks: [PREPURCHASE_MAINNET.network],
    expectedAsset: PREPURCHASE_MAINNET.asset,
    expectedPayTo,
  })
  if (
    evaluation.decision !== 'GO' ||
    !evaluation.selected ||
    evaluation.selected.amountAtomic !== BigInt(PREPURCHASE_MAINNET.amountAtomic)
  ) {
    return {
      ok: false as const,
      evaluation,
      reason:
        evaluation.decision !== 'GO'
          ? 'the x402 challenge does not match the fixed Base mainnet acceptance'
          : 'the price is below the ceiling but is not exactly 0.50 USDC',
    }
  }
  return { ok: true as const, evaluation, offer: evaluation.selected }
}

/**
 * Limites redondantes appliquées par le SDK CDP, en plus de l'évaluation du
 * challenge. Le cumul est volontairement égal au prix d'UNE commande : le banc
 * de validation ne peut pas, même en boucle, faire sortir plus que l'ordre
 * unique qu'il est censé prouver.
 */
export function buildPrepurchaseMainnetSpendControls(payTo: string) {
  if (!EVM_ADDRESS_RE.test(payTo)) throw new Error('invalid mainnet receiver address')
  return {
    maxAmountPerPayment: {
      atomic: BigInt(PREPURCHASE_MAINNET.amountAtomic),
      asset: PREPURCHASE_MAINNET.asset,
    },
    maxCumulativeSpend: {
      atomic: BigInt(PREPURCHASE_MAINNET.amountAtomic),
      asset: PREPURCHASE_MAINNET.asset,
    },
    maxCumulativeSpendWindow: '24h' as const,
    allowedNetworks: [PREPURCHASE_MAINNET.network],
    allowedAssets: [PREPURCHASE_MAINNET.asset],
    allowedPayees: [payTo],
    maxLedgerEntries: 5,
  }
}

export function validatePrepurchaseMainnetPaymentPayload(payload: unknown, payTo: string) {
  const parsed = PaymentPayloadV2Schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false as const, reason: 'the CDP client produced an unreadable x402 v2 payload' }
  }
  const config: PrepurchaseConfig = {
    network: PREPURCHASE_MAINNET.network,
    asset: PREPURCHASE_MAINNET.asset,
    payTo,
    facilitatorUrl: PREPURCHASE_MAINNET.facilitatorUrl,
    facilitatorKind: 'cdp',
    mainnet: true,
  }
  const check = checkPaymentAgainstRequirements(
    parsed.data as PaymentPayloadV2,
    buildPaymentRequirements(config),
  )
  if (!check.ok) return { ok: false as const, reason: check.reason }
  return {
    ok: true as const,
    payload: parsed.data as PaymentPayloadV2,
    nonce: check.nonce,
    payer: check.payer,
  }
}
