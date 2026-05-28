import crypto from 'node:crypto'
import type { ApprovalStatus } from './schemas'

export interface ApprovalRequestRecord {
  requestId: string
  clientRequestId: string
  approvalUrl: string
  createdAt: string
  expiresAt: string
  status: ApprovalStatus
}

export class InMemoryApprovalStore {
  private readonly records = new Map<string, ApprovalRequestRecord>()

  create(clientRequestId: string, ttlSeconds: number): ApprovalRequestRecord {
    const requestId = crypto.randomUUID()
    const now = new Date()
    const expires = new Date(now.getTime() + ttlSeconds * 1000)
    const record: ApprovalRequestRecord = {
      requestId,
      clientRequestId,
      approvalUrl: `https://wallet.base.org/requests/${requestId}`,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: 'pending',
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
    if (record.status === 'expired') return record

    const next = { ...record, status }
    this.records.set(requestId, next)
    return next
  }
}
