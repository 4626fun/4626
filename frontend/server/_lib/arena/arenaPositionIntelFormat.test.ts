import { describe, expect, it } from 'vitest'

import {
  computeArenaRealizedScorecard,
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
    const reply = formatArenaPositionIntelReply('risk', {
      ...sampleDetails,
      agentProfile: {
        id: '1213',
        name: 'InverseAKITA',
        url: 'https://degen.virtuals.io/agents/1213',
      },
    })
    expect(reply).toContain('⚠ [**InverseAKITA**](https://degen.virtuals.io/agents/1213) · Risk')
    expect(reply).toContain('Tightest: BTC')
    expect(reply).toContain('**BTC 5x** LONG')
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

  it('parses pnl scorecard aliases', () => {
    expect(parseArenaPositionsView('pnl')).toBe('pnl')
    expect(parseArenaPositionsView('5')).toBe('pnl')
    expect(parseArenaPositionsView('scorecard')).toBe('pnl')
    expect(parseArenaPositionsView('record')).toBe('pnl')
  })

  it('aggregates userFills into a realized scorecard (partial close fills count once)', () => {
    const scorecard = computeArenaRealizedScorecard([
      // One close order split into two fills — same hash, must count as ONE win.
      {
        coin: 'ETH',
        dir: 'Close Long',
        px: '1795.5',
        sz: '0.1',
        closedPnl: '1.5',
        fee: '0.08',
        hash: '0xclose1',
        time: 1_783_440_580_563,
      },
      {
        coin: 'ETH',
        dir: 'Close Long',
        px: '1795.5',
        sz: '0.14',
        closedPnl: '2.1',
        fee: '0.11',
        hash: '0xclose1',
        time: 1_783_440_580_563,
      },
      // Losing close.
      {
        coin: 'BTC',
        dir: 'Close Short',
        px: '63898',
        sz: '0.0002',
        closedPnl: '-0.9',
        fee: '0.005',
        hash: '0xclose2',
        time: 1_783_440_507_637,
      },
      // Opens contribute volume + fees but are not close events.
      {
        coin: 'ETH',
        dir: 'Open Long',
        px: '1766.3',
        sz: '0.08',
        closedPnl: '0',
        fee: '0.06',
        hash: '0xopen1',
        time: 1_783_257_232_108,
      },
    ])

    expect(scorecard).not.toBeNull()
    expect(scorecard?.closeEvents).toBe(2)
    expect(scorecard?.wins).toBe(1)
    expect(scorecard?.losses).toBe(1)
    expect(scorecard?.realizedPnlUsd).toBeCloseTo(2.7, 6)
    expect(scorecard?.feesUsd).toBeCloseTo(0.255, 6)
    expect(scorecard?.avgWinUsd).toBeCloseTo(3.6, 6)
    expect(scorecard?.avgLossUsd).toBeCloseTo(-0.9, 6)
    expect(scorecard?.fillCount).toBe(4)
    expect(scorecard?.firstFillAtMs).toBe(1_783_257_232_108)
    expect(scorecard?.lastFillAtMs).toBe(1_783_440_580_563)
  })

  it('counts liquidations and flips as close events', () => {
    const scorecard = computeArenaRealizedScorecard([
      { coin: 'SOL', dir: 'Liquidated Long', closedPnl: '-5', fee: '0.1', hash: '0xliq' },
      { coin: 'BTC', dir: 'Long > Short', closedPnl: '2', fee: '0.05', hash: '0xflip' },
    ])
    expect(scorecard?.closeEvents).toBe(2)
    expect(scorecard?.wins).toBe(1)
    expect(scorecard?.losses).toBe(1)
  })

  it('returns null scorecard when no fills exist', () => {
    expect(computeArenaRealizedScorecard([])).toBeNull()
    expect(computeArenaRealizedScorecard(null)).toBeNull()
  })

  it('formats pnl view with net realized, win rate, and explorer link', () => {
    const reply = formatArenaPositionIntelReply('pnl', {
      ...sampleDetails,
      userFills: [
        {
          coin: 'ETH',
          dir: 'Close Long',
          px: '1795.5',
          sz: '0.1',
          closedPnl: '4.5',
          fee: '0.5',
          hash: '0xw',
          time: 1_783_440_580_563,
        },
        {
          coin: 'BTC',
          dir: 'Close Short',
          px: '63898',
          sz: '0.0002',
          closedPnl: '-1',
          fee: '0.1',
          hash: '0xl',
          time: 1_783_440_507_637,
        },
      ],
      agentProfile: {
        id: '1213',
        name: 'InverseAKITA',
        url: 'https://degen.virtuals.io/agents/1213',
      },
    })
    expect(reply).toContain('[**InverseAKITA**](https://degen.virtuals.io/agents/1213) · PnL')
    expect(reply).toContain('Realized: +$2.90 net (gross +$3.50 · fees $0.60)')
    expect(reply).toContain('Win rate: 50% (1W / 1L over 2 closes)')
    expect(reply).toContain('Avg: win +$4.50 · loss -$1.00')
    expect(reply).toContain(
      'Explorer: https://hypurrscan.io/address/0x1111111111111111111111111111111111111111',
    )
    // Footer routes back to the other views.
    expect(reply).toContain('└ `1` book · `2` risk · `3` activity · `4` account')
  })

  it('formats pnl view without fills as an empty scorecard', () => {
    const reply = formatArenaPositionIntelReply('pnl', {
      ...sampleDetails,
      userFills: [],
    })
    expect(reply).toContain('◎ **PnL**')
    expect(reply).toContain('No fills recorded yet')
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
