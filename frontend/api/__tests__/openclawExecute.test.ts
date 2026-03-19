import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(),
  guardAgentApiRequest: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  handleOptions: mocks.handleOptions,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/uniswap/agentSkills.js', () => ({
  executeUniswapSkill: vi.fn(),
}))

vi.mock('../../server/_lib/agentRegistration.js', () => ({
  buildAgentRegistration: vi.fn(() => ({ payload: null })),
}))

vi.mock('../../server/_lib/agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: vi.fn(),
  resolveAgentRegistrationKey: vi.fn(),
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: vi.fn(),
}))

vi.mock('../../server/_lib/lensAccounts.js', () => ({
  resolveLensUserByOwner: vi.fn(),
}))

vi.mock('../../server/_lib/lensGrove.js', () => ({
  tryUploadImmutableJson: vi.fn(),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://4626.fun'),
}))

vi.mock('../../server/_lib/shareTokenMetadata.js', () => ({
  buildShareTokenMetadata: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/zora/_shared.js')>('../../server/zora/_shared.js')
  return {
    ...actual,
    requireServerKey: vi.fn(() => null),
  }
})

describe('openclaw execute handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
  })

  it('enforces guard before parsing payload', async () => {
    mocks.guardAgentApiRequest.mockImplementationOnce(async ({ res }: { res: any }) => {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1' }
    })
    mocks.readJsonBody.mockResolvedValue({ tool: 'wallet_portfolio', input: {} })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(mocks.readJsonBody).not.toHaveBeenCalled()
  })

  it('returns unknown tool error after successful guard', async () => {
    mocks.guardAgentApiRequest.mockResolvedValueOnce({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    mocks.readJsonBody.mockResolvedValueOnce({ tool: 'unknown_tool', input: {} })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('unknown tool')
    expect(mocks.guardAgentApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'openclaw/execute',
        kind: 'build',
      }),
    )
  })
})
