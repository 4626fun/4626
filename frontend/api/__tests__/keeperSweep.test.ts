import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keeper/_sweep.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  createPublicClientMock,
  createWalletClientMock,
  privateKeyToAccountMock,
  settleVaultMock,
  validateKeeperVaultListingMock,
} = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
  settleVaultMock: vi.fn(),
  validateKeeperVaultListingMock: vi.fn(),
}))

vi.mock('../../server/_lib/controlPlane/vaultControlPlane.js', () => ({
  createVaultControlPlane: () => ({
    settleVault: settleVaultMock,
  }),
}))

vi.mock('../../server/_lib/onchain/registry4626Verification.js', () => ({
  validateKeeperVaultListing: validateKeeperVaultListingMock,
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
const SAFE_OWNER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const VAULT = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
const SWEEP_UNSOLD_HASH = '0x9999999999999999999999999999999999999999999999999999999999999999' as const

/** Shared on-chain mocks for completion + M2-03 production-readiness gates. */
function createInvariantPublicClient(opts?: {
  burnStream?: `0x${string}`
  payoutRouterOwner?: `0x${string}`
  boostTimelockArmed?: boolean
  ownerIsContract?: boolean
}) {
  const burnStream = opts?.burnStream ?? ACTUAL_BURN_STREAM
  const owner = opts?.payoutRouterOwner ?? SAFE_OWNER
  const armed = opts?.boostTimelockArmed !== false
  const ownerIsContract = opts?.ownerIsContract !== false
  return {
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
          return burnStream
        case 'owner':
          return owner
        case 'getThreshold':
          return 2n
        case 'getMinDelay':
          return 0n
        // harvest readiness path
        case 'wrapper':
          return '0xcccccccccccccccccccccccccccccccccccccccc'
        case 'isWhitelisted':
          return true
        case 'shareOFT':
          return SHARE_OFT
        case 'addressType':
          return 2 // NoFees
        case 'keeper':
          return SAFE_OWNER
        case 'authorizedQueuers':
          return true
        case 'swapPathToShareOFT':
          return '0x'
        case 'weth':
          return '0x0000000000000000000000000000000000000000'
        case 'authorizedHubShareOftForwarders':
          return true
        case 'getTaxHookCalldata':
          return [GAUGE, '0x12345678']
        default:
          throw new Error(`Unexpected read ${String(args.functionName)}`)
      }
    }),
    getBytecode: vi.fn(async ({ address }: { address: string }) =>
      ownerIsContract && address.toLowerCase() === owner.toLowerCase() ? '0x6000' : '0x',
    ),
    getStorageAt: vi.fn(async () =>
      armed
        ? ('0x0000000000000000000000000000000000000000000000000000000000000001' as const)
        : ('0x0000000000000000000000000000000000000000000000000000000000000000' as const),
    ),
    waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
    getBlockNumber: vi.fn(async () => 200n),
  }
}

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

