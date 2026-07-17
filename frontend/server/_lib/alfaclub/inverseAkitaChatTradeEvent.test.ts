import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isAlfaClubChipUsername,
  isAlfaClubTradeCompletedSender,
  parseInverseAkitaChatTradeEvent,
  resolveInverseAkitaTradeEventAuthor,
} from './inverseAkitaChatTradeEvent.js'

function marketOpenPayload(params: {
  asset: string
  isBuy: boolean
  direction?: 'open' | 'close'
  reduceOnly?: boolean
  withPosition?: boolean
  userAddress?: string
}): string {
  const verificationDetails = {
    id: '',
    text: JSON.stringify({
      order: {
        asset: params.asset,
        isBuy: params.isBuy,
        reduceOnly: params.reduceOnly === true,
      },
      direction: params.direction ?? 'open',
    }),
    date: '1',
  }
  const body: Record<string, unknown> = {
    order_type: 'market',
    size: '1.0',
    asset: params.asset,
    room: '1484',
    isBuy: params.isBuy,
    verificationDetails,
    oid: 1,
  }
  if (params.withPosition) {
    body.position = { type: 'oneWay', position: { coin: params.asset, szi: '1' } }
  }
  if (params.userAddress) body.userAddress = params.userAddress
  return JSON.stringify(body)
}

describe('parseInverseAkitaChatTradeEvent', () => {
  it('parses HL market opens as user long/short', () => {
    expect(parseInverseAkitaChatTradeEvent(marketOpenPayload({ asset: 'HYPE', isBuy: true }))).toEqual({
      userSide: 'long',
      pair: 'HYPE',
      userAddress: null,
      direction: 'open',
      source: 'hl_market',
    })
    expect(
      parseInverseAkitaChatTradeEvent(marketOpenPayload({ asset: 'xyz:SP500', isBuy: false })),
    ).toEqual({
      userSide: 'short',
      pair: 'XYZ:SP500',
      userAddress: null,
      direction: 'open',
      source: 'hl_market',
    })
  })

  it('parses Chip fill-dir Open Long/Short cards', () => {
    expect(
      parseInverseAkitaChatTradeEvent(
        JSON.stringify({ coin: 'BTC', dir: 'Open Short', sz: '0.01', side: 'A' }),
      ),
    ).toEqual({
      userSide: 'short',
      pair: 'BTC',
      userAddress: null,
      direction: 'open',
      source: 'hl_fill_dir',
    })
  })

  it('skips closes, reduce-only, position companions, and spot fills', () => {
    expect(
      parseInverseAkitaChatTradeEvent(
        marketOpenPayload({ asset: 'SOL', isBuy: false, direction: 'close' }),
      ),
    ).toBeNull()
    expect(
      parseInverseAkitaChatTradeEvent(
        marketOpenPayload({ asset: 'SOL', isBuy: true, reduceOnly: true }),
      ),
    ).toBeNull()
    expect(
      parseInverseAkitaChatTradeEvent(
        marketOpenPayload({ asset: 'SOL', isBuy: true, withPosition: true }),
      ),
    ).toBeNull()
    expect(
      parseInverseAkitaChatTradeEvent(
        JSON.stringify({ coin: 'CASHCAT', dir: 'Close Long', sz: '1' }),
      ),
    ).toBeNull()
    expect(
      parseInverseAkitaChatTradeEvent(
        JSON.stringify({
          type: 'spot-trade-completed',
          isBuy: true,
          tokenSymbol: 'ANSEM',
          userAddress: '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8',
        }),
      ),
    ).toBeNull()
  })

  it('recognizes Chip / trade-completed senders', () => {
    expect(isAlfaClubTradeCompletedSender('trade-completed')).toBe(true)
    expect(isAlfaClubTradeCompletedSender('Chip')).toBe(true)
    expect(isAlfaClubChipUsername('chip')).toBe(true)
    expect(isAlfaClubTradeCompletedSender('0xabc')).toBe(false)
  })
})

