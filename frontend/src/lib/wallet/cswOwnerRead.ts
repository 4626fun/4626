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
