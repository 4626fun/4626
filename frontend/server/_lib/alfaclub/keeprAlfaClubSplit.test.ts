import { afterEach, describe, expect, it } from 'vitest'

import {
  isAlfaClubRailwayBridgeOverrideEnabled,
  isKeeprRailwayAlfaClubSplit,
  isRailwayRuntimeEnv,
} from './keeprAlfaClubSplit.js'

const RAILWAY_KEYS = [
  'RAILWAY_SERVICE_ID',
  'RAILWAY_PROJECT_ID',
  'RAILWAY_ENVIRONMENT_ID',
] as const

const saved: Record<string, string | undefined> = {}

function saveEnv(keys: readonly string[]) {
  for (const key of keys) {
    saved[key] = process.env[key]
  }
}

function restoreEnv(keys: readonly string[]) {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

function clearRailwayEnv() {
  for (const key of RAILWAY_KEYS) delete process.env[key]
}

describe('keeprAlfaClubSplit', () => {
  afterEach(() => {
    restoreEnv([...RAILWAY_KEYS, 'ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY'])
  })

  it('detects Railway runtime from RAILWAY_* vars', () => {
    saveEnv(RAILWAY_KEYS)
    clearRailwayEnv()
    expect(isRailwayRuntimeEnv()).toBe(false)

    process.env.RAILWAY_SERVICE_ID = 'svc-123'
    expect(isRailwayRuntimeEnv()).toBe(true)
  })

  it('treats Keepr Railway as split unless override is set', () => {
    saveEnv([...RAILWAY_KEYS, 'ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY'])
    process.env.RAILWAY_SERVICE_ID = 'svc-123'
    delete process.env.ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY

    expect(isKeeprRailwayAlfaClubSplit()).toBe(true)

    process.env.ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY = '1'
    expect(isAlfaClubRailwayBridgeOverrideEnabled()).toBe(true)
    expect(isKeeprRailwayAlfaClubSplit()).toBe(false)
  })

  it('does not split off Railway', () => {
    saveEnv([...RAILWAY_KEYS, 'ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY'])
    clearRailwayEnv()
    delete process.env.ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY

    expect(isKeeprRailwayAlfaClubSplit()).toBe(false)
  })
})
