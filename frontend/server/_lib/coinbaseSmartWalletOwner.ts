import { encodeFunctionData, getAddress, type Address, type Hex, type PublicClient } from 'viem'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export const COINBASE_SMART_WALLET_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'addOwnerAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isOwnerAddress',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function normalizeAddress(value: string, fieldName: string): Address {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!ADDRESS_RE.test(raw)) {
    throw new Error(`Invalid ${fieldName} address`)
  }
  return getAddress(raw) as Address
}

export async function isOwner(
  publicClient: Pick<PublicClient, 'readContract'>,
  cswAddress: string,
  ownerAddress: string,
): Promise<boolean> {
  const csw = normalizeAddress(cswAddress, 'csw')
  const owner = normalizeAddress(ownerAddress, 'owner')
  const result = await publicClient.readContract({
    address: csw,
    abi: COINBASE_SMART_WALLET_ABI,
    functionName: 'isOwnerAddress',
    args: [owner],
  })
  return result === true
}

export function prepareAddOwnerTx(cswAddress: string, ownerToAdd: string): {
  chainId: 8453
  to: Address
  data: Hex
  value: '0x0'
} {
  const csw = normalizeAddress(cswAddress, 'csw')
  const owner = normalizeAddress(ownerToAdd, 'owner')
  const data = encodeFunctionData({
    abi: COINBASE_SMART_WALLET_ABI,
    functionName: 'addOwnerAddress',
    args: [owner],
  })
  return {
    chainId: 8453,
    to: csw,
    data,
    value: '0x0',
  }
}
