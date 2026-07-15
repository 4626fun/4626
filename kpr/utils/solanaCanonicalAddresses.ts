/** Canonical mainnet addresses for Solana keeper workflows (current release target). */

export const CANONICAL_LOTTERY_MANAGER =
  '0xB68F359e01626Ec5d15C624037311C70DacAba43' as const;

const DEPRECATED_LOTTERY_MANAGERS = new Set([
  '0x3f7afd93824ab25f73bdca59afdab560f865b0c3',
  '0x5c0115589d7f4930a0dc93417ae409f44186f4e7',
  '0xbe87ad917be7f6a9ae1f9c9dd0a7ec7550f3f8c1',
]);

function normalizeAddress(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeLotteryManager(value: string | undefined | null): string {
  const raw = String(value ?? '').trim();
  const normalized = normalizeAddress(raw);
  if (!normalized) return CANONICAL_LOTTERY_MANAGER;
  if (DEPRECATED_LOTTERY_MANAGERS.has(normalized)) return CANONICAL_LOTTERY_MANAGER;
  return raw;
}
