import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { promisify } from 'node:util'

import { logger } from '../infra/logger.js'
import {
  computeAcpSeedFingerprint,
  isEnvSeedConsumed,
  markAcpSeedConsumed,
  resolveAcpStateEnv,
} from './acpAuthBootstrap.js'
import { readArenaConfig, type ArenaConfig } from './arenaConfig.js'
import { validateArenaPair } from './arenaPairPolicy.js'
import type { ArenaCreateResult, ArenaOpResult, ArenaRunResult, ArenaTradeRequest } from './arenaTypes.js'

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
  env?: Record<string, string>
}

type DgclawCommandResolution = {
  commandPath: string
  workingDirectory: string
  source: 'configured' | 'fallback'
  candidatePaths: string[]
}

const DGCLAW_FALLBACK_DIRS = ['/app/dgclaw-skill']

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
      ...(command.env ? { env: { ...process.env, ...command.env } } : {}),
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
    const message = err.message ?? 'command_failed'
    const resolvedCommandPath = isAbsolute(command.command)
      ? command.command
      : resolve(command.cwd, command.command)
    const errorMessage = message.includes('ENOENT')
      ? `${message} (resolvedCommand=${resolvedCommandPath}; cwd=${command.cwd})`
      : message
    const timeoutMessage =
      err.killed && err.signal === 'SIGTERM'
        ? `command timed out after ${config.commandTimeoutMs}ms`
        : undefined
    return toArenaRunResult({
      ...command,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
      code: Number.isInteger(err.code) ? err.code : null,
      timedOut: Boolean(err.killed && err.signal === 'SIGTERM'),
      error: timeoutMessage ? `${errorMessage} (${timeoutMessage})` : errorMessage,
    })
  }
}

function resolveDgclawCommand(config: ArenaConfig): DgclawCommandResolution {
  const candidatePaths: string[] = []
  const configuredWorkingDirectory = config.dgclawDir ?? process.cwd()
  const fallbackWorkingDirectories: string[] = []
  for (const fallback of DGCLAW_FALLBACK_DIRS) {
    if (!fallbackWorkingDirectories.includes(fallback) && fallback !== configuredWorkingDirectory) {
      fallbackWorkingDirectories.push(fallback)
    }
  }

  if (isAbsolute(config.dgclawBin)) {
    const directResolution = {
      commandPath: config.dgclawBin,
      workingDirectory: config.dgclawDir ?? dirname(config.dgclawBin),
      source: 'configured' as const,
      candidatePaths: [config.dgclawBin],
    }
    if (existsSync(directResolution.commandPath)) return directResolution
    return directResolution
  }

  const candidates: Array<{ commandPath: string; workingDirectory: string; source: 'configured' | 'fallback' }> = []
  const candidateWorkingDirectories = [configuredWorkingDirectory, ...fallbackWorkingDirectories]
  for (let index = 0; index < candidateWorkingDirectories.length; index += 1) {
    const workingDirectory = candidateWorkingDirectories[index]
    const source = index === 0 ? 'configured' : 'fallback'
    const candidatePathSet = new Set<string>([
      resolve(workingDirectory, config.dgclawBin),
      resolve(workingDirectory, 'dgclaw.sh'),
      resolve(workingDirectory, 'scripts/dgclaw.sh'),
    ])
    for (const commandPath of candidatePathSet) {
      candidates.push({ commandPath, workingDirectory, source })
    }
  }

  for (const candidate of candidates) {
    if (!candidatePaths.includes(candidate.commandPath)) {
      candidatePaths.push(candidate.commandPath)
    }
    if (existsSync(candidate.commandPath)) {
      return {
        ...candidate,
        candidatePaths,
      }
    }
  }

  const primaryCandidate = candidates[0] ?? {
    commandPath: resolve(configuredWorkingDirectory, config.dgclawBin),
    workingDirectory: configuredWorkingDirectory,
    source: 'configured' as const,
  }
  return {
    ...primaryCandidate,
    candidatePaths: candidatePaths.length > 0 ? candidatePaths : [primaryCandidate.commandPath],
  }
}

