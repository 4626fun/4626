import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { logger } from '../infra/logger.js'
import { readArenaConfig, type ArenaConfig } from './arenaConfig.js'
import { validateArenaPair } from './arenaPairPolicy.js'
import type { ArenaOpResult, ArenaRunResult, ArenaTradeRequest } from './arenaTypes.js'

const execFileAsync = promisify(execFile)

const ARENA_ASSET_CATALOG = [
  'BTC',
  'ETH',
  'SOL',
  'xyz:GOLD',
  'xyz:SILVER',
  'xyz:PLATINUM',
  'xyz:PALLADIUM',
  'xyz:COPPER',
  'xyz:BRENTOIL',
  'xyz:WTIOIL',
  'xyz:NATGAS',
  'xyz:SP500',
  'xyz:XYZ100',
  'xyz:JP225',
  'xyz:KR200',
  'xyz:EUR',
  'xyz:JPY',
  'xyz:AAPL',
  'xyz:NVDA',
  'xyz:TSLA',
  'xyz:META',
  'xyz:CBRS',
] as const

type BuiltCommand = {
  command: string
  args: string[]
  cwd: string
}

function toArenaRunResult(params: {
  command: string
  args: string[]
  cwd: string
  stdout?: string
  stderr?: string
  code?: number | null
  timedOut?: boolean
  dryRun?: boolean
  error?: string
}): ArenaRunResult {
  return {
    ok: !params.error,
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    stdout: params.stdout ?? '',
    stderr: params.stderr ?? '',
    code: params.code ?? null,
    timedOut: params.timedOut ?? false,
    dryRun: params.dryRun ?? false,
    ...(params.error ? { error: params.error } : {}),
  }
}

function fail(message: string, details?: Record<string, unknown>): ArenaOpResult {
  return { ok: false, message, ...(details ? { details } : {}) }
}

function ensureArenaEnabled(config: ArenaConfig): ArenaOpResult | null {
  if (!config.enabled) {
    return fail('Arena commands are disabled. Set ARENA_ENABLED=1 to enable the control lane.')
  }
  if (!config.dgclawDir) {
    return fail('Arena is enabled but ARENA_DGCLAW_DIR is not configured.')
  }
  return null
}

function auditLog(event: string, data: Record<string, unknown>): void {
  logger.info('[arena.audit] ' + event, data)
}

async function runCommand(command: BuiltCommand, config: ArenaConfig): Promise<ArenaRunResult> {
  if (config.dryRun) {
    return toArenaRunResult({
      ...command,
      dryRun: true,
      stdout: '[dry-run] command not executed',
    })
  }

  try {
    const { stdout, stderr } = await execFileAsync(command.command, command.args, {
      cwd: command.cwd,
      timeout: config.commandTimeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    })
    return toArenaRunResult({
      ...command,
      stdout: stdout ?? '',
      stderr: stderr ?? '',
      code: 0,
    })
  } catch (error) {
    const err = error as {
      message?: string
      stderr?: string
      stdout?: string
      code?: number
      killed?: boolean
      signal?: string
    }
    return toArenaRunResult({
      ...command,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
      code: Number.isInteger(err.code) ? err.code : null,
      timedOut: Boolean(err.killed && err.signal === 'SIGTERM'),
      error: err.message ?? 'command_failed',
    })
  }
}

function buildDgclawCommand(config: ArenaConfig, args: string[]): BuiltCommand {
  return {
    command: config.dgclawBin,
    args,
    cwd: config.dgclawDir ?? process.cwd(),
  }
}

function buildNodeScriptCommand(config: ArenaConfig, scriptRelPath: string, args: string[]): BuiltCommand {
  return {
    command: config.nodeRunnerBin,
    args: ['ts-node', scriptRelPath, ...args],
    cwd: config.dgclawDir ?? process.cwd(),
  }
}

function parsePositiveNumber(input: number, fallback = 0): number {
  return Number.isFinite(input) && input > 0 ? input : fallback
}

export async function runArenaStatus(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation

  return {
    ok: true,
    message: 'Arena control lane is configured.',
    details: {
      enabled: config.enabled,
      tradingEnabled: config.tradingEnabled,
      dryRun: config.dryRun,
      agentId: config.agentId,
      agentWalletAddress: config.agentWalletAddress,
      hlApiWalletAddress: config.hlApiWalletAddress,
      commandTimeoutMs: config.commandTimeoutMs,
      dgclawDir: config.dgclawDir,
      allowedRoomIds: config.allowedRoomIds,
      hip3PrefixRequired: config.hip3PrefixRequired,
      allowlistEnabled: Boolean(config.assetAllowlist),
    },
  }
}

