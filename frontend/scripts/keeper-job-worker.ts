import { runKeeperJobTick } from '../server/_lib/keeperJobs/keeperJobRunner.js'

function requiredEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name} env var is required`)
  return value
}

function optionalPositiveInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

async function main() {
  const baseUrl = requiredEnv('KEEPER_COORDINATION_BASE_URL')
  const apiKey = requiredEnv('KEEPR_API_KEY')
  const workerId = String(process.env.KEEPER_WORKER_ID ?? `keeper-worker-${process.pid}`).trim()
  const limit = optionalPositiveInt('KEEPER_WORKER_LIMIT', 1, 1, 10)
  const leaseSeconds = optionalPositiveInt('KEEPER_WORKER_LEASE_SECONDS', 300, 30, 3600)
  const retryDelaySeconds = optionalPositiveInt('KEEPER_WORKER_RETRY_DELAY_SECONDS', 60, 1, 86_400)

  const tick = await runKeeperJobTick({
    baseUrl,
    apiKey,
    workerId,
    limit,
    leaseSeconds,
    retryDelaySeconds,
  })

  console.log(
    `keeper_jobs_claimed count=${tick.claimed} releasedExpiredClaims=${tick.releasedExpiredClaims}`,
  )
  for (const result of tick.results) {
    const suffix = result.error ? ` error=${result.error}` : ''
    console.log(`keeper_job_${result.status} id=${result.id} kind=${result.kind}${suffix}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
