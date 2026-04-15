import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({
    ok: true,
    ip: '127.0.0.1',
    auth: { type: 'session', address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  })),
  checkRateLimit: vi.fn(() => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  resolveWorkspaceRooms: vi.fn(),
  resolveWorkspaceMonitoring: vi.fn(),
  resolveWorkspaceActivity: vi.fn(),
  resolveWorkspaceStrategies: vi.fn(),
  resolveWorkspaceTasks: vi.fn(),
  resolveWorkspaceSettings: vi.fn(),
  resolveWorkspaceSummary: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    workspaceRead: { windowMs: 60_000, maxRequests: 120 },
    workspaceActions: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/workspace/service.js', () => ({
  resolveWorkspaceRooms: mocks.resolveWorkspaceRooms,
  resolveWorkspaceMonitoring: mocks.resolveWorkspaceMonitoring,
  resolveWorkspaceActivity: mocks.resolveWorkspaceActivity,
  resolveWorkspaceStrategies: mocks.resolveWorkspaceStrategies,
  resolveWorkspaceTasks: mocks.resolveWorkspaceTasks,
  resolveWorkspaceSettings: mocks.resolveWorkspaceSettings,
  resolveWorkspaceSummary: mocks.resolveWorkspaceSummary,
}))

import activityHandler from '../_handlers/v1/workspace/_activity.ts'
import monitoringHandler from '../_handlers/v1/workspace/_monitoring.ts'
import roomsHandler from '../_handlers/v1/workspace/_rooms.ts'
import settingsHandler from '../_handlers/v1/workspace/_settings.ts'
import strategiesHandler from '../_handlers/v1/workspace/_strategies.ts'
import summaryHandler from '../_handlers/v1/workspace/_summary.ts'
import tasksHandler from '../_handlers/v1/workspace/_tasks.ts'

const VAULT = '0x7777777777777777777777777777777777777777'

describe('v1 workspace read endpoint rate-limit hardening', () => {
  it('returns 429 + Retry-After for /v1/workspace/rooms', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await roomsHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/monitoring', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await monitoringHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/activity', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await activityHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/strategies', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await strategiesHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/tasks', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await tasksHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/settings', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await settingsHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 429 + Retry-After for /v1/workspace/summary', async () => {
    const req = createMockReq({ method: 'GET', query: { vault: VAULT } })
    const res = createMockRes()
    await summaryHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })
})
