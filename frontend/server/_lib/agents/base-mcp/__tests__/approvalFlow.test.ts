import { describe, expect, it } from 'vitest'
import { InMemoryApprovalStore } from '../approvalFlow'

describe('base mcp approval flow store', () => {
  it('creates request and updates status', async () => {
    const store = new InMemoryApprovalStore()
    const created = await store.create({
      clientRequestId: 'req-1',
      ttlSeconds: 60,
      userId: 'u1',
      executionMode: 'canonical',
      sender: '0x1111111111111111111111111111111111111111',
    })

    expect(created.status).toBe('pending')
    expect(created.approvalUrl).toContain(created.requestId)

    const approved = await store.setStatus(created.requestId, 'approved')
    expect(approved?.status).toBe('approved')
  })

  it('expires requests after ttl', async () => {
    const store = new InMemoryApprovalStore()
    const created = await store.create({
      clientRequestId: 'req-2',
      ttlSeconds: 1,
      userId: 'u2',
      executionMode: 'canonical',
      sender: '0x1111111111111111111111111111111111111111',
    })

    await new Promise((resolve) => setTimeout(resolve, 1100))
    const record = await store.get(created.requestId)
    expect(record?.status).toBe('expired')
  })
})
