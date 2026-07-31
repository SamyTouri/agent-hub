// Répétition en grandeur réelle du dépôt au Complaint Bureau.
//
// POURQUOI CE FICHIER EXISTE. Les tables du bureau sont en production depuis le
// 30/07 et le chemin d'écriture depuis le site n'a jamais servi : le seul essai
// était une transaction ANNULÉE, donc rien n'a traversé l'endpoint public, le
// réseau, la validation, la signature et l'insertion. Sans cette répétition, le
// premier plaignant réel serait aussi le premier test d'intégration, sur un
// registre dont aucune ligne ne s'efface.
//
// CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS. Il joue les deux temps de l'intake
// contre la vraie production, avec une affaire dont NOUS contrôLONS LES DEUX
// ADRESSES — l'auto-achat de référencement du 30/07, où notre portefeuille
// acheteur a payé notre propre encaissement. Aucun tiers n'est mis en cause,
// parce que la contrepartie, c'est nous. Il ne publie rien, ne notifie personne
// et n'a aucun chemin vers la publication : celle-ci n'existe que dans
// `complaint-desk.mts`, qui refuse un dossier non vérifié.
//
// LA CONSÉQUENCE À ASSUMER AVANT DE LE LANCER. Le dépôt signé écrit une ligne
// définitive dans un registre sans DELETE. Elle restera, au statut `rejected`
// après le passage à l'outil opérateur, et elle est invisible du public qui ne
// lit que les dossiers publiés. Le récit déposé dit lui-même ce qu'il est, pour
// que personne relisant la table dans six mois ne la prenne pour une plainte.
//
// Usage :
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types \
//     scripts/complaint-intake-drill.mts --dry-run          # temps 1 seul
//     scripts/complaint-intake-drill.mts --write-for-real    # temps 1 puis 2

import { DISCOVERY_LISTING } from '../lib/discovery-listing.ts'

const ENDPOINT = 'https://agentreputation.dev/api/complaints'
const USER_AGENT = 'Agent-Reputation-Intake-Drill/1.0'

/** Le règlement réel du 30/07, relu depuis le reçu conservé hors dépôt. */
const SETTLEMENT = {
  transaction: '0x3b9cc1b7fb42df9b3d9ee0755d3236557c312fed63836eba48b80c325a5316c3',
  settledAt: '2026-07-30T15:39:37.579Z',
  resource: DISCOVERY_LISTING.endpoint,
} as const

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Le récit est le seul champ libre du dépôt, donc le seul endroit où une
 * répétition peut se déguiser en plainte. Il déclare ce qu'il est dès sa
 * première phrase, et ne met en cause personne.
 */
function drillAccount(): string {
  return [
    'BUREAU SELF-TEST — NOT A COMPLAINT. This filing was written by the bureau itself to',
    'exercise its own intake path end to end before a real party ever uses it, and it must',
    'never be published, counted, quoted or read as a grievance against anyone.',
    '',
    `The matter is real: on ${SETTLEMENT.settledAt} our own buyer wallet settled 0.50 USDC`,
    'on Base against our own receiving address, for the sole purpose of entering the x402',
    'discovery catalogue, which indexes a resource only on its first settled payment. Both',
    'addresses belong to Agent Reputation, so both parties to this matter are the same party,',
    'and there is nothing here for anyone to answer.',
    '',
    'What is being tested is the machinery, not the seller: that the endpoint returns the exact',
    'statement to sign, that the signature is recovered to the address it claims, that the',
    'admissibility verdict precedes the signature so nobody signs something we would refuse,',
    'and that the row lands in a registry from which nothing can be deleted. The expected',
    'outcome is a rejection recorded by the operator tool, with this text as its reason.',
  ].join('\n')
}

function drillFiling() {
  return {
    role: 'payer' as const,
    address: DISCOVERY_LISTING.buyerAddress,
    counterparty_address: DISCOVERY_LISTING.recipient,
    network: DISCOVERY_LISTING.network,
    matter_reference: SETTLEMENT.transaction,
    matter_url: `https://basescan.org/tx/${SETTLEMENT.transaction}`,
    settled_basis: 'payment_reached_payee' as const,
    settled_evidence: [
      'The settlement transaction is confirmed on Base and readable by anyone at the given URL:',
      'value moved from the payer to the payee, so the matter closed in its first second.',
    ].join(' '),
    subject_label: 'agentreputation.dev pre-purchase evidence brief (self-purchase, both parties are us)',
    account: drillAccount(),
    counterparty_channel_kind: 'machine' as const,
    counterparty_channel: 'https://agentreputation.dev/api/mcp',
    filer_contact: 'bureau@agentreputation.dev (self-test, no third party)',
    filed_on: today(),
  }
}

async function post(body: unknown, url: string = ENDPOINT) {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(text)
  } catch {
    /* on rend le texte brut plutôt que de masquer une page d'erreur */
  }
  return { status: response.status, body: parsed, text }
}

/**
 * Signature EIP-191 par le portefeuille CDP qui a réellement payé. Le secret ne
 * transite ni par un log, ni par une sortie, ni par un fichier : le SDK le lit
 * dans l'environnement fourni par le lanceur PowerShell.
 */
async function signWith(accountName: string, expectedAddress: string, statement: string): Promise<string> {
  const { CdpClient } = await import('@coinbase/cdp-sdk')
  const cdp = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
  })
  const account = await cdp.evm.getAccount({ name: accountName })
  if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(
      `REFUSED: the wallet named ${accountName} resolves to ${account.address}, not ${expectedAddress}.`,
    )
  }
  return await account.signMessage({ message: statement })
}