function ensureDgclawReady(config: ArenaConfig): ArenaOpResult | null {
  if (config.dryRun) return null

  const { commandPath, workingDirectory, candidatePaths } = resolveDgclawCommand(config)
  if (!existsSync(workingDirectory)) {
    return fail(
      `Arena command path misconfigured: ARENA_DGCLAW_DIR does not exist (${workingDirectory}).`,
    )
  }
  if (!existsSync(commandPath)) {
    const attempts = candidatePaths.slice(0, 3).join(', ')
    return fail(
      `Arena command path misconfigured: dgclaw binary not found (${commandPath}). Tried: ${attempts}. Verify ARENA_DGCLAW_DIR/ARENA_DGCLAW_BIN.`,
    )
  }
  return null
}

function buildDgclawCommand(config: ArenaConfig, args: string[]): BuiltCommand {
  const { commandPath, workingDirectory } = resolveDgclawCommand(config)
  return {
    command: commandPath,
    args,
    cwd: workingDirectory,
    env: buildArenaCommandEnv(config),
  }
}

function buildNodeScriptCommand(config: ArenaConfig, scriptRelPath: string, args: string[]): BuiltCommand {
  // dgclaw-skill is ESM ("type": "module") and ships tsx, not ts-node.
  return {
    command: config.nodeRunnerBin,
    args: ['tsx', scriptRelPath, ...args],
    cwd: config.dgclawDir ?? process.cwd(),
    env: buildArenaCommandEnv(config),
  }
}

function buildAcpCommand(config: ArenaConfig, args: string[]): BuiltCommand {
  return {
    command: config.acpBin,
    args,
    cwd: config.dgclawDir ?? process.cwd(),
    env: buildArenaCommandEnv(config),
  }
}

function buildArenaCommandEnv(config: ArenaConfig): Record<string, string> {
  // Pin acp-cli state (tokens, config.json, signer keystore) to the persistent
  // ARENA_ACP_HOME dir so trade.ts signing survives Railway redeploys.
  const env: Record<string, string> = { ...resolveAcpStateEnv() }

  // API-wallet signing lane (user-silo defense): trade.ts signs locally with
  // an approved HL API wallet key for the override master account, bypassing
  // ACP entirely. The override must win over any ambient HL_MASTER_ADDRESS.
  if (config.hlAgentPrivateKey && config.hlMasterAddressOverride) {
    env.HL_AGENT_PRIVATE_KEY = config.hlAgentPrivateKey
    env.HL_MASTER_ADDRESS = config.hlMasterAddressOverride
    return env
  }
  // Bot (ACP) lane: make sure an ambient API-wallet key can never leak into
  // the child env and hijack signing away from the ACP master wallet.
  env.HL_AGENT_PRIVATE_KEY = ''

  if (config.agentId) env.ARENA_AGENT_ID = config.agentId
  if (config.agentWalletAddress) {
    env.ARENA_AGENT_WALLET_ADDRESS = config.agentWalletAddress
    // dgclaw v2 trade.ts reads HL_MASTER_ADDRESS (the ACP agent wallet) and
    // otherwise tries acp-cli auto-detection, which fails on ephemeral
    // containers without a configured ACP session.
    if (!String(process.env.HL_MASTER_ADDRESS ?? '').trim()) {
      env.HL_MASTER_ADDRESS = config.agentWalletAddress
    }
  }
  if (config.hlApiWalletAddress) env.ARENA_HL_API_WALLET_ADDRESS = config.hlApiWalletAddress
  return env
}

function parsePositiveNumber(input: number, fallback = 0): number {
  return Number.isFinite(input) && input > 0 ? input : fallback
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null
}

