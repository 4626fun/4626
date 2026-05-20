import { describe, expect, it } from 'vitest'

import {
  buildKeeprStatusFollowUpActions,
  buildWelcomeActions,
  normalizeAgentReply,
  resolveIntentActionId,
  XMTP_ACTION_IDS,
} from './xmtpInteractive'

describe('xmtpInteractive', () => {
  it('maps intent action ids to slash commands', () => {
    expect(resolveIntentActionId(XMTP_ACTION_IDS.WELCOME_HELP)).toBe('/help')
    expect(resolveIntentActionId(XMTP_ACTION_IDS.KEEPR_REFRESH)).toBe('/keepr status')
    expect(resolveIntentActionId('unknown')).toBeNull()
  })

  it('builds welcome and keepr follow-up action payloads', () => {
    const welcome = buildWelcomeActions()
    expect(welcome.description).toBeTruthy()
    expect(welcome.actions.length).toBeGreaterThan(0)

    const followUp = buildKeeprStatusFollowUpActions()
    expect(followUp.actions.map((entry) => entry.id)).toEqual([
      XMTP_ACTION_IDS.KEEPR_REFRESH,
      XMTP_ACTION_IDS.KEEPR_HEALTH,
      XMTP_ACTION_IDS.KEEPR_BACK,
    ])
  })

  it('normalizes structured agent replies and welcome text', () => {
    expect(normalizeAgentReply({ text: 'status', followUp: 'keepr-status-followup', reactToInbound: true })).toEqual({
      text: 'status',
      followUp: 'keepr-status-followup',
      reactToInbound: true,
    })
    expect(normalizeAgentReply("o henlo! I'm Keepr, your 4626 assistant.")?.followUp).toBe('welcome-actions')
  })
})
