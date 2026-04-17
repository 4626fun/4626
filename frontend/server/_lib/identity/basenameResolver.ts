/**
 * Basename reverse resolution (Base / ENSIP-19).
 *
 * Used in two places:
 * - Waitlist referrals: needs the basename handle (e.g. "akita")
 * - Keepr /whois: needs the full basename (e.g. "akita.base.eth")
 *
 * Implementation notes:
 * - Prefer ENSIP-19 reverse resolution on Ethereum mainnet via Base coinType
 *   and CCIP gateway URLs.
 * - Try Base L2 reverse resolution first as a best-effort fast path.
 */

import { createPublicClient, encodePacked, getAddress, http, isAddress, keccak256, namehash, toCoinType } from 'viem'
import { base, mainnet } from 'viem/chains'
import { getEnsName } from './ensResolver.js'

declare const process: { env: Record<string, string | undefined> }

const CACHE_TTL_MS = 5 * 60_000
const MAX_CACHE_ENTRIES = 2_000
const MAX_PENDING_ENTRIES = 500
const DEFAULT_GATEWAY_URLS = ['https://ccip.ens.xyz']
const BASE_COIN_TYPE = toCoinType(base.id)

type CacheEntry = {
  expiresAt: number
  value: string | null
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<string | null>>()

function evictExpiredOrOldest(now = Date.now()): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
}

function getEthRpcUrl(): string {
  // Prefer explicit env var, fall back to public endpoint.
  return (
    (process.env.ETH_RPC_URL ?? '').trim() ||
    (process.env.ETHEREUM_RPC_URL ?? '').trim() ||
    'https://eth.llamarpc.com'
  )
}

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw || 'https://mainnet.base.org'
}

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(getEthRpcUrl(), { timeout: 10_000 }),
})

function normalizeEvmAddress(value: string): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase() as `0x${string}`
}

/**
 * Resolve a wallet address to its Basename (e.g. "akita.base.eth") using
 * ENSIP-19 reverse resolution on Ethereum mainnet.
 *
 * Returns null when no Basename is configured or on lookup failure.
 */
export async function getBasenameName(address: string): Promise<string | null> {
  const normalized = normalizeEvmAddress(address)
  if (!normalized) return null

  const cached = cache.get(normalized)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (cached && cached.expiresAt <= Date.now()) cache.delete(normalized)

  const inFlight = pending.get(normalized)
  if (inFlight) return await inFlight
  if (pending.size >= MAX_PENDING_ENTRIES) {
    return null
  }

  const promise = (async (): Promise<string | null> => {
    const name = await mainnetClient
      .getEnsName({
        address: normalized,
        coinType: BASE_COIN_TYPE,
        gatewayUrls: DEFAULT_GATEWAY_URLS,
      })
      .catch(() => null)

    if (!name) return null
    // Guardrail: ENSIP-19 can resolve non-Basenames depending on user config.
    // For this skill, only treat *.base.eth as a Basename.
    if (!name.toLowerCase().endsWith('.base.eth')) return null

    return name
  })()

  pending.set(normalized, promise)
  try {
    const name = await promise
    evictExpiredOrOldest()
    if (cache.has(normalized)) cache.delete(normalized)
    cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value: name })
    evictExpiredOrOldest()
    return name
  } finally {
    pending.delete(normalized)
  }
}

export function basenameToHandle(name: string | null | undefined): string | null {
  const raw = typeof name === 'string' ? name.trim() : ''
  if (!raw) return null
  if (!raw.toLowerCase().endsWith('.base.eth')) return null

  const withoutSuffix = raw.slice(0, -'.base.eth'.length).trim()
  return withoutSuffix.length > 0 ? withoutSuffix : null
}

// ── Base L2 Resolver (direct contract call) ──────────────────────────
// viem's `getEnsName` does not work on Base because the chain config
// lacks an ENS Universal Resolver.  Instead we call the L2 Resolver
// contract directly using the ENSIP-19 reverse-node encoding for
// Base (coinType 0x80002105).
const BASENAME_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as const
const BASE_CHAIN_COIN_TYPE_HEX = ((0x80000000 | base.id) >>> 0).toString(16).toUpperCase()
const BASE_REVERSE_NODE = namehash(`${BASE_CHAIN_COIN_TYPE_HEX}.reverse`)

const L2_RESOLVER_NAME_ABI = [
  {
    inputs: [{ name: 'node', type: 'bytes32' as const }],
    name: 'name' as const,
    outputs: [{ name: '', type: 'string' as const }],
    stateMutability: 'view' as const,
    type: 'function' as const,
  },
] as const

function addressToBaseReverseNode(addr: `0x${string}`): `0x${string}` {
  const addressNode = keccak256(encodePacked(['string'], [addr.replace('0x', '')]))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [BASE_REVERSE_NODE, addressNode]))
}

async function getBasenameNameOnBase(address: string): Promise<string | null> {
  const normalized = normalizeEvmAddress(address)
  if (!normalized) return null
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl(), { timeout: 10_000 }),
    })
    const node = addressToBaseReverseNode(normalized)
    const name = await client.readContract({
      address: BASENAME_L2_RESOLVER,
      abi: L2_RESOLVER_NAME_ABI,
      functionName: 'name',
      args: [node],
    })
    return typeof name === 'string' && name.length > 0 ? name : null
  } catch {
    return null
  }
}

/**
 * Resolve a "Basename handle" (e.g. "akita" from "akita.base.eth") for a wallet address.
 *
 * Best-effort:
 * - try Base L2 ENS reverse resolution
 * - fall back to ENSIP-19 reverse resolution on mainnet
 * - fall back to plain mainnet ENS reverse resolution when it returns a `.base.eth` name
 */
export async function resolveBasenameHandle(address: string): Promise<string | null> {
  const baseName = basenameToHandle(await getBasenameNameOnBase(address))
  if (baseName) return baseName

  const ensip19Name = basenameToHandle(await getBasenameName(address))
  if (ensip19Name) return ensip19Name

  const ensName = await getEnsName(address)
  const ensBasename = basenameToHandle(ensName)
  return ensBasename
}
