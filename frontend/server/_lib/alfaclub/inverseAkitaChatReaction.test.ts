import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../arena/arenaClient.js', async () => {
  const actual = await vi.importActual<typeof import('../arena/arenaClient.js')>(
    '../arena/arenaClient.js',
  )
  return {
    parseTradeFillFromOutput: actual.parseTradeFillFromOutput,
    resolveOpenArenaPositionSide: actual.resolveOpenArenaPositionSide,
    runArenaOpenPositions: vi.fn(),
    runArenaTrade: vi.fn(),
  }
})

vi.mock('../arena/arenaIdentityMappingStore.js', () => ({
  resolveRoomDefaultArenaIdentity: vi.fn(),
}))

vi.mock('./inverseAkitaChatReactionPolicy.js', async () => {
  const actual = await vi.importActual<typeof import('./inverseAkitaChatReactionPolicy.js')>(
    './inverseAkitaChatReactionPolicy.js',
  )
  return {
    ...actual,
    resolveInverseAkitaChatAuthorAccess: vi.fn(),
  }
})

vi.mock('./hyperliquid.js', () => ({
  getAllPerpMarkets: vi.fn(),
}))

import { runArenaOpenPositions, runArenaTrade } from '../arena/arenaClient.js'
import { resolveRoomDefaultArenaIdentity } from '../arena/arenaIdentityMappingStore.js'
import { resolveInverseAkitaChatAuthorAccess } from './inverseAkitaChatReactionPolicy.js'
import { getAllPerpMarkets } from './hyperliquid.js'
import {
  __resetInverseAkitaBotOutboundTextRegistryForTests,
  __resetInverseAkitaChatReactionCooldownForTests,
  __resetInverseAkitaChatReactionMarketCacheForTests,
  collectInverseAkitaChatTradeIntents,
  computeInverseAkitaChatReactionLeverage,
  executeInverseAkitaChatReaction,
  formatInverseAkitaChatReactionReply,
  formatInverseAkitaChatReactionSkipReply,
  formatInverseAkitaThreadReceipt,
  INVERSE_AKITA_CHAT_REACTION_EMOJIS,
  isInverseAkitaBotAuthoredChatText,
  isRegisteredInverseAkitaBotOutboundText,
  registerInverseAkitaBotOutboundText,
  resolveInverseAkitaChatReactionEmoji,
  isInverseAkitaChatReactionSenderCoolingDown,
  parseInverseAkitaChatTradeIntent,
  resolveInverseAkitaChatReactionLeverage,
  resolveInverseChatPositionAction,
  summarizeInverseTradeFailureDetail,
} from './inverseAkitaChatReaction.js'

const mockRunArenaTrade = vi.mocked(runArenaTrade)
const mockRunArenaOpenPositions = vi.mocked(runArenaOpenPositions)
const mockResolveRoomDefaultArenaIdentity = vi.mocked(resolveRoomDefaultArenaIdentity)
const mockResolveInverseAkitaChatAuthorAccess = vi.mocked(resolveInverseAkitaChatAuthorAccess)
const mockGetAllPerpMarkets = vi.mocked(getAllPerpMarkets)