describe('resolveInverseAkitaTradeEventAuthor', () => {
  it('prefers payload, then recent human speaker, then room creator', () => {
    expect(
      resolveInverseAkitaTradeEventAuthor({
        payloadAddress: '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8',
        roomCreatorAddress: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
        messageDate: 100,
        priorSpeakers: [],
      }),
    ).toBe('0x940e6d3964a48180365e38a1013ba19ad1f3c6c8')

    expect(
      resolveInverseAkitaTradeEventAuthor({
        payloadAddress: null,
        roomCreatorAddress: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
        messageDate: 200,
        excludeAddresses: ['0x8719fa7be10533fd69885b124a8c84f9c51071af'],
        priorSpeakers: [
          { sender: '0x8719fa7be10533fd69885b124a8c84f9c51071af', date: 180 },
          { sender: '0xa85438f44e3e1d27f652ff4da18905761d5dabaf', date: 150 },
          { sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5', date: 100 },
        ],
      }),
    ).toBe('0xa85438f44e3e1d27f652ff4da18905761d5dabaf')

    expect(
      resolveInverseAkitaTradeEventAuthor({
        payloadAddress: null,
        roomCreatorAddress: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
        messageDate: 50,
        priorSpeakers: [{ sender: '0xa85438f44e3e1d27f652ff4da18905761d5dabaf', date: 150 }],
      }),
    ).toBe('0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5')
  })
})

describe('collectInverseAkitaChatTradeIntents + Chip', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.doUnmock('./roomLabelCache.js')
  })

  it('attributes Chip opens to the most recent human speaker (any staker)', async () => {
    vi.resetModules()
    vi.doMock('./roomLabelCache.js', () => ({
      readRoomLabelStatus: vi.fn(async () => [
        {
          roomId: '2',
          creatorAddress: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
          displayLabel: 'owner',
          source: 'test',
          confidence: 1,
          expiresAt: null,
          isFresh: true,
        },
      ]),
    }))
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '2,1484,1659')
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_LLM_ENABLED', '0')

    const { collectInverseAkitaChatTradeIntents } = await import('./inverseAkitaChatReaction.js')
    const intents = await collectInverseAkitaChatTradeIntents({
      roomId: '2',
      messages: [
        {
          id: 'chat-1',
          sender: '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8',
          username: 'Flip_Research',
          text: 'sending it',
          date: 1_000,
        },
        {
          id: 'trade-1',
          sender: 'trade-completed',
          text: marketOpenPayload({ asset: 'xyz:SP500', isBuy: false }),
          date: 1_100,
        },
      ],
      llmConfig: {
        enabled: false,
        mode: 'classify',
        failMode: 'allow',
        timeoutMs: 1_000,
      },
    })

    expect(intents).toHaveLength(1)
    expect(intents[0]).toMatchObject({
      sender: '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8',
      userSide: 'short',
      pair: 'XYZ:SP500',
      parseMode: 'strict',
      publicAuthorLabel: 'Chip',
    })
  })

  it('falls back to room creator when Chip has no nearby speaker', async () => {
    vi.resetModules()
    vi.doMock('./roomLabelCache.js', () => ({
      readRoomLabelStatus: vi.fn(async () => [
        {
          roomId: '1484',
          creatorAddress: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
          displayLabel: 'Manito9v9',
          source: 'test',
          confidence: 1,
          expiresAt: null,
          isFresh: true,
        },
      ]),
    }))
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '1484,1659')
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_LLM_ENABLED', '0')

    const { collectInverseAkitaChatTradeIntents } = await import('./inverseAkitaChatReaction.js')
    const intents = await collectInverseAkitaChatTradeIntents({
      roomId: '1484',
      messages: [
        {
          id: 'trade-1',
          sender: 'trade-completed',
          text: marketOpenPayload({ asset: 'HYPE', isBuy: true }),
          date: Date.now(),
        },
      ],
      llmConfig: {
        enabled: false,
        mode: 'classify',
        failMode: 'allow',
        timeoutMs: 1_000,
      },
    })

    expect(intents).toHaveLength(1)
    expect(intents[0]).toMatchObject({
      sender: '0x8e521dfddc4a2bc6f30b5fb595263d0388af5fd5',
      userSide: 'long',
      pair: 'HYPE',
      parseMode: 'strict',
    })
  })
})
