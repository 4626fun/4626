import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  syncRoomChannelBridgeMembershipMock,
  backfillActiveRoomChannelBridgeMembersMock,
  resolveRoomFriendKeyAccessMock,
  getDbMock,
  ensureAlfaClubVigilanteSchemaMock,
  getKeeprBaseRpcUrlsMock,
  getAlfaClubPublicClientMock,
  createPublicClientMock,
  readContractMock,
  eligibilityState,
} = vi.hoisted(() => ({
  syncRoomChannelBridgeMembershipMock: vi.fn(async () => true),
  backfillActiveRoomChannelBridgeMembersMock: vi.fn(async () => ({ rooms: 0, enqueued: 0, skipped: 0 })),
  resolveRoomFriendKeyAccessMock: vi.fn(async () => ({
    allowed: false,
    reason: 'insufficient' as
      | 'insufficient'
      | 'check_failed'
      | 'room_key'
      | 'staked_key'
      | 'no_wallet'
      | 'anonymous',
    walletAddress: null as `0x${string}` | null,
  })),
  getDbMock: vi.fn(),
  ensureAlfaClubVigilanteSchemaMock: vi.fn(async () => undefined),
  getKeeprBaseRpcUrlsMock: vi.fn(() => ['http://fake-rpc.invalid']),
  getAlfaClubPublicClientMock: vi.fn(async () => ({}) as unknown),
  createPublicClientMock: vi.fn(),
  readContractMock: vi.fn(),
  // Mutable box so tests can tweak on-chain quote/balances without re-mocking modules.
  eligibilityState: {
    quoteErrorCode: 0,
    quoteRaw: 1000n,
    balances: new Map<string, bigint>(),
  },
}))

vi.mock('./roomChannelBridge.js', () => ({
  syncRoomChannelBridgeMembership: syncRoomChannelBridgeMembershipMock,
  backfillActiveRoomChannelBridgeMembers: backfillActiveRoomChannelBridgeMembersMock,
}))

vi.mock('./roomFriendKeyAccess.js', () => ({
  resolveRoomFriendKeyAccess: resolveRoomFriendKeyAccessMock,
  expandFriendKeyCheckWallets: vi.fn(async (wallet: `0x${string}`) => [wallet]),
}))

vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: vi.fn(async () => null),
}))

function mockFriendKeyAbsent(wallet: `0x${string}` = WALLET_A) {
  resolveRoomFriendKeyAccessMock.mockResolvedValue({
    allowed: false,
    reason: 'insufficient',
    walletAddress: wallet,
  })
}

function mockFriendKeyPresent(wallet: `0x${string}` = WALLET_A) {
  resolveRoomFriendKeyAccessMock.mockResolvedValue({
    allowed: true,
    reason: 'room_key',
    walletAddress: wallet,
  })
}

function mockFriendKeyCheckFailed(wallet: `0x${string}` = WALLET_A) {
  resolveRoomFriendKeyAccessMock.mockResolvedValue({
    allowed: false,
    reason: 'check_failed',
    walletAddress: wallet,
  })
}

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureAlfaClubVigilanteSchemaMock,
}))

vi.mock('../keepr/keeprGating.js', () => ({
  getKeeprBaseRpcUrls: getKeeprBaseRpcUrlsMock,
}))

vi.mock('../wallet/alfaclub.js', () => ({
  ALFACLUB: {
    friendKey: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
  },
  getAlfaClubPublicClient: getAlfaClubPublicClientMock,
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => 'fake-transport'),
  }
})

import {
  joinAlfaClubRoomAccess,
  preloadAlfaClubRoomAccessPolicyPoolAddress,
  recheckAlfaClubRoomAccessMemberships,
} from './roomAccessPolicy.js'

