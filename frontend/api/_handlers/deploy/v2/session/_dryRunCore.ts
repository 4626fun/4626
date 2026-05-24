import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodePacked,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbiItem,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { isLocalForkRpcUrl, resolveDeploySessionRpcUrl } from './deploySessionRpc.js'
import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  isDbConfigured,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'

import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'


import {
  type ApiEnvelope,
  type Call,
  type CreateDeploySessionRequest,
  DeploySessionRequestError,
  validateDeploySessionRequest,
} from './_createCore.js'

type DryRunPhaseName = 'phase1' | 'phase2Core' | 'phase2Finalize' | 'phase3' | 'phase4'

type DryRunPhaseResult = {
  name: DryRunPhaseName
  status: 'passed' | 'failed' | 'skipped'
  callCount: number
  reason?: string
}

type DryRunFailure = {
  phase: DryRunPhaseName
  callIndex: number
  to: Address
  error: string
}

type DryRunResponse = {
  ok: boolean
  forkMode: 'anvil' | 'hardhat'
  phases: DryRunPhaseResult[]
  failure?: DryRunFailure
}

type ForkRpcMode = {
  name: 'anvil' | 'hardhat'
  impersonateMethod: 'anvil_impersonateAccount' | 'hardhat_impersonateAccount'
  stopMethod: 'anvil_stopImpersonatingAccount' | 'hardhat_stopImpersonatingAccount'
  setBalanceMethod: 'anvil_setBalance' | 'hardhat_setBalance'
}

const FORK_RPC_MODES: ForkRpcMode[] = [
  {
    name: 'anvil',
    impersonateMethod: 'anvil_impersonateAccount',
    stopMethod: 'anvil_stopImpersonatingAccount',
    setBalanceMethod: 'anvil_setBalance',
  },
  {
    name: 'hardhat',
    impersonateMethod: 'hardhat_impersonateAccount',
    stopMethod: 'hardhat_stopImpersonatingAccount',
    setBalanceMethod: 'hardhat_setBalance',
  },
]

const FORK_BALANCE_HEX = '0x56bc75e2d63100000'
const LOCAL_FORK_ONLY_ERROR =
  'Deploy dry-run is local-fork-only. Start local dry-run with `pnpm -C frontend dev:deploy-dry-run` and ensure BASE_RPC_URL points to localhost/127.0.0.1.'
const DRY_RUN_GAS_BUFFER_BPS = 2_000n
const DRY_RUN_MIN_GAS_BUFFER = 100_000n
const DEPLOY_FAILED_SELECTOR = '0xb4f54111'
const ERC20_INSUFFICIENT_BALANCE_SELECTOR = '0xe450d38c'
const CCA_REQUIRED_RAISE_HINT_SELECTOR = '0x28e7b618'
const PHASE2_MISSING_SELECTOR = '0xf79c143b'
const SELECTOR_LAUNCH_DEFERRED_AUCTION = '0x02afdbcb'
const SELECTOR_DEPLOY_PHASE2_CORE = '0xf9344d88'
const SELECTOR_PHASE1_DEPLOY = '0x3c51ca4e'
const SELECTOR_PHASE1_CORE = '0x1331378b'
const SELECTOR_PHASE1_FINALIZE = '0xa98ec9d8'
const SELECTOR_PHASE1_DEPLOY_WITH_SALT = '0x297cb1e6'
const SELECTOR_PHASE1_CORE_WITH_SALT = '0x4154f24e'
const SELECTOR_PHASE1_FINALIZE_WITH_SALT = '0x3bc09a8b'

const DRY_RUN_DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_FINALIZE_PHASE2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI = [
  {
    type: 'function',
    name: 'launchDeferredAuction',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const PHASE2_CORE_DEPLOYED_EVENT = parseAbiItem(
  'event Phase2CoreDeployed(address indexed creatorToken, address indexed owner, address gaugeController, address ccaStrategy, address oracle)',
)

const DRY_RUN_PHASE1_PARAMS_COMPONENTS = [
  { name: 'creatorToken', type: 'address' },
  { name: 'owner', type: 'address' },
  { name: 'vaultName', type: 'string' },
  { name: 'vaultSymbol', type: 'string' },
  { name: 'shareName', type: 'string' },
  { name: 'shareSymbol', type: 'string' },
  { name: 'version', type: 'string' },
] as const

const DRY_RUN_PHASE1_CODE_IDS_COMPONENTS = [
  { name: 'vault', type: 'bytes32' },
  { name: 'wrapper', type: 'bytes32' },
  { name: 'shareOFT', type: 'bytes32' },
  { name: 'gauge', type: 'bytes32' },
  { name: 'cca', type: 'bytes32' },
  { name: 'oracle', type: 'bytes32' },
  { name: 'oftBootstrap', type: 'bytes32' },
] as const

const DRY_RUN_PHASE1_ABI = [
  {
    type: 'function',
    name: 'deployPhase1',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_PHASE1_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase1Core',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_PHASE1_FINALIZE_ABI = [
  {
    type: 'function',
    name: 'finalizePhase1',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_PHASE1_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_PHASE1_CORE_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1CoreWithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const DRY_RUN_PHASE1_FINALIZE_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'finalizePhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: DRY_RUN_PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: DRY_RUN_PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

function callValueToBigInt(value: Call['value']): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) return BigInt(value.trim())
  return 0n
}

function formatDryRunError(error: unknown): string {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'string' && error.trim()
        ? error.trim()
        : ''
  if (raw) {
    if (raw.toLowerCase().includes(DEPLOY_FAILED_SELECTOR)) {
      return (
        'DeployFailed(): CREATE2 deployment failed because a deterministic deployment address is already used. ' +
        'For local dry-runs, reset the fork or skip the already-completed deterministic phase before retrying.'
      )
    }
    const insufficientBalance = formatErc20InsufficientBalanceError(raw)
    if (insufficientBalance) return insufficientBalance
    return raw
  }
  return 'Dry-run simulation failed'
}

function formatDryRunTokenAmount(value: bigint): string {
  const raw = formatUnits(value, 18)
  const [whole = '0', fraction = ''] = raw.split('.')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const trimmedFraction = fraction.replace(/0+$/, '').slice(0, 6)
  return trimmedFraction ? `${groupedWhole}.${trimmedFraction}` : groupedWhole
}

function formatErc20InsufficientBalanceError(raw: string): string | null {
  const lower = raw.toLowerCase()
  const selectorIndex = lower.indexOf(ERC20_INSUFFICIENT_BALANCE_SELECTOR)
  if (selectorIndex < 0) return null

  const afterSelector = raw.slice(selectorIndex + ERC20_INSUFFICIENT_BALANCE_SELECTOR.length)
  const payloadMatch = afterSelector.match(/[0-9a-fA-F]{192,}/)
  if (!payloadMatch) {
    return (
      'ERC20InsufficientBalance(): the canonical smart wallet does not hold enough creator tokens ' +
      'for the required initial deposit.'
    )
  }

  try {
    const payload = payloadMatch[0]!
    const accountWord = payload.slice(0, 64)
    const balanceWord = payload.slice(64, 128)
    const neededWord = payload.slice(128, 192)
    const account = getAddress(`0x${accountWord.slice(24)}` as Address)
    const balance = BigInt(`0x${balanceWord}`)
    const needed = BigInt(`0x${neededWord}`)
    return (
      `ERC20InsufficientBalance(): ${account} has ${formatDryRunTokenAmount(balance)} creator tokens, ` +
      `but Phase 2 finalize needs ${formatDryRunTokenAmount(needed)}. ` +
      'Transfer the missing creator tokens to the canonical smart wallet, then retry dry-run/deploy.'
    )
  } catch {
    return (
      'ERC20InsufficientBalance(): the canonical smart wallet does not hold enough creator tokens ' +
      'for the required initial deposit.'
    )
  }
}

function parseRaiseHintFromCustomError(raw: string): bigint | null {
  const lower = raw.toLowerCase()
  const selectorIndex = lower.indexOf(CCA_REQUIRED_RAISE_HINT_SELECTOR)
  if (selectorIndex < 0) return null
  const afterSelector = raw.slice(selectorIndex + CCA_REQUIRED_RAISE_HINT_SELECTOR.length)
  const payloadMatch = afterSelector.match(/[0-9a-fA-F]{64,}/)
  if (!payloadMatch) return null
  try {
    const payload = payloadMatch[0]!
    const words = payload.match(/[0-9a-fA-F]{64}/g) ?? []
    let hint: bigint | null = null
    for (const word of words) {
      const value = BigInt(`0x${word}`)
      if (value > 0n && (hint === null || value > hint)) {
        hint = value
      }
    }
    return hint
  } catch {
    return null
  }
}

function isLaunchDeferredAuctionCall(call: Call): boolean {
  return String(call.data ?? '').slice(0, 10).toLowerCase() === SELECTOR_LAUNCH_DEFERRED_AUCTION
}

function buildPhase4LaunchHintCandidates(call: Call, formattedError: string): Call[] {
  const raiseHint = parseRaiseHintFromCustomError(formattedError)
  if (!raiseHint) return []
  try {
    const decoded = decodeFunctionData({ abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI, data: call.data })
    if (decoded.functionName !== 'launchDeferredAuction') return []
    const launchParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
    if (!launchParams) return []

    const currentRaiseRaw = launchParams.requiredRaise ?? launchParams[5]
    const currentFloorRaw = launchParams.floorPriceQ96 ?? launchParams[4]
    const currentRaise = typeof currentRaiseRaw === 'bigint' ? currentRaiseRaw : BigInt(String(currentRaiseRaw ?? '0'))
    const currentFloor = typeof currentFloorRaw === 'bigint' ? currentFloorRaw : BigInt(String(currentFloorRaw ?? '0'))
    const uint128Max = (1n << 128n) - 1n
    const nextRaise = raiseHint <= uint128Max && raiseHint > currentRaise ? raiseHint : currentRaise
    const nextFloor = raiseHint > currentFloor ? raiseHint : currentFloor
    const candidates: Call[] = []

    if (nextRaise > currentRaise) {
      candidates.push({
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI,
          functionName: 'launchDeferredAuction',
          args: [{ ...launchParams, requiredRaise: nextRaise } as any],
        }) as Hex,
      })
    }

    if (nextFloor > currentFloor) {
      candidates.push({
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI,
          functionName: 'launchDeferredAuction',
          args: [{ ...launchParams, floorPriceQ96: nextFloor } as any],
        }) as Hex,
      })
    }

    if (nextRaise > currentRaise && nextFloor > currentFloor) {
      candidates.push({
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI,
          functionName: 'launchDeferredAuction',
          args: [{ ...launchParams, requiredRaise: nextRaise, floorPriceQ96: nextFloor } as any],
        }) as Hex,
      })
    }

    // Deduplicate candidate calldata while preserving order preference:
    // requiredRaise-only, floor-only, then both.
    const seen = new Set<string>()
    return candidates.filter((candidate) => {
      const key = String(candidate.data ?? '').toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

function addDryRunGasBuffer(estimatedGas: bigint): bigint {
  const proportionalBuffer = (estimatedGas * DRY_RUN_GAS_BUFFER_BPS) / 10_000n
  const buffer = proportionalBuffer > DRY_RUN_MIN_GAS_BUFFER ? proportionalBuffer : DRY_RUN_MIN_GAS_BUFFER
  return estimatedGas + buffer
}

async function enableForkImpersonation(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  smartWallet: Address
}): Promise<ForkRpcMode> {
  let lastError: unknown = null
  for (const mode of FORK_RPC_MODES) {
    try {
      await params.request({
        method: mode.setBalanceMethod,
        params: [params.smartWallet, FORK_BALANCE_HEX],
      })
      await params.request({
        method: mode.impersonateMethod,
        params: [params.smartWallet],
      })
      return mode
    } catch (error) {
      lastError = error
    }
  }

  throw new DeploySessionRequestError(
    400,
    `Deploy dry-run requires an Anvil or Hardhat fork RPC with impersonation enabled. ${formatDryRunError(lastError)}`,
  )
}

async function resetForkState(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}): Promise<void> {
  for (const method of ['anvil_reset', 'hardhat_reset'] as const) {
    try {
      await params.request({ method, params: [] })
      return
    } catch {
      // Not every local fork supports both reset methods.
    }
  }
}

