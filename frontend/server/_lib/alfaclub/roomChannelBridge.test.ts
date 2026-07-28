import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  enqueueKeeprActionMock,
  getKeeprVaultByVaultAddressMock,
  lookupRoomBindingMock,
  resolveAuthorizedWalletProfileMock,
  resolveRoomFriendKeyAccessMock,
  walletHoldsOrStakesRoomFriendKeyMock,
  getDbMock,
  claimIngressMock,
  linkIngressMock,
  listBindingsMock,
} = vi.hoisted(() => ({
  enqueueKeeprActionMock: vi.fn(async () => ({ id: 1 })),
  getKeeprVaultByVaultAddressMock: vi.fn(),
  lookupRoomBindingMock: vi.fn(),
  resolveAuthorizedWalletProfileMock: vi.fn(),
  resolveRoomFriendKeyAccessMock: vi.fn(),
  walletHoldsOrStakesRoomFriendKeyMock: vi.fn(async () => true),
  getDbMock: vi.fn(),
  claimIngressMock: vi.fn(),
  linkIngressMock: vi.fn(),
  listBindingsMock: vi.fn(),
}))

vi.mock('../keepr/keeprRegistry.js', () => ({
  enqueueKeeprAction: enqueueKeeprActionMock,
  getKeeprVaultByVaultAddress: getKeeprVaultByVaultAddressMock,
  upsertKeeprVault: vi.fn(),
}))
vi.mock('../messaging/creatorXmtpAgents.js', () => ({ enableCswAgent: vi.fn() }))
vi.mock('../wallet/canonicalCswEnv.js', () => ({
  hasProtocolCswRuntimeConfig: vi.fn(() => true),
  readProtocolCswChainIdEnv: vi.fn(() => 8453),
  readProtocolCswPrivyWalletIdEnv: vi.fn(() => 'wallet-id'),
  resolveServerAgentCswAddress: vi.fn(() => `0x${'79'.repeat(20)}`),
}))
vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))
vi.mock('../db/postgres.js', () => ({ getDb: getDbMock }))
vi.mock('../infra/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./roomChannelBindings.js', () => ({
  lookupEnabledAlfaClubRoomChannelBindingByRoom: lookupRoomBindingMock,
  listEnabledAlfaClubRoomChannelBindings: listBindingsMock,
}))
vi.mock('./crossChannelIngress.js', () => ({
  claimAlfaClubCrossChannelIngress: claimIngressMock,
  linkAlfaClubCrossChannelIngress: linkIngressMock,
}))
vi.mock('./roomFriendKeyAccess.js', () => ({
  resolveRoomFriendKeyAccess: resolveRoomFriendKeyAccessMock,
  walletHoldsOrStakesRoomFriendKey: walletHoldsOrStakesRoomFriendKeyMock,
  expandFriendKeyCheckWallets: vi.fn(async (wallet: `0x${string}`) => [wallet]),
}))

import {
  backfillActiveRoomChannelBridgeMembers,
  relayRoomMessagesToXmtp,
  relayXmtpMessageToAlfaClubRoom,
} from './roomChannelBridge.js'
import type { AlfaClubRoomChannelBinding } from './roomChannelBindings.js'

function binding(roomId: string): AlfaClubRoomChannelBinding {
  return {
    roomId,
    enabled: true,
    rolloutStatus: 'enabled',
    telegram: { enabled: true, chatId: `chat-${roomId}`, threadId: null },
    xmtp: {
      enabled: true,
      groupId: `group-${roomId}`,
      syntheticKeeprVaultAddress: `0x${roomId.padStart(40, '0')}`,
    },
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  }
}