const ROOM_ID = '1659'
const CREATOR_COIN_ADDRESS = `0x${'11'.repeat(20)}` as `0x${string}`
const POOL_ADDRESS = `0x${'22'.repeat(20)}` as `0x${string}`
const FACTORY_ADDRESS = `0x${'33'.repeat(20)}` as `0x${string}`
const XYK_CURVE_ADDRESS = `0x${'44'.repeat(20)}` as `0x${string}`
const OTHER_ADDRESS = `0x${'55'.repeat(20)}` as `0x${string}`
const FRIEND_KEY_ADDRESS = '0xaf0bf8593dc6ca973df2132731b0f9b5f974fa9f'
const WALLET_A = `0x${'aa'.repeat(20)}` as `0x${string}`

type MembershipRow = {
  room_id: string
  wallet_address: string
  status: string
  creator_coin_balance_raw: string | null
  quote_threshold_raw: string | null
  last_checked_at: Date | null
  last_eligible_at: Date | null
  grace_started_at: Date | null
  failure_reason: string | null
}

/**
 * Minimal in-memory stand-in for the Postgres `DbPool.sql` tagged-template API,
 * covering exactly the queries `roomAccessPolicy.ts` issues (policy lookup,
 * membership upsert-by-status, membership lookup, and the recheck batch
 * select). Not a general SQL engine — just enough to drive real transition
 * logic in `joinAlfaClubRoomAccess` / `recheckAlfaClubRoomAccessMemberships`.
 */
function createFakeDb(params: { policyRow: Record<string, unknown>; seedMemberships?: MembershipRow[] }) {
  const memberships = new Map<string, MembershipRow>()
  for (const row of params.seedMemberships ?? []) {
    memberships.set(`${row.room_id}:${row.wallet_address}`, row)
  }

  async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    const text = strings.join('|')

    if (text.includes('alfaclub.room_access_policies')) {
      const roomId = String(values[0])
      const match = params.policyRow.room_id === roomId ? params.policyRow : null
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 }
    }

    if (text.includes('INSERT INTO alfaclub.room_access_memberships')) {
      const [roomId, walletAddress, status, creatorCoinBalanceRaw, quoteThresholdRaw, , , failureReason] =
        values as [string, string, string, string | null, string | null, unknown, unknown, string | null]
      const key = `${roomId}:${walletAddress}`
      const existing = memberships.get(key) ?? null
      const lastEligibleAt = status === 'active' ? new Date() : existing?.last_eligible_at ?? null
      const graceStartedAt =
        status === 'grace'
          ? existing?.grace_started_at ?? new Date()
          : status === 'active'
            ? null
            : existing?.grace_started_at ?? null
      memberships.set(key, {
        room_id: roomId,
        wallet_address: walletAddress,
        status,
        creator_coin_balance_raw: creatorCoinBalanceRaw,
        quote_threshold_raw: quoteThresholdRaw,
        last_checked_at: new Date(),
        last_eligible_at: lastEligibleAt,
        grace_started_at: graceStartedAt,
        failure_reason: failureReason,
      })
      return { rows: [], rowCount: 1 }
    }

    if (text.includes('alfaclub.room_access_memberships') && text.includes('status IN')) {
      const roomId = String(values[0])
      const rows = Array.from(memberships.values()).filter((row) => row.room_id === roomId)
      return { rows, rowCount: rows.length }
    }

    if (text.includes('alfaclub.room_access_memberships')) {
      const [roomId, walletAddress] = values as [string, string]
      const row = memberships.get(`${roomId}:${walletAddress}`) ?? null
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
    }

    throw new Error(`createFakeDb: unhandled query: ${text}`)
  }

  return { sql, memberships }
}

function makePolicyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    room_id: ROOM_ID,
    token_id: '7',
    creator_coin_address: CREATOR_COIN_ADDRESS,
    pool_address: POOL_ADDRESS,
    key_amount_raw: '1',
    enter_threshold_bps: 10_000,
    exit_threshold_bps: 9_000,
    grace_hours: 24,
    enabled: true,
    ...overrides,
  }
}

