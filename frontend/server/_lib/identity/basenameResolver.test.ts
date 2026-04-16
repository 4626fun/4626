import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base } from 'viem/chains'

const getEnsNameMock = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getEnsName: getEnsNameMock,
    })),
  }
})

describe('getBasenameName', () => {
  beforeEach(() => {
    vi.resetModules()
    getEnsNameMock.mockReset()
  })

  it('calls getEnsName with Base coinType + CCIP gatewayUrls', async () => {
    getEnsNameMock.mockResolvedValueOnce('akita.base.eth')

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')
    const { toCoinType } = await import('viem')

    expect(result).toBe('akita.base.eth')
    expect(getEnsNameMock).toHaveBeenCalledTimes(1)
    expect(getEnsNameMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coinType: toCoinType(base.id),
        gatewayUrls: ['https://ccip.ens.xyz'],
      }),
    )
  })

  it('returns null when resolution is not a *.base.eth name', async () => {
    getEnsNameMock.mockResolvedValueOnce('someone.eth')

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')

    expect(result).toBe(null)
  })
})
