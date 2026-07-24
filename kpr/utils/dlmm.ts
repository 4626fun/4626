import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Load the Meteora DLMM SDK under kpr's ESM package.
 * The published package mixes CJS named exports with a default DLMM class.
 */
export function loadDlmmSdk(): any {
  const mod = require('@meteora-ag/dlmm');
  return mod;
}

export function loadDlmmClass(): any {
  const mod = loadDlmmSdk();
  return mod?.default ?? mod?.DLMM ?? mod;
}

export function loadBn(): any {
  return require('bn.js');
}

/** Canonical B2 official-market swap fee (6.9%). */
export const CANONICAL_DLMM_FEE_BPS = 690;

/** CollectFeeMode.OnlyY — settle swap fees in Token Y / WSOL. */
export const COLLECT_FEE_MODE_ONLY_Y = 1;

export function feePercentageToBps(percentage: unknown): number {
  const value =
    percentage && typeof (percentage as { toNumber?: () => number }).toNumber === 'function'
      ? (percentage as { toNumber: () => number }).toNumber()
      : Number(percentage ?? NaN);
  if (!Number.isFinite(value)) {
    throw new Error(`invalid_fee_percentage:${String(percentage)}`);
  }
  return Math.round(value * 100);
}
