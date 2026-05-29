import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem'

import { resolveAlignedPhase1DeployDeps } from '../../../src/lib/deploy/phase1ModuleDeploy.js'
import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'

const BATCHER_PHASE3_HELPER_ABI = [
  {
    type: 'function',
    name: 'phase3Helper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const PHASE3_HELPER_CREATE2_ABI = [
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATE2_AUTH_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ name: 'deployer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setAuthorizedDeployer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'deployer', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
] as const

type ReadContractClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
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

export type Phase3HelperCreate2AuthStatus =
  | { ok: true; phase3Helper: Address; create2Deployer: Address; authorized: true }
  | {
      ok: false
      phase3Helper: Address
      create2Deployer: Address
      authorized: false
      create2Owner: Address
      message: string
    }

export async function readPhase3HelperCreate2Authorization(params: {
  publicClient: ReadContractClient
  batcher: Address
}): Promise<Phase3HelperCreate2AuthStatus> {
  const batcher = getAddress(params.batcher)
  const phase3Helper = getAddress(
    (await params.publicClient.readContract({
      address: batcher,
      abi: BATCHER_PHASE3_HELPER_ABI,
      functionName: 'phase3Helper',
    })) as Address,
  )
  const create2Deployer = getAddress(
    (await params.publicClient.readContract({
      address: phase3Helper,
      abi: PHASE3_HELPER_CREATE2_ABI,
      functionName: 'create2Deployer',
    })) as Address,
  )
  const authorized = (await params.publicClient.readContract({
    address: create2Deployer,
    abi: CREATE2_AUTH_ABI,
    functionName: 'authorizedDeployers',
    args: [phase3Helper],
  })) as boolean

  if (authorized === true) {
    return { ok: true, phase3Helper, create2Deployer, authorized: true }
  }

  const create2Owner = getAddress(
    (await params.publicClient.readContract({
      address: create2Deployer,
      abi: CREATE2_AUTH_ABI,
      functionName: 'owner',
    })) as Address,
  )

  return {
    ok: false,
    phase3Helper,
    create2Deployer,
    authorized: false,
    create2Owner,
    message:
      `Phase3 helper ${phase3Helper} is not authorized on create2 deployer ${create2Deployer}. ` +
      `Phase 3 CREATE2 calls run from the helper (not the batcher shell), so ` +
      `setAuthorizedDeployer(${phase3Helper}, true) must be executed by owner ${create2Owner}.`,
  }
}

/**
 * Phase 3 helper calls UniversalCreate2DeployerFromStore directly; unlike Phase 1
 * (delegatecall module), msg.sender at the deployer is the helper address.
 */
export async function ensurePhase3HelperCreate2AuthorizationOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  batcher: Address
  ownerBalanceHex?: Hex
}): Promise<{ alreadyAuthorized: boolean; ensured: boolean; phase3Helper: Address; create2Deployer: Address }> {
  const batcher = getAddress(params.batcher)
  const status = await readPhase3HelperCreate2Authorization({
    publicClient: params.publicClient,
    batcher,
  })
  if (status.ok) {
    return {
      alreadyAuthorized: true,
      ensured: false,
      phase3Helper: status.phase3Helper,
      create2Deployer: status.create2Deployer,
    }
  }

  const owner = status.create2Owner
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
      abi: CREATE2_AUTH_ABI,
      functionName: 'setAuthorizedDeployer',
      args: [status.phase3Helper, true],
    })
    const hash = await params.walletClient.sendTransaction({
      account: owner,
      to: status.create2Deployer,
      data,
      value: 0n,
    })
    const receipt = await params.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(
        `setAuthorizedDeployer(${status.phase3Helper}, true) reverted on fork (tx ${hash}).`,
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

  const verified = await readPhase3HelperCreate2Authorization({
    publicClient: params.publicClient,
    batcher,
  })
  if (!verified.ok) {
    throw new Error(
      `Phase3 helper ${status.phase3Helper} still unauthorized on create2 deployer ${status.create2Deployer} after fork prep.`,
    )
  }

  return {
    alreadyAuthorized: false,
    ensured: true,
    phase3Helper: verified.phase3Helper,
    create2Deployer: verified.create2Deployer,
  }
}

export async function assertPhase3HelperCreate2Authorization(params: {
  publicClient: ReadContractClient
  batcher: Address
}): Promise<void> {
  const batcher = getAddress(params.batcher)
  const aligned = await resolveAlignedPhase1DeployDeps({
    publicClient: params.publicClient as Parameters<typeof resolveAlignedPhase1DeployDeps>[0]['publicClient'],
    batcherAddress: batcher,
  })
  if (!aligned.ok) {
    throw new Error(`phase3 precheck failed: ${aligned.message}`)
  }

  const status = await readPhase3HelperCreate2Authorization({
    publicClient: params.publicClient,
    batcher,
  })
  if (!status.ok) {
    throw new Error(`phase3 precheck failed: ${status.message}`)
  }

  if (getAddress(status.create2Deployer) !== getAddress(aligned.create2Deployer)) {
    throw new Error(
      `phase3 precheck failed: phase3Helper.create2Deployer=${status.create2Deployer} ` +
        `does not match wired Phase1 create2 deployer ${aligned.create2Deployer}.`,
    )
  }
}
