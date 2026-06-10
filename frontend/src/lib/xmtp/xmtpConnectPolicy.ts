export type XmtpConnectIntent = 'auto' | 'user'

/**
 * Prefer Client.build whenever local OPFS or prior install markers exist.
 * Never skip restore just because OPFS listing returned false once.
 */
export function shouldAttemptXmtpRestore(input: {
  opfsDatabaseExists: boolean
  hasKnownInstallation: boolean
}): boolean {
  return input.opfsDatabaseExists || input.hasKnownInstallation
}

/**
 * Fail closed before Client.create when restore did not succeed but we still
 * have evidence of an existing browser/network installation.
 */
export function shouldRefuseAutoCreateAfterFailedRestore(input: {
  restoreSucceeded: boolean
  hasKnownInstallation: boolean
  opfsDatabaseExists: boolean
}): boolean {
  if (input.restoreSucceeded) return false
  return input.hasKnownInstallation || input.opfsDatabaseExists
}

/**
 * First-time browser install requires explicit user intent.
 * Passive/auto callers must not burn an installation slot.
 */
export function shouldAllowFirstTimeCreate(input: {
  intent: XmtpConnectIntent
  hasKnownInstallation: boolean
  opfsDatabaseExists: boolean
  restoreSucceeded: boolean
}): boolean {
  if (input.restoreSucceeded) return false
  if (input.hasKnownInstallation || input.opfsDatabaseExists) return false
  return input.intent === 'user'
}
