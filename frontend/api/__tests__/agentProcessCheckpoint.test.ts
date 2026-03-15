import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CHECKPOINT_WINDOW_MS,
  MAX_MESSAGES_PER_CONVERSATION,
  getCheckpointMs,
  getInitialConversationCheckpointMs,
  getMessageQueryOptions,
  getEthereumAddressFromInboxState,
  mergeCheckpointMs,
  parseConversationCheckpointRows,
  resolveFallbackCommandReply,
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

  it('caps first per-conversation checkpoint to rolling window when legacy checkpoint is too recent', () => {
    const now = new Date('2026-02-08T12:00:00.000Z').getTime()
    const recentLegacyCheckpoint = new Date('2026-02-08T11:59:45.000Z').toISOString()
    const ms = getInitialConversationCheckpointMs(recentLegacyCheckpoint, now)
    expect(ms).toBe(now - DEFAULT_CHECKPOINT_WINDOW_MS)
  })

  it('builds bounded message query options', () => {
    const lastProcessedMs = 1_000
    const opts = getMessageQueryOptions(lastProcessedMs)
    expect(opts.sentAfterNs).toBe(1_000_000_000n)
    expect(opts.limit).toBe(MAX_MESSAGES_PER_CONVERSATION)
    expect(opts.direction).toBe(0)
  })

  it('merges checkpoints monotonically', () => {
    expect(mergeCheckpointMs(1000, 999)).toBe(1000)
    expect(mergeCheckpointMs(1000, 1500)).toBe(1500)
  })

  it('parses conversation checkpoint rows into a map', () => {
    const checkpoints = parseConversationCheckpointRows([
      {
        conversation_id: 'conv-a',
        last_processed_message_at: '2026-02-08T11:58:30.000Z',
      },
      {
        conversation_id: 'conv-b',
        last_processed_message_at: 'invalid',
      },
      {
        conversation_id: '',
        last_processed_message_at: '2026-02-08T11:59:00.000Z',
      },
    ])

    expect(checkpoints.size).toBe(1)
    expect(checkpoints.get('conv-a')).toBe(new Date('2026-02-08T11:58:30.000Z').getTime())
    expect(checkpoints.has('conv-b')).toBe(false)
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

  it('prefers upstream command replies when available', () => {
    const resolved = resolveFallbackCommandReply({
      text: '/keepr status',
      result: {
        ok: true,
        response: 'Keepr status',
      },
    })
    expect(resolved.replyText).toBe('Keepr status')
    expect(resolved.fallbackGenerated).toBe(false)
  })

  it('generates explicit fallback reply when handler returns empty response', () => {
    const resolved = resolveFallbackCommandReply({
      text: '/cre status',
      result: {
        ok: false,
        response: '',
      },
    })
    expect(resolved.fallbackGenerated).toBe(true)
    expect(resolved.replyText).toContain('/cre')
    expect(resolved.replyText).toContain('fallback mode')
  })
})
