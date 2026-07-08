import { readArenaConfig } from '../arena/arenaConfig.js'
import { resolveRoomDefaultArenaIdentity } from '../arena/arenaIdentityMappingStore.js'
import { resolveRoom1659HyperliquidPortfolioUser } from './room1659Market.js'
import {
  HL_POSITION_ALERT_SCOPE,
  disablePositionAlert,
  readHyperliquidAlertDefaults,
  readPositionAlert,
  upsertPositionAlert,
  type PositionAlertConfig,
} from './positionAlertStore.js'

export const ROOM_1659_ALERT_SCOPE = '1659'

export type MonitoredHlWallet = {
  label: string
  address: string
}

const EVM_ADDRESS_RE = /^0x[a-f0-9]{40}$/

function normalizeAddress(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  return EVM_ADDRESS_RE.test(trimmed) ? trimmed : null
}

export function resolveHermitAlertScope(roomId: string | null | undefined): string {
  if (String(roomId ?? '').trim() === ROOM_1659_ALERT_SCOPE) {
    return ROOM_1659_ALERT_SCOPE
  }
  return HL_POSITION_ALERT_SCOPE
}

export function isRoom1659AlertScope(scope: string): boolean {
  return scope === ROOM_1659_ALERT_SCOPE
}

export function isSupportedAlertScope(scope: string): boolean {
  return scope === HL_POSITION_ALERT_SCOPE || isRoom1659AlertScope(scope)
}

function pickArenaHlWalletAddress(identity: {
  hlApiWalletAddress: string | null
  agentWalletAddress: string | null
}): string | null {
  return normalizeAddress(identity.hlApiWalletAddress) ?? normalizeAddress(identity.agentWalletAddress)
}

export async function resolveMonitoredHlWalletsForAlert(
  alert: PositionAlertConfig,
): Promise<MonitoredHlWallet[]> {
  if (isRoom1659AlertScope(alert.roomId)) {
    const roomHl = resolveRoom1659HyperliquidPortfolioUser()
    const baseConfig = readArenaConfig()
    const arenaIdentity = await resolveRoomDefaultArenaIdentity({
      roomId: ROOM_1659_ALERT_SCOPE,
      baseConfig,
    })
    const arenaHl = pickArenaHlWalletAddress(arenaIdentity)
    const wallets: MonitoredHlWallet[] = [{ label: 'Room HL portfolio', address: roomHl }]
    if (arenaHl && arenaHl !== roomHl) {
      wallets.push({ label: 'Virtual Arena execution', address: arenaHl })
    }
    return wallets
  }
  return [{ label: 'Your HL wallet', address: alert.senderAddress }]
}

export async function resolveRoom1659MonitoredHlWallets(): Promise<MonitoredHlWallet[]> {
  return resolveMonitoredHlWalletsForAlert({
    roomId: ROOM_1659_ALERT_SCOPE,
    senderAddress: '0x0000000000000000000000000000000000000000',
    enabled: false,
    telegramEnabled: false,
    liquidationWarnPct: null,
    targetPnlUsd: null,
    targetProgressPct: 90,
    lastLiqAlertAt: null,
    lastTargetAlertAt: null,
    updatedAt: new Date().toISOString(),
  })
}

export async function readHermitPositionAlert(
  senderAddress: string,
  roomId?: string | null,
): Promise<PositionAlertConfig | null> {
  const scope = resolveHermitAlertScope(roomId)
  return readPositionAlert({ roomId: scope, senderAddress })
}

export async function disableHermitPositionAlert(
  senderAddress: string,
  roomId?: string | null,
): Promise<boolean> {
  const scope = resolveHermitAlertScope(roomId)
  return disablePositionAlert({ roomId: scope, senderAddress })
}

export async function upsertHermitPositionAlert(
  params: Omit<Parameters<typeof upsertPositionAlert>[0], 'roomId'> & { roomId?: string | null },
): Promise<PositionAlertConfig | null> {
  const scope = resolveHermitAlertScope(params.roomId)
  const { roomId: _ignored, ...rest } = params
  return upsertPositionAlert({ ...rest, roomId: scope })
}

export async function enableDefaultHermitPositionAlert(
  senderAddress: string,
  roomId?: string | null,
  options?: { telegramEnabled?: boolean },
): Promise<PositionAlertConfig | null> {
  const defaults = readHyperliquidAlertDefaults()
  const scope = resolveHermitAlertScope(roomId)
  return upsertPositionAlert({
    roomId: scope,
    senderAddress,
    enabled: true,
    liquidationWarnPct: defaults.liquidationWarnPct,
    targetPnlUsd: defaults.targetPnlUsd,
    targetProgressPct: defaults.targetProgressPct,
    ...(options?.telegramEnabled != null ? { telegramEnabled: options.telegramEnabled } : {}),
  })
}

export function formatWalletShort(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
