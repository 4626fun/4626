export type DeployAccessState = 'checking' | 'ready' | 'waitlist'

export type ResolveDoneStepDeployAccessStateParams = {
  isBypassAdmin: boolean
  verifiedWallet: string | null | undefined
}

export type ResolveDoneStepDeployAccessStateResult = {
  state: DeployAccessState
  addressToCheck: string | null
}

/**
 * Resolves the deploy access state for the Done step without async work.
 * - Admin bypass: ready immediately, no wallet needed.
 * - Missing/invalid wallet: waitlist (terminal, avoids hanging in 'checking').
 * - Valid wallet: checking (caller must fetch allowlist and resolve to ready/waitlist).
 */
export function resolveDoneStepDeployAccessState({
  isBypassAdmin,
  verifiedWallet,
}: ResolveDoneStepDeployAccessStateParams): ResolveDoneStepDeployAccessStateResult {
  const EVM_RE = /^0x[a-fA-F0-9]{40}$/
  if (isBypassAdmin) {
    return { state: 'ready', addressToCheck: null }
  }
  const raw = typeof verifiedWallet === 'string' ? verifiedWallet.trim() : ''
  if (!raw || !EVM_RE.test(raw)) {
    return { state: 'waitlist', addressToCheck: null }
  }
  return { state: 'checking', addressToCheck: raw.toLowerCase() }
}
