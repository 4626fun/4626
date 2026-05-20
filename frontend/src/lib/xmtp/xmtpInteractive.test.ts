import { describe, expect, it } from 'vitest'

import {
  XMTP_ACTION_IDS,
  buildWelcomeActions,
  normalizeAgentReply,
  resolveIntentActionId,
} from './xmtpInteractive'

describe('xmtpInteractive', () => {
  it('maps welcome action ids to slash commands', () => {
    expect(resolveIntentActionId(XMTP_ACTION_IDS.WELCOME_HELP)).toBe('/help')
    expect(resolveIntentActionId(XMTP_ACTION_IDS.WELCOME_KEEPR_STATUS)).toBe('/keepr status')
    expect(resolveIntentActionId(XMTP_ACTION_IDS.SWAP_CANCEL)).toBeNull()
  })

  it('builds welcome quick-start actions', () => {
    const payload = buildWelcomeActions()
    expect(payload.description).toBe('Quick start')
    expect(payload.actions.map((entry) => entry.id)).toEqual([
      XMTP_ACTION_IDS.WELCOME_HELP,
      XMTP_ACTION_IDS.WELCOME_KEEPR_STATUS,
      XMTP_ACTION_IDS.WELCOME_KEEPR_HEALTH,
      XMTP_ACTION_IDS.WELCOME_WALLET,
      XMTP_ACTION_IDS.WELCOME_AI,
    ])
  })

  it('tags welcome and uniswap quote replies for follow-up actions', () => {
    const welcome = normalizeAgentReply("o henlo! I'm Keepr, your 4626 assistant.")
    expect(welcome?.followUp).toBe('welcome-actions')

    const quote = normalizeAgentReply(JSON.stringify({ skill: 'uniswap_quote', data: { ok: true } }))
    expect(quote?.followUp).toBe('swap-quote-actions')
  })
})
