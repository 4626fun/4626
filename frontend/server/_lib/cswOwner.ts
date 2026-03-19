/**
 * Check if an address is an owner of a Coinbase Smart Wallet (CSW).
 * Used for owner-based auth: signing in with a different wallet that owns the profile's CSW.
 */

import { createPublicClient, encodeAbiParameters, getAddress, http } from 'viem'
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

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
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

async function readCswOwnerScanLimit(
  client: ReturnType<typeof createPublicClient>,
  cswAddress: `0x${string}`,
): Promise<number> {
  const countRaw = (await client.readContract({
    address: cswAddress,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  let upperBound = Number(countRaw)
  if (!Number.isFinite(upperBound) || upperBound < 0) upperBound = 0
  try {
    const nextRaw = (await client.readContract({
      address: cswAddress,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // Some CSW versions may not expose `nextOwnerIndex`; ownerCount is enough.
  }
  return Math.min(Math.max(upperBound, 1), 128)
}

async function ownerAppearsInCswOwnerList(params: {
  client: ReturnType<typeof createPublicClient>
  cswAddress: `0x${string}`
  ownerAddress: `0x${string}`
  scanLimit: number
}): Promise<boolean> {
  const { client, cswAddress, ownerAddress, scanLimit } = params
  const expected = String(encodeAbiParameters([{ type: 'address' }], [ownerAddress])).toLowerCase()
  for (let i = 0; i < scanLimit; i += 1) {
    const ownerBytes = (await client.readContract({
      address: cswAddress,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as string
    if (String(ownerBytes).toLowerCase() === expected) return true
  }
  return false
}

export async function isCswOwner(ownerAddress: string, cswAddress: string): Promise<boolean> {
  if (!isValidEvmAddress(ownerAddress) || !isValidEvmAddress(cswAddress)) return false
  const rpcs = getBaseRpcUrls()
  const normalizedOwner = getAddress(ownerAddress as `0x${string}`)
  const normalizedCsw = getAddress(cswAddress as `0x${string}`)
  let lastError: unknown = null
  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      // Reject EOAs and non-contract targets up front.
      const code = await client.getBytecode({ address: normalizedCsw })
      if (!code || code === '0x') {
        lastError = new Error('csw_target_not_contract')
        continue
      }

      try {
        const scanLimit = await readCswOwnerScanLimit(client, normalizedCsw)
        const listed = await ownerAppearsInCswOwnerList({
          client,
          cswAddress: normalizedCsw,
          ownerAddress: normalizedOwner,
          scanLimit,
        })
        if (!listed) return false

        const isOwnerAddressResult = await client.readContract({
          address: normalizedCsw,
          abi: COINBASE_SMART_WALLET_OWNER_ABI,
          functionName: 'isOwnerAddress',
          args: [normalizedOwner],
        })
        return isOwnerAddressResult === true
      } catch {
        // Contract does not match expected CSW owner-management surface.
        return false
      }
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) throw lastError
  return false
}
