import { BASE_APP_SUBSTITUTED_SIGNER_ERROR } from '@/lib/relay/baseAppOwnerInstallErrors'
import { externalBrowserUrlFor, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

export const BASE_APP_SELF_AUTH_PART1_BLOCKED =
  'base app cannot sign relay part 1 for session-key csw'

export function ownerInstallExternalBrowserUrl(): string {
  return externalBrowserUrlFor('/waitlist?setup=owner-install')
}

/**
 * Base App `wallet_sendCalls` substitutes ephemeral session keys that are not
 * CSW owners, so Relay Part 1 self-auth always fails preflight (AA24). Part 2
 * (passkey) can still run in Base App after Part 1 completes elsewhere.
 */
export function isBaseAppSelfAuthRelayPart1Blocked(params: {
  isSelfAuthSession: boolean
  hasConnectedOnchainEoaOwner?: boolean
}): boolean {
  if (!params.isSelfAuthSession) return false
  if (params.hasConnectedOnchainEoaOwner) return false
  return isBaseAppInAppContext()
}

export function buildBaseAppSelfAuthPart1BlockedMessage(): string {
  const externalUrl = ownerInstallExternalBrowserUrl()
  return (
    'Enable 4626 signing cannot finish inside the Base App browser for this wallet. ' +
    'Base App signs Relay deposits with a temporary key your smart wallet does not recognize. ' +
    `Open ${externalUrl} in Chrome or Safari, sign in with the same email, rebuild the preview, then submit step 2. ` +
    'You can return to Base App afterward to use the app.'
  )
}

export function mapBaseAppOwnerInstallSubmissionError(message: string): string | null {
  const normalized = message.toLowerCase()
  if (
    normalized.includes(BASE_APP_SELF_AUTH_PART1_BLOCKED) ||
    normalized.includes(BASE_APP_SUBSTITUTED_SIGNER_ERROR)
  ) {
    const externalUrl = ownerInstallExternalBrowserUrl()
    return (
      'Base App returned a signer your smart wallet does not recognize for the Relay deposit. ' +
      `Open ${externalUrl} in Chrome or Safari and retry Enable 4626 signing there.`
    )
  }
  return null
}
