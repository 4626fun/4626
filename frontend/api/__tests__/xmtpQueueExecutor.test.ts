import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from './helpers'

const VAULT = '0x1111111111111111111111111111111111111111'
const AUTH = '0x2222222222222222222222222222222222222222'
const KEEPER = '0x3333333333333333333333333333333333333333'
const OTHER_ADMIN = '0x4444444444444444444444444444444444444444'
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

let currentAjnaAdmin = OTHER_ADMIN

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  ensureKeeprSchema: vi.fn(async () => {}),
  ensureCreatorXmtpAgentsSchema: vi.fn(async () => {}),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
  privateKeyToAccount: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@xmtp/agent-sdk', () => ({
  Agent: class {
    static async create() {
      throw new Error('Agent.create should not be called for strategy actions')
    }
  },
  createSigner: vi.fn(),
  createUser: vi.fn(),
  getInstallationInfo: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: vi.fn(async () => ({
    sql: mocks.sql,
  })),
}))

vi.mock('../../server/_lib/logger.js', () => ({
  logger: mocks.logger,
}))

vi.mock('../../server/_lib/xmtpDbDirectory.js', () => ({
  resolveXmtpDbDirectory: vi.fn(() => '/tmp/keepr-xmtp-tests'),
}))

vi.mock('../../server/_lib/creatorXmtpAgents.js', () => ({
  decryptPrivateKey: vi.fn(),
  ensureCreatorXmtpAgentsSchema: mocks.ensureCreatorXmtpAgentsSchema,
}))

vi.mock('../../server/_lib/privyXmtpSigner.js', () => ({
  createPrivyScwSigner: vi.fn(),
}))

vi.mock('../../server/_lib/keeprSchema.js', () => ({
  ensureKeeprSchema: mocks.ensureKeeprSchema,
}))

vi.mock('../../server/_lib/charmVaults.js', () => ({
  isOfficialCharmVault: vi.fn(async () => true),
  officialCharmVaultError: vi.fn((vault: string) => `not_official:${vault}`),
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: mocks.privateKeyToAccount,
}))

vi.mock('viem/account-abstraction', () => ({
  createBundlerClient: vi.fn(),
  createPaymasterClient: vi.fn(),
  sendUserOperation: vi.fn(),
  toCoinbaseSmartAccount: vi.fn(),
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContract,
      waitForTransactionReceipt: mocks.waitForTransactionReceipt,
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: mocks.writeContract,
    })),
  }
})

import { executeKeeprAction } from '../../server/keepr/xmtpQueueExecutor.ts'

describe('xmtp queue executor Ajna rebucket auth-admin guard', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      BASE_RPC_URL: 'https://base-rpc.example',
      KEEPR_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
    })
    currentAjnaAdmin = OTHER_ADMIN

    mocks.privateKeyToAccount.mockReturnValue({
      address: KEEPER,
    })
    mocks.sql.mockResolvedValue({
      rows: [
        {
          vault_address: VAULT,
          group_id: 'group-1',
          canonical_owner_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          creator_address: null,
          agent_type: null,
          privy_wallet_id: null,
          csw_address: null,
          encrypted_private_key_b64: null,
          encrypted_private_key_iv_b64: null,
          encrypted_private_key_tag_b64: null,
        },
      ],
    })
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'admin') return currentAjnaAdmin
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })
    mocks.writeContract.mockResolvedValue(TX_HASH)
    mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success' })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('fails fast as non-retryable when the keeper is not the current Ajna auth admin', async () => {
    const result = await executeKeeprAction({
      id: 1,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'strategy.ajna.rebucket',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: AUTH,
        targetBucket: 1200,
      },
    })

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.error).toContain('ajna_auth_admin_mismatch')
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUTH,
        functionName: 'admin',
      }),
    )
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range Ajna target bucket before any chain execution', async () => {
    currentAjnaAdmin = KEEPER

    const result = await executeKeeprAction({
      id: 3,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'strategy.ajna.rebucket',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: AUTH,
        targetBucket: 7389,
      },
    })

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.error).toContain('targetBucket must be between 0 and 7388')
    expect(mocks.readContract).not.toHaveBeenCalled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('keeps the direct path working when the keeper is the current Ajna auth admin', async () => {
    currentAjnaAdmin = KEEPER

    const result = await executeKeeprAction({
      id: 2,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'strategy.ajna.rebucket',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: AUTH,
        targetBucket: 0,
      },
    })

    expect(result).toEqual({
      success: true,
      retryable: false,
      actionType: 'strategy.ajna.rebucket',
      details: {
        txHash: TX_HASH,
        strategyAddress: null,
        authAddress: AUTH,
        targetAddress: AUTH,
        method: 'setMinBucketIndex',
        targetBucket: '0',
      },
    })
    expect(mocks.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUTH,
        functionName: 'admin',
      }),
    )
    expect(mocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUTH,
        functionName: 'setMinBucketIndex',
        args: [0n],
      }),
    )
  })
})
