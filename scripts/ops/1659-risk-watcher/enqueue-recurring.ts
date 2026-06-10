#!/usr/bin/env tsx
/**
 * Enqueues recurring 1659 HYPE risk monitor jobs into the keeper system.
 *
 * These jobs will be picked up by the standard keeper:jobs:worker and will
 * call the internal API at /api/keeper/jobs/1659-risk-monitor which runs
 * the actual monitoring + alerting logic.
 *
 * Recommended: Run this on a schedule (Vercel cron, external cron, or another keeper job).
 *
 *   pnpm -C frontend exec tsx ../scripts/ops/1659-risk-watcher/enqueue-recurring.ts
 */

import 'dotenv/config'
import { enqueueKeeperJob } from '../../frontend/server/_lib/keeperJobs/keeperJobs.js'

const KIND = '1659_hype_risk_monitor'

async function main() {
  const intervalMinutes = Number(process.env['1659_RISK_MONITOR_INTERVAL_MIN'] || 1)

  console.log(`Enqueuing recurring ${KIND} job (every ~${intervalMinutes}m)`)

  const runAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString()

  const job = await enqueueKeeperJob({
    kind: KIND,
    payload: {
      // This tells the keeper runner to hit our internal API handler
      path: '/api/keeper/jobs/1659-risk-monitor',
      method: 'POST',
      body: {
        source: '1659-risk-recurring-enqueuer',
        triggeredAt: new Date().toISOString(),
      },
    },
    source: '1659-risk-recurring',
    dedupeKey: `1659-risk-${Math.floor(Date.now() / (intervalMinutes * 60 * 1000))}`,
    priority: 5,
    runAt,
    maxAttempts: 3,
  })

  console.log('Enqueued keeper job id:', job?.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})