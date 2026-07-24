/**
 * Resolve a short-TTL WETH→■ buyback route for gauge.processWETHFeesWithRoute.
 *
 * Best-path discovery stays offchain (Uniswap Routing API / X / aggregator).
 * The keeper loads the quoted router + calldata + minOut here and fails closed
 * if the quote TTL has elapsed.
 */

import { getAddress, isAddress, type Address, type Hex } from 'viem';

export type WethBuybackRoute = {
  gauge: Address;
  router: Address;
  calldata: Hex;
  wethAmount: bigint;
  minShareOftOut: bigint;
  quoteIssuedAtMs: number;
  quoteExpiresAtMs: number;
};

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Load and validate a pre-quoted buyback route from env.
 *
 * Required:
 *   KPR_WETH_BUYBACK_GAUGE
 *   KPR_WETH_BUYBACK_ROUTER
 *   KPR_WETH_BUYBACK_CALLDATA
 *   KPR_WETH_BUYBACK_AMOUNT
 *   KPR_WETH_BUYBACK_MIN_OUT
 *   KPR_WETH_BUYBACK_QUOTE_EXPIRES_AT_MS — unix ms; fail if now > expires
 *
 * Optional:
 *   KPR_WETH_BUYBACK_QUOTE_ISSUED_AT_MS — if set, age must be <= max age
 *   KPR_WETH_BUYBACK_QUOTE_MAX_AGE_MS — default 30000
 */
export function resolveWethBuybackRoute(nowMs: number = Date.now()): WethBuybackRoute {
  const gaugeRaw = requireEnv('KPR_WETH_BUYBACK_GAUGE');
  const routerRaw = requireEnv('KPR_WETH_BUYBACK_ROUTER');
  const calldata = requireEnv('KPR_WETH_BUYBACK_CALLDATA') as Hex;
  const wethAmount = BigInt(requireEnv('KPR_WETH_BUYBACK_AMOUNT'));
  const minShareOftOut = BigInt(requireEnv('KPR_WETH_BUYBACK_MIN_OUT'));
  const quoteExpiresAtMs = Number(requireEnv('KPR_WETH_BUYBACK_QUOTE_EXPIRES_AT_MS'));
  const quoteIssuedAtMs = Number(process.env.KPR_WETH_BUYBACK_QUOTE_ISSUED_AT_MS ?? '0');
  const maxAgeMs = Number(process.env.KPR_WETH_BUYBACK_QUOTE_MAX_AGE_MS ?? '30000');

  if (!isAddress(gaugeRaw) || !isAddress(routerRaw)) {
    throw new Error('invalid_weth_buyback_addresses');
  }
  if (!calldata.startsWith('0x') || calldata.length < 10) {
    throw new Error('invalid_weth_buyback_calldata');
  }
  if (wethAmount <= 0n) {
    throw new Error('weth_buyback_amount_zero');
  }
  if (minShareOftOut <= 0n) {
    throw new Error('weth_buyback_min_out_zero');
  }
  if (!Number.isFinite(quoteExpiresAtMs) || quoteExpiresAtMs <= 0) {
    throw new Error('invalid_weth_buyback_quote_expires_at');
  }
  if (nowMs > quoteExpiresAtMs) {
    throw new Error(`weth_buyback_quote_expired:now=${nowMs},expires=${quoteExpiresAtMs}`);
  }
  if (quoteIssuedAtMs > 0) {
    if (nowMs < quoteIssuedAtMs) {
      throw new Error('weth_buyback_quote_issued_in_future');
    }
    if (nowMs - quoteIssuedAtMs > maxAgeMs) {
      throw new Error(
        `weth_buyback_quote_stale:ageMs=${nowMs - quoteIssuedAtMs},maxAgeMs=${maxAgeMs}`,
      );
    }
  }

  return {
    gauge: getAddress(gaugeRaw) as Address,
    router: getAddress(routerRaw) as Address,
    calldata,
    wethAmount,
    minShareOftOut,
    quoteIssuedAtMs: quoteIssuedAtMs > 0 ? quoteIssuedAtMs : nowMs,
    quoteExpiresAtMs,
  };
}

/** Fail closed unless the operator confirms private-relay submission for this tick. */
export function assertWethBuybackPrivateSubmitReady(): void {
  const raw = String(process.env.KPR_WETH_BUYBACK_REQUIRE_PRIVATE_SUBMIT ?? '1').trim().toLowerCase();
  const requirePrivate = !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');

  if (!requirePrivate) return;

  if (!envFlag('KPR_WETH_BUYBACK_PRIVATE_SUBMIT_CONFIRMED')) {
    throw new Error(
      'weth_buyback_private_submit_unconfirmed: set KPR_WETH_BUYBACK_PRIVATE_SUBMIT_CONFIRMED=1 after quoting for private relay/builder submit (or set KPR_WETH_BUYBACK_REQUIRE_PRIVATE_SUBMIT=0 for non-prod)',
    );
  }
}
