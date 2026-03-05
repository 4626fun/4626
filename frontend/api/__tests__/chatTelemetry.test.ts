import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/chat/_telemetry.ts'
import { createMockReq, createMockRes } from './helpers'

const { trackChatCommandCenterEventMock } = vi.hoisted(() => ({
  trackChatCommandCenterEventMock: vi.fn(),
}))

vi.mock('../../server/_lib/chatCommandCenterTelemetry.js', () => ({
  trackChatCommandCenterEvent: trackChatCommandCenterEventMock,
}))

describe('POST /api/v1/chat/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects payloads with missing event name', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(trackChatCommandCenterEventMock).not.toHaveBeenCalled()
  })

  it('accepts telemetry payload and forwards structured fields', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'chat_command_sent',
        conversationId: 'group-1',
        conversationType: 'group',
        commandId: 'cre-status',
        source: 'command',
        extra: 'value',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(trackChatCommandCenterEventMock).toHaveBeenCalledWith({
      event: 'chat_command_sent',
      conversationId: 'group-1',
      conversationType: 'group',
      commandId: 'cre-status',
      source: 'command',
      payload: { extra: 'value' },
    })
  })
})