export function parseAcpAgentCreateOutput(stdout: string): { agentId?: string; agentWalletAddress?: string; hlApiWalletAddress?: string } {
  if (!stdout) return {}
  const text = stdout.trim()
  // Try JSON first (future-proof for structured scripts)
  try {
    const j = JSON.parse(text)
    if (j && typeof j === 'object') {
      const id = typeof j.agentId === 'string' ? j.agentId : (typeof j.id === 'string' ? j.id : undefined)
      const w = typeof j.agentWalletAddress === 'string' ? j.agentWalletAddress : (typeof j.wallet === 'string' ? j.wallet : undefined)
      const h = typeof j.hlApiWalletAddress === 'string' ? j.hlApiWalletAddress : (typeof j.hlWallet === 'string' ? j.hlWallet : undefined)
      if (id || w) return { agentId: id, agentWalletAddress: w ? w.toLowerCase() : undefined, hlApiWalletAddress: h ? h.toLowerCase() : undefined }
    }
  } catch {
    // not JSON, fall through to regex
  }
  // Common human/CLI output patterns from acp agent create and wrappers
  const idMatch = text.match(/Agent ID[:\s]+([0-9a-fA-F-]{8,})|id[:\s]+([0-9a-fA-F-]{8,})/i)
  const walletMatch = text.match(/Agent [Ww]allet[:\s]+(0x[0-9a-fA-F]{40})|[Ww]allet[:\s]+(0x[0-9a-fA-F]{40})/i)
  const hlMatch = text.match(/HL API [Ww]allet[:\s]+(0x[0-9a-fA-F]{40})|hlApiWalletAddress[:\s]+(0x[0-9a-fA-F]{40})/i)
  const agentId = (idMatch?.[1] || idMatch?.[2] || '').trim() || undefined
  const agentWalletAddress = ((walletMatch?.[1] || walletMatch?.[2] || '').trim() || undefined)?.toLowerCase()
  const hlApiWalletAddress = ((hlMatch?.[1] || hlMatch?.[2] || '').trim() || undefined)?.toLowerCase()
  return { agentId, agentWalletAddress, hlApiWalletAddress }
}

function parseAcpJobCreateOutput(run: ArenaRunResult): { jobId?: string } {
  const candidates = [run.stdout, run.stderr]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const fromKnownKeys =
        (typeof parsed.jobId === 'string' ? parsed.jobId : null) ??
        (typeof parsed.id === 'string' ? parsed.id : null) ??
        (typeof parsed.requestId === 'string' ? parsed.requestId : null)
      if (fromKnownKeys) return { jobId: fromKnownKeys }
    } catch {
      // fall through to regex extraction
    }
  }

  const merged = candidates.join('\n')
  const jobMatch = merged.match(/\b([0-9a-f]{8}-[0-9a-f-]{9,}|[0-9a-f]{24,})\b/i)
  return { jobId: jobMatch?.[1] }
}

function isAcpSessionExpired(run: ArenaRunResult): boolean {
  const haystack = `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`.toLowerCase()
  return (
    haystack.includes('not_authenticated') ||
    haystack.includes('session expired') ||
    haystack.includes('run `acp configure`') ||
    haystack.includes('not authenticated') ||
    haystack.includes('unauthorized')
  )
}

export async function runArenaStatus(config = readArenaConfig()): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  const dgclawCommand = resolveDgclawCommand(config)

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
      dgclawBin: config.dgclawBin,
      dgclawCommandPath: dgclawCommand.commandPath,
      dgclawCommandSource: dgclawCommand.source,
      dgclawCandidatePaths: dgclawCommand.candidatePaths,
      dgclawDirExists: existsSync(dgclawCommand.workingDirectory),
      dgclawCommandExists: existsSync(dgclawCommand.commandPath),
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
  const dgclawValidation = ensureDgclawReady(config)
  if (dgclawValidation) return dgclawValidation
  // Pass the configured arena wallet to avoid relying on ACP local agent autodiscovery
  // in Railway runtimes, where no active local ACP agent profile may be present.
  const command = buildDgclawCommand(
    config,
    config.agentWalletAddress ? ['join', config.agentWalletAddress] : ['join'],
  )
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
  // dgclaw v2 moved activation out of dgclaw.sh into a dedicated script.
  const command = buildNodeScriptCommand(config, 'scripts/activate-unified.ts', [])
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
  // dgclaw v2 removed API wallets entirely: orders are signed by the ACP agent
  // wallet via acp-cli. Treat this step as a successful no-op so setup
  // pipelines that still include it do not fail.
  auditLog('add_api_wallet', { ok: true, dryRun: config.dryRun, skipped: true })
  return {
    ok: true,
    message: 'API wallet setup skipped: dgclaw v2 signs orders with the ACP agent wallet (no API wallet required).',
  }
}