export async function listArenaAssets(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation

  const assets = config.assetAllowlist
    ? ARENA_ASSET_CATALOG.filter((asset) => config.assetAllowlist?.has(asset.toUpperCase()))
    : [...ARENA_ASSET_CATALOG]

  return {
    ok: true,
    message: 'Arena-supported assets',
    details: {
      total: assets.length,
      assets,
    },
  }
}

export async function runArenaJoin(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  const command = buildDgclawCommand(config, ['join'])
  const run = await runCommand(command, config)
  auditLog('join', { ok: run.ok, dryRun: run.dryRun })
  return {
    ok: run.ok,
    message: run.ok ? 'Arena join completed.' : 'Arena join failed.',
    run,
  }
}

export async function runArenaActivateUnifiedAccount(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  const command = buildDgclawCommand(config, ['activate-unified-account'])
  const run = await runCommand(command, config)
  auditLog('activate_unified_account', { ok: run.ok, dryRun: run.dryRun })
  return {
    ok: run.ok,
    message: run.ok ? 'Unified account activation completed.' : 'Unified account activation failed.',
    run,
  }
}

export async function runArenaAddApiWallet(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  const command = buildDgclawCommand(config, ['add-api-wallet'])
  const run = await runCommand(command, config)
  auditLog('add_api_wallet', { ok: run.ok, dryRun: run.dryRun })
  return {
    ok: run.ok,
    message: run.ok ? 'API wallet setup completed.' : 'API wallet setup failed.',
    run,
  }
}

export async function runArenaDepositUsdc(amountUsd: number, config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  if (!config.tradingEnabled) {
    return fail('Arena trading actions are disabled. Set ARENA_TRADING_ENABLED=1 to deposit.')
  }

  const amount = parsePositiveNumber(amountUsd)
  if (amount <= 0) return fail('Deposit amount must be a positive number.')
  if (amount > config.maxUsdcDeposit) {
    return fail(`Deposit ${amount} exceeds ARENA_MAX_USDC_DEPOSIT (${config.maxUsdcDeposit}).`)
  }

  const command = buildNodeScriptCommand(config, 'scripts/deposit.ts', [String(amount)])
  const run = await runCommand(command, config)
  auditLog('deposit', { ok: run.ok, dryRun: run.dryRun, amountUsd: amount })
  return {
    ok: run.ok,
    message: run.ok ? `Deposit submitted (${amount} USDC).` : 'Deposit command failed.',
    run,
  }
}

export async function runArenaTrade(request: ArenaTradeRequest, config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  if (!config.tradingEnabled) {
    return fail('Arena trading is disabled. Set ARENA_TRADING_ENABLED=1 to submit trades.')
  }

  const pairCheck = validateArenaPair(request.pair, config)
  if (!pairCheck.ok) return fail(pairCheck.message, { reason: pairCheck.reason })

  const action = request.action
  if (action === 'close') {
    const command = buildNodeScriptCommand(config, 'scripts/trade.ts', ['close', pairCheck.normalizedPair])
    const run = await runCommand(command, config)
    auditLog('trade_close', {
      ok: run.ok,
      dryRun: run.dryRun,
      pair: pairCheck.normalizedPair,
      market: pairCheck.market,
    })
    return {
      ok: run.ok,
      message: run.ok ? `Close submitted for ${pairCheck.normalizedPair}.` : 'Close trade failed.',
      run,
    }
  }

  const side = request.side
  const sizeUsd = parsePositiveNumber(request.sizeUsd ?? 0)
  const leverage = parsePositiveNumber(request.leverage ?? 0)
  if (!side) return fail('Open trade requires side (long or short).')
  if (sizeUsd <= 0) return fail('Open trade requires a positive sizeUsd.')
  if (leverage <= 0) return fail('Open trade requires a positive leverage.')
  if (sizeUsd > config.maxTradeSizeUsd) {
    return fail(`Trade size ${sizeUsd} exceeds ARENA_MAX_TRADE_SIZE_USD (${config.maxTradeSizeUsd}).`)
  }

  const command = buildNodeScriptCommand(config, 'scripts/trade.ts', [
    'open',
    pairCheck.normalizedPair,
    side,
    String(sizeUsd),
    String(leverage),
  ])
  const run = await runCommand(command, config)
  auditLog('trade_open', {
    ok: run.ok,
    dryRun: run.dryRun,
    pair: pairCheck.normalizedPair,
    market: pairCheck.market,
    side,
    sizeUsd,
    leverage,
  })
  return {
    ok: run.ok,
    message: run.ok ? `Open submitted for ${pairCheck.normalizedPair}.` : 'Open trade failed.',
    run,
  }
}
