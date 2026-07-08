import { describe, expect, it } from 'vitest'

import { parseHermitAlertCommandArgs } from './positionAlertStore.js'

describe('parseHermitAlertCommandArgs', () => {
  it('parses xmtp on/off/test subcommands', () => {
    expect(parseHermitAlertCommandArgs('xmtp on')).toEqual({ action: 'xmtp', enabled: true })
    expect(parseHermitAlertCommandArgs('xmtp off')).toEqual({ action: 'xmtp', enabled: false })
    expect(parseHermitAlertCommandArgs('xmtp test')).toEqual({ action: 'xmtp_test' })
  })

  it('still parses telegram and legacy alert commands', () => {
    expect(parseHermitAlertCommandArgs('telegram on')).toEqual({ action: 'telegram', enabled: true })
    expect(parseHermitAlertCommandArgs('status')).toEqual({ action: 'status' })
    expect(parseHermitAlertCommandArgs('liq 10')).toEqual({ action: 'liq', pct: 10 })
  })
})
