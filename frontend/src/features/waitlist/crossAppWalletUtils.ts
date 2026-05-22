/**
 * Privy cross-app auth helper for Zora linking during waitlist / account setup.
 *
 * Canonical CSW resolution lives in `useAccountSetupController` and server
 * identity helpers — not here.
 */

export type CrossAppAuthAction = 'link' | 'login'

export function selectCrossAppAuthAction(params: {
  privyAuthed: boolean
  linkCrossAppAccount: unknown
  loginWithCrossAppAccount: unknown
}): CrossAppAuthAction | null {
  const hasLink = typeof params.linkCrossAppAccount === 'function'
  const hasLogin = typeof params.loginWithCrossAppAccount === 'function'

  if (params.privyAuthed) {
    if (hasLink) return 'link'
    if (hasLogin) return 'login'
    return null
  }

  if (hasLogin) return 'login'
  if (hasLink) return 'link'
  return null
}
