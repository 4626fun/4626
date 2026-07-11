import { describe, expect, it } from 'vitest';

import {
  CANONICAL_LOTTERY_MANAGER,
  CANONICAL_SOLANA_BRIDGE_ADAPTER,
  normalizeLotteryManager,
  normalizeSolanaBridgeAdapter,
} from '../utils/solanaCanonicalAddresses.js';

describe('Solana keeper canonical v1.18 addresses', () => {
  it('pins the current adapter and LotteryManager', () => {
    expect(CANONICAL_SOLANA_BRIDGE_ADAPTER).toBe(
      '0x9A61814082A26192DD9Cb201b44058506685Be60',
    );
    expect(CANONICAL_LOTTERY_MANAGER).toBe(
      '0xB68F359e01626Ec5d15C624037311C70DacAba43',
    );
  });

  it('normalizes retired active defaults to the v1.18 targets', () => {
    expect(
      normalizeSolanaBridgeAdapter('0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'),
    ).toBe(CANONICAL_SOLANA_BRIDGE_ADAPTER);
    expect(
      normalizeSolanaBridgeAdapter('0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae'),
    ).toBe(CANONICAL_SOLANA_BRIDGE_ADAPTER);
    expect(
      normalizeLotteryManager('0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1'),
    ).toBe(CANONICAL_LOTTERY_MANAGER);
  });
});
