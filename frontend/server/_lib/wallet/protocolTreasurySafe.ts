import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { getAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { getApiContracts } from '../onchain/contracts.js'

declare const process: { env: Record<string, string | undefined> }

/** Documented owners on the 1-of-2 protocol treasury Safe (reference only). */
export const PROTOCOL_TREASURY_SAFE_OWNER_ADDRESSES = [
  '0xab6d5c10b03300326cd7fab7267ae192842967b5',
  '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
] as const

const GNOSIS_SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const

export function resolveProtocolTreasuryAddress(): Address {
  return getAddress(getApiContracts().protocolTreasury)
}

export function resolveProtocolTreasurySafeOwnerPrivateKey(
  env: Record<string, string | undefined> = process.env,
): `0x${string}` | null {
  for (const key of ['PROTOCOL_TREASURY_SAFE_OWNER_PK', 'KPR_PRIVATE_KEY', 'PRIVATE_KEY']) {
    const raw = (env[key] ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(raw)) return raw as `0x${string}`
  }
  return null
}

export function isSameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase()
  } catch {
    return false
  }
}

export function isProtocolTreasuryManager(managerAddress: string | null | undefined): boolean {
  if (!managerAddress) return false
  return isSameAddress(managerAddress, resolveProtocolTreasuryAddress())
}

async function assertProtocolTreasurySafeOwner(params: {
  publicClient: { readContract: (args: unknown) => Promise<unknown> }
  safeAddress: Address
  ownerAddress: Address
}): Promise<void> {
  const ownersRaw = await params.publicClient.readContract({
    address: params.safeAddress,
    abi: GNOSIS_SAFE_ABI,
    functionName: 'getOwners',
  })
  const owners = Array.isArray(ownersRaw)
    ? ownersRaw.map((owner) => getAddress(String(owner)).toLowerCase())
    : []
  if (!owners.includes(params.ownerAddress.toLowerCase())) {
    throw new Error(`protocol_treasury_safe_signer_not_owner:${params.ownerAddress}`)
  }
}

export async function executeViaProtocolTreasurySafe(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: `0x${string}`; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  to: Address
  data: Hex
  value?: bigint
  env?: Record<string, string | undefined>
}): Promise<{ txHash: `0x${string}`; safeAddress: Address; signerAddress: Address }> {
  const env = params.env ?? process.env
  const privateKey = resolveProtocolTreasurySafeOwnerPrivateKey(env)
  if (!privateKey) {
    throw new Error('protocol_treasury_safe_owner_key_missing')
  }

  const safeAddress = resolveProtocolTreasuryAddress()
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address)

  await assertProtocolTreasurySafeOwner({
    publicClient: params.publicClient,
    safeAddress,
    ownerAddress: signerAddress,
  })

  const protocolKit = await Safe.init({
    provider: params.rpcUrl,
    signer: privateKey,
    safeAddress,
  })

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [
      {
        to: params.to,
        value: String(params.value ?? 0n),
        data: params.data,
        operation: OperationType.Call,
      },
    ],
  })

  const executeResponse = await protocolKit.executeTransaction(safeTransaction)
  const txHash = (executeResponse.hash ?? (executeResponse as { transactionResponse?: { hash?: `0x${string}` } }).transactionResponse?.hash) as
    | `0x${string}`
    | undefined
  if (!txHash) {
    throw new Error('protocol_treasury_safe_tx_hash_missing')
  }

  const receipt = await params.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new Error('protocol_treasury_safe_tx_reverted')
  }

  return { txHash, safeAddress, signerAddress }
}
