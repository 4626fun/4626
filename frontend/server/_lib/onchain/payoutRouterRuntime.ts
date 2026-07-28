import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  CANONICAL_KEEPER_AUTOMATION_EOA,
  KPR_PRIVATE_KEY_ENV,
  PAYOUT_ROUTER_KEEPER_ENV,
  PROTOCOL_AJNA_KEEPER_ENV,
} from '../wallet/keeperAutomationPolicy.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_WETH_SHARE_FEE = 10_000
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

// Accepts both 0x-prefixed and bare 64-hex private keys (KPR_PRIVATE_KEY is
// historically stored without the prefix in this workspace).
function normalizePrivateKey(rawKey: string | undefined): Hex | null {
  const trimmed = String(rawKey ?? '').trim()
  const key = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? `0x${trimmed.slice(2)}` : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null
  return key as Hex
}

function addressFromPrivateKey(rawKey: string | undefined): Address | null {
  const key = normalizePrivateKey(rawKey)
  if (!key) return null
  try {
    return getAddress(privateKeyToAccount(key).address)
  } catch {
    return null
  }
}

const PAYOUT_ROUTER_KEEPER_PRIVATE_KEY_ENVS = [
  KPR_PRIVATE_KEY_ENV,
  'KEEPER_AUTOMATION_PRIVATE_KEY',
  '4626_KEEPER_AUTOMATION_PRIVATE_KEY',
  'PROTOCOL_TREASURY_SAFE_OWNER_PK',
  'PRIVATE_KEY',
] as const

export { CANONICAL_KEEPER_AUTOMATION_EOA }

export function resolvePayoutRouterKeeperPrivateKey(
  env: Record<string, string | undefined> = process.env,
): `0x${string}` | null {
  const expectedKeeper = resolvePayoutRouterKeeperAddress()
  for (const key of PAYOUT_ROUTER_KEEPER_PRIVATE_KEY_ENVS) {
    const normalized = normalizePrivateKey(env[key])
    if (!normalized) continue
    const derived = addressFromPrivateKey(normalized)
    if (!expectedKeeper) return normalized
    if (derived && derived.toLowerCase() === expectedKeeper.toLowerCase()) {
      return normalized
    }
  }
  return null
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
  wethShareFee: number
}

export function resolvePayoutRouterFeeConfig(): PayoutRouterFeeConfig {
  const wethShareFee = parseFeeEnv('PAYOUT_ROUTER_WETH_SHARE_FEE', DEFAULT_PAYOUT_ROUTER_WETH_SHARE_FEE)
  return {
    zoraWethFee: parseFeeEnv('PAYOUT_ROUTER_ZORA_WETH_FEE', DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE),
    wethShareFee,
  }
}

