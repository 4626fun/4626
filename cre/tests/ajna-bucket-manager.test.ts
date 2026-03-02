import { describe, expect, it } from 'vitest';
import {
  clampBucketIndex,
  computeSteppedBucket,
  pickBestLiquidityBucket,
} from '../actions/ajna-bucket-manager.action.js';

describe('ajna bucket manager helpers', () => {
  it('clamps bucket index bounds', () => {
    expect(clampBucketIndex(0)).toBe(1);
    expect(clampBucketIndex(9_999)).toBe(7_388);
    expect(clampBucketIndex(4_156)).toBe(4_156);
  });

  it('does not move when delta is under threshold', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 4_180,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(false);
    expect(out.steppedBucket).toBe(4_156);
    expect(out.rawDelta).toBe(24);
  });

  it('caps upward move by max step', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 5_000,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(true);
    expect(out.steppedBucket).toBe(4_406);
    expect(out.rawDelta).toBe(844);
  });

  it('caps downward move by max step', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 3_000,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(true);
    expect(out.steppedBucket).toBe(3_906);
    expect(out.rawDelta).toBe(-1_156);
  });

  it('picks bucket with highest nearby liquidity', () => {
    const chosen = pickBestLiquidityBucket({
      centerBucket: 4_406,
      candidates: [
        { index: 4_390, deposit: 100n },
        { index: 4_406, deposit: 250n },
        { index: 4_420, deposit: 600n },
      ],
    });
    expect(chosen).toBe(4_420);
  });

  it('breaks equal-liquidity ties by closest distance to center', () => {
    const chosen = pickBestLiquidityBucket({
      centerBucket: 4_406,
      candidates: [
        { index: 4_370, deposit: 600n },
        { index: 4_410, deposit: 600n },
      ],
    });
    expect(chosen).toBe(4_410);
  });
});

