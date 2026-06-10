import { describe, expect, it } from 'vitest'

import {
  normalizeSolanaOrchestratorAction,
  executeSolanaOrchestratorAction,
} from '../solana-keeper-orchestrator.js'

describe('solana keeper orchestrator', () => {
  it('normalizes supported action labels', () => {
    expect(normalizeSolanaOrchestratorAction('relay-entries')).toBe('relay_entries')
    expect(normalizeSolanaOrchestratorAction('settle_fees')).toBe('settle_fees')
    expect(normalizeSolanaOrchestratorAction('winner-relay')).toBe('winner_relay')
    expect(normalizeSolanaOrchestratorAction('price_monitor')).toBe('price_monitor')
    expect(normalizeSolanaOrchestratorAction('graduation')).toBe('graduation')
    expect(normalizeSolanaOrchestratorAction('rebalance')).toBe('rebalance')
    expect(normalizeSolanaOrchestratorAction('unknown')).toBeNull()
  })

  it('fails closed when action execution is not explicitly enabled', async () => {
    const previous = process.env.SOLANA_ORCHESTRATOR_EXECUTE
    const previousSpecific = process.env.SOLANA_ORCHESTRATOR_PRICE_MONITOR_ENABLED
    delete process.env.SOLANA_ORCHESTRATOR_EXECUTE
    delete process.env.SOLANA_ORCHESTRATOR_PRICE_MONITOR_ENABLED
    try {
      await expect(
        executeSolanaOrchestratorAction({
          workflow: 'solana-orchestrator',
          action: 'price_monitor',
          checkpointKey: 'test',
        }),
      ).rejects.toThrow('action_disabled:price_monitor')
    } finally {
      if (previous === undefined) delete process.env.SOLANA_ORCHESTRATOR_EXECUTE
      else process.env.SOLANA_ORCHESTRATOR_EXECUTE = previous
      if (previousSpecific === undefined) delete process.env.SOLANA_ORCHESTRATOR_PRICE_MONITOR_ENABLED
      else process.env.SOLANA_ORCHESTRATOR_PRICE_MONITOR_ENABLED = previousSpecific
    }
  })

  it('fails closed for relay_entries when explicitly disabled even if global execute is on', async () => {
    const previousExecute = process.env.SOLANA_ORCHESTRATOR_EXECUTE
    const previousRelay = process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED
    process.env.SOLANA_ORCHESTRATOR_EXECUTE = '1'
    process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = '0'
    try {
      await expect(
        executeSolanaOrchestratorAction({
          workflow: 'solana-orchestrator',
          action: 'relay_entries',
          checkpointKey: 'test',
        }),
      ).rejects.toThrow('action_disabled:relay_entries')
    } finally {
      if (previousExecute === undefined) delete process.env.SOLANA_ORCHESTRATOR_EXECUTE
      else process.env.SOLANA_ORCHESTRATOR_EXECUTE = previousExecute
      if (previousRelay === undefined) delete process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED
      else process.env.SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED = previousRelay
    }
  })
})