async function snapshotForkState(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}): Promise<string | null> {
  try {
    const snapshot = await params.request({ method: 'evm_snapshot' })
    if (typeof snapshot === 'string' && snapshot.trim()) return snapshot
    if (typeof snapshot === 'number' && Number.isFinite(snapshot)) return String(snapshot)
  } catch {
    // Snapshot support is best-effort across local fork implementations.
  }
  return null
}

async function revertForkState(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  snapshotId: string | null
}): Promise<void> {
  if (!params.snapshotId) return
  try {
    await params.request({ method: 'evm_revert', params: [params.snapshotId] })
  } catch {
    // Best-effort cleanup for local dry-runs.
  }
}

async function refreshForkImpersonation(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  smartWallet: Address
  mode: ForkRpcMode
}): Promise<void> {
  await params.request({
    method: params.mode.setBalanceMethod,
    params: [params.smartWallet, FORK_BALANCE_HEX],
  })
  await params.request({
    method: params.mode.impersonateMethod,
    params: [params.smartWallet],
  })
}

function getTupleAddress(value: unknown, name: string, index: number): Address | null {
  const tuple = value && typeof value === 'object' ? (value as Record<string | number, unknown>) : null
  const raw = tuple?.[name] ?? tuple?.[index]
  if (typeof raw !== 'string') return null
  try {
    return getAddress(raw as Address)
  } catch {
    return null
  }
}

function isDeployPhase2CoreCall(call: Call): boolean {
  if (String(call.data ?? '').slice(0, 10).toLowerCase() === SELECTOR_DEPLOY_PHASE2_CORE) return true
  try {
    const decoded = decodeFunctionData({
      abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI,
      data: call.data,
    })
    return decoded.functionName === 'deployPhase2Core'
  } catch {
    return false
  }
}

function isPhase1BatcherCall(call: Call): boolean {
  const selector = String(call.data ?? '').slice(0, 10).toLowerCase()
  return (
    selector === SELECTOR_PHASE1_DEPLOY ||
    selector === SELECTOR_PHASE1_CORE ||
    selector === SELECTOR_PHASE1_FINALIZE ||
    selector === SELECTOR_PHASE1_DEPLOY_WITH_SALT ||
    selector === SELECTOR_PHASE1_CORE_WITH_SALT ||
    selector === SELECTOR_PHASE1_FINALIZE_WITH_SALT
  )
}

function isFinalizePhase2Call(call: Call): boolean {
  try {
    const decoded = decodeFunctionData({
      abi: DRY_RUN_FINALIZE_PHASE2_ABI,
      data: call.data,
    })
    return decoded.functionName === 'finalizePhase2'
  } catch {
    return false
  }
}

function normalizePhase2TargetsToPhase1Batcher(params: {
  phase1Calls: Call[]
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
}): { phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[]; rewrote: boolean; phase1Batcher: Address | null } {
  const phase1Batcher = (() => {
    const call = params.phase1Calls.find((entry) => isPhase1BatcherCall(entry))
    if (!call) return null
    try {
      return getAddress(call.to as Address)
    } catch {
      return null
    }
  })()

  if (!phase1Batcher) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
      phase1Batcher: null,
    }
  }

  let rewrote = false
  const phase2CoreCalls = params.phase2CoreCalls.map((call) => {
    if (!isDeployPhase2CoreCall(call)) return call
    try {
      const to = getAddress(call.to as Address)
      if (to.toLowerCase() === phase1Batcher.toLowerCase()) return call
      rewrote = true
      return { ...call, to: phase1Batcher }
    } catch {
      return call
    }
  })

  const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
    if (!isFinalizePhase2Call(call)) return call
    try {
      const to = getAddress(call.to as Address)
      if (to.toLowerCase() === phase1Batcher.toLowerCase()) return call
      rewrote = true
      return { ...call, to: phase1Batcher }
    } catch {
      return call
    }
  })

  return { phase2CoreCalls, phase2FinalizeCalls, rewrote, phase1Batcher }
}

type PhaseIdentity = {
  creatorToken: Address
  owner: Address
  version: string
}

function extractPhase1Identity(calls: Call[]): PhaseIdentity | null {
  for (const call of calls) {
    const selector = String(call.data ?? '').slice(0, 10).toLowerCase()
    try {
      let params: Record<string, unknown> | null = null
      if (selector === SELECTOR_PHASE1_DEPLOY) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_CORE) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_CORE_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_FINALIZE) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_FINALIZE_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_DEPLOY_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_CORE_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_CORE_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_FINALIZE_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_FINALIZE_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      }
      if (!params) continue
      const creatorToken = getTupleAddress(params, 'creatorToken', 0)
      const owner = getTupleAddress(params, 'owner', 1)
      const versionRaw = params.version ?? params[6]
      const version = typeof versionRaw === 'string' ? versionRaw.trim() : ''
      if (creatorToken && owner && version) return { creatorToken, owner, version }
    } catch {
      continue
    }
  }
  return null
}

function extractPhase1Identities(calls: Call[]): PhaseIdentity[] {
  const identities: PhaseIdentity[] = []
  const seen = new Set<string>()
  for (const call of calls) {
    const selector = String(call.data ?? '').slice(0, 10).toLowerCase()
    try {
      let params: Record<string, unknown> | null = null
      if (selector === SELECTOR_PHASE1_DEPLOY) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_CORE) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_CORE_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_FINALIZE) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_FINALIZE_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_DEPLOY_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_CORE_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_CORE_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      } else if (selector === SELECTOR_PHASE1_FINALIZE_WITH_SALT) {
        const decoded = decodeFunctionData({ abi: DRY_RUN_PHASE1_FINALIZE_WITH_SALT_ABI, data: call.data })
        params = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      }
      if (!params) continue
      const creatorToken = getTupleAddress(params, 'creatorToken', 0)
      const owner = getTupleAddress(params, 'owner', 1)
      const versionRaw = params.version ?? params[6]
      const version = typeof versionRaw === 'string' ? versionRaw.trim() : ''
      if (!creatorToken || !owner || !version) continue
      const key = `${creatorToken.toLowerCase()}|${owner.toLowerCase()}|${version}`
      if (seen.has(key)) continue
      seen.add(key)
      identities.push({ creatorToken, owner, version })
    } catch {
      continue
    }
  }
  return identities
}

