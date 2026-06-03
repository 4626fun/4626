import crypto from 'node:crypto'
import type { ApprovalStatus } from './schemas'

export interface ApprovalRequestRecord {
  requestId: string
  clientRequestId: string
  approvalUrl: string
  createdAt: string
  expiresAt: string
  status: ApprovalStatus
  userId: string
  executionMode: 'canonical' | 'eoa'
  sender: string
}

export class InMemoryApprovalStore {
  private readonly records = new Map<string, ApprovalRequestRecord>()

  create(params: {
    clientRequestId: string
    ttlSeconds: number
    userId: string
    executionMode: 'canonical' | 'eoa'
    sender: string
  }): ApprovalRequestRecord {
    const requestId = crypto.randomUUID()
    const now = new Date()
    const expires = new Date(now.getTime() + params.ttlSeconds * 1000)
    const record: ApprovalRequestRecord = {
      requestId,
      clientRequestId: params.clientRequestId,
      approvalUrl: `https://wallet.base.org/requests/${requestId}`,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: 'pending',
      userId: params.userId,
      executionMode: params.executionMode,
      sender: params.sender,
    }
    this.records.set(requestId, record)
    return record
  }

  get(requestId: string): ApprovalRequestRecord | null {
    const record = this.records.get(requestId)
    if (!record) return null

    if (record.status === 'pending' && new Date(record.expiresAt).getTime() <= Date.now()) {
      const expired = { ...record, status: 'expired' as const }
      this.records.set(requestId, expired)
      return expired
    }

    return record
  }

  setStatus(requestId: string, status: Exclude<ApprovalStatus, 'expired'>): ApprovalRequestRecord | null {
    const record = this.get(requestId)
    if (!record) return null
    if (record.status !== 'pending') return record

    const next = { ...record, status }
    this.records.set(requestId, next)
    return next
  }
}
