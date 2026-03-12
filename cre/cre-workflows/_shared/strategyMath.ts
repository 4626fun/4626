const MIN_BUCKET_INDEX = 1
const MAX_BUCKET_INDEX = 7388
const AJNA_BUCKET_PRICE_STEP = 1.005
const LOG_1_0001 = Math.log(1.0001)
const LOG_10_BASE_1_0001 = Math.log(10) / LOG_1_0001

function floorDiv(a: number, b: number): number {
  const q = Math.trunc(a / b)
  const r = a % b
  if (a < 0 && r !== 0) return q - 1
  return q
}

export function clampBucketIndex(index: number): number {
  return Math.max(MIN_BUCKET_INDEX, Math.min(MAX_BUCKET_INDEX, Math.floor(index)))
}

export function clampMinBucketIndex(index: number): number {
  return Math.max(0, Math.min(MAX_BUCKET_INDEX, Math.floor(index)))
}

export function tickToAjnaBucket(tick: number): number {
  const q = floorDiv(tick, 50)
  return clampBucketIndex(4156 - q)
}

function compareAddressNumeric(a: `0x${string}`, b: `0x${string}`): number {
  const av = BigInt(a)
  const bv = BigInt(b)
  if (av === bv) return 0
  return av > bv ? 1 : -1
}

export function normalizeTickToCreatorPerUsdcTick(params: {
  rawTick: number
  creatorToken: `0x${string}`
  usdToken: `0x${string}`
  creatorDecimals: number
  usdDecimals: number
}): number | null {
  if (!Number.isFinite(params.rawTick)) return null
  if (!Number.isFinite(params.creatorDecimals) || !Number.isFinite(params.usdDecimals)) return null
  if (params.creatorToken.toLowerCase() === params.usdToken.toLowerCase()) return null

  const creatorIsToken1 = compareAddressNumeric(params.creatorToken, params.usdToken) > 0
  const orientedTick = creatorIsToken1 ? params.rawTick : -params.rawTick
  const decimalsTickOffset = (params.usdDecimals - params.creatorDecimals) * LOG_10_BASE_1_0001
  const normalized = Math.floor(orientedTick + decimalsTickOffset)
  if (!Number.isFinite(normalized)) return null
  return normalized
}

export function deriveAjnaBucketFromV3Tick(params: {
  twapTick: number
  creatorToken: `0x${string}`
  usdToken: `0x${string}`
  creatorDecimals: number
  usdDecimals: number
  targetLtvBps: number
}): number | null {
  if (!Number.isFinite(params.twapTick)) return null
  if (params.targetLtvBps <= 0 || params.targetLtvBps > 10_000) return null
  if (params.creatorToken.toLowerCase() === params.usdToken.toLowerCase()) return null

  const creatorIsToken1 = compareAddressNumeric(params.creatorToken, params.usdToken) > 0
  const orientedTick = creatorIsToken1 ? params.twapTick : -params.twapTick
  const decimalsTickOffset = (params.usdDecimals - params.creatorDecimals) * LOG_10_BASE_1_0001
  const ltvFactor = params.targetLtvBps / 10_000
  const ltvTickOffset = Math.log(ltvFactor) / LOG_1_0001
  const adjustedTick = Math.floor(orientedTick + decimalsTickOffset + ltvTickOffset)
  if (!Number.isFinite(adjustedTick)) return null
  return tickToAjnaBucket(adjustedTick)
}

export function bucketPriceChangeBps(params: {
  currentBucket: number
  suggestedBucket: number
}): number {
  const current = clampMinBucketIndex(params.currentBucket)
  const suggested = clampMinBucketIndex(params.suggestedBucket)
  const delta = Math.abs(suggested - current)
  if (delta === 0) return 0

  const ratio = Math.pow(AJNA_BUCKET_PRICE_STEP, delta)
  if (!Number.isFinite(ratio) || ratio <= 1) return Number.MAX_SAFE_INTEGER

  const bps = Math.floor((ratio - 1) * 10_000)
  if (!Number.isFinite(bps) || bps < 0) return Number.MAX_SAFE_INTEGER
  return Math.min(Number.MAX_SAFE_INTEGER, bps)
}

export function computeSteppedBucket(params: {
  currentBucket: number
  suggestedBucket: number
  moveThreshold: number
  maxStep: number
}): {
  shouldMove: boolean
  rawDelta: number
  steppedBucket: number
} {
  const current = clampMinBucketIndex(params.currentBucket)
  const suggested = clampMinBucketIndex(params.suggestedBucket)
  const rawDelta = suggested - current
  const absDelta = Math.abs(rawDelta)
  if (absDelta < params.moveThreshold) {
    return { shouldMove: false, rawDelta, steppedBucket: current }
  }

  const capped = Math.min(absDelta, Math.max(1, params.maxStep))
  const step = rawDelta < 0 ? -capped : capped
  return {
    shouldMove: true,
    rawDelta,
    steppedBucket: clampMinBucketIndex(current + step),
  }
}

export function pickBestLiquidityBucket(params: {
  centerBucket: number
  candidates: Array<{ index: number; deposit: bigint }>
}): number {
  let bestIndex = clampBucketIndex(params.centerBucket)
  let bestDeposit = -1n
  let bestDistance = Number.MAX_SAFE_INTEGER

  for (const c of params.candidates) {
    const index = clampBucketIndex(c.index)
    const deposit = c.deposit >= 0n ? c.deposit : 0n
    const distance = Math.abs(index - params.centerBucket)
    if (deposit > bestDeposit) {
      bestDeposit = deposit
      bestDistance = distance
      bestIndex = index
      continue
    }
    if (deposit === bestDeposit && distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

export function tickPriceChangeBps(params: {
  currentTick: number
  referenceTick: number
}): number {
  const delta = Math.abs(params.currentTick - params.referenceTick)
  if (delta === 0) return 0

  const ratio = Math.pow(1.0001, delta)
  if (!Number.isFinite(ratio) || ratio <= 1) return Number.MAX_SAFE_INTEGER

  const bps = Math.floor((ratio - 1) * 10_000)
  if (!Number.isFinite(bps) || bps < 0) return Number.MAX_SAFE_INTEGER
  return Math.min(Number.MAX_SAFE_INTEGER, bps)
}
