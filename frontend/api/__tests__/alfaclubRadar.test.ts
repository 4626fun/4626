import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv } from './helpers'
import {
  buildAlfaClubRadarText,
  readAlfaClubRadarFlags,
  type AlfaClubRadarFlags,
  type SnapshotDelta,
} from '../../server/_lib/alfaclub/radar.ts'

const FLAGS: AlfaClubRadarFlags = {
  killSwitch: false,
  enabled: true,
  telegramBotToken: 'bot-token',
  telegramChatId: '@fun4626',
  telegramThreadId: null,
  topN: 3,
  moversN: 2,
  minRankMove: 1,
  minScoreDelta: 0.02,
  forceSend: false,
}

function makeDelta(params: {
  address: `0x${string}`
  rank: number
  previousRank?: number | null
  score: number
  previousScore?: number | null
  supply?: bigint
  previousSupply?: bigint | null
}): SnapshotDelta {
  const current = {
    snapshotTs: '2026-04-20T12:00:00Z',
    creatorAddress: params.address,
    tokenId: BigInt(params.rank),
    totalSupply: params.supply ?? 100n,
    stakedSupply: 25n,
    pnl30dUsd: 12_000,
    hlAccountValueUsd: 100_000,
    score: params.score,
    rank: params.rank,
  }
  const previous =
    params.previousRank === null
      ? null
      : {
          ...current,
          snapshotTs: '2026-04-19T12:00:00Z',
          rank: params.previousRank ?? params.rank,
          score: params.previousScore ?? params.score,
          totalSupply: params.previousSupply ?? params.supply ?? 100n,
        }
  return {
    current,
    previous,
    rankDelta: previous ? previous.rank - current.rank : null,
    scoreDelta: previous ? current.score - previous.score : null,
    supplyDelta: previous ? current.totalSupply - previous.totalSupply : null,
    stakedDelta: previous ? current.stakedSupply - previous.stakedSupply : null,
    pnlDelta: 1000,
    isNew: previous === null,
  }
}

describe('AlfaClub radar flags and formatter', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('auto-enables when Telegram token and destination are configured', () => {
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'telegram-token',
      ALFACLUB_RADAR_TELEGRAM_CHAT_ID: '@fun4626',
      ALFACLUB_RADAR_TELEGRAM_THREAD_ID: '77',
      ALFACLUB_RADAR_TOP_N: '10',
      ALFACLUB_RADAR_MOVERS_N: '4',
    })

    const flags = readAlfaClubRadarFlags()
    expect(flags.enabled).toBe(true)
    expect(flags.telegramChatId).toBe('@fun4626')
    expect(flags.telegramThreadId).toBe(77)
    expect(flags.topN).toBe(10)
    expect(flags.moversN).toBe(4)
  })

  it('formats rank movers and current top rows', () => {
    const built = buildAlfaClubRadarText({
      snapshotTs: '2026-04-20T12:00:00Z',
      previousSnapshotTs: '2026-04-19T12:00:00Z',
      flags: FLAGS,
      deltas: [
        makeDelta({
          address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          rank: 1,
          previousRank: 4,
          score: 0.5,
          previousScore: 0.4,
          supply: 120n,
          previousSupply: 100n,
        }),
        makeDelta({
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          rank: 2,
          previousRank: null,
          score: 0.45,
        }),
      ],
    })

    expect(built.highlighted).toBe(2)
    expect(built.topRows).toBe(2)
    expect(built.text).toContain('Alfa Radar')
    expect(built.text).toContain('Movers')
    expect(built.text).toContain('up 3')
    expect(built.text).toContain('new')
    expect(built.text).toContain('Current Top')
  })
})
