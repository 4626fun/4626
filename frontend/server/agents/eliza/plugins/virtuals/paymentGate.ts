type SdkJobSessionPaymentShape = {
  status?: unknown
  job?: {
    status?: unknown
    budget?: { amount?: unknown } | null
  } | null
}

export type BacktestPaymentGateDecision = {
  allowed: boolean
  reason: string
  amountUsdc: number | null
}

/**
 * Fail-closed payment gate for ACP paid work. In acp-node-v2, a JobSession
 * exposes the loaded AcpJob at `session.job`, and its budget is an AssetToken
 * at `job.budget`. Paid work starts only in the SDK's funded state.
 *
 * Free offerings (funds-required=No) still transition to session/job FUNDED with
 * a zero budget amount. Treat protocol-funded status as the authority; a
 * positive budget is preferred metadata but not required once the SDK reports
 * funded.
 */
export function evaluateBacktestPaymentGate(sessionLike: unknown): BacktestPaymentGateDecision {
  const session = (sessionLike ?? {}) as SdkJobSessionPaymentShape
  const sessionStatus = String(session.status ?? '').trim().toLowerCase()
  const jobStatus = String(session.job?.status ?? '').trim().toUpperCase()
  const rawAmount = session.job?.budget?.amount
  const amountUsdc =
    typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount > 0
      ? rawAmount
      : null

  if (sessionStatus !== 'funded' || jobStatus !== 'FUNDED') {
    return {
      allowed: false,
      reason: `job_not_funded:session=${sessionStatus || 'unknown'},job=${jobStatus || 'unknown'}`,
      amountUsdc,
    }
  }
  if (amountUsdc != null) {
    return {
      allowed: true,
      reason: 'positive_payment_amount',
      amountUsdc,
    }
  }
  return {
    allowed: true,
    reason: 'protocol_funded_zero_budget',
    amountUsdc: 0,
  }
}
