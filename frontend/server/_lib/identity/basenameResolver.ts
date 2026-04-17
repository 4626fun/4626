/**
 * Basename reverse resolution via the Base L2 Resolver contract.
 *
 * Used in two places:
 * - Waitlist referrals: needs the basename handle (e.g. "akita")
 * - Keepr /whois: needs the full basename (e.g. "akita.base.eth")
 *
 * Resolution calls the L2 Resolver contract directly on Base using the
 * ENSIP-19 reverse-node encoding (coinType 0x80002105).  This is the
 * only reliable path — viem's built-in `getEnsName` does not work on
 * Base (no Universal Resolver configured), and the ENSIP-19 mainnet
 * CCIP gateway is slow and rate-limit-prone for batch lookups.
 */

import { createPublicClient, encodePacked, getAddress, http, isAddress, keccak256, namehash } from 'viem'
import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

// ── Base L2 Resolver ─────────────────────────────────────────────────
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

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw || 'https://mainnet.base.org'
}

function normalizeEvmAddress(value: string): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase() as `0x${string}`
}

function addressToBaseReverseNode(addr: `0x${string}`): `0x${string}` {
  const addressNode = keccak256(encodePacked(['string'], [addr.replace('0x', '')]))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [BASE_REVERSE_NODE, addressNode]))
}

export function basenameToHandle(name: string | null | undefined): string | null {
  const raw = typeof name === 'string' ? name.trim() : ''
  if (!raw) return null
  if (!raw.toLowerCase().endsWith('.base.eth')) return null

  const withoutSuffix = raw.slice(0, -'.base.eth'.length).trim()
  return withoutSuffix.length > 0 ? withoutSuffix : null
}

/**
 * Resolve a wallet address to its full Basename (e.g. "akita.base.eth")
 * by calling the L2 Resolver on Base.
 *
 * Returns null when no Basename is configured or on lookup failure.
 */
export async function getBasenameName(address: string): Promise<string | null> {
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
    if (typeof name !== 'string' || !name) return null
    // Only treat *.base.eth as a Basename.
    if (!name.toLowerCase().endsWith('.base.eth')) return null
    return name
  } catch {
    return null
  }
}

/**
 * Resolve a "Basename handle" (e.g. "akita" from "akita.base.eth")
 * for a wallet address via the Base L2 Resolver.
 */
export async function resolveBasenameHandle(address: string): Promise<string | null> {
  return basenameToHandle(await getBasenameName(address))
}
