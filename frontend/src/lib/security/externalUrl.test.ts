import { describe, expect, it } from 'vitest'

import { toSafeHttpsUrl } from './externalUrl'

describe('toSafeHttpsUrl', () => {
  it('accepts credential-free HTTPS URLs', () => {
    expect(toSafeHttpsUrl('https://example.com/profile')).toBe('https://example.com/profile')
  })

  it('rejects insecure and credential-bearing URLs', () => {
    expect(toSafeHttpsUrl('http://example.com')).toBeNull()
    expect(toSafeHttpsUrl('https://user:pass@example.com')).toBeNull()
    expect(toSafeHttpsUrl('javascript:alert(1)')).toBeNull()
  })

  it('enforces an exact domain or subdomain allowlist', () => {
    expect(toSafeHttpsUrl('https://app.ethos.network/u/1', { allowedDomains: ['ethos.network'] })).toBe(
      'https://app.ethos.network/u/1',
    )
    expect(toSafeHttpsUrl('https://ethos.network.evil.test/u/1', { allowedDomains: ['ethos.network'] })).toBeNull()
  })
})