async function alignPhase2ToFinalizedPhase1State(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  phase1Batcher: Address | null
  phase1Identities: PhaseIdentity[]
  readContract: (args: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => Promise<unknown>
}): Promise<{ phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[]; rewrote: boolean; identity: PhaseIdentity | null }> {
  if (!params.phase1Batcher || params.phase1Identities.length === 0) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
      identity: null,
    }
  }

  for (const identity of params.phase1Identities) {
    const baseSalt = keccak256(
      encodePacked(
        ['address', 'address', 'uint256', 'string', 'string'],
        [identity.creatorToken, identity.owner, BigInt(base.id), '4626:deploy:', identity.version],
      ),
    )
    const phase1State = await params
      .readContract({
        address: params.phase1Batcher,
        abi: [
          {
            type: 'function',
            name: 'phase1SplitStates',
            stateMutability: 'view',
            inputs: [{ name: '', type: 'bytes32' }],
            outputs: [
              { name: 'oftBootstrapRegistry', type: 'address' },
              { name: 'vault', type: 'address' },
              { name: 'wrapper', type: 'address' },
              { name: 'shareOFT', type: 'address' },
              { name: 'shareOftSalt', type: 'bytes32' },
              { name: 'paramsHash', type: 'bytes32' },
              { name: 'codeIdsHash', type: 'bytes32' },
              { name: 'coreDone', type: 'bool' },
              { name: 'finalized', type: 'bool' },
            ],
          },
        ] as const,
        functionName: 'phase1SplitStates',
        args: [baseSalt],
      })
      .catch(() => null)

    if (!phase1State || typeof phase1State !== 'object') continue
    const finalizedRaw =
      (phase1State as Record<string | number, unknown>).finalized ?? (phase1State as Record<string | number, unknown>)[8]
    if (finalizedRaw !== true) continue

    const canonicalVault = getTupleAddress(phase1State, 'vault', 1)
    const canonicalWrapper = getTupleAddress(phase1State, 'wrapper', 2)
    const canonicalShareOFT = getTupleAddress(phase1State, 'shareOFT', 3)
    if (!canonicalVault || !canonicalWrapper || !canonicalShareOFT) continue

    let rewrote = false

    const phase2CoreCalls = params.phase2CoreCalls.map((call) => {
      try {
        const decoded = decodeFunctionData({ abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI, data: call.data })
        if (decoded.functionName !== 'deployPhase2Core') return call
        const coreParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
        const codeIds = decoded.args?.[1]
        if (!coreParams || !codeIds) return call

        const currentCreator = getTupleAddress(coreParams, 'creatorToken', 0)
        const currentOwner = getTupleAddress(coreParams, 'owner', 1)
        const currentVersionRaw = coreParams.version ?? coreParams[8]
        const currentVersion = typeof currentVersionRaw === 'string' ? currentVersionRaw.trim() : ''
        const currentVault = getTupleAddress(coreParams, 'vault', 4)
        const currentWrapper = getTupleAddress(coreParams, 'wrapper', 5)
        const currentShareOFT = getTupleAddress(coreParams, 'shareOFT', 6)

        if (
          currentCreator?.toLowerCase() === identity.creatorToken.toLowerCase() &&
          currentOwner?.toLowerCase() === identity.owner.toLowerCase() &&
          currentVersion === identity.version &&
          currentVault?.toLowerCase() === canonicalVault.toLowerCase() &&
          currentWrapper?.toLowerCase() === canonicalWrapper.toLowerCase() &&
          currentShareOFT?.toLowerCase() === canonicalShareOFT.toLowerCase()
        ) {
          return call
        }

        rewrote = true
        return {
          ...call,
          data: encodeFunctionData({
            abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI,
            functionName: 'deployPhase2Core',
            args: [
              {
                ...coreParams,
                creatorToken: identity.creatorToken,
                owner: identity.owner,
                version: identity.version,
                vault: canonicalVault,
                wrapper: canonicalWrapper,
                shareOFT: canonicalShareOFT,
              } as any,
              codeIds as any,
            ],
          }) as Hex,
        }
      } catch {
        return call
      }
    })

    const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
      try {
        const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
        if (decoded.functionName !== 'finalizePhase2') return call
        const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
        if (!finalizeParams) return call

        const currentCreator = getTupleAddress(finalizeParams, 'creatorToken', 0)
        const currentOwner = getTupleAddress(finalizeParams, 'owner', 1)
        const currentVersionRaw = finalizeParams.version ?? finalizeParams[8]
        const currentVersion = typeof currentVersionRaw === 'string' ? currentVersionRaw.trim() : ''
        const currentVault = getTupleAddress(finalizeParams, 'vault', 2)
        const currentWrapper = getTupleAddress(finalizeParams, 'wrapper', 3)
        const currentShareOFT = getTupleAddress(finalizeParams, 'shareOFT', 4)

        if (
          currentCreator?.toLowerCase() === identity.creatorToken.toLowerCase() &&
          currentOwner?.toLowerCase() === identity.owner.toLowerCase() &&
          currentVersion === identity.version &&
          currentVault?.toLowerCase() === canonicalVault.toLowerCase() &&
          currentWrapper?.toLowerCase() === canonicalWrapper.toLowerCase() &&
          currentShareOFT?.toLowerCase() === canonicalShareOFT.toLowerCase()
        ) {
          return call
        }

        rewrote = true
        return {
          ...call,
          data: encodeFunctionData({
            abi: DRY_RUN_FINALIZE_PHASE2_ABI,
            functionName: 'finalizePhase2',
            args: [
              {
                ...finalizeParams,
                creatorToken: identity.creatorToken,
                owner: identity.owner,
                version: identity.version,
                vault: canonicalVault,
                wrapper: canonicalWrapper,
                shareOFT: canonicalShareOFT,
              } as any,
            ],
          }) as Hex,
        }
      } catch {
        return call
      }
    })

    return {
      phase2CoreCalls,
      phase2FinalizeCalls,
      rewrote,
      identity,
    }
  }

  return {
    phase2CoreCalls: params.phase2CoreCalls,
    phase2FinalizeCalls: params.phase2FinalizeCalls,
    rewrote: false,
    identity: null,
  }
}

function normalizePhase2IdentityToPhase1(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  identity: PhaseIdentity | null
}): { phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[]; rewrote: boolean } {
  if (!params.identity) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  let rewrote = false
  const { creatorToken, owner, version } = params.identity

  const phase2CoreCalls = params.phase2CoreCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI, data: call.data })
      if (decoded.functionName !== 'deployPhase2Core') return call
      const coreParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      const codeIds = decoded.args?.[1]
      if (!coreParams || !codeIds) return call
      const currentCreator = getTupleAddress(coreParams, 'creatorToken', 0)
      const currentOwner = getTupleAddress(coreParams, 'owner', 1)
      const currentVersionRaw = coreParams.version ?? coreParams[8]
      const currentVersion = typeof currentVersionRaw === 'string' ? currentVersionRaw.trim() : ''
      if (
        currentCreator?.toLowerCase() === creatorToken.toLowerCase() &&
        currentOwner?.toLowerCase() === owner.toLowerCase() &&
        currentVersion === version
      ) {
        return call
      }
      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI,
          functionName: 'deployPhase2Core',
          args: [{ ...coreParams, creatorToken, owner, version } as any, codeIds as any],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
      if (decoded.functionName !== 'finalizePhase2') return call
      const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      if (!finalizeParams) return call
      const currentCreator = getTupleAddress(finalizeParams, 'creatorToken', 0)
      const currentOwner = getTupleAddress(finalizeParams, 'owner', 1)
      const currentVersionRaw = finalizeParams.version ?? finalizeParams[8]
      const currentVersion = typeof currentVersionRaw === 'string' ? currentVersionRaw.trim() : ''
      if (
        currentCreator?.toLowerCase() === creatorToken.toLowerCase() &&
        currentOwner?.toLowerCase() === owner.toLowerCase() &&
        currentVersion === version
      ) {
        return call
      }
      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_FINALIZE_PHASE2_ABI,
          functionName: 'finalizePhase2',
          args: [{ ...finalizeParams, creatorToken, owner, version } as any],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  return { phase2CoreCalls, phase2FinalizeCalls, rewrote }
}

