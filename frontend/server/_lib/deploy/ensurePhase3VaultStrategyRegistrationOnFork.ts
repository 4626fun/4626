import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from 'viem'

import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'

type Phase3Call = { data: Hex }

const DEPLOY_PHASE3_SELECTOR = '0x881d4960'

const DEPLOY_PHASE3_ABI = [
  {
    type: 'function',
    name: 'deployPhase3Strategies',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'initialSqrtPriceX96', type: 'uint160' },
          { name: 'charmVaultName', type: 'string' },
          { name: 'charmVaultSymbol', type: 'string' },
          { name: 'ajnaVaultName', type: 'string' },
          { name: 'ajnaVaultSymbol', type: 'string' },
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'solanaWeightBps', type: 'uint256' },
          { name: 'ajnaBufferRatioBps', type: 'uint256' },
          { name: 'ajnaMinBucketIndex', type: 'uint256' },
          { name: 'ajnaKeeper', type: 'address' },
          { name: 'solanaKeeper', type: 'address' },
          { name: 'solanaMaxNavAge', type: 'uint64' },
          { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
          { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
          { name: 'solanaBridgeAddress', type: 'address' },
          { name: 'enableAutoAllocate', type: 'bool' },
          { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaVaultAuth', type: 'bytes32' },
          { name: 'ajnaVault', type: 'bytes32' },
          { name: 'erc4626StrategyAdapter', type: 'bytes32' },
          { name: 'solanaStrategy', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const VAULT_STRATEGY_MANAGER_ABI = [
  {
    type: 'function',
    name: 'strategyCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'addStrategy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'weight', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setAutoAllocate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'enabled', type: 'bool' }],
    outputs: [],
  },
] as const

const PHASE3_STRATEGIES_DEPLOYED_EVENT = {
  type: 'event',
  name: 'Phase3StrategiesDeployed',
  inputs: [
    { name: 'creatorToken', type: 'address', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'vault', type: 'address', indexed: true },
    { name: 'v3Pool', type: 'address', indexed: false },
    { name: 'charmVault', type: 'address', indexed: false },
    { name: 'charmStrategy', type: 'address', indexed: false },
    { name: 'ajnaVaultAuth', type: 'address', indexed: false },
    { name: 'ajnaVault', type: 'address', indexed: false },
    { name: 'ajnaStrategy', type: 'address', indexed: false },
    { name: 'solanaStrategy', type: 'address', indexed: false },
    { name: 'charmWeightBps', type: 'uint256', indexed: false },
    { name: 'ajnaWeightBps', type: 'uint256', indexed: false },
    { name: 'solanaWeightBps', type: 'uint256', indexed: false },
  ],
} as const

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

export function isDeployPhase3StrategiesCall(call: Phase3Call): boolean {
  return String(call.data ?? '').toLowerCase().startsWith(DEPLOY_PHASE3_SELECTOR)
}

/**
 * Live batcher shell may still lack post-helper addStrategy wiring. After a successful
 * deployPhase3Strategies tx, register strategies from the batcher management lane.
 */
export async function ensurePhase3VaultStrategyRegistrationOnFork(params: {
  publicClient: ReadContractClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    logs: Array<{ address: Address; data: Hex; topics: readonly Hex[] | [] }>
  }>
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  batcher: Address
  phase3Call: Phase3Call
  deployTxHash: Hex
  ownerBalanceHex?: Hex
}): Promise<{ ensured: boolean; skippedReason?: string; followupCount: number }> {
  const batcher = getAddress(params.batcher)
  const decoded = decodeFunctionData({
    abi: DEPLOY_PHASE3_ABI,
    data: params.phase3Call.data,
  })
  const phase3Params = decoded.args[0] as {
    vault: Address
    charmWeightBps: bigint
    ajnaWeightBps: bigint
    enableAutoAllocate: boolean
  }

  const strategyCount = (await params.publicClient.readContract({
    address: getAddress(phase3Params.vault),
    abi: VAULT_STRATEGY_MANAGER_ABI,
    functionName: 'strategyCount',
  })) as bigint
  if (strategyCount > 0n) {
    return { ensured: false, skippedReason: 'vault_already_has_strategies', followupCount: 0 }
  }

  const txReceipt = await params.getTransactionReceipt({ hash: params.deployTxHash })

  let charmStrategy: Address | null = null
  let ajnaStrategy: Address | null = null
  for (const log of txReceipt.logs) {
    if (getAddress(log.address).toLowerCase() !== batcher.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({
        abi: [PHASE3_STRATEGIES_DEPLOYED_EVENT],
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]] | [],
      })
      if (parsed.eventName !== 'Phase3StrategiesDeployed') continue
      charmStrategy = getAddress(parsed.args.charmStrategy as Address)
      ajnaStrategy = getAddress(parsed.args.ajnaStrategy as Address)
      break
    } catch {
      continue
    }
  }

  if (!charmStrategy && !ajnaStrategy) {
    return { ensured: false, skippedReason: 'phase3_event_missing', followupCount: 0 }
  }

  const balanceHex = params.ownerBalanceHex ?? ('0x56bc75e2d63100000' as Hex)
  await params.forkRequest({
    method: params.forkMode.setBalanceMethod,
    params: [batcher, balanceHex],
  })
  await params.forkRequest({
    method: params.forkMode.impersonateMethod,
    params: [batcher],
  })

  const zero = '0x0000000000000000000000000000000000000000' as Address
  const followups: Array<{ to: Address; data: Hex }> = []
  if (phase3Params.charmWeightBps > 0n && charmStrategy && charmStrategy !== zero) {
    followups.push({
      to: getAddress(phase3Params.vault),
      data: encodeFunctionData({
        abi: VAULT_STRATEGY_MANAGER_ABI,
        functionName: 'addStrategy',
        args: [charmStrategy, phase3Params.charmWeightBps],
      }),
    })
  }
  if (phase3Params.ajnaWeightBps > 0n && ajnaStrategy && ajnaStrategy !== zero) {
    followups.push({
      to: getAddress(phase3Params.vault),
      data: encodeFunctionData({
        abi: VAULT_STRATEGY_MANAGER_ABI,
        functionName: 'addStrategy',
        args: [ajnaStrategy, phase3Params.ajnaWeightBps],
      }),
    })
  }
  if (phase3Params.enableAutoAllocate) {
    followups.push({
      to: getAddress(phase3Params.vault),
      data: encodeFunctionData({
        abi: VAULT_STRATEGY_MANAGER_ABI,
        functionName: 'setAutoAllocate',
        args: [true],
      }),
    })
  }

  try {
    for (const followup of followups) {
      const hash = await params.walletClient.sendTransaction({
        account: batcher,
        to: followup.to,
        data: followup.data,
        value: 0n,
      })
      const followupReceipt = await params.waitForTransactionReceipt({ hash })
      if (followupReceipt.status !== 'success') {
        throw new Error(`Phase3 vault follow-up reverted (tx ${hash}).`)
      }
    }
  } finally {
    try {
      await params.forkRequest({
        method: params.forkMode.stopMethod,
        params: [batcher],
      })
    } catch {
      // Best-effort cleanup on local forks.
    }
  }

  return { ensured: true, followupCount: followups.length }
}
