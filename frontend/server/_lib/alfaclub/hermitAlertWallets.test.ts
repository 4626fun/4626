import { afterEach, describe, expect, it, vi } from 'vitest'

import { readArenaConfig } from '../arena/arenaConfig.js'
import {
  ROOM_1659_ALERT_SCOPE,
  resolveHermitAlertScope,
  resolveMonitoredHlWalletsForAlert,
  resolveRoom1659MonitoredHlWallets,
} from './hermitAlertWallets.js'
import { HL_POSITION_ALERT_SCOPE } from './positionAlertStore.js'

vi.mock('../arena/arenaIdentityMappingStore.js', () => ({
  resolveRoomDefaultArenaIdentity: vi.fn(async () => ({
    source: 'env_default' as const,
    roomId: '1659',
    senderAddress: '*',
    agentId: 'test-agent',
    agentWalletAddress: '0x30068c6bccf43e9eb5cdb68fb978f32f744d870c',
    hlApiWalletAddress: null,
  })),
}))

describe('hermitAlertWallets', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves room 1659 alert scope', () => {
    expect(resolveHermitAlertScope('1659')).toBe(ROOM_1659_ALERT_SCOPE)
    expect(resolveHermitAlertScope('1043')).toBe(HL_POSITION_ALERT_SCOPE)
    expect(resolveHermitAlertScope(null)).toBe(HL_POSITION_ALERT_SCOPE)
  })

  it('returns room HL + arena wallets for room 1659 alerts', async () => {
    const wallets = await resolveRoom1659MonitoredHlWallets()
    expect(wallets).toHaveLength(2)
    expect(wallets[0]?.label).toBe('Room HL portfolio')
    expect(wallets[0]?.address).toBe('0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2')
    expect(wallets[1]?.label).toBe('Virtual Arena execution')
    expect(wallets[1]?.address).toBe('0x30068c6bccf43e9eb5cdb68fb978f32f744d870c')
  })

  it('returns sender wallet for hyperliquid scope alerts', async () => {
    const sender = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const wallets = await resolveMonitoredHlWalletsForAlert({
      roomId: HL_POSITION_ALERT_SCOPE,
      senderAddress: sender,
      enabled: true,
      telegramEnabled: false,
      liquidationWarnPct: 10,
      targetPnlUsd: 5000,
      targetProgressPct: 90,
      lastLiqAlertAt: null,
      lastTargetAlertAt: null,
      updatedAt: new Date().toISOString(),
    })
    expect(wallets).toEqual([{ label: 'Your HL wallet', address: sender }])
  })

  it('prefers arena hl api wallet when configured', async () => {
    const { resolveRoomDefaultArenaIdentity } = await import('../arena/arenaIdentityMappingStore.js')
    vi.mocked(resolveRoomDefaultArenaIdentity).mockResolvedValueOnce({
      source: 'room_default',
      roomId: '1659',
      senderAddress: '*',
      agentId: 'test-agent',
      agentWalletAddress: '0x30068c6bccf43e9eb5cdb68fb978f32f744d870c',
      hlApiWalletAddress: '0x1111111111111111111111111111111111111111',
    })

    const wallets = await resolveMonitoredHlWalletsForAlert({
      roomId: ROOM_1659_ALERT_SCOPE,
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      enabled: true,
      telegramEnabled: false,
      liquidationWarnPct: 10,
      targetPnlUsd: null,
      targetProgressPct: 90,
      lastLiqAlertAt: null,
      lastTargetAlertAt: null,
      updatedAt: new Date().toISOString(),
    })

    expect(wallets.map((wallet) => wallet.address)).toContain(
      '0x1111111111111111111111111111111111111111',
    )
    expect(readArenaConfig()).toBeTruthy()
  })
})