async function normalizePhase2AddressesToPhase1State(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  phase1Batcher: Address | null
  identity: PhaseIdentity | null
  readContract: (args: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => Promise<unknown>
}): Promise<{ phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[]; rewrote: boolean }> {
  const phase1Batcher = params.phase1Batcher
  const identity = params.identity
  if (!phase1Batcher || !identity) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  const baseSalt = keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'string', 'string'],
      [identity.creatorToken, identity.owner, BigInt(base.id), '4626:deploy:', identity.version],
    ),
  )

  const phase1State = await params
    .readContract({
      address: phase1Batcher,
      abi: [
        {
          type: 'function',
          name: 'phase1SplitStates',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'bytes32' }],
          outputs: [
            { name: 'oftBootstrapRegistry', type: 'address' },
            { name: 'vault', type: 'address' },
            { name: 'wrapper', type: 'address' },
            { name: 'shareOFT', type: 'address' },
            { name: 'shareOftSalt', type: 'bytes32' },
            { name: 'paramsHash', type: 'bytes32' },
            { name: 'codeIdsHash', type: 'bytes32' },
            { name: 'coreDone', type: 'bool' },
            { name: 'finalized', type: 'bool' },
          ],
        },
      ] as const,
      functionName: 'phase1SplitStates',
      args: [baseSalt],
    })
    .catch(() => null)

  if (!phase1State || typeof phase1State !== 'object') {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  const finalizedRaw = (phase1State as Record<string | number, unknown>).finalized ?? (phase1State as Record<string | number, unknown>)[8]
  if (finalizedRaw !== true) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  const canonicalVault = getTupleAddress(phase1State, 'vault', 1)
  const canonicalWrapper = getTupleAddress(phase1State, 'wrapper', 2)
  const canonicalShareOFT = getTupleAddress(phase1State, 'shareOFT', 3)
  if (!canonicalVault || !canonicalWrapper || !canonicalShareOFT) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  let rewrote = false

  const phase2CoreCalls = params.phase2CoreCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI, data: call.data })
      if (decoded.functionName !== 'deployPhase2Core') return call
      const coreParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      const codeIds = decoded.args?.[1]
      if (!coreParams || !codeIds) return call

      const currentVault = getTupleAddress(coreParams, 'vault', 4)
      const currentWrapper = getTupleAddress(coreParams, 'wrapper', 5)
      const currentShareOFT = getTupleAddress(coreParams, 'shareOFT', 6)
      if (
        currentVault?.toLowerCase() === canonicalVault.toLowerCase() &&
        currentWrapper?.toLowerCase() === canonicalWrapper.toLowerCase() &&
        currentShareOFT?.toLowerCase() === canonicalShareOFT.toLowerCase()
      ) {
        return call
      }

      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_DEPLOY_PHASE2_CORE_ABI,
          functionName: 'deployPhase2Core',
          args: [
            {
              ...coreParams,
              vault: canonicalVault,
              wrapper: canonicalWrapper,
              shareOFT: canonicalShareOFT,
            } as any,
            codeIds as any,
          ],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
      if (decoded.functionName !== 'finalizePhase2') return call
      const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      if (!finalizeParams) return call

      const currentVault = getTupleAddress(finalizeParams, 'vault', 2)
      const currentWrapper = getTupleAddress(finalizeParams, 'wrapper', 3)
      const currentShareOFT = getTupleAddress(finalizeParams, 'shareOFT', 4)
      if (
        currentVault?.toLowerCase() === canonicalVault.toLowerCase() &&
        currentWrapper?.toLowerCase() === canonicalWrapper.toLowerCase() &&
        currentShareOFT?.toLowerCase() === canonicalShareOFT.toLowerCase()
      ) {
        return call
      }

      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_FINALIZE_PHASE2_ABI,
          functionName: 'finalizePhase2',
          args: [
            {
              ...finalizeParams,
              vault: canonicalVault,
              wrapper: canonicalWrapper,
              shareOFT: canonicalShareOFT,
            } as any,
          ],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  return { phase2CoreCalls, phase2FinalizeCalls, rewrote }
}

function extractFinalizePhase2CoreAddresses(calls: Call[]): {
  gaugeController: Address
  ccaStrategy: Address
  oracle: Address
} | null {
  for (const call of calls) {
    try {
      const decoded = decodeFunctionData({
        abi: DRY_RUN_FINALIZE_PHASE2_ABI,
        data: call.data,
      })
      if (decoded.functionName !== 'finalizePhase2') continue
      const params = decoded.args[0]
      const gaugeController = getTupleAddress(params, 'gaugeController', 5)
      const ccaStrategy = getTupleAddress(params, 'ccaStrategy', 6)
      const oracle = getTupleAddress(params, 'oracle', 7)
      if (gaugeController && ccaStrategy && oracle) {
        return { gaugeController, ccaStrategy, oracle }
      }
    } catch {
      // Ignore non-finalize calls.
    }
  }
  return null
}

function extractFinalizePhase2Identity(calls: Call[]): { creatorToken: Address; owner: Address } | null {
  for (const call of calls) {
    try {
      const decoded = decodeFunctionData({
        abi: DRY_RUN_FINALIZE_PHASE2_ABI,
        data: call.data,
      })
      if (decoded.functionName !== 'finalizePhase2') continue
      const params = decoded.args[0]
      const creatorToken = getTupleAddress(params, 'creatorToken', 0)
      const owner = getTupleAddress(params, 'owner', 1)
      if (creatorToken && owner) return { creatorToken, owner }
    } catch {
      // Ignore non-finalize calls.
    }
  }
  return null
}

async function alignPhase4LaunchToPendingAuctionState(params: {
  phase4Calls: Call[]
  readContract: (args: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => Promise<unknown>
}): Promise<{ phase4Calls: Call[]; rewrote: boolean }> {
  let rewrote = false
  const phase4Calls = await Promise.all(
    params.phase4Calls.map(async (call) => {
      try {
        const decoded = decodeFunctionData({ abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI, data: call.data })
        if (decoded.functionName !== 'launchDeferredAuction') return call
        const launchParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
        if (!launchParams) return call

        const creatorToken = getTupleAddress(launchParams, 'creatorToken', 0)
        const owner = getTupleAddress(launchParams, 'owner', 1)
        const currentShareOFT = getTupleAddress(launchParams, 'shareOFT', 2)
        const versionRaw = launchParams.version ?? launchParams[3]
        const version = typeof versionRaw === 'string' ? versionRaw.trim() : ''
        if (!creatorToken || !owner || !currentShareOFT || !version) return call

        const batcher = getAddress(call.to as Address)
        const baseSalt = keccak256(
          encodePacked(
            ['address', 'address', 'uint256', 'string', 'string'],
            [creatorToken, owner, BigInt(base.id), '4626:deploy:', version],
          ),
        )
        const pending = await params
          .readContract({
            address: batcher,
            abi: [
              {
                type: 'function',
                name: 'pendingAuctions',
                stateMutability: 'view',
                inputs: [{ name: 'baseSalt', type: 'bytes32' }],
                outputs: [
                  { name: 'shareOFT', type: 'address' },
                  { name: 'ccaStrategy', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                  { name: 'lpReserveAmount', type: 'uint256' },
                ],
              },
            ] as const,
            functionName: 'pendingAuctions',
            args: [baseSalt],
          })
          .catch(() => null)
        if (!pending || typeof pending !== 'object') return call

        const pendingShareOFT = getTupleAddress(pending, 'shareOFT', 0)
        if (!pendingShareOFT) return call
        if (pendingShareOFT.toLowerCase() === currentShareOFT.toLowerCase()) return call

        rewrote = true
        return {
          ...call,
          data: encodeFunctionData({
            abi: DRY_RUN_LAUNCH_DEFERRED_AUCTION_ABI,
            functionName: 'launchDeferredAuction',
            args: [
              {
                ...launchParams,
                shareOFT: pendingShareOFT,
              } as any,
            ],
          }) as Hex,
        }
      } catch {
        return call
      }
    }),
  )

  return { phase4Calls, rewrote }
}

async function alignPhase4RequiredRaiseFromSimulation(params: {
  phase4Calls: Call[]
  account: Address
  simulateCall: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>
}): Promise<{ phase4Calls: Call[]; rewrote: boolean }> {
  let rewrote = false
  const phase4Calls: Call[] = []
  for (const call of params.phase4Calls) {
    const to = getAddress(call.to)
    const value = callValueToBigInt(call.value)
    try {
      await params.simulateCall({ account: params.account, to, data: call.data, value })
      phase4Calls.push(call)
      continue
    } catch (error) {
      const formatted = formatDryRunError(error)
      const candidates = buildPhase4LaunchHintCandidates(call, formatted)
      if (candidates.length === 0) {
        phase4Calls.push(call)
        continue
      }
      let selected: Call | null = null
      for (const candidate of candidates) {
        try {
          await params.simulateCall({ account: params.account, to, data: candidate.data, value })
          selected = candidate
          break
        } catch {
          continue
        }
      }
      if (selected) {
        rewrote = true
        phase4Calls.push(selected)
        continue
      }
      phase4Calls.push(call)
    }
  }
  return { phase4Calls, rewrote }
}

async function alignPhase2FinalizeToCoreDeploymentEvent(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  getLogs: (args: {
    address: Address
    event: unknown
    args?: { creatorToken: Address; owner: Address }
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<Array<{ args?: Record<string, unknown> }>>
  fromBlock: bigint
  toBlock: bigint
}): Promise<{ phase2FinalizeCalls: Call[]; rewrote: boolean }> {
  const deployCoreCall = params.phase2CoreCalls.find(isDeployPhase2CoreCall)
  const fallbackFinalizeCall = params.phase2FinalizeCalls[0] ?? null
  const batcherSource = deployCoreCall ?? fallbackFinalizeCall
  if (!batcherSource) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }

  let batcher: Address | null = null
  try {
    batcher = getAddress(batcherSource.to as Address)
  } catch {
    batcher = null
  }
  if (!batcher) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }

  const identity = extractFinalizePhase2Identity(params.phase2FinalizeCalls)
  if (!identity) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }

  const logs = await params
    .getLogs({
      address: batcher,
      event: PHASE2_CORE_DEPLOYED_EVENT,
      args: { creatorToken: identity.creatorToken, owner: identity.owner },
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
    })
    .catch(() => [])
  const fallbackLogs =
    logs.length === 0
      ? await params
          .getLogs({
            address: batcher,
            event: PHASE2_CORE_DEPLOYED_EVENT,
            fromBlock: params.fromBlock,
            toBlock: params.toBlock,
          })
          .catch(() => [])
      : []
  const latestLog = (fallbackLogs.length > 0 ? fallbackLogs : logs)[
    (fallbackLogs.length > 0 ? fallbackLogs : logs).length - 1
  ]
  if (!latestLog?.args) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }

  const deployedGauge = getTupleAddress(latestLog.args, 'gaugeController', 2)
  const deployedCca = getTupleAddress(latestLog.args, 'ccaStrategy', 3)
  const deployedOracle = getTupleAddress(latestLog.args, 'oracle', 4)
  if (!deployedGauge || !deployedCca || !deployedOracle) {
    return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }
  }

  let rewrote = false
  const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
      if (decoded.functionName !== 'finalizePhase2') return call
      const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      if (!finalizeParams) return call

      const currentGauge = getTupleAddress(finalizeParams, 'gaugeController', 5)
      const currentCca = getTupleAddress(finalizeParams, 'ccaStrategy', 6)
      const currentOracle = getTupleAddress(finalizeParams, 'oracle', 7)
      if (
        currentGauge?.toLowerCase() === deployedGauge.toLowerCase() &&
        currentCca?.toLowerCase() === deployedCca.toLowerCase() &&
        currentOracle?.toLowerCase() === deployedOracle.toLowerCase()
      ) {
        return call
      }

      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_FINALIZE_PHASE2_ABI,
          functionName: 'finalizePhase2',
          args: [
            {
              ...finalizeParams,
              gaugeController: deployedGauge,
              ccaStrategy: deployedCca,
              oracle: deployedOracle,
            } as any,
          ],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  return { phase2FinalizeCalls, rewrote }
}

