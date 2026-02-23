/**
 * Basename reverse resolution (Base / ENSIP-19).
 *
 * This is intentionally server-side (Node) so group-chat commands can resolve
 * identity without relying on the client-only Basename helpers.
 */

import { createPublicClient, http, toCoinType } from 'viem'
import { getAddress, isAddress } from 'viem'
import { base, mainnet } from 'viem/chains'

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

const client = createPublicClient({
  chain: mainnet,
  transport: http(getEthRpcUrl(), { timeout: 10_000 }),
})

function normalizeEvmAddress(value: string): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase() as `0x${string}`
}

/**
 * Resolve a wallet address to its Basename (e.g. "akita.base.eth").
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
    const name = await client
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

