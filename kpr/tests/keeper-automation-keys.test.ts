import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KEEPER_AUTOMATION_PRIVATE_KEY_ENV,
  KEEPER_AUTOMATION_PUBLIC_KEY_ENV,
  assertKeeperAutomationKeyPair,
  resolveKeeperAutomationPublicAddress,
  resolveProtocolTreasurySafeOwnerPrivateKey,
} from '../utils/protocolTreasurySafe.js';

const AUTOMATION_PK = `0x${'11'.repeat(32)}` as const;
const AUTOMATION_ADDRESS = privateKeyToAccount(AUTOMATION_PK).address;
const OTHER_PK = `0x${'22'.repeat(32)}` as const;

describe('keeper automation env keys', () => {
  const prior: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of [
      KEEPER_AUTOMATION_PRIVATE_KEY_ENV,
      KEEPER_AUTOMATION_PUBLIC_KEY_ENV,
      'PROTOCOL_TREASURY_SAFE_OWNER_PK',
      'PROTOCOL_AUTOMATION_SAFE_OWNER_PK',
      'KPR_PRIVATE_KEY',
      'PRIVATE_KEY',
      'PROTOCOL_AJNA_KEEPER',
    ]) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  });

  function setEnv(key: string, value: string | undefined) {
    if (!(key in prior)) prior[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it('prefers treasury admin key over KPR_PRIVATE_KEY for treasury Safe exec', () => {
    setEnv('PRIVATE_KEY', OTHER_PK);
    setEnv('KPR_PRIVATE_KEY', AUTOMATION_PK);
    setEnv(KEEPER_AUTOMATION_PRIVATE_KEY_ENV, AUTOMATION_PK);

    expect(resolveProtocolTreasurySafeOwnerPrivateKey()).toBe(OTHER_PK);
  });

  it('does not use KPR_PRIVATE_KEY alone for treasury Safe exec', () => {
    setEnv('KPR_PRIVATE_KEY', AUTOMATION_PK);
    expect(resolveProtocolTreasurySafeOwnerPrivateKey()).toBeNull();
  });

  it('does not derive Ajna keeper from PRIVATE_KEY alone', () => {
    setEnv('PRIVATE_KEY', OTHER_PK);
    setEnv('KPR_PRIVATE_KEY', undefined);
    setEnv(KEEPER_AUTOMATION_PRIVATE_KEY_ENV, undefined);
    setEnv('PROTOCOL_AUTOMATION_SAFE_OWNER_PK', undefined);
    setEnv(KEEPER_AUTOMATION_PUBLIC_KEY_ENV, undefined);
    setEnv('PROTOCOL_AJNA_KEEPER', undefined);
    expect(resolveKeeperAutomationPublicAddress()).toBeNull();
  });

  it('prefers legacy automation private key for automation public address resolution', () => {
    setEnv(KEEPER_AUTOMATION_PRIVATE_KEY_ENV, AUTOMATION_PK);
    setEnv('KPR_PRIVATE_KEY', OTHER_PK);

    expect(resolveKeeperAutomationPublicAddress()).toBe(AUTOMATION_ADDRESS);
  });

  it('validates public/private pair when both are set', () => {
    setEnv(KEEPER_AUTOMATION_PRIVATE_KEY_ENV, AUTOMATION_PK);
    setEnv(KEEPER_AUTOMATION_PUBLIC_KEY_ENV, AUTOMATION_ADDRESS);
    expect(() => assertKeeperAutomationKeyPair()).not.toThrow();
  });

  it('rejects mismatched public/private pair', () => {
    setEnv(KEEPER_AUTOMATION_PRIVATE_KEY_ENV, AUTOMATION_PK);
    setEnv(KEEPER_AUTOMATION_PUBLIC_KEY_ENV, privateKeyToAccount(OTHER_PK).address);
    expect(() => assertKeeperAutomationKeyPair()).toThrow(/keeper_automation_key_pair_mismatch/);
  });
});