async function alignPhase2FinalizeToLiveCoreCode(params: {
  phase2FinalizeCalls: Call[]
  getBytecode: (args: { address: Address }) => Promise<Hex | string | null | undefined>
  getBlockNumber: () => Promise<bigint | null>
  getLogs: (args: {
    address: Address
    event: unknown
    args?: { creatorToken: Address; owner: Address }
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<Array<{ args?: Record<string, unknown> }>>
}): Promise<{ phase2FinalizeCalls: Call[]; rewrote: boolean }> {
  let rewrote = false
  const latestBlock = await params.getBlockNumber().catch(() => null)
  if (latestBlock === null) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }
  const fromBlock = latestBlock > 250n ? latestBlock - 250n : 0n

  const phase2FinalizeCalls: Call[] = []
  for (const call of params.phase2FinalizeCalls) {
    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
      if (decoded.functionName !== 'finalizePhase2') {
        phase2FinalizeCalls.push(call)
        continue
      }
      const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      if (!finalizeParams) {
        phase2FinalizeCalls.push(call)
        continue
      }
      const creatorToken = getTupleAddress(finalizeParams, 'creatorToken', 0)
      const owner = getTupleAddress(finalizeParams, 'owner', 1)
      const gaugeController = getTupleAddress(finalizeParams, 'gaugeController', 5)
      const ccaStrategy = getTupleAddress(finalizeParams, 'ccaStrategy', 6)
      const oracle = getTupleAddress(finalizeParams, 'oracle', 7)
      if (!creatorToken || !owner || !gaugeController || !ccaStrategy || !oracle) {
        phase2FinalizeCalls.push(call)
        continue
      }

      const [gaugeCode, ccaCode, oracleCode] = await Promise.all([
        params.getBytecode({ address: gaugeController }),
        params.getBytecode({ address: ccaStrategy }),
        params.getBytecode({ address: oracle }),
      ])
      const hasCode = (c: Hex | string | null | undefined) => Boolean(c && c !== '0x')
      if (hasCode(gaugeCode) && hasCode(ccaCode) && hasCode(oracleCode)) {
        phase2FinalizeCalls.push(call)
        continue
      }

      const batcher = getAddress(call.to as Address)
      const logsFiltered = await params
        .getLogs({
          address: batcher,
          event: PHASE2_CORE_DEPLOYED_EVENT,
          args: { creatorToken, owner },
          fromBlock,
          toBlock: latestBlock,
        })
        .catch(() => [])
      const logsAny =
        logsFiltered.length > 0
          ? logsFiltered
          : await params
              .getLogs({
                address: batcher,
                event: PHASE2_CORE_DEPLOYED_EVENT,
                fromBlock,
                toBlock: latestBlock,
              })
              .catch(() => [])
      const latestLog = logsAny[logsAny.length - 1]
      const deployedGauge = latestLog?.args ? getTupleAddress(latestLog.args, 'gaugeController', 2) : null
      const deployedCca = latestLog?.args ? getTupleAddress(latestLog.args, 'ccaStrategy', 3) : null
      const deployedOracle = latestLog?.args ? getTupleAddress(latestLog.args, 'oracle', 4) : null
      if (!deployedGauge || !deployedCca || !deployedOracle) {
        phase2FinalizeCalls.push(call)
        continue
      }

      rewrote = true
      phase2FinalizeCalls.push({
        ...call,
        data: encodeFunctionData({
          abi: DRY_RUN_FINALIZE_PHASE2_ABI,
          functionName: 'finalizePhase2',
          args: [
            {
              ...finalizeParams,
              gaugeController: deployedGauge,
              ccaStrategy: deployedCca,
              oracle: deployedOracle,
            } as any,
          ],
        }) as Hex,
      })
    } catch {
      phase2FinalizeCalls.push(call)
    }
  }

  return { phase2FinalizeCalls, rewrote }
}

async function alignPhase2FinalizeFromSimulation(params: {
  phase2FinalizeCalls: Call[]
  account: Address
  simulateCall: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>
  getBlockNumber: () => Promise<bigint | null>
  getLogs: (args: {
    address: Address
    event: unknown
    args?: { creatorToken: Address; owner: Address }
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<Array<{ args?: Record<string, unknown> }>>
}): Promise<{ phase2FinalizeCalls: Call[]; rewrote: boolean }> {
  let rewrote = false
  const latestBlock = await params.getBlockNumber().catch(() => null)
  if (latestBlock === null) return { phase2FinalizeCalls: params.phase2FinalizeCalls, rewrote: false }
  const fromBlock = latestBlock > 1_000n ? latestBlock - 1_000n : 0n

  const phase2FinalizeCalls: Call[] = []
  for (const call of params.phase2FinalizeCalls) {
    const to = getAddress(call.to)
    const value = callValueToBigInt(call.value)
    let needRecovery = false
    try {
      await params.simulateCall({ account: params.account, to, data: call.data, value })
      phase2FinalizeCalls.push(call)
      continue
    } catch (error) {
      const raw = formatDryRunError(error).toLowerCase()
      needRecovery = raw.includes(PHASE2_MISSING_SELECTOR)
      if (!needRecovery) {
        phase2FinalizeCalls.push(call)
        continue
      }
    }

    try {
      const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: call.data })
      if (decoded.functionName !== 'finalizePhase2') {
        phase2FinalizeCalls.push(call)
        continue
      }
      const finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
      if (!finalizeParams) {
        phase2FinalizeCalls.push(call)
        continue
      }

      const logs = await params
        .getLogs({
          address: to,
          event: PHASE2_CORE_DEPLOYED_EVENT,
          fromBlock,
          toBlock: latestBlock,
        })
        .catch(() => [])
      if (logs.length === 0) {
        phase2FinalizeCalls.push(call)
        continue
      }

      let recoveredCall: Call | null = null
      for (let i = logs.length - 1; i >= 0; i -= 1) {
        const log = logs[i]
        if (!log?.args) continue
        const deployedGauge = getTupleAddress(log.args, 'gaugeController', 2)
        const deployedCca = getTupleAddress(log.args, 'ccaStrategy', 3)
        const deployedOracle = getTupleAddress(log.args, 'oracle', 4)
        if (!deployedGauge || !deployedCca || !deployedOracle) continue

        const candidate: Call = {
          ...call,
          data: encodeFunctionData({
            abi: DRY_RUN_FINALIZE_PHASE2_ABI,
            functionName: 'finalizePhase2',
            args: [
              {
                ...finalizeParams,
                gaugeController: deployedGauge,
                ccaStrategy: deployedCca,
                oracle: deployedOracle,
              } as any,
            ],
          }) as Hex,
        }

        try {
          await params.simulateCall({
            account: params.account,
            to,
            data: candidate.data,
            value,
          })
          recoveredCall = candidate
          break
        } catch {
          continue
        }
      }

      if (recoveredCall) {
        rewrote = true
        phase2FinalizeCalls.push(recoveredCall)
      } else {
        phase2FinalizeCalls.push(call)
      }
    } catch {
      phase2FinalizeCalls.push(call)
    }
  }

  return { phase2FinalizeCalls, rewrote }
}

