import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { logger } from '../infra/logger.js'
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
    env: buildArenaCommandEnv(config),
  }
}

function buildNodeScriptCommand(config: ArenaConfig, scriptRelPath: string, args: string[]): BuiltCommand {
  return {
    command: config.nodeRunnerBin,
    args: ['ts-node', scriptRelPath, ...args],
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
  const env: Record<string, string> = {}
  if (config.agentId) env.ARENA_AGENT_ID = config.agentId
  if (config.agentWalletAddress) env.ARENA_AGENT_WALLET_ADDRESS = config.agentWalletAddress
  if (config.hlApiWalletAddress) env.ARENA_HL_API_WALLET_ADDRESS = config.hlApiWalletAddress
  return env
}

function parsePositiveNumber(input: number, fallback = 0): number {
  return Number.isFinite(input) && input > 0 ? input : fallback
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
  const acpAccess = process.env.ACP_ACCESS_TOKEN
  const acpRefresh = process.env.ACP_REFRESH_TOKEN
  const acpOwner = process.env.ACP_OWNER_WALLET
  if (acpAccess && acpRefresh && acpOwner) {
    const configureArgs = [
      'configure',
      '--token', acpAccess,
      '--refresh-token', acpRefresh,
      '--wallet', acpOwner,
    ]
    const configureCommand = buildAcpCommand(config, configureArgs)
    await runCommand(configureCommand, config)
    auditLog('acp_session_rotation', {
      owner: acpOwner,
      dryRun: config.dryRun,
    })
  }

  // Note: buildAcpCommand + buildArenaCommandEnv will inject any currently resolved
  // ARENA_AGENT_ID / ARENA_AGENT_WALLET_ADDRESS etc. into the child env.
  // If ownerAddress is passed, we append `--owner <address>` to the `acp agent create` args
  // (best-effort; the official acp-cli "agent create" per Virtual-Protocol/acp-cli source
  // only supports --name/--description/--image/--signer and does not declare --owner.
  // Ownership/creator (userId on the Agent) is determined by the ACP auth session under
  // which the CLI runs — see ACP_OWNER_WALLET + headless tokens from `acp configure`).
  // The created agent always gets a fresh provisioned walletAddress used for on-chain
  // identity + arena/HL signing. Full per-Alfa-EOA "owned by this wallet" dashboard
  // association on Virtuals/ACP typically requires web create/claim at app.virtuals.io
  // while the Alfa sender is the connected/auth'd identity for that ACP user.
  const args = ['agent', 'create']
  if (ownerAddress) {
    args.push('--owner', ownerAddress)
  }
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
