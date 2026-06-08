import { describe, expect, it } from 'vitest'

import {
  formatTrustZoneMismatchError,
  getKeeprTrustZoneKillSwitchEnvKey,
  isKeeprTrustZoneWriteEnabled,
  resolveKeeprEffectiveActionType,
  resolveKeeprTrustZone,
  validateRequestedKeeprTrustZone,
} from '../trustZones.js'

describe('agent control trust zone helpers', () => {
  it('resolves trust zones from action types', () => {
    expect(resolveKeeprTrustZone('xmtp.group.add_member')).toBe('queue_messaging_monitoring')
    expect(resolveKeeprTrustZone('strategy.ajna.rebucket')).toBe('financial_execution')
  })

  it('maps trust zones to kill-switch env keys', () => {
    expect(getKeeprTrustZoneKillSwitchEnvKey('financial_execution')).toBe(
      'KPR_ZONE_DISABLE_FINANCIAL_EXECUTION',
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
        KPR_ZONE_DISABLE_FINANCIAL_EXECUTION: 'true',
      }),
    ).toBe(false)
  })

  it('validates requested trust zone header against resolved action zone', () => {
    expect(
      validateRequestedKeeprTrustZone({
        requestedHeaderValue: 'financial_execution',
        actionType: 'strategy.ajna.rebucket',
      }),
    ).toBeNull()

    const mismatch = validateRequestedKeeprTrustZone({
      requestedHeaderValue: 'market_maintenance',
      actionType: 'strategy.ajna.rebucket',
    })
    expect(mismatch).toEqual({
      requested: 'market_maintenance',
      resolved: 'financial_execution',
    })
    expect(formatTrustZoneMismatchError(mismatch!.requested, mismatch!.resolved)).toContain(
      'requested=market_maintenance resolved=financial_execution',
    )
  })
})