async function recoverPhase2FinalizeCallFromLogs(params: {
  call: Call
  account: Address
  simulateCall: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>
  getBlockNumber: () => Promise<bigint | null>
  getLogs: (args: {
    address: Address
    event: unknown
    args?: { creatorToken: Address; owner: Address }
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<Array<{ args?: Record<string, unknown> }>>
}): Promise<Call | null> {
  let finalizeParams: Record<string, unknown> | null = null
  try {
    const decoded = decodeFunctionData({ abi: DRY_RUN_FINALIZE_PHASE2_ABI, data: params.call.data })
    if (decoded.functionName !== 'finalizePhase2') return null
    finalizeParams = (decoded.args?.[0] ?? null) as Record<string, unknown> | null
  } catch {
    return null
  }
  if (!finalizeParams) return null

  const creatorToken = getTupleAddress(finalizeParams, 'creatorToken', 0)
  const owner = getTupleAddress(finalizeParams, 'owner', 1)
  if (!creatorToken || !owner) return null

  const latestBlock = await params.getBlockNumber().catch(() => null)
  if (latestBlock === null) return null
  const fromBlock = latestBlock > 1_000n ? latestBlock - 1_000n : 0n
  const to = getAddress(params.call.to)
  const value = callValueToBigInt(params.call.value)

  const filteredLogs = await params
    .getLogs({
      address: to,
      event: PHASE2_CORE_DEPLOYED_EVENT,
      args: { creatorToken, owner },
      fromBlock,
      toBlock: latestBlock,
    })
    .catch(() => [])
  const logs =
    filteredLogs.length > 0
      ? filteredLogs
      : await params
          .getLogs({
            address: to,
            event: PHASE2_CORE_DEPLOYED_EVENT,
            fromBlock,
            toBlock: latestBlock,
          })
          .catch(() => [])
  if (logs.length === 0) return null

  const originalDataKey = String(params.call.data ?? '').toLowerCase()
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i]
    if (!log?.args) continue
    const deployedGauge = getTupleAddress(log.args, 'gaugeController', 2)
    const deployedCca = getTupleAddress(log.args, 'ccaStrategy', 3)
    const deployedOracle = getTupleAddress(log.args, 'oracle', 4)
    if (!deployedGauge || !deployedCca || !deployedOracle) continue

    const candidate: Call = {
      ...params.call,
      data: encodeFunctionData({
        abi: DRY_RUN_FINALIZE_PHASE2_ABI,
        functionName: 'finalizePhase2',
        args: [
          {
            ...finalizeParams,
            gaugeController: deployedGauge,
            ccaStrategy: deployedCca,
            oracle: deployedOracle,
          } as any,
        ],
      }) as Hex,
    }
    const candidateDataKey = String(candidate.data ?? '').toLowerCase()
    if (!candidateDataKey || candidateDataKey === originalDataKey) continue
    try {
      await params.simulateCall({
        account: params.account,
        to,
        data: candidate.data,
        value,
      })
      return candidate
    } catch {
      continue
    }
  }

  return null
}

async function preparePhase2CoreCalls(params: {
  calls: Call[]
  finalizeCalls: Call[]
  getBytecode: (args: { address: Address }) => Promise<Hex | string | null | undefined>
}): Promise<Call[]> {
  // Some clients can carry stale duplicate deployPhase2Core payloads during
  // retries/resumes. On dry-run forks this commonly surfaces as:
  // call #1 succeeds, call #2 reverts with Phase1Missing() because the second
  // payload points at a different phase-1 tuple/version. Keep the first
  // deployPhase2Core call and preserve any non-core calls.
  const dedupedCalls: Call[] = []
  let seenDeployPhase2Core = false
  for (const call of params.calls) {
    if (!isDeployPhase2CoreCall(call)) {
      dedupedCalls.push(call)
      continue
    }
    if (seenDeployPhase2Core) continue
    seenDeployPhase2Core = true
    dedupedCalls.push(call)
  }

  if (!dedupedCalls.some(isDeployPhase2CoreCall)) return dedupedCalls
  const addresses = extractFinalizePhase2CoreAddresses(params.finalizeCalls)
  if (!addresses) return dedupedCalls

  const entries = [
    ['gauge', addresses.gaugeController],
    ['cca', addresses.ccaStrategy],
    ['oracle', addresses.oracle],
  ] as const
  const deployed = await Promise.all(
    entries.map(async ([, address]) => {
      const bytecode = await params.getBytecode({ address })
      return Boolean(bytecode && bytecode !== '0x')
    }),
  )
  const allDeployed = deployed.every(Boolean)
  const anyDeployed = deployed.some(Boolean)
  if (allDeployed) {
    return dedupedCalls.filter((call) => !isDeployPhase2CoreCall(call))
  }
  if (anyDeployed) {
    const state = entries.map(([label], index) => `${label}=${deployed[index] ? 'deployed' : 'missing'}`).join(', ')
    throw new Error(
      `Phase 2 core is partially deployed on the local fork (${state}). ` +
        'Reset the fork or bump the deployment version before retrying dry-run.',
    )
  }
  return dedupedCalls
}

