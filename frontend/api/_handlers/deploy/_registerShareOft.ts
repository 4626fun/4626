import type { VercelRequest, VercelResponse } from '@vercel/node'

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

import { createPublicClient, createWalletClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { logger } from '../../../server/_lib/logger.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
import { readDeployAuthFromRequest } from '../../../server/_lib/deployAuth.js'
import { resolveMeteoraAlphaVaultConfig } from '../../../server/_lib/meteoraAlphaVaultConfig.js'

type RegisterSolanaBridgeTokenRequest = {
  shareOft?: string
  bridgeToken?: string
  batcherAddress?: string
  solanaMint?: string
  solanaDecimals?: number | string
  creatorToken?: string
  expectedSolanaAmount?: string | number
  shareDecimals?: number | string
  buildOnly?: boolean
}

type SolanaBridgeIxPayload = {
  programId: Hex
  serializedAccounts: Hex[]
  data: Hex
}

type RegisterSolanaBridgeTokenResponse = {
  shareOft: Address
  bridgeToken: Address
  batcher: Address
  adapter: Address
  destination: Hex
  adapterOwner: Address
  signer: Address | null
  registered: boolean
  txHash: Hex | null
  solanaMint: Hex | null
  solanaDecimals: number | null
  meteoraAlphaVault: Hex | null
  solanaIxs: SolanaBridgeIxPayload[]
}

type WrapRunner = {
  bin: string
  args: string[]
  label: string
}

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
const execFileAsync = promisify(execFile)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((ch, idx) => [ch, idx]))

const CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const SOLANA_BRIDGE_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaMintToToken',
    stateMutability: 'view',
    inputs: [{ name: 'mint', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'registerToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'baseToken', type: 'address' },
      { name: 'solanaMint', type: 'bytes32' },
      { name: 'solanaDecimals', type: 'uint8' },
    ],
    outputs: [],
  },
] as const