export async function runArenaBridgeToHyperliquid(
  amountUsd: number,
  config = readArenaConfig(),
): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  if (!config.tradingEnabled) {
    return fail('Arena trading actions are disabled. Set ARENA_TRADING_ENABLED=1 to bridge.')
  }

  const amount = parsePositiveNumber(amountUsd)
  if (amount <= 0) return fail('Bridge amount must be a positive number.')
  if (amount > config.maxUsdcDeposit) {
    return fail(`Bridge amount ${amount} exceeds ARENA_MAX_USDC_DEPOSIT (${config.maxUsdcDeposit}).`)
  }
  if (amount < 6) {
    return fail('Bridge amount must be at least 6 USDC for perp_deposit.')
  }
  if (!config.acpBin) {
    return fail('ARENA_ACP_BIN is not configured (needed for ACP bridge jobs).')
  }

  const createCommand = buildAcpCommand(config, [
    'client',
    'create-job',
    '--provider',
    '0xd478a8B40372db16cA8045F28C6FE07228F3781A',
    '--offering-name',
    'perp_deposit',
    '--requirements',
    JSON.stringify({ amount: String(amount) }),
    '--legacy',
    '--json',
  ])
  const createRun = await runCommand(createCommand, config)
  auditLog('bridge_create_job', {
    ok: createRun.ok,
    dryRun: createRun.dryRun,
    amountUsd: amount,
  })

  if (!createRun.ok) {
    if (isAcpSessionExpired(createRun)) {
      return fail(
        'ACP session expired on the runtime. Operator action required: run `acp configure` in the same ACP state dir (`ARENA_ACP_HOME`) used by Hermit, then retry `/arena bridge <amount>`.',
        { run: createRun },
      )
    }
    return fail(
      'Bridge job creation failed. Ensure ACP auth/signer is configured and retry `/arena bridge <amount>`.',
      { run: createRun },
    )
  }

  if (createRun.dryRun) {
    return {
      ok: true,
      message: `Bridge dry-run prepared for ${amount} USDC (Base -> Hyperliquid). After funds land, run \`/arena sweep <amount>\`.`,
      run: createRun,
      details: { amountUsd: amount, stage: 'create-job-dry-run' },
    }
  }

  const parsedCreate = parseAcpJobCreateOutput(createRun)
  const jobId = parsedCreate.jobId
  if (!jobId) {
    return fail(
      'Bridge job was created but no job id was parsed. Re-run `/arena bridge <amount>` or create/fund manually via ACP.',
      { run: createRun },
    )
  }

  const fundCommand = buildAcpCommand(config, ['client', 'fund', '--job-id', jobId, '--json'])
  const fundRun = await runCommand(fundCommand, config)
  auditLog('bridge_fund_job', {
    ok: fundRun.ok,
    dryRun: fundRun.dryRun,
    amountUsd: amount,
    jobId,
  })

  if (!fundRun.ok) {
    if (isAcpSessionExpired(fundRun)) {
      return fail(
        `Bridge job ${jobId} was created, but ACP session expired before funding. Operator action required: run \`acp configure\` in runtime ACP state, then re-run \`acp client fund --job-id ${jobId} --json\` or retry \`/arena bridge <amount>\`.`,
        { run: fundRun, jobId, createRun },
      )
    }
    return fail(
      `Bridge job ${jobId} created, but funding failed. Retry: \`acp client fund --job-id ${jobId} --json\`.`,
      { run: fundRun, jobId, createRun },
    )
  }

  const lines = [
    `Bridge started: ${amount} USDC Base -> Hyperliquid.`,
    `Job id: ${jobId}`,
    'Typical SLA is ~30 minutes. Once funds land in HL spot, run `/arena sweep <amount>`.',
  ]
  return {
    ok: true,
    message: lines.join('\n'),
    run: fundRun,
    details: {
      amountUsd: amount,
      jobId,
      flow: 'perp_deposit_bridge',
    },
  }
}

