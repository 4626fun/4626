import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../arena/arenaClient.js', () => ({
  runArenaTrade: vi.fn(),
}))

vi.mock('../arena/arenaIdentityMappingStore.js', () => ({
  resolveRoomDefaultArenaIdentity: vi.fn(),
}))

vi.mock('../hermit/policy.js', () => ({
  isHermitOwner: vi.fn(() => false),
  isHermitUserAllowed: vi.fn(() => false),
}))

vi.mock('./hyperliquid.js', () => ({
  getPerpMarkets: vi.fn(),
}))

import { runArenaTrade } from '../arena/arenaClient.js'
import { resolveRoomDefaultArenaIdentity } from '../arena/arenaIdentityMappingStore.js'
import { isHermitUserAllowed } from '../hermit/policy.js'
import { getPerpMarkets } from './hyperliquid.js'
import {
  __resetInverseAkitaChatReactionCooldownForTests,
  __resetInverseAkitaChatReactionMarketCacheForTests,
  collectInverseAkitaChatTradeIntents,
  computeInverseAkitaChatReactionLeverage,
  executeInverseAkitaChatReaction,
  formatInverseAkitaChatReactionReply,
  isInverseAkitaChatReactionSenderCoolingDown,
  parseInverseAkitaChatTradeIntent,
  resolveInverseAkitaChatReactionLeverage,
} from './inverseAkitaChatReaction.js'

const mockRunArenaTrade = vi.mocked(runArenaTrade)
const mockResolveRoomDefaultArenaIdentity = vi.mocked(resolveRoomDefaultArenaIdentity)
const mockIsHermitUserAllowed = vi.mocked(isHermitUserAllowed)
const mockGetPerpMarkets = vi.mocked(getPerpMarkets)

describe('inverseAkitaChatReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetInverseAkitaChatReactionCooldownForTests()
    __resetInverseAkitaChatReactionMarketCacheForTests()
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ENABLED', '1')
    vi.stubEnv('ARENA_ENABLED', '1')
    vi.stubEnv('ARENA_TRADING_ENABLED', '1')
    mockGetPerpMarkets.mockResolvedValue([
      { symbol: 'BTC', maxLeverage: 40 },
      { symbol: 'ETH', maxLeverage: 25 },
    ])
    mockResolveRoomDefaultArenaIdentity.mockResolvedValue({
      source: 'room_default',
      roomId: '1659',
      senderAddress: '*',
      agentId: '1213',
      agentWalletAddress: '0xagentwallet',
      hlApiWalletAddress: '0xhlwallet',
    })
    mockRunArenaTrade.mockResolvedValue({ ok: true, message: 'ok' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses casual long/short chat intents', () => {
    expect(parseInverseAkitaChatTradeIntent('long btc')).toEqual({
      userSide: 'long',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('go long eth')).toEqual({
      userSide: 'long',
      pair: 'ETH',
    })
    expect(parseInverseAkitaChatTradeIntent('going short on SOL!')).toEqual({
      userSide: 'short',
      pair: 'SOL',
    })
    expect(parseInverseAkitaChatTradeIntent('/h arena long BTC 50 5')).toBeNull()
    expect(parseInverseAkitaChatTradeIntent('thinking about long btc')).toBeNull()
  })

  it('collects intents for room 1659 and skips operators', () => {
    mockIsHermitUserAllowed.mockImplementation(
      (address) => address.toLowerCase() === '0x1111111111111111111111111111111111111111',
    )
    const intents = collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        { id: '1', sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', text: 'long btc' },
        { id: '2', sender: '0x1111111111111111111111111111111111111111', text: 'long btc' },
        { id: '3', sender: '0x2222222222222222222222222222222222222222', text: 'gm' },
      ],
    })
    expect(intents).toHaveLength(1)
    expect(intents[0]?.pair).toBe('BTC')
    expect(intents[0]?.userSide).toBe('long')
  })

  it('uses 69% of Hyperliquid max leverage by default', () => {
    expect(computeInverseAkitaChatReactionLeverage({ maxLeverage: 40, pct: 69 })).toBe(27)
    expect(computeInverseAkitaChatReactionLeverage({ maxLeverage: 25, pct: 69 })).toBe(17)
  })

  it('resolves leverage from live perp market meta', async () => {
    await expect(resolveInverseAkitaChatReactionLeverage('BTC')).resolves.toBe(27)
    await expect(resolveInverseAkitaChatReactionLeverage('ETH')).resolves.toBe(17)
    expect(mockGetPerpMarkets).toHaveBeenCalledTimes(1)
  })

  it('formats the inverse reply copy', () => {
    expect(
      formatInverseAkitaChatReactionReply({
        userSide: 'long',
        pair: 'BTC',
        counterSide: 'short',
        sizeUsd: 50,
        leverage: 27,
        dryRun: false,
        tradeOk: true,
      }),
    ).toContain('you said long BTC. i shorted BTC instead lol')
  })

  it('executes the opposite side on InverseAKITA wallet', async () => {
    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'm1',
        date: Date.now(),
        sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        text: 'long btc',
        userSide: 'long',
        pair: 'BTC',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.counterSide).toBe('short')
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open', pair: 'BTC', side: 'short', leverage: 27 }),
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
    expect(result.replyText).toContain('shorted BTC instead lol (50 @ 27x)')
  })

  it('rate-limits repeat reactions from the same sender', async () => {
    const intent = {
      id: 'm1',
      date: Date.now(),
      sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      text: 'long btc',
      userSide: 'long' as const,
      pair: 'BTC',
    }
    await executeInverseAkitaChatReaction({ roomId: '1659', intent })
    expect(isInverseAkitaChatReactionSenderCoolingDown(intent.sender)).toBe(true)

    mockRunArenaTrade.mockClear()
    const second = await executeInverseAkitaChatReaction({ roomId: '1659', intent })
    expect(second.skipReason).toBe('sender_cooldown')
    expect(mockRunArenaTrade).not.toHaveBeenCalled()
  })
})
