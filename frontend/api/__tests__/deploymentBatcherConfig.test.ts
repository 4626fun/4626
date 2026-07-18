import { afterEach, describe, expect, it } from "vitest";

import {
  BASE_DEFAULTS,
  LEGACY_DEPLOYMENT_BATCHER,
  MODULE_MISMATCH_DEPLOYMENT_BATCHER,
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_SALT_DISABLED_BATCHER,
  isShareOftSaltOverrideDisabledBatcher,
  normalizeDeploymentBatcherAddress,
} from "../../src/config/contracts.defaults.ts";
import { getApiContracts } from "../../server/_lib/onchain/contracts.ts";

const ENV_KEYS = [
  "DEPLOYMENT_BATCHER",
  "DEPLOYMENT_BATCHER_AUTO_HANDOFF",
  "ALLOW_API_CONTRACT_OVERRIDES",
  "VERCEL",
  "SUDOSWAP_PAIR_FACTORY",
  "ALFACLUB_SUDOSWAP_ADAPTER",
  "ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
  "UNIVERSAL_BYTECODE_STORE",
] as const;

function clearBatcherEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearBatcherEnv();
});

describe("deploymentBatcher config normalization", () => {
  it("normalizeDeploymentBatcherAddress rejects deprecated aliases", () => {
    expect(
      normalizeDeploymentBatcherAddress(LEGACY_DEPLOYMENT_BATCHER),
    ).toBeUndefined();
    expect(
      normalizeDeploymentBatcherAddress(MODULE_MISMATCH_DEPLOYMENT_BATCHER),
    ).toBeUndefined();
    expect(
      normalizeDeploymentBatcherAddress(PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER),
    ).toBeUndefined();
  });

  it("normalizeDeploymentBatcherAddress keeps canonical batcher", () => {
    expect(
      normalizeDeploymentBatcherAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER),
    ).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER);
  });

  it("isShareOftSaltOverrideDisabledBatcher includes known salt-disabled split batchers", () => {
    expect(
      isShareOftSaltOverrideDisabledBatcher(SPLIT_PHASE1_SALT_DISABLED_BATCHER),
    ).toBe(true);
    expect(
      isShareOftSaltOverrideDisabledBatcher(
        PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER,
      ),
    ).toBe(true);
    expect(
      isShareOftSaltOverrideDisabledBatcher(LEGACY_DEPLOYMENT_BATCHER),
    ).toBe(false);
  });

  it("getApiContracts falls back to canonical default for deprecated env override in local/dev mode", () => {
    process.env.DEPLOYMENT_BATCHER = LEGACY_DEPLOYMENT_BATCHER;
    const contracts = getApiContracts();
    expect(contracts.deploymentBatcher).toBe(BASE_DEFAULTS.deploymentBatcher);
  });

  it("getApiContracts accepts canonical batcher env override", () => {
    process.env.DEPLOYMENT_BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER;
    const contracts = getApiContracts();
    expect(contracts.deploymentBatcher).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER);
  });

  it("getApiContracts ignores env overrides on Vercel unless explicitly allowed", () => {
    process.env.VERCEL = "1";
    process.env.DEPLOYMENT_BATCHER = LEGACY_DEPLOYMENT_BATCHER;
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES;

    const contracts = getApiContracts();
    expect(contracts.deploymentBatcher).toBe(BASE_DEFAULTS.deploymentBatcher);
  });

  it("getApiContracts allows greenfield ve env on Vercel when no BASE_DEFAULTS exist", () => {
    process.env.VERCEL = "1";
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES;
    const gauge = "0x1111111111111111111111111111111111111111";
    process.env.VE4626_GAUGE_VOTING = gauge;
    process.env.BRIBES_FACTORY_4626 =
      "0x2222222222222222222222222222222222222222";

    const contracts = getApiContracts();
    expect(contracts.ve4626GaugeVoting).toBe(gauge);
    expect(contracts.bribesFactory4626).toBe(
      "0x2222222222222222222222222222222222222222",
    );

    delete process.env.VE4626_GAUGE_VOTING;
    delete process.env.BRIBES_FACTORY_4626;
  });

  it("getApiContracts allows a Vercel env pin when the BASE_DEFAULTS fallback is zero", () => {
    process.env.VERCEL = "1";
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES;
    const pair = "0x3333333333333333333333333333333333333333";
    process.env.ALFACLUB_ROOM_1659_SUDOSWAP_PAIR = pair;

    const contracts = getApiContracts();
    expect(BASE_DEFAULTS.room1659SudoswapPair).toBe(
      "0x0000000000000000000000000000000000000000",
    );
    expect(contracts.room1659SudoswapPair).toBe(pair);
  });

  it("getApiContracts ignores a Vercel env pin when the BASE_DEFAULTS fallback is nonzero", () => {
    process.env.VERCEL = "1";
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES;
    process.env.UNIVERSAL_BYTECODE_STORE =
      "0x4444444444444444444444444444444444444444";

    const contracts = getApiContracts();
    expect(BASE_DEFAULTS.universalBytecodeStore).not.toBe(
      "0x0000000000000000000000000000000000000000",
    );
    expect(contracts.universalBytecodeStore).toBe(
      BASE_DEFAULTS.universalBytecodeStore,
    );
  });
});
