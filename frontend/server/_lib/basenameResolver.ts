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

import { createPublicClient, getAddress, http, isAddress, toCoinType } from 'viem'
import { base, mainnet } from 'viem/chains'
import { getEnsName } from './ensResolver.js'

declare const process: { env: Record<string, string | undefined> }

const CACHE_TTL_MS = 5 * 60_000
const DEFAULT_GATEWAY_URLS = ['https://ccip.ens.xyz']
const BASE_COIN_TYPE = toCoinType(base.id)

type CacheEntry = {
  expiresAt: number
  value: string | null
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<string | null>>()

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

  const inFlight = pending.get(normalized)
  if (inFlight) return await inFlight

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
    cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value: name })
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

async function getBasenameNameOnBase(address: string): Promise<string | null> {
  const normalized = normalizeEvmAddress(address)
  if (!normalized) return null
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl(), { timeout: 10_000 }),
    })
    const name = await client.getEnsName({ address: normalized })
    return name
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? '')
    // viem can throw before any RPC call if the chain config doesn't define ENS contracts.
    if (msg.includes('does not support contract "ensUniversalResolver"')) return null
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
