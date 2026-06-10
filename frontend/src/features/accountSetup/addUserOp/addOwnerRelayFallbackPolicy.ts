import { mapAddOwnerFundingErrorMessage } from '@/lib/wallet/cswEntryPointFunding'

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('dismissed the base app signing prompt')
  )
}

/**
 * Direct `wallet_sendCalls` addOwner self-calls can fail when Base App blocks
 * owner-mutating selectors (often surfaced as "not enough funds"). Relay Method A
 * uses a Depository deposit UserOp (Part 1) + solver EntryPoint fill (Part 2).
 */
export function shouldAttemptRelayMethodAFallback(
  error: unknown,
  context: { fundingPreflightOk?: boolean },
): boolean {
  if (isUserRejectedWalletAction(error)) return false

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (mapAddOwnerFundingErrorMessage(error, context)) {
    return true
  }

  if (
    lower.includes('error generating transaction') ||
    lower.includes('could not build the userop') ||
    lower.includes('broadcast_error') ||
    lower.includes('relayrouter multicall') ||
    lower.includes('policy block') ||
    lower.includes('refused to build')
  ) {
    return true
  }

  return false
}
