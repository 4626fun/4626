import { describe, expect, it } from 'vitest'

import type { MetricsSnapshotRow } from './publicationLedger.js'
import { formatAlfaClubBriefOpsRoomFooter } from './creatorRoomLinks.js'
import {
  formatAlfaClubDailyBrief,
  formatAlfaClubLeaderboardChat,
  formatIndexedScopeLine,
  type TopRoomMarketStats,
} from './dailyBrief.js'

function row(params: {
  rank: number
  address: string
  tokenId: number
  score: number
  totalSupply?: bigint
  stakedSupply?: bigint
}): MetricsSnapshotRow {
  return {
    snapshotTs: '2026-05-26T12:01:18.477Z',
    creatorAddress: params.address as `0x${string}`,
    tokenId: BigInt(params.tokenId),
    totalSupply: params.totalSupply ?? 82n,
    stakedSupply: params.stakedSupply ?? 61n,
    pnl30dUsd: null,
    hlAccountValueUsd: null,
    score: params.score,
    rank: params.rank,
  }
}

const ADDR_A = '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8'
const ADDR_B = '0xbc4caa1d56082d84a7d97460e79a5b11bbf86b1f'
const ADDR_C = '0xf39b0d1f2c31b3832ac0cb3ae4334c16272bd37e'

