/** Canonical mainnet addresses for Solana keeper workflows (v1.11.1 release target). */

export const CANONICAL_SOLANA_BRIDGE_ADAPTER =
  '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1' as const;

export const CANONICAL_LOTTERY_MANAGER =
  '0x5c0115589d7F4930A0dc93417aE409f44186f4E7' as const;

const DEPRECATED_SOLANA_BRIDGE_ADAPTERS = new Set([
  '0x2414b595c4f18532a5836b6e2e6d536832c572e8',
  '0x3a9dc0b2c11b348e4bd60d9605dc3d4be9bb6cf5',
  '0x90f578a4e23c1cb8ddfe63fd496ed7f4474f2b00',
]);

const DEPRECATED_LOTTERY_MANAGERS = new Set([
  '0x3f7afd93824ab25f73bdca59afdab560f865b0c3',
]);

function normalizeAddress(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeSolanaBridgeAdapter(value: string | undefined | null): string {
  const raw = String(value ?? '').trim();
  const normalized = normalizeAddress(raw);
  if (!normalized) return CANONICAL_SOLANA_BRIDGE_ADAPTER;
  if (DEPRECATED_SOLANA_BRIDGE_ADAPTERS.has(normalized)) return CANONICAL_SOLANA_BRIDGE_ADAPTER;
  return raw;
}

export function normalizeLotteryManager(value: string | undefined | null): string {
  const raw = String(value ?? '').trim();
  const normalized = normalizeAddress(raw);
  if (!normalized) return CANONICAL_LOTTERY_MANAGER;
  if (DEPRECATED_LOTTERY_MANAGERS.has(normalized)) return CANONICAL_LOTTERY_MANAGER;
  return raw;
}
