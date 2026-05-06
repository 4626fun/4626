import { afterEach, describe, expect, it } from 'vitest'

import { AKITA_DEFAULTS } from '../../../src/config/contracts.defaults.js'
import {
  readProtocolAmoeCreatorCoin,
  resolveAmoeCreatorTarget,
} from '../lottery/amoeCreatorTarget.js'

const REQUEST_CREATOR = '0x1111111111111111111111111111111111111111'
const PROTOCOL_CREATOR = '0x2222222222222222222222222222222222222222'
const LEGACY_CREATOR = '0x3333333333333333333333333333333333333333'

function withAmoeEnv(
  env: {
    LOTTERY_AMOE_PROTOCOL_CREATOR_COIN?: string
    LOTTERY_AMOE_DEFAULT_CREATOR_COIN?: string
  },
  fn: () => void,
) {
  const previousProtocol = process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN
  const previousDefault = process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN
  try {
    if (env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN === undefined) {
      delete process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN
    } else {
      process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN = env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN
    }

    if (env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN === undefined) {
      delete process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN
    } else {
      process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN = env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN
    }

    fn()
  } finally {
    if (previousProtocol === undefined) delete process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN
    else process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN = previousProtocol

    if (previousDefault === undefined) delete process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN
    else process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN = previousDefault
  }
}

describe('resolveAmoeCreatorTarget', () => {
  afterEach(() => {
    delete process.env.LOTTERY_AMOE_PROTOCOL_CREATOR_COIN
    delete process.env.LOTTERY_AMOE_DEFAULT_CREATOR_COIN
  })

  it('uses an explicit request creator before any environment default', () => {
    withAmoeEnv(
      {
        LOTTERY_AMOE_PROTOCOL_CREATOR_COIN: PROTOCOL_CREATOR,
        LOTTERY_AMOE_DEFAULT_CREATOR_COIN: LEGACY_CREATOR,
      },
      () => {
        expect(resolveAmoeCreatorTarget(REQUEST_CREATOR)).toEqual({
          ok: true,
          creatorCoin: REQUEST_CREATOR,
          source: 'request',
        })
      },
    )
  })

  it('prefers LOTTERY_AMOE_PROTOCOL_CREATOR_COIN when creatorCoin is omitted', () => {
    withAmoeEnv(
      {
        LOTTERY_AMOE_PROTOCOL_CREATOR_COIN: PROTOCOL_CREATOR,
        LOTTERY_AMOE_DEFAULT_CREATOR_COIN: LEGACY_CREATOR,
      },
      () => {
        expect(readProtocolAmoeCreatorCoin()).toBe(PROTOCOL_CREATOR)
        expect(resolveAmoeCreatorTarget(undefined)).toEqual({
          ok: true,
          creatorCoin: PROTOCOL_CREATOR,
          source: 'protocol-default',
        })
      },
    )
  })

  it('falls back to legacy LOTTERY_AMOE_DEFAULT_CREATOR_COIN', () => {
    withAmoeEnv(
      {
        LOTTERY_AMOE_DEFAULT_CREATOR_COIN: LEGACY_CREATOR,
      },
      () => {
        expect(readProtocolAmoeCreatorCoin()).toBe(LEGACY_CREATOR)
        expect(resolveAmoeCreatorTarget('')).toEqual({
          ok: true,
          creatorCoin: LEGACY_CREATOR,
          source: 'protocol-default',
        })
      },
    )
  })

  it('falls back to the current AKITA creator coin when AMOE env vars are unset', () => {
    withAmoeEnv({}, () => {
      expect(readProtocolAmoeCreatorCoin()).toBe(AKITA_DEFAULTS.token.toLowerCase())
      expect(resolveAmoeCreatorTarget(null)).toEqual({
        ok: true,
        creatorCoin: AKITA_DEFAULTS.token.toLowerCase(),
        source: 'protocol-default',
      })
    })
  })

  it('rejects invalid explicit creatorCoin instead of silently defaulting', () => {
    withAmoeEnv(
      {
        LOTTERY_AMOE_PROTOCOL_CREATOR_COIN: PROTOCOL_CREATOR,
      },
      () => {
        expect(resolveAmoeCreatorTarget('not-an-address')).toEqual({
          ok: false,
          error: 'invalid_creator_coin',
        })
      },
    )
  })
})
