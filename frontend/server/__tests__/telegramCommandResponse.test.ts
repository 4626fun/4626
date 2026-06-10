import { describe, expect, it, vi } from 'vitest'

import { buildTelegramProcessedCommandResponse } from '../../api/_handlers/telegram/webhook/services/commandResponse.ts'

describe('buildTelegramProcessedCommandResponse', () => {
  it('preserves observed command text wrapping when provided', () => {
    const buildObservedCommandText = vi.fn().mockReturnValue('wrapped response')
    const resolveMediaFromAction = vi.fn().mockReturnValue(undefined)

    const result = buildTelegramProcessedCommandResponse({
      commandText: '/keepr status',
      processed: { responseText: 'raw response' },
      buildObservedCommandText,
      resolveMediaFromAction,
    })

    expect(buildObservedCommandText).toHaveBeenCalledWith('/keepr status', 'raw response')
    expect(resolveMediaFromAction).toHaveBeenCalledWith(undefined)
    expect(result).toEqual({ text: 'wrapped response' })
  })

  it('falls back to the shared-core response text and preserves action media', () => {
    const media = {
      kind: 'photo' as const,
      bytes: new Uint8Array([1, 2, 3]),
      caption: 'chart',
    }
    const buildObservedCommandText = vi.fn().mockReturnValue(null)
    const resolveMediaFromAction = vi.fn().mockReturnValue(media)

    const result = buildTelegramProcessedCommandResponse({
      commandText: '/keepr status',
      processed: {
        responseText: 'Vault status ok',
        action: { telegramMedia: media },
      },
      buildObservedCommandText,
      resolveMediaFromAction,
    })

    expect(result).toEqual({
      text: 'Vault status ok',
      media,
    })
  })
})
