/**
 * Keeper Jobs compatible handler for 1659 Risk Monitoring.
 *
 * This allows the risk watcher to be triggered as a recurring job
 * through the existing keeper coordination system (`keeper:jobs:worker`).
 *
 * Job kind suggestion: "1659_hype_risk_tick"
 *
 * The worker can claim jobs of this kind on a schedule (via cron or other enqueuers).
 */

import { run1659RiskTick } from '../1659-risk-watcher.js'

export async function handle1659RiskTick(payload: Record<string, unknown> = {}) {
  console.log('[keeper] 1659_hype_risk_tick starting', payload)

  const result = await run1659RiskTick({ once: true })

  if (!result.ok) {
    throw new Error(result.error || '1659 risk tick failed')
  }

  return {
    success: true,
    message: '1659 risk check completed',
    alertsTriggered: (result as any).alertsTriggered ?? 0,
  }
}
