import { coinABI } from '@zoralabs/protocol-deployments'
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'

const LEGACY_COIN_OWNERSHIP_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'transferOwnership',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },
] as const

const LEGACY_CREATOR_COIN_OWNERS_ABI = [
  { type: 'function', name: 'totalOwners', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerAt', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

export type CreatorCoinOwnershipGrantMethod = 'addOwner' | 'transferOwnership'

export type CreatorCoinPolicyControllerOwnershipPlan = {
  /** True when the policy controller must be granted coin admin before deploy completes. */
  needsGrant: boolean
  grantMethod: CreatorCoinOwnershipGrantMethod | null
  grantCallData: Hex | null
  coinOwners: Address[] | null
  policyControllerIsOwner: boolean
  deploySenderIsCoinOwner: boolean
  /** Populated for legacy Ownable coins when transferOwnership applies. */
  legacyCoinOwner: Address | null
}

type MinimalPublicClient = Pick<PublicClient, 'readContract' | 'call'>

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value as Address)
}

async function readCreatorCoinOwnersMulti(
  publicClient: MinimalPublicClient,
  creatorToken: Address,
): Promise<Address[] | null> {
  try {
    const owners = await publicClient.readContract({
      address: creatorToken,
      abi: coinABI,
      functionName: 'owners',
    })
    if (!Array.isArray(owners)) return null
    const normalized = owners
      .map((owner) => normalizeAddress(owner))
      .filter((owner): owner is Address => owner !== null)
    return normalized.length > 0 ? normalized : []
  } catch {
    // Fall through to legacy ownerAt/totalOwners scan.
  }

  try {
    const totalOwners = await publicClient.readContract({
      address: creatorToken,
      abi: LEGACY_CREATOR_COIN_OWNERS_ABI,
      functionName: 'totalOwners',
    })
    const count = Number(totalOwners as bigint)
    if (!Number.isFinite(count) || count <= 0) return []
    const owners: Address[] = []
    for (let i = 0; i < Math.min(count, 64); i++) {
      const owner = normalizeAddress(
        await publicClient.readContract({
          address: creatorToken,
          abi: LEGACY_CREATOR_COIN_OWNERS_ABI,
          functionName: 'ownerAt',
          args: [BigInt(i)],
        }),
      )
      if (owner) owners.push(owner)
    }
    return owners
  } catch {
    return null
  }
}

async function readCreatorCoinIsOwner(
  publicClient: MinimalPublicClient,
  creatorToken: Address,
  account: Address,
): Promise<boolean | null> {
  try {
    const isOwner = await publicClient.readContract({
      address: creatorToken,
      abi: coinABI,
      functionName: 'isOwner',
      args: [account],
    })
    return isOwner === true
  } catch {
    return null
  }
}

async function readLegacyCreatorCoinOwner(
  publicClient: MinimalPublicClient,
  creatorToken: Address,
): Promise<Address | null> {
  try {
    return normalizeAddress(
      await publicClient.readContract({
        address: creatorToken,
        abi: LEGACY_COIN_OWNERSHIP_ABI,
        functionName: 'owner',
      }),
    )
  } catch {
    return null
  }
}

export function encodeCreatorCoinAddOwnerCallData(newOwner: Address): Hex {
  return encodeFunctionData({
    abi: coinABI,
    functionName: 'addOwner',
    args: [newOwner],
  })
}

export function encodeCreatorCoinTransferOwnershipCallData(newOwner: Address): Hex {
  return encodeFunctionData({
    abi: LEGACY_COIN_OWNERSHIP_ABI,
    functionName: 'transferOwnership',
    args: [newOwner],
  })
}

export async function planCreatorCoinPolicyControllerOwnershipGrant(params: {
  publicClient: MinimalPublicClient
  creatorToken: Address
  deploySender: Address
  policyController: Address
}): Promise<CreatorCoinPolicyControllerOwnershipPlan> {
  const { publicClient, creatorToken, deploySender, policyController } = params

  const [coinOwners, policyControllerIsOwnerDirect, legacyCoinOwner] = await Promise.all([
    readCreatorCoinOwnersMulti(publicClient, creatorToken),
    readCreatorCoinIsOwner(publicClient, creatorToken, policyController),
    readLegacyCreatorCoinOwner(publicClient, creatorToken),
  ])

  const policyControllerIsOwner =
    policyControllerIsOwnerDirect === true ||
    (coinOwners?.some((owner) => owner.toLowerCase() === policyController.toLowerCase()) ?? false) ||
    legacyCoinOwner?.toLowerCase() === policyController.toLowerCase()

  const deploySenderIsCoinOwner =
    (await readCreatorCoinIsOwner(publicClient, creatorToken, deploySender)) === true ||
    (coinOwners?.some((owner) => owner.toLowerCase() === deploySender.toLowerCase()) ?? false) ||
    legacyCoinOwner?.toLowerCase() === deploySender.toLowerCase()

  if (policyControllerIsOwner) {
    return {
      needsGrant: false,
      grantMethod: null,
      grantCallData: null,
      coinOwners,
      policyControllerIsOwner: true,
      deploySenderIsCoinOwner,
      legacyCoinOwner,
    }
  }

  const addOwnerCallData = encodeCreatorCoinAddOwnerCallData(policyController)
  const transferOwnershipCallData = encodeCreatorCoinTransferOwnershipCallData(policyController)

  const canAddOwnerFromDeploySender = await (async () => {
    if (!deploySenderIsCoinOwner) return false
    try {
      await publicClient.call({
        to: creatorToken,
        data: addOwnerCallData,
        account: deploySender,
      })
      return true
    } catch {
      return false
    }
  })()

  if (canAddOwnerFromDeploySender) {
    return {
      needsGrant: true,
      grantMethod: 'addOwner',
      grantCallData: addOwnerCallData,
      coinOwners,
      policyControllerIsOwner: false,
      deploySenderIsCoinOwner,
      legacyCoinOwner,
    }
  }

  const legacyNeedsTransfer =
    legacyCoinOwner !== null &&
    legacyCoinOwner.toLowerCase() !== policyController.toLowerCase()

  const canTransferOwnershipFromDeploySender = await (async () => {
    if (!legacyNeedsTransfer) return false
    if (legacyCoinOwner && legacyCoinOwner.toLowerCase() !== deploySender.toLowerCase()) return false
    try {
      await publicClient.call({
        to: creatorToken,
        data: transferOwnershipCallData,
        account: deploySender,
      })
      return true
    } catch {
      return false
    }
  })()

  if (canTransferOwnershipFromDeploySender) {
    return {
      needsGrant: true,
      grantMethod: 'transferOwnership',
      grantCallData: transferOwnershipCallData,
      coinOwners,
      policyControllerIsOwner: false,
      deploySenderIsCoinOwner,
      legacyCoinOwner,
    }
  }

  return {
    needsGrant: true,
    grantMethod: null,
    grantCallData: null,
    coinOwners,
    policyControllerIsOwner: false,
    deploySenderIsCoinOwner,
    legacyCoinOwner,
  }
}
