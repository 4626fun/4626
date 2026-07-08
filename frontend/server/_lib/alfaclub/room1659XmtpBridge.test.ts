import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  loggerMock,
  enableCswAgentMock,
  enqueueKeeprActionMock,
  getKeeprVaultByVaultAddressMock,
  upsertKeeprVaultMock,
  hasProtocolCswRuntimeConfigMock,
  readProtocolCswChainIdEnvMock,
  readProtocolCswPrivyWalletIdEnvMock,
  resolveServerAgentCswAddressMock,
  getChatBridgeMessageOriginsMock,
  recordChatBridgeMessageOriginMock,
  sendAlfaClubRoomTextMock,
} = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  enableCswAgentMock: vi.fn(async () => undefined),
  enqueueKeeprActionMock: vi.fn(async () => ({ id: 1 })),
  getKeeprVaultByVaultAddressMock: vi.fn(async () => null as { groupId: string } | null),
  upsertKeeprVaultMock: vi.fn(async () => undefined),
  hasProtocolCswRuntimeConfigMock: vi.fn(() => true),
  readProtocolCswChainIdEnvMock: vi.fn(() => 8453),
  readProtocolCswPrivyWalletIdEnvMock: vi.fn(() => 'privy-wallet-id'),
  resolveServerAgentCswAddressMock: vi.fn(() => '0x793ca28123cba3ca3c20b9c6c67f37510c89c145' as `0x${string}`),
  getChatBridgeMessageOriginsMock: vi.fn(async () => new Map<string, 'telegram' | 'xmtp'>()),
  recordChatBridgeMessageOriginMock: vi.fn(async () => undefined),
  sendAlfaClubRoomTextMock: vi.fn(async () => ({ messageId: 'room-msg-1', lane: 'ws' as string | null })),
}))

vi.mock('../infra/logger.js', () => ({ logger: loggerMock }))

vi.mock('../messaging/creatorXmtpAgents.js', () => ({
  enableCswAgent: enableCswAgentMock,
}))

vi.mock('../keepr/keeprRegistry.js', () => ({
  enqueueKeeprAction: enqueueKeeprActionMock,
  getKeeprVaultByVaultAddress: getKeeprVaultByVaultAddressMock,
  upsertKeeprVault: upsertKeeprVaultMock,
}))

vi.mock('../wallet/canonicalCswEnv.js', () => ({
  hasProtocolCswRuntimeConfig: hasProtocolCswRuntimeConfigMock,
  readProtocolCswChainIdEnv: readProtocolCswChainIdEnvMock,
  readProtocolCswPrivyWalletIdEnv: readProtocolCswPrivyWalletIdEnvMock,
  resolveServerAgentCswAddress: resolveServerAgentCswAddressMock,
}))

vi.mock('./chatBridgeMessageOrigin.js', () => ({
  getChatBridgeMessageOrigins: getChatBridgeMessageOriginsMock,
  recordChatBridgeMessageOrigin: recordChatBridgeMessageOriginMock,
}))

vi.mock('./chatBridge.js', () => ({
  sendAlfaClubRoomText: sendAlfaClubRoomTextMock,
}))

import {
  ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
  ensureRoom1659XmtpBridgeVaultConfigured,
  isRoom1659XmtpBridgeEnabled,
  relayNewRoom1659MessagesToXmtpBridge,
  relayXmtpBridgeTextToAlfaClubRoom,
  resolveRoom1659XmtpBridgeGroupId,
  syncRoom1659XmtpBridgeMembership,
  _resetRoom1659XmtpBridgeStateForTests,
} from './room1659XmtpBridge.js'

function withEnv(overrides: Record<string, string | undefined>): () => void {
  const prior: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    prior[key] = process.env[key]
    if (overrides[key] === undefined) delete process.env[key]
    else process.env[key] = overrides[key]
  }
  return () => {
    for (const key of Object.keys(prior)) {
      if (prior[key] === undefined) delete process.env[key]
      else process.env[key] = prior[key]
    }
  }
}

