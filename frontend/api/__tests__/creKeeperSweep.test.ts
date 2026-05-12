import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keeper/_sweep.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  createPublicClientMock,
  createWalletClientMock,
  privateKeyToAccountMock,
} = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    createWalletClient: createWalletClientMock,
    http: vi.fn(() => ({})),
  }
})

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: privateKeyToAccountMock,
}))

const STRATEGY = '0x1111111111111111111111111111111111111111' as const
const CREATOR_COIN = '0x2222222222222222222222222222222222222222' as const
const SHARE_OFT = '0x3333333333333333333333333333333333333333' as const
const GAUGE = '0x4444444444444444444444444444444444444444' as const
const PAYOUT_ROUTER = '0x5555555555555555555555555555555555555555' as const
const EXPECTED_BURN_STREAM = '0x6666666666666666666666666666666666666666' as const
const ACTUAL_BURN_STREAM = '0x7777777777777777777777777777777777777777' as const
const CREATOR_TREASURY = '0x8888888888888888888888888888888888888888' as const
const SWEEP_UNSOLD_HASH = '0x9999999999999999999999999999999999999999999999999999999999999999' as const

function createLifecycle(overrides?: Partial<{
  phase: number
  currencySwept: boolean
  migrated: boolean
  migrationBlock: bigint
}>) {
  return {
    phase: overrides?.phase ?? 4,
    currencySwept: overrides?.currencySwept ?? true,
    migrated: overrides?.migrated ?? true,
    migrationBlock: overrides?.migrationBlock ?? 100n,
  }
}

describe('cre keeper sweep handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    privateKeyToAccountMock.mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
  })

  it('returns completion_invariant_failed when completion wiring mismatches expected router mode', async () => {
    const restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-key',
      KEEPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const publicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'getLifecycleStatus':
              return createLifecycle()
            case 'feeRecipient':
              return GAUGE
            case 'payoutRecipient':
              return PAYOUT_ROUTER
            case 'gaugeController':
              return GAUGE
            case 'creatorShareBps':
              return 0n
            case 'creatorTreasury':
              return CREATOR_TREASURY
            case 'burnStream':
              return ACTUAL_BURN_STREAM
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
        getBlockNumber: vi.fn(async () => 200n),
      }
      const walletClient = {
        writeContract: vi.fn(async () => SWEEP_UNSOLD_HASH),
        sendTransaction: vi.fn(),
      }
      createPublicClientMock.mockReturnValue(publicClient as any)
      createWalletClientMock.mockReturnValue(walletClient as any)

      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-key' },
        body: {
          ccaStrategyAddress: STRATEGY,
          attemptHookConfig: false,
          enforceInvariants: true,
          invariants: {
            creatorCoinAddress: CREATOR_COIN,
            shareTokenAddress: SHARE_OFT,
            gaugeControllerAddress: GAUGE,
            burnStreamAddress: EXPECTED_BURN_STREAM,
            payoutRouterAddress: PAYOUT_ROUTER,
            payoutRecipientMode: 'payout_router',
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('completion_invariant_failed')
      expect(res.body?.data?.completionStage).toBe('invariant_failed')
      expect(res.body?.data?.invariantsEnforced).toBe(true)
      expect(res.body?.data?.invariantChecksRun).toBe(6)
      expect(res.body?.data?.invariantViolations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'router_burn_stream_mismatch',
            expected: EXPECTED_BURN_STREAM,
            actual: ACTUAL_BURN_STREAM,
          }),
        ]),
      )
      expect(walletClient.writeContract).toHaveBeenCalledTimes(1)
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: STRATEGY,
          functionName: 'sweepUnsoldTokens',
        }),
      )
    } finally {
      restoreEnv()
    }
  })

  it('skips invariant evaluation entirely when invariant enforcement is disabled', async () => {
    const restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-key',
      KEEPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const publicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'getLifecycleStatus':
              return createLifecycle()
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
        getBlockNumber: vi.fn(async () => 200n),
      }
      const walletClient = {
        writeContract: vi.fn(async () => SWEEP_UNSOLD_HASH),
        sendTransaction: vi.fn(),
      }
      createPublicClientMock.mockReturnValue(publicClient as any)
      createWalletClientMock.mockReturnValue(walletClient as any)

      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-key' },
        body: {
          ccaStrategyAddress: STRATEGY,
          attemptHookConfig: false,
          enforceInvariants: false,
          invariants: {
            creatorCoinAddress: CREATOR_COIN,
            shareTokenAddress: SHARE_OFT,
            gaugeControllerAddress: GAUGE,
            burnStreamAddress: EXPECTED_BURN_STREAM,
            payoutRouterAddress: PAYOUT_ROUTER,
            payoutRecipientMode: 'payout_router',
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.completionStage).toBe('awaiting_owner_hook_config')
      expect(res.body?.data?.invariantsEnforced).toBe(false)
      expect(res.body?.data?.invariantChecksRun).toBe(0)
      expect(res.body?.data?.invariantViolations).toEqual([])
      expect(publicClient.readContract).toHaveBeenCalledTimes(1)
      expect(walletClient.writeContract).toHaveBeenCalledTimes(1)
    } finally {
      restoreEnv()
    }
  })
})