export type PayoutRouterExternalSwapApprovals = {
  targets: Address[]
  spenders: Address[]
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
    normalizeAddress(process.env[PAYOUT_ROUTER_KEEPER_ENV]) ??
    normalizeAddress(process.env.KPR_KEEPER_ADDRESS) ??
    normalizeAddress(process.env.KPR_ADDRESS) ??
    normalizeAddress(process.env[PROTOCOL_AJNA_KEEPER_ENV]) ??
    null
  if (explicit) return explicit

  const erc4337EnabledRaw = process.env.KPR_ERC4337_ENABLED
  const erc4337Enabled = String(erc4337EnabledRaw ?? '').trim().toLowerCase() === 'true'
  if (erc4337Enabled) {
    const smartWallet = normalizeAddress(
      process.env.KPR_ERC4337_SMART_WALLET,
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

  // ODA-520-H2: the canonical Uniswap `swapRouter` is blocked on-chain as an
  // external target/spender. Default to Permit2-only; set aggregator addresses
  // via env when an external venue is intentionally enabled.
  const defaultTargets: Address[] = []
  const defaultSpenders = [BASE_PERMIT2]

  const filterBlocked = (addrs: Address[]) =>
    addrs.filter((addr) => addr.toLowerCase() !== BASE_SWAP_ROUTER_CURRENT.toLowerCase())

  return {
    targets: filterBlocked(targets.length > 0 ? targets : defaultTargets),
    spenders: filterBlocked(spenders.length > 0 ? spenders : defaultSpenders),
  }
}

const DEFAULT_KEEPER_SPEND_WINDOW_SECONDS = 86_400
const DEFAULT_KEEPER_SPEND_CAP_WETH = 50n * 10n ** 18n
const DEFAULT_KEEPER_SPEND_CAP_USDC = 250_000n * 10n ** 6n
const DEFAULT_KEEPER_SPEND_CAP_ZORA = 10_000_000n * 10n ** 18n
const DEFAULT_KEEPER_SPEND_CAP_CREATOR = 1_000_000n * 10n ** 18n
const DEFAULT_KEEPER_SPEND_CAP_FALLBACK = 1_000_000n * 10n ** 18n

function parseUintEnv(key: string, fallback: bigint, env: Record<string, string | undefined>): bigint {
  const raw = String(env[key] ?? '').trim()
  if (!raw) return fallback
  try {
    const value = BigInt(raw)
    return value > 0n ? value : fallback
  } catch {
    return fallback
  }
}

function parseWindowSecondsEnv(env: Record<string, string | undefined>): number {
  const raw = String(env.PAYOUT_ROUTER_KEEPER_SPEND_WINDOW_SECONDS ?? '').trim()
  if (!raw) return DEFAULT_KEEPER_SPEND_WINDOW_SECONDS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_KEEPER_SPEND_WINDOW_SECONDS
  const value = Math.floor(parsed)
  if (value <= 0 || value > 30 * 86_400) return DEFAULT_KEEPER_SPEND_WINDOW_SECONDS
  return value
}

export type PayoutRouterKeeperSpendCap = {
  tokenIn: Address
  cap: bigint
  windowSeconds: number
  label: string
}

/**
 * ODA-520-H1: keeper conversions (V3 + direct deposit) fail closed when no cap is set.
 * Resolve per-token daily caps for creator coin + configured harvest path tokens so
 * treasury/deploy setup can call `setKeeperExternalSpendCap` before `setKeeper`.
 */
export function resolvePayoutRouterKeeperSpendCaps(params: {
  creatorToken: Address
  pathTokens?: Array<{ tokenIn: Address; label?: string }>
  weth?: Address | null
  usdc?: Address | null
  zora?: Address | null
  env?: Record<string, string | undefined>
}): PayoutRouterKeeperSpendCap[] {
  const env = params.env ?? process.env
  const windowSeconds = parseWindowSecondsEnv(env)
  const creatorToken = getAddress(params.creatorToken)
  const weth = normalizeAddress(params.weth)
  const usdc = normalizeAddress(params.usdc)
  const zora = normalizeAddress(params.zora)

  const out: PayoutRouterKeeperSpendCap[] = []
  const seen = new Set<string>()
  const add = (tokenIn: Address, label: string, cap: bigint) => {
    const key = tokenIn.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ tokenIn, cap, windowSeconds, label })
  }

  add(creatorToken, 'CREATOR', parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_CREATOR', DEFAULT_KEEPER_SPEND_CAP_CREATOR, env))

  for (const entry of params.pathTokens ?? []) {
    const tokenIn = getAddress(entry.tokenIn)
    const label = String(entry.label ?? 'PATH').toUpperCase()
    let cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_DEFAULT', DEFAULT_KEEPER_SPEND_CAP_FALLBACK, env)
    if (weth && tokenIn.toLowerCase() === weth.toLowerCase()) {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_WETH', DEFAULT_KEEPER_SPEND_CAP_WETH, env)
    } else if (usdc && tokenIn.toLowerCase() === usdc.toLowerCase()) {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_USDC', DEFAULT_KEEPER_SPEND_CAP_USDC, env)
    } else if (zora && tokenIn.toLowerCase() === zora.toLowerCase()) {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_ZORA', DEFAULT_KEEPER_SPEND_CAP_ZORA, env)
    } else if (label === 'WETH') {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_WETH', DEFAULT_KEEPER_SPEND_CAP_WETH, env)
    } else if (label === 'USDC') {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_USDC', DEFAULT_KEEPER_SPEND_CAP_USDC, env)
    } else if (label === 'ZORA') {
      cap = parseUintEnv('PAYOUT_ROUTER_KEEPER_SPEND_CAP_ZORA', DEFAULT_KEEPER_SPEND_CAP_ZORA, env)
    }
    add(tokenIn, label, cap)
  }

  return out
}
