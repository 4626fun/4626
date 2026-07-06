import { describe, expect, it } from 'vitest'

import {
  formatArenaPositionIntelReply,
  normalizeArenaPositionLegs,
  parseArenaPositionsView,
} from './arenaPositionIntelFormat.js'

describe('arenaPositionIntelFormat', () => {
  const sampleDetails = {
    walletAddress: '0x1111111111111111111111111111111111111111',
    positions: [
      {
        position: {
          coin: 'BTC',
          szi: '0.25',
          entryPx: '105000',
          liquidationPx: '95000',
          unrealizedPnl: '1250.42',
        },
      },
      {
        position: {
          coin: 'ETH',
          szi: '-3.5',
          entryPx: '5400',
          liquidationPx: '6200',
          unrealizedPnl: '-220.1',
        },
      },
    ],
    clearinghouseState: {
      marginSummary: {
        accountValue: '12450.5',
        totalMarginUsed: '8200',
      },
      withdrawable: '4250.5',
      assetPositions: [
        {
          position: {
            coin: 'BTC',
            szi: '0.25',
            entryPx: '105000',
            liquidationPx: '95000',
            unrealizedPnl: '1250.42',
            positionValue: '26500',
            leverage: { value: '5' },
          },
        },
        {
          position: {
            coin: 'ETH',
            szi: '-3.5',
            entryPx: '5400',
            liquidationPx: '6200',
            unrealizedPnl: '-220.1',
            positionValue: '19110',
            leverage: { value: '10' },
          },
        },
      ],
    },
    allMids: {
      BTC: '107000',
      ETH: '5460',
    },
    userFees: {
      userCrossRate: '0.000315',
      userAddRate: '0.000105',
      dailyUserVlm: [{ userCross: '12000', userAdd: '3000' }],
    },
    userFills: [
      { coin: 'BTC', dir: 'Open Long', px: '105000', sz: '0.25', closedPnl: '0', fee: '2.1' },
    ],
    ledgerUpdates: [{ time: 1_720_000_000_000, delta: { type: 'deposit', usdc: '5000' } }],
    spotUsdcBalance: 1200,
    userDetails: { txs: [{ hash: '0xabc' }, { hash: '0xdef' }] },
  }

  it('normalizes and merges trade + clearinghouse legs', () => {
    const legs = normalizeArenaPositionLegs(sampleDetails)
    expect(legs).toHaveLength(2)
    expect(legs[0]?.symbol).toBe('BTC')
    expect(legs[0]?.leverage).toBe(5)
    expect(legs[1]?.leverage).toBe(10)
    expect(legs[0]?.markPx).toBe(107000)
  })

  it('infers leverage from marginUsed when leverage object is missing', () => {
    const legs = normalizeArenaPositionLegs({
      clearinghouseState: {
        assetPositions: [
          {
            position: {
              coin: 'ETH',
              szi: '-1',
              entryPx: '3000',
              positionValue: '3000',
              marginUsed: '300',
              unrealizedPnl: '0',
            },
          },
        ],
      },
    })
    expect(legs[0]?.leverage).toBe(10)
  })

  it('formats compact nested book snapshot', () => {
    const reply = formatArenaPositionIntelReply(undefined, {
      ...sampleDetails,
      agentProfile: {
        id: '1213',
        name: 'InverseAKITA',
        url: 'https://degen.virtuals.io/agents/1213',
        walletAddress: sampleDetails.walletAddress,
      },
    })
    expect(reply).toContain('[**InverseAKITA**](https://degen.virtuals.io/agents/1213)')
    expect(reply).not.toContain('Virtuals book')
    expect(reply).toContain('├ Margin $8.20k')
    expect(reply).toContain('Account $12.5k')
    expect(reply).toContain('uPnL +$1,030')
    expect(reply).not.toContain('├ uPnL:')
    expect(reply).toContain('├ **BTC 5x** LONG')
    expect(reply).toContain('+$1,250')
    expect(reply).toContain('-$220')
    expect(reply).toContain('$105.00k→$107.00k')
    expect(reply).toContain('$5,400→$5,460')
    expect(reply).toContain('(+1.9%)')
    expect(reply).toContain('└ **ETH 10x** SHORT')
    expect(reply).toContain('└ `2` risk · `3` activity · `4` account')
    expect(reply).not.toContain('/h pos risk')
  })

  it('falls back to Virtuals book when agent profile is missing', () => {
    const reply = formatArenaPositionIntelReply(undefined, sampleDetails)
    expect(reply).toContain('◆ **Virtuals book**')
  })

  it('parses short progressive aliases', () => {
    expect(parseArenaPositionsView('risk')).toBe('risk')
    expect(parseArenaPositionsView('activity')).toBe('activity')
    expect(parseArenaPositionsView('account')).toBe('account')
    expect(parseArenaPositionsView('fees')).toBe('account')
  })

  it('formats risk view with contextual footer', () => {
    const reply = formatArenaPositionIntelReply('risk', sampleDetails)
    expect(reply).toContain('⚠ **Risk**')
    expect(reply).toContain('├ Tightest: BTC')
    expect(reply).toContain('Book uPnL:')
    expect(reply).toContain('└ `1` book · `3` activity · `4` account')
  })

  it('formats activity and account views from API payloads', () => {
    const activity = formatArenaPositionIntelReply('activity', sampleDetails)
    expect(activity).toContain('↺ **Activity**')
    expect(activity).toContain('**Trades**')
    expect(activity).toContain('Total pnl:')

    const account = formatArenaPositionIntelReply('account', sampleDetails)
    expect(account).toContain('◈ **Account**')
    expect(account).toContain('├ Fees: taker 3.15 bps')
    expect(account).toContain('└ Explorer: 2 recent explorer txs')
  })

  it('shows partial-data warning without breaking output', () => {
    const reply = formatArenaPositionIntelReply('account', {
      ...sampleDetails,
      userFees: null,
      partialFailures: ['userFees http 500'],
    })
    expect(reply).toContain('partial data')
    expect(reply).toContain('◈ **Account**')
  })
})
