import { beforeEach, describe, expect, it, vi } from 'vitest'

const getEnsProfileMock = vi.fn()
const getBasenameNameMock = vi.fn()

vi.mock('../_lib/identity/ensResolver.js', () => ({
  getEnsProfile: getEnsProfileMock,
}))

vi.mock('../_lib/identity/basenameResolver.js', () => ({
  getBasenameName: getBasenameNameMock,
}))

describe('handleWhoisCommand', () => {
  beforeEach(() => {
    vi.resetModules()
    getEnsProfileMock.mockReset()
    getBasenameNameMock.mockReset()
  })

  it('shows usage when no address provided', async () => {
    const { handleWhoisCommand } = await import('./whoisCommand')
    const res = await handleWhoisCommand({ text: '/whois' })
    expect(res.ok).toBe(false)
    expect(res.response).toMatch(/Usage:\s*\/whois/i)
  })

  it('rejects invalid addresses', async () => {
    const { handleWhoisCommand } = await import('./whoisCommand')
    const res = await handleWhoisCommand({ text: '/whois not-an-address' })
    expect(res.ok).toBe(false)
    expect(res.response).toMatch(/valid ethereum address/i)
  })

  it('formats ENS + Basename fields', async () => {
    getEnsProfileMock.mockResolvedValueOnce({
      name: 'wevm.eth',
      displayName: 'Wevm',
      twitter: 'wevm_dev',
      github: 'wevm',
      url: 'https://viem.sh',
      description: 'hello world',
    })
    getBasenameNameMock.mockResolvedValueOnce('akita.base.eth')

    const { handleWhoisCommand } = await import('./whoisCommand')
    const res = await handleWhoisCommand({
      text: '/whois 0x1111111111111111111111111111111111111111',
    })

    expect(res.ok).toBe(true)
    expect(res.response).toContain('- ens: wevm.eth')
    expect(res.response).toContain('- basename: akita.base.eth')
    expect(res.response).toContain('- twitter: @wevm_dev')
    expect(res.response).toContain('- github: wevm')
    expect(res.response).toContain('- url: https://viem.sh')
    expect(res.response).toContain('- bio: hello world')
  })
})