describe('formatAlfaClubDailyBrief', () => {
  it('compact brief omits 4626 explore links and duplicate flat-mover sections', () => {
    const currentRows = [
      row({ rank: 1, address: ADDR_A, tokenId: 2, score: 0.148 }),
      row({ rank: 2, address: ADDR_B, tokenId: 19, score: 0.112, totalSupply: 27n, stakedSupply: 22n }),
    ]
    const previousRows = [
      row({ rank: 1, address: ADDR_A, tokenId: 2, score: 0.148 }),
      row({ rank: 2, address: ADDR_B, tokenId: 19, score: 0.112, totalSupply: 27n, stakedSupply: 22n }),
      row({ rank: 3, address: ADDR_C, tokenId: 50, score: 0.099 }),
    ]
    const labels = new Map<string, string>([[ADDR_A.toLowerCase(), '@Flip_Research']])
    const roomIds = new Map<string, string>([[ADDR_A.toLowerCase(), '2']])
    const roomDisplayByRoomId = new Map<string, string>([
      ['2', 'Flip Research by Flip_Research'],
      ['19', 'Alpha Room by wenakita'],
    ])
    const topRoomStatsByCreator = new Map<string, TopRoomMarketStats>([
      [
        ADDR_A.toLowerCase(),
        {
          roomId: '2',
          buyOneKeyUsd: 3.4,
          sellOneKeyUsd: 3.15,
          tradingFundUsd: 4200,
          impliedPayoutPerKeyUsd: 51.22,
        },
      ],
      [
        ADDR_B.toLowerCase(),
        {
          roomId: '19',
          buyOneKeyUsd: 1.2,
          sellOneKeyUsd: 1.1,
          tradingFundUsd: 900,
          impliedPayoutPerKeyUsd: 33.33,
        },
      ],
    ])

    const text = formatAlfaClubDailyBrief({
      snapshotTs: '2026-05-26T12:01:18.477Z',
      previousSnapshotTs: '2026-05-25T12:01:36.638Z',
      currentRows,
      previousRows,
      creatorsTracked: 1655,
      recentPublications: [],
      marketRows: [
        { symbol: 'BTC', priceUsd: 75572, change24hPct: -1.8 },
        { symbol: 'ETH', priceUsd: 2075, change24hPct: -1.9 },
      ],
      topRows: 5,
      moverRows: 5,
      majorRows: 6,
      compact: true,
      labels,
      roomIds,
      roomDisplayByRoomId,
      topRoomStatsByCreator,
    })

    expect(text).toContain('**AlfaClub Daily**')
    expect(text).toContain('May 26')
    expect(text).toContain('**HyperCore**')
    expect(text).toContain('**Creators**')
    expect(text).toContain('Market mood:')
    expect(text).toContain('• **BTC**')
    expect(text).toContain('Bot signals: nothing notable in the last 24h.')
    expect(text).toContain('@Flip_Research · Room #2')
    expect(text).toContain('@wenakita · Room #19')
    expect(text).toContain('https://alfaclub.app/room/2')
    expect(text).not.toContain('/room/1043')
    expect(text).not.toContain('app.4626.fun')
    expect(text).not.toContain('Actionable breakouts')
    expect(text).not.toContain('Watch next (24h)')
    expect(text).not.toContain('Compared with:')
    expect(text).not.toContain('Watchlist:')
    expect(text).not.toContain('Execution:')
    expect(text).not.toContain('Signal pressure:')
    expect(text).not.toContain('Room economics (')
    expect(text).not.toContain('**AlfaClub creator flow**')
    expect(text).toContain('↓ dropped top-5')
    expect(text).toContain(ADDR_C.slice(0, 6))
    expect(text).toContain('FriendKey rooms indexed on-chain')
    expect(text).toContain('Room #1659 is one room')
    expect(text).toContain('trading fund $4,200')
    expect(text).toContain('leads today')
    expect(text).toContain('74.4% keys staked')
    expect(text.indexOf('**HyperCore**')).toBeLessThan(text.indexOf('**Creators**'))
  })

  it('ops room footer clarifies digest vs creator trading rooms', () => {
    const footer = formatAlfaClubBriefOpsRoomFooter('1043')
    expect(footer).toContain('bot/ops')
    expect(footer).not.toContain('room/1043')
  })

  it('leaderboard chat uses indexed scope and top rows only', () => {
    const currentRows = [
      row({ rank: 1, address: ADDR_A, tokenId: 2, score: 0.148 }),
      row({ rank: 2, address: ADDR_B, tokenId: 19, score: 0.112 }),
    ]
    const text = formatAlfaClubLeaderboardChat({
      snapshotTs: '2026-05-26T12:01:18.477Z',
      previousSnapshotTs: null,
      currentRows,
      previousRows: [],
      creatorsTracked: 1655,
      recentPublications: [],
      marketRows: [],
      topRows: 2,
      moverRows: 5,
      majorRows: 6,
      compact: true,
      labels: new Map([[ADDR_A.toLowerCase(), '@Flip_Research']]),
      roomIds: new Map([[ADDR_A.toLowerCase(), '2']]),
    })

    expect(text).toContain('**AlfaClub Leaderboard**')
    expect(text).toContain('**Top 2**')
    expect(text).not.toContain('**HyperCore**')
    expect(formatIndexedScopeLine({
      creatorsTracked: 1655,
      rankedCount: 2,
      newCreators: 0,
      activeCreators24h: 0,
    })).toContain('partial leaderboard')
    expect(formatIndexedScopeLine({
      creatorsTracked: 1655,
      rankedCount: 2,
      newCreators: 0,
      activeCreators24h: 0,
    })).toContain('Score is a 0–1 composite')
  })

  it('legacy format keeps the long sectioned layout when compact is off', () => {
    const text = formatAlfaClubDailyBrief({
      snapshotTs: '2026-05-26T12:01:18.477Z',
      previousSnapshotTs: '2026-05-25T12:01:36.638Z',
      currentRows: [row({ rank: 1, address: ADDR_A, tokenId: 2, score: 0.148 })],
      previousRows: [],
      creatorsTracked: 10,
      recentPublications: [],
      marketRows: [{ symbol: 'BTC', priceUsd: 1, change24hPct: 0 }],
      topRows: 5,
      moverRows: 5,
      majorRows: 6,
      compact: false,
      labels: new Map(),
      roomIds: new Map(),
    })

    expect(text).toContain('**Daily AlfaClub Brief**')
    expect(text).toContain('**HyperCore market intelligence**')
    expect(text).toContain('**AlfaClub pulse**')
  })
})
