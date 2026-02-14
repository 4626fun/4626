import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readSessionFromRequestMock, readSiwaAgentFromRequestMock } = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

import { readRequestPrincipal, readRequestPrincipalAddress } from '../../server/_lib/requestPrincipal.js'

describe('request principal resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)
  })

  it('prefers session over SIWA when both are present', () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0xAbC' } as any)
    readSiwaAgentFromRequestMock.mockReturnValue({ address: '0xDef' } as any)

    const principal = readRequestPrincipal({} as any)
    expect(principal).toEqual({ source: 'session', address: '0xabc' })
  })

  it('uses SIWA when session is missing', () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue({ address: '0xDef' } as any)

    const principal = readRequestPrincipal({} as any)
    expect(principal).toEqual({ source: 'siwa', address: '0xdef' })
    expect(readRequestPrincipalAddress({} as any)).toBe('0xdef')
  })

  it('returns empty when neither principal exists', () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)

    expect(readRequestPrincipal({} as any)).toBeNull()
    expect(readRequestPrincipalAddress({} as any)).toBe('')
  })
})
