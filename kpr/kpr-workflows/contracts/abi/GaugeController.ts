/**
 * Gauge / tradeFeeCollector ABI fragments for KPR payout-integrity workflow.
 *
 * Neutral BPS and jackpot views come from ITradeFeeCollector4626. Creator
 * ongoing-treasury getters remain a lane extension.
 */

import {
  CreatorTradeFeeCollectorExtensionABI,
  TradeFeeCollector4626ABI,
} from './TradeFeeCollector4626.js'

export { TradeFeeCollector4626ABI, CreatorTradeFeeCollectorExtensionABI }

/** Creator-lane monitor ABI (neutral + creator treasury extension). */
export const GaugeControllerABI = [
  ...TradeFeeCollector4626ABI.filter((item) =>
    ['burnShareBps', 'lotteryShareBps', 'protocolShareBps', 'vault'].includes(item.name),
  ),
  ...CreatorTradeFeeCollectorExtensionABI,
] as const
