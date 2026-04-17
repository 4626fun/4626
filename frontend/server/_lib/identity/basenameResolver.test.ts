import { beforeEach, describe, expect, it, vi } from 'vitest'

const readContractMock = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: readContractMock,
    })),
  }
})

describe('getBasenameName', () => {
  beforeEach(() => {
    vi.resetModules()
    readContractMock.mockReset()
  })

  it('calls L2 Resolver contract and returns *.base.eth name', async () => {
    readContractMock.mockResolvedValueOnce('akita.base.eth')

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')

    expect(result).toBe('akita.base.eth')
    expect(readContractMock).toHaveBeenCalledTimes(1)
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD',
        functionName: 'name',
      }),
    )
  })

  it('returns null when resolution is not a *.base.eth name', async () => {
    readContractMock.mockResolvedValueOnce('someone.eth')

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')

    expect(result).toBe(null)
  })

  it('returns null when contract returns empty string', async () => {
    readContractMock.mockResolvedValueOnce('')

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')

    expect(result).toBe(null)
  })

  it('returns null on contract call failure', async () => {
    readContractMock.mockRejectedValueOnce(new Error('revert'))

    const { getBasenameName } = await import('./basenameResolver')
    const result = await getBasenameName('0x1111111111111111111111111111111111111111')

    expect(result).toBe(null)
  })
})

describe('basenameToHandle', () => {
  it('strips .base.eth suffix', async () => {
    const { basenameToHandle } = await import('./basenameResolver')
    expect(basenameToHandle('akita.base.eth')).toBe('akita')
  })

  it('returns null for non-basename strings', async () => {
    const { basenameToHandle } = await import('./basenameResolver')
    expect(basenameToHandle('akita.eth')).toBe(null)
    expect(basenameToHandle('')).toBe(null)
    expect(basenameToHandle(null)).toBe(null)
  })
})
