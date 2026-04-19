/**
 * Architecture B Phase 5 — sub-account path tests for submitUserOpOrRefuse.
 *
 * These cover the new branches added by PR-A. They mock out the
 * cross-cutting DB + RPC dependencies exactly like the existing
 * userOperationSubmitter tests, then exercise the sub-account path.
 *
 * NOTE: lives under `api/__tests__/` to satisfy the placement guard at
 * frontend/scripts/check-test-file-placement.mjs for tests touching server
 * code. The implementation under test lives in
 * frontend/server/_lib/wallet/userOperationSubmitter.ts.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const readDailySpendMock = vi.fn()
const recordDailySpendMock = vi.fn()
const rollbackDailySpendMock = vi.fn()
const sendUserOpMock = vi.fn()
const checkPreflightMock = vi.fn()
const getBasePreflightClientMock = vi.fn()
const isApprovedMock = vi.fn()
const buildSpendCallsMock = vi.fn()

vi.mock('../../../server/_lib/wallet/commandIssuerContext.js', () => ({
  readIssuerDailySpend: (...args: unknown[]) => readDailySpendMock(...args),
  recordIssuerDailySpend: (...args: unknown[]) => recordDailySpendMock(...args),
  rollbackIssuerDailySpend: (...args: unknown[]) => rollbackDailySpendMock(...args),
}))

vi.mock('../../../server/_lib/wallet/privyCoinbaseSmartWallet.js', () => ({
  sendPrivyCoinbaseSmartWalletUserOperation: (...args: unknown[]) => sendUserOpMock(...args),
}))

vi.mock('../../../server/_lib/wallet/walletBalancePreflight.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../server/_lib/wallet/walletBalancePreflight.js')
  >()
  return {
    ...actual,
    checkWalletBalancePreflight: (...args: unknown[]) => checkPreflightMock(...args),
    getBasePreflightPublicClient: () => getBasePreflightClientMock(),
  }
})

vi.mock('../../../server/_lib/wallet/spendPermission.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../server/_lib/wallet/spendPermission.js')
  >()
  return {
    ...actual,
    isSpendPermissionApproved: (...args: unknown[]) => isApprovedMock(...args),
    buildSpendPermissionCalls: (...args: unknown[]) => buildSpendCallsMock(...args),
  }
})

vi.mock('../../../server/_lib/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

async function importModule() {
  return await import('../../../server/_lib/wallet/userOperationSubmitter.js')
}

const PARENT_CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as `0x${string}`
const SUB_ACCOUNT = '0xcafecafecafecafecafecafecafecafecafecafe' as `0x${string}`
const OWNER_EOA = '0xceca000000000000000000000000000000000000' as `0x${string}`

const SPEND_PAYLOAD = {
  account: PARENT_CSW,
  spender: SUB_ACCOUNT,
  token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
  allowance: '500000000000000000',
  period: 86400,
  start: 1_700_000_000,
  end: 4_700_000_000,
  salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
  extraData: '0x' as `0x${string}`,
}

const SUBACCT_READY = {
  subAccountAddress: SUB_ACCOUNT,
  parentCswAddress: PARENT_CSW,
  spendPermission: {
    payload: SPEND_PAYLOAD,
    signature: '0xabcd' as `0x${string}`,
    hash: '0xdeadbeef' as `0x${string}`,
    allowanceWei: 500_000_000_000_000_000n,
    periodSeconds: 86400,
    endAt: new Date('2099-01-01T00:00:00.000Z'),
    revokedAt: null as Date | null,
  },
}

function makeIssuer(
  overrides: {
    subAccount?: typeof SUBACCT_READY | null
  } = {},
) {
  return {
    profileId: 42,
    smartWallet: PARENT_CSW,
    privyOwnerWalletId: 'privy-w-1',
    ownerEoa: OWNER_EOA,
    ownerIndex: 1,
    paymasterPolicy: 'cdp_default',
    capsVersion: 1,
    perTxCapWei: 10_000_000_000_000_000n,
    dailyCapWei: 50_000_000_000_000_000n,
    provisionedAt: new Date('2026-04-17T00:00:00.000Z'),
    revokedAt: null,
    subAccount: overrides.subAccount === undefined ? SUBACCT_READY : overrides.subAccount,
  }
}

const INPUT_CALL = {
  to: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  value: 0n,
  data: '0xbeef' as `0x${string}`,
}

const SPEND_CALL_APPROVE = {
  to: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad' as `0x${string}`,
  value: 0n,
  data: '0xapprove' as `0x${string}`,
}
const SPEND_CALL_SPEND = {
  to: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad' as `0x${string}`,
  value: 0n,
  data: '0xspend' as `0x${string}`,
}

const ORIGINAL_FLAG = process.env.ARCH_B_SUB_ACCOUNTS_ENABLED

function setFlag(on: boolean) {
  if (on) process.env.ARCH_B_SUB_ACCOUNTS_ENABLED = '1'
  else delete process.env.ARCH_B_SUB_ACCOUNTS_ENABLED
}

afterAll(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ARCH_B_SUB_ACCOUNTS_ENABLED
  else process.env.ARCH_B_SUB_ACCOUNTS_ENABLED = ORIGINAL_FLAG
})

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
    userOpHash: '0xuop',
    txHash: '0xtxhash',
    smartWallet: SUB_ACCOUNT,
    ownerAddress: OWNER_EOA,
    ownerIndex: 1,
  })
  isApprovedMock.mockResolvedValue(false)
  buildSpendCallsMock.mockImplementation((args: { isApprovedOnChain: boolean }) => {
    return args.isApprovedOnChain ? [SPEND_CALL_SPEND] : [SPEND_CALL_APPROVE, SPEND_CALL_SPEND]
  })
})

describe('submitUserOpOrRefuse — sub-account path', () => {
  it('refuses with sub_account_feature_disabled when flag is off', async () => {
    setFlag(false)
    vi.resetModules()
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer(),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('sub_account_feature_disabled')
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('refuses with sub_account_spend_permission_revoked when revoked', async () => {
    setFlag(true)
    vi.resetModules()
    const mod = await importModule()
    const issuer = makeIssuer({
      subAccount: {
        ...SUBACCT_READY,
        spendPermission: {
          ...SUBACCT_READY.spendPermission,
          revokedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
    })
    const result = await mod.submitUserOpOrRefuse({
      issuer,
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('sub_account_spend_permission_revoked')
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('refuses with sub_account_spend_permission_expired when endAt is past', async () => {
    setFlag(true)
    vi.resetModules()
    const mod = await importModule()
    const issuer = makeIssuer({
      subAccount: {
        ...SUBACCT_READY,
        spendPermission: {
          ...SUBACCT_READY.spendPermission,
          endAt: new Date('2000-01-01T00:00:00.000Z'),
        },
      },
    })
    const result = await mod.submitUserOpOrRefuse({
      issuer,
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('sub_account_spend_permission_expired')
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('refuses with sub_account_parent_insufficient_funds when parent balance preflight fails', async () => {
    setFlag(true)
    vi.resetModules()
    checkPreflightMock.mockResolvedValue({
      sufficient: false,
      balanceWei: 10n,
      requiredWei: 2_000n,
      reason: 'insufficient_funds',
      message: "parent balance too low",
    })
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer(),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('sub_account_parent_insufficient_funds')
      if (result.code === 'sub_account_parent_insufficient_funds') {
        expect(result.balanceWei).toBe(10n)
        expect(result.requiredWei).toBe(2_000n)
      }
    }
    // Parent is the balance source for sub-account rows.
    expect(checkPreflightMock).toHaveBeenCalledTimes(1)
    const preflightArgs = checkPreflightMock.mock.calls[0][0]
    expect(preflightArgs.wallet).toBe(PARENT_CSW)
    expect(recordDailySpendMock).not.toHaveBeenCalled()
    expect(sendUserOpMock).not.toHaveBeenCalled()
  })

  it('submits [approveWithSignature, spend, ...inputCalls] when permission not yet approved on-chain', async () => {
    setFlag(true)
    vi.resetModules()
    isApprovedMock.mockResolvedValue(false)
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer(),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    expect(sendUserOpMock).toHaveBeenCalledTimes(1)
    const args = sendUserOpMock.mock.calls[0][0]
    expect(args.smartWallet).toBe(SUB_ACCOUNT)
    expect(args.ownerIndex).toBe(1)
    expect(args.calls).toEqual([SPEND_CALL_APPROVE, SPEND_CALL_SPEND, INPUT_CALL])
    // buildSpendPermissionCalls was invoked with isApprovedOnChain=false
    const buildArgs = buildSpendCallsMock.mock.calls[0][0]
    expect(buildArgs.isApprovedOnChain).toBe(false)
    expect(buildArgs.amountWei).toBe(1_000n)
  })

  it('submits [spend, ...inputCalls] when permission already approved on-chain', async () => {
    setFlag(true)
    vi.resetModules()
    isApprovedMock.mockResolvedValue(true)
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer(),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    const args = sendUserOpMock.mock.calls[0][0]
    expect(args.calls).toEqual([SPEND_CALL_SPEND, INPUT_CALL])
    const buildArgs = buildSpendCallsMock.mock.calls[0][0]
    expect(buildArgs.isApprovedOnChain).toBe(true)
  })

  it('fails open to include approveWithSignature when isSpendPermissionApproved throws', async () => {
    setFlag(true)
    vi.resetModules()
    isApprovedMock.mockRejectedValue(new Error('rpc flaky'))
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer(),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    const buildArgs = buildSpendCallsMock.mock.calls[0][0]
    expect(buildArgs.isApprovedOnChain).toBe(false)
  })

  it('legacy row (subAccount null) flow is unchanged when flag is off', async () => {
    setFlag(false)
    vi.resetModules()
    const mod = await importModule()
    const result = await mod.submitUserOpOrRefuse({
      issuer: makeIssuer({ subAccount: null }),
      calls: [INPUT_CALL],
      valueWei: 1_000n,
      bundlerUrl: 'https://bundler.example',
      publicClient: {} as any,
    })
    expect(result.ok).toBe(true)
    expect(isApprovedMock).not.toHaveBeenCalled()
    expect(buildSpendCallsMock).not.toHaveBeenCalled()
    const args = sendUserOpMock.mock.calls[0][0]
    expect(args.smartWallet).toBe(PARENT_CSW)
    expect(args.calls).toEqual([INPUT_CALL])
    // Balance preflight checked against the CSW itself, not a parent.
    const preflightArgs = checkPreflightMock.mock.calls[0][0]
    expect(preflightArgs.wallet).toBe(PARENT_CSW)
  })
})

describe('isArchBSubAccountsEnabled', () => {
  const ORIGINAL = process.env.ARCH_B_SUB_ACCOUNTS_ENABLED

  beforeEach(() => {
    delete process.env.ARCH_B_SUB_ACCOUNTS_ENABLED
    vi.resetModules()
  })

  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.ARCH_B_SUB_ACCOUNTS_ENABLED
    else process.env.ARCH_B_SUB_ACCOUNTS_ENABLED = ORIGINAL
  })

  it('returns false when unset', async () => {
    const mod = await importModule()
    expect(mod.isArchBSubAccountsEnabled()).toBe(false)
  })

  it('returns true for common truthy values', async () => {
    for (const v of ['1', 'true', 'yes', 'on', 'TRUE']) {
      process.env.ARCH_B_SUB_ACCOUNTS_ENABLED = v
      vi.resetModules()
      const mod = await importModule()
      expect(mod.isArchBSubAccountsEnabled()).toBe(true)
    }
  })
})
