import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, createWalletClient, getAddress, http, type Address, type Hex } from 'viem'
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
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Dry-run simulation failed'
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

async function stopForkImpersonation(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  smartWallet: Address
  mode: ForkRpcMode
}): Promise<void> {
  try {
    await params.request({
      method: params.mode.stopMethod,
      params: [params.smartWallet],
    })
  } catch {
    // best-effort cleanup for local forks
  }
}

async function runDryRunPhase(params: {
  name: DryRunPhaseName
  calls: Call[]
  smartWallet: Address
  sendTransaction: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<Hex>
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status?: string }>
  simulateCall: (args: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>
}): Promise<{ phase: DryRunPhaseResult; failure?: DryRunFailure }> {
  for (let callIndex = 0; callIndex < params.calls.length; callIndex += 1) {
    const call = params.calls[callIndex]!
    const to = getAddress(call.to)
    const value = callValueToBigInt(call.value)
    try {
      const hash = await params.sendTransaction({
        account: params.smartWallet,
        to,
        data: call.data,
        value,
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

    const forkMode = await enableForkImpersonation({
      request: (args) => walletClient.request(args as any),
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
        if (phaseEntry.calls.length === 0) continue
        const result = await runDryRunPhase({
          name: phaseEntry.name,
          calls: phaseEntry.calls,
          smartWallet,
          sendTransaction: (args) => walletClient.sendTransaction({ ...args, chain: base } as any),
          waitForTransactionReceipt: (args) => publicClient.waitForTransactionReceipt(args as any),
          simulateCall: (args) => publicClient.call({ ...args, chain: base } as any),
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
      await stopForkImpersonation({
        request: (args) => walletClient.request(args as any),
        smartWallet,
        mode: forkMode,
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
