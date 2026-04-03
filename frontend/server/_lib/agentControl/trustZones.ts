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

const ZONE_KILL_SWITCH_ENV_KEY_MAP: Record<KeeprTrustZone, string> = {
  financial_execution: 'KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION',
  market_maintenance: 'KEEPR_ZONE_DISABLE_MARKET_MAINTENANCE',
  queue_messaging_monitoring: 'KEEPR_ZONE_DISABLE_QUEUE_MESSAGING_MONITORING',
}

const ACTION_TYPE_ALIASES: Record<string, string> = {
  'xmtp.group.add_member': 'xmtp.group.add_member',
  add_member: 'xmtp.group.add_member',
  addmember: 'xmtp.group.add_member',
  'xmtp.group.remove_member': 'xmtp.group.remove_member',
  remove_member: 'xmtp.group.remove_member',
  removemember: 'xmtp.group.remove_member',
  'xmtp.group.send_message': 'xmtp.group.send_message',
  send_message: 'xmtp.group.send_message',
  sendmessage: 'xmtp.group.send_message',
  'xmtp.group.sync_members': 'xmtp.group.sync_members',
  sync_members: 'xmtp.group.sync_members',
  syncmembers: 'xmtp.group.sync_members',
  'strategy.ajna.rebucket': 'strategy.ajna.rebucket',
  ajna_rebucket: 'strategy.ajna.rebucket',
  ajnarebucket: 'strategy.ajna.rebucket',
  'strategy.charm.rebalance': 'strategy.charm.rebalance',
  charm_rebalance: 'strategy.charm.rebalance',
  charmrebalance: 'strategy.charm.rebalance',
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

export function getKeeprTrustZoneKillSwitchEnvKey(zone: KeeprTrustZone): string {
  return ZONE_KILL_SWITCH_ENV_KEY_MAP[zone]
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

export function resolveKeeprEffectiveActionType(
  actionType: string | null | undefined,
  actionPayload?: Record<string, unknown> | null,
): string | null {
  const candidates = [
    toSafeLower(actionPayload?.action),
    toSafeLower(actionType),
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    return ACTION_TYPE_ALIASES[candidate] ?? candidate
  }
  return null
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

export function formatTrustZoneDisabledError(zone: KeeprTrustZone): string {
  return `Trust zone disabled: ${zone}`
}

export function isKeeprTrustZoneWriteEnabled(
  zone: KeeprTrustZone,
  env: Record<string, string | undefined>,
): boolean {
  const raw = toSafeLower(env[getKeeprTrustZoneKillSwitchEnvKey(zone)])
  if (!raw) return true
  return !(raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on')
}

export function sanitizeZoneHeaderValue(value: unknown): string {
  return toTrimmed(value)
}
