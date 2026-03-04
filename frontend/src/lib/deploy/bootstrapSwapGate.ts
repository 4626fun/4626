export type BootstrapSwapPlanLike = {
  hasSwap: boolean
  providerRequested: string
  providerUsed?: string | null
  fallbackUsed?: boolean
  swapError?: string | null
}

export function buildBootstrapSwapUnavailableMessage(plan: BootstrapSwapPlanLike): string {
  const requested = String(plan.providerRequested || 'unknown').trim() || 'unknown'
  const used = plan.providerUsed ? String(plan.providerUsed).trim() : ''
  const via = used ? ` Last attempted provider: ${used}.` : ''
  const reason = plan.swapError ? ` Reason: ${String(plan.swapError).trim()}.` : ''
  const fallbackHint = plan.fallbackUsed
    ? ' Fallback was attempted.'
    : ' Consider enabling provider fallback or checking provider API credentials.'
  return `Bootstrap USDC swap route unavailable for provider "${requested}".${via}${reason}${fallbackHint} Deployment is blocked until a bootstrap route is available.`
}

export function assertBootstrapSwapPlanReady(plan: BootstrapSwapPlanLike): void {
  if (plan.hasSwap) return
  throw new Error(buildBootstrapSwapUnavailableMessage(plan))
}