describe('roomAccessPolicy membership-transition -> XMTP bridge sync', () => {
  beforeEach(() => {
    syncRoomChannelBridgeMembershipMock.mockReset()
    syncRoomChannelBridgeMembershipMock.mockResolvedValue(true)
    resolveRoomFriendKeyAccessMock.mockReset()
    mockFriendKeyAbsent()
    ensureAlfaClubVigilanteSchemaMock.mockReset()
    ensureAlfaClubVigilanteSchemaMock.mockResolvedValue(undefined)
    getKeeprBaseRpcUrlsMock.mockReset()
    getKeeprBaseRpcUrlsMock.mockReturnValue(['http://fake-rpc.invalid'])
    getAlfaClubPublicClientMock.mockReset()
    getAlfaClubPublicClientMock.mockResolvedValue({})
    readContractMock.mockReset()
    readContractMock.mockImplementation(async (args: { functionName: string; args: unknown[] }) => {
      if (args.functionName === 'getBuyNFTQuote') {
        return [eligibilityState.quoteErrorCode, 111n, 222n, eligibilityState.quoteRaw, 333n, 444n]
      }
      if (args.functionName === 'balanceOf') {
        const wallet = String(args.args[0]).toLowerCase()
        return eligibilityState.balances.get(wallet) ?? 0n
      }
      throw new Error(`unexpected readContract functionName: ${args.functionName}`)
    })
    createPublicClientMock.mockReset()
    createPublicClientMock.mockReturnValue({
      getBlockNumber: vi.fn(async () => 1_000n),
      readContract: readContractMock,
    })
    eligibilityState.quoteErrorCode = 0
    eligibilityState.quoteRaw = 1000n
    eligibilityState.balances = new Map()
    getDbMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('joinAlfaClubRoomAccess does not sync XMTP for coin-only enter without FriendKey', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    mockFriendKeyAbsent()
    const fakeDb = createFakeDb({ policyRow: makePolicyRow() })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await joinAlfaClubRoomAccess({ roomId: ROOM_ID, walletAddress: WALLET_A })

    expect(result.eligible).toBe(true)
    expect(result.membership.status).toBe('active')
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'remove',
      reasonKey: 'join',
    })
    expect(readContractMock).toHaveBeenCalledWith(expect.objectContaining({
      address: POOL_ADDRESS,
      functionName: 'getBuyNFTQuote',
      args: [7n, 1n],
    }))
  })

  it('joinAlfaClubRoomAccess syncs an XMTP group add only when coin enter also has FriendKey', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    mockFriendKeyPresent()
    const fakeDb = createFakeDb({ policyRow: makePolicyRow() })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await joinAlfaClubRoomAccess({ roomId: ROOM_ID, walletAddress: WALLET_A })

    expect(result.eligible).toBe(true)
    expect(result.membership.status).toBe('active')
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledTimes(1)
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'add',
      reasonKey: 'join',
    })
  })

  it('joinAlfaClubRoomAccess skips XMTP mutation when FriendKey check fails', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    mockFriendKeyCheckFailed()
    const fakeDb = createFakeDb({ policyRow: makePolicyRow() })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await joinAlfaClubRoomAccess({ roomId: ROOM_ID, walletAddress: WALLET_A })

    expect(result.eligible).toBe(true)
    expect(syncRoomChannelBridgeMembershipMock).not.toHaveBeenCalled()
  })

  it('fails closed when Sudoswap returns a non-zero buy-quote error code', async () => {
    eligibilityState.quoteErrorCode = 2
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    const fakeDb = createFakeDb({ policyRow: makePolicyRow() })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await joinAlfaClubRoomAccess({ roomId: ROOM_ID, walletAddress: WALLET_A })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('onchain_read_failed')
    expect(result.membership.status).toBe('unknown_stale')
    expect(syncRoomChannelBridgeMembershipMock).not.toHaveBeenCalled()
  })

  it('joinAlfaClubRoomAccess does not sync when the wallet is below the enter threshold', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
    const fakeDb = createFakeDb({ policyRow: makePolicyRow() })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await joinAlfaClubRoomAccess({ roomId: ROOM_ID, walletAddress: WALLET_A })

    expect(result.eligible).toBe(false)
    expect(result.membership.status).toBe('pending')
    expect(syncRoomChannelBridgeMembershipMock).not.toHaveBeenCalled()
  })

  it('recheck auto-enters a pending FriendKey member and syncs an add', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    mockFriendKeyPresent()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'pending',
          creator_coin_balance_raw: '500',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: null,
          grace_started_at: null,
          failure_reason: 'balance<exit_threshold',
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 1, removed: 0, stale: 0 })
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledTimes(1)
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'add',
      reasonKey: 'recheck_enter',
    })
  })

  it('recheck auto-enters coin-only members and removes them from XMTP', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
    mockFriendKeyAbsent()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'pending',
          creator_coin_balance_raw: '500',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: null,
          grace_started_at: null,
          failure_reason: 'balance<exit_threshold',
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 1, removed: 0, stale: 0 })
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'remove',
      reasonKey: 'recheck_enter',
    })
  })

  it('recheck heals XMTP add when an already-active member later gains FriendKey', async () => {
    // 950 is below the 1000 enter threshold but still above the 900 exit threshold.
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 950n)
    mockFriendKeyPresent()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'active',
          creator_coin_balance_raw: '1000',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: new Date(),
          grace_started_at: null,
          failure_reason: null,
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 0, stale: 0 })
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'add',
      reasonKey: 'recheck_stay_active',
    })
  })

  it('recheck removes XMTP membership for coin-only actives that stay coin-eligible', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 950n)
    mockFriendKeyAbsent()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'active',
          creator_coin_balance_raw: '1000',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: new Date(),
          grace_started_at: null,
          failure_reason: null,
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 0, stale: 0 })
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'remove',
      reasonKey: 'recheck_stay_active',
    })
  })

  it('recheck does not remove XMTP on FriendKey RPC check_failed', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 950n)
    mockFriendKeyCheckFailed()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'active',
          creator_coin_balance_raw: '1000',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: new Date(),
          grace_started_at: null,
          failure_reason: null,
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 0, stale: 0 })
    expect(syncRoomChannelBridgeMembershipMock).not.toHaveBeenCalled()
  })

  it('recheck drops XMTP immediately when a member enters grace without FriendKey', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
    mockFriendKeyAbsent()
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow(),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'active',
          creator_coin_balance_raw: '1000',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: new Date(),
          grace_started_at: null,
          failure_reason: null,
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 0, stale: 0 })
    expect(fakeDb.memberships.get(`${ROOM_ID}:${WALLET_A}`)?.status).toBe('grace')
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'remove',
      reasonKey: 'recheck_grace',
    })
  })

  it('recheck removes a member once their grace period expires and syncs a remove', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
    mockFriendKeyAbsent()
    const graceHours = 24
    const expiredGraceStart = new Date(Date.now() - (graceHours + 1) * 60 * 60 * 1000)
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow({ grace_hours: graceHours }),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'grace',
          creator_coin_balance_raw: '500',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: null,
          grace_started_at: expiredGraceStart,
          failure_reason: 'balance<exit_threshold',
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 1, stale: 0 })
    expect(fakeDb.memberships.get(`${ROOM_ID}:${WALLET_A}`)?.status).toBe('removed')
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledTimes(1)
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'remove',
      reasonKey: 'recheck_removed',
    })
  })

  it('recheck keeps XMTP after grace expiry when FriendKey is still held', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
    mockFriendKeyPresent()
    const graceHours = 24
    const expiredGraceStart = new Date(Date.now() - (graceHours + 1) * 60 * 60 * 1000)
    const fakeDb = createFakeDb({
      policyRow: makePolicyRow({ grace_hours: graceHours }),
      seedMemberships: [
        {
          room_id: ROOM_ID,
          wallet_address: WALLET_A,
          status: 'grace',
          creator_coin_balance_raw: '500',
          quote_threshold_raw: '1000',
          last_checked_at: new Date(),
          last_eligible_at: null,
          grace_started_at: expiredGraceStart,
          failure_reason: 'balance<exit_threshold',
        },
      ],
    })
    getDbMock.mockResolvedValue(fakeDb)

    const result = await recheckAlfaClubRoomAccessMemberships({ roomId: ROOM_ID })

    expect(result).toEqual({ checked: 1, autoEntered: 0, removed: 1, stale: 0 })
    expect(fakeDb.memberships.get(`${ROOM_ID}:${WALLET_A}`)?.status).toBe('removed')
    expect(syncRoomChannelBridgeMembershipMock).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      walletAddress: WALLET_A,
      action: 'add',
      reasonKey: 'recheck_removed',
    })
  })
})