/**
 * Deuxième moitié de la répétition : la contrepartie répond. C'est la promesse centrale
 * du bureau — « gratuit, inconditionnel, attaché au dossier pour toujours » — et tant
 * qu'elle n'a pas été exercée avec une vraie signature, ce n'est qu'une phrase sur une
 * page. Possible ici seulement parce que l'adresse encaisseuse de l'auto-achat est aussi
 * la nôtre, sous le nom de portefeuille `aghub-prepurchase-mainnet-receiver`.
 */
async function replyAsCounterparty(filingId: string) {
  const reply = [
    'BUREAU SELF-TEST — NOT A REAL REPLY. Agent Reputation is the counterparty of this',
    'matter as well as its filer, because both addresses are ours. This text exists only to',
    'prove that the free reply channel accepts a signature from the counterparty address and',
    'attaches the words to the file without the bureau approving them.',
  ].join('\n')
  const repliedOn = today()

  console.log('\n--- step 3: unsigned reply POST (stores nothing) ---')
  const step3 = await post(
    { filing_id: filingId, address: DISCOVERY_LISTING.recipient, reply, replied_on: repliedOn },
    `${ENDPOINT}/reply`,
  )
  console.log(`HTTP ${step3.status}`)
  const ready = step3.body as { status?: string; statement_to_sign?: string } | null
  if (step3.status !== 200 || !ready?.statement_to_sign) {
    console.log(step3.text.slice(0, 1500))
    throw new Error('the reply endpoint did not return a statement to sign')
  }
  console.log(ready.statement_to_sign)

  console.log('\n--- step 4: signing as the counterparty ---')
  const signature = await signWith(
    DISCOVERY_LISTING.receiverWalletAccountName,
    DISCOVERY_LISTING.recipient,
    ready.statement_to_sign,
  )
  console.log(`signature length: ${signature.length} characters (value not printed)`)

  const step4 = await post(
    {
      filing_id: filingId,
      address: DISCOVERY_LISTING.recipient,
      reply,
      replied_on: repliedOn,
      signature,
    },
    `${ENDPOINT}/reply`,
  )
  console.log(`HTTP ${step4.status}`)
  console.log(JSON.stringify(step4.body ?? step4.text, null, 2))
  if (step4.status !== 201) throw new Error('the reply was not accepted')
}

async function main() {
  const argv = process.argv.slice(2)
  const forReal = argv.includes('--write-for-real')
  const dryRun = argv.includes('--dry-run')
  const replyTo = argv.find((a) => a.startsWith('--reply-to='))?.slice('--reply-to='.length)

  if (replyTo) {
    if (!/^cb-[0-9a-f]{20}$/.test(replyTo)) throw new Error('--reply-to=<cb-...> expects a filing reference')
    await replyAsCounterparty(replyTo)
    return
  }

  if (forReal === dryRun) {
    throw new Error('pass exactly one of --dry-run, --write-for-real or --reply-to=<id>')
  }

  const filing = drillFiling()

  // Temps 1 — sans signature. Aucun stockage, rejouable à volonté.
  console.log('--- step 1: unsigned POST (stores nothing) ---')
  const step1 = await post(filing)
  console.log(`HTTP ${step1.status}`)
  const ready = step1.body as {
    status?: string
    admissible?: boolean
    admissible_because?: string
    not_admissible_because?: string
    statement_to_sign?: string
  } | null

  if (step1.status !== 200 || ready?.status !== 'statement_ready') {
    console.log(step1.text.slice(0, 2000))
    throw new Error('step 1 did not return a statement to sign')
  }
  console.log(`admissible: ${ready.admissible}`)
  console.log(`because   : ${ready.admissible_because ?? ready.not_admissible_because}`)
  console.log('--- statement the server will reconstruct ---')
  console.log(ready.statement_to_sign)
  console.log('--- end of statement ---')

  if (!ready.admissible || !ready.statement_to_sign) {
    throw new Error('REFUSED: the bureau would not accept this filing; nothing was signed.')
  }

  if (dryRun) {
    console.log('\ndry run: nothing signed, nothing stored. Re-run with --write-for-real to file.')
    return
  }

  // Temps 2 — signature puis dépôt. C'est l'écriture définitive.
  console.log('\n--- step 2: signing with the wallet that actually paid ---')
  const signature = await signWith(
    DISCOVERY_LISTING.buyerWalletAccountName,
    DISCOVERY_LISTING.buyerAddress,
    ready.statement_to_sign,
  )
  console.log(`signature length: ${signature.length} characters (value not printed)`)

  console.log('--- step 2: signed POST (writes a permanent row) ---')
  const step2 = await post({ ...filing, signature })
  console.log(`HTTP ${step2.status}`)
  console.log(JSON.stringify(step2.body ?? step2.text, null, 2))

  const filed = step2.body as { status?: string; filing_id?: string } | null
  if (step2.status !== 201 || filed?.status !== 'filed') {
    throw new Error(`the filing was not accepted: ${filed?.status ?? step2.status}`)
  }
  console.log('\nNEXT, AND IT IS NOT OPTIONAL:')
  console.log(`  reject ${filed.filing_id} with the operator tool, so the drill cannot be mistaken`)
  console.log('  for a live matter. It is invisible to the public either way — only published')
  console.log('  filings are listed — but a self-test left open is a self-test that will be')
  console.log('  misread later.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
