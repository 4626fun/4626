import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_ZORA_TOKEN = getAddress('0x1111111111166b7fe7bd91427724b487980afc69')
const BASE_SWAP_ROUTER_CURRENT = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43')
const BASE_PERMIT2 = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3')
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

function parseAddressListFromEnv(keys: string[]): Address[] {
  const out: Address[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    const raw = String(process.env[key] ?? '').trim()
    if (!raw) continue
    for (const piece of raw.split(/[\s,]+/g)) {
      const normalized = normalizeAddress(piece)
      if (!normalized) continue
      const lc = normalized.toLowerCase()
      if (seen.has(lc)) continue
      seen.add(lc)
      out.push(normalized)
    }
  }
  return out
}

export type PayoutRouterFeeConfig = {
  zoraWethFee: number
  wethCreatorFee: number
}

export type PayoutRouterExternalSwapApprovals = {
  targets: Address[]
  spenders: Address[]
}

export function resolvePayoutRouterFeeConfig(): PayoutRouterFeeConfig {
  return {
    zoraWethFee: parseFeeEnv('PAYOUT_ROUTER_ZORA_WETH_FEE', DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE),
    wethCreatorFee: parseFeeEnv('PAYOUT_ROUTER_WETH_CREATOR_FEE', DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE),
  }
}

export function resolvePayoutRouterZoraToken(fallback?: Address | null): Address | null {
  const explicit =
    normalizeAddress(process.env.PAYOUT_ROUTER_ZORA_TOKEN) ??
    normalizeAddress(process.env.ZORA_TOKEN) ??
    normalizeAddress(process.env.VITE_ZORA)
  if (explicit) return explicit

  const fallbackNormalized = normalizeAddress(fallback)
  if (fallbackNormalized) return fallbackNormalized

  return DEFAULT_PAYOUT_ROUTER_ZORA_TOKEN
}

export function resolvePayoutRouterKeeperAddress(): Address | null {
  const explicit =
    normalizeAddress(process.env.PAYOUT_ROUTER_KEEPER) ??
    normalizeAddress(process.env.KPR_ADDRESS) ??
    normalizeAddress(process.env.CRE_KEEPER_ADDRESS) ??
    null
  if (explicit) return explicit

  const erc4337EnabledRaw =
    process.env.KPR_ERC4337_ENABLED ??
    process.env.CRE_ERC4337_ENABLED
  const erc4337Enabled = String(erc4337EnabledRaw ?? '').trim().toLowerCase() === 'true'
  if (erc4337Enabled) {
    const smartWallet = normalizeAddress(
      process.env.KPR_ERC4337_SMART_WALLET ??
      process.env.CRE_ERC4337_SMART_WALLET,
    )
    if (smartWallet) return smartWallet
  }

  return addressFromPrivateKey(process.env.KPR_PRIVATE_KEY)
}

export function resolvePayoutRouterExternalSwapApprovals(): PayoutRouterExternalSwapApprovals {
  const targets = parseAddressListFromEnv([
    'PAYOUT_ROUTER_EXTERNAL_SWAP_TARGETS',
    'PAYOUT_ROUTER_EXTERNAL_SWAP_TARGET',
    'PAYOUT_ROUTER_APPROVED_EXTERNAL_SWAP_TARGETS',
  ])
  const spenders = parseAddressListFromEnv([
    'PAYOUT_ROUTER_EXTERNAL_SWAP_SPENDERS',
    'PAYOUT_ROUTER_EXTERNAL_SWAP_SPENDER',
    'PAYOUT_ROUTER_APPROVED_EXTERNAL_SWAP_SPENDERS',
  ])

  const defaultTargets = [BASE_SWAP_ROUTER_CURRENT]
  const defaultSpenders = [BASE_PERMIT2, BASE_SWAP_ROUTER_CURRENT]

  return {
    targets: targets.length > 0 ? targets : defaultTargets,
    spenders: spenders.length > 0 ? spenders : defaultSpenders,
  }
}
