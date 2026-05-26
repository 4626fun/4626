import { describe, expect, it } from 'vitest';

import { PROTOCOL_TREASURY_ADDRESS } from '../config.js';
import { resolveCharmAutomationAuthorization } from '../utils/protocolTreasurySafe.js';

const KEEPER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const DELEGATE = '0xcccccccccccccccccccccccccccccccccccccccc';
const AUTOMATION_SAFE = '0xdddddddddddddddddddddddddddddddddddddddd';

describe('resolveCharmAutomationAuthorization', () => {
  it('prefers protocol automation Safe lane when manager matches env', () => {
    const previous = process.env.PROTOCOL_AUTOMATION_SAFE;
    process.env.PROTOCOL_AUTOMATION_SAFE = AUTOMATION_SAFE;

    try {
      const result = resolveCharmAutomationAuthorization({
        managerAddress: AUTOMATION_SAFE,
        delegateAddress: OTHER,
        charmKeeper: OTHER,
        charmOwner: OTHER,
        keeperAddress: KEEPER,
      });

      expect(result).toEqual({ authorized: true, lane: 'protocol_automation_manager' });
    } finally {
      if (previous === undefined) delete process.env.PROTOCOL_AUTOMATION_SAFE;
      else process.env.PROTOCOL_AUTOMATION_SAFE = previous;
    }
  });

  it('allows legacy treasury manager lane when automation Safe is not configured', () => {
    const previous = process.env.PROTOCOL_AUTOMATION_SAFE;
    delete process.env.PROTOCOL_AUTOMATION_SAFE;

    try {
      const result = resolveCharmAutomationAuthorization({
        managerAddress: PROTOCOL_TREASURY_ADDRESS,
        delegateAddress: OTHER,
        charmKeeper: OTHER,
        charmOwner: OTHER,
        keeperAddress: KEEPER,
      });

      expect(result).toEqual({ authorized: true, lane: 'protocol_treasury_manager' });
    } finally {
      if (previous === undefined) delete process.env.PROTOCOL_AUTOMATION_SAFE;
      else process.env.PROTOCOL_AUTOMATION_SAFE = previous;
    }
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
