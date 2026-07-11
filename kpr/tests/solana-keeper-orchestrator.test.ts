import { afterEach, describe, expect, it, vi } from 'vitest'

const { withActionLeaseMock } = vi.hoisted(() => ({
  withActionLeaseMock: vi.fn(),
}))

vi.mock('../utils/actionLease.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/actionLease.js')>('../utils/actionLease.js')
  return {
    ...actual,
    withActionLease: withActionLeaseMock,
  }
})

import {
  normalizeSolanaOrchestratorAction,
  executeSolanaOrchestratorAction,
  publicOrchestratorError,
} from '../solana-keeper-orchestrator.js'
import { ActionLeaseError } from '../utils/actionLease.js'

describe('solana keeper orchestrator', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes supported action labels', () => {
    expect(normalizeSolanaOrchestratorAction('relay-entries')).toBe('relay_entries')
    expect(normalizeSolanaOrchestratorAction('settle_fees')).toBe('settle_fees')
    expect(normalizeSolanaOrchestratorAction('winner-relay')).toBe('winner_relay')
    expect(normalizeSolanaOrchestratorAction('price_monitor')).toBe('price_monitor')
    expect(normalizeSolanaOrchestratorAction('graduation')).toBe('graduation')
    expect(normalizeSolanaOrchestratorAction('sync-relay-config')).toBe('sync_relay_config')
    // Solana rebalance was retired with the v1.15.0 strategy removal.
    expect(normalizeSolanaOrchestratorAction('rebalance')).toBeNull()
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

  it('reports a held action lease as retryable instead of successful', async () => {
    const previousExecute = process.env.SOLANA_ORCHESTRATOR_EXECUTE
    const previousWinnerRelay = process.env.SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED
    process.env.SOLANA_ORCHESTRATOR_EXECUTE = '1'
    process.env.SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED = '1'
    withActionLeaseMock.mockResolvedValueOnce({ ran: false, outcome: 'held' })
    try {
      await expect(
        executeSolanaOrchestratorAction({
          workflow: 'solana-orchestrator',
          action: 'winner_relay',
          checkpointKey: 'finalized:123',
        }),
      ).rejects.toThrow('action_lease_held')
    } finally {
      if (previousExecute === undefined) delete process.env.SOLANA_ORCHESTRATOR_EXECUTE
      else process.env.SOLANA_ORCHESTRATOR_EXECUTE = previousExecute
      if (previousWinnerRelay === undefined) delete process.env.SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED
      else process.env.SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED = previousWinnerRelay
    }
  })

  it('sanitizes raw action and filesystem failures into stable external codes', () => {
    expect(publicOrchestratorError(new Error('/var/lib/private/lease: EACCES'))).toEqual({
      statusCode: 500,
      code: 'action_execution_failed',
      retryable: true,
    })
    expect(publicOrchestratorError(new Error('action_lease_held'))).toEqual({
      statusCode: 409,
      code: 'action_lease_held',
      retryable: true,
    })
    expect(
      publicOrchestratorError(new ActionLeaseError('action_lease_outcome_indeterminate')),
    ).toEqual({
      statusCode: 409,
      code: 'action_lease_outcome_indeterminate',
      retryable: false,
    })
    // Lane-specific disable codes stay specific for prelaunch/smoke gates.
    expect(publicOrchestratorError(new Error('action_disabled:relay_entries'))).toEqual({
      statusCode: 503,
      code: 'action_disabled:relay_entries',
      retryable: true,
    })
    expect(publicOrchestratorError(new Error('action_disabled'))).toEqual({
      statusCode: 503,
      code: 'action_disabled',
      retryable: true,
    })
  })
})
