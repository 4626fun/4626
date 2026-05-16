import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  consumeVaultHourlyBudget,
  getPoolLastProcessedBlock,
  isCooldownActive,
  loadStrategyEventState,
  recordCooldown,
  saveStrategyEventState,
  setPoolLastProcessedBlock,
} from '../utils/strategy-event-state.js'

describe('strategy event state utils', () => {
  it('loads missing state file as empty defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), '4626-state-test-'))
    try {
      const state = await loadStrategyEventState(join(dir, 'missing.json'))
      expect(state.pools).toEqual({})
      expect(state.cooldowns).toEqual({})
      expect(state.vaultHourly).toEqual({})
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('persists and reloads pool block progress', async () => {
    const dir = await mkdtemp(join(tmpdir(), '4626-state-test-'))
    const file = join(dir, 'state.json')
    try {
      const state = await loadStrategyEventState(file)
      setPoolLastProcessedBlock(state, '0x00000000000000000000000000000000000000aa', 12345n)
      await saveStrategyEventState(file, state)

      const reloaded = await loadStrategyEventState(file)
      expect(
        getPoolLastProcessedBlock(reloaded, '0x00000000000000000000000000000000000000aa'),
      ).toBe(12345n)

      const text = await readFile(file, 'utf8')
      expect(text.includes('12345')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('enforces cooldown window', async () => {
    const state = await loadStrategyEventState('/dev/null-does-not-exist')
    const key = 'vault:strategy:action'
    recordCooldown({ state, key, nowSeconds: 1_000 })
    expect(
      isCooldownActive({
        state,
        key,
        nowSeconds: 1_100,
        cooldownSeconds: 300,
      }),
    ).toBe(true)
    expect(
      isCooldownActive({
        state,
        key,
        nowSeconds: 1_401,
        cooldownSeconds: 300,
      }),
    ).toBe(false)
  })

  it('tracks and prunes vault hourly budget', async () => {
    const state = await loadStrategyEventState('/dev/null-does-not-exist')
    const vault = '0x00000000000000000000000000000000000000bb'
    expect(
      consumeVaultHourlyBudget({
        state,
        vaultAddress: vault,
        nowSeconds: 10_000,
        maxPerHour: 2,
      }).allowed,
    ).toBe(true)
    expect(
      consumeVaultHourlyBudget({
        state,
        vaultAddress: vault,
        nowSeconds: 10_100,
        maxPerHour: 2,
      }).allowed,
    ).toBe(true)
    expect(
      consumeVaultHourlyBudget({
        state,
        vaultAddress: vault,
        nowSeconds: 10_200,
        maxPerHour: 2,
      }).allowed,
    ).toBe(false)

    // After one hour, budget should reopen.
    expect(
      consumeVaultHourlyBudget({
        state,
        vaultAddress: vault,
        nowSeconds: 14_001,
        maxPerHour: 2,
      }).allowed,
    ).toBe(true)
  })
})

