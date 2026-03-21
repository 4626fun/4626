import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  compareWinnerRelayCheckpoint,
  getWinnerRelayCheckpoint,
  loadSolanaWinnerRelayState,
  saveSolanaWinnerRelayState,
  setWinnerRelayCheckpoint,
} from '../utils/solana-winner-relay-state.js'

describe('solana winner relay state utils', () => {
  it('loads missing state file as empty defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), '4626-winner-relay-state-'))
    try {
      const state = await loadSolanaWinnerRelayState(join(dir, 'missing.json'))
      expect(getWinnerRelayCheckpoint(state)).toEqual({
        blockNumber: 0n,
        logIndex: -1,
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('persists and reloads checkpoint progress', async () => {
    const dir = await mkdtemp(join(tmpdir(), '4626-winner-relay-state-'))
    const file = join(dir, 'state.json')
    try {
      const state = await loadSolanaWinnerRelayState(file)
      setWinnerRelayCheckpoint(state, 12345n, 7)
      await saveSolanaWinnerRelayState(file, state)

      const reloaded = await loadSolanaWinnerRelayState(file)
      expect(getWinnerRelayCheckpoint(reloaded)).toEqual({
        blockNumber: 12345n,
        logIndex: 7,
      })

      const text = await readFile(file, 'utf8')
      expect(text.includes('"checkpointBlock": "12345"')).toBe(true)
      expect(text.includes('"checkpointLogIndex": 7')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('orders checkpoints by block then log index', () => {
    expect(compareWinnerRelayCheckpoint(10n, 0, 9n, 99)).toBe(1)
    expect(compareWinnerRelayCheckpoint(10n, 1, 10n, 2)).toBe(-1)
    expect(compareWinnerRelayCheckpoint(10n, 2, 10n, 2)).toBe(0)
  })
})
