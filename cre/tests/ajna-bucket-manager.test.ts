import { describe, expect, it } from 'vitest';
import {
  bucketPriceChangeBps,
  clampBucketIndex,
  clampMinBucketIndex,
  computeSteppedBucket,
  deriveAjnaBucketFromV3Tick,
  pickBestLiquidityBucket,
  tickToAjnaBucket,
} from '../actions/ajna-bucket-manager.action.js';

describe('ajna bucket manager helpers', () => {
  it('clamps bucket index bounds', () => {
    expect(clampBucketIndex(0)).toBe(1);
    expect(clampBucketIndex(9_999)).toBe(7_388);
    expect(clampBucketIndex(4_156)).toBe(4_156);
  });

  it('preserves zero for min-bucket floor bounds', () => {
    expect(clampMinBucketIndex(0)).toBe(0);
    expect(clampMinBucketIndex(9_999)).toBe(7_388);
    expect(clampMinBucketIndex(4_156)).toBe(4_156);
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

  it('derives practical short bucket for 18/6 CREATOR-USDC pricing', () => {
    const bucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });
    expect(bucket).not.toBeNull();
    expect(bucket).toBeGreaterThan(1);
    expect(bucket).toBeLessThan(7_388);
    expect(bucket).toBeGreaterThan(1_400);
    expect(bucket).toBeLessThan(2_000);
  });

  it('keeps bucket derivation stable across token ordering flips', () => {
    const creatorAsToken0 = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x0000000000000000000000000000000000000011',
      usdToken: '0x0000000000000000000000000000000000000022',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    const creatorAsToken1 = deriveAjnaBucketFromV3Tick({
      twapTick: 401_529,
      creatorToken: '0x0000000000000000000000000000000000000022',
      usdToken: '0x0000000000000000000000000000000000000011',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(creatorAsToken0).toBe(creatorAsToken1);
  });

  it('moves to more conservative bucket as LTV decreases', () => {
    const marketLtvBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 10_000,
    });
    const conservativeLtvBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(marketLtvBucket).not.toBeNull();
    expect(conservativeLtvBucket).not.toBeNull();
    expect(conservativeLtvBucket!).toBeGreaterThan(marketLtvBucket!);
  });

  it('shows why non-normalized tick orientation clamps to bucket 1', () => {
    const naiveBucket = tickToAjnaBucket(401_529);
    const normalizedBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(naiveBucket).toBe(1);
    expect(normalizedBucket).not.toBe(1);
  });

  it('computes bucket price change in bps', () => {
    expect(
      bucketPriceChangeBps({
        currentBucket: 1000,
        suggestedBucket: 1000,
      }),
    ).toBe(0);

    // One bucket step is roughly +0.5% => 50 bps.
    expect(
      bucketPriceChangeBps({
        currentBucket: 1000,
        suggestedBucket: 1001,
      }),
    ).toBe(49);
  });

  it('10% trigger gate aligns with bucket distance', () => {
    const nineBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1209,
    });
    const nineteenBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1219,
    });
    const twentyBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1220,
    });
    expect(nineBucketMove).toBeLessThan(1_000); // <10%
    expect(nineteenBucketMove).toBeLessThan(1_000); // still <10% with flooring
    expect(twentyBucketMove).toBeGreaterThanOrEqual(1_000); // >=10%
  });
});

