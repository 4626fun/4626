import { afterEach, describe, expect, it, vi } from "vitest";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function importContracts() {
  vi.resetModules();
  return import("./contracts");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production contract env pins", () => {
  it("keeps the deployed Room 1659 pair fallback authoritative", async () => {
    const pair = "0x3333333333333333333333333333333333333333";
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR", pair);

    const { BASE_DEFAULTS } = await import("./contracts.defaults");
    const { CONTRACTS } = await importContracts();
    expect(BASE_DEFAULTS.room1659SudoswapPair).not.toBe(ZERO_ADDRESS);
    expect(CONTRACTS.room1659SudoswapPair).toBe(
      BASE_DEFAULTS.room1659SudoswapPair,
    );
  });

  it("keeps a nonzero BASE_DEFAULTS fallback authoritative", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_REGISTRY", "0x4444444444444444444444444444444444444444");

    const { BASE_DEFAULTS } = await import("./contracts.defaults");
    const { CONTRACTS } = await importContracts();
    expect(BASE_DEFAULTS.registry).not.toBe(ZERO_ADDRESS);
    expect(CONTRACTS.registry).toBe(BASE_DEFAULTS.registry);
  });
});
