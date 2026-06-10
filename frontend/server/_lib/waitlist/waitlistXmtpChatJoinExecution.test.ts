import { describe, expect, it, vi } from 'vitest'

import {
  WAITLIST_CHAT_STALE_EXECUTING_SECONDS,
  buildWaitlistChatDedupeKey,
  executeWaitlistChatJoinActionNow,
} from './waitlistXmtpChatJoinExecution.js'

vi.mock('../../keepr/xmtpQueueExecutor.js', () => ({
  executeKeeprAction: vi.fn(async () => ({ success: true })),
}))

vi.mock('../agentControl/trustZones.js', () => ({
  resolveKeeprTrustZone: () => 'xmtp',
  isKeeprTrustZoneWriteEnabled: () => true,
  formatTrustZoneDisabledError: () => 'disabled',
}))

describe('waitlistXmtpChatJoinExecution', () => {
  it('buildWaitlistChatDedupeKey lowercases member address', () => {
    expect(
      buildWaitlistChatDedupeKey('abc', '0xAbCd00000000000000000000000000000000000001'),
    ).toBe('waitlist-chat:add:abc:0xabcd00000000000000000000000000000000000001')
  })

  it('reclaims stale executing actions before retrying execution', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('?')
      if (query.includes('SELECT status') && query.includes('FROM keepr_actions')) {
        return { rows: [{ status: 'executing' }] }
      }
      if (query.includes('UPDATE keepr_actions') && query.includes('RETURNING id')) {
        return { rows: [{ id: values[0] }] }
      }
      if (query.includes("status = 'executed'")) {
        return { rows: [] }
      }
      return { rows: [] }
    })

    const db = { sql }
    const result = await executeWaitlistChatJoinActionNow({
      db,
      actionId: 24,
      groupId: 'ed6fbda34f2614536df5cec08dff2266',
      action: { action: 'xmtp.group.add_member', wallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5' },
    })

    expect(result.outcome).toBe('executed')
    const claimCall = sql.mock.calls.find(([strings]) =>
      String(strings).includes("status = 'executing'") && String(strings).includes('RETURNING id'),
    )
    expect(claimCall).toBeTruthy()
    expect(claimCall?.some((part) => part === WAITLIST_CHAT_STALE_EXECUTING_SECONDS)).toBe(true)
  })
})