describe('keeper sweep handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    privateKeyToAccountMock.mockReturnValue({ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
    settleVaultMock.mockResolvedValue({ accepted: true, operationId: 'op_settle_1' })
    validateKeeperVaultListingMock.mockResolvedValue({ ok: true, mode: 'registry' })
  })

  it('returns completion_invariant_failed when completion wiring mismatches expected router mode', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const publicClient = createInvariantPublicClient({ burnStream: ACTUAL_BURN_STREAM })
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
          ccaLaunchArmAddress: STRATEGY,
          attemptHookConfig: false,
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
      expect(res.body?.data?.invariantChecksRun).toBeGreaterThanOrEqual(6)
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

  it('blocks completion when PayoutRouter owner is a hot EOA (M2-03 / H-07)', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const eoaOwner = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
      const publicClient = createInvariantPublicClient({
        burnStream: EXPECTED_BURN_STREAM,
        payoutRouterOwner: eoaOwner,
        ownerIsContract: false,
        boostTimelockArmed: true,
      })
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
          ccaLaunchArmAddress: STRATEGY,
          attemptHookConfig: false,
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

      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('completion_invariant_failed')
      expect(res.body?.data?.invariantViolations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'payout_router_owner_is_eoa' }),
        ]),
      )
    } finally {
      restoreEnv()
    }
  })

  it('blocks completion when lottery boost timelock is unarmed (M2-03 / M-15)', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const publicClient = createInvariantPublicClient({
        burnStream: EXPECTED_BURN_STREAM,
        boostTimelockArmed: false,
      })
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
          ccaLaunchArmAddress: STRATEGY,
          attemptHookConfig: false,
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

      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('completion_invariant_failed')
      expect(res.body?.data?.invariantViolations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'lottery_boost_timelock_not_armed' }),
        ]),
      )
    } finally {
      restoreEnv()
    }
  })

  it('ignores per-request enforceInvariants:false — invariants still run (audit H2-05)', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      const publicClient = createInvariantPublicClient({ burnStream: ACTUAL_BURN_STREAM })
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
          ccaLaunchArmAddress: STRATEGY,
          attemptHookConfig: false,
          // Attempted per-request bypass — must be ignored.
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
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('completion_invariant_failed')
      expect(res.body?.data?.completionStage).toBe('invariant_failed')
      expect(res.body?.data?.invariantsEnforced).toBe(true)
      expect(res.body?.data?.invariantChecksRun).toBeGreaterThan(0)
    } finally {
      restoreEnv()
    }
  })

  it('skips invariant evaluation only via the env emergency override', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'false',
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
          ccaLaunchArmAddress: STRATEGY,
          attemptHookConfig: false,
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

  it('blocks markSettled when the invariant creator coin is not bound to that vault listing', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'true',
      KEEPER_HOOK_CONFIG_STRATEGY_ALLOWLIST: STRATEGY,
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      validateKeeperVaultListingMock.mockResolvedValueOnce({ ok: false, reason: 'vault_mismatch' })
      const publicClient = createInvariantPublicClient({ burnStream: EXPECTED_BURN_STREAM })
      const walletClient = {
        writeContract: vi.fn(async () => SWEEP_UNSOLD_HASH),
        sendTransaction: vi.fn(async () => SWEEP_UNSOLD_HASH),
      }
      createPublicClientMock.mockReturnValue(publicClient as any)
      createWalletClientMock.mockReturnValue(walletClient as any)

      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-key' },
        body: {
          ccaLaunchArmAddress: STRATEGY,
          markSettled: { vaultAddress: VAULT },
          invariants: {
            creatorCoinAddress: CREATOR_COIN,
            shareTokenAddress: SHARE_OFT,
            gaugeControllerAddress: GAUGE,
            burnStreamAddress: EXPECTED_BURN_STREAM,
            payoutRouterAddress: PAYOUT_ROUTER,
            payoutRecipientMode: 'payout_router',
            vaultAddress: VAULT,
          },
        },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(409)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('settlement_vault_binding_vault_mismatch')
      expect(validateKeeperVaultListingMock).toHaveBeenCalledWith({
        creatorCoinAddress: CREATOR_COIN,
        vaultAddress: VAULT,
        shareTokenAddress: SHARE_OFT,
      })
      expect(settleVaultMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('returns a stable generic code without exposing raw RPC errors', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-key',
      KPR_PRIVATE_KEY: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      KEEPER_ENABLE_HOOK_CONFIG: 'false',
      KEEPER_ENFORCE_COMPLETION_INVARIANTS: 'true',
      BASE_RPC_URL: 'https://mainnet.base.org',
    })
    try {
      createPublicClientMock.mockReturnValue({
        readContract: vi.fn(async () => {
          throw new Error('RPC endpoint https://secret.invalid rejected private payload')
        }),
      } as any)
      createWalletClientMock.mockReturnValue({ writeContract: vi.fn() } as any)

      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-key' },
        body: { ccaLaunchArmAddress: STRATEGY },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        success: false,
        error: 'keeper_sweep_failed',
      })
      expect(JSON.stringify(res.body)).not.toContain('secret.invalid')
    } finally {
      restoreEnv()
    }
  })
})
