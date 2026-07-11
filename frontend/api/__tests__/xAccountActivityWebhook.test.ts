import { createHmac } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/x/_accountActivityWebhook'
import { createMockReq, createMockRes } from './helpers'

const { handlePayloadMock } = vi.hoisted(() => ({
  handlePayloadMock: vi.fn(async () => {}),
}))

vi.mock('../../server/twitter/accountActivityWebhook.js', () => ({
  handleAccountActivityWebhookPayload: handlePayloadMock,
}))

describe('X account activity webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.X_API_SECRET = 'test-consumer-secret'
  })

  it('rejects unsigned event payloads', async () => {
    const rawBody = JSON.stringify({ favorite_events: [{ id: 'event-1' }] })
    const req = createMockReq({ method: 'POST', rawBody })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(handlePayloadMock).not.toHaveBeenCalled()
  })

  it('accepts only a signature over the exact raw payload', async () => {
    const payload = { favorite_events: [{ id: 'event-1' }] }
    const rawBody = JSON.stringify(payload)
    const signature = `sha256=${createHmac('sha256', 'test-consumer-secret').update(rawBody).digest('base64')}`
    const req = createMockReq({
      method: 'POST',
      rawBody,
      headers: { 'x-twitter-webhooks-signature': signature },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(handlePayloadMock).toHaveBeenCalledWith(payload)
  })
})