describe('preloadAlfaClubRoomAccessPolicyPoolAddress', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    getAlfaClubPublicClientMock.mockReset()
    vi.stubEnv('ALFACLUB_ROOM_1659_SUDOSWAP_PAIR', POOL_ADDRESS)
    vi.stubEnv('VITE_SUDOSWAP_PAIR_FACTORY', FACTORY_ADDRESS)
    vi.stubEnv('VITE_SUDOSWAP_XYK_CURVE', XYK_CURVE_ADDRESS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function mockPair(overrides: Partial<Record<string, unknown>> = {}) {
    const values: Record<string, unknown> = {
      factory: FACTORY_ADDRESS,
      pairVariant: 3,
      poolType: 2,
      token: CREATOR_COIN_ADDRESS,
      nft: FRIEND_KEY_ADDRESS,
      nftId: 1659n,
      bondingCurve: XYK_CURVE_ADDRESS,
      fee: 69_000_000_000_000_000n,
      isValidPair: true,
      ...overrides,
    }
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => values[functionName])
    getAlfaClubPublicClientMock.mockResolvedValue({ readContract })
    return readContract
  }

  it('returns the configured official ERC1155/ERC20 TRADE pair after validating every pin', async () => {
    const readContract = mockPair()

    const resolved = await preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId: ROOM_ID,
      creatorCoinAddress: CREATOR_COIN_ADDRESS,
      tokenId: ROOM_ID,
    })

    expect(readContract).toHaveBeenCalledTimes(9)
    await expect(Promise.all(readContract.mock.results.map((result) => result.value))).resolves.toEqual([
      FACTORY_ADDRESS,
      3,
      2,
      CREATOR_COIN_ADDRESS,
      FRIEND_KEY_ADDRESS,
      1659n,
      XYK_CURVE_ADDRESS,
      69_000_000_000_000_000n,
      true,
    ])
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({
      address: FACTORY_ADDRESS,
      functionName: 'isValidPair',
      args: [POOL_ADDRESS],
    }))
    expect(resolved).toBe(POOL_ADDRESS)
  })

  it('rejects an explicit pair that differs from the configured room pair without reading it', async () => {
    const readContract = mockPair()

    await expect(preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId: ROOM_ID,
      creatorCoinAddress: CREATOR_COIN_ADDRESS,
      tokenId: ROOM_ID,
      pairAddress: OTHER_ADDRESS,
    })).resolves.toBeNull()
    expect(readContract).not.toHaveBeenCalled()
  })

  it('accepts the VITE-prefixed room pair pin when the server-only alias is absent', async () => {
    vi.stubEnv('ALFACLUB_ROOM_1659_SUDOSWAP_PAIR', '')
    vi.stubEnv('VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR', POOL_ADDRESS)
    mockPair()

    await expect(preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId: ROOM_ID,
      creatorCoinAddress: CREATOR_COIN_ADDRESS,
      tokenId: ROOM_ID,
    })).resolves.toBe(POOL_ADDRESS)
  })

  it('fails closed when live pair introspection does not match the configured market', async () => {
    mockPair({ token: OTHER_ADDRESS })

    await expect(preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId: ROOM_ID,
      creatorCoinAddress: CREATOR_COIN_ADDRESS,
      tokenId: ROOM_ID,
    })).resolves.toBeNull()
  })

  it('rejects an otherwise official pair when its fee is not exactly 6.9%', async () => {
    mockPair({ fee: 68_999_999_999_999_999n })

    await expect(preloadAlfaClubRoomAccessPolicyPoolAddress({
      roomId: ROOM_ID,
      creatorCoinAddress: CREATOR_COIN_ADDRESS,
      tokenId: ROOM_ID,
    })).resolves.toBeNull()
  })
})
