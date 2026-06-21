import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem'

/** Base mainnet CreatorRegistry — see docs/reference/addresses.md */
export const BASE_MAINNET_CREATOR_REGISTRY = '0xDD7B106a15540bA2F59464590222bF47D8C9394E' as const

const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'authorizedFactories',
    stateMutability: 'view',
    inputs: [{ name: 'factory', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'setAuthorizedFactory',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_factory', type: 'address' },
      { name: '_authorized', type: 'bool' },
    ],
    outputs: [],
  },
] as const

type ReadContractClient = {
  readContract: (args: {
    address: Address
    abi: typeof CREATOR_REGISTRY_ABI
    functionName: 'authorizedFactories' | 'owner'
    args?: readonly unknown[]
  }) => Promise<unknown>
}

type SendTransactionClient = {
  sendTransaction: (args: {
    account: Address
    to: Address
    data: Hex
    value?: bigint
    chain?: unknown
  }) => Promise<Hex>
}

type WaitReceiptClient = {
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>
}

export type ForkImpersonationMode = {
  setBalanceMethod: 'anvil_setBalance' | 'hardhat_setBalance'
  impersonateMethod: 'anvil_impersonateAccount' | 'hardhat_impersonateAccount'
  stopMethod: 'anvil_stopImpersonatingAccount' | 'hardhat_stopImpersonatingAccount'
}

export async function readBatcherRegistryAuthorized(params: {
  publicClient: ReadContractClient
  batcher: Address
  registry?: Address
}): Promise<boolean> {
  const registry = getAddress(params.registry ?? BASE_MAINNET_CREATOR_REGISTRY)
  const batcher = getAddress(params.batcher)
  const authorized = (await params.publicClient.readContract({
    address: registry,
    abi: CREATOR_REGISTRY_ABI,
    functionName: 'authorizedFactories',
    args: [batcher],
  })) as boolean
  return authorized === true
}

/**
 * Greenfield Phase 2 finalize registers creator coin + vault on CreatorRegistry.
 * The split DeploymentBatcher must be an authorized factory — forge tests set this in
 * setup, but mainnet may lag until SeedCreatorRegistry / ops wiring runs.
 */
export async function ensureBatcherRegistryAuthorizationOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: WaitReceiptClient['waitForTransactionReceipt']
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  batcher: Address
  registry?: Address
  ownerBalanceHex?: Hex
}): Promise<{ alreadyAuthorized: boolean; ensured: boolean }> {
  const registry = getAddress(params.registry ?? BASE_MAINNET_CREATOR_REGISTRY)
  const batcher = getAddress(params.batcher)
  const alreadyAuthorized = await readBatcherRegistryAuthorized({
    publicClient: params.publicClient,
    batcher,
    registry,
  })
  if (alreadyAuthorized) {
    return { alreadyAuthorized: true, ensured: false }
  }

  const owner = getAddress(
    (await params.publicClient.readContract({
      address: registry,
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'owner',
    })) as Address,
  )

  const balanceHex = params.ownerBalanceHex ?? ('0x56bc75e2d63100000' as Hex)
  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: [owner, balanceHex],
  })
  await params.forkRequest({
    method: params.forkMode.impersonateMethod,
    params: [owner],
  })

  try {
    const data = encodeFunctionData({
      abi: CREATOR_REGISTRY_ABI,
      functionName: 'setAuthorizedFactory',
      args: [batcher, true],
    })
    const hash = await params.walletClient.sendTransaction({
      account: owner,
      to: registry,
      data,
      value: 0n,
    })
    const receipt = await params.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(
        `CreatorRegistry.setAuthorizedFactory(${batcher}, true) reverted on fork (tx ${hash}).`,
      )
    }
  } finally {
    try {
      await params.forkRequest({
        method: params.forkMode.stopMethod,
        params: [owner],
      })
    } catch {
      // Best-effort cleanup on local forks.
    }
  }

  const verified = await readBatcherRegistryAuthorized({
    publicClient: params.publicClient,
    batcher,
    registry,
  })
  if (!verified) {
    throw new Error(
      `CreatorRegistry still reports DeploymentBatcher ${batcher} as unauthorized after fork prep.`,
    )
  }

  return { alreadyAuthorized: false, ensured: true }
}
