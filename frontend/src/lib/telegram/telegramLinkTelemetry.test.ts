import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, loggerInfoMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: loggerInfoMock,
  },
}))

import { resetTelegramLinkTelemetryDeduper, trackTelegramLinkTelemetryEvent } from '@/lib/telegram/telegramLinkTelemetry'

describe('telegramLinkTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTelegramLinkTelemetryDeduper()
    apiFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })
  })

  it('suppresses identical telemetry payloads in a short burst window', () => {
    trackTelegramLinkTelemetryEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-1',
      phase: 'sending_email_code',
      status: 'started',
      telegramUserId: '42',
      linkTokenPresent: true,
      hasEmail: true,
    })

    trackTelegramLinkTelemetryEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-1',
      phase: 'sending_email_code',
      status: 'started',
      telegramUserId: '42',
      linkTokenPresent: true,
      hasEmail: true,
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows distinct telemetry payloads through', () => {
    trackTelegramLinkTelemetryEvent({
      event: 'telegram_link_email_submit_state',
      flowId: 'flow-1',
      phase: 'collect_email',
      status: 'disabled',
      disabledReason: 'empty',
    })

    trackTelegramLinkTelemetryEvent({
      event: 'telegram_link_email_submit_state',
      flowId: 'flow-1',
      phase: 'collect_email',
      status: 'ready',
      disabledReason: 'ready',
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('allows the same payload again after the dedupe window expires', async () => {
    vi.useFakeTimers()
    try {
      trackTelegramLinkTelemetryEvent({
        event: 'telegram_link_email_code_send_started',
        flowId: 'flow-1',
        phase: 'sending_email_code',
        status: 'started',
      })

      await vi.advanceTimersByTimeAsync(800)

      trackTelegramLinkTelemetryEvent({
        event: 'telegram_link_email_code_send_started',
        flowId: 'flow-1',
        phase: 'sending_email_code',
        status: 'started',
      })

      expect(apiFetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
