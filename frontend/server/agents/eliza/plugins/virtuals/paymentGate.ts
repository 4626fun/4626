type Path = readonly string[]

const POSITIVE_STATUS_HINTS = /(funded|paid|in_progress|active|delivering|delivering_work|working)/
const NEGATIVE_STATUS_HINTS = /(awaiting_funding|needs_funding|unfunded|unpaid|draft|quote_pending)/

const NUMERIC_AMOUNT_PATHS: Path[] = [
  ['budget'],
  ['budget', 'amount'],
  ['budgetAmount'],
  ['price'],
  ['priceUsdc'],
  ['paymentAmount'],
  ['paidAmount'],
  ['fundedAmount'],
  ['escrowAmount'],
  ['escrow', 'amount'],
  ['compensation'],
  ['compensation', 'amount'],
  ['payment', 'amount'],
  ['payment', 'amountUsdc'],
  ['payment', 'budget'],
]

const ROOT_CANDIDATE_PATHS: Path[] = [
  [],
  ['job'],
  ['jobState'],
  ['state'],
  ['metadata'],
  ['jobMetadata'],
  ['room'],
]

function readAtPath(root: unknown, path: Path): unknown {
  let cursor: unknown = root
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor
}

function readPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function findPaymentAmountUsdc(sessionLike: unknown): number | null {
  let maxFound: number | null = null
  for (const rootPath of ROOT_CANDIDATE_PATHS) {
    const scopedRoot = readAtPath(sessionLike, rootPath)
    if (scopedRoot == null) continue
    for (const amountPath of NUMERIC_AMOUNT_PATHS) {
      const value = readAtPath(scopedRoot, amountPath)
      const numeric = readPositiveNumber(value)
      if (numeric == null) continue
      maxFound = maxFound == null ? numeric : Math.max(maxFound, numeric)
    }
  }
  return maxFound
}

export type BacktestPaymentGateDecision = {
  allowed: boolean
  reason: string
  amountUsdc: number | null
}

/**
 * Best-effort payment gate for ACP backtests.
 * We allow execution when there is a positive budget/payment signal, or when
 * status explicitly looks funded/active. We deny when status explicitly says
 * unfunded or when no payment signal is present.
 */
export function evaluateBacktestPaymentGate(sessionLike: unknown): BacktestPaymentGateDecision {
  const status = String(
    (sessionLike as { status?: unknown } | null)?.status ?? '',
  ).trim().toLowerCase()
  const amountUsdc = findPaymentAmountUsdc(sessionLike)

  if (NEGATIVE_STATUS_HINTS.test(status)) {
    return {
      allowed: false,
      reason: `job_status_unpaid:${status || 'unknown'}`,
      amountUsdc,
    }
  }
  if (amountUsdc != null) {
    return {
      allowed: true,
      reason: 'positive_budget_signal',
      amountUsdc,
    }
  }
  if (POSITIVE_STATUS_HINTS.test(status)) {
    return {
      allowed: true,
      reason: `status_allows_without_amount:${status}`,
      amountUsdc,
    }
  }
  return {
    allowed: false,
    reason: 'missing_payment_signal',
    amountUsdc,
  }
}
