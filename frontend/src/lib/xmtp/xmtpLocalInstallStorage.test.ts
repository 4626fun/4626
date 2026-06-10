// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildXmtpDbPath,
  clearStoredEncKeyHex,
  clearStoredInstallationMeta,
  hasKnownXmtpInstallation,
  readStoredEncKeyHex,
  readStoredInstallationMeta,
  writeInstallationProvisioned,
  writeStoredEncKeyHex,
  writeStoredInstallationMeta,
} from './xmtpLocalInstallStorage'

const ENV = 'production' as const
const ADDRESS = '0xAb6D5c10B03300326cD7Fab7267ae192842967B5'

describe('xmtpLocalInstallStorage', () => {
  afterEach(() => {
    clearStoredEncKeyHex(ENV, ADDRESS)
    clearStoredInstallationMeta(ENV, ADDRESS)
    window.localStorage.removeItem(`cv:xmtp:installationProvisioned:${ENV}:${ADDRESS.toLowerCase()}`)
  })

  it('persists encryption keys in localStorage for reload-safe Client.build', () => {
    const encKey = `0x${'ab'.repeat(32)}`
    writeStoredEncKeyHex(ENV, ADDRESS, encKey)
    expect(window.localStorage.getItem(`cv:xmtp:encKey:${ENV}:${ADDRESS.toLowerCase()}`)).toBe(encKey)
    expect(readStoredEncKeyHex(ENV, ADDRESS)).toBe(encKey)
  })

  it('builds deterministic db paths from inbox id', () => {
    expect(buildXmtpDbPath(ENV, 'inbox123')).toBe('xmtp-production-inbox123.db3')
  })

  it('treats stored installation meta as a known installation', () => {
    writeStoredInstallationMeta(ENV, ADDRESS, {
      inboxId: 'inbox123',
      installationId: 'install456',
    })

    expect(readStoredInstallationMeta(ENV, ADDRESS)).toEqual({
      inboxId: 'inbox123',
      installationId: 'install456',
      updatedAt: expect.any(Number),
    })
    expect(hasKnownXmtpInstallation(ENV, ADDRESS)).toBe(true)
  })

  it('treats provisioned flag as a known installation', () => {
    writeInstallationProvisioned(ENV, ADDRESS)
    expect(hasKnownXmtpInstallation(ENV, ADDRESS)).toBe(true)
  })
})
