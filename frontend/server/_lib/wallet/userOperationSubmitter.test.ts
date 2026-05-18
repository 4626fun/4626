/**
 * Unit tests for userOperationSubmitter — Architecture B Phase 2.
 *
 * Verifies:
 *  - Per-tx cap refusal (strict upper bound)
 *  - Daily cap refusal (spent + requested > limit)
 *  - Missing bundler URL returns bundler_unavailable
 *  - CSW preflight refusal returns insufficient_funds + rolls back reserve
 *  - Successful submission records reserve + returns txHash
 *  - Failed submission rolls back daily spend
 *  - isInsufficientFundsError mapping on thrown errors
 *  - Feature flag helper
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const readDailySpendMock = vi.fn()
const recordDailySpendMock = vi.fn()
const rollbackDailySpendMock = vi.fn()
const sendUserOpMock = vi.fn()
const checkPreflightMock = vi.fn()
const getBasePreflightClientMock = vi.fn()

vi.mock('./commandIssuerContext.js', () => ({
  readIssuerDailySpend: (...args: unknown[]) => readDailySpendMock(...args),
  recordIssuerDailySpend: (...args: unknown[]) => recordDailySpendMock(...args),
  rollbackIssuerDailySpend: (...args: unknown[]) => rollbackDailySpendMock(...args),
}))

vi.mock('./privyCoinbaseSmartWallet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./privyCoinbaseSmartWallet.js')>()
  return {
    // Re-export real helpers so `isCoinbaseSmartWalletHelperError`
    // and `CoinbaseSmartWalletHelperError` stay consistent with the SUT.
    ...actual,
    sendPrivyCoinbaseSmartWalletUserOperation: (...args: unknown[]) => sendUserOpMock(...args),
  }
})

vi.mock('./walletBalancePreflight.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./walletBalancePreflight.js')>()
  return {
    ...actual,
    checkWalletBalancePreflight: (...args: unknown[]) => checkPreflightMock(...args),
    getBasePreflightPublicClient: () => getBasePreflightClientMock(),
  }
})

vi.mock('../infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

async function importModule() {
  return await import('./userOperationSubmitter.js')
}

const ISSUER = {
  profileId: 42,
  smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5' as `0x${string}`,
  privyOwnerWalletId: 'privy-w-1',
  ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3' as `0x${string}`,
  ownerIndex: 0,
  paymasterPolicy: 'cdp_default',
  capsVersion: 1,
  perTxCapWei: 10_000_000_000_000_000n, // 0.01 ETH
  dailyCapWei: 50_000_000_000_000_000n, // 0.05 ETH
  provisionedAt: new Date('2026-04-17T00:00:00.000Z'),
  revokedAt: null,
  subAccount: null,
}

const CALLS = [
  {
    to: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    value: 1n,
    data: '0x' as `0x${string}`,
  },
]

describe('submitUserOpOrRefuse — caps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readDailySpendMock.mockResolvedValue(0n)
    recordDailySpendMock.mockResolvedValue({ ok: true, newTotalWei: 0n })
    rollbackDailySpendMock.mockResolvedValue({ ok: true })
    checkPreflightMock.mockResolvedValue({
      sufficient: true,
      balanceWei: 1_000_000_000_000_000_000n,
      requiredWei: 0n,
    })
    sendUserOpMock.mockResolvedValue({
      userOpHash: '0xuserop',
      txHash: '0xtx',
      smartWallet: ISSUER.smartWallet,
      ownerAddress: ISSUER.ownerEoa,
      ownerIndex: 0,
    })
  })

  it('refuses when valueWei exceeds perTxCapWei', async () => {
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: ISSUER.perTxCapWei + 1n,
      bundlerUrl: 'https://bundler.example',
    })
    expect(result.ok).toBe(false)
    if (!result.ok && result.code === 'cap_exceeded') {
      expect(result.scope).toBe('per_tx')
      expect(result.response).toContain('per-transaction cap')
    }
    expect(sendUserOpMock).not.toHaveBeenCalled()
    expect(recordDailySpendMock).not.toHaveBeenCalled()
  })

  it('refuses when today spend + requested exceeds dailyCapWei', async () => {
    readDailySpendMock.mockResolvedValue(ISSUER.dailyCapWei - 1n)
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 10n,
      bundlerUrl: 'https://bundler.example',
    })
    expect(result.ok).toBe(false)
    if (!result.ok && result.code === 'cap_exceeded') {
      expect(result.scope).toBe('daily')
      expect(result.response).toContain('daily limit')
    }
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('allows exact-boundary spend (spent + value == limit)', async () => {
    readDailySpendMock.mockResolvedValue(ISSUER.dailyCapWei - 10n)
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 10n,
      bundlerUrl: 'https://bundler.example',
      publicClient: { getBalance: async () => 0n } as any,
    })
    expect(result.ok).toBe(true)
  })
})

describe('submitUserOpOrRefuse — bundler + preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readDailySpendMock.mockResolvedValue(0n)
    recordDailySpendMock.mockResolvedValue({ ok: true, newTotalWei: 0n })
    rollbackDailySpendMock.mockResolvedValue({ ok: true })
    sendUserOpMock.mockResolvedValue({
      userOpHash: '0xuserop',
      txHash: '0xtx',
      smartWallet: ISSUER.smartWallet,
      ownerAddress: ISSUER.ownerEoa,
      ownerIndex: 0,
    })
  })

  it('refuses with bundler_unavailable when no URL resolvable', async () => {
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 1n,
      bundlerUrl: '',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bundler_unavailable')
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('refuses with insufficient_funds when CSW preflight fails for native transfer', async () => {
    checkPreflightMock.mockResolvedValue({
      sufficient: false,
      balanceWei: 0n,
      requiredWei: 1_000n,
      reason: 'insufficient_funds',
      message: "This trade can't be executed right now — the agent wallet needs funding...",
    })
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('insufficient_funds')
    expect(sendUserOpMock).not.toHaveBeenCalled()
    expect(recordDailySpendMock).not.toHaveBeenCalled()
  })

  it('skips CSW preflight when valueWei is 0 (ERC-20 transfer)', async () => {
    checkPreflightMock.mockResolvedValue({
      sufficient: false,
      balanceWei: 0n,
      requiredWei: 1_000n,
      reason: 'insufficient_funds',
      message: 'never shown',
    })
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: [{ to: '0x2222222222222222222222222222222222222222' as `0x${string}`, value: 0n, data: '0xaa' as `0x${string}` }],
      valueWei: 0n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    expect(checkPreflightMock).not.toHaveBeenCalled()
  })
})

describe('submitUserOpOrRefuse — submission path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readDailySpendMock.mockResolvedValue(0n)
    recordDailySpendMock.mockResolvedValue({ ok: true, newTotalWei: 1_000n })
    rollbackDailySpendMock.mockResolvedValue({ ok: true })
    checkPreflightMock.mockResolvedValue({
      sufficient: true,
      balanceWei: 1_000_000_000_000_000_000n,
      requiredWei: 0n,
    })
  })

  it('returns success on successful submission', async () => {
    sendUserOpMock.mockResolvedValue({
      userOpHash: '0xuop',
      txHash: '0xtxhash',
      smartWallet: ISSUER.smartWallet,
      ownerAddress: ISSUER.ownerEoa,
      ownerIndex: 0,
    })
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.txHash).toBe('0xtxhash')
    expect(recordDailySpendMock).toHaveBeenCalledWith({ profileId: 42, amountWei: 1_000n })
    expect(rollbackDailySpendMock).not.toHaveBeenCalled()
  })

  it('maps thrown insufficient-funds errors to insufficient_funds refusal and rolls back', async () => {
    sendUserOpMock.mockRejectedValue(
      new Error(
        'privy_http_400: insufficient funds for gas * price + value: have 0 want 1244',
      ),
    )
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('insufficient_funds')
    expect(rollbackDailySpendMock).toHaveBeenCalledWith({ profileId: 42, amountWei: 1_000n })
  })

  it('maps generic errors to userop_failed and rolls back', async () => {
    sendUserOpMock.mockRejectedValue(new Error('paymaster rejected'))
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 500n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('userop_failed')
      expect(result.response).toContain('paymaster rejected')
    }
    expect(rollbackDailySpendMock).toHaveBeenCalled()
  })

  it('surfaces the underlying cause when the error is a CoinbaseSmartWalletHelperError', async () => {
    // Simulate what privyCoinbaseSmartWallet.sendPrivyCoinbaseSmartWalletUserOperation
    // throws when wrapUnknownHelperError wraps a paymaster -32000 failure.
    const { CoinbaseSmartWalletHelperError } = await import('./privyCoinbaseSmartWallet.js')
    const underlying = new Error('internal error - error communicating with paymaster')
    ;(underlying as unknown as { code?: number }).code = -32000
    const helperError = new CoinbaseSmartWalletHelperError('userop_submission_failed', true, {
      causeMessage: underlying.message,
      cause: underlying,
    })
    sendUserOpMock.mockRejectedValue(helperError)

    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 500n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.code === 'userop_failed') {
      expect(result.retryable).toBe(true)
      // The user-facing response must carry the human-readable paymaster text,
      // not the opaque 'userop_submission_failed' short code.
      expect(result.errorMessage).toBe(
        'internal error - error communicating with paymaster',
      )
      // When retryable=true we return the generic retry copy (not the raw
      // detailMessage). Assert both that copy AND that rollback ran.
      expect(result.response).toMatch(/temporary bundler issue/i)
    } else {
      throw new Error(`expected userop_failed refusal, got code=${(result as { code?: string }).code}`)
    }
    expect(rollbackDailySpendMock).toHaveBeenCalled()
  })

  it('includes the paymaster detail in the user-facing response when non-retryable', async () => {
    const { CoinbaseSmartWalletHelperError } = await import('./privyCoinbaseSmartWallet.js')
    const helperError = new CoinbaseSmartWalletHelperError('userop_submission_failed', false, {
      causeMessage: 'AA24 signature error',
      cause: new Error('AA24 signature error'),
    })
    sendUserOpMock.mockRejectedValue(helperError)

    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: CALLS,
      valueWei: 500n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.code === 'userop_failed') {
      expect(result.retryable).toBe(false)
      expect(result.errorMessage).toBe('AA24 signature error')
      expect(result.response).toContain('AA24 signature error')
      // The opaque short code must not leak into the user-facing string.
      expect(result.response).not.toContain('userop_submission_failed')
    } else {
      throw new Error(`expected userop_failed refusal, got code=${(result as { code?: string }).code}`)
    }
  })

  it('does not reserve daily spend when valueWei is 0', async () => {
    sendUserOpMock.mockResolvedValue({
      userOpHash: '0xuop',
      txHash: '0xtx',
      smartWallet: ISSUER.smartWallet,
      ownerAddress: ISSUER.ownerEoa,
      ownerIndex: 0,
    })
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: ISSUER,
      calls: [{ to: '0x2222222222222222222222222222222222222222' as `0x${string}`, value: 0n, data: '0xaa' as `0x${string}` }],
      valueWei: 0n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    expect(recordDailySpendMock).not.toHaveBeenCalled()
  })
})

describe('isArchBSendViaUserOpEnabled', () => {
  const ORIGINAL = process.env.ARCH_B_SEND_VIA_USEROP

  beforeEach(() => {
    delete process.env.ARCH_B_SEND_VIA_USEROP
    vi.resetModules()
  })

  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.ARCH_B_SEND_VIA_USEROP
    else process.env.ARCH_B_SEND_VIA_USEROP = ORIGINAL
  })

  it('returns false when unset', async () => {
    const mod = await importModule()
    expect(mod.isArchBSendViaUserOpEnabled()).toBe(false)
  })

  it('returns true for common truthy values', async () => {
    for (const v of ['1', 'true', 'yes', 'on', 'TRUE']) {
      process.env.ARCH_B_SEND_VIA_USEROP = v
      vi.resetModules()
      const mod = await importModule()
      expect(mod.isArchBSendViaUserOpEnabled()).toBe(true)
    }
  })
})
