import { describe, expect, it } from 'vitest'
import { SortDirection } from '@xmtp/agent-sdk'

import {
  DEFAULT_CHECKPOINT_WINDOW_MS,
  MAX_MESSAGES_PER_CONVERSATION,
  getCheckpointMs,
  getMessageQueryOptions,
  getEthereumAddressFromInboxState,
  mergeCheckpointMs,
} from '../_handlers/agent/_process.ts'

describe('agent/process checkpoints', () => {
  it('uses persisted checkpoint when present', () => {
    const now = new Date('2026-02-08T12:00:00.000Z').getTime()
    const persisted = '2026-02-08T11:58:30.000Z'
    const ms = getCheckpointMs(persisted, now)
    expect(ms).toBe(new Date(persisted).getTime())
  })

  it('falls back to now - 2 minutes for first run', () => {
    const now = new Date('2026-02-08T12:00:00.000Z').getTime()
    const ms = getCheckpointMs(null, now)
    expect(ms).toBe(now - DEFAULT_CHECKPOINT_WINDOW_MS)
  })

  it('builds bounded message query options', () => {
    const lastProcessedMs = 1_000
    const opts = getMessageQueryOptions(lastProcessedMs)
    expect(opts.sentAfterNs).toBe(1_000_000_000n)
    expect(opts.limit).toBe(MAX_MESSAGES_PER_CONVERSATION)
    expect(opts.direction).toBe(SortDirection.Ascending)
  })

  it('merges checkpoints monotonically', () => {
    expect(mergeCheckpointMs(1000, 999)).toBe(1000)
    expect(mergeCheckpointMs(1000, 1500)).toBe(1500)
  })

  it('resolves ethereum address from inbox state identifiers', () => {
    const state = {
      identifiers: [
        { identifier: 'passkey:abc', identifierKind: 1 },
        { identifier: '0xA000000000000000000000000000000000000001', identifierKind: 0 },
      ],
    }
    expect(getEthereumAddressFromInboxState(state)).toBe('0xa000000000000000000000000000000000000001')
  })
})
