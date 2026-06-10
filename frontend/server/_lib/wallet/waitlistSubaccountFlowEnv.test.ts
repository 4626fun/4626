import { describe, expect, it } from 'vitest'

import { isWaitlistSubaccountFlowEnabled } from './waitlistSubaccountFlowEnv.js'

describe('isWaitlistSubaccountFlowEnabled', () => {
  it('enables only for the literal "1"', () => {
    expect(isWaitlistSubaccountFlowEnabled({ WAITLIST_SUBACCOUNT_FLOW_ENABLED: '1' })).toBe(true)
    expect(isWaitlistSubaccountFlowEnabled({ WAITLIST_SUBACCOUNT_FLOW_ENABLED: ' true ' })).toBe(
      false,
    )
    expect(isWaitlistSubaccountFlowEnabled({ WAITLIST_SUBACCOUNT_FLOW_ENABLED: 'true' })).toBe(false)
    expect(isWaitlistSubaccountFlowEnabled({})).toBe(false)
  })
})
