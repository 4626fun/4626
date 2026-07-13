#!/usr/bin/env tsx
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadKeeperEnv } from './utils/loadKeeperEnv.js'

import { executeSolanaFeeSettlement } from './actions/keepr-solana-settle-fees.action.js'
import { executeSolanaPriceMonitor } from './actions/keepr-solana-price-monitor.action.js'
import { executeSolanaGraduation } from './actions/keepr-solana-graduation.action.js'
import { executeSolanaSyncMapping } from './actions/keepr-solana-sync-mapping.action.js'
import { ActionLeaseError, withActionLease } from './utils/actionLease.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadKeeperEnv()

type ReconcileBody = {
  workflow?: string
  action?: string
  checkpointKey?: string
  payload?: Record<string, unknown>
}

export type SolanaOrchestratorAction =
  | 'settle_fees'
  | 'price_monitor'
  | 'graduation'
  | 'sync_mapping'

export type ReconcileOutcome = {
  ok: boolean
  workflow: string
  action: SolanaOrchestratorAction
  checkpointKey: string
  result: unknown
}

export function publicOrchestratorError(error: unknown): {
  statusCode: number
  code: string
  retryable: boolean
} {
  const message = error instanceof Error ? error.message : ''
  // Preserve full action_disabled:<action> so ops probes can assert which lane is off.
  // These codes are intentional (not filesystem paths) and safe to expose.
  if (message.startsWith('action_disabled:')) {
    return { statusCode: 503, code: message, retryable: true }
  }
  if (message === 'action_disabled') {
    return { statusCode: 503, code: 'action_disabled', retryable: true }
  }
  if (message === 'action_lease_held') {
    return { statusCode: 409, code: 'action_lease_held', retryable: true }
  }
  if (error instanceof ActionLeaseError) {
    return {
      statusCode: error.code === 'action_lease_outcome_indeterminate' ? 409 : 503,
      code: error.code,
      retryable: error.code !== 'action_lease_outcome_indeterminate',
    }
  }
  return { statusCode: 500, code: 'action_execution_failed', retryable: true }
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
    case 'settle_fees':
    case 'price_monitor':
    case 'graduation':
    case 'sync_mapping':
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

async function runSolanaOrchestratorActionBody(params: {
  action: SolanaOrchestratorAction
  payload?: Record<string, unknown>
}): Promise<unknown> {
  switch (params.action) {
    case 'settle_fees':
      return executeSolanaFeeSettlement()
    case 'price_monitor':
      return executeSolanaPriceMonitor()
    case 'graduation':
      return executeSolanaGraduation()
    case 'sync_mapping':
      return executeSolanaSyncMapping(params.payload ?? {})
    default:
      params.action satisfies never
      return undefined
  }
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

  // M2-09: exclusive lease so Vultr local cron + Vercel sidecar cannot double-exec.
  const leased = await withActionLease({
    action: params.action,
    holder: `${params.workflow}:${params.checkpointKey}`,
    run: async ({ markEffectsStarted }) => {
      // Current actions are not cooperatively abortable, so fence the entire
      // action as potentially effectful before entering it.
      markEffectsStarted()
      return runSolanaOrchestratorActionBody({
        action: params.action,
        payload: params.payload,
      })
    },
  })

  if (leased.outcome === 'held') {
    throw new Error('action_lease_held')
  }
  if (leased.outcome === 'aborted_before_effects') {
    throw new ActionLeaseError('action_lease_aborted_before_effects')
  }
  if (leased.outcome === 'indeterminate') {
    throw new ActionLeaseError('action_lease_outcome_indeterminate')
  }

  return {
    ok: true,
    workflow: params.workflow,
    action: params.action,
    checkpointKey: params.checkpointKey,
    result: leased.result,
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
    const publicError = publicOrchestratorError(error)
    json(res, publicError.statusCode, {
      ok: false,
      error: publicError.code,
      retryable: publicError.retryable,
    })
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
      const publicError = publicOrchestratorError(error)
      json(res, publicError.statusCode, {
        ok: false,
        error: publicError.code,
        retryable: publicError.retryable,
      })
    })
  })
}

if (process.argv[1]?.endsWith('solana-keeper-orchestrator.ts')) {
  const port = Number(process.env.SOLANA_ORCHESTRATOR_PORT ?? process.env.PORT ?? 8789)
  createSolanaKeeperOrchestratorServer().listen(port, () => {
    console.log(`solana-keeper-orchestrator listening on :${port}`)
  })
}
