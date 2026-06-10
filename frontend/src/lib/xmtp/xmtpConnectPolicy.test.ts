// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import {
  shouldAllowFirstTimeCreate,
  shouldAttemptXmtpRestore,
  shouldRefuseAutoCreateAfterFailedRestore,
} from './xmtpConnectPolicy'

describe('xmtpConnectPolicy', () => {
  it('always attempts restore when OPFS or install markers exist', () => {
    expect(
      shouldAttemptXmtpRestore({ opfsDatabaseExists: true, hasKnownInstallation: false }),
    ).toBe(true)
    expect(
      shouldAttemptXmtpRestore({ opfsDatabaseExists: false, hasKnownInstallation: true }),
    ).toBe(true)
    expect(
      shouldAttemptXmtpRestore({ opfsDatabaseExists: false, hasKnownInstallation: false }),
    ).toBe(false)
  })

  it('refuses auto-create after failed restore when install evidence exists', () => {
    expect(
      shouldRefuseAutoCreateAfterFailedRestore({
        restoreSucceeded: false,
        hasKnownInstallation: true,
        opfsDatabaseExists: false,
      }),
    ).toBe(true)
    expect(
      shouldRefuseAutoCreateAfterFailedRestore({
        restoreSucceeded: false,
        hasKnownInstallation: false,
        opfsDatabaseExists: true,
      }),
    ).toBe(true)
    expect(
      shouldRefuseAutoCreateAfterFailedRestore({
        restoreSucceeded: true,
        hasKnownInstallation: true,
        opfsDatabaseExists: true,
      }),
    ).toBe(false)
  })

  it('allows Client.create only for explicit first-time user intent', () => {
    expect(
      shouldAllowFirstTimeCreate({
        intent: 'auto',
        hasKnownInstallation: false,
        opfsDatabaseExists: false,
        restoreSucceeded: false,
      }),
    ).toBe(false)
    expect(
      shouldAllowFirstTimeCreate({
        intent: 'user',
        hasKnownInstallation: false,
        opfsDatabaseExists: false,
        restoreSucceeded: false,
      }),
    ).toBe(true)
    expect(
      shouldAllowFirstTimeCreate({
        intent: 'user',
        hasKnownInstallation: true,
        opfsDatabaseExists: false,
        restoreSucceeded: false,
      }),
    ).toBe(false)
  })
})
