import { describe, expect, it } from 'vitest';

import {
  CANONICAL_LOTTERY_MANAGER,
  normalizeLotteryManager,
} from '../utils/solanaCanonicalAddresses.js';

describe('Solana keeper canonical v1.18 addresses', () => {
  it('pins the current LotteryManager', () => {
    expect(CANONICAL_LOTTERY_MANAGER).toBe(
      '0xB68F359e01626Ec5d15C624037311C70DacAba43',
    );
  });

  it('normalizes retired LotteryManager defaults to the v1.18 target', () => {
    expect(
      normalizeLotteryManager('0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1'),
    ).toBe(CANONICAL_LOTTERY_MANAGER);
  });
});
