import { describe, expect, it } from 'vitest';
import {
  normalizeTickToCreatorPerUsdcTick,
  tickPriceChangeBps,
} from '../actions/charm-rebalance-manager.action.js';

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
