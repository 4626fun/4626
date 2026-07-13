import { afterEach, describe, expect, it } from 'vitest'

import { readRoomCreatorCoinMap } from './roomPolicySync'

const originalMap = process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON

afterEach(() => {
  if (originalMap === undefined) {
    delete process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON
  } else {
    process.env.ALFACLUB_ROOM_CREATOR_COIN_MAP_JSON = originalMap
  }
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
