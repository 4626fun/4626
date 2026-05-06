import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import handler from '../_handlers/cre/keeper/_aiAssess.ts'

const { getElizaLlmServiceMock, getAvailableProvidersMock, generateResponseMock } = vi.hoisted(() => ({
  getElizaLlmServiceMock: vi.fn(),
  getAvailableProvidersMock: vi.fn(),
  generateResponseMock: vi.fn(),
}))

vi.mock('../../server/agent/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))

describe('CRE explicit intent: AI consensus fallback', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ KEEPR_API_KEY: 'test-keepr-key' })
    getElizaLlmServiceMock.mockReturnValue({
      getAvailableProviders: getAvailableProvidersMock,
      generateResponse: generateResponseMock,
    })
  })

  afterEach(() => restoreEnv())

  function requestWithAlerts(alerts: Array<{ alertType: string; severity: 'info' | 'warning' | 'critical'; message: string }>) {
    return createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-keepr-key' },
      body: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        checksRun: 4,
        alerts,
      },
    })
  }

  it('falls back deterministically when no providers are available', async () => {
    getAvailableProvidersMock.mockReturnValue([])
    const res = createMockRes()

    await handler(requestWithAlerts([{ alertType: 'stale', severity: 'warning', message: 'stale' }]), res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.enabled).toBe(false)
    expect(res.body?.data?.verdict).toBe('watch')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('falls back to deterministic critical verdict on malformed AI JSON', async () => {
    getAvailableProvidersMock.mockReturnValue([{ name: 'Groq' }])
    generateResponseMock.mockResolvedValue({ text: 'not-json', provider: 'Groq', attempts: [] })
    const res = createMockRes()

    await handler(requestWithAlerts([{ alertType: 'payout_mismatch', severity: 'critical', message: 'bad' }]), res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.enabled).toBe(false)
    expect(res.body?.data?.verdict).toBe('critical')
    expect(res.body?.data?.error).toBe('invalid_ai_json')
  })

  it('falls back deterministically when the AI provider throws', async () => {
    getAvailableProvidersMock.mockReturnValue([{ name: 'Groq' }])
    generateResponseMock.mockRejectedValue(new Error('provider unavailable'))
    const res = createMockRes()

    await handler(requestWithAlerts([{ alertType: 'payout_mismatch', severity: 'critical', message: 'bad' }]), res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.enabled).toBe(false)
    expect(res.body?.data?.verdict).toBe('critical')
    expect(res.body?.data?.error).toContain('llm_error:provider unavailable')
  })
})
