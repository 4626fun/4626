import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from './helpers'

const VAULT = '0x1111111111111111111111111111111111111111'
const AUTH = '0x2222222222222222222222222222222222222222'
const CANONICAL_CSW = '0x3333333333333333333333333333333333333333'
const OTHER_ADMIN = '0x4444444444444444444444444444444444444444'
const EMBEDDED_EOA = '0x5555555555555555555555555555555555555555'
const PRIVY_WALLET_ID = 'wallet-ajna-owner'
const USER_OP_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TX_HASH = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function buildAutomationRow(overrides: Record<string, unknown> = {}) {
  return {
    vaultAddress: VAULT,
    profileId: 42,
    canonicalCswAddress: CANONICAL_CSW,
    embeddedEoaAddress: EMBEDDED_EOA,
    privyWalletId: PRIVY_WALLET_ID,
    authorizationSource: 'owner_session',
    automationEnabled: true,
    automationScope: 'ajna_min_bucket_only',
    lastOwnerCheckAt: '2026-03-10T11:00:00.000Z',
    revokedAt: null,
    metadata: {},
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T11:00:00.000Z',
    ...overrides,
  }
}

function buildHelperError(code: string, retryable: boolean, message?: string) {
  return Object.assign(new Error(message ?? code), { code, retryable })
}

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sql: vi.fn(),
  AgentCreate: vi.fn(),
  decryptPrivateKey: vi.fn(),
  ensureKeeprSchema: vi.fn(async () => {}),
  ensureCreatorXmtpAgentsSchema: vi.fn(async () => {}),
  createPrivyScwSigner: vi.fn(),
  getKeeprVaultAutomationByVaultAddress: vi.fn(),
  findCoinbaseSmartWalletOwnerIndex: vi.fn(),
  sendCoinbaseSmartWalletUserOperation: vi.fn(),
  resolvePrivyCoinbaseSmartWalletOwnerContext: vi.fn(),
  sendPrivyCoinbaseSmartWalletUserOperation: vi.fn(),
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
    static async create(...args: unknown[]) {
      return mocks.AgentCreate(...args)
    }
  },
  createSigner: vi.fn(),
  createUser: vi.fn(),
  getInstallationInfo: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: mocks.getDb,
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: mocks.logger,
}))

vi.mock('../../server/_lib/messaging/xmtpDbDirectory.js', () => ({
  resolveXmtpDbDirectory: vi.fn(() => '/tmp/keepr-xmtp-tests'),
}))

vi.mock('../../server/_lib/messaging/creatorXmtpAgents.js', () => ({
  decryptPrivateKey: mocks.decryptPrivateKey,
  ensureCreatorXmtpAgentsSchema: mocks.ensureCreatorXmtpAgentsSchema,
}))

vi.mock('../../server/_lib/wallet/privyXmtpSigner.js', () => ({
  createPrivyScwSigner: mocks.createPrivyScwSigner,
}))

vi.mock('../../server/_lib/keepr/keeprAutomation.js', () => ({
  getKeeprVaultAutomationByVaultAddress: mocks.getKeeprVaultAutomationByVaultAddress,
}))

vi.mock('../../server/_lib/wallet/privyCoinbaseSmartWallet.js', () => ({
  findCoinbaseSmartWalletOwnerIndex: mocks.findCoinbaseSmartWalletOwnerIndex,
  sendCoinbaseSmartWalletUserOperation: mocks.sendCoinbaseSmartWalletUserOperation,
  resolvePrivyCoinbaseSmartWalletOwnerContext: mocks.resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation: mocks.sendPrivyCoinbaseSmartWalletUserOperation,
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: mocks.ensureKeeprSchema,
}))

