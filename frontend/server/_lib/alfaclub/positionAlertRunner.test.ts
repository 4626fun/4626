import { afterEach, describe, expect, it, vi } from 'vitest'

import { runPositionAlerts } from './positionAlertRunner.js'
import { ROOM_1659_ALERT_SCOPE } from './hermitAlertWallets.js'
import { HL_POSITION_ALERT_SCOPE } from './positionAlertStore.js'

const TEST_SENDER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ROOM_HL = '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2'
const ARENA_HL = '0x30068c6bccf43e9eb5cdb68fb978f32f744d870c'

vi.mock('./hyperliquid.js', () => ({
  getClearinghouseState: vi.fn(async (wallet: string) => {
    if (wallet === ROOM_HL) {
      return {
        accountValueUsd: 1000,
        totalNtlPosUsd: 100,
        totalRawUsdUsd: null,
        assetPositions: [],
      }
    }
    if (wallet === ARENA_HL) {
      return {
        accountValueUsd: 500,
        totalNtlPosUsd: 200,
        totalRawUsdUsd: null,
        assetPositions: [
          {
            coin: 'ETH',
            side: 'long',
            entryPx: 3000,
            positionValue: 200,
            unrealizedPnl: -20,
            liquidationPx: 2500,
            leverage: 10,
          },
        ],
      }
    }
    return { accountValueUsd: 0, totalNtlPosUsd: 0, totalRawUsdUsd: null, assetPositions: [] }
  }),
}))

vi.mock('./hermitAlertWallets.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hermitAlertWallets.js')>()
  return {
    ...actual,
    resolveMonitoredHlWalletsForAlert: vi.fn(async (alert: { roomId: string; senderAddress: string }) => {
      if (alert.roomId === ROOM_1659_ALERT_SCOPE) {
        return [
          { label: 'Room HL portfolio', address: ROOM_HL },
          { label: 'Virtual Arena execution', address: ARENA_HL },
        ]
      }
      return [{ label: 'Your HL wallet', address: alert.senderAddress }]
    }),
  }
})

vi.mock('./positionAlertStore.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./positionAlertStore.js')>()
  return {
    ...actual,
    listEnabledPositionAlerts: vi.fn(async () => [
      {
        roomId: ROOM_1659_ALERT_SCOPE,
        senderAddress: TEST_SENDER,
        enabled: true,
        telegramEnabled: true,
        xmtpEnabled: false,
        liquidationWarnPct: 10,
        targetPnlUsd: null,
        targetProgressPct: 90,
        lastLiqAlertAt: null,
        lastTargetAlertAt: null,
        updatedAt: new Date().toISOString(),
      },
    ]),
    resolveTelegramChatIdForWallet: vi.fn(async () => '123456789'),
    markPositionAlertFired: vi.fn(async () => undefined),
  }
})

vi.mock('./chatBridge.js', () => ({
  readAlfaClubChatBridgeFlags: vi.fn(() => ({ botToken: 'test-bot-token' })),
}))

vi.mock('../wallet/protocolXmtpAlertSender.js', () => ({
  isProtocolXmtpAlertDeliveryConfigured: vi.fn(() => true),
  sendProtocolAgentXmtpDm: vi.fn(async () => true),
}))

describe('runPositionAlerts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('evaluates room 1659 alerts against monitored arena wallet legs', async () => {
    vi.stubEnv('ALFACLUB_POSITION_ALERTS_ENABLED', '1')
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      new Response('', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runPositionAlerts()

    expect(result.ok).toBe(true)
    expect(result.scanned).toBe(1)
    expect(result.liqSent).toBe(1)
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.text).toContain('Virtual Arena execution')
    expect(body.text).toContain('mark→liq distance')
  })

  it('sends XMTP liquidation alerts when xmtp is enabled', async () => {
    const { listEnabledPositionAlerts } = await import('./positionAlertStore.js')
    const { sendProtocolAgentXmtpDm } = await import('../wallet/protocolXmtpAlertSender.js')
    vi.mocked(listEnabledPositionAlerts).mockResolvedValueOnce([
      {
        roomId: ROOM_1659_ALERT_SCOPE,
        senderAddress: TEST_SENDER,
        enabled: true,
        telegramEnabled: false,
        xmtpEnabled: true,
        liquidationWarnPct: 10,
        targetPnlUsd: null,
        targetProgressPct: 90,
        lastLiqAlertAt: null,
        lastTargetAlertAt: null,
        updatedAt: new Date().toISOString(),
      },
    ])

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runPositionAlerts()

    expect(result.xmtpLiqSent).toBe(1)
    expect(result.liqSent).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vi.mocked(sendProtocolAgentXmtpDm)).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAddress: TEST_SENDER,
        text: expect.stringContaining('Virtual Arena execution'),
      }),
    )
  })

  it('ignores unsupported alert scopes', async () => {
    const { listEnabledPositionAlerts } = await import('./positionAlertStore.js')
    vi.mocked(listEnabledPositionAlerts).mockResolvedValueOnce([
      {
        roomId: 'unsupported',
        senderAddress: TEST_SENDER,
        enabled: true,
        telegramEnabled: true,
        xmtpEnabled: false,
        liquidationWarnPct: 10,
        targetPnlUsd: null,
        targetProgressPct: 90,
        lastLiqAlertAt: null,
        lastTargetAlertAt: null,
        updatedAt: new Date().toISOString(),
      },
    ])

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runPositionAlerts()
    expect(result.liqSent).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still supports legacy hyperliquid scope subscriptions', async () => {
    const { listEnabledPositionAlerts } = await import('./positionAlertStore.js')
    vi.mocked(listEnabledPositionAlerts).mockResolvedValueOnce([
      {
        roomId: HL_POSITION_ALERT_SCOPE,
        senderAddress: TEST_SENDER,
        enabled: true,
        telegramEnabled: true,
        xmtpEnabled: false,
        liquidationWarnPct: 10,
        targetPnlUsd: null,
        targetProgressPct: 90,
        lastLiqAlertAt: null,
        lastTargetAlertAt: null,
        updatedAt: new Date().toISOString(),
      },
    ])

    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => '' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runPositionAlerts()
    expect(result.scanned).toBe(1)
  })
})
