import { normalizePriceImpactPercent } from '@/lib/swap/swapQuoteDetails'

/** Max slippage auto mode may use for quotes, simulation escalation, and bundler retries. */
export const SWAP_AUTO_SLIPPAGE_ESCALATION_CAP_PCT = 30

const SLIPPAGE_LADDER_PCT = [0.5, 1, 2, 5, 10, 15, 20, 25, 30] as const

export type ResolveAutoSwapSlippageInput = {
  preferZoraTradeRoute?: boolean
  executionMode?: 'canonical' | 'eoa'
  /** From the active quote (percent, 0–100). */
  priceImpactPercent?: number | null
  quotedProvider?: 'zora' | 'uniswap' | 'cdp' | null
}

export function parsePriceImpactPercentFromLabel(label: string | null | undefined): number | null {
  if (!label) return null
  if (label.trim() === '<0.01%') return 0.01
  return normalizePriceImpactPercent(label)
}

function snapSlippageToLadder(pct: number): number {
  const capped = Math.min(SWAP_AUTO_SLIPPAGE_ESCALATION_CAP_PCT, Math.max(0.5, pct))
  let chosen: number = SLIPPAGE_LADDER_PCT[0]
  for (const step of SLIPPAGE_LADDER_PCT) {
    if (capped + 1e-9 >= step) chosen = step
  }
  return chosen
}

/**
 * Picks a slippage tolerance for thin creator pools and sponsored CSW Zora paths.
 * Floors match production escalation notes in zoraTradeApi (≥5% on CSW).
 */
export function resolveAutoSwapSlippagePct(input: ResolveAutoSwapSlippageInput): number {
  const isZora = input.quotedProvider === 'zora' || Boolean(input.preferZoraTradeRoute)
  const isCanonical = input.executionMode === 'canonical'

  let floor = 0.5
  if (isZora) {
    floor = isCanonical ? 5 : 2
  } else if (isCanonical) {
    // Creator-coin Uniswap routes on CSW need more than API DEFAULT auto slippage.
    floor = 2
  }

  const impact = input.priceImpactPercent
  if (impact != null && Number.isFinite(impact) && impact > 0) {
    const fromImpact = impact * 1.25 + 0.5
    floor = Math.max(floor, fromImpact)
  }

  return snapSlippageToLadder(floor)
}

/** Next ladder step after a simulation/send failure (Uniswap + canonical CSW). */
export function pickNextSwapSlippageEscalationPct(slippagePct: number): number | null {
  const capped = Math.min(SWAP_AUTO_SLIPPAGE_ESCALATION_CAP_PCT, Math.max(0.5, slippagePct))
  for (const step of SLIPPAGE_LADDER_PCT) {
    if (step > capped + 1e-9) return step
  }
  return null
}

/** Pick slippage for a send-time retry; may refresh at the same pct when escalation is blocked (stale quote). */
export function resolveSwapSendRetrySlippagePct(params: {
  sendAttempt: number
  activeSlippagePct: number
  slippageAuto: boolean
  parsedSlippage: number
  slippageEscalationCapPct: number
  pickNext: (current: number) => number | null
  sendError: unknown
  isRetryable: (error: unknown) => boolean
}): number | null {
  let retrySlippagePct = params.pickNext(params.activeSlippagePct)
  if (
    !params.slippageAuto &&
    retrySlippagePct != null &&
    retrySlippagePct > params.parsedSlippage + 1e-9
  ) {
    retrySlippagePct = null
  }
  if (retrySlippagePct != null && retrySlippagePct > params.slippageEscalationCapPct + 1e-9) {
    retrySlippagePct = null
  }
  if (
    (retrySlippagePct == null || retrySlippagePct <= params.activeSlippagePct) &&
    params.isRetryable(params.sendError) &&
    params.sendAttempt === 0
  ) {
    return params.activeSlippagePct
  }
  if (retrySlippagePct == null || retrySlippagePct <= params.activeSlippagePct) {
    return null
  }
  return retrySlippagePct
}

export function formatSlippagePctForDisplay(pct: number): string {
  if (!Number.isFinite(pct)) return '0.5'
  const rounded = Math.round(pct * 100) / 100
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded))
  return rounded.toFixed(2).replace(/\.?0+$/, '')
}
