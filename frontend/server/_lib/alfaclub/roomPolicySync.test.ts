import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDbMock,
  ensureAlfaClubVigilanteSchemaMock,
  readOperationalAlfaClubRoomIdsMock,
  preloadAlfaClubRoomAccessPolicyPoolAddressMock,
  upsertAlfaClubRoomAccessPolicyMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureAlfaClubVigilanteSchemaMock: vi.fn(async () => undefined),
  readOperationalAlfaClubRoomIdsMock: vi.fn(() => new Set<string>()),
  preloadAlfaClubRoomAccessPolicyPoolAddressMock: vi.fn(),
  upsertAlfaClubRoomAccessPolicyMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({ getDb: getDbMock }))
vi.mock('./schema.js', () => ({ ensureAlfaClubVigilanteSchema: ensureAlfaClubVigilanteSchemaMock }))
vi.mock('./creatorRoomLinks.js', () => ({ readOperationalAlfaClubRoomIds: readOperationalAlfaClubRoomIdsMock }))
vi.mock('./roomAccessPolicy.js', () => ({
  preloadAlfaClubRoomAccessPolicyPoolAddress: preloadAlfaClubRoomAccessPolicyPoolAddressMock,
  upsertAlfaClubRoomAccessPolicy: upsertAlfaClubRoomAccessPolicyMock,
}))

import { readRoomCreatorCoinMap, syncCreatorRoomPoliciesFromSnapshot } from './roomPolicySync'

const originalMap = process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON

afterEach(() => {
  if (originalMap === undefined) {
    delete process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON
  } else {
    process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON = originalMap
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  readOperationalAlfaClubRoomIdsMock.mockReturnValue(new Set())
})

describe('readRoomCreatorCoinMap', () => {
  it('pins room 1659 to the verified AKITA Creator Coin', () => {
    delete process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON
    expect(readRoomCreatorCoinMap().get('1659')).toBe(
      '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    )
  })

  it('accepts explicit room mappings without using creator wallet addresses', () => {
    process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON = JSON.stringify({
      '1043': '0x1111111111111111111111111111111111111111',
    })

    expect(readRoomCreatorCoinMap().get('1043')).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })

  it('fails closed on malformed mappings', () => {
    process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON = '{"1043":"not-an-address"}'
    expect(() => readRoomCreatorCoinMap()).toThrow(
      'alfaclub_room_creator_coin_map_entry_invalid:1043',
    )
  })
})

describe('syncCreatorRoomPoliciesFromSnapshot', () => {
  const creatorCoin = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
  const pair = '0x2222222222222222222222222222222222222222' as const

  beforeEach(() => {
    delete process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({
        rows: [{
          room_id: '1659',
          token_id: '1659',
          creator_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }],
      })),
    })
    preloadAlfaClubRoomAccessPolicyPoolAddressMock.mockResolvedValue(pair)
    upsertAlfaClubRoomAccessPolicyMock.mockResolvedValue({})
  })

  it('writes only the authenticated official pair returned by the preload validator', async () => {
    const result = await syncCreatorRoomPoliciesFromSnapshot()

    expect(result).toEqual({ ok: true, candidateCount: 1, upserted: 1 })
    expect(preloadAlfaClubRoomAccessPolicyPoolAddressMock).toHaveBeenCalledWith({
      roomId: '1659',
      tokenId: '1659',
      creatorCoinAddress: creatorCoin,
      pairAddress: null,
    })
    expect(upsertAlfaClubRoomAccessPolicyMock).toHaveBeenCalledWith({
      roomId: '1659',
      tokenId: '1659',
      creatorCoinAddress: creatorCoin,
      poolAddress: pair,
      enabled: false,
      actorAddress: null,
    })
  })

  it('fails closed and skips the policy when official-pair validation fails', async () => {
    preloadAlfaClubRoomAccessPolicyPoolAddressMock.mockResolvedValue(null)

    await expect(syncCreatorRoomPoliciesFromSnapshot()).resolves.toEqual({
      ok: true,
      candidateCount: 0,
      upserted: 0,
    })
    expect(upsertAlfaClubRoomAccessPolicyMock).not.toHaveBeenCalled()
  })

  it('validates an explicitly supplied pair before using it', async () => {
    const result = await syncCreatorRoomPoliciesFromSnapshot({ poolAddress: pair, dryRun: true })

    expect(result).toEqual({ ok: true, candidateCount: 1, upserted: 0 })
    expect(preloadAlfaClubRoomAccessPolicyPoolAddressMock).toHaveBeenCalledWith(expect.objectContaining({
      pairAddress: pair,
    }))
    expect(upsertAlfaClubRoomAccessPolicyMock).not.toHaveBeenCalled()
  })
})
