import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TELEGRAM_GROUP_ANONYMOUS_BOT_ID,
  __resetTelegramChatMemberRoleCache,
  readTelegramChatMemberRole,
} from '../../_handlers/telegram/webhook/telegramApi/chats.js'

describe('readTelegramChatMemberRole', () => {
  beforeEach(() => {
    __resetTelegramChatMemberRoleCache()
  })

  it('returns admin for Telegram status creator', async () => {
    const fetchStatus = vi.fn().mockResolvedValue('creator')
    const role = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '1',
      fetchStatus,
    })
    expect(role).toBe('admin')
  })

  it('returns admin for Telegram status administrator', async () => {
    const fetchStatus = vi.fn().mockResolvedValue('administrator')
    const role = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '2',
      fetchStatus,
    })
    expect(role).toBe('admin')
  })

  it('returns member for Telegram status member/restricted/left/kicked', async () => {
    for (const status of ['member', 'restricted', 'left', 'kicked']) {
      __resetTelegramChatMemberRoleCache()
      const fetchStatus = vi.fn().mockResolvedValue(status)
      const role = await readTelegramChatMemberRole({
        botToken: 't',
        chatId: '-100',
        userId: `uid-${status}`,
        fetchStatus,
      })
      expect(role).toBe('member')
    }
  })

  it('returns unknown when fetchStatus returns null (network/429/bad token)', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(null)
    const role = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '3',
      fetchStatus,
    })
    expect(role).toBe('unknown')
  })

  it('short-circuits to admin for the GroupAnonymousBot id without calling fetchStatus', async () => {
    const fetchStatus = vi.fn()
    const role = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: TELEGRAM_GROUP_ANONYMOUS_BOT_ID,
      fetchStatus,
    })
    expect(role).toBe('admin')
    expect(fetchStatus).not.toHaveBeenCalled()
  })

  it('returns unknown (without calling fetchStatus) when required inputs are missing', async () => {
    const fetchStatus = vi.fn()
    expect(
      await readTelegramChatMemberRole({ botToken: '', chatId: '-100', userId: '1', fetchStatus }),
    ).toBe('unknown')
    expect(
      await readTelegramChatMemberRole({ botToken: 't', chatId: '', userId: '1', fetchStatus }),
    ).toBe('unknown')
    expect(
      await readTelegramChatMemberRole({ botToken: 't', chatId: '-100', userId: '', fetchStatus }),
    ).toBe('unknown')
    expect(fetchStatus).not.toHaveBeenCalled()
  })

  it('caches deterministic results for 60s and serves the second call from cache', async () => {
    let t = 1_000_000
    const now = () => t
    const fetchStatus = vi.fn().mockResolvedValue('administrator')
    const first = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '9',
      fetchStatus,
      now,
    })
    const second = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '9',
      fetchStatus,
      now,
    })
    expect(first).toBe('admin')
    expect(second).toBe('admin')
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('refetches after the 60s TTL elapses', async () => {
    let t = 1_000_000
    const now = () => t
    const fetchStatus = vi.fn().mockResolvedValueOnce('member').mockResolvedValueOnce('administrator')
    const first = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '10',
      fetchStatus,
      now,
    })
    t += 61_000
    const second = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '10',
      fetchStatus,
      now,
    })
    expect(first).toBe('member')
    expect(second).toBe('admin')
    expect(fetchStatus).toHaveBeenCalledTimes(2)
  })

  it('does not cache unknown results so the next call retries', async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('administrator')
    const first = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '11',
      fetchStatus,
    })
    const second = await readTelegramChatMemberRole({
      botToken: 't',
      chatId: '-100',
      userId: '11',
      fetchStatus,
    })
    expect(first).toBe('unknown')
    expect(second).toBe('admin')
    expect(fetchStatus).toHaveBeenCalledTimes(2)
  })
})
