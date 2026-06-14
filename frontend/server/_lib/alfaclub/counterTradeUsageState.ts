import type { CounterTradePreset, CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import { derivePresetDailyNotionalCap, derivePresetHourlyCap } from './counterTradeEngine.js'
import {
  readCounterTradeUsageWindow,
  type CounterTradeUsageWindow,
} from './counterTradeStore.js'

export type CounterTradeUsageState = {
  hourlyCap: number
  dailyCap: number
  hourlyUsage: CounterTradeUsageWindow
  dailyUsage: CounterTradeUsageWindow
  canExecuteByHourlyCap: () => boolean
  remainingDailyNotionalUsd: () => number
  recordExecutedEntry: (executedNotionalUsd: number) => void
}

export async function initCounterTradeUsageState(params: {
  roomId: string
  senderAddress: string
  preset: CounterTradePreset
  runtime: CounterTradeRuntimeConfig
  nowMs?: number
}): Promise<CounterTradeUsageState> {
  const nowMs = params.nowMs ?? Date.now()
  const hourlyCap = derivePresetHourlyCap({ preset: params.preset, runtime: params.runtime })
  const dailyCap = derivePresetDailyNotionalCap({ preset: params.preset, runtime: params.runtime })
  const [hourlyUsage, dailyUsage] = await Promise.all([
    readCounterTradeUsageWindow({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      sinceMs: nowMs - 60 * 60_000,
    }),
    readCounterTradeUsageWindow({
      roomId: params.roomId,
      senderAddress: params.senderAddress,
      sinceMs: nowMs - 24 * 60 * 60_000,
    }),
  ])

  const state: CounterTradeUsageState = {
    hourlyCap,
    dailyCap,
    hourlyUsage,
    dailyUsage,
    canExecuteByHourlyCap: () => state.hourlyUsage.executedCount < state.hourlyCap,
    remainingDailyNotionalUsd: () => Math.max(0, state.dailyCap - state.dailyUsage.notionalUsd),
    recordExecutedEntry: (executedNotionalUsd: number) => {
      state.hourlyUsage = {
        ...state.hourlyUsage,
        executedCount: state.hourlyUsage.executedCount + 1,
      }
      state.dailyUsage = {
        ...state.dailyUsage,
        notionalUsd: state.dailyUsage.notionalUsd + Math.max(0, executedNotionalUsd),
      }
    },
  }

  return state
}
