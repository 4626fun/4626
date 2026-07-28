/**
 * Preflight helpers so Creator Coin CCA launch floors track the underlying
 * Zora V4 TWAP (`computeMarketFloorQuote`) instead of a stale or dust-pool
 * oracle seed.
 *
 * AgentTokenV4 markets are Virtuals V2 (`uniswapV2Pair`) — they do not expose
 * Zora `getPoolKey()`, so the V4 cross-check must not run for `vaultKind=agent`.
 */

export const ORACLE_MAX_STALENESS_SEC = 7200

/** Max |oracle − marketFloor| / marketFloor before launch is blocked (20%). */
export const ORACLE_MARKET_FLOOR_MAX_DEVIATION_BPS = 2000n

export type OracleLaunchVaultKind = 'creator' | 'agent'

/**
 * Zora V4 market-floor cross-check is Creator Coin only.
 * Agent deploys keep the onchain `previewLaunchPricing` gate instead.
 */
export function usesZoraV4MarketFloorCrossCheck(
  vaultKind: OracleLaunchVaultKind,
): boolean {
  return vaultKind === 'creator'
}

export type OracleLaunchPreflightInput = {
  /** Creator USD from CreatorOracle.getAssetPrice (1e18). */
  oracleAssetUsd1e18: bigint
  oracleUpdatedAtSec: number
  /** Creator USD implied by V4 market floor (1e18). */
  marketFloorUsd1e18: bigint
  nowSec?: number
  maxStalenessSec?: number
  maxDeviationBps?: bigint
}

export type OracleLaunchPreflightResult =
  | { ok: true }
  | { ok: false; reason: string }

function absDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a
}

/**
 * Require a fresh oracle USD print that is within band of the Zora V4 market floor.
 * `requiredRaise` (e.g. 0.1 ETH) is unrelated — it is only the graduation minimum.
 */
export function evaluateOracleLaunchPreflight(
  input: OracleLaunchPreflightInput,
): OracleLaunchPreflightResult {
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000)
  const maxStalenessSec = input.maxStalenessSec ?? ORACLE_MAX_STALENESS_SEC
  const maxDeviationBps =
    input.maxDeviationBps ?? ORACLE_MARKET_FLOOR_MAX_DEVIATION_BPS

  if (input.oracleAssetUsd1e18 <= 0n || input.oracleUpdatedAtSec <= 0) {
    return {
      ok: false,
      reason:
        'CreatorOracle has no fresh asset USD price. Seed initializeAssetPrice from the Zora V4 market floor (not a dust V3 pool).',
    }
  }

  if (nowSec < input.oracleUpdatedAtSec) {
    return { ok: false, reason: 'CreatorOracle timestamp is in the future' }
  }

  if (nowSec - input.oracleUpdatedAtSec >= maxStalenessSec) {
    return {
      ok: false,
      reason: `CreatorOracle asset USD is stale (>${maxStalenessSec}s). Refresh from the Zora V4 market floor before launching the CCA.`,
    }
  }

  if (input.marketFloorUsd1e18 <= 0n) {
    return {
      ok: false,
      reason:
        'Zora V4 market floor USD is unavailable; cannot validate CCA launch pricing',
    }
  }

  const deviationBps =
    (absDiff(input.oracleAssetUsd1e18, input.marketFloorUsd1e18) * 10_000n) /
    input.marketFloorUsd1e18
  if (deviationBps > maxDeviationBps) {
    return {
      ok: false,
      reason:
        `CreatorOracle USD diverges from Zora V4 market floor by ${deviationBps.toString()} bps ` +
        `(max ${maxDeviationBps.toString()} bps). Re-seed oracle from market floor before launch.`,
    }
  }

  return { ok: true }
}

/** Implied fully-diluted valuation in ETH for a 1e9 token supply at wei/token. */
export function impliedFdvEthFromWeiPerToken(params: {
  weiPerToken: bigint
  totalSupplyTokens?: bigint
}): number {
  const supply = params.totalSupplyTokens ?? 1_000_000_000n
  if (params.weiPerToken <= 0n) return 0
  const weiFdv = params.weiPerToken * supply
  return Number(weiFdv) / 1e18
}
