import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

import {
  __resetCommandReplyClaimCacheForTests,
  tryClaimCommandReply,
} from './commandReplyLedger.js'

describe('tryClaimCommandReply', () => {
  beforeEach(() => {
    getDbMock.mockReset()
    __resetCommandReplyClaimCacheForTests()
  })

  it('fails closed when durable storage is not configured', async () => {
    getDbMock.mockResolvedValue(null)

    await expect(tryClaimCommandReply({
      roomId: '1659',
      messageId: 'reaction-1',
      commandHead: 'inverse-chat',
      failureMode: 'closed',
    })).resolves.toBe(false)
  })

  it('fails closed when the durable claim query errors', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn().mockRejectedValue(new Error('db_unavailable')),
    })

    await expect(tryClaimCommandReply({
      roomId: '1659',
      messageId: 'reaction-2',
      commandHead: 'inverse-chat',
      failureMode: 'closed',
    })).resolves.toBe(false)
  })

  it('preserves fail-open behavior for non-trading callers', async () => {
    getDbMock.mockResolvedValue(null)

    await expect(tryClaimCommandReply({
      roomId: '1043',
      messageId: 'command-1',
      commandHead: 'help',
    })).resolves.toBe(true)
  })
})
