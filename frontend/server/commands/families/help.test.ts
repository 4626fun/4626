import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatHermitCommandRoomHelp,
  HERMIT_COMMAND_ROOM_HELP_MAX_CHARS,
} from '../../_lib/hermit/hermitAlfaClubHelp.js'
import { executeHelpCommandFamily } from './help.js'

vi.mock('../../_lib/alfaclub/room1659Market.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../_lib/alfaclub/room1659Market.js')>()
  return {
    ...actual,
    resolveRoom1659MarketContext: vi.fn(async () => ({
      hype: 67,
      liquidation: 69,
      userPosition: {
        side: 'long' as const,
        sizeUsd: 124_000,
        entryPrice: 70,
        unrealizedPnlUsd: -8_200,
        liquidationPrice: 69,
      },
      onchain: {
        tokenId: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
        roomTokenId: '1659',
        totalSupply: 42n,
        userBalance: 3n,
        marginalBuy1: null,
        marginalSell1: null,
        buy5: null,
        buy10: null,
        buy20: null,
        buy50: null,
      },
      fetchedAt: new Date().toISOString(),
      ok: true,
    })),
  }
})

vi.mock('../../_lib/alfaclub/hyperliquid.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../_lib/alfaclub/hyperliquid.js')>()
  return {
    ...actual,
    getClearinghouseState: vi.fn(async () => ({
      accountValueUsd: 50_000,
      totalNtlPosUsd: 10_000,
      totalRawUsdUsd: null,
      assetPositions: [
        {
          coin: 'BTC',
          entryPx: 90_000,
          positionValue: 10_000,
          unrealizedPnl: 250,
          liquidationPx: 80_000,
          leverage: 5,
          side: 'long' as const,
        },
      ],
    })),
  }
})

const TEST_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('executeHelpCommandFamily', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns position-first Hermit help for /help in alfaclub:1659', async () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = await executeHelpCommandFamily('/help', {
      chatId: 'alfaclub:1659',
      senderWallet: TEST_WALLET,
    })
    expect(result?.ok).toBe(true)
    expect(result?.response).toContain('Your position')
    expect(result?.response).toContain('LONG')
    expect(result?.response).toContain('/gmeow')
    expect(result?.response).not.toContain('Keepr')
  })

  it('treats /halp as /help in Hermit rooms', async () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = await executeHelpCommandFamily('/halp', {
      chatId: 'alfaclub:1659',
      senderWallet: TEST_WALLET,
    })
    expect(result?.response).toContain('Hyperliquid intelligence brief')
  })

  it('returns Hyperliquid position help for /help in alfaclub:1043', async () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = await executeHelpCommandFamily('/help', {
      chatId: 'alfaclub:1043',
      senderWallet: TEST_WALLET,
    })
    expect(result?.response).toContain('Your position')
    expect(result?.response).toContain('BTC')
  })

  it('falls back to Keepr help for non-Hermit alfaclub creator rooms', async () => {
    vi.stubEnv('ALFACLUB_HERMIT_COMMAND_ROOMS', '1043,1659')
    const result = await executeHelpCommandFamily('/help', { chatId: 'alfaclub:2' })
    expect(result?.response).toContain('Keepr')
  })

  it('falls back to Keepr help when chatId is absent', async () => {
    const result = await executeHelpCommandFamily('/help')
    expect(result?.response).toContain('Keepr')
  })

  it('does not match unrelated commands', async () => {
    expect(await executeHelpCommandFamily('/helpful')).toBeNull()
  })

  it('Hermit help with position stays within AlfaClub bot message truncate budget', () => {
    const body1659 = formatHermitCommandRoomHelp('1659', {
      positionBlock: '**Your position** (0xaaaa…aaaa)\n- LONG $124000 · -$8200 PnL · LIQ @ $69.00',
    })
    const body1043 = formatHermitCommandRoomHelp('1043', {
      positionBlock: '**Your position** (0xaaaa…aaaa)\n- LONG BTC $10000',
    })
    expect(body1659.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
    expect(body1043.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
  })

  it('full Hermit help without position stays within budget', () => {
    const body1659 = formatHermitCommandRoomHelp('1659')
    const body1043 = formatHermitCommandRoomHelp('1043')
    expect(body1659.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
    expect(body1043.length).toBeLessThanOrEqual(HERMIT_COMMAND_ROOM_HELP_MAX_CHARS)
  })
})
