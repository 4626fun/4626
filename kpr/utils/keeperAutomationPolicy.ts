import { getAddress, type Address } from 'viem';

/** Keep in sync with `frontend/server/_lib/wallet/keeperAutomationPolicy.ts`. */
export const CANONICAL_KEEPER_AUTOMATION_EOA =
  '0xed7efe34d25a0b219de1b25ac99eb35e48cc1379' as const satisfies Address;

export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV_SHELL = 'KEEPER_AUTOMATION_PUBLIC_KEY' as const;
export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV_SHELL = 'KEEPER_AUTOMATION_PRIVATE_KEY' as const;
export const KEEPER_AUTOMATION_PUBLIC_KEY_ENV_LEGACY = '4626_KEEPER_AUTOMATION_PUBLIC_KEY' as const;
export const KEEPER_AUTOMATION_PRIVATE_KEY_ENV_LEGACY = '4626_KEEPER_AUTOMATION_PRIVATE_KEY' as const;
export const PROTOCOL_AJNA_KEEPER_ENV = 'PROTOCOL_AJNA_KEEPER' as const;
export const PAYOUT_ROUTER_KEEPER_ENV = 'PAYOUT_ROUTER_KEEPER' as const;
export const KPR_PRIVATE_KEY_ENV = 'KPR_PRIVATE_KEY' as const;

export function isCanonicalKeeperAutomationEoa(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  try {
    return getAddress(raw).toLowerCase() === CANONICAL_KEEPER_AUTOMATION_EOA;
  } catch {
    return false;
  }
}
