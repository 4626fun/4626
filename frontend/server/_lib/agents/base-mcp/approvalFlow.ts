import crypto from 'node:crypto'
import type { ApprovalStatus } from './schemas'
import { getDb, isDbConfigured, type DbPool } from '../../db/postgres.js'

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

export interface CreateApprovalRequestParams {
  clientRequestId: string
  ttlSeconds: number
  userId: string
  executionMode: 'canonical' | 'eoa'
  sender: string
}

export interface ApprovalStore {
  create(params: CreateApprovalRequestParams): Promise<ApprovalRequestRecord>
  get(requestId: string): Promise<ApprovalRequestRecord | null>
  setStatus(requestId: string, status: Exclude<ApprovalStatus, 'expired'>): Promise<ApprovalRequestRecord | null>
}

function createApprovalRecord(params: CreateApprovalRequestParams): ApprovalRequestRecord {
  const requestId = crypto.randomUUID()
  const now = new Date()
  const expires = new Date(now.getTime() + params.ttlSeconds * 1000)
  return {
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
}

function rowToRecord(row: Record<string, unknown>): ApprovalRequestRecord {
  return {
    requestId: String(row.request_id),
    clientRequestId: String(row.client_request_id),
    approvalUrl: String(row.approval_url),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    status: String(row.status) as ApprovalStatus,
    userId: String(row.user_id),
    executionMode: String(row.execution_mode) as 'canonical' | 'eoa',
    sender: String(row.sender).toLowerCase(),
  }
}

export class InMemoryApprovalStore implements ApprovalStore {
  private readonly records = new Map<string, ApprovalRequestRecord>()

  async create(params: CreateApprovalRequestParams): Promise<ApprovalRequestRecord> {
    const record = createApprovalRecord(params)
    this.records.set(record.requestId, record)
    return record
  }

  async get(requestId: string): Promise<ApprovalRequestRecord | null> {
    const record = this.records.get(requestId)
    if (!record) return null

    if (record.status === 'pending' && new Date(record.expiresAt).getTime() <= Date.now()) {
      const expired = { ...record, status: 'expired' as const }
      this.records.set(requestId, expired)
      return expired
    }

    return record
  }

  async setStatus(requestId: string, status: Exclude<ApprovalStatus, 'expired'>): Promise<ApprovalRequestRecord | null> {
    const record = await this.get(requestId)
    if (!record) return null
    if (record.status !== 'pending') return record

    const next = { ...record, status }
    this.records.set(requestId, next)
    return next
  }
}

export class DurableApprovalStore implements ApprovalStore {
  private readonly fallback = new InMemoryApprovalStore()
  private schemaReady = false

  private allowInMemoryFallback(): boolean {
    return process.env.BASE_MCP_ALLOW_IN_MEMORY_APPROVAL_STORE === '1'
  }

  private async getDurableDb(): Promise<DbPool | null> {
    if (!isDbConfigured()) {
      if (this.allowInMemoryFallback()) return null
      throw new Error('base_mcp_approval_store_db_not_configured')
    }
    const db = await getDb()
    if (!db && !this.allowInMemoryFallback()) throw new Error('base_mcp_approval_store_db_unavailable')
    return db
  }

  private async ensureSchema(db: DbPool): Promise<void> {
    if (this.schemaReady) return
    await db.sql`
      CREATE TABLE IF NOT EXISTS base_mcp_approval_requests (
        request_id TEXT PRIMARY KEY,
        client_request_id TEXT NOT NULL,
        approval_url TEXT NOT NULL,
        user_id TEXT NOT NULL,
        execution_mode TEXT NOT NULL CHECK (execution_mode IN ('canonical', 'eoa')),
        sender TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS base_mcp_approval_requests_status_expires_idx
        ON base_mcp_approval_requests (status, expires_at);
    `
    this.schemaReady = true
  }

  async create(params: CreateApprovalRequestParams): Promise<ApprovalRequestRecord> {
    const record = createApprovalRecord(params)
    const db = await this.getDurableDb()
    if (!db) return this.fallback.create(params)

    await this.ensureSchema(db)
    await db.sql`
      INSERT INTO base_mcp_approval_requests (
        request_id,
        client_request_id,
        approval_url,
        user_id,
        execution_mode,
        sender,
        status,
        created_at,
        expires_at,
        updated_at
      ) VALUES (
        ${record.requestId},
        ${record.clientRequestId},
        ${record.approvalUrl},
        ${record.userId},
        ${record.executionMode},
        ${record.sender},
        ${record.status},
        ${record.createdAt},
        ${record.expiresAt},
        NOW()
      );
    `
    return record
  }

  async get(requestId: string): Promise<ApprovalRequestRecord | null> {
    const db = await this.getDurableDb()
    if (!db) return this.fallback.get(requestId)

    await this.ensureSchema(db)
    await db.sql`
      UPDATE base_mcp_approval_requests
      SET status = 'expired', updated_at = NOW()
      WHERE request_id = ${requestId}
        AND status = 'pending'
        AND expires_at <= NOW();
    `
    const result = await db.sql`
      SELECT request_id, client_request_id, approval_url, user_id, execution_mode, sender, status, created_at, expires_at
      FROM base_mcp_approval_requests
      WHERE request_id = ${requestId}
      LIMIT 1;
    `
    const row = result.rows?.[0] as Record<string, unknown> | undefined
    return row ? rowToRecord(row) : null
  }

  async setStatus(requestId: string, status: Exclude<ApprovalStatus, 'expired'>): Promise<ApprovalRequestRecord | null> {
    const db = await this.getDurableDb()
    if (!db) return this.fallback.setStatus(requestId, status)

    await this.ensureSchema(db)
    const result = await db.sql`
      UPDATE base_mcp_approval_requests
      SET status = ${status}, updated_at = NOW()
      WHERE request_id = ${requestId}
        AND status = 'pending'
        AND expires_at > NOW()
      RETURNING request_id, client_request_id, approval_url, user_id, execution_mode, sender, status, created_at, expires_at;
    `
    const updated = result.rows?.[0] as Record<string, unknown> | undefined
    if (updated) return rowToRecord(updated)
    return this.get(requestId)
  }
}
