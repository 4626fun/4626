import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE = 10_000
const MAX_UNISWAP_V3_FEE = 1_000_000

function parseFeeEnv(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  const value = Math.floor(parsed)
  if (value <= 0 || value > MAX_UNISWAP_V3_FEE) return fallback
  return value
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || !isAddress(raw)) return null
  try {
    return getAddress(raw)
  } catch {
    return null
  }
}

function addressFromPrivateKey(rawKey: string | undefined): Address | null {
  const key = String(rawKey ?? '').trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null
  try {
    return getAddress(privateKeyToAccount(key as Hex).address)
  } catch {
    return null
  }
}

export type PayoutRouterFeeConfig = {
  zoraWethFee: number
  wethCreatorFee: number
}

export function resolvePayoutRouterFeeConfig(): PayoutRouterFeeConfig {
  return {
    zoraWethFee: parseFeeEnv('PAYOUT_ROUTER_ZORA_WETH_FEE', DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE),
    wethCreatorFee: parseFeeEnv('PAYOUT_ROUTER_WETH_CREATOR_FEE', DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE),
  }
}

export function resolvePayoutRouterKeeperAddress(): Address | null {
  const explicit =
    normalizeAddress(process.env.PAYOUT_ROUTER_KEEPER) ??
    normalizeAddress(process.env.CRE_KEEPER_ADDRESS) ??
    normalizeAddress(process.env.KEEPR_ADDRESS)
  if (explicit) return explicit

  const erc4337Enabled = String(process.env.CRE_ERC4337_ENABLED ?? '').trim().toLowerCase() === 'true'
  if (erc4337Enabled) {
    const smartWallet = normalizeAddress(process.env.CRE_ERC4337_SMART_WALLET)
    if (smartWallet) return smartWallet
  }

  return addressFromPrivateKey(process.env.KEEPR_PRIVATE_KEY)
}
