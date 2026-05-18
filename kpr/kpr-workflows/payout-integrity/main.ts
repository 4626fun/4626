import { executePayoutIntegrityMonitor } from '../../actions/payout-integrity-monitor.action.js'

export async function main() {
  const result = await executePayoutIntegrityMonitor()
  console.log(
    JSON.stringify({
      workflow: 'payout-integrity',
      timestamp: new Date().toISOString(),
      ...result,
    }),
  )
}
