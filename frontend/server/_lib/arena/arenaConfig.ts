import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ALLOWED_ROOM_IDS = ['1659']
const DEFAULT_ARENA_AGENT_ID = '019e82af-2e66-7645-af23-69e9f14351f4'
const DEFAULT_ARENA_AGENT_WALLET_ADDRESS = '0x30068c6bccf43e9eb5cdb68fb978f32f744d870c'
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000
const DEFAULT_MAX_USDC_DEPOSIT = 50_000
const DEFAULT_MAX_TRADE_SIZE_USD = 100_000

export type ArenaConfig = {
  enabled: boolean
  tradingEnabled: boolean
  creationEnabled: boolean
  dryRun: boolean
  agentId: string | null
  agentWalletAddress: string | null
  hlApiWalletAddress: string | null
  commandTimeoutMs: number
  maxUsdcDeposit: number
  maxTradeSizeUsd: number
  allowedRoomIds: string[]
  dgclawDir: string | null
  dgclawBin: string
  acpBin: string
  nodeRunnerBin: string
  hip3PrefixRequired: boolean
  assetAllowlist: Set<string> | null
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  if (Number.isFinite(value) && value > 0) return value
  logger.warn('[arena] invalid positive int env; using fallback', {
    name,
    raw,
    fallback,
  })
  return fallback
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  if (Number.isFinite(value) && value > 0) return value
  logger.warn('[arena] invalid positive number env; using fallback', {
    name,
    raw,
    fallback,
  })
  return fallback
}

function readCsv(name: string): string[] {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeAssetSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function readOptionalString(name: string): string | null {
  const raw = String(process.env[name] ?? '').trim()
  return raw.length > 0 ? raw : null
}

function normalizeAddressOrNull(value: string | null): string | null {
  if (!value) return null
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null
}

export function readArenaConfig(): ArenaConfig {
  const enabled = readBool('ARENA_ENABLED', false)
  const tradingEnabled = readBool('ARENA_TRADING_ENABLED', false)
  const creationEnabled = readBool('ARENA_CREATION_ENABLED', true)
  const dryRun = readBool('ARENA_DRY_RUN', true)
  const agentId = readOptionalString('ARENA_AGENT_ID') ?? DEFAULT_ARENA_AGENT_ID
  const agentWalletAddress =
    normalizeAddressOrNull(readOptionalString('ARENA_AGENT_WALLET_ADDRESS')) ??
    DEFAULT_ARENA_AGENT_WALLET_ADDRESS
  const hlApiWalletAddress = normalizeAddressOrNull(readOptionalString('ARENA_HL_API_WALLET_ADDRESS'))
  const commandTimeoutMs = readPositiveInt('ARENA_COMMAND_TIMEOUT_MS', DEFAULT_COMMAND_TIMEOUT_MS)
  const maxUsdcDeposit = readPositiveNumber('ARENA_MAX_USDC_DEPOSIT', DEFAULT_MAX_USDC_DEPOSIT)
  const maxTradeSizeUsd = readPositiveNumber('ARENA_MAX_TRADE_SIZE_USD', DEFAULT_MAX_TRADE_SIZE_USD)
  const allowedRoomIds = readCsv('ARENA_ALLOWED_ROOM_IDS')
  const dgclawDir = String(process.env.ARENA_DGCLAW_DIR ?? '').trim() || null
  const dgclawBin = String(process.env.ARENA_DGCLAW_BIN ?? './dgclaw.sh').trim() || './dgclaw.sh'
  const acpBin = String(process.env.ARENA_ACP_BIN ?? 'acp').trim() || 'acp'
  const nodeRunnerBin = String(process.env.ARENA_NODE_RUNNER_BIN ?? 'npx').trim() || 'npx'
  const hip3PrefixRequired = readBool('ARENA_HIP3_PREFIX_REQUIRED', true)
  const allowlistRaw = readCsv('ARENA_ASSET_ALLOWLIST')
  const assetAllowlist =
    allowlistRaw.length > 0
      ? new Set(allowlistRaw.map(normalizeAssetSymbol))
      : null

  return {
    enabled,
    tradingEnabled,
    creationEnabled,
    dryRun,
    agentId,
    agentWalletAddress,
    hlApiWalletAddress,
    commandTimeoutMs,
    maxUsdcDeposit,
    maxTradeSizeUsd,
    allowedRoomIds: allowedRoomIds.length > 0 ? allowedRoomIds : [...DEFAULT_ALLOWED_ROOM_IDS],
    dgclawDir,
    dgclawBin,
    acpBin,
    nodeRunnerBin,
    hip3PrefixRequired,
    assetAllowlist,
  }
}

export function arenaCommandAllowedForRoom(roomId: string | null | undefined, config = readArenaConfig()): boolean {
  if (!roomId) return false
  return config.allowedRoomIds.includes(String(roomId).trim())
}
