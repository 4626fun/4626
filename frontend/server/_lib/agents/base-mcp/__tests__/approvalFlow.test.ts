import { describe, expect, it } from 'vitest'
import { InMemoryApprovalStore } from '../approvalFlow'

describe('base mcp approval flow store', () => {
  it('creates request and updates status', () => {
    const store = new InMemoryApprovalStore()
    const created = store.create('req-1', 60)

    expect(created.status).toBe('pending')
    expect(created.approvalUrl).toContain(created.requestId)

    const approved = store.setStatus(created.requestId, 'approved')
    expect(approved?.status).toBe('approved')
  })

  it('expires requests after ttl', async () => {
    const store = new InMemoryApprovalStore()
    const created = store.create('req-2', 1)

    await new Promise((resolve) => setTimeout(resolve, 1100))
    const record = store.get(created.requestId)
    expect(record?.status).toBe('expired')
  })
})
