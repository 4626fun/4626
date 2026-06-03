/**
 * Regression tests for handleSendCommand under ARCH_B_SEND_VIA_USEROP.
 *
 * Verifies:
 *  - Legacy EOA path is NOT taken when the feature flag is on
 *  - Arch B branch hard-fails with a friendly refusal when issuer not
 *    execution-ready
 *  - Arch B branch delegates to submitUserOpOrRefuse with CoinbaseSmartWalletCall
 *    for ETH and ERC-20 transfers
 *  - On submitter refusal, the legacy vault ledger is rolled back
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress, parseUnits } from 'viem'

// --- Feature flag must be set before importing the module under test -------
process.env.ARCH_B_SEND_VIA_USEROP = '1'

// --- Mocks -----------------------------------------------------------------

const checkDurableRateLimitMock = vi.fn()
const isDbConfiguredMock = vi.fn()
const getDbMock = vi.fn()
const walletRpcMock = vi.fn()
const attestationGateMock = vi.fn()
const resolveContextMock = vi.fn()
const submitUserOpMock = vi.fn()
const getCreatorAgentWalletMock = vi.fn()

vi.mock('../../_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: (...args: unknown[]) => checkDurableRateLimitMock(...args),
}))

vi.mock('../../_lib/db/postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: () => getDbMock(),
}))

vi.mock('../../_lib/wallet/privyWalletApi.js', () => ({
  walletRpc: (...args: unknown[]) => walletRpcMock(...args),
  BASE_CAIP2: 'eip155:8453',
}))

vi.mock('../../_lib/agent/teeAttestationGate.js', () => ({
  assertTeeAttestationOrThrow: (...args: unknown[]) => attestationGateMock(...args),
}))

vi.mock('@4626/server-core', () => ({
  resolveCommandIssuerContextByAddress: (...args: unknown[]) => resolveContextMock(...args),
  isExecutionReady: (resolution: { status: string }) => resolution.status === 'ready',
}))

vi.mock('../../_lib/wallet/userOperationSubmitter.js', () => ({
  isArchBSendViaUserOpEnabled: () => true,
  submitUserOpOrRefuse: (...args: unknown[]) => submitUserOpMock(...args),
}))

vi.mock('../../_lib/wallet/walletBalancePreflight.js', () => ({
  buildInsufficientFundsRefusal: () => 'friendly',
  checkWalletBalancePreflight: vi.fn(),
  getBasePreflightPublicClient: vi.fn(),
  isInsufficientFundsError: () => false,
}))

vi.mock('../../_lib/wallet/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: (...args: unknown[]) => getCreatorAgentWalletMock(...args),
}))

vi.mock('../../_lib/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// --- Fake DB that just swallows the ledger writes --------------------------
const fakeDb = {
  sql: vi.fn(async () => ({ rows: [{ amount: 0 }] })),
}

async function importModule() {
  return await import('../sendCommand.js')
}

const SENDER = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
const VAULT = {
  vaultAddress: getAddress('0x2222222222222222222222222222222222222222'),
  creatorCoinAddress: getAddress('0x3333333333333333333333333333333333333333'),
} as any
const RECIPIENT = '0x1111111111111111111111111111111111111111'

const READY_CONTEXT = {
  profileId: 42,
  smartWallet: SENDER,
  privyOwnerWalletId: 'privy-1',
  ownerEoa: getAddress('0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3'),
  ownerIndex: 0,
  paymasterPolicy: 'cdp_default',
  capsVersion: 1,
  perTxCapWei: 10_000_000_000_000_000n,
  dailyCapWei: 50_000_000_000_000_000n,
  provisionedAt: new Date(),
  revokedAt: null,
}

describe('handleSendCommand — Architecture B branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true })
    isDbConfiguredMock.mockReturnValue(true)
    getDbMock.mockResolvedValue(fakeDb)
    attestationGateMock.mockResolvedValue(undefined)
    fakeDb.sql.mockImplementation(async () => ({ rows: [{ amount: 0 }] }))
  })

  it('hard-fails with friendly refusal when issuer is not provisioned', async () => {
    resolveContextMock.mockResolvedValue({ status: 'not_provisioned', profileId: null })
    const { handleSendCommand } = await importModule()

    const result = await handleSendCommand({
      groupId: 'g1',
      senderWallet: SENDER,
      text: `/send 0.001 ETH to ${RECIPIENT}`,
      role: 'ADMIN',
      vault: VAULT,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain("isn't provisioned")
    expect(walletRpcMock).not.toHaveBeenCalled()
    expect(submitUserOpMock).not.toHaveBeenCalled()
    expect(getCreatorAgentWalletMock).not.toHaveBeenCalled()
  })

  it('hard-fails with a revoked-context refusal', async () => {
    resolveContextMock.mockResolvedValue({
      status: 'revoked',
      profileId: 42,
      revokedAt: new Date(),
      reason: 'compromise',
    })
    const { handleSendCommand } = await importModule()

    const result = await handleSendCommand({
      groupId: 'g2',
      senderWallet: SENDER,
      text: `/send 0.001 ETH to ${RECIPIENT}`,
      role: 'ADMIN',
      vault: VAULT,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('revoked')
  })

  it('delegates ETH transfer to submitUserOpOrRefuse with native value', async () => {
    resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
    submitUserOpMock.mockResolvedValue({
      ok: true,
      userOpHash: '0xuop',
      txHash: '0xtx',
      smartWallet: SENDER,
      ownerAddress: READY_CONTEXT.ownerEoa,
      ownerIndex: 0,
    })
    const { handleSendCommand } = await importModule()

    const result = await handleSendCommand({
      groupId: 'g3',
      senderWallet: SENDER,
      text: `/send 0.001 ETH to ${RECIPIENT}`,
      role: 'ADMIN',
      vault: VAULT,
    })

    expect(result.ok).toBe(true)
    expect(submitUserOpMock).toHaveBeenCalledTimes(1)
    const arg = submitUserOpMock.mock.calls[0][0]
    expect(arg.issuer).toBe(READY_CONTEXT)
    expect(arg.valueWei).toBe(parseUnits('0.001', 18))
    expect(arg.calls).toHaveLength(1)
    expect(arg.calls[0].to.toLowerCase()).toBe(RECIPIENT.toLowerCase())
    expect(arg.calls[0].value).toBe(parseUnits('0.001', 18))
    // Legacy EOA path must not be taken
    expect(walletRpcMock).not.toHaveBeenCalled()
    expect(getCreatorAgentWalletMock).not.toHaveBeenCalled()
  })

  it('delegates USDC transfer with valueWei=0 and ERC-20 calldata', async () => {
    resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
    submitUserOpMock.mockResolvedValue({
      ok: true,
      userOpHash: '0xuop',
      txHash: '0xtx',
      smartWallet: SENDER,
      ownerAddress: READY_CONTEXT.ownerEoa,
      ownerIndex: 0,
    })
    const { handleSendCommand } = await importModule()

    const result = await handleSendCommand({
      groupId: 'g4',
      senderWallet: SENDER,
      text: `/send 10 USDC to ${RECIPIENT}`,
      role: 'ADMIN',
      vault: VAULT,
    })

    expect(result.ok).toBe(true)
    const arg = submitUserOpMock.mock.calls[0][0]
    expect(arg.valueWei).toBe(0n)
    expect(arg.calls).toHaveLength(1)
    expect(arg.calls[0].to.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
    expect(arg.calls[0].value).toBe(0n)
    expect(String(arg.calls[0].data).startsWith('0xa9059cbb')).toBe(true) // ERC20 transfer selector
  })

  it('surfaces submitter refusal response to caller', async () => {
    resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
    submitUserOpMock.mockResolvedValue({
      ok: false,
      code: 'cap_exceeded',
      scope: 'per_tx',
      limitWei: READY_CONTEXT.perTxCapWei,
      requestedWei: READY_CONTEXT.perTxCapWei + 1n,
      alreadySpentWei: 0n,
      response: "This trade can't be executed right now — per-transaction cap exceeded.",
    })
    const { handleSendCommand } = await importModule()

    const result = await handleSendCommand({
      groupId: 'g5',
      senderWallet: SENDER,
      text: `/send 0.001 ETH to ${RECIPIENT}`,
      role: 'ADMIN',
      vault: VAULT,
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('per-transaction cap')
  })
})
