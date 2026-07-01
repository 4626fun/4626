/**
 * KPR client for protocol-treasury PayoutRouter self-heal (wrapper whitelist, NoFees, swap paths).
 *
 * Platform referrer rewards (ZORA_PLATFORM_REFERRER_ADDRESS) are a separate lane from per-vault
 * creatorCoinPayoutRecipient — they accrue to the platform referrer, not each vault's PayoutRouter.
 */

const DEFAULT_API_BASE = 'https://4626.fun/api'

export async function maybeExecutePayoutRouterTreasurySetup(params: {
  payoutRouter: `0x${string}`
  creatorToken: `0x${string}`
  env?: Record<string, string | undefined>
}): Promise<{ attempted: boolean; executed: boolean; txHash?: string; skipReason?: string }> {
  const env = params.env ?? process.env
  const autoSetupRaw = String(env.PAYOUT_ROUTER_TREASURY_AUTO_SETUP ?? '').trim().toLowerCase()
  if (!(autoSetupRaw === '1' || autoSetupRaw === 'true' || autoSetupRaw === 'yes')) {
    return { attempted: false, executed: false, skipReason: 'auto_setup_disabled' }
  }

  const apiKey = String(env.KPR_API_KEY ?? '').trim()
  if (!apiKey) {
    return { attempted: true, executed: false, skipReason: 'missing_kpr_api_key' }
  }

  const apiBaseUrl = String(env.KPR_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
  const response = await fetch(`${apiBaseUrl}/keeper/payout-router-treasury-setup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payoutRouterAddress: params.payoutRouter,
      creatorTokenAddress: params.creatorToken,
      execute: true,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: { executed?: boolean; txHash?: string; plan?: { skipReason?: string } } }
    | null

  if (!response.ok || !body?.success) {
    return { attempted: true, executed: false, skipReason: 'treasury_setup_request_failed' }
  }

  return {
    attempted: true,
    executed: body.data?.executed === true,
    txHash: body.data?.txHash,
    skipReason: body.data?.executed ? undefined : body.data?.plan?.skipReason,
  }
}

declare const process: { env: Record<string, string | undefined> }
