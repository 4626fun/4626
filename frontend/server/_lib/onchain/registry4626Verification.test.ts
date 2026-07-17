import { beforeEach, describe, expect, it, vi } from 'vitest'

const readContractMock = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({ readContract: readContractMock }),
    http: () => ({}),
  }
})

vi.mock('./contracts.js', () => ({
  getApiContracts: () => ({
    registry: '0x1111111111111111111111111111111111111111',
  }),
}))

import { validateRegistry4626ShareOftBinding } from './registry4626Verification.js'

const CREATOR_TOKEN = '0x2222222222222222222222222222222222222222'
const SHARE_OFT = '0x3333333333333333333333333333333333333333'

describe('validateRegistry4626ShareOftBinding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === 'isTokenActive') return Promise.resolve(true)
      if (functionName === 'getShareOFTForToken') return Promise.resolve(SHARE_OFT)
      throw new Error(`unexpected function ${functionName}`)
    })
  })

  it('accepts the active creator token canonical ShareOFT', async () => {
    await expect(validateRegistry4626ShareOftBinding({
      creatorToken: CREATOR_TOKEN,
      shareOft: SHARE_OFT,
    })).resolves.toEqual({ ok: true, mode: 'registry' })
  })

  it('rejects a ShareOFT that differs from Registry4626', async () => {
    await expect(validateRegistry4626ShareOftBinding({
      creatorToken: CREATOR_TOKEN,
      shareOft: '0x4444444444444444444444444444444444444444',
    })).resolves.toEqual({ ok: false, reason: 'share_token_mismatch' })
  })
})
