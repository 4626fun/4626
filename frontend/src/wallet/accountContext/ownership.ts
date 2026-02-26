import { getAddress, isAddress } from 'viem'

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export type OwnershipCheckResult = {
  value: boolean | null
  reason: 'ok' | 'network_mismatch' | 'missing_params' | 'read_failed'
}

export async function checkEoaOwnershipOfCsw(params: {
  publicClient: any
  chainId: number | null
  expectedChainId?: number
  cswAddress?: string | null
  ownerAddress?: string | null
}): Promise<OwnershipCheckResult> {
  const expectedChainId = params.expectedChainId ?? 8453
  if (!params.publicClient || !params.cswAddress || !params.ownerAddress) {
    return { value: null, reason: 'missing_params' }
  }
  if (typeof params.chainId !== 'number' || params.chainId !== expectedChainId) {
    return { value: null, reason: 'network_mismatch' }
  }
  if (!isAddress(params.cswAddress) || !isAddress(params.ownerAddress)) {
    return { value: null, reason: 'missing_params' }
  }

  try {
    const csw = getAddress(params.cswAddress) as `0x${string}`
    const owner = getAddress(params.ownerAddress) as `0x${string}`
    const isOwner = (await params.publicClient.readContract({
      address: csw,
      abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
      functionName: 'isOwnerAddress',
      args: [owner],
    })) as boolean
    return { value: isOwner === true, reason: 'ok' }
  } catch {
    return { value: null, reason: 'read_failed' }
  }
}