vi.mock('../../server/_lib/deploy/charmVaults.js', () => ({
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

describe('xmtp queue executor Ajna canonical automation', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      BASE_RPC_URL: 'https://base-rpc.example',
      KEEPR_PRIVATE_KEY: undefined,
      CDP_PAYMASTER_URL: 'https://paymaster.example',
      XMTP_AGENT_CSW_OWNER_INDEX: undefined,
    })
    mocks.AgentCreate.mockRejectedValue(new Error('Agent.create should not be called for strategy actions'))
    mocks.decryptPrivateKey.mockReturnValue(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    )
    mocks.createPrivyScwSigner.mockReturnValue({
      type: 'SCW',
      getIdentifier: vi.fn(() => ({
        identifier: CANONICAL_CSW,
        identifierKind: 0,
      })),
      signMessage: vi.fn(),
      getChainId: vi.fn(() => 8453n),
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
    mocks.getDb.mockResolvedValue({
      sql: mocks.sql,
    })
    mocks.getKeeprVaultAutomationByVaultAddress.mockResolvedValue(buildAutomationRow())
    mocks.resolvePrivyCoinbaseSmartWalletOwnerContext.mockResolvedValue({
      ownerAddress: EMBEDDED_EOA,
      ownerIndex: 4,
    })
    mocks.sendPrivyCoinbaseSmartWalletUserOperation.mockResolvedValue({
      userOpHash: USER_OP_HASH,
      txHash: TX_HASH,
      smartWallet: CANONICAL_CSW,
      ownerAddress: EMBEDDED_EOA,
      ownerIndex: 4,
    })
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'admin') return CANONICAL_CSW
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })
    mocks.writeContract.mockResolvedValue(TX_HASH)
    mocks.waitForTransactionReceipt.mockResolvedValue({ status: 'success' })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('rejects an out-of-range Ajna target bucket before any chain execution', async () => {
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
    expect(mocks.getKeeprVaultAutomationByVaultAddress).not.toHaveBeenCalled()
    expect(mocks.readContract).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('fails closed when Ajna automation context is missing', async () => {
    mocks.getKeeprVaultAutomationByVaultAddress.mockResolvedValueOnce(null)

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
    expect(result.error).toBe('ajna_automation_context_missing')
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
    expect(mocks.privateKeyToAccount).not.toHaveBeenCalled()
  })

  it('treats Ajna null automation context as retryable when the backend is unavailable', async () => {
    mocks.getKeeprVaultAutomationByVaultAddress.mockResolvedValueOnce(null)
    mocks.getDb
      .mockResolvedValueOnce({
        sql: mocks.sql,
      })
      .mockResolvedValueOnce(null)

    const result = await executeKeeprAction({
      id: 13,
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
    expect(result.retryable).toBe(true)
    expect(result.error).toBe('ajna_automation_backend_unavailable')
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
    expect(mocks.readContract).not.toHaveBeenCalled()
  })

  it('fails closed when Ajna embedded signer context is missing', async () => {
    mocks.getKeeprVaultAutomationByVaultAddress.mockResolvedValueOnce(
      buildAutomationRow({ embeddedEoaAddress: null }),
    )

    const result = await executeKeeprAction({
      id: 7,
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
    expect(result.error).toBe('ajna_automation_context_missing')
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it.each([
    ['disabled', buildAutomationRow({ automationEnabled: false }), 'ajna_automation_disabled'],
    ['revoked', buildAutomationRow({ revokedAt: '2026-03-10T12:00:00.000Z' }), 'ajna_automation_disabled'],
    ['scope mismatch', buildAutomationRow({ automationScope: 'vault' }), 'ajna_automation_scope_invalid'],
  ])('fails closed when Ajna automation context is %s', async (_label, row, expectedError) => {
    mocks.getKeeprVaultAutomationByVaultAddress.mockResolvedValueOnce(row)

    const result = await executeKeeprAction({
      id: 4,
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
    expect(result.error).toBe(expectedError)
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('fails fast as non-retryable when Ajna auth admin is not the canonical CSW', async () => {
    mocks.readContract.mockImplementationOnce(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'admin') return OTHER_ADMIN
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })

    const result = await executeKeeprAction({
      id: 5,
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
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('fails closed when Ajna auth admin cannot be decoded as an address', async () => {
    mocks.readContract.mockImplementationOnce(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'admin') return '0xownerbytes'
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })

    const result = await executeKeeprAction({
      id: 14,
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
    expect(result.error).toBe('ajna_auth_admin_unreadable')
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('keeps Ajna auth admin RPC read failures retryable when the transport is flaky', async () => {
    mocks.readContract.mockImplementationOnce(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'admin') throw new Error('RPC timeout while reading admin')
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })

    const result = await executeKeeprAction({
      id: 15,
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
    expect(result.retryable).toBe(true)
    expect(result.error).toContain('ajna_auth_admin_read_failed:')
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).not.toHaveBeenCalled()
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('fails closed when owner revalidation fails before sending the UserOp', async () => {
    mocks.resolvePrivyCoinbaseSmartWalletOwnerContext.mockRejectedValueOnce(new Error('stored_owner_mismatch'))

    const result = await executeKeeprAction({
      id: 6,
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
    expect(result.error).toContain('ajna_owner_revalidation_failed:stored_owner_mismatch')
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('keeps transient owner revalidation failures retryable', async () => {
    mocks.resolvePrivyCoinbaseSmartWalletOwnerContext.mockRejectedValueOnce(
      buildHelperError('privy_wallet_lookup_failed', true, 'network timeout'),
    )

    const result = await executeKeeprAction({
      id: 8,
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
    expect(result.retryable).toBe(true)
    expect(result.error).toBe('ajna_owner_revalidation_failed:privy_wallet_lookup_failed')
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
  })

  it('treats helper userOp receipt contract failures consistently as retryable on Ajna', async () => {
    mocks.sendPrivyCoinbaseSmartWalletUserOperation.mockRejectedValueOnce(
      buildHelperError('userop_transaction_hash_missing', true),
    )

    const result = await executeKeeprAction({
      id: 9,
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
    expect(result.retryable).toBe(true)
    expect(result.error).toBe('ajna_userop_failed:userop_transaction_hash_missing')
  })

  it('submits Ajna rebucket from the canonical CSW via a Privy-backed UserOp', async () => {
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
        userOpHash: USER_OP_HASH,
        sender: CANONICAL_CSW,
        ownerAddress: EMBEDDED_EOA,
        ownerIndex: 4,
        mode: 'erc4337_privy',
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
    expect(mocks.resolvePrivyCoinbaseSmartWalletOwnerContext).toHaveBeenCalledWith({
      publicClient: expect.anything(),
      walletId: PRIVY_WALLET_ID,
      smartWallet: CANONICAL_CSW,
      expectedOwnerAddress: EMBEDDED_EOA,
      maxScan: 512,
    })
    expect(mocks.sendPrivyCoinbaseSmartWalletUserOperation).toHaveBeenCalledWith({
      publicClient: expect.anything(),
      bundlerUrl: 'https://paymaster.example',
      walletId: PRIVY_WALLET_ID,
      smartWallet: CANONICAL_CSW,
      ownerAddress: EMBEDDED_EOA,
      ownerIndex: 4,
      calls: [
        {
          to: AUTH,
          value: 0n,
          data: expect.any(String),
        },
      ],
      simulate: true,
    })
    expect(mocks.privateKeyToAccount).not.toHaveBeenCalled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })

  it('does not pass an ownerIndex hint when XMTP_AGENT_CSW_OWNER_INDEX is unset', async () => {
    mocks.sql.mockResolvedValueOnce({
      rows: [
        {
          vault_address: VAULT,
          group_id: 'group-1',
          canonical_owner_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          creator_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          xmtp_agent_address: CANONICAL_CSW,
          agent_type: 'csw',
          privy_wallet_id: PRIVY_WALLET_ID,
          csw_address: CANONICAL_CSW,
          encrypted_private_key_b64: null,
          encrypted_private_key_iv_b64: null,
          encrypted_private_key_tag_b64: null,
        },
      ],
    })
    mocks.AgentCreate.mockRejectedValueOnce(new Error('agent_init_failed'))

    const result = await executeKeeprAction({
      id: 11,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'xmtp.group.send_message',
      action: {
        action: 'xmtp.group.send_message',
        message: 'hello world',
      },
    })

    expect(result.success).toBe(false)
    expect(result.actionType).toBe('xmtp.group.send_message')
    expect(mocks.createPrivyScwSigner).toHaveBeenCalledTimes(1)
    expect(mocks.createPrivyScwSigner.mock.calls[0]?.[0]).toEqual({
      walletId: PRIVY_WALLET_ID,
      cswAddress: CANONICAL_CSW,
      chainId: 8453,
    })
    expect(mocks.AgentCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dbPath: '/tmp/keepr-xmtp-tests/keepr-production-0x3333333333333333333333333333333333333333.db3',
      }),
    )
  })

  it('keeps preserved XMTP CSW signer helper failures non-retryable', async () => {
    mocks.sql.mockResolvedValueOnce({
      rows: [
        {
          vault_address: VAULT,
          group_id: 'group-1',
          canonical_owner_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          creator_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          agent_type: 'csw',
          privy_wallet_id: PRIVY_WALLET_ID,
          csw_address: CANONICAL_CSW,
          encrypted_private_key_b64: null,
          encrypted_private_key_iv_b64: null,
          encrypted_private_key_tag_b64: null,
        },
      ],
    })
    mocks.AgentCreate.mockRejectedValueOnce(
      buildHelperError('stored_owner_mismatch', false, 'xmtp_owner_index_resolution_failed: stored_owner_mismatch'),
    )

    const result = await executeKeeprAction({
      id: 10,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'xmtp.group.send_message',
      action: {
        action: 'xmtp.group.send_message',
        message: 'hello world',
      },
    })

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
    expect(result.actionType).toBe('xmtp.group.send_message')
    expect(result.error).toContain('stored_owner_mismatch')
    expect(mocks.createPrivyScwSigner).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: PRIVY_WALLET_ID,
        cswAddress: CANONICAL_CSW,
        chainId: 8453,
      }),
    )
  })

  it('keys EOA XMTP queue databases by xmtp agent identity instead of vault address', async () => {
    mocks.sql.mockResolvedValueOnce({
      rows: [
        {
          vault_address: VAULT,
          group_id: 'group-1',
          canonical_owner_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          creator_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          xmtp_agent_address: '0x7777777777777777777777777777777777777777',
          agent_type: 'eoa',
          privy_wallet_id: null,
          csw_address: null,
          encrypted_private_key_b64: 'ciphertext',
          encrypted_private_key_iv_b64: 'iv',
          encrypted_private_key_tag_b64: 'tag',
        },
      ],
    })
    mocks.AgentCreate.mockRejectedValueOnce(new Error('agent_init_failed'))

    const result = await executeKeeprAction({
      id: 16,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'xmtp.group.send_message',
      action: {
        action: 'xmtp.group.send_message',
        message: 'hello world',
      },
    })

    expect(result.success).toBe(false)
    expect(result.actionType).toBe('xmtp.group.send_message')
    expect(mocks.AgentCreate.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        dbPath: '/tmp/keepr-xmtp-tests/keepr-production-0x7777777777777777777777777777777777777777.db3',
      }),
    )
  })

  it('keeps Charm fallback retryable when an earlier CSW candidate failed retryably and a later one failed permanently', async () => {
    process.env.KEEPR_PRIVATE_KEY =
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    mocks.privateKeyToAccount.mockReturnValue({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    mocks.sql.mockResolvedValueOnce({
      rows: [
        {
          vault_address: VAULT,
          group_id: 'group-1',
          canonical_owner_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          creator_address: null,
          agent_type: null,
          privy_wallet_id: null,
          csw_address: CANONICAL_CSW,
          encrypted_private_key_b64: null,
          encrypted_private_key_iv_b64: null,
          encrypted_private_key_tag_b64: null,
        },
      ],
    })
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'manager') return '0x6666666666666666666666666666666666666666'
      if (functionName === 'rebalanceDelegate') return '0x0000000000000000000000000000000000000000'
      throw new Error(`Unexpected readContract call: ${functionName}`)
    })
    mocks.findCoinbaseSmartWalletOwnerIndex
      .mockRejectedValueOnce(buildHelperError('csw_owner_scan_incomplete', true))
      .mockResolvedValueOnce(null)

    const result = await executeKeeprAction({
      id: 12,
      vaultAddress: VAULT,
      groupId: 'group-1',
      actionType: 'strategy.charm.rebalance',
      action: {
        action: 'strategy.charm.rebalance',
        charmVaultAddress: VAULT,
      },
    })

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
    expect(result.actionType).toBe('strategy.charm.rebalance')
    expect(result.error).toBe('csw_owner_scan_incomplete')
    expect(mocks.findCoinbaseSmartWalletOwnerIndex).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        smartWallet: CANONICAL_CSW,
      }),
    )
    expect(mocks.findCoinbaseSmartWalletOwnerIndex).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        smartWallet: '0x6666666666666666666666666666666666666666',
      }),
    )
    expect(mocks.sendCoinbaseSmartWalletUserOperation).not.toHaveBeenCalled()
    expect(mocks.writeContract).not.toHaveBeenCalled()
  })
})
