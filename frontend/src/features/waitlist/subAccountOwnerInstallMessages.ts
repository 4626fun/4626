export const SUB_ACCOUNT_WRONG_BROWSER_MESSAGE =
  '4626 app-wallet signing only works inside Base App. Open 4626 in Base App (not Safari, Chrome, or wallet extensions), then tap Enable 4626 signing.'

export const SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE =
  'Base App blocked or dismissed the signing prompt. Confirm Base Mainnet is selected, tap Enable 4626 signing again, and approve the wallet transaction when Base App asks.'

export const SUB_ACCOUNT_USER_REJECTED_MESSAGE =
  'Signing was canceled in Base App. Tap Enable 4626 signing again and approve the transaction.'

export const SUB_ACCOUNT_TESTNET_MESSAGE =
  'Base App is currently in testnet mode. 4626 signing setup requires Base Mainnet. Switch Base App to mainnet, reopen 4626, and run Enable 4626 signing again.'

export const SUB_ACCOUNT_IN_BASE_APP_HINT =
  'Approve one transaction in Base App when prompted. Your main Base wallet stays unchanged.'

export const SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_PENDING_MESSAGE =
  'Your 4626 signer is linked, but Base App still needs to approve one on-chain owner transaction on your app wallet before swaps can run. Tap Enable 4626 signing again and approve the prompt.'

export const SUB_ACCOUNT_COUNTERFACTUAL_RELAY_BLOCKED_MESSAGE =
  'Your app wallet is not deployed on Base yet. Finish Connect Base App first so the app wallet exists on-chain, then rebuild Enable 4626 signing. Relay owner install cannot apply addOwnerAddress to a counterfactual wallet.'

export const SUB_ACCOUNT_AA23_SIGNATURE_VALIDATION_MESSAGE =
  'Base App could not validate the smart-wallet signature for the on-chain owner step (AA23). Force-close 4626 in Base App, reopen this page, confirm Base Mainnet is selected, then tap Enable 4626 signing again.'

/** Strip nested setup wrapper text before classifying provider errors. */
export function normalizeSubAccountOwnerInstallErrorSource(message: string): string {
  const trimmed = message.trim()
  const prefix = 'failed to enable 4626 signing on your app wallet:'
  const lower = trimmed.toLowerCase()
  if (lower.startsWith(prefix)) {
    return trimmed.slice(prefix.length).trim() || trimmed
  }
  return trimmed
}

export function isAa23SubAccountOwnerInstallError(message: string): boolean {
  const lower = normalizeSubAccountOwnerInstallErrorSource(message).toLowerCase()
  return (
    lower.includes('aa23') ||
    lower.includes('signature validation failed during sponsorship') ||
    (lower.includes('validateuserop') && lower.includes('revert'))
  )
}

export function mapSubAccountOwnerInstallError(
  message: string,
  options: { inBaseApp: boolean },
): string {
  const lower = normalizeSubAccountOwnerInstallErrorSource(message).toLowerCase()
  if (isAa23SubAccountOwnerInstallError(message)) {
    return SUB_ACCOUNT_AA23_SIGNATURE_VALIDATION_MESSAGE
  }
  if (
    lower.includes('did not approve this signing request for your 4626 app wallet') ||
    lower.includes('open 4626 inside base app')
  ) {
    return options.inBaseApp ? SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE : SUB_ACCOUNT_WRONG_BROWSER_MESSAGE
  }
  if (lower.includes('base account wallet')) {
    return options.inBaseApp
      ? SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE
      : 'Connect Base App first (open this page in Base App), then tap Enable 4626 signing again.'
  }
  if (
    lower.includes('not been authorized by the user') ||
    lower.includes('requested method and/or account has not been authorized')
  ) {
    return options.inBaseApp ? SUB_ACCOUNT_BASE_APP_APPROVAL_FAILED_MESSAGE : SUB_ACCOUNT_WRONG_BROWSER_MESSAGE
  }
  if (
    lower.includes("mainnet wallet can't be used on testnet") ||
    lower.includes('unable to process testnet transactions after ownership changes') ||
    lower.includes('requires base mainnet')
  ) {
    return SUB_ACCOUNT_TESTNET_MESSAGE
  }
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return SUB_ACCOUNT_USER_REJECTED_MESSAGE
  }
  if (lower.includes('connect base app first')) {
    return message
  }
  if (!options.inBaseApp && (lower.includes('method not supported') || lower.includes('-32604'))) {
    return SUB_ACCOUNT_WRONG_BROWSER_MESSAGE
  }
  return message
}
