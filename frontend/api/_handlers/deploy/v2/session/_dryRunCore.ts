import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
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
      'for the required 50,000,000-token initial deposit.'
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
      'for the required 50,000,000-token initial deposit.'
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
  if (!params.calls.some(isDeployPhase2CoreCall)) return params.calls
  const addresses = extractFinalizePhase2CoreAddresses(params.finalizeCalls)
  if (!addresses) return params.calls

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
    return params.calls.filter((call) => !isDeployPhase2CoreCall(call))
  }
  if (anyDeployed) {
    const state = entries.map(([label], index) => `${label}=${deployed[index] ? 'deployed' : 'missing'}`).join(', ')
    throw new Error(
      `Phase 2 core is partially deployed on the local fork (${state}). ` +
        'Reset the fork or bump the deployment version before retrying dry-run.',
    )
  }
  return params.calls
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
      const phasePlan: Array<{ name: DryRunPhaseName; calls: Call[] }> = [
        { name: 'phase1', calls: phase1Calls },
        { name: 'phase2Core', calls: phase2CoreCalls },
        { name: 'phase2Finalize', calls: phase2FinalizeCalls },
        { name: 'phase3', calls: phase3Calls },
        { name: 'phase4', calls: phase4Calls },
      ]

      for (const phaseEntry of phasePlan) {
        let phaseCalls = phaseEntry.calls
        if (phaseEntry.name === 'phase2Core') {
          try {
            phaseCalls = await preparePhase2CoreCalls({
              calls: phaseEntry.calls,
              finalizeCalls: phase2FinalizeCalls,
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
