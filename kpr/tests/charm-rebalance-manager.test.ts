import { describe, expect, it } from 'vitest';
import {
  normalizeTickToCreatorPerUsdcTick,
  tickPriceChangeBps,
} from '../actions/charm-rebalance-manager.action.js';
import {
  assertManualTriggerAuthorized,
  UNAUTHORIZED_MANUAL_TRIGGER,
} from '../kpr-workflows/_shared/manualTriggerAuth.js';

describe('charm rebalance manager helpers', () => {
  it('normalizes tick consistently across token ordering', () => {
    const creatorAsToken0 = normalizeTickToCreatorPerUsdcTick({
      rawTick: -401_529,
      creatorToken: '0x0000000000000000000000000000000000000011',
      usdToken: '0x0000000000000000000000000000000000000022',
      creatorDecimals: 18,
      usdDecimals: 6,
    });
    const creatorAsToken1 = normalizeTickToCreatorPerUsdcTick({
      rawTick: 401_529,
      creatorToken: '0x0000000000000000000000000000000000000022',
      usdToken: '0x0000000000000000000000000000000000000011',
      creatorDecimals: 18,
      usdDecimals: 6,
    });

    expect(creatorAsToken0).toBe(creatorAsToken1);
  });

  it('returns null when token pair is invalid', () => {
    const normalized = normalizeTickToCreatorPerUsdcTick({
      rawTick: 0,
      creatorToken: '0x0000000000000000000000000000000000000011',
      usdToken: '0x0000000000000000000000000000000000000011',
      creatorDecimals: 18,
      usdDecimals: 6,
    });
    expect(normalized).toBeNull();
  });

  it('computes implied tick-based price move in bps', () => {
    expect(tickPriceChangeBps({ currentTick: 1000, referenceTick: 1000 })).toBe(0);
    expect(tickPriceChangeBps({ currentTick: 1010, referenceTick: 1000 })).toBe(10);
  });

  it('aligns 10% trigger with tick distance', () => {
    const belowTenPercent = tickPriceChangeBps({ currentTick: 1000, referenceTick: 1950 });
    const aboveTenPercent = tickPriceChangeBps({ currentTick: 1000, referenceTick: 1960 });

    expect(belowTenPercent).toBeLessThan(1_000);
    expect(aboveTenPercent).toBeGreaterThanOrEqual(1_000);
  });
});

/**
 * Regression test for ex-SEV-001 (4626-412).
 *
 * Audit context: the charm-rebalance-manager's HTTPCapability trigger can
 * enqueue rebalance actions. The audit finding was that the documented auth
 * fix existed in runbooks but not in code. The fix shipped in PR #318
 * (commit 847fee0) inside `kpr/kpr-workflows/charm-rebalance-manager/main.ts`
 * and now calls into the shared `assertManualTriggerAuthorized` helper.
 *
 * These tests pin the helper's contract, so a silent removal of the check
 * (or a regression that accepts empty/wrong tokens) fails CI before merge.
 */
describe('manual trigger auth gate [ex-SEV-001 charm-rebalance-manager]', () => {
  const SECRET = 'correct-horse-battery-staple';

  it('throws unauthorized_manual_trigger when authToken is undefined', () => {
    expect(() => assertManualTriggerAuthorized(undefined, SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('throws unauthorized_manual_trigger when authToken is an empty string', () => {
    expect(() => assertManualTriggerAuthorized('', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('throws unauthorized_manual_trigger when authToken does not match the secret', () => {
    expect(() => assertManualTriggerAuthorized('wrong-token', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('does not throw when authToken exactly matches the configured secret', () => {
    expect(() => assertManualTriggerAuthorized(SECRET, SECRET)).not.toThrow();
  });

  it('is case-sensitive and rejects mismatched casing', () => {
    expect(() => assertManualTriggerAuthorized(SECRET.toUpperCase(), SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('throws even when the configured secret itself is empty (guards against `authToken === "" && secret === ""` bypass)', () => {
    // Both sides empty must still reject: an empty authToken is never authorized.
    expect(() => assertManualTriggerAuthorized('', '')).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
    // And a provided token with an empty configured secret must reject too.
    expect(() => assertManualTriggerAuthorized('anything', '')).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });
});
