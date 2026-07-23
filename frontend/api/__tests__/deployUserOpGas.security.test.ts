import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readSelfBundlePrivateKey,
  requiredPrefundWei,
} from '../_handlers/deploy/v2/session/deployUserOpGas.js'

describe('deployUserOpGas self-bundle security', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('never falls back to general-purpose service keys', () => {
    vi.stubEnv('DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY', '')
    vi.stubEnv('PRIVATE_KEY', `0x${'11'.repeat(32)}`)
    vi.stubEnv('KPR_PRIVATE_KEY', `0x${'22'.repeat(32)}`)
    expect(readSelfBundlePrivateKey()).toBeNull()

    const dedicated = `0x${'33'.repeat(32)}` as const
    vi.stubEnv('DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY', dedicated)
    expect(readSelfBundlePrivateKey()).toBe(dedicated)
  })

  it('uses the exact EP0.6 prefund without a withdrawable buffer', () => {
    expect(requiredPrefundWei({
      callGasLimit: 10n,
      verificationGasLimit: 20n,
      preVerificationGas: 30n,
      maxFeePerGas: 4n,
    })).toBe(240n)
  })
})
