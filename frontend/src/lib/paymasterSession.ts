export type PaymasterSessionStrategyParams = {
  hasMatchingSiweSession: boolean
  preferWalletSession: boolean
  signIn?: (() => Promise<string | null>) | null
  signInWithPrivyToken?: ((token: string) => Promise<string | null>) | null
  getPrivyAccessToken?: (() => Promise<string | null>) | null
}

export type PaymasterSessionResult = {
  ok: boolean
  reason: string | null
}

export async function ensureWalletAlignedPaymasterSessionDetailed(
  params: PaymasterSessionStrategyParams,
): Promise<PaymasterSessionResult> {
  if (params.hasMatchingSiweSession) {
    return { ok: true, reason: null }
  }

  let walletAttemptFailureReason: string | null = null
  if (params.preferWalletSession && typeof params.signIn === 'function') {
    try {
      const signed = await params.signIn()
      if (signed) return { ok: true, reason: null }
      walletAttemptFailureReason = 'wallet_signin_did_not_return_address'
    } catch {
      walletAttemptFailureReason = 'wallet_signin_failed'
    }
  }

  if (
    typeof params.getPrivyAccessToken !== 'function' ||
    typeof params.signInWithPrivyToken !== 'function'
  ) {
    return {
      ok: false,
      reason: walletAttemptFailureReason ?? 'no_privy_bridge_available',
    }
  }

  try {
    const token = await params.getPrivyAccessToken()
    if (!token) {
      return {
        ok: false,
        reason: 'missing_privy_access_token',
      }
    }
    const bridged = await params.signInWithPrivyToken(token)
    if (bridged) return { ok: true, reason: null }
    return {
      ok: false,
      reason: 'privy_bridge_did_not_return_address',
    }
  } catch {
    return {
      ok: false,
      reason: 'privy_bridge_failed',
    }
  }
}

export async function ensureWalletAlignedPaymasterSession(
  params: PaymasterSessionStrategyParams,
): Promise<boolean> {
  const result = await ensureWalletAlignedPaymasterSessionDetailed(params)
  return result.ok
}
