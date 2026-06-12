/**
 * Standalone Virtuals ACP runner.
 *
 * Runs the Virtuals ACP bridge as its own process, completely separate from
 * the Railway XMTP Keepr primary. Use this when you want the ACP job loop
 * live without touching the production agent:
 *
 *   pnpm -C frontend agent:virtuals
 *
 * Requires in .env:
 *   VIRTUALS_ACP_ENABLED=1
 *   VIRTUALS_ACP_WALLET_ADDRESS=0x...   (agent wallet from Virtuals UI)
 *   VIRTUALS_ACP_WALLET_ID=...          (Privy wallet id from Virtuals UI)
 *   VIRTUALS_ACP_SIGNER_PRIVATE_KEY=... (session signer key from Virtuals UI)
 * plus at least one LLM provider key (GROQ_API_KEY / OPENAI_API_KEY / ...).
 *
 * Optional:
 *   VIRTUALS_ACP_CHAIN_ID (default 8453), VIRTUALS_ACP_PERSONA,
 *   VIRTUALS_ACP_MAX_BUDGET_USDC (default 5), VIRTUALS_ACP_AUTO_FUND (default 0),
 *   VIRTUALS_ACP_AUTO_LLM (default 1), VIRTUALS_ACP_HEALTH_PORT (default off).
 */

import http from 'node:http'

import { checkVirtualsAcpConfig, readVirtualsAcpConfig } from './config.js'
import { getVirtualsAcpService } from './service.js'

function log(message: string, extra?: Record<string, unknown>): void {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
  console.log(`[virtuals-acp-runner] ${message}${suffix}`)
}

async function main(): Promise<void> {
  const config = readVirtualsAcpConfig()
  const check = checkVirtualsAcpConfig(config)
  if (!check.ok) {
    console.error(`[virtuals-acp-runner] config invalid: ${check.reason}`)
    process.exitCode = 1
    return
  }

  const service = getVirtualsAcpService()
  const result = await service.start()
  if (!result.started) {
    console.error(`[virtuals-acp-runner] failed to start: ${result.reason ?? 'unknown'}`)
    process.exitCode = 1
    return
  }

  const status = service.getStatus()
  log('started', {
    agentAddress: status.agentAddress,
    chainId: status.chainId,
    autoLlm: status.autoLlmEnabled,
    autoFund: status.autoFundEnabled,
    maxBudgetUsdc: status.maxBudgetUsdc,
  })

  // Optional health endpoint for hosted deploys (Railway/Fly style probes).
  const healthPort = Number.parseInt(process.env.VIRTUALS_ACP_HEALTH_PORT ?? '', 10)
  let healthServer: http.Server | null = null
  if (Number.isInteger(healthPort) && healthPort > 0) {
    healthServer = http.createServer((req, res) => {
      if (req.url === '/healthz' || req.url === '/readyz') {
        const current = service.getStatus()
        res.writeHead(current.running ? 200 : 503, { 'content-type': 'application/json' })
        res.end(JSON.stringify(current))
        return
      }
      res.writeHead(404)
      res.end()
    })
    healthServer.listen(healthPort, () => log('health endpoint listening', { port: healthPort }))
  }

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log(`received ${signal} — shutting down`)
    try {
      await service.stop()
    } finally {
      healthServer?.close()
      process.exit(0)
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  // Periodic heartbeat so hosted logs show liveness.
  setInterval(() => {
    const current = service.getStatus()
    log('heartbeat', {
      sessions: current.sessions.length,
      entriesHandled: current.entriesHandled,
      toolsExecuted: current.toolsExecuted,
      lastError: current.lastError ?? undefined,
    })
  }, 5 * 60 * 1000).unref()
}

void main().catch((error) => {
  console.error('[virtuals-acp-runner] fatal:', error)
  process.exit(1)
})