async function runDryRunPhase(params: {
  name: DryRunPhaseName
  calls: Call[]
  smartWallet: Address
  ensureImpersonated: () => Promise<void>
  sendTransaction: (args: { account: Address; to: Address; data: Hex; value: bigint; gas?: bigint }) => Promise<Hex>
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status?: string }>
  simulateCall: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>
  estimateGas: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<bigint>
  getLogs?: (args: {
    address: Address
    event: unknown
    args?: { creatorToken: Address; owner: Address }
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<Array<{ args?: Record<string, unknown> }>>
  getBlockNumber?: () => Promise<bigint | null>
  allowLocalForkPhase4InvariantSkip?: boolean
}): Promise<{ phase: DryRunPhaseResult; failure?: DryRunFailure }> {
  for (let callIndex = 0; callIndex < params.calls.length; callIndex += 1) {
    let call = params.calls[callIndex]!
    const to = getAddress(call.to)
    const value = callValueToBigInt(call.value)
    const maxAttempts =
      params.name === 'phase4' && isLaunchDeferredAuctionCall(call)
        ? 5
        : params.name === 'phase2Finalize' && isFinalizePhase2Call(call)
          ? 3
          : 1
    let attempt = 0
    let completed = false
    const triedPhase4CallData = new Set<string>([String(call.data ?? '').toLowerCase()])
    try {
      while (attempt < maxAttempts) {
        attempt += 1
        await params.ensureImpersonated()
        let gas: bigint | undefined
        try {
          gas = addDryRunGasBuffer(
            await params.estimateGas({
              account: params.smartWallet,
              to,
              data: call.data,
              value,
            }),
          )
        } catch {
          // Let the transaction path surface the original revert if estimation cannot produce a bound.
        }
        try {
          const hash = await params.sendTransaction({
            account: params.smartWallet,
            to,
            data: call.data,
            value,
            gas,
          })
          const receipt = await params.waitForTransactionReceipt({ hash })
          if (String(receipt?.status ?? '').toLowerCase() === 'reverted') {
            let revertDetail = 'simulation transaction reverted'
            try {
              await params.simulateCall({
                account: params.smartWallet,
                to,
                data: call.data,
                value,
              })
            } catch (simulationError) {
              const formatted = formatDryRunError(simulationError)
              if (formatted) revertDetail = formatted
            }
            throw new Error(revertDetail)
          }
          // Success
          completed = true
          break
        } catch (sendError) {
          const formatted = formatDryRunError(sendError)
          if (/No Signer available/i.test(formatted)) {
            await params.ensureImpersonated()
            continue
          }
          if (
            attempt < maxAttempts &&
            params.name === 'phase2Finalize' &&
            isFinalizePhase2Call(call) &&
            formatted.toLowerCase().includes(PHASE2_MISSING_SELECTOR) &&
            typeof params.getLogs === 'function' &&
            typeof params.getBlockNumber === 'function'
          ) {
            const recovered = await recoverPhase2FinalizeCallFromLogs({
              call,
              account: params.smartWallet,
              simulateCall: params.simulateCall,
              getLogs: params.getLogs,
              getBlockNumber: params.getBlockNumber,
            })
            if (recovered) {
              const key = String(recovered.data ?? '').toLowerCase()
              if (key && !triedPhase4CallData.has(key)) {
                triedPhase4CallData.add(key)
                call = recovered
                continue
              }
            }
          }
          if (attempt < maxAttempts && params.name === 'phase4' && isLaunchDeferredAuctionCall(call)) {
            const candidates = buildPhase4LaunchHintCandidates(call, formatted)
            let selected: Call | null = null
            const candidateErrors: string[] = []
            for (const candidate of candidates) {
              const key = String(candidate.data ?? '').toLowerCase()
              if (!key || triedPhase4CallData.has(key)) continue
              triedPhase4CallData.add(key)
              try {
                await params.simulateCall({
                  account: params.smartWallet,
                  to,
                  data: candidate.data,
                  value,
                })
                selected = candidate
                break
              } catch (candidateErr) {
                candidateErrors.push(formatDryRunError(candidateErr))
                continue
              }
            }
            if (selected) {
              call = selected
              continue
            }
            if (candidates.length > 0) {
              const hint = parseRaiseHintFromCustomError(formatted)
              const debugSuffix =
                `phase4-hint=${hint ? hint.toString() : 'n/a'} ` +
                `candidateCount=${candidates.length} ` +
                `candidateErrors=${candidateErrors.slice(0, 3).join(' | ') || 'none'}`
              throw new Error(`${formatted} (${debugSuffix})`)
            }
          }
          throw sendError
        }
      }
      if (!completed && params.name === 'phase4' && isLaunchDeferredAuctionCall(call)) {
        // Last attempt failed without throwing through loop.
        throw new Error('phase4 launch retry attempts exhausted')
      }
    } catch (error) {
      const formatted = formatDryRunError(error)
      if (
        params.allowLocalForkPhase4InvariantSkip === true &&
        params.name === 'phase4' &&
        isLaunchDeferredAuctionCall(call) &&
        formatted.toLowerCase().includes(CCA_REQUIRED_RAISE_HINT_SELECTOR)
      ) {
        console.warn('[deploy/v2/session/dry-run] phase4_launch_skipped_known_local_fork_invariant', {
          reason: formatted,
        })
        return {
          phase: {
            name: params.name,
            status: 'skipped',
            callCount: 0,
            reason: 'known_local_fork_invariant',
          },
        }
      }
      return {
        phase: {
          name: params.name,
          status: 'failed',
          callCount: callIndex,
        },
        failure: {
          phase: params.name,
          callIndex,
          to,
          error: formatted,
        },
      }
    }
  }

  return {
    phase: {
      name: params.name,
      status: 'passed',
      callCount: params.calls.length,
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Deploy sessions require DB configuration' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  const rpc = resolveDeploySessionRpcUrl()
  const isLocalFork = isLocalForkRpcUrl(rpc)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('deploy-session-dry-run', auth.address.toLowerCase()),
    RATE_LIMITS.deploySessionDryRun,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many dry-run attempts' } satisfies ApiEnvelope<null>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 512_000 })) as CreateDeploySessionRequest | null
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  }

  try {
    const { smartWallet, phase1Calls, phase2CoreCalls, phase2FinalizeCalls, phase3Calls, phase4Calls } =
      await validateDeploySessionRequest({
        req,
        authAddress: getAddress(auth.address as Address),
        authType: auth.type,
        body,
        requireCalls: true,
      })

    if (!isLocalFork) {
      throw new DeploySessionRequestError(400, LOCAL_FORK_ONLY_ERROR)
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpc, { timeout: 12_000 }),
    })
    const walletClient = createWalletClient({
      chain: base,
      transport: http(rpc, { timeout: 12_000 }),
    })
    const forkRequest = (args: { method: string; params?: unknown[] }) => walletClient.request(args as any)

    await resetForkState({ request: forkRequest })
    const snapshotId = await snapshotForkState({ request: forkRequest })
    const forkMode = await enableForkImpersonation({
      request: forkRequest,
      smartWallet,
    })

    try {
      const phases: DryRunPhaseResult[] = []
      const {
        phase2CoreCalls: targetNormalizedPhase2CoreCalls,
        phase2FinalizeCalls: targetNormalizedPhase2FinalizeCalls,
        rewrote: rewrotePhase2Targets,
        phase1Batcher,
      } = normalizePhase2TargetsToPhase1Batcher({
        phase1Calls,
        phase2CoreCalls,
        phase2FinalizeCalls,
      })
      const phase1Identity = extractPhase1Identity(phase1Calls)
      const phase1Identities = extractPhase1Identities(phase1Calls)
      const {
        phase2CoreCalls: normalizedPhase2CoreCalls,
        phase2FinalizeCalls: normalizedPhase2FinalizeCalls,
        rewrote: rewrotePhase2Identity,
      } = normalizePhase2IdentityToPhase1({
        phase2CoreCalls: targetNormalizedPhase2CoreCalls,
        phase2FinalizeCalls: targetNormalizedPhase2FinalizeCalls,
        identity: phase1Identity,
      })
      const {
        phase2CoreCalls: phase1StateAlignedPhase2CoreCalls,
        phase2FinalizeCalls: phase1StateAlignedPhase2FinalizeCalls,
        rewrote: rewrotePhase2Phase1State,
      } = await normalizePhase2AddressesToPhase1State({
        phase2CoreCalls: normalizedPhase2CoreCalls,
        phase2FinalizeCalls: normalizedPhase2FinalizeCalls,
        phase1Batcher,
        identity: phase1Identity,
        readContract: (args) => publicClient.readContract(args as any),
      })
      let phase2CoreCallsForPlan = phase1StateAlignedPhase2CoreCalls
      let phase2FinalizeCallsForPlan = phase1StateAlignedPhase2FinalizeCalls
      if (rewrotePhase2Targets) {
        console.warn('[deploy/v2/session/dry-run] phase2_targets_rewritten_to_phase1_batcher', {
          smartWallet: smartWallet.toLowerCase(),
          phase1Batcher: phase1Batcher?.toLowerCase() ?? null,
        })
      }
      if (rewrotePhase2Identity) {
        console.warn('[deploy/v2/session/dry-run] phase2_identity_rewritten_to_phase1', {
          smartWallet: smartWallet.toLowerCase(),
          phase1Identity: phase1Identity
            ? {
                creatorToken: phase1Identity.creatorToken.toLowerCase(),
                owner: phase1Identity.owner.toLowerCase(),
                version: phase1Identity.version,
              }
            : null,
        })
      }
      if (rewrotePhase2Phase1State) {
        console.warn('[deploy/v2/session/dry-run] phase2_phase1_state_addresses_rewritten', {
          smartWallet: smartWallet.toLowerCase(),
          phase1Batcher: phase1Batcher?.toLowerCase() ?? null,
        })
      }
      const phasePlan: Array<{ name: DryRunPhaseName; calls: Call[] }> = [
        { name: 'phase1', calls: phase1Calls },
        { name: 'phase2Core', calls: phase2CoreCallsForPlan },
        { name: 'phase2Finalize', calls: phase2FinalizeCallsForPlan },
        { name: 'phase3', calls: phase3Calls },
        { name: 'phase4', calls: phase4Calls },
      ]

      for (const phaseEntry of phasePlan) {
        let phaseCalls = phaseEntry.calls
        if (phaseEntry.name === 'phase2Core') {
          const {
            phase2CoreCalls: alignedPhase2CoreCalls,
            phase2FinalizeCalls: alignedPhase2FinalizeCalls,
            rewrote: rewrotePhase2FromLiveState,
            identity: alignedIdentity,
          } = await alignPhase2ToFinalizedPhase1State({
            phase2CoreCalls: phase2CoreCallsForPlan,
            phase2FinalizeCalls: phase2FinalizeCallsForPlan,
            phase1Batcher,
            phase1Identities,
            readContract: (args) => publicClient.readContract(args as any),
          })
          if (rewrotePhase2FromLiveState) {
            console.warn('[deploy/v2/session/dry-run] phase2_aligned_to_live_phase1_state', {
              smartWallet: smartWallet.toLowerCase(),
              phase1Batcher: phase1Batcher?.toLowerCase() ?? null,
              identity: alignedIdentity
                ? {
                    creatorToken: alignedIdentity.creatorToken.toLowerCase(),
                    owner: alignedIdentity.owner.toLowerCase(),
                    version: alignedIdentity.version,
                  }
                : null,
            })
          }
          phase2CoreCallsForPlan = alignedPhase2CoreCalls
          phase2FinalizeCallsForPlan = alignedPhase2FinalizeCalls
          phaseCalls = phase2CoreCallsForPlan
          phasePlan[2] = { ...phasePlan[2]!, calls: phase2FinalizeCallsForPlan }
          try {
            phaseCalls = await preparePhase2CoreCalls({
              calls: phaseCalls,
              finalizeCalls: phase2FinalizeCallsForPlan,
              getBytecode: (args) => publicClient.getBytecode(args as any),
            })
          } catch (error) {
            const failedCall = phaseEntry.calls.find(isDeployPhase2CoreCall) ?? phaseEntry.calls[0]
            const phase: DryRunPhaseResult = {
              name: phaseEntry.name,
              status: 'failed',
              callCount: 0,
            }
            const phasesWithFailure = [...phases, phase]
            const data: DryRunResponse = {
              ok: false,
              forkMode: forkMode.name,
              phases: phasesWithFailure,
              failure: {
                phase: phaseEntry.name,
                callIndex: 0,
                to: failedCall ? getAddress(failedCall.to) : smartWallet,
                error: formatDryRunError(error),
              },
            }
            return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DryRunResponse>)
          }
          const deployPhase2CoreCount = phaseCalls.filter(isDeployPhase2CoreCall).length
          if (deployPhase2CoreCount > 1) {
            const toSet = Array.from(new Set(phaseCalls.map((call) => String(call.to).toLowerCase())))
            console.warn('[deploy/v2/session/dry-run] phase2_core_duplicate_detected', {
              smartWallet: smartWallet.toLowerCase(),
              deployPhase2CoreCount,
              totalPhase2CoreCalls: phaseCalls.length,
              phase2CoreTargets: toSet,
            })
            const phase: DryRunPhaseResult = {
              name: phaseEntry.name,
              status: 'failed',
              callCount: 0,
            }
            const phasesWithFailure = [...phases, phase]
            const firstCall = phaseCalls.find(isDeployPhase2CoreCall) ?? phaseCalls[0]
            const data: DryRunResponse = {
              ok: false,
              forkMode: forkMode.name,
              phases: phasesWithFailure,
              failure: {
                phase: phaseEntry.name,
                callIndex: 0,
                to: firstCall ? getAddress(firstCall.to) : smartWallet,
                error:
                  `Invalid phase2Core payload: received ${deployPhase2CoreCount} deployPhase2Core calls. ` +
                  'Regenerate a fresh deploy session from the current local UI and retry.',
              },
            }
            return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DryRunResponse>)
          }
          if (phaseEntry.calls.length > 0 && phaseCalls.length === 0) {
            phases.push({
              name: phaseEntry.name,
              status: 'passed',
              callCount: 0,
            })
            continue
          }
        }
        if (phaseCalls.length === 0) continue
        if (phaseEntry.name === 'phase2Finalize') {
          const { phase2FinalizeCalls: alignedFinalizeCalls, rewrote: rewroteFinalizeCoreRefs } =
            await alignPhase2FinalizeToLiveCoreCode({
              phase2FinalizeCalls: phaseCalls,
              getBytecode: (args) => publicClient.getBytecode(args as any),
              getBlockNumber: async () =>
                typeof (publicClient as any).getBlockNumber === 'function'
                  ? await publicClient.getBlockNumber().catch(() => null)
                  : null,
              getLogs: (args) =>
                typeof (publicClient as any).getLogs === 'function'
                  ? ((publicClient as any).getLogs(args as any) as any)
                  : Promise.resolve([]),
            })
          if (rewroteFinalizeCoreRefs) {
            console.warn('[deploy/v2/session/dry-run] phase2_finalize_core_refs_rewritten_from_live_code', {
              smartWallet: smartWallet.toLowerCase(),
            })
          }
          const { phase2FinalizeCalls: simulationAlignedFinalizeCalls, rewrote: rewroteFinalizeFromSimulation } =
            await alignPhase2FinalizeFromSimulation({
              phase2FinalizeCalls: alignedFinalizeCalls,
              account: smartWallet,
              simulateCall: (args) => publicClient.call({ ...args, chain: base } as any),
              getBlockNumber: async () =>
                typeof (publicClient as any).getBlockNumber === 'function'
                  ? await publicClient.getBlockNumber().catch(() => null)
                  : null,
              getLogs: (args) =>
                typeof (publicClient as any).getLogs === 'function'
                  ? ((publicClient as any).getLogs(args as any) as any)
                  : Promise.resolve([]),
            })
          if (rewroteFinalizeFromSimulation) {
            console.warn('[deploy/v2/session/dry-run] phase2_finalize_rewritten_from_simulation_recovery', {
              smartWallet: smartWallet.toLowerCase(),
            })
          }
          phaseCalls = simulationAlignedFinalizeCalls
        }
        if (phaseEntry.name === 'phase4') {
          const { phase4Calls: alignedPhase4Calls, rewrote: rewrotePhase4PendingShare } =
            await alignPhase4LaunchToPendingAuctionState({
              phase4Calls: phaseCalls,
              readContract: (args) => publicClient.readContract(args as any),
            })
          if (rewrotePhase4PendingShare) {
            console.warn('[deploy/v2/session/dry-run] phase4_launch_share_rewritten_to_pending_auction', {
              smartWallet: smartWallet.toLowerCase(),
            })
          }
          const { phase4Calls: raiseAlignedPhase4Calls, rewrote: rewrotePhase4RaiseHint } =
            await alignPhase4RequiredRaiseFromSimulation({
              phase4Calls: alignedPhase4Calls,
              account: smartWallet,
              simulateCall: (args) => publicClient.call({ ...args, chain: base } as any),
            })
          if (rewrotePhase4RaiseHint) {
            console.warn('[deploy/v2/session/dry-run] phase4_launch_required_raise_rewritten_from_revert_hint', {
              smartWallet: smartWallet.toLowerCase(),
            })
          }
          phaseCalls = raiseAlignedPhase4Calls
        }
        const phaseStartBlock =
          typeof (publicClient as any).getBlockNumber === 'function'
            ? await publicClient.getBlockNumber().catch(() => null)
            : null
        const result = await runDryRunPhase({
          name: phaseEntry.name,
          calls: phaseCalls,
          smartWallet,
          ensureImpersonated: () =>
            refreshForkImpersonation({
              request: forkRequest,
              smartWallet,
              mode: forkMode,
            }),
          sendTransaction: (args) => walletClient.sendTransaction({ ...args, chain: base } as any),
          waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args as any),
          simulateCall: (args) => publicClient.call({ ...args, chain: base } as any),
          estimateGas: (args) => publicClient.estimateGas({ ...args, chain: base } as any),
          getLogs: (args) =>
            typeof (publicClient as any).getLogs === 'function'
              ? ((publicClient as any).getLogs(args as any) as any)
              : Promise.resolve([]),
          getBlockNumber: async () =>
            typeof (publicClient as any).getBlockNumber === 'function'
              ? await publicClient.getBlockNumber().catch(() => null)
              : null,
          allowLocalForkPhase4InvariantSkip: isLocalFork,
        })
        phases.push(result.phase)
        if (result.failure) {
          const data: DryRunResponse = {
            ok: false,
            forkMode: forkMode.name,
            phases,
            failure: result.failure,
          }
          return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DryRunResponse>)
        }
        if (phaseEntry.name === 'phase2Core' && result.phase.status === 'passed' && phase2FinalizeCallsForPlan.length > 0) {
          const phaseEndBlock =
            typeof (publicClient as any).getBlockNumber === 'function'
              ? await publicClient.getBlockNumber().catch(() => null)
              : null
          if (phaseStartBlock !== null && phaseEndBlock !== null && phaseEndBlock >= phaseStartBlock) {
            const { phase2FinalizeCalls: eventAlignedFinalizeCalls, rewrote: rewroteFromCoreEvent } =
              await alignPhase2FinalizeToCoreDeploymentEvent({
                phase2CoreCalls: phaseCalls,
                phase2FinalizeCalls: phase2FinalizeCallsForPlan,
                getLogs: (args) =>
                  typeof (publicClient as any).getLogs === 'function'
                    ? ((publicClient as any).getLogs(args as any) as any)
                    : Promise.resolve([]),
                fromBlock: phaseStartBlock,
                toBlock: phaseEndBlock,
              })
            if (rewroteFromCoreEvent) {
              console.warn('[deploy/v2/session/dry-run] phase2_finalize_rewritten_from_core_event', {
                smartWallet: smartWallet.toLowerCase(),
                fromBlock: phaseStartBlock.toString(),
                toBlock: phaseEndBlock.toString(),
              })
              phase2FinalizeCallsForPlan = eventAlignedFinalizeCalls
              phasePlan[2] = { ...phasePlan[2]!, calls: phase2FinalizeCallsForPlan }
            }
          }
        }
      }

      const data: DryRunResponse = {
        ok: true,
        forkMode: forkMode.name,
        phases,
      }
      return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DryRunResponse>)
    } finally {
      await revertForkState({
        request: forkRequest,
        snapshotId,
      })
    }
  } catch (error) {
    if (error instanceof DeploySessionRequestError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    return res.status(500).json({
      success: false,
      error: formatDryRunError(error),
    } satisfies ApiEnvelope<null>)
  }
}
