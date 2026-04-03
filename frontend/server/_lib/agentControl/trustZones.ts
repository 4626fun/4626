import { toSafeLower, toTrimmed } from './types.js'

export type KeeprTrustZone =
  | 'financial_execution'
  | 'market_maintenance'
  | 'queue_messaging_monitoring'

export const KEEPR_TRUST_ZONE_HEADER = 'x-keepr-trust-zone'
export const KEEPR_TRUST_ZONE_KEY_HEADER = 'x-keepr-zone-key'

const TRUST_ZONE_VALUES: KeeprTrustZone[] = [
  'financial_execution',
  'market_maintenance',
  'queue_messaging_monitoring',
]

const ZONE_ENV_KEY_MAP: Record<KeeprTrustZone, string> = {
  financial_execution: 'KEEPR_ZONE_KEY_FINANCIAL_EXECUTION',
  market_maintenance: 'KEEPR_ZONE_KEY_MARKET_MAINTENANCE',
  queue_messaging_monitoring: 'KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING',
}

const QUEUE_ACTION_PREFIXES = ['xmtp.group.', 'xmtp.dm.', 'notify.', 'message.', 'telegram.notify']
const MAINTENANCE_PREFIXES = ['runtime.', 'monitor.', 'healthcheck.', 'keeper.monitor.']
const FINANCIAL_PREFIXES = ['strategy.', 'trade.', 'vault.', 'payout.', 'routing.', 'bridge.']
const FINANCIAL_ACTION_NAMES = ['rebucket', 'rebalance', 'bid', 'withdraw', 'deposit', 'execute']

export function parseKeeprTrustZone(value: unknown): KeeprTrustZone | null {
  const normalized = toSafeLower(value)
  if (!normalized) return null
  const match = TRUST_ZONE_VALUES.find((zone) => zone === normalized)
  return match ?? null
}

export function getKeeprTrustZoneEnvKey(zone: KeeprTrustZone): string {
  return ZONE_ENV_KEY_MAP[zone]
}

export function resolveKeeprTrustZone(actionType: string | null | undefined): KeeprTrustZone {
  const normalizedAction = toSafeLower(actionType)
  if (!normalizedAction) return 'market_maintenance'

  if (QUEUE_ACTION_PREFIXES.some((prefix) => normalizedAction.startsWith(prefix))) {
    return 'queue_messaging_monitoring'
  }
  if (MAINTENANCE_PREFIXES.some((prefix) => normalizedAction.startsWith(prefix))) {
    return 'market_maintenance'
  }
  if (FINANCIAL_PREFIXES.some((prefix) => normalizedAction.startsWith(prefix))) {
    return 'financial_execution'
  }
  if (FINANCIAL_ACTION_NAMES.some((token) => normalizedAction.includes(token))) {
    return 'financial_execution'
  }
  return 'financial_execution'
}

export function isActionTypeInTrustZone(
  actionType: string | null | undefined,
  zone: KeeprTrustZone,
): boolean {
  return resolveKeeprTrustZone(actionType) === zone
}

export function readRequestedKeeprTrustZone(
  value: string | string[] | undefined,
): KeeprTrustZone | null {
  const raw = Array.isArray(value) ? value[0] : value
  return parseKeeprTrustZone(raw)
}

export function formatTrustZoneError(zone: KeeprTrustZone): string {
  return `Unauthorized trust zone: ${zone}`
}

export function sanitizeZoneHeaderValue(value: unknown): string {
  return toTrimmed(value)
}
