import { describe, expect, it } from 'vitest'

import { credentialPresence, redactDoctorDetail } from './virtuals-acp-doctor-redaction.js'

describe('Virtuals ACP doctor redaction', () => {
  it('reports credential presence without any credential bytes', () => {
    expect(credentialPresence('wallet-id-secret')).toBe('(set)')
    expect(credentialPresence('')).toBe('(missing)')
    expect(credentialPresence('0x1234', false)).toBe('(invalid)')
  })

  it('removes configured credentials and stable address/key fragments', () => {
    const address = `0x${'ab'.repeat(20)}`
    const privateKey = `0x${'cd'.repeat(32)}`
    const apiKey = 'virtuals-api-stable-secret'
    const output = redactDoctorDetail(
      `wallet=${address} signer=${privateKey} api=${apiKey} Bearer abc.def`,
      [address, privateKey, apiKey],
    )
    expect(output).not.toContain(address)
    expect(output).not.toContain(privateKey)
    expect(output).not.toContain(apiKey)
    expect(output).not.toContain('abc.def')
  })
})
