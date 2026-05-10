import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

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
  status: 'passed' | 'failed'
  callCount: number
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

function isLocalForkRpcUrl(rpcUrl: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(rpcUrl.trim())
}

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
}): Promise<{ phase: DryRunPhaseResult; failure?: DryRunFailure }> {
  for (let callIndex = 0; callIndex < params.calls.length; callIndex += 1) {
    const call = params.calls[callIndex]!
    const to = getAddress(call.to)
    const value = callValueToBigInt(call.value)
    try {
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
      let hash: Hex
      try {
        hash = await params.sendTransaction({
          account: params.smartWallet,
          to,
          data: call.data,
          value,
          gas,
        })
      } catch (sendError) {
        const formatted = formatDryRunError(sendError)
        if (!/No Signer available/i.test(formatted)) {
          throw sendError
        }
        await params.ensureImpersonated()
        hash = await params.sendTransaction({
          account: params.smartWallet,
          to,
          data: call.data,
          value,
          gas,
        })
      }
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
    } catch (error) {
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
          error: formatDryRunError(error),
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
  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
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
      const {
        phase2CoreCalls: normalizedPhase2CoreCalls,
        phase2FinalizeCalls: normalizedPhase2FinalizeCalls,
        rewrote: rewrotePhase2Identity,
      } = normalizePhase2IdentityToPhase1({
        phase2CoreCalls: targetNormalizedPhase2CoreCalls,
        phase2FinalizeCalls: targetNormalizedPhase2FinalizeCalls,
        identity: phase1Identity,
      })
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
      const phasePlan: Array<{ name: DryRunPhaseName; calls: Call[] }> = [
        { name: 'phase1', calls: phase1Calls },
        { name: 'phase2Core', calls: normalizedPhase2CoreCalls },
        { name: 'phase2Finalize', calls: normalizedPhase2FinalizeCalls },
        { name: 'phase3', calls: phase3Calls },
        { name: 'phase4', calls: phase4Calls },
      ]

      for (const phaseEntry of phasePlan) {
        let phaseCalls = phaseEntry.calls
        if (phaseEntry.name === 'phase2Core') {
          try {
            phaseCalls = await preparePhase2CoreCalls({
              calls: phaseEntry.calls,
              finalizeCalls: normalizedPhase2FinalizeCalls,
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