const BASE_SOLANA_BRIDGE_ABI = [
  {
    type: 'function',
    name: 'scalars',
    stateMutability: 'view',
    inputs: [
      { name: 'localToken', type: 'address' },
      { name: 'remoteToken', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ERC20_METADATA_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

function isBytes32Hex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function readSolanaMintFromEnv(): Hex | null {
  const candidates = [
    process.env.SOLANA_DEFAULT_MINT_BYTES32,
    process.env.SOLANA_MINT_BYTES32,
    process.env.SOLANA_SHARE_OFT_DEFAULT_MINT,
  ]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (isBytes32Hex(v) && v.toLowerCase() !== ZERO_BYTES32.toLowerCase()) {
      return v as Hex
    }
  }
  return null
}

function parseDecimals(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const n = Number(value.trim())
    if (Number.isFinite(n) && n >= 0 && n <= 255) return Math.floor(n)
  }
  return null
}

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = BigInt(value.trim())
      return parsed >= 0n ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function toRemoteAmountExact(baseAmount: bigint, baseDecimals: number, solanaDecimals: number): bigint {
  if (baseAmount <= 0n) throw new Error('invalid_base_amount')
  if (baseDecimals === solanaDecimals) return baseAmount
  if (solanaDecimals > baseDecimals) {
    const diff = BigInt(solanaDecimals - baseDecimals)
    const factor = 10n ** diff
    return baseAmount * factor
  }
  const diff = BigInt(baseDecimals - solanaDecimals)
  const factor = 10n ** diff
  if (baseAmount % factor !== 0n) {
    throw new Error('base_amount_not_exactly_convertible_to_remote_units')
  }
  return baseAmount / factor
}

function readSolanaDecimalsFromEnv(): number {
  const candidates = [
    process.env.SOLANA_DEFAULT_MINT_DECIMALS,
    process.env.SOLANA_MINT_DECIMALS,
  ]
  for (const c of candidates) {
    const parsed = parseDecimals(c)
    if (parsed !== null) return parsed
  }
  return 9
}

function readRegistrationSignerPk(): Hex | null {
  const candidates = [
    process.env.SOLANA_ADAPTER_OWNER_PRIVATE_KEY,
    process.env.KEEPR_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(v)) return v as Hex
  }
  return null
}

function readDynamicSolanaRouteEnabled(): boolean {
  const v = String(
    process.env.SOLANA_DYNAMIC_ROUTE_ENABLED ??
      process.env.SOLANA_BRIDGE_DYNAMIC_WRAP ??
      '',
  )
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function splitUrlList(raw: string): string[] {
  return raw
    .split(/[,\n\r\t ]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function readDynamicProvisionerUrls(): string[] {
  const listEnv = String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_URLS ??
      process.env.SOLANA_BRIDGE_PROVISIONER_URLS ??
      '',
  ).trim()
  const singleEnv = String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL ??
      process.env.SOLANA_BRIDGE_PROVISIONER_URL ??
      '',
  ).trim()
  const combined = [...splitUrlList(listEnv), ...splitUrlList(singleEnv)]
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of combined) {
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function readDynamicProvisionerSecret(): string {
  return String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET ??
      process.env.SOLANA_BRIDGE_PROVISIONER_SECRET ??
      '',
  ).trim()
}

function readDynamicProvisionerHealthUrl(provisionerUrl: string): string {
  const env = String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL ??
      process.env.SOLANA_BRIDGE_PROVISIONER_HEALTH_URL ??
      '',
  ).trim()
  if (env) return env
  try {
    const url = new URL(provisionerUrl)
    url.pathname = '/healthz'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function readDynamicProvisionerHealthUrls(provisionerUrls: string[]): string[] {
  const listEnv = String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URLS ??
      process.env.SOLANA_BRIDGE_PROVISIONER_HEALTH_URLS ??
      '',
  ).trim()
  const explicit = splitUrlList(listEnv)
  if (explicit.length > 0) return explicit
  return provisionerUrls.map((url) => readDynamicProvisionerHealthUrl(url))
}

function toMeteoraIxsEndpoint(urlRaw: string): string {
  try {
    const url = new URL(urlRaw)
    url.pathname = '/meteora-ixs'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function readMeteoraProvisionerUrls(dynamicProvisionerUrls: string[]): string[] {
  const listEnv = String(process.env.METEORA_IX_PROVISIONER_URLS ?? '').trim()
  const singleEnv = String(process.env.METEORA_IX_PROVISIONER_URL ?? '').trim()
  const explicit = [...splitUrlList(listEnv), ...splitUrlList(singleEnv)]
  const source = explicit.length > 0 ? explicit : dynamicProvisionerUrls.map((url) => toMeteoraIxsEndpoint(url)).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of source) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function readMeteoraProvisionerSecret(): string {
  return String(process.env.METEORA_IX_PROVISIONER_SECRET ?? readDynamicProvisionerSecret()).trim()
}

async function readShareOftMetadata(params: {
  publicClient: any
  shareOft: Address
}): Promise<{ name: string; symbol: string } | null> {
  try {
    const [nameRaw, symbolRaw] = await Promise.all([
      params.publicClient.readContract({
        address: params.shareOft,
        abi: ERC20_METADATA_ABI,
        functionName: 'name',
      }),
      params.publicClient.readContract({
        address: params.shareOft,
        abi: ERC20_METADATA_ABI,
        functionName: 'symbol',
      }),
    ])
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
    const symbol = typeof symbolRaw === 'string' ? symbolRaw.trim() : ''
    if (!name || !symbol) return null
    return { name, symbol }
  } catch {
    return null
  }
}

const WRAP_TOKEN_NAME_MAX_LENGTH = 32
const WRAP_TOKEN_SYMBOL_MAX_LENGTH = 12
type WrapTokenSymbolMode = 'auto' | 'unicode' | 'ascii'

function sanitizeWrapTokenName(raw: string, shareOft: Address): string {
  const fallback = `CreatorShare-${shareOft.slice(2, 8)}`
  const ascii = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const resolved = ascii || fallback
  return resolved.slice(0, WRAP_TOKEN_NAME_MAX_LENGTH)
}

function readWrapTokenSymbolMode(): WrapTokenSymbolMode {
  const raw = String(process.env.SOLANA_BRIDGE_WRAP_SYMBOL_MODE ?? 'auto')
    .trim()
    .toLowerCase()
  if (raw === 'unicode' || raw === 'ascii' || raw === 'auto') return raw
  return 'auto'
}

function sanitizeWrapTokenSymbolUnicode(raw: string, shareOft: Address): string {
  const fallback = `■${shareOft.slice(2, 6).toUpperCase()}`
  const normalized = String(raw ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/\s+/g, '')
  const cleaned = normalized.replace(/[^A-Z0-9■]/g, '')
  const resolved = cleaned || fallback
  return resolved.slice(0, WRAP_TOKEN_SYMBOL_MAX_LENGTH)
}

function sanitizeWrapTokenSymbolAscii(raw: string, shareOft: Address): string {
  const fallbackPrefixRaw = process.env.SOLANA_BRIDGE_WRAP_SYMBOL_PREFIX
  const fallbackPrefix = (fallbackPrefixRaw === undefined ? 'CS' : String(fallbackPrefixRaw))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const fallback = `${fallbackPrefix}${shareOft.slice(2, 6).toUpperCase()}`
  const cleaned = String(raw ?? '')
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const resolved = cleaned || fallback
  return resolved.slice(0, WRAP_TOKEN_SYMBOL_MAX_LENGTH)
}

function buildWrapTokenSymbolCandidates(raw: string, shareOft: Address): string[] {
  const mode = readWrapTokenSymbolMode()
  const unicode = sanitizeWrapTokenSymbolUnicode(raw, shareOft)
  const ascii = sanitizeWrapTokenSymbolAscii(raw, shareOft)
  const out: string[] = []
  const pushUnique = (value: string): void => {
    if (!value || out.includes(value)) return
    out.push(value)
  }
  if (mode === 'unicode') pushUnique(unicode)
  else if (mode === 'ascii') pushUnique(ascii)
  else {
    pushUnique(unicode)
    pushUnique(ascii)
  }
  return out
}

function isLikelyUnicodeSymbolUnsupportedError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('utf-8') ||
    lower.includes('utf8') ||
    lower.includes('unicode') ||
    lower.includes('invalid symbol') ||
    lower.includes('symbol is invalid') ||
    lower.includes('invalid metadata') ||
    lower.includes('invalid character') ||
    // ConstraintSeeds (#2006) fires when the Solana bridge program derives the
    // mint PDA from ASCII-only bytes of the symbol but the client passed the
    // PDA computed from the raw Unicode symbol (e.g. "■AKITA" vs "AKITA").
    lower.includes('constraintseeds') ||
    lower.includes('seeds constraint was violated') ||
    lower.includes('a seeds constraint') ||
    lower.includes('error code: constraintseeds') ||
    lower.includes('error number: 2006')
  )
}

function buildWrapTokenMetadata(metadata: { name: string; symbol: string }, shareOft: Address): {
  tokenName: string
  tokenSymbolCandidates: string[]
  tokenNameSource: string
  tokenSymbolSource: string
} {
  const originalName = String(metadata.name ?? '').trim()
  const originalSymbol = String(metadata.symbol ?? '').trim()
  const tokenName = sanitizeWrapTokenName(originalName, shareOft)
  const tokenSymbolCandidates = buildWrapTokenSymbolCandidates(originalSymbol, shareOft)
  const primarySymbol = tokenSymbolCandidates[0] ?? ''
  const tokenNameSource = tokenName === originalName ? 'base_shareoft' : 'base_shareoft_sanitized'
  const tokenSymbolSource = primarySymbol === originalSymbol
    ? 'base_shareoft'
    : primarySymbol.includes('■')
      ? 'base_shareoft_unicode_sanitized'
      : 'base_shareoft_ascii_sanitized'
  return { tokenName, tokenSymbolCandidates, tokenNameSource, tokenSymbolSource }
}

function describeFetchFailure(error: unknown): string {
  if (error instanceof Error) {
    const parts: string[] = []
    if (error.name) parts.push(error.name)
    if (error.message) parts.push(error.message)
    const cause = (error as any).cause
    const causeCode = cause && typeof cause === 'object' ? (cause as any).code : undefined
    const causeMessage =
      cause && typeof cause === 'object' && typeof (cause as any).message === 'string'
        ? String((cause as any).message)
        : ''
    if (causeCode) parts.push(`cause.code=${String(causeCode)}`)
    if (causeMessage) parts.push(`cause.message=${causeMessage}`)
    return parts.join(' | ') || 'Unknown fetch error'
  }
  return String(error ?? 'Unknown fetch error')
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(String(value).trim(), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function readProvisionerRetryAttempts(): number {
  const attempts = parseEnvInt(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_ATTEMPTS, 3)
  return Math.min(Math.max(attempts, 1), 8)
}

function readProvisionerRetryDelayMs(): number {
  const delayMs = parseEnvInt(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_DELAY_MS, 1_200)
  return Math.max(delayMs, 0)
}

function readProvisionerRequestTimeoutMs(): number {
  const timeoutMs = parseEnvInt(process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_TIMEOUT_MS, 90_000)
  return Math.min(Math.max(timeoutMs, 10_000), 300_000)
}

function isRetryableRemoteProvisionError(message: string): boolean {
  const lower = message.toLowerCase()
  const statusMatch = lower.match(/status=(\d{3})/)
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : null
  if (status !== null && (status === 408 || status === 425 || status === 429 || status >= 500)) {
    return true
  }
  return (
    lower.includes('blockhash not found') ||
    lower.includes('transaction simulation failed') ||
    lower.includes('fetch failed') ||
    lower.includes('aborterror') ||
    lower.includes('operation was aborted') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound')
  )
}

function decodeBase58(value: string): Uint8Array {
  if (!value || typeof value !== 'string') throw new Error('Invalid base58 input')
  let num = 0n
  for (const ch of value.trim()) {
    const idx = BASE58_MAP.get(ch)
    if (idx === undefined) throw new Error(`Invalid base58 character: ${ch}`)
    num = num * 58n + BigInt(idx)
  }
  let hex = num.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  let bytes = hex ? Uint8Array.from(Buffer.from(hex, 'hex')) : new Uint8Array()
  let leadingZeroes = 0
  for (const ch of value) {
    if (ch === '1') leadingZeroes += 1
    else break
  }
  if (leadingZeroes > 0) {
    const prefixed = new Uint8Array(leadingZeroes + bytes.length)
    prefixed.set(bytes, leadingZeroes)
    bytes = prefixed
  }
  return bytes
}

function solanaPubkeyToBytes32Hex(pubkey: string): Hex {
  const decoded = decodeBase58(pubkey)
  if (decoded.length !== 32) {
    throw new Error(`Expected 32-byte Solana pubkey, got ${decoded.length} bytes`)
  }
  return `0x${Buffer.from(decoded).toString('hex')}` as Hex
}

function parseMintPubkeyFromWrapOutput(text: string): string | null {
  const match = text.match(/Mint:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

function buildWrapRunnerList(cliBinRaw: string, wrapArgs: string[], cliDir: string): WrapRunner[] {
  const normalized = cliBinRaw.trim().toLowerCase()
  const runners: WrapRunner[] = []
  const pushUnique = (runner: WrapRunner): void => {
    if (!runners.some((r) => r.bin === runner.bin && r.args.join('\u0000') === runner.args.join('\u0000'))) {
      runners.push(runner)
    }
  }

  const pushDefaultFallbacks = (): void => {
    const bunEntrypoint = `${cliDir}/src/bin.ts`
    const hasBunEntrypoint = existsSync(bunEntrypoint)
    const home = String(process.env.HOME ?? '').trim()
    const homeBun = home ? `${home}/.bun/bin/bun` : ''
    if (hasBunEntrypoint) {
      if (homeBun && existsSync(homeBun)) {
        pushUnique({ bin: homeBun, args: ['run', 'src/bin.ts', ...wrapArgs], label: `${homeBun} run src/bin.ts` })
      }
      pushUnique({ bin: 'bun', args: ['run', 'src/bin.ts', ...wrapArgs], label: 'bun run src/bin.ts' })
    }
    if (homeBun && existsSync(homeBun)) {
      pushUnique({ bin: homeBun, args: ['cli', ...wrapArgs], label: `${homeBun} cli` })
    }
    pushUnique({ bin: 'bun', args: ['cli', ...wrapArgs], label: 'bun cli' })
    pushUnique({ bin: 'pnpm', args: ['run', 'cli', '--', ...wrapArgs], label: 'pnpm run cli --' })
    pushUnique({ bin: 'npm', args: ['run', 'cli', '--', ...wrapArgs], label: 'npm run cli --' })
    pushUnique({ bin: 'cli', args: wrapArgs, label: 'cli' })
  }

  if (!normalized || normalized === 'auto') {
    pushDefaultFallbacks()
    return runners
  }
  if (normalized === 'bun' || normalized.endsWith('/bun')) {
    const hasBunEntrypoint = existsSync(`${cliDir}/src/bin.ts`)
    if (hasBunEntrypoint) {
      pushUnique({ bin: cliBinRaw, args: ['run', 'src/bin.ts', ...wrapArgs], label: `${cliBinRaw} run src/bin.ts` })
    }
    pushUnique({ bin: 'bun', args: ['cli', ...wrapArgs], label: 'bun cli' })
    pushDefaultFallbacks()
    return runners
  }
  if (normalized === 'pnpm') {
    pushUnique({ bin: 'pnpm', args: ['run', 'cli', '--', ...wrapArgs], label: 'pnpm run cli --' })
    return runners
  }
  if (normalized === 'npm') {
    pushUnique({ bin: 'npm', args: ['run', 'cli', '--', ...wrapArgs], label: 'npm run cli --' })
    return runners
  }
  if (normalized === 'cli') {
    pushUnique({ bin: 'cli', args: wrapArgs, label: 'cli' })
    return runners
  }

  pushUnique({ bin: cliBinRaw, args: ['cli', ...wrapArgs], label: `${cliBinRaw} cli` })
  return runners
}

function toErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const err = error as { message?: string; stderr?: string; stdout?: string }
  return [err.message, err.stderr, err.stdout].filter(Boolean).join('\n')
}

function isRunnerUnavailable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  if (code === 'ENOENT') return true
  const text = toErrorText(error).toLowerCase()
  return (
    text.includes('enoent') ||
    text.includes('command not found') ||
    text.includes('bun: not found') ||
    text.includes('not recognized as an internal or external command') ||
    text.includes('missing script: cli') ||
    text.includes('none of the selected packages has a "cli" script')
  )
}

async function runWrapToken(cliDir: string, cliBinRaw: string, wrapArgs: string[]): Promise<{ output: string; runner: string }> {
  const runners = buildWrapRunnerList(cliBinRaw, wrapArgs, cliDir)
  const failures: string[] = []

  for (const runner of runners) {
    try {
      const { stdout, stderr } = await execFileAsync(runner.bin, runner.args, {
        cwd: cliDir,
        timeout: 20 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
      })
      return { output: `${stdout ?? ''}\n${stderr ?? ''}`, runner: runner.label }
    } catch (error) {
      failures.push(`${runner.label}: ${toErrorText(error)}`)
      if (!isRunnerUnavailable(error)) throw error
    }
  }

  throw new Error(
    `No usable bridge CLI runner found. Configure SOLANA_BRIDGE_CLI_BIN or install one of: bun, pnpm, npm, cli. Details: ${failures.join(' | ')}`,
  )
}

async function tryProvisionDynamicRoute(params: {
  shareOft: Address
  // When provided, wrap and register the Creator Coin on Solana instead of the
  // ShareOFT receipt token. The Creator Coin has a clean ASCII symbol (e.g. "AKITA"
  // vs "■AKITA"), avoids ConstraintSeeds issues, and is the primary tradeable token
  // that Solana users actually want to hold.
  bridgeToken?: Address
  solanaDecimals: number
  publicClient: any
}): Promise<Hex | null> {
  if (!readDynamicSolanaRouteEnabled()) return null

  const bridgeToken = params.bridgeToken ?? params.shareOft

  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'auto').trim() || 'auto'
  const deployEnv = String(process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet'
  const payerKp = String(process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  const scalerExponent = parseDecimals(process.env.SOLANA_BRIDGE_SCALER_EXPONENT) ?? params.solanaDecimals
  const shareOftMetadata = await readShareOftMetadata({
    publicClient: params.publicClient,
    shareOft: bridgeToken,
  })
  if (!shareOftMetadata) {
    throw new Error(
      'ShareOFT metadata unavailable for Solana wrap. CreatorShareOFT name/symbol are required before provisioning.',
    )
  }
  // Prefer canonical Unicode symbol, with deterministic ASCII fallback when needed.
  const { tokenName, tokenSymbolCandidates, tokenNameSource, tokenSymbolSource } = buildWrapTokenMetadata(
    shareOftMetadata,
    bridgeToken,
  )
  const primaryTokenSymbol = tokenSymbolCandidates[0] ?? ''
  const fallbackTokenSymbol = tokenSymbolCandidates[1] ?? null
  const payForRelay = String(process.env.SOLANA_BRIDGE_PAY_FOR_RELAY ?? '1').trim() !== '0'
  const provisionerUrls = readDynamicProvisionerUrls()
  const provisionerHealthUrls = readDynamicProvisionerHealthUrls(provisionerUrls)

  const provisionViaRemote = async (tokenSymbol: string = primaryTokenSymbol): Promise<{ mintBytes32: Hex; runner: string }> => {
    const retryAttempts = readProvisionerRetryAttempts()
    const retryDelayMs = readProvisionerRetryDelayMs()
    const requestTimeoutMs = readProvisionerRequestTimeoutMs()
    const provisionerSecret = readDynamicProvisionerSecret()
    const failures: string[] = []
    for (let i = 0; i < provisionerUrls.length; i += 1) {
      const provisionerUrl = provisionerUrls[i]
      const provisionerHealthUrl =
        provisionerHealthUrls[i] || readDynamicProvisionerHealthUrl(provisionerUrl)
      let candidateError = 'Unknown remote provisioner error'
      for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
        logger.info('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning start (remote provisioner)', {
          bridgeToken,
          shareOft: params.shareOft,
          provisionerUrl,
          provisionerHealthUrl: provisionerHealthUrl || null,
          candidateIndex: i + 1,
          candidateCount: provisionerUrls.length,
          attemptIndex: attempt,
          attemptCount: retryAttempts,
          requestTimeoutMs,
          deployEnv,
          payerKp,
          tokenName,
          tokenSymbol,
          tokenSymbolFallback: fallbackTokenSymbol,
          tokenNameSource,
          tokenSymbolSource,
          payForRelay,
        })
        try {
          const response = await fetchWithTimeout(
            String(provisionerUrl),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(provisionerSecret ? { Authorization: `Bearer ${provisionerSecret}` } : {}),
              },
              body: JSON.stringify({
                shareOft: bridgeToken,
                deployEnv,
                solanaDecimals: params.solanaDecimals,
                tokenName,
                tokenSymbol,
                tokenSymbolFallback: fallbackTokenSymbol,
                scalerExponent,
                payerKp,
                payForRelay,
              }),
            },
            requestTimeoutMs,
          ).catch((error) => {
            const details = describeFetchFailure(error)
            const healthHint = provisionerHealthUrl
              ? ` Check health endpoint: ${provisionerHealthUrl}`
              : ''
            throw new Error(`Remote provisioner request failed (${details}).${healthHint}`)
          })
          const rawBody = await response.text().catch(() => '')
          let json: Record<string, unknown> | null = null
          try {
            json = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null
          } catch {
            json = null
          }
          if (!response.ok || !json) {
            const detail =
              json && typeof json.error === 'string'
                ? json.error
                : rawBody
                  ? rawBody.slice(0, 300)
                  : 'No error body.'
            const healthHint = provisionerHealthUrl
              ? ` Check health endpoint: ${provisionerHealthUrl}`
              : ''
            throw new Error(
              `Remote provisioner failed (status=${response.status}). ${detail}.${healthHint}`,
            )
          }
          const mintBytes32Raw =
            typeof (json as any).mintBytes32 === 'string'
              ? (json as any).mintBytes32
              : typeof (json as any)?.data?.mintBytes32 === 'string'
                ? (json as any).data.mintBytes32
                : ''
          if (!isBytes32Hex(mintBytes32Raw)) {
            throw new Error('Remote provisioner did not return a valid mintBytes32.')
          }
          const runner =
            typeof (json as any).runner === 'string'
              ? String((json as any).runner)
              : typeof (json as any)?.data?.runner === 'string'
                ? String((json as any).data.runner)
                : 'remote-provisioner'
          return { mintBytes32: mintBytes32Raw as Hex, runner }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const retryable = isRetryableRemoteProvisionError(message)
          const willRetry = retryable && attempt < retryAttempts
          candidateError = message
          logger.warn('[deploy/registerSolanaBridgeToken] Remote provisioner candidate attempt failed', {
            bridgeToken,
            shareOft: params.shareOft,
            provisionerUrl,
            candidateIndex: i + 1,
            candidateCount: provisionerUrls.length,
            attemptIndex: attempt,
            attemptCount: retryAttempts,
            retryable,
            willRetry,
            error: message,
          })
          if (!willRetry) break
          const backoffMs = retryDelayMs * attempt
          if (backoffMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, backoffMs))
          }
        }
      }
      failures.push(`${provisionerUrl}: ${candidateError}`)
      logger.warn('[deploy/registerSolanaBridgeToken] Remote provisioner candidate failed', {
        bridgeToken,
        shareOft: params.shareOft,
        provisionerUrl,
        candidateIndex: i + 1,
        candidateCount: provisionerUrls.length,
        error: candidateError,
      })
    }
    throw new Error(
      `Remote provisioner failed for all configured endpoints. ${failures.join(' | ')}`,
    )
  }

  // Wraps provisionViaRemote with a single ASCII-symbol retry when the primary
  // (unicode) symbol causes a ConstraintSeeds / metadata-rejection error.
  const provisionViaRemoteWithFallback = async (): Promise<{ mintBytes32: Hex; runner: string }> => {
    try {
      return await provisionViaRemote(primaryTokenSymbol)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (fallbackTokenSymbol && isLikelyUnicodeSymbolUnsupportedError(message)) {
        logger.warn('[deploy/registerSolanaBridgeToken] Remote provisioner unicode symbol attempt failed; retrying with ASCII fallback', {
          bridgeToken,
          shareOft: params.shareOft,
          primaryTokenSymbol,
          fallbackTokenSymbol,
          error: message,
        })
        return provisionViaRemote(fallbackTokenSymbol)
      }
      throw error
    }
  }

  // Initialize to a sentinel so TS definite-assignment is satisfied; we validate
  // that provisioning replaced it before using it.
  let mintBytes32: Hex = ZERO_BYTES32
  let mintedPubkey: string | null = null
  let provisionRunner: string | null = null
  if (cliDir && existsSync(cliDir)) {
    const buildWrapArgs = (tokenSymbol: string): string[] => {
      const args = [
        'sol',
        'bridge',
        'wrap-token',
        '--deploy-env',
        deployEnv,
        '--remote-token',
        bridgeToken,
        '--decimals',
        String(params.solanaDecimals),
        '--name',
        tokenName,
        '--symbol',
        tokenSymbol,
        '--scaler-exponent',
        String(scalerExponent),
        '--payer-kp',
        payerKp,
      ]
      if (payForRelay) args.push('--pay-for-relay')
      return args
    }

    try {
      let localError: unknown = null
      for (let i = 0; i < tokenSymbolCandidates.length; i += 1) {
        const tokenSymbol = tokenSymbolCandidates[i]
        logger.info('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning start (local CLI)', {
          bridgeToken,
          shareOft: params.shareOft,
          cliDir,
          deployEnv,
          payerKp,
          tokenName,
          tokenSymbol,
          tokenSymbolCandidate: `${i + 1}/${tokenSymbolCandidates.length}`,
          tokenNameSource,
          tokenSymbolSource,
          payForRelay,
        })
        try {
          const { output: combined, runner } = await runWrapToken(cliDir, cliBin, buildWrapArgs(tokenSymbol))
          provisionRunner = runner
          const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
          if (!mintPubkey) {
            throw new Error(`Dynamic route created unknown mint (could not parse output). Output: ${combined.slice(-1200)}`)
          }
          mintedPubkey = mintPubkey
          mintBytes32 = solanaPubkeyToBytes32Hex(mintPubkey)
          localError = null
          break
        } catch (error) {
          localError = error
          const message = error instanceof Error ? error.message : String(error)
          const hasFallback = i < tokenSymbolCandidates.length - 1
          const shouldFallback = hasFallback && isLikelyUnicodeSymbolUnsupportedError(message)
          logger.warn('[deploy/registerSolanaBridgeToken] Local CLI symbol candidate failed', {
            bridgeToken,
            shareOft: params.shareOft,
            tokenSymbol,
            tokenSymbolCandidate: `${i + 1}/${tokenSymbolCandidates.length}`,
            fallback: shouldFallback,
            error: message,
          })
          if (!shouldFallback) throw error
        }
      }
      if (localError) throw localError
    } catch (error) {
      const localError = error instanceof Error ? error.message : String(error)
      const canFallbackToRemote =
        provisionerUrls.length > 0 && (isRunnerUnavailable(error) || localError.includes('No usable bridge CLI runner found'))
      if (!canFallbackToRemote) throw error
      logger.warn('[deploy/registerSolanaBridgeToken] Local dynamic route provisioning failed; falling back to remote provisioner', {
        bridgeToken,
        shareOft: params.shareOft,
        cliDir,
        cliBin,
        localError,
        provisionerUrls,
      })
      const remote = await provisionViaRemoteWithFallback()
      mintBytes32 = remote.mintBytes32
      provisionRunner = remote.runner
    }
  } else if (provisionerUrls.length > 0) {
    const remote = await provisionViaRemoteWithFallback()
    mintBytes32 = remote.mintBytes32
    provisionRunner = remote.runner
  } else {
    throw new Error(
      'Dynamic Solana route is enabled, but neither a valid local SOLANA_BRIDGE_CLI_DIR exists ' +
        'nor SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL / SOLANA_DYNAMIC_ROUTE_PROVISIONER_URLS is set.',
    )
  }

  if (mintBytes32.toLowerCase() === ZERO_BYTES32.toLowerCase()) {
    throw new Error('Dynamic Solana route provisioning failed to return a mintBytes32.')
  }

  for (let i = 0; i < 24; i += 1) {
    const scalar = await params.publicClient
      .readContract({
        address: BASE_SOLANA_BRIDGE,
        abi: BASE_SOLANA_BRIDGE_ABI,
        functionName: 'scalars',
        args: [bridgeToken, mintBytes32],
      })
      .then((v: unknown) => BigInt(v as bigint))
      .catch(() => 0n)
    if (scalar > 0n) {
      logger.info('[deploy/registerSolanaBridgeToken] Dynamic Solana route ready', {
        bridgeToken,
        shareOft: params.shareOft,
        mintPubkey: mintedPubkey,
        mintBytes32,
        runner: provisionRunner,
        scalar: scalar.toString(),
      })
      return mintBytes32
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }

  throw new Error(
    `Dynamic route provisioning completed, but bridge scalar was still 0 for bridgeToken ${bridgeToken} and mint ${mintBytes32}.`,
  )
}

async function buildMeteoraIxsViaProvisioner(params: {
  creatorToken: Address
  shareOft: Address
  expectedRemoteAmount: bigint
  meteoraAlphaVault: string
  alphaVaultProgramId: string
  depositAccounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
  provisionerUrls: string[]
  provisionerSecret: string
  requestTimeoutMs: number
}): Promise<{ meteoraAlphaVault: Hex; solanaIxs: SolanaBridgeIxPayload[]; runner: string | null }> {
  if (params.provisionerUrls.length === 0) {
    throw new Error('Meteora ix provisioner is not configured (METEORA_IX_PROVISIONER_URL[S]).')
  }
  const failures: string[] = []
  for (const url of params.provisionerUrls) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(params.provisionerSecret ? { Authorization: `Bearer ${params.provisionerSecret}` } : {}),
          },
          body: JSON.stringify({
            creatorToken: params.creatorToken,
            shareOft: params.shareOft,
            meteoraAlphaVault: params.meteoraAlphaVault,
            alphaVaultProgramId: params.alphaVaultProgramId,
            expectedRemoteAmount: params.expectedRemoteAmount.toString(),
            depositAccounts: params.depositAccounts,
          }),
        },
        params.requestTimeoutMs,
      )
      const rawBody = await response.text().catch(() => '')
      const json = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null
      if (!response.ok || !json || json.success !== true) {
        const detail = typeof json?.error === 'string' ? json.error : rawBody.slice(0, 240)
        throw new Error(`status=${response.status} ${detail}`)
      }
      const data = (json.data ?? json) as Record<string, unknown>
      const meteoraAlphaVault = String(data.meteoraAlphaVault ?? '').trim()
      const solanaIxsRaw = Array.isArray(data.solanaIxs) ? data.solanaIxs : []
      if (!isBytes32Hex(meteoraAlphaVault)) {
        throw new Error('provisioner returned invalid meteoraAlphaVault')
      }
      const solanaIxs: SolanaBridgeIxPayload[] = []
      for (const item of solanaIxsRaw) {
        if (!item || typeof item !== 'object') throw new Error('provisioner returned invalid solanaIxs item')
        const row = item as Record<string, unknown>
        const programId = String(row.programId ?? '').trim()
        const dataHex = String(row.data ?? '').trim()
        const serializedAccountsRaw = Array.isArray(row.serializedAccounts) ? row.serializedAccounts : []
        if (!isBytes32Hex(programId) || !/^0x[0-9a-fA-F]*$/.test(dataHex)) {
          throw new Error('provisioner returned invalid ix fields')
        }
        const serializedAccounts = serializedAccountsRaw
          .map((v) => String(v ?? '').trim())
          .filter((v) => /^0x[0-9a-fA-F]*$/.test(v)) as Hex[]
        if (serializedAccounts.length === 0) throw new Error('provisioner returned ix with empty serializedAccounts')
        solanaIxs.push({
          programId: programId as Hex,
          serializedAccounts,
          data: dataHex as Hex,
        })
      }
      if (solanaIxs.length === 0) throw new Error('provisioner returned empty solanaIxs')
      return {
        meteoraAlphaVault: meteoraAlphaVault as Hex,
        solanaIxs,
        runner: typeof (data as any).runner === 'string' ? String((data as any).runner) : null,
      }
    } catch (error) {
      failures.push(`${url}: ${describeFetchFailure(error)}`)
    }
  }
  throw new Error(`All Meteora ix provisioner endpoints failed. ${failures.join(' | ')}`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<RegisterSolanaBridgeTokenRequest>(req)
  const shareOftRaw = typeof body?.shareOft === 'string' ? body.shareOft.trim() : ''
  const requestedBridgeTokenRaw = typeof body?.bridgeToken === 'string' ? body.bridgeToken.trim() : ''
  const explicitBridgeToken = isAddress(requestedBridgeTokenRaw) ? getAddress(requestedBridgeTokenRaw) : null
  const shareOft = isAddress(shareOftRaw) ? getAddress(shareOftRaw) : explicitBridgeToken
  if (!shareOft) {
    return res.status(400).json({
      success: false,
      error: 'Invalid shareOft address (or provide bridgeToken).',
    } satisfies ApiEnvelope<never>)
  }
  const buildOnly = body?.buildOnly === true
  const creatorTokenRaw = typeof body?.creatorToken === 'string' ? body.creatorToken.trim() : ''
  const creatorToken = isAddress(creatorTokenRaw) ? getAddress(creatorTokenRaw) : null
  // When a Creator Coin is provided, wrap and register IT on Solana instead of
  // the ShareOFT receipt token. The Creator Coin has a clean ASCII symbol (e.g.
  // "AKITA" vs "■AKITA"), avoids ConstraintSeeds issues, and is the primary
  // tradeable brand token that Solana users actually want to hold.
  const bridgeToken: Address = explicitBridgeToken ?? creatorToken ?? shareOft
  const expectedSolanaAmountBase = parseBigIntLike(body?.expectedSolanaAmount)
  const requestedShareDecimals = parseDecimals(body?.shareDecimals)

  const contracts = getApiContracts()
  const batcherRaw = typeof body?.batcherAddress === 'string' && isAddress(body.batcherAddress)
    ? body.batcherAddress
    : contracts.creatorVaultBatcher

  if (!batcherRaw || !isAddress(batcherRaw)) {
    return res.status(503).json({
      success: false,
      error: 'Deployment batcher (CreatorVaultDeployer) is not configured on server.',
    } satisfies ApiEnvelope<never>)
  }
  const batcher = getAddress(batcherRaw)

  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })

  try {
    const [adapterRaw, destinationRaw] = await Promise.all([
      publicClient
        .readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
          functionName: 'solanaBridgeAdapter',
        })
        .catch(() => ZERO_ADDRESS as Address),
      publicClient
        .readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
          functionName: 'solanaDestination',
        })
        .catch(() => ZERO_BYTES32 as Hex),
    ])

    const adapter = getAddress((adapterRaw as Address) || ZERO_ADDRESS)
    const destination = ((destinationRaw as Hex) || ZERO_BYTES32) as Hex
    const solanaEnabled =
      adapter.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
      destination.toLowerCase() !== ZERO_BYTES32.toLowerCase()

    if (!solanaEnabled) {
      return res.status(409).json({
        success: false,
        error: 'Solana bridge is not enabled on deployment batcher (CreatorVaultDeployer) (adapter/destination unset).',
      } satisfies ApiEnvelope<never>)
    }

    const adapterCode = await publicClient.getBytecode({ address: adapter })
    if (!adapterCode || adapterCode === '0x') {
      return res.status(409).json({
        success: false,
        error: `Configured Solana adapter ${adapter} has no bytecode.`,
      } satisfies ApiEnvelope<never>)
    }

    const [alreadyRegisteredRaw, adapterOwnerRaw] = await Promise.all([
      publicClient.readContract({
        address: adapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'isRegistered',
        args: [bridgeToken],
      }),
      publicClient.readContract({
        address: adapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'owner',
      }),
    ])
    const alreadyRegistered = Boolean(alreadyRegisteredRaw)
    const adapterOwner = getAddress(String(adapterOwnerRaw) as Address)
    const solanaDecimals = parseDecimals(body?.solanaDecimals) ?? readSolanaDecimalsFromEnv()

    let meteoraAlphaVault: Hex | null = null
    let solanaIxs: SolanaBridgeIxPayload[] = []
    if (creatorToken) {
      if (!expectedSolanaAmountBase || expectedSolanaAmountBase <= 0n) {
        return res.status(400).json({
          success: false,
          error: 'expectedSolanaAmount is required when creatorToken is provided.',
        } satisfies ApiEnvelope<never>)
      }
      const meteoraConfig = await resolveMeteoraAlphaVaultConfig({ creatorToken })
      if (!meteoraConfig) {
        return res.status(409).json({
          success: false,
          error: `Missing Meteora Alpha Vault mapping for creator token ${creatorToken}.`,
        } satisfies ApiEnvelope<never>)
      }
      const shareDecimals =
        requestedShareDecimals ??
        (await publicClient
          .readContract({
            address: bridgeToken,
            abi: ERC20_METADATA_ABI,
            functionName: 'decimals',
          })
          .then((v) => Number(v as number))
          .catch(() => null)) ??
        18
      let expectedRemoteAmount: bigint
      try {
        expectedRemoteAmount = toRemoteAmountExact(expectedSolanaAmountBase, shareDecimals, solanaDecimals)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return res.status(409).json({
          success: false,
          error: `Invalid Solana allocation amount for Meteora ix generation: ${message}`,
        } satisfies ApiEnvelope<never>)
      }
      const dynamicProvisionerUrls = readDynamicProvisionerUrls()
      const meteoraProvisionerUrls = readMeteoraProvisionerUrls(dynamicProvisionerUrls)
      const meteoraProvisionerSecret = readMeteoraProvisionerSecret()
      const meteoraPayload = await buildMeteoraIxsViaProvisioner({
        creatorToken,
        shareOft,
        expectedRemoteAmount,
        meteoraAlphaVault: meteoraConfig.meteoraAlphaVault,
        alphaVaultProgramId: meteoraConfig.alphaVaultProgramId,
        depositAccounts: meteoraConfig.depositAccounts,
        provisionerUrls: meteoraProvisionerUrls,
        provisionerSecret: meteoraProvisionerSecret,
        requestTimeoutMs: readProvisionerRequestTimeoutMs(),
      })
      meteoraAlphaVault = meteoraPayload.meteoraAlphaVault
      solanaIxs = meteoraPayload.solanaIxs
      logger.info('[deploy/registerSolanaBridgeToken] Built Meteora ix payload', {
        creatorToken,
        shareOft,
        configSource: meteoraConfig.source,
        expectedSolanaAmountBase: expectedSolanaAmountBase.toString(),
        expectedRemoteAmount: expectedRemoteAmount.toString(),
        meteoraAlphaVault,
        ixCount: solanaIxs.length,
      })
    }

    if (alreadyRegistered) {
      return res.status(200).json({
        success: true,
        data: {
          shareOft,
          bridgeToken,
          batcher,
          adapter,
          destination,
          adapterOwner,
          signer: null,
          registered: true,
          txHash: null,
          solanaMint: null,
          solanaDecimals: null,
          meteoraAlphaVault,
          solanaIxs,
        },
      } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
    }

    if (buildOnly) {
      const hintedMint = typeof body?.solanaMint === 'string' && isBytes32Hex(body.solanaMint.trim())
        ? (body.solanaMint.trim() as Hex)
        : readSolanaMintFromEnv()
      return res.status(200).json({
        success: true,
        data: {
          shareOft,
          bridgeToken,
          batcher,
          adapter,
          destination,
          adapterOwner,
          signer: null,
          registered: false,
          txHash: null,
          solanaMint: hintedMint,
          solanaDecimals,
          meteoraAlphaVault,
          solanaIxs,
        },
      } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
    }

    const shareCode = await publicClient.getBytecode({ address: bridgeToken }).catch(() => '0x' as Hex)
    if (!shareCode || shareCode === '0x') {
      return res.status(409).json({
        success: false,
        error:
          `Bridge token ${bridgeToken} has no bytecode yet. ` +
          (bridgeToken === shareOft
            ? 'Run phase1 finalize first, then retry Solana registration.'
            : 'Ensure the creator token is deployed on Base before Solana registration.'),
      } satisfies ApiEnvelope<never>)
    }

    const signerPk = readRegistrationSignerPk()
    if (!signerPk) {
      return res.status(500).json({
        success: false,
        error:
          'Auto-registration signer key is not configured. Set SOLANA_ADAPTER_OWNER_PRIVATE_KEY (or KEEPR_PRIVATE_KEY).',
      } satisfies ApiEnvelope<never>)
    }
    const account = privateKeyToAccount(signerPk)
    const signerAddress = getAddress(account.address)
    if (signerAddress.toLowerCase() !== adapterOwner.toLowerCase()) {
      return res.status(409).json({
        success: false,
        error:
          `Adapter owner mismatch: adapter owner is ${adapterOwner}, but server signer is ${signerAddress}. ` +
          'Use the adapter owner key or rotate adapter ownership first.',
      } satisfies ApiEnvelope<never>)
    }

    const reqMint = typeof body?.solanaMint === 'string' ? body.solanaMint.trim() : ''
    const requestMintExplicit = isBytes32Hex(reqMint)
    let solanaMint: Hex | null = requestMintExplicit ? (reqMint as Hex) : readSolanaMintFromEnv()
    let dynamicProvisionError: string | null = null
    const appendDynamicProvisionDetail = (message: string): string =>
      dynamicProvisionError ? `${message} Dynamic route provisioning error: ${dynamicProvisionError}` : message
    const readExistingTokenForMint = async (mint: Hex): Promise<Address> =>
      publicClient
        .readContract({
          address: adapter,
          abi: SOLANA_BRIDGE_ADAPTER_ABI,
          functionName: 'solanaMintToToken',
          args: [mint],
        })
        .then((v) => (typeof v === 'string' && isAddress(v) ? getAddress(v as Address) : ZERO_ADDRESS))
        .catch(() => ZERO_ADDRESS)

    const readRouteScalar = async (mint: Hex): Promise<bigint | null> =>
      publicClient
        .readContract({
          address: BASE_SOLANA_BRIDGE,
          abi: BASE_SOLANA_BRIDGE_ABI,
          functionName: 'scalars',
          args: [bridgeToken, mint],
        })
        .then((v) => BigInt(v as bigint))
        .catch(() => null)
    const trySwitchToDynamicMint = async (): Promise<boolean> => {
      try {
        const dynamicMint = await tryProvisionDynamicRoute({
          shareOft,
          bridgeToken,
          solanaDecimals,
          publicClient,
        })
        if (!dynamicMint) return false
        solanaMint = dynamicMint
        dynamicProvisionError = null
        return true
      } catch (error) {
        dynamicProvisionError = error instanceof Error ? error.message : String(error)
        logger.warn('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning failed', {
          caller: auth.address,
          shareOft,
          error: dynamicProvisionError,
        })
        return false
      }
    }

    if (!solanaMint || solanaMint.toLowerCase() === ZERO_BYTES32.toLowerCase()) {
      const switched = await trySwitchToDynamicMint()
      if (!switched || !solanaMint || solanaMint.toLowerCase() === ZERO_BYTES32.toLowerCase()) {
        return res.status(409).json({
          success: false,
          error: appendDynamicProvisionDetail(
            'Missing Solana mint bytes32. Provide `solanaMint` in the request body or set SOLANA_DEFAULT_MINT_BYTES32. ' +
              'For automatic dynamic route creation, enable SOLANA_DYNAMIC_ROUTE_ENABLED=1 and set SOLANA_BRIDGE_CLI_DIR, or configure SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL.',
          ),
        } satisfies ApiEnvelope<never>)
      }
    }

    let existingTokenForMint = await readExistingTokenForMint(solanaMint)
    if (
      existingTokenForMint.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
      existingTokenForMint.toLowerCase() !== bridgeToken.toLowerCase()
    ) {
      const switched = await trySwitchToDynamicMint()
      if (!switched) {
        return res.status(409).json({
          success: false,
          error:
            `Solana mint ${solanaMint} is already mapped to ${existingTokenForMint}. ` +
            'Use a unique mint per bridge token.',
        } satisfies ApiEnvelope<never>)
      }
      existingTokenForMint = await readExistingTokenForMint(solanaMint)
      if (
        existingTokenForMint.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
        existingTokenForMint.toLowerCase() !== bridgeToken.toLowerCase()
      ) {
        return res.status(409).json({
          success: false,
          error:
            `Dynamically-created Solana mint ${solanaMint} is already mapped to ${existingTokenForMint}. ` +
            'Retry deploy to create a fresh route, or provide a unique mint.',
        } satisfies ApiEnvelope<never>)
      }
    }

    let routeScalar = await readRouteScalar(solanaMint)
    if (routeScalar === 0n) {
      const switched = await trySwitchToDynamicMint()
      if (switched) {
        existingTokenForMint = await readExistingTokenForMint(solanaMint)
        if (
          existingTokenForMint.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
          existingTokenForMint.toLowerCase() !== bridgeToken.toLowerCase()
        ) {
          return res.status(409).json({
            success: false,
            error:
              `Dynamically-created Solana mint ${solanaMint} is already mapped to ${existingTokenForMint}. ` +
              'Retry deploy to create a fresh route, or provide a unique mint.',
          } satisfies ApiEnvelope<never>)
        }
        routeScalar = await readRouteScalar(solanaMint)
      }
      if (routeScalar === 0n) {
        return res.status(409).json({
          success: false,
          error: appendDynamicProvisionDetail(
            `Base Solana bridge route is not registered for bridge token ${bridgeToken} and mint ${solanaMint} ` +
              '(WrappedSplRouteNotRegistered). Use a bridge-supported Solana mint for this token, ' +
              'or disable Solana bridging on the batcher before deploy. ' +
              'For automatic dynamic route creation, enable SOLANA_DYNAMIC_ROUTE_ENABLED=1 and set SOLANA_BRIDGE_CLI_DIR, or configure SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL.',
          ),
        } satisfies ApiEnvelope<never>)
      }
    }

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const txHash = await walletClient.writeContract({
      address: adapter,
      abi: SOLANA_BRIDGE_ADAPTER_ABI,
      functionName: 'registerToken',
      args: [bridgeToken, solanaMint, solanaDecimals],
      account,
      chain: base,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })

    logger.info('[deploy/registerSolanaBridgeToken] Registered bridge token for Solana bridge', {
      caller: auth.address,
      bridgeToken,
      shareOft,
      batcher,
      adapter,
      destination,
      solanaMint,
      solanaDecimals,
      txHash,
    })

    return res.status(200).json({
      success: true,
      data: {
        shareOft,
        bridgeToken,
        batcher,
        adapter,
        destination,
        adapterOwner,
        signer: signerAddress,
        registered: true,
        txHash,
        solanaMint,
        solanaDecimals,
        meteoraAlphaVault,
        solanaIxs,
      },
    } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[deploy/registerSolanaBridgeToken] Registration failed', {
      caller: auth.address,
      bridgeToken,
      shareOft,
      batcher,
      error: message,
    })
    return res.status(500).json({
      success: false,
      error: `Failed to auto-register Solana bridge token: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