export async function runArenaDepositUsdc(amountUsd: number, config = readArenaConfig()): Promise<ArenaOpResult> {
  return runArenaBridgeToHyperliquid(amountUsd, config)
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
    // dgclaw v2 trade.ts only accepts flag-style options; positional args are silently ignored.
    // Optional sizeUsd makes this a partial reduce-only close (repo-patched
    // dgclaw `close --size`); omitted = full close.
    const closeSizeUsd = parsePositiveNumber(request.sizeUsd ?? 0)
    const closeArgs = ['close', '--pair', pairCheck.normalizedPair]
    if (closeSizeUsd > 0) closeArgs.push('--size', String(closeSizeUsd))
    const command = buildNodeScriptCommand(config, 'scripts/trade.ts', closeArgs)
    const run = await runCommand(command, config)
    auditLog('trade_close', {
      ok: run.ok,
      dryRun: run.dryRun,
      pair: pairCheck.normalizedPair,
      market: pairCheck.market,
      ...(closeSizeUsd > 0 ? { partialSizeUsd: closeSizeUsd } : {}),
    })
    return {
      ok: run.ok,
      message: run.ok
        ? `${closeSizeUsd > 0 ? 'Partial close' : 'Close'} submitted for ${pairCheck.normalizedPair}.`
        : 'Close trade failed.',
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
    '--pair',
    pairCheck.normalizedPair,
    '--side',
    side,
    '--size',
    String(sizeUsd),
    '--leverage',
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

/**
 * Moves USDC between the agent wallet's spot and perp accounts via the
 * repo-patched dgclaw `transfer` command (Hyperliquid usdClassTransfer).
 * ACP-signed master-wallet lane only — the API-wallet override is rejected by
 * trade.ts because user-signed actions move funds on the signing account.
 */
export async function runArenaSpotPerpTransfer(
  params: { amountUsd: number; toPerp?: boolean },
  config = readArenaConfig(),
): Promise<ArenaOpResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  if (!config.tradingEnabled) {
    return fail('Arena trading is disabled. Set ARENA_TRADING_ENABLED=1 to transfer.')
  }

  const amount = parsePositiveNumber(params.amountUsd)
  if (amount <= 0) return fail('Transfer amount must be a positive number.')
  const toPerp = params.toPerp !== false

  const command = buildNodeScriptCommand(config, 'scripts/trade.ts', [
    'transfer',
    '--amount',
    String(amount),
    '--to',
    toPerp ? 'perp' : 'spot',
  ])
  const run = await runCommand(command, config)
  auditLog('spot_perp_transfer', { ok: run.ok, dryRun: run.dryRun, amountUsd: amount, toPerp })
  return {
    ok: run.ok,
    message: run.ok
      ? `Transferred ${amount} USDC ${toPerp ? 'spot -> perp' : 'perp -> spot'}.`
      : 'Spot/perp transfer failed.',
    run,
  }
}

function ensureCreationEnabled(config: ArenaConfig): ArenaOpResult | null {
  if (!config.creationEnabled) {
    return fail('Arena agent creation is disabled. Set ARENA_CREATION_ENABLED=1 (or leave default true when ARENA_ENABLED=1).')
  }
  return null
}

export async function runArenaCreateAgent(config = readArenaConfig(), ownerAddress?: string): Promise<ArenaCreateResult> {
  const baseValidation = ensureArenaEnabled(config)
  if (baseValidation) return baseValidation
  const creationValidation = ensureCreationEnabled(config)
  if (creationValidation) return creationValidation
  if (!config.acpBin) {
    return fail('ARENA_ACP_BIN is not configured (needed for acp agent create).')
  }

  // Support for rotating the runtime ACP session so that `acp agent create` (the no-args
  // /arena register default path) creates the agent under a specific ACP identity (e.g. the
  // user's 0x64c3... for true ownership on the Virtuals/ACP dashboard).
  // Set ACP_ACCESS_TOKEN, ACP_REFRESH_TOKEN, ACP_OWNER_WALLET on the service (values
  // obtained from local `acp configure` while connected as the desired wallet), redeploy,
  // then the create will first run headless `acp configure` to switch the local storage,
  // then create under that session.
  // After use, rotate the ACP_* envs back and redeploy to avoid leaving personal tokens.
  //
  // Note on refresh: Unlike Alfaclub (where we manage a custom JWT and need explicit
  // runtime rotation via chat-token-refresh because every call needs a fresh JWT we control),
  // the acp CLI has built-in refresh (resolveToken + refreshCliToken). Once storage is
  // initialized with a valid access+refresh pair, acp commands auto-refresh the short-lived
  // access token using the refresh_token and update local storage. You only need to re-rotate
  // the envs when the refresh_token itself expires. No extra "refresh thing" in our code for now.
  const acpAccess = String(process.env.ACP_ACCESS_TOKEN ?? '').trim()
  const acpRefresh = String(process.env.ACP_REFRESH_TOKEN ?? '').trim()
  const configuredAcpOwner = normalizeAddress(process.env.ACP_OWNER_WALLET)
  const ownerAddressFallback = normalizeAddress(ownerAddress)
  const acpOwner = configuredAcpOwner ?? ownerAddressFallback ?? ''
  const hasAnyAcpRotationEnv = Boolean(acpAccess || acpRefresh || acpOwner)
  const hasAllAcpRotationEnv = Boolean(acpAccess && acpRefresh && acpOwner)
  if (hasAnyAcpRotationEnv && !hasAllAcpRotationEnv) {
    const missing: string[] = []
    if (!acpAccess) missing.push('ACP_ACCESS_TOKEN')
    if (!acpRefresh) missing.push('ACP_REFRESH_TOKEN')
    if (!acpOwner) missing.push('ACP_OWNER_WALLET')
    return fail(
      `ACP session rotation env is partially configured. Missing: ${missing.join(', ')}. Refusing to continue with agent create.`,
    )
  }

  if (!configuredAcpOwner && ownerAddressFallback && acpAccess && acpRefresh) {
    auditLog('acp_session_rotation_owner_fallback', {
      ownerAddressFallback,
    })
  }

  if (hasAllAcpRotationEnv && isEnvSeedConsumed()) {
    // The env triplet already seeded this state dir once. ACP refresh tokens are
    // single-use, so re-running configure with it would overwrite the rotated
    // (live) on-volume session with dead tokens — the create proceeds under the
    // current session instead, which is the identity that triplet established.
    auditLog('acp_session_rotation_skipped_consumed_seed', {
      owner: acpOwner,
      dryRun: config.dryRun,
    })
  } else if (hasAllAcpRotationEnv) {
    const configureArgs = [
      'configure',
      '--token', acpAccess,
      '--refresh-token', acpRefresh,
      '--wallet', acpOwner,
    ]
    const configureCommand = buildAcpCommand(config, configureArgs)
    const configureRun = await runCommand(configureCommand, config)
    auditLog('acp_session_rotation', {
      ok: configureRun.ok,
      owner: acpOwner,
      dryRun: config.dryRun,
    })
    if (!configureRun.ok) {
      return {
        ok: false,
        message: 'acp configure failed; refusing to run agent create under a potentially stale ACP session.',
        run: configureRun,
      }
    }
    const rotationFingerprint = computeAcpSeedFingerprint()
    if (rotationFingerprint && !config.dryRun) {
      markAcpSeedConsumed(rotationFingerprint)
    }
  }

  // Note: buildAcpCommand + buildArenaCommandEnv will inject any currently resolved
  // ARENA_AGENT_ID / ARENA_AGENT_WALLET_ADDRESS etc. into the child env.
  // Do NOT pass `--owner` here: the official acp-cli "agent create" (per
  // Virtual-Protocol/acp-cli source) only supports --name/--description/--image/--signer
  // and hard-fails on unknown options. Ownership/creator (userId on the Agent) is
  // determined by the ACP auth session under which the CLI runs — that is what the
  // `acp configure` session-rotation block above establishes (ACP_OWNER_WALLET +
  // headless tokens, with ownerAddress as the wallet fallback).
  // The created agent always gets a fresh provisioned walletAddress used for on-chain
  // identity + arena/HL signing. Full per-Alfa-EOA "owned by this wallet" dashboard
  // association on Virtuals/ACP typically requires web create/claim at app.virtuals.io
  // while the Alfa sender is the connected/auth'd identity for that ACP user.
  const args = ['agent', 'create']
  const command = buildAcpCommand(config, args)
  const run = await runCommand(command, config)
  auditLog('create_agent', {
    ok: run.ok,
    dryRun: run.dryRun,
    command: command.command,
    args: command.args,
  })

  const parsed = parseAcpAgentCreateOutput(run.stdout || '')
  const base: ArenaCreateResult = {
    ok: run.ok,
    message: run.ok
      ? (run.dryRun ? 'Dry-run: would create agent via acp (no execution).' : 'Agent create submitted via acp.')
      : 'acp agent create failed.',
    run,
  }
  if (parsed.agentId) base.agentId = parsed.agentId
  if (parsed.agentWalletAddress) base.agentWalletAddress = parsed.agentWalletAddress
  if (parsed.hlApiWalletAddress) base.hlApiWalletAddress = parsed.hlApiWalletAddress
  if (!run.ok && run.stdout) {
    // Sanitize before attaching to result (may surface in logs or error details)
    const sanitized = run.stdout.replace(/\/[^\s"]*dgclaw[^\s"]*/gi, '[dgclaw-path]').slice(0, 400)
    ;(base as any).details = { ...(base.details || {}), stdoutPreview: sanitized }
  }
  return base
}
