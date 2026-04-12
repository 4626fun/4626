export type PaymasterSessionStrategyParams = {
  hasMatchingSiweSession: boolean
  preferWalletSession: boolean
  signIn?: (() => Promise<string | null>) | null
  signInWithPrivyToken?: ((token: string) => Promise<string | null>) | null
  getPrivyAccessToken?: (() => Promise<string | null>) | null
}

export async function ensureWalletAlignedPaymasterSession(
  params: PaymasterSessionStrategyParams,
): Promise<boolean> {
  if (params.hasMatchingSiweSession) return true

  if (params.preferWalletSession && typeof params.signIn === 'function') {
    try {
      const signed = await params.signIn()
      if (signed) return true
    } catch {
      // Fall through to the Privy bridge only if available.
    }
  }

  if (
    typeof params.getPrivyAccessToken !== 'function' ||
    typeof params.signInWithPrivyToken !== 'function'
  ) {
    return false
  }

  try {
    const token = await params.getPrivyAccessToken()
    if (!token) return false
    const bridged = await params.signInWithPrivyToken(token)
    return Boolean(bridged)
  } catch {
    return false
  }
}
