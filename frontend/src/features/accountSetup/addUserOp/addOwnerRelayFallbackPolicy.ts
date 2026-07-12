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

export function mapBaseAppOwnerInstallRpcError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    !lower.includes('failed to fetch rpc request') &&
    !lower.includes('wallet_preparecalls') &&
    !lower.includes('internal error was received')
  ) {
    return null
  }

  return (
    'Base App could not prepare the signing request, so nothing was submitted on-chain. ' +
    'Stay in Base App, force-close and reopen this link, confirm Base Mainnet, rebuild the preview, then retry once.'
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
  if (mapBaseAppOwnerInstallRpcError(error)) return false

  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (mapAddOwnerFundingErrorMessage(error, context)) {
    return context.fundingPreflightOk === true
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
