#!/usr/bin/env tsx
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadKeeperEnv } from './utils/loadKeeperEnv.js'

import { executeSolanaRelayEntries } from './actions/keepr-solana-relay-entries.action.js'
import { executeSolanaFeeSettlement } from './actions/keepr-solana-settle-fees.action.js'
import { executeSolanaWinnerRelay } from './actions/keepr-solana-winner-relay.action.js'
import { executeSolanaPriceMonitor } from './actions/keepr-solana-price-monitor.action.js'
import { executeSolanaGraduation } from './actions/keepr-solana-graduation.action.js'
import { executeSolanaRebalance } from './actions/keepr-solana-rebalance.action.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadKeeperEnv()

type ReconcileBody = {
  workflow?: string
  action?: string
  checkpointKey?: string
  payload?: Record<string, unknown>
}

export type SolanaOrchestratorAction =
  | 'relay_entries'
  | 'settle_fees'
  | 'winner_relay'
  | 'price_monitor'
  | 'graduation'
  | 'rebalance'

export type ReconcileOutcome = {
  ok: boolean
  workflow: string
  action: SolanaOrchestratorAction
  checkpointKey: string
  result: unknown
}

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function safeCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b)
}

function bearer(req: IncomingMessage): string {
  const header = String(req.headers.authorization ?? '').trim()
  return header.replace(/^Bearer\s+/i, '').trim()
}

function isAuthorized(req: IncomingMessage): boolean {
  const secret = String(process.env.SOLANA_ORCHESTRATOR_API_KEY ?? '').trim()
  if (!secret) return false
  return safeCompare(bearer(req), secret)
}

async function readJson(req: IncomingMessage): Promise<ReconcileBody | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > 64 * 1024) return null
    chunks.push(buf)
  }
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ReconcileBody : null
  } catch {
    return null
  }
}

export function normalizeSolanaOrchestratorAction(value: unknown): SolanaOrchestratorAction | null {
  const action = typeof value === 'string' ? value.trim().toLowerCase().replace(/-/g, '_') : ''
  switch (action) {
    case 'relay_entries':
    case 'settle_fees':
    case 'winner_relay':
    case 'price_monitor':
    case 'graduation':
    case 'rebalance':
      return action
    default:
      return null
  }
}

function parseOrchestratorEnvFlag(raw: string | undefined): boolean | null {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return null
}

function actionEnabled(action: SolanaOrchestratorAction): boolean {
  const globalExecute = parseOrchestratorEnvFlag(process.env.SOLANA_ORCHESTRATOR_EXECUTE) === true
  const specificKey = `SOLANA_ORCHESTRATOR_${action.toUpperCase()}_ENABLED`
  const specific = parseOrchestratorEnvFlag(process.env[specificKey])
  if (specific === false) return false
  if (specific === true) return true
  return globalExecute
}

export async function executeSolanaOrchestratorAction(params: {
  workflow: string
  action: SolanaOrchestratorAction
  checkpointKey: string
  payload?: Record<string, unknown>
}): Promise<ReconcileOutcome> {
  if (!actionEnabled(params.action)) {
    throw new Error(`action_disabled:${params.action}`)
  }

  let result: unknown
  switch (params.action) {
    case 'relay_entries':
      result = await executeSolanaRelayEntries()
      break
    case 'settle_fees':
      result = await executeSolanaFeeSettlement()
      break
    case 'winner_relay':
      result = await executeSolanaWinnerRelay()
      break
    case 'price_monitor':
      result = await executeSolanaPriceMonitor()
      break
    case 'graduation':
      result = await executeSolanaGraduation()
      break
    case 'rebalance':
      result = await executeSolanaRebalance()
      break
    default:
      params.action satisfies never
  }

  return {
    ok: true,
    workflow: params.workflow,
    action: params.action,
    checkpointKey: params.checkpointKey,
    result,
  }
}

async function handleReconcile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    json(res, 401, { ok: false, error: 'unauthorized' })
    return
  }
  const body = await readJson(req)
  if (!body) {
    json(res, 400, { ok: false, error: 'invalid_json' })
    return
  }
  const workflow = typeof body.workflow === 'string' && body.workflow.trim() ? body.workflow.trim() : ''
  const checkpointKey = typeof body.checkpointKey === 'string' && body.checkpointKey.trim() ? body.checkpointKey.trim() : ''
  const action = normalizeSolanaOrchestratorAction(body.action)
  if (!workflow || !checkpointKey || !action) {
    json(res, 400, { ok: false, error: 'workflow_action_checkpoint_required' })
    return
  }

  try {
    const outcome = await executeSolanaOrchestratorAction({
      workflow,
      action,
      checkpointKey,
      payload: body.payload,
    })
    json(res, 200, outcome)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    json(res, message.startsWith('action_disabled:') ? 503 : 500, { ok: false, error: message })
  }
}

export function createSolanaKeeperOrchestratorServer() {
  return createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/healthz') {
        json(res, 200, { ok: true, now: new Date().toISOString() })
        return
      }
      if (req.method === 'POST' && req.url === '/reconcile') {
        await handleReconcile(req, res)
        return
      }
      json(res, 404, { ok: false, error: 'not_found' })
    })().catch((error) => {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : 'unknown_error' })
    })
  })
}

if (process.argv[1]?.endsWith('solana-keeper-orchestrator.ts')) {
  const port = Number(process.env.SOLANA_ORCHESTRATOR_PORT ?? process.env.PORT ?? 8789)
  createSolanaKeeperOrchestratorServer().listen(port, () => {
    console.log(`solana-keeper-orchestrator listening on :${port}`)
  })
}
