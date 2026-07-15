/** Canonical mainnet addresses for Solana keeper workflows (current release target). */

export const CANONICAL_LOTTERY_MANAGER =
  '0xB45E68a5867935a5734E4185977F81c528006650' as const;

const DEPRECATED_LOTTERY_MANAGERS = new Set([
  '0x3f7afd93824ab25f73bdca59afdab560f865b0c3',
  '0x5c0115589d7f4930a0dc93417ae409f44186f4e7',
  '0xbe87ad917be7f6a9ae1f9c9dd0a7ec7550f3f8c1',
  '0xb68f359e01626ec5d15c624037311c70dacaba43',
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
