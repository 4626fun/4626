import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../arena/arenaClient.js', async () => {
  const actual = await vi.importActual<typeof import('../arena/arenaClient.js')>(
    '../arena/arenaClient.js',
  )
  return {
    parseTradeFillFromOutput: actual.parseTradeFillFromOutput,
    runArenaTrade: vi.fn(),
  }
})

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
  formatInverseAkitaChatReactionSkipReply,
  formatInverseAkitaThreadReceipt,
  INVERSE_AKITA_CHAT_REACTION_EMOJIS,
  resolveInverseAkitaChatReactionEmoji,
  isInverseAkitaChatReactionSenderCoolingDown,
  parseInverseAkitaChatTradeIntent,
  resolveInverseAkitaChatReactionLeverage,
  summarizeInverseTradeFailureDetail,
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

  it('formats skip replies for operator-visible config failures', () => {
    expect(formatInverseAkitaChatReactionSkipReply('arena_trading_disabled')).toMatch(/arena trading is off/i)
    expect(formatInverseAkitaChatReactionSkipReply('missing_executor_wallet')).toMatch(/executor wallet/i)
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
