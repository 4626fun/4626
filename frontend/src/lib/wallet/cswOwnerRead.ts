import { getAddress, isAddress, type Address, type PublicClient } from 'viem'

import { CSW_OWNER_READ_ABI } from '@/lib/wallet/cswOwnerAbi'

export function hasDeployedBytecode(bytecode: string | null | undefined): boolean {
  return typeof bytecode === 'string' && bytecode !== '' && bytecode !== '0x'
}

export async function readCswBytecode(
  publicClient: Pick<PublicClient, 'getBytecode'>,
  address: Address,
): Promise<`0x${string}` | null> {
  try {
    const code = await publicClient.getBytecode({ address })
    return hasDeployedBytecode(code) ? (code as `0x${string}`) : null
  } catch {
    return null
  }
}

/**
 * Read `isOwnerAddress` only when the CSW has Base bytecode.
 * Returns `null` for counterfactual / not-yet-deployed addresses.
 */
export async function readIsOwnerAddressIfDeployed(params: {
  publicClient: Pick<PublicClient, 'readContract' | 'getBytecode'>
  cswAddress: Address
  ownerAddress: Address
}): Promise<boolean | null> {
  const bytecode = await readCswBytecode(params.publicClient, params.cswAddress)
  if (!bytecode) return null
  try {
    const isOwner = await params.publicClient.readContract({
      address: params.cswAddress,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'isOwnerAddress',
      args: [params.ownerAddress],
    })
    return Boolean(isOwner)
  } catch {
    return null
  }
}

export function normalizeOwnerReadAddress(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

/**
 * Server-side owner probe with RPC fallbacks — avoids false "not owner" reads from
 * wallet-injected or rate-limited browser RPC clients (DeployVault uses the same API).
 */
export async function fetchIsOwnerAddressViaApi(params: {
  cswAddress: Address
  ownerAddress: Address
}): Promise<boolean | null> {
  try {
    const res = await fetch('/api/deploy/smartWalletOwner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smartWallet: params.cswAddress,
        ownerAddress: params.ownerAddress,
      }),
    })
    const json = (await res.json()) as { success?: boolean; data?: { isOwner?: boolean } }
    if (json?.success === true && typeof json.data?.isOwner === 'boolean') {
      return json.data.isOwner
    }
    return null
  } catch {
    return null
  }
}

/** Prefer server owner probe; fall back to local bytecode-guarded read. */
export async function resolveEmbeddedOwnerOnCanonicalCsw(params: {
  publicClient: Pick<PublicClient, 'readContract' | 'getBytecode'>
  cswAddress: Address
  ownerAddress: Address
}): Promise<boolean | null> {
  const fromApi = await fetchIsOwnerAddressViaApi({
    cswAddress: params.cswAddress,
    ownerAddress: params.ownerAddress,
  })
  if (fromApi === true || fromApi === false) return fromApi
  return readIsOwnerAddressIfDeployed(params)
}
