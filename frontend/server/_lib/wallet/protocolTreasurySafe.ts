import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { getApiContracts } from '../onchain/contracts.js'

declare const process: { env: Record<string, string | undefined> }

const GNOSIS_SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const

const CHARM_VAULT_AUTH_ABI = [
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'rebalanceDelegate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
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

export type CharmAutomationAuthorization =
  | { authorized: true; lane: 'protocol_treasury_manager' }
  | { authorized: true; lane: 'keeper_direct' }
  | { authorized: false; reason: string }

/** Gate Charm enqueue/execute: protocol treasury manager lane, or legacy keeper/direct paths. */
export function resolveCharmAutomationAuthorization(params: {
  managerAddress: string | null | undefined
  delegateAddress: string | null | undefined
  charmKeeper: string | null | undefined
  charmOwner: string | null | undefined
  keeperAddress: string
}): CharmAutomationAuthorization {
  if (isProtocolTreasuryManager(params.managerAddress)) {
    return { authorized: true, lane: 'protocol_treasury_manager' }
  }

  if (params.delegateAddress && isSameAddress(params.delegateAddress, params.keeperAddress)) {
    return { authorized: true, lane: 'keeper_direct' }
  }

  if (params.charmKeeper && !isSameAddress(params.charmKeeper, params.keeperAddress)) {
    return { authorized: false, reason: 'keeper_not_charm_vault_keeper' }
  }

  if (
    !params.charmKeeper &&
    params.charmOwner &&
    !isSameAddress(params.charmOwner, params.keeperAddress)
  ) {
    return { authorized: false, reason: 'keeper_not_charm_vault_owner' }
  }

  if (!params.charmKeeper && !params.charmOwner && !params.delegateAddress) {
    return { authorized: false, reason: 'charm_automation_not_configured' }
  }

  return { authorized: true, lane: 'keeper_direct' }
}

export type CharmVaultAuthSnapshot = {
  managerAddress: Address | null
  delegateAddress: Address | null
  charmKeeper: Address | null
  charmOwner: Address | null
}

function asAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value)
}

type CharmAuthReader = {
  readContract: (args: {
    address: Address
    abi: typeof CHARM_VAULT_AUTH_ABI
    functionName: 'manager' | 'rebalanceDelegate' | 'keeper' | 'owner'
  }) => Promise<unknown>
}

async function readAuthField(
  publicClient: CharmAuthReader,
  charmVaultAddress: Address,
  functionName: 'manager' | 'rebalanceDelegate' | 'keeper' | 'owner',
): Promise<unknown> {
  try {
    return await publicClient.readContract({
      address: charmVaultAddress,
      abi: CHARM_VAULT_AUTH_ABI,
      functionName,
    })
  } catch {
    return null
  }
}

/** Reads on-chain Charm auth slots; skips keeper/owner when manager is protocol treasury. */
export async function readCharmVaultAuthSnapshot(params: {
  publicClient: CharmAuthReader
  charmVaultAddress: Address
}): Promise<CharmVaultAuthSnapshot> {
  const [managerRaw, delegateRaw] = await Promise.all([
    readAuthField(params.publicClient, params.charmVaultAddress, 'manager'),
    readAuthField(params.publicClient, params.charmVaultAddress, 'rebalanceDelegate'),
  ])
  const managerAddress = asAddress(managerRaw)
  const delegateAddress = asAddress(delegateRaw)

  if (isProtocolTreasuryManager(managerAddress)) {
    return { managerAddress, delegateAddress, charmKeeper: null, charmOwner: null }
  }

  const [charmKeeperRaw, charmOwnerRaw] = await Promise.all([
    readAuthField(params.publicClient, params.charmVaultAddress, 'keeper'),
    readAuthField(params.publicClient, params.charmVaultAddress, 'owner'),
  ])

  return {
    managerAddress,
    delegateAddress,
    charmKeeper: asAddress(charmKeeperRaw),
    charmOwner: asAddress(charmOwnerRaw),
  }
}

export function resolveCharmKeeperAuthorization(params: {
  snapshot: CharmVaultAuthSnapshot
  keeperAddress: Address
}): CharmAutomationAuthorization {
  return resolveCharmAutomationAuthorization({
    ...params.snapshot,
    keeperAddress: params.keeperAddress,
  })
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