describe('inverseAkitaChatReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetInverseAkitaChatReactionCooldownForTests()
    __resetInverseAkitaChatReactionMarketCacheForTests()
    __resetInverseAkitaBotOutboundTextRegistryForTests()
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ENABLED', '1')
    vi.stubEnv('ARENA_ENABLED', '1')
    vi.stubEnv('ARENA_TRADING_ENABLED', '1')
    mockGetAllPerpMarkets.mockResolvedValue([
      { symbol: 'BTC', maxLeverage: 40 },
      { symbol: 'ETH', maxLeverage: 25 },
      { symbol: 'xyz:CARDS', maxLeverage: 10 },
      { symbol: 'xyz:TSLA', maxLeverage: 10 },
      { symbol: 'REI', maxLeverage: 5 },
    ])
    mockResolveRoomDefaultArenaIdentity.mockResolvedValue({
      source: 'room_default',
      roomId: '1659',
      senderAddress: '*',
      agentId: '1213',
      agentWalletAddress: '0xagentwallet',
      hlApiWalletAddress: '0xhlwallet',
    })
    mockResolveInverseAkitaChatAuthorAccess.mockResolvedValue({
      eligible: true,
      stakedKeys: 1,
      reason: 'staker',
    })
    mockRunArenaOpenPositions.mockResolvedValue({
      ok: true,
      message: 'no positions',
      details: { positions: [] },
    })
    mockRunArenaTrade.mockResolvedValue({ ok: true, message: 'ok' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('formats skip replies for operator-visible config failures', () => {
    expect(formatInverseAkitaChatReactionSkipReply('arena_trading_disabled')).toMatch(/arena trading is off/i)
    expect(formatInverseAkitaChatReactionSkipReply('missing_executor_wallet')).toMatch(/executor wallet/i)
    expect(formatInverseAkitaChatReactionSkipReply('insufficient_stake')).toMatch(/stake/i)
    expect(formatInverseAkitaChatReactionSkipReply('sender_cooldown')).toBeNull()
  })

  it('parses mention-led and question-style trade intents', () => {
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
    expect(parseInverseAkitaChatTradeIntent('hey @flip_research should i short btc?')).toEqual({
      userSide: 'short',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('should i long eth')).toEqual({
      userSide: 'long',
      pair: 'ETH',
    })
    expect(parseInverseAkitaChatTradeIntent('@flip_research short btc')).toEqual({
      userSide: 'short',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('/h arena long BTC 50 5')).toBeNull()
  })

  it('parses loose market-opinion sentiment for known assets', () => {
    expect(parseInverseAkitaChatTradeIntent('btc looking bullish today')).toEqual({
      userSide: 'long',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('eth is gonna dump hard')).toEqual({
      userSide: 'short',
      pair: 'ETH',
    })
    expect(parseInverseAkitaChatTradeIntent('sol gonna pump tonight')).toEqual({
      userSide: 'long',
      pair: 'SOL',
    })
    expect(parseInverseAkitaChatTradeIntent('bearish on doge ngl')).toEqual({
      userSide: 'short',
      pair: 'DOGE',
    })
    expect(parseInverseAkitaChatTradeIntent('btc to 100k')).toEqual({
      userSide: 'long',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('eth is dead bro')).toEqual({
      userSide: 'short',
      pair: 'ETH',
    })
    expect(parseInverseAkitaChatTradeIntent('should i buy some bitcoin here')).toEqual({
      userSide: 'long',
      pair: 'BTC',
    })
    expect(parseInverseAkitaChatTradeIntent('$wif looks cooked')).toEqual({
      userSide: 'short',
      pair: 'WIF',
    })
    expect(parseInverseAkitaChatTradeIntent('thinking about long btc')).toEqual({
      userSide: 'long',
      pair: 'BTC',
    })
  })

  it('parses casual opinions for any live Hyperliquid market', () => {
    const availableMarkets = [
      { symbol: 'REI', maxLeverage: 5 },
      { symbol: 'xyz:CARDS', maxLeverage: 10 },
      { symbol: 'xyz:TSLA', maxLeverage: 10 },
    ]
    expect(
      parseInverseAkitaChatTradeIntent('rei has lost momentum again', {
        availableMarkets,
      }),
    ).toEqual({
      userSide: 'short',
      pair: 'REI',
    })
    expect(
      parseInverseAkitaChatTradeIntent('makes me more bullish $cards', {
        availableMarkets,
      }),
    ).toEqual({
      userSide: 'long',
      pair: 'xyz:CARDS',
    })
    expect(
      parseInverseAkitaChatTradeIntent('bearish on xyz:tsla', {
        availableMarkets,
      }),
    ).toEqual({
      userSide: 'short',
      pair: 'xyz:TSLA',
    })
  })

  it('does not guess an unqualified symbol shared by multiple HIP-3 markets', () => {
    expect(
      parseInverseAkitaChatTradeIntent('bullish $tsla', {
        availableMarkets: [
          { symbol: 'xyz:TSLA', maxLeverage: 10 },
          { symbol: 'cash:TSLA', maxLeverage: 10 },
        ],
      }),
    ).toBeNull()
  })

  it('flips negated sentiment and skips ambiguous or asset-free chatter', () => {
    expect(parseInverseAkitaChatTradeIntent('btc is not looking good')).toEqual({
      userSide: 'short',
      pair: 'BTC',
    })
    // no recognizable asset — never trade on vibes alone
    expect(parseInverseAkitaChatTradeIntent('everything is pumping lol')).toBeNull()
    // mixed signals — skip
    expect(parseInverseAkitaChatTradeIntent('btc could pump or dump who knows')).toBeNull()
    // plain chatter with an asset but no opinion
    expect(parseInverseAkitaChatTradeIntent('anyone watching btc rn')).toBeNull()
    expect(parseInverseAkitaChatTradeIntent('gm')).toBeNull()
  })

  it('collects intents for room 1659 from any hex sender including operators', () => {
    const intents = collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        { id: '1', sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', text: 'long btc' },
        { id: '2', sender: '0x1111111111111111111111111111111111111111', text: 'should i long eth' },
        { id: '3', sender: '0x2222222222222222222222222222222222222222', text: 'gm' },
      ],
    })
    expect(intents).toHaveLength(2)
    expect(intents[0]?.pair).toBe('BTC')
    expect(intents[1]?.pair).toBe('ETH')
  })

  it('collects configured owner-room opinions but ignores unsupported rooms', () => {
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS',
      '1484,1660,2,1043,1659',
    )
    expect(
      collectInverseAkitaChatTradeIntents({
        roomId: '1484',
        messages: [
          {
            id: 'owner-opinion',
            sender: '0x1111111111111111111111111111111111111111',
            text: 'btc looks bullish',
          },
        ],
      }),
    ).toHaveLength(1)
    expect(
      collectInverseAkitaChatTradeIntents({
        roomId: '9999',
        messages: [
          {
            id: 'unsupported',
            sender: '0x1111111111111111111111111111111111111111',
            text: 'btc looks bullish',
          },
        ],
      }),
    ).toEqual([])
  })

  it('ignores InverseAKITA outbound copy and quote-reply sentiment loops', () => {
    const botTrimReply =
      'long SOL gang? i was already there. trimmed anyway ($50)'
    expect(isInverseAkitaBotAuthoredChatText(botTrimReply)).toBe(true)
    expect(
      parseInverseAkitaChatTradeIntent(botTrimReply, { allowLooseSentiment: false }),
    ).toBeNull()

    registerInverseAkitaBotOutboundText(botTrimReply)
    expect(isRegisteredInverseAkitaBotOutboundText(botTrimReply)).toBe(true)

    const intents = collectInverseAkitaChatTradeIntents({
      roomId: '1659',
      messages: [
        {
          id: 'bot-1',
          sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          text: botTrimReply,
          reply_id: 'user-1',
        },
        {
          id: 'user-1',
          sender: '0x1111111111111111111111111111111111111111',
          text: 'long sol',
        },
        {
          id: 'pilot',
          sender: '0x2222222222222222222222222222222222222222',
          text: 'InverseAKITA pilot — stake ≥1 FriendKey in this room to trade on InverseAKITA\'s wallet.',
        },
      ],
    })
    expect(intents).toEqual([
      expect.objectContaining({ id: 'user-1', pair: 'SOL', userSide: 'long' }),
    ])
  })

  it('still parses explicit trade intents inside quote-replies', () => {
    expect(
      parseInverseAkitaChatTradeIntent('long sol', { allowLooseSentiment: false }),
    ).toEqual({ userSide: 'long', pair: 'SOL' })
  })

  it('uses 69% of Hyperliquid max leverage by default', () => {
    expect(computeInverseAkitaChatReactionLeverage({ maxLeverage: 40, pct: 69 })).toBe(27)
    expect(computeInverseAkitaChatReactionLeverage({ maxLeverage: 25, pct: 69 })).toBe(17)
  })

  it('resolves leverage from live perp market meta', async () => {
    await expect(resolveInverseAkitaChatReactionLeverage('BTC')).resolves.toBe(27)
    await expect(resolveInverseAkitaChatReactionLeverage('ETH')).resolves.toBe(17)
    expect(mockGetAllPerpMarkets).toHaveBeenCalledTimes(1)
  })

  it('alternates inverse trigger reaction emojis', () => {
    expect(INVERSE_AKITA_CHAT_REACTION_EMOJIS).toEqual(['🔄', '🙃'])
    expect(resolveInverseAkitaChatReactionEmoji('msg-a')).toBe('🙃')
    expect(resolveInverseAkitaChatReactionEmoji('msg-b')).toBe('🔄')
  })

  it('formats sarcastic inverse reply copy', () => {
    const reply = formatInverseAkitaChatReactionReply({
      seed: 'm1',
      userSide: 'long',
      pair: 'BTC',
      counterSide: 'short',
      sizeUsd: 50,
      leverage: 27,
      dryRun: false,
      tradeOk: true,
    })
    expect(reply).toMatch(/short/i)
    expect(reply).toContain('BTC')
    expect(reply).toContain('50 @ 27x')
  })

  it('formats add-to-position copy when stacking an existing leg', () => {
    const reply = formatInverseAkitaChatReactionReply({
      seed: 'm-add',
      userSide: 'short',
      pair: 'ETH',
      counterSide: 'long',
      sizeUsd: 50,
      leverage: 17,
      dryRun: false,
      tradeOk: true,
      positionAction: 'add',
    })
    expect(reply).toMatch(/bottom signal|sized up|stacked|increased/i)
    expect(reply).toContain('ETH')
    expect(reply).toContain('50')
  })

  it('formats trim copy when the open leg conflicts with the inverse side', () => {
    const reply = formatInverseAkitaChatReactionReply({
      seed: 'm-trim',
      userSide: 'long',
      pair: 'ETH',
      counterSide: 'short',
      existingSide: 'long',
      sizeUsd: 50,
      leverage: 17,
      dryRun: false,
      tradeOk: true,
      positionAction: 'trim',
    })
    expect(reply).toMatch(/trimmed|exit signal|top signal/i)
    expect(reply).toContain('ETH')
    expect(reply).toContain('50')
  })

  it('resolves position action from open book vs counter side', () => {
    expect(resolveInverseChatPositionAction({ openSide: null, counterSide: 'short' })).toBe('open')
    expect(resolveInverseChatPositionAction({ openSide: 'long', counterSide: 'long' })).toBe('add')
    expect(resolveInverseChatPositionAction({ openSide: 'long', counterSide: 'short' })).toBe('trim')
    expect(resolveInverseChatPositionAction({ openSide: 'short', counterSide: 'long' })).toBe('trim')
  })

  it('formats sarcastic fail copy when trade rejects', () => {
    const reply = formatInverseAkitaChatReactionReply({
      seed: 'm2',
      userSide: 'short',
      pair: 'ETH',
      counterSide: 'long',
      sizeUsd: 50,
      leverage: 17,
      dryRun: false,
      tradeOk: false,
    })
    expect(reply).toMatch(/long|ETH|failed|no/i)
  })

  it('appends the real failure detail instead of a bare Command failed line', () => {
    expect(
      summarizeInverseTradeFailureDetail({
        error: 'Command failed: npx tsx scripts/trade.ts open --pair BTC --side short',
        stdout: 'Failed to sign with ACP CLI. Make sure acp-cli is configured:\n  acp configure',
      }),
    ).toBe('Failed to sign with ACP CLI. Make sure acp-cli is configured:')
    expect(summarizeInverseTradeFailureDetail(null)).toBeNull()

    const reply = formatInverseAkitaChatReactionReply({
      seed: 'm3',
      userSide: 'long',
      pair: 'BTC',
      counterSide: 'short',
      sizeUsd: 11,
      leverage: 27,
      dryRun: false,
      tradeOk: false,
      failDetail: 'Failed to sign with ACP CLI.',
    })
    expect(reply).toContain('(Failed to sign with ACP CLI.)')
  })

  it('formats a thread receipt with fill detail, dry-run tag, and fail detail', () => {
    expect(
      formatInverseAkitaThreadReceipt({
        pair: 'BTC',
        counterSide: 'short',
        sizeUsd: 11,
        leverage: 27,
        tradeOk: true,
        dryRun: false,
        fill: { totalSz: 0.0001, avgPx: 109_432 },
      }),
    ).toBe('🧾 receipt: SHORT BTC · $11 notional · 27x · filled 0.0001 @ $109432')

    expect(
      formatInverseAkitaThreadReceipt({
        pair: 'ETH',
        counterSide: 'long',
        sizeUsd: 11,
        leverage: 17,
        tradeOk: true,
        dryRun: false,
        fill: null,
      }),
    ).toBe('🧾 receipt: LONG ETH · $11 notional · 17x · submitted')

    expect(
      formatInverseAkitaThreadReceipt({
        pair: 'BTC',
        counterSide: 'short',
        sizeUsd: 11,
        leverage: 27,
        tradeOk: false,
        dryRun: true,
        fill: null,
      }),
    ).toBe('🧾 receipt: SHORT BTC · $11 notional · 27x · [dry-run]')

    expect(
      formatInverseAkitaThreadReceipt({
        pair: 'BTC',
        counterSide: 'short',
        sizeUsd: 11,
        leverage: 27,
        tradeOk: false,
        dryRun: false,
        fill: null,
        failDetail: 'Failed to sign with ACP CLI.',
      }),
    ).toBe('🧾 receipt: SHORT BTC attempt failed — Failed to sign with ACP CLI.')

    expect(
      formatInverseAkitaThreadReceipt({
        pair: 'BTC',
        counterSide: 'short',
        sizeUsd: 11,
        leverage: 27,
        tradeOk: false,
        dryRun: false,
        fill: null,
        failDetail: null,
      }),
    ).toBeNull()
  })

  it('returns a thread receipt with the parsed fill from the trade run output', async () => {
    vi.stubEnv('ARENA_DRY_RUN', '0')
    mockRunArenaTrade.mockResolvedValue({
      ok: true,
      message: 'ok',
      run: {
        ok: true,
        stdout: '{"filled":{"totalSz":"0.0001","avgPx":"109432.0"}}',
      },
    } as never)
    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'm-receipt',
        date: Date.now(),
        sender: '0x1234567890123456789012345678901234567890',
        text: 'long btc',
        userSide: 'long',
        pair: 'BTC',
      },
    })
    expect(result.ok).toBe(true)
    expect(result.threadReceiptText).toBe(
      '🧾 receipt: SHORT BTC · $50 notional · 27x · filled 0.0001 @ $109432',
    )
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
    expect(result.reactionEmoji).toMatch(/^(🔄|🙃)$/)
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open', pair: 'BTC', side: 'short', leverage: 27 }),
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
    expect(result.replyText).toMatch(/short/i)
    expect(result.replyText).toContain('50 @ 27x')
    expect(mockResolveInverseAkitaChatAuthorAccess).toHaveBeenCalledWith({
      senderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      roomId: '1659',
    })
  })

  it('canonicalizes a unique HIP-3 suffix before execution', async () => {
    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'hip3-market',
        date: Date.now(),
        sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        text: 'bullish $cards',
        userSide: 'long',
        pair: 'CARDS',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.pair).toBe('xyz:CARDS')
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'open',
        pair: 'xyz:CARDS',
        side: 'short',
        leverage: 6,
      }),
      expect.anything(),
    )
  })

  it('fails closed before execution when a market is not listed on Hyperliquid', async () => {
    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'not-listed',
        date: Date.now(),
        sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        text: 'long nope',
        userSide: 'long',
        pair: 'NOPE',
      },
    })

    expect(result).toMatchObject({
      skipped: true,
      skipReason: 'market_not_listed',
    })
    expect(mockResolveRoomDefaultArenaIdentity).not.toHaveBeenCalled()
    expect(mockRunArenaTrade).not.toHaveBeenCalled()
  })

  it('replies with the staker gate when the sender has no staked keys in room 1659', async () => {
    mockResolveInverseAkitaChatAuthorAccess.mockResolvedValueOnce({
      eligible: false,
      stakedKeys: 0,
      reason: 'insufficient_stake',
    })

    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'm-gate',
        date: Date.now(),
        sender: '0x9999999999999999999999999999999999999999',
        text: 'should i long eth',
        userSide: 'long',
        pair: 'ETH',
      },
    })

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('insufficient_stake')
    expect(result.replyText).toMatch(/stake/i)
    expect(mockRunArenaTrade).not.toHaveBeenCalled()
  })

  it('uses the shared room-1659 executor for an eligible owner-room opinion', async () => {
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS',
      '1484,1660,2,1043,1659',
    )
    mockResolveInverseAkitaChatAuthorAccess.mockResolvedValueOnce({
      eligible: true,
      stakedKeys: null,
      reason: 'owner',
    })

    const result = await executeInverseAkitaChatReaction({
      roomId: '1484',
      intent: {
        id: 'owner-room-trade',
        date: Date.now(),
        sender: '0x1111111111111111111111111111111111111111',
        text: 'btc looks bullish',
        userSide: 'long',
        pair: 'BTC',
      },
    })

    expect(result.ok).toBe(true)
    expect(mockResolveRoomDefaultArenaIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: '1659' }),
    )
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'short' }),
      expect.objectContaining({ agentWalletAddress: '0xagentwallet' }),
    )
  })

  it('does not touch the executor when an owner-room author is unauthorized', async () => {
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS',
      '1484,1660,2,1043,1659',
    )
    mockResolveInverseAkitaChatAuthorAccess.mockResolvedValueOnce({
      eligible: false,
      stakedKeys: null,
      reason: 'not_room_owner',
    })

    const result = await executeInverseAkitaChatReaction({
      roomId: '1484',
      intent: {
        id: 'non-owner-room-trade',
        date: Date.now(),
        sender: '0x2222222222222222222222222222222222222222',
        text: 'btc looks bullish',
        userSide: 'long',
        pair: 'BTC',
      },
    })

    expect(result).toMatchObject({ skipped: true, skipReason: 'not_room_owner' })
    expect(mockResolveRoomDefaultArenaIdentity).not.toHaveBeenCalled()
    expect(mockRunArenaOpenPositions).not.toHaveBeenCalled()
    expect(mockRunArenaTrade).not.toHaveBeenCalled()
  })

  it('uses add-to-position copy when the inverse leg is already open', async () => {
    mockRunArenaOpenPositions.mockResolvedValueOnce({
      ok: true,
      message: 'positions',
      details: {
        positions: [
          {
            position: {
              coin: 'ETH',
              szi: '1.5',
              entryPx: '3200',
              leverage: { value: '17' },
            },
          },
        ],
      },
    })

    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'm-stack',
        date: Date.now(),
        sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        text: 'eth going down hard',
        userSide: 'short',
        pair: 'ETH',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.replyText).toMatch(/bottom signal|sized up|stacked|increased/i)
    expect(result.threadReceiptText).toMatch(/added to LONG ETH/)
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open', pair: 'ETH', side: 'long' }),
      expect.anything(),
    )
  })

  it('partial-closes the conflicting leg when user aligns with the open book', async () => {
    mockRunArenaOpenPositions.mockResolvedValueOnce({
      ok: true,
      message: 'positions',
      details: {
        positions: [
          {
            position: {
              coin: 'ETH',
              szi: '2',
              entryPx: '3200',
              leverage: { value: '17' },
            },
          },
        ],
      },
    })

    const result = await executeInverseAkitaChatReaction({
      roomId: '1659',
      intent: {
        id: 'm-trim-exec',
        date: Date.now(),
        sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        text: 'long eth',
        userSide: 'long',
        pair: 'ETH',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.replyText).toMatch(/trimmed|exit signal|top signal|took \$50 off/i)
    expect(result.threadReceiptText).toMatch(/trimmed LONG ETH/)
    expect(mockRunArenaTrade).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'close', pair: 'ETH', sizeUsd: 50 }),
      expect.anything(),
    )
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
