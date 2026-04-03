import { describe, expect, it } from 'vitest'

import {
  getKeeprTrustZoneKillSwitchEnvKey,
  isKeeprTrustZoneWriteEnabled,
  resolveKeeprEffectiveActionType,
  resolveKeeprTrustZone,
} from '../trustZones.js'

describe('agent control trust zone helpers', () => {
  it('resolves trust zones from action types', () => {
    expect(resolveKeeprTrustZone('xmtp.group.add_member')).toBe('queue_messaging_monitoring')
    expect(resolveKeeprTrustZone('strategy.ajna.rebucket')).toBe('financial_execution')
  })

  it('maps trust zones to kill-switch env keys', () => {
    expect(getKeeprTrustZoneKillSwitchEnvKey('financial_execution')).toBe(
      'KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION',
    )
  })

  it('prefers the structured action payload when resolving the effective action type', () => {
    expect(
      resolveKeeprEffectiveActionType('monitor.healthcheck', {
        action: 'strategy.ajna.rebucket',
      }),
    ).toBe('strategy.ajna.rebucket')
  })

  it('treats enabled as the default and honors explicit kill switches', () => {
    expect(isKeeprTrustZoneWriteEnabled('financial_execution', {})).toBe(true)
    expect(
      isKeeprTrustZoneWriteEnabled('financial_execution', {
        KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION: 'true',
      }),
    ).toBe(false)
  })
})