describe('room1659XmtpBridge', () => {
  let restoreEnv: () => void = () => {}

  beforeEach(() => {
    loggerMock.info.mockClear()
    loggerMock.warn.mockClear()
    loggerMock.error.mockClear()
    enableCswAgentMock.mockReset()
    enableCswAgentMock.mockResolvedValue(undefined)
    enqueueKeeprActionMock.mockReset()
    enqueueKeeprActionMock.mockResolvedValue({ id: 1 })
    getKeeprVaultByVaultAddressMock.mockReset()
    getKeeprVaultByVaultAddressMock.mockResolvedValue(null)
    upsertKeeprVaultMock.mockReset()
    upsertKeeprVaultMock.mockResolvedValue(undefined)
    hasProtocolCswRuntimeConfigMock.mockReset()
    hasProtocolCswRuntimeConfigMock.mockReturnValue(true)
    readProtocolCswChainIdEnvMock.mockReset()
    readProtocolCswChainIdEnvMock.mockReturnValue(8453)
    readProtocolCswPrivyWalletIdEnvMock.mockReset()
    readProtocolCswPrivyWalletIdEnvMock.mockReturnValue('privy-wallet-id')
    resolveServerAgentCswAddressMock.mockReset()
    resolveServerAgentCswAddressMock.mockReturnValue('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
    getChatBridgeMessageOriginsMock.mockReset()
    getChatBridgeMessageOriginsMock.mockResolvedValue(new Map())
    recordChatBridgeMessageOriginMock.mockReset()
    recordChatBridgeMessageOriginMock.mockResolvedValue(undefined)
    sendAlfaClubRoomTextMock.mockReset()
    sendAlfaClubRoomTextMock.mockResolvedValue({ messageId: 'room-msg-1', lane: 'ws' })
    _resetRoom1659XmtpBridgeStateForTests()
    restoreEnv = withEnv({ ROOM_1659_XMTP_BRIDGE_ENABLED: 'true' })
  })

  afterEach(() => {
    restoreEnv()
  })

  describe('isRoom1659XmtpBridgeEnabled', () => {
    it('is false when the flag env var is unset', () => {
      restoreEnv()
      restoreEnv = withEnv({ ROOM_1659_XMTP_BRIDGE_ENABLED: undefined })
      expect(isRoom1659XmtpBridgeEnabled()).toBe(false)
    })

    it('is false when the flag is set but protocol CSW runtime config is missing', () => {
      hasProtocolCswRuntimeConfigMock.mockReturnValue(false)
      expect(isRoom1659XmtpBridgeEnabled()).toBe(false)
    })

    it('is true only when both the flag is set and protocol CSW runtime config is present', () => {
      hasProtocolCswRuntimeConfigMock.mockReturnValue(true)
      expect(isRoom1659XmtpBridgeEnabled()).toBe(true)
    })
  })

  describe('resolveRoom1659XmtpBridgeGroupId', () => {
    it('bootstraps the vault row once and returns the placeholder group id when not yet bootstrapped', async () => {
      // First call is the "does a row already exist" check inside
      // ensureRoom1659XmtpBridgeVaultConfigured (none yet -> triggers upsert);
      // second call is resolveRoom1659XmtpBridgeGroupId's own fetch of the
      // row it just created.
      getKeeprVaultByVaultAddressMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ groupId: 'pending-bootstrap:room-1659-xmtp-bridge' })

      const resolution = await resolveRoom1659XmtpBridgeGroupId()

      expect(resolution.groupId).toBe('pending-bootstrap:room-1659-xmtp-bridge')
      expect(resolution.isBootstrapped).toBe(false)
      expect(enableCswAgentMock).toHaveBeenCalledTimes(1)
      expect(upsertKeeprVaultMock).toHaveBeenCalledTimes(1)
    })

    it('reports isBootstrapped=true once a real XMTP group id is persisted', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: '0xabc-real-group-id' })

      const resolution = await resolveRoom1659XmtpBridgeGroupId()

      expect(resolution.groupId).toBe('0xabc-real-group-id')
      expect(resolution.isBootstrapped).toBe(true)
    })

    it('returns a null group id and does not throw when no vault row exists', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue(null)

      const resolution = await resolveRoom1659XmtpBridgeGroupId()

      expect(resolution.groupId).toBeNull()
      expect(resolution.isBootstrapped).toBe(false)
    })
  })

  describe('ensureRoom1659XmtpBridgeVaultConfigured', () => {
    it('provisions the vault with the protocol CSW address as owner/creator/canonical-owner', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue(null)

      const ok = await ensureRoom1659XmtpBridgeVaultConfigured()

      expect(ok).toBe(true)
      expect(enableCswAgentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorAddress: '0x793ca28123cba3ca3c20b9c6c67f37510c89c145',
          cswAddress: '0x793ca28123cba3ca3c20b9c6c67f37510c89c145',
          privyWalletId: 'privy-wallet-id',
        }),
      )
      expect(upsertKeeprVaultMock).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            vault: expect.objectContaining({ vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS }),
          }),
        }),
      )
    })

    it('is a no-op that reports success when the vault row already exists', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'already-bootstrapped' })

      const ok = await ensureRoom1659XmtpBridgeVaultConfigured()

      expect(ok).toBe(true)
      expect(upsertKeeprVaultMock).not.toHaveBeenCalled()
    })

    it('returns false without provisioning when protocol CSW runtime config is missing', async () => {
      hasProtocolCswRuntimeConfigMock.mockReturnValue(false)

      const ok = await ensureRoom1659XmtpBridgeVaultConfigured()

      expect(ok).toBe(false)
      expect(enableCswAgentMock).not.toHaveBeenCalled()
    })

    it('returns false when the Privy wallet id env is blank', async () => {
      readProtocolCswPrivyWalletIdEnvMock.mockReturnValue('')

      const ok = await ensureRoom1659XmtpBridgeVaultConfigured()

      expect(ok).toBe(false)
      expect(enableCswAgentMock).not.toHaveBeenCalled()
    })
  })

  describe('relayNewRoom1659MessagesToXmtpBridge', () => {
    it('skips everything when the bridge is disabled', async () => {
      restoreEnv()
      restoreEnv = withEnv({ ROOM_1659_XMTP_BRIDGE_ENABLED: undefined })

      const result = await relayNewRoom1659MessagesToXmtpBridge([
        { roomId: '1659', messageId: 'm1', text: 'hello' },
      ])

      expect(result).toEqual({ enqueued: 0, skipped: 1 })
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    })

    it('ignores messages for rooms other than 1659', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'real-group-id' })

      const result = await relayNewRoom1659MessagesToXmtpBridge([
        { roomId: '1043', messageId: 'm1', text: 'hello' },
      ])

      expect(result).toEqual({ enqueued: 0, skipped: 0 })
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    })

    it('enqueues xmtp.group.send_message for candidates and skips those already tagged origin=xmtp', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'real-group-id' })
      getChatBridgeMessageOriginsMock.mockResolvedValue(new Map<string, 'telegram' | 'xmtp'>([['m2', 'xmtp']]))

      const result = await relayNewRoom1659MessagesToXmtpBridge([
        { roomId: '1659', messageId: 'm1', text: 'native' },
        { roomId: '1659', messageId: 'm2', text: 'xmtp echo' },
      ])

      expect(result).toEqual({ enqueued: 1, skipped: 1 })
      expect(enqueueKeeprActionMock).toHaveBeenCalledTimes(1)
      expect(enqueueKeeprActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
          groupId: 'real-group-id',
          actionType: 'xmtp.group.send_message',
          action: { action: 'xmtp.group.send_message', message: 'native' },
          dedupeKey: 'room1659-xmtp-bridge:send:m1',
        }),
      )
    })

    it('skips all candidates when no group id can be resolved yet', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue(null)

      const result = await relayNewRoom1659MessagesToXmtpBridge([
        { roomId: '1659', messageId: 'm1', text: 'native' },
      ])

      expect(result).toEqual({ enqueued: 0, skipped: 1 })
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    })

    it('counts a message as skipped (not thrown) when enqueueing fails', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'real-group-id' })
      enqueueKeeprActionMock.mockRejectedValueOnce(new Error('db down'))

      const result = await relayNewRoom1659MessagesToXmtpBridge([
        { roomId: '1659', messageId: 'm1', text: 'native' },
      ])

      expect(result).toEqual({ enqueued: 0, skipped: 1 })
      expect(loggerMock.warn).toHaveBeenCalled()
    })
  })

  describe('relayXmtpBridgeTextToAlfaClubRoom', () => {
    it('posts into room 1659 tagged with origin=xmtp and returns true on success', async () => {
      const ok = await relayXmtpBridgeTextToAlfaClubRoom('hello from xmtp')

      expect(ok).toBe(true)
      expect(sendAlfaClubRoomTextMock).toHaveBeenCalledWith({
        roomId: '1659',
        text: 'hello from xmtp',
        origin: 'xmtp',
      })
    })

    it('returns false for blank text without calling sendAlfaClubRoomText', async () => {
      const ok = await relayXmtpBridgeTextToAlfaClubRoom('   ')

      expect(ok).toBe(false)
      expect(sendAlfaClubRoomTextMock).not.toHaveBeenCalled()
    })

    it('returns false when the bridge is disabled', async () => {
      restoreEnv()
      restoreEnv = withEnv({ ROOM_1659_XMTP_BRIDGE_ENABLED: undefined })

      const ok = await relayXmtpBridgeTextToAlfaClubRoom('hello from xmtp')

      expect(ok).toBe(false)
      expect(sendAlfaClubRoomTextMock).not.toHaveBeenCalled()
    })

    it('fails open (returns false) when the room send throws', async () => {
      sendAlfaClubRoomTextMock.mockRejectedValueOnce(new Error('room send failed'))

      const ok = await relayXmtpBridgeTextToAlfaClubRoom('hello from xmtp')

      expect(ok).toBe(false)
      expect(loggerMock.warn).toHaveBeenCalled()
    })
  })

  describe('syncRoom1659XmtpBridgeMembership', () => {
    it('enqueues xmtp.group.add_member for an active-transition wallet', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'real-group-id' })

      const ok = await syncRoom1659XmtpBridgeMembership({
        roomId: '1659',
        walletAddress: '0xAbC0000000000000000000000000000000abc0',
        action: 'add',
      })

      expect(ok).toBe(true)
      expect(enqueueKeeprActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
          groupId: 'real-group-id',
          actionType: 'xmtp.group.add_member',
          action: { action: 'xmtp.group.add_member', wallet: '0xAbC0000000000000000000000000000000abc0' },
          dedupeKey: 'room1659-xmtp-bridge:member:0xabc0000000000000000000000000000000abc0:add',
        }),
      )
    })

    it('enqueues xmtp.group.remove_member for a removed-transition wallet', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'real-group-id' })

      const ok = await syncRoom1659XmtpBridgeMembership({
        roomId: '1659',
        walletAddress: '0xAbC0000000000000000000000000000000abc0',
        action: 'remove',
      })

      expect(ok).toBe(true)
      expect(enqueueKeeprActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'xmtp.group.remove_member' }),
      )
    })

    it('is a no-op for any room other than 1659', async () => {
      const ok = await syncRoom1659XmtpBridgeMembership({
        roomId: '1043',
        walletAddress: '0xAbC0000000000000000000000000000000abc0',
        action: 'add',
      })

      expect(ok).toBe(false)
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    })

    it('is a no-op when the bridge is disabled', async () => {
      restoreEnv()
      restoreEnv = withEnv({ ROOM_1659_XMTP_BRIDGE_ENABLED: undefined })

      const ok = await syncRoom1659XmtpBridgeMembership({
        roomId: '1659',
        walletAddress: '0xAbC0000000000000000000000000000000abc0',
        action: 'add',
      })

      expect(ok).toBe(false)
      expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
    })

    it('returns false (fail-open) when no group id can be resolved', async () => {
      getKeeprVaultByVaultAddressMock.mockResolvedValue(null)

      const ok = await syncRoom1659XmtpBridgeMembership({
        roomId: '1659',
        walletAddress: '0xAbC0000000000000000000000000000000abc0',
        action: 'add',
      })

      expect(ok).toBe(false)
    })
  })
})
