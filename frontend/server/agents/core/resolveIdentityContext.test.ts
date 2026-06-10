import { describe, expect, it, vi } from 'vitest'

const { isServerAdminAddressMock } = vi.hoisted(() => ({
  isServerAdminAddressMock: vi.fn(),
}))

vi.mock('../../_lib/infra/trust.js', () => ({
  isAddressLike: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(String(value ?? '')),
  isServerAdminAddress: isServerAdminAddressMock,
}))

import { buildAgentSessionContext, resolveTelegramIdentityContext } from './resolveIdentityContext.ts'

describe('buildAgentSessionContext', () => {
  it('normalizes valid addresses and preserves source', () => {
    isServerAdminAddressMock.mockReturnValue(false)
    expect(buildAgentSessionContext({
      address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      source: 'xmtp',
    })).toEqual({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      isAdmin: false,
      source: 'xmtp',
    })
  })

  it('treats explicit admin hints as authoritative', () => {
    isServerAdminAddressMock.mockReturnValue(false)
    expect(buildAgentSessionContext({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      source: 'telegram',
      isAdmin: true,
    })).toEqual({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      isAdmin: true,
      source: 'telegram',
    })
  })
})

describe('resolveTelegramIdentityContext', () => {
  it('zeros private non-admin DMs to avoid inheriting group context', () => {
    const result = resolveTelegramIdentityContext({
      chatId: '123',
      userId: '456',
      isAdmin: false,
      zeroAddress: '0x0000000000000000000000000000000000000000',
      isPrivateChatId: (chatId) => chatId === '123',
      resolveGroupId: () => 'group-1',
      resolveSenderWalletWithSource: () => ({
        wallet: '0x1111111111111111111111111111111111111111',
        source: 'user_map',
      }),
    })

    expect(result).toEqual({
      groupId: 'telegram:123',
      senderWallet: '0x0000000000000000000000000000000000000000',
      senderWalletSource: 'zero',
      session: null,
    })
  })

  it('resolves group, sender wallet, and session for allowed contexts', () => {
    isServerAdminAddressMock.mockReturnValue(false)
    const result = resolveTelegramIdentityContext({
      chatId: '-1001',
      userId: '456',
      isAdmin: true,
      zeroAddress: '0x0000000000000000000000000000000000000000',
      isPrivateChatId: () => false,
      resolveGroupId: (chatId) => `telegram:${chatId}`,
      resolveSenderWalletWithSource: () => ({
        wallet: '0x1111111111111111111111111111111111111111',
        source: 'user_map',
      }),
    })

    expect(result).toEqual({
      groupId: 'telegram:-1001',
      senderWallet: '0x1111111111111111111111111111111111111111',
      senderWalletSource: 'user_map',
      session: {
        address: '0x1111111111111111111111111111111111111111',
        isAdmin: true,
        source: 'telegram',
      },
    })
  })
})
