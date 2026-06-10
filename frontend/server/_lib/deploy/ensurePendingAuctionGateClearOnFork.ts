import { encodeAbiParameters, encodePacked, getAddress, keccak256, type Address, type Hex } from 'viem'

/** `DeploymentBatcher.hasActivePendingAuction` mapping slot (forge storage-layout). */
export const DEPLOYMENT_BATCHER_HAS_ACTIVE_PENDING_AUCTION_MAPPING_SLOT = 5n

export const AUCTION_ALREADY_PENDING_FOR_TOKEN_SELECTOR = '0x671ad774'

const BATCHER_PENDING_AUCTION_ABI = [
  {
    type: 'function',
    name: 'hasActivePendingAuction',
    stateMutability: 'view',
    inputs: [{ name: 'tokenOwnerKey', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
] as const

type ReadContractClient = {
  readContract: (args: {
    address: Address
    abi: typeof BATCHER_PENDING_AUCTION_ABI
    functionName: 'hasActivePendingAuction'
    args: readonly [Hex]
  }) => Promise<unknown>
}

export function derivePendingAuctionTokenOwnerKey(params: {
  creatorToken: Address
  owner: Address
}): Hex {
  return keccak256(
    encodePacked(['address', 'address'], [getAddress(params.creatorToken), getAddress(params.owner)]),
  )
}

export function deriveHasActivePendingAuctionStorageSlot(tokenOwnerKey: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }],
      [tokenOwnerKey, DEPLOYMENT_BATCHER_HAS_ACTIVE_PENDING_AUCTION_MAPPING_SLOT],
    ),
  )
}

function setStorageAtMethod(forkMode: 'anvil' | 'hardhat'): string {
  return forkMode === 'anvil' ? 'anvil_setStorageAt' : 'hardhat_setStorageAt'
}

export async function readHasActivePendingAuctionOnFork(params: {
  publicClient: ReadContractClient
  batcher: Address
  creatorToken: Address
  owner: Address
}): Promise<boolean> {
  const tokenOwnerKey = derivePendingAuctionTokenOwnerKey({
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  const active = (await params.publicClient.readContract({
    address: getAddress(params.batcher),
    abi: BATCHER_PENDING_AUCTION_ABI,
    functionName: 'hasActivePendingAuction',
    args: [tokenOwnerKey],
  })) as boolean
  return active === true
}

/**
 * Greenfield batcher allows one deferred auction per (creatorToken, owner).
 * Stale fork state from an earlier dry-run (often a different vanity deployment version)
 * leaves `hasActivePendingAuction` set and blocks Phase 2 finalize with
 * `AuctionAlreadyPendingForToken`.
 */
export async function ensurePendingAuctionGateClearOnFork(params: {
  publicClient: ReadContractClient
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: 'anvil' | 'hardhat'
  batcher: Address
  creatorToken: Address
  owner: Address
}): Promise<{ wasActive: boolean; cleared: boolean }> {
  const batcher = getAddress(params.batcher)
  const wasActive = await readHasActivePendingAuctionOnFork({
    publicClient: params.publicClient,
    batcher,
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  if (!wasActive) {
    return { wasActive: false, cleared: false }
  }

  const tokenOwnerKey = derivePendingAuctionTokenOwnerKey({
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  const storageSlot = deriveHasActivePendingAuctionStorageSlot(tokenOwnerKey)
  await params.forkRequest({
    method: setStorageAtMethod(params.forkMode),
    params: [batcher, storageSlot, '0x0000000000000000000000000000000000000000000000000000000000000000'],
  })

  const stillActive = await readHasActivePendingAuctionOnFork({
    publicClient: params.publicClient,
    batcher,
    creatorToken: params.creatorToken,
    owner: params.owner,
  })
  if (stillActive) {
    throw new Error(
      `Failed to clear hasActivePendingAuction for creatorToken=${params.creatorToken} owner=${params.owner} on fork.`,
    )
  }

  return { wasActive: true, cleared: true }
}
