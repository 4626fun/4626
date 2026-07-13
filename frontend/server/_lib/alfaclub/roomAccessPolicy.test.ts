import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  syncRoomChannelBridgeMembershipMock,
  backfillActiveRoomChannelBridgeMembersMock,
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
  getDbMock: vi.fn(),
  ensureAlfaClubVigilanteSchemaMock: vi.fn(async () => undefined),
  getKeeprBaseRpcUrlsMock: vi.fn(() => ['http://fake-rpc.invalid']),
  getAlfaClubPublicClientMock: vi.fn(async () => ({}) as unknown),
  createPublicClientMock: vi.fn(),
  readContractMock: vi.fn(),
  // Mutable box so tests can tweak on-chain quote/balances without re-mocking modules.
  eligibilityState: {
    quoteRaw: 1000n,
    balances: new Map<string, bigint>(),
  },
}))

vi.mock('./roomChannelBridge.js', () => ({
  syncRoomChannelBridgeMembership: syncRoomChannelBridgeMembershipMock,
  backfillActiveRoomChannelBridgeMembers: backfillActiveRoomChannelBridgeMembersMock,
}))

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
  recheckAlfaClubRoomAccessMemberships,
} from './roomAccessPolicy.js'

const ROOM_ID = '1659'
const CREATOR_COIN_ADDRESS = `0x${'11'.repeat(20)}` as `0x${string}`
const POOL_ADDRESS = `0x${'22'.repeat(20)}` as `0x${string}`
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
    ensureAlfaClubVigilanteSchemaMock.mockReset()
    ensureAlfaClubVigilanteSchemaMock.mockResolvedValue(undefined)
    getKeeprBaseRpcUrlsMock.mockReset()
    getKeeprBaseRpcUrlsMock.mockReturnValue(['http://fake-rpc.invalid'])
    getAlfaClubPublicClientMock.mockReset()
    getAlfaClubPublicClientMock.mockResolvedValue({})
    readContractMock.mockReset()
    readContractMock.mockImplementation(async (args: { functionName: string; args: unknown[] }) => {
      if (args.functionName === 'quoteBuyKeys') return eligibilityState.quoteRaw
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
    eligibilityState.quoteRaw = 1000n
    eligibilityState.balances = new Map()
    getDbMock.mockReset()
  })

  it('joinAlfaClubRoomAccess syncs an XMTP group add for a wallet that meets the enter threshold', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
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
    })
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

  it('recheck auto-enters a pending member once balance clears the enter threshold and syncs an add', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 1_000n)
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
    })
  })

  it('recheck does not re-sync a member that was already active and stays active', async () => {
    // 950 is below the 1000 enter threshold but still above the 900 exit threshold.
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 950n)
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

  it('recheck moves an active member into grace (no sync yet) once balance drops below the exit threshold', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
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
    expect(syncRoomChannelBridgeMembershipMock).not.toHaveBeenCalled()
  })

  it('recheck removes a member once their grace period expires and syncs a remove', async () => {
    eligibilityState.balances.set(WALLET_A.toLowerCase(), 500n)
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
    })
  })
})