describe('roomChannelBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lookupRoomBindingMock.mockImplementation(async (roomId: string) => ({
      available: true,
      binding: binding(roomId),
    }))
    getKeeprVaultByVaultAddressMock.mockImplementation(async (vault: string) => ({
      groupId: `group-${Number.parseInt(vault.slice(-4), 16)}`,
    }))
    claimIngressMock.mockResolvedValue({ claimed: true, ingress: {} })
    linkIngressMock.mockResolvedValue({})
    listBindingsMock.mockResolvedValue([])
  })

  it('keeps two rooms isolated with room-scoped vaults and dedupe keys', async () => {
    getKeeprVaultByVaultAddressMock
      .mockResolvedValueOnce({ groupId: 'group-101' })
      .mockResolvedValueOnce({ groupId: 'group-101' })
      .mockResolvedValueOnce({ groupId: 'group-202' })
      .mockResolvedValueOnce({ groupId: 'group-202' })

    await expect(relayRoomMessagesToXmtp([
      { roomId: '101', messageId: 'same-id', text: 'one' },
      { roomId: '202', messageId: 'same-id', text: 'two' },
    ])).resolves.toEqual({ enqueued: 2, skipped: 0 })

    expect(enqueueKeeprActionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        vaultAddress: '0x0000000000000000000000000000000000000101',
        dedupeKey: 'alfaclub-room:101:xmtp:send:same-id',
      }),
    )
    expect(enqueueKeeprActionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        vaultAddress: '0x0000000000000000000000000000000000000202',
        dedupeKey: 'alfaclub-room:202:xmtp:send:same-id',
      }),
    )
  })

  it('denies unresolved senders and non-FriendKey writers, then allows a FriendKey holder', async () => {
    const roomBinding = binding('101')
    const sendRoomText = vi.fn(async () => ({ lane: 'bot', messageId: 'alf-msg-1' }))
    const baseParams = {
      binding: roomBinding,
      text: 'hello',
      messageId: 'xmtp-msg-1',
      conversationId: 'group-101',
      senderInboxId: 'inbox-1',
      senderAddress: `0x${'aa'.repeat(20)}`,
      sendRoomText,
    }

    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    await expect(relayXmtpMessageToAlfaClubRoom(baseParams)).resolves.toBe(false)

    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 7,
      canonicalSmartWalletAddress: `0x${'bb'.repeat(20)}`,
      activeOwnerWalletAddress: `0x${'aa'.repeat(20)}`,
    })
    resolveRoomFriendKeyAccessMock.mockResolvedValue({
      allowed: false,
      reason: 'insufficient',
      walletAddress: `0x${'bb'.repeat(20)}`,
    })
    await expect(relayXmtpMessageToAlfaClubRoom(baseParams)).resolves.toBe(false)

    resolveRoomFriendKeyAccessMock.mockResolvedValue({
      allowed: true,
      reason: 'room_key',
      walletAddress: `0x${'aa'.repeat(20)}`,
    })
    await expect(relayXmtpMessageToAlfaClubRoom(baseParams)).resolves.toBe(true)
    expect(resolveRoomFriendKeyAccessMock).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '101',
      wallets: expect.arrayContaining([
        `0x${'aa'.repeat(20)}`,
        `0x${'bb'.repeat(20)}`,
      ]),
    }))
    expect(claimIngressMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceChannel: 'xmtp',
      sourceMessageId: 'xmtp-msg-1',
      targetRoomId: '101',
    }))
    expect(linkIngressMock).toHaveBeenCalledWith(expect.objectContaining({
      validatedProfileId: 7,
      validatedIssuer: `0x${'bb'.repeat(20)}`,
    }))
  })

  it('backfills active members idempotently with room-scoped keys', async () => {
    listBindingsMock.mockResolvedValue([binding('101')])
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({ rows: [{ wallet_address: `0x${'cc'.repeat(20)}` }] })),
    })
    getKeeprVaultByVaultAddressMock.mockResolvedValue({ groupId: 'group-101' })

    await expect(backfillActiveRoomChannelBridgeMembers()).resolves.toEqual({
      rooms: 1,
      enqueued: 1,
      skipped: 0,
    })
    expect(enqueueKeeprActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'xmtp.group.add_member',
        dedupeKey: `alfaclub-room:101:xmtp:member:0x${'cc'.repeat(20)}:add:backfill`,
      }),
    )
  })
})
