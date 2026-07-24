// Provision and fund the two dedicated CDP wallets used by the Base Sepolia
// acceptance test. This script never exports private keys and refuses every
// network other than Base Sepolia.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { CdpClient } from '@coinbase/cdp-sdk'

import { PREPURCHASE_TESTNET } from '../lib/prepurchase-testnet.ts'

const PROVISION_SENTINEL = 'I-AUTHORIZE-CDP-TESTNET-WALLET-PROVISIONING'
const FAUCET_SENTINEL = 'I-AUTHORIZE-CDP-BASE-SEPOLIA-FAUCET'
const statePath = resolve('.exchange/codex/prepurchase-testnet-wallets.json')

type Action = 'provision' | 'fund' | 'inspect'

type WalletState = {
  version: 1
  network: typeof PREPURCHASE_TESTNET.network
  receiver: { name: string; address: string }
  buyer: { name: string; address: string }
  faucet?: {
    token: 'usdc'
    transaction_hash: string
    requested_at: string
  }
}

function parseAction(argv: string[]): Action {
  if (argv.length !== 1) {
    throw new Error('choose exactly one action: --provision, --fund-buyer, or --inspect')
  }
  if (argv[0] === '--provision') return 'provision'
  if (argv[0] === '--fund-buyer') return 'fund'
  if (argv[0] === '--inspect') return 'inspect'
  throw new Error(`unknown action: ${argv[0]}`)
}

function requireCredentials() {
  const missing = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET'].filter(
    (name) => !process.env[name],
  )
  if (missing.length > 0) throw new Error(`missing private runtime credentials: ${missing.join(', ')}`)
}

function requireSentinel(action: Action) {
  if (
    action === 'provision' &&
    process.env.PREPURCHASE_TESTNET_WALLET_PREPARE !== PROVISION_SENTINEL
  ) {
    throw new Error(`REFUSED: PREPURCHASE_TESTNET_WALLET_PREPARE must equal ${PROVISION_SENTINEL}`)
  }
  if (action === 'fund' && process.env.PREPURCHASE_TESTNET_FAUCET !== FAUCET_SENTINEL) {
    throw new Error(`REFUSED: PREPURCHASE_TESTNET_FAUCET must equal ${FAUCET_SENTINEL}`)
  }
}

async function readState(): Promise<WalletState | undefined> {
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8')) as WalletState
    if (state.version !== 1 || state.network !== PREPURCHASE_TESTNET.network) {
      throw new Error('wallet state is for a different test version or network')
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
      item.token.network === 'base-sepolia' &&
      item.token.contractAddress.toLowerCase() === PREPURCHASE_TESTNET.asset.toLowerCase(),
  )
  return balance?.amount.amount ?? 0n
}

async function main() {
  const action = parseAction(process.argv.slice(2))
  requireCredentials()
  requireSentinel(action)

  const cdp = new CdpClient()
  let receiver
  let buyer

  if (action === 'inspect') {
    receiver = await cdp.evm.getAccount({ name: PREPURCHASE_TESTNET.receiverWalletAccountName })
    buyer = await cdp.evm.getAccount({ name: PREPURCHASE_TESTNET.buyerWalletAccountName })
  } else {
    receiver = await cdp.evm.getOrCreateAccount({
      name: PREPURCHASE_TESTNET.receiverWalletAccountName,
    })
    buyer = await cdp.evm.getOrCreateAccount({
      name: PREPURCHASE_TESTNET.buyerWalletAccountName,
    })
  }

  const existing = await readState()
  let state: WalletState = {
    version: 1,
    network: PREPURCHASE_TESTNET.network,
    receiver: {
      name: PREPURCHASE_TESTNET.receiverWalletAccountName,
      address: receiver.address,
    },
    buyer: {
      name: PREPURCHASE_TESTNET.buyerWalletAccountName,
      address: buyer.address,
    },
    ...(existing?.faucet ? { faucet: existing.faucet } : {}),
  }

  if (existing) {
    if (
      existing.receiver.address.toLowerCase() !== receiver.address.toLowerCase() ||
      existing.buyer.address.toLowerCase() !== buyer.address.toLowerCase()
    ) {
      throw new Error('CDP account addresses do not match the preserved test state')
    }
  }

  let balances = await cdp.evm.listTokenBalances({
    address: buyer.address,
    network: 'base-sepolia',
  })
  let buyerUsdcAtomic = usdcBalanceAtomic(balances.balances)
  const receiverBalances = await cdp.evm.listTokenBalances({
    address: receiver.address,
    network: 'base-sepolia',
  })
  const receiverUsdcAtomic = usdcBalanceAtomic(receiverBalances.balances)

  if (action === 'fund' && buyerUsdcAtomic < BigInt(PREPURCHASE_TESTNET.amountAtomic)) {
    if (existing?.faucet) {
      throw new Error(
        'REFUSED: the recorded faucet request exists but the buyer has less than 1 test USDC',
      )
    }
    const faucet = await cdp.evm.requestFaucet({
      address: buyer.address,
      network: 'base-sepolia',
      token: 'usdc',
      idempotencyKey: 'aghub-prepurchase-base-sepolia-usdc-v1',
    })
    state = {
      ...state,
      faucet: {
        token: 'usdc',
        transaction_hash: faucet.transactionHash,
        requested_at: new Date().toISOString(),
      },
    }
    await writeState(state)

    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 5_000))
      balances = await cdp.evm.listTokenBalances({
        address: buyer.address,
        network: 'base-sepolia',
      })
      buyerUsdcAtomic = usdcBalanceAtomic(balances.balances)
      if (buyerUsdcAtomic >= BigInt(PREPURCHASE_TESTNET.amountAtomic)) break
    }
    if (buyerUsdcAtomic < BigInt(PREPURCHASE_TESTNET.amountAtomic)) {
      throw new Error('faucet transaction was requested but 1 test USDC is not visible yet')
    }
  }

  await writeState(state)
  console.log(
    JSON.stringify(
      {
        status: action === 'fund' ? 'funded' : action === 'provision' ? 'provisioned' : 'ready',
        network: PREPURCHASE_TESTNET.network,
        receiver: state.receiver,
        buyer: state.buyer,
        buyer_usdc_atomic: buyerUsdcAtomic.toString(),
        receiver_usdc_atomic: receiverUsdcAtomic.toString(),
        faucet_transaction: state.faucet?.transaction_hash ?? null,
        private_keys_exported: false,
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
