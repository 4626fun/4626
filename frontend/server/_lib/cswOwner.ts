/**
 * Check if an address is an owner of a Coinbase Smart Wallet (CSW).
 * Used for owner-based auth: signing in with a different wallet that owns the profile's CSW.
 */

import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
] as const

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

export async function isCswOwner(ownerAddress: string, cswAddress: string): Promise<boolean> {
  if (!isValidEvmAddress(ownerAddress) || !isValidEvmAddress(cswAddress)) return false
  const rpcs = getBaseRpcUrls()
  let lastError: unknown = null
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })
      const ok = await client.readContract({
        address: cswAddress as `0x${string}`,
        abi: COINBASE_SMART_WALLET_OWNER_ABI,
        functionName: 'isOwnerAddress',
        args: [ownerAddress as `0x${string}`],
      })
      return Boolean(ok)
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) throw lastError
  return false
}
