import { describe, expect, it } from 'vitest';

import { PROTOCOL_TREASURY_ADDRESS } from '../config.js';
import { resolveCharmAutomationAuthorization } from '../utils/protocolTreasurySafe.js';

const KEEPER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DELEGATE = '0xcccccccccccccccccccccccccccccccccccccccc';

describe('resolveCharmAutomationAuthorization', () => {
  it('allows enqueue when manager is protocol treasury regardless of keeper slot', () => {
    const result = resolveCharmAutomationAuthorization({
      managerAddress: PROTOCOL_TREASURY_ADDRESS,
      delegateAddress: OTHER,
      charmKeeper: OTHER,
      charmOwner: OTHER,
      keeperAddress: KEEPER,
    });

    expect(result).toEqual({ authorized: true, lane: 'protocol_treasury_manager' });
  });

  it('allows legacy direct keeper path when delegate matches keeper', () => {
    const result = resolveCharmAutomationAuthorization({
      managerAddress: OTHER,
      delegateAddress: KEEPER,
      charmKeeper: null,
      charmOwner: OTHER,
      keeperAddress: KEEPER,
    });

    expect(result).toEqual({ authorized: true, lane: 'keeper_direct' });
  });

  it('rejects when keeper slot is occupied by a different address', () => {
    const result = resolveCharmAutomationAuthorization({
      managerAddress: OTHER,
      delegateAddress: null,
      charmKeeper: OTHER,
      charmOwner: null,
      keeperAddress: KEEPER,
    });

    expect(result).toEqual({ authorized: false, reason: 'keeper_not_charm_vault_keeper' });
  });

  it('rejects when owner slot mismatches and delegate is not keeper', () => {
    const result = resolveCharmAutomationAuthorization({
      managerAddress: OTHER,
      delegateAddress: DELEGATE,
      charmKeeper: null,
      charmOwner: OTHER,
      keeperAddress: KEEPER,
    });

    expect(result).toEqual({ authorized: false, reason: 'keeper_not_charm_vault_owner' });
  });
});
