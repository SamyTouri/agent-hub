// Provision and inspect the two dedicated CDP accounts used by the Base
// mainnet acceptance. This script never exports private keys, never moves
// funds, and has no faucet: mainnet USDC can only arrive from a deliberate
// human transfer.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { CdpClient } from '@coinbase/cdp-sdk'

import {
  PREPURCHASE_MAINNET,
  PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL,
} from '../lib/prepurchase-mainnet.ts'

const statePath = resolve('.exchange/codex/prepurchase-mainnet-wallets.json')

type Action = 'provision' | 'inspect'

type WalletState = {
  version: 1
  network: typeof PREPURCHASE_MAINNET.network
  receiver: { name: string; address: string }
  buyer: { name: string; address: string }
}

function parseAction(argv: string[]): Action {
  if (argv.length !== 1) {
    throw new Error('choose exactly one action: --provision or --inspect')
  }
  if (argv[0] === '--provision') return 'provision'
  if (argv[0] === '--inspect') return 'inspect'
  throw new Error(`unknown action: ${argv[0]}`)
}

function requireCredentials() {
  const missing = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET'].filter(
    (name) => !process.env[name],
  )
  if (missing.length > 0) {
    throw new Error(`missing private runtime credentials: ${missing.join(', ')}`)
  }
}

function requireSentinel(action: Action) {
  if (
    action === 'provision' &&
    process.env.PREPURCHASE_MAINNET_WALLET_PREPARE !==
      PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL
  ) {
    throw new Error(
      `REFUSED: PREPURCHASE_MAINNET_WALLET_PREPARE must equal ${PREPURCHASE_MAINNET_WALLET_PREPARATION_SENTINEL}`,
    )
  }
}

async function readState(): Promise<WalletState | undefined> {
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8')) as WalletState
    if (state.version !== 1 || state.network !== PREPURCHASE_MAINNET.network) {
      throw new Error('wallet state is for a different acceptance version or network')
    }
    return state
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function writeState(state: WalletState) {
  await mkdir(dirname(statePath), { recursive: true })
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function usdcBalanceAtomic(
  balances: Awaited<ReturnType<CdpClient['evm']['listTokenBalances']>>['balances'],
) {
  const balance = balances.find(
    (item) =>
      item.token.network === PREPURCHASE_MAINNET.cdpNetwork &&
      item.token.contractAddress.toLowerCase() === PREPURCHASE_MAINNET.asset.toLowerCase(),
  )
  return balance?.amount.amount ?? 0n
}

async function main() {
  const action = parseAction(process.argv.slice(2))
  requireCredentials()
  requireSentinel(action)

  const cdp = new CdpClient()
  const receiver =
    action === 'inspect'
      ? await cdp.evm.getAccount({ name: PREPURCHASE_MAINNET.receiverWalletAccountName })
      : await cdp.evm.getOrCreateAccount({ name: PREPURCHASE_MAINNET.receiverWalletAccountName })
  const buyer =
    action === 'inspect'
      ? await cdp.evm.getAccount({ name: PREPURCHASE_MAINNET.buyerWalletAccountName })
      : await cdp.evm.getOrCreateAccount({ name: PREPURCHASE_MAINNET.buyerWalletAccountName })

  const existing = await readState()
  if (
    existing &&
    (existing.receiver.address.toLowerCase() !== receiver.address.toLowerCase() ||
      existing.buyer.address.toLowerCase() !== buyer.address.toLowerCase())
  ) {
    throw new Error('CDP account addresses do not match the preserved acceptance state')
  }

  const state: WalletState = {
    version: 1,
    network: PREPURCHASE_MAINNET.network,
    receiver: { name: PREPURCHASE_MAINNET.receiverWalletAccountName, address: receiver.address },
    buyer: { name: PREPURCHASE_MAINNET.buyerWalletAccountName, address: buyer.address },
  }
  await writeState(state)

  const buyerBalances = await cdp.evm.listTokenBalances({
    address: buyer.address,
    network: PREPURCHASE_MAINNET.cdpNetwork,
  })
  const receiverBalances = await cdp.evm.listTokenBalances({
    address: receiver.address,
    network: PREPURCHASE_MAINNET.cdpNetwork,
  })
  const buyerUsdcAtomic = usdcBalanceAtomic(buyerBalances.balances)
  const receiverUsdcAtomic = usdcBalanceAtomic(receiverBalances.balances)
  const required = BigInt(PREPURCHASE_MAINNET.amountAtomic)

  console.log(
    JSON.stringify(
      {
        status: action === 'provision' ? 'provisioned' : 'ready',
        network: PREPURCHASE_MAINNET.network,
        receiver: state.receiver,
        buyer: state.buyer,
        buyer_usdc_atomic: buyerUsdcAtomic.toString(),
        receiver_usdc_atomic: receiverUsdcAtomic.toString(),
        required_atomic: PREPURCHASE_MAINNET.amountAtomic,
        buyer_funded: buyerUsdcAtomic >= required,
        funding_note:
          buyerUsdcAtomic >= required
            ? 'The buyer holds enough real USDC for exactly one acceptance order.'
            : `Send at least ${PREPURCHASE_MAINNET.amountAtomic} atomic units (0.50 USDC) of native Circle USDC on Base to the buyer address. No ETH is needed: the EIP-3009 signature is gasless for the buyer.`,
        private_keys_exported: false,
        funds_moved_by_this_script: false,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
