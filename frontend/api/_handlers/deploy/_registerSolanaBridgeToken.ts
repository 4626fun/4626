import type { VercelRequest, VercelResponse } from '@vercel/node'

import { existsSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'

import { createPublicClient, createWalletClient, getAddress, http, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  logger,
  getApiContracts,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  isAdminAddress,
} from '../../../packages/server-core/src/index.js'



import { readDeployAuthFromRequest } from '../../../server/_lib/auth/deployAuth.js'


import {
  SOLANA_NATIVE_MINT,
  resolveMeteoraAlphaVaultConfig,
  resolveMeteoraAlphaVaultConfigHints,
} from '../../../server/_lib/onchain/meteoraAlphaVaultConfig.js'
import {
  evaluateSolanaOvaultMintCompatibility,
  normalizeSolanaAssetMintOrigin,
  parseSolanaOvaultMintCompatibilityHints,
  readSolanaOvaultMintCompatibilityHintsFromEnv,
} from '../../../server/_lib/onchain/solanaOvaultCompatibility.js'
import {
  evaluateCanonicalBridgeTokenPolicy,
  evaluateRemoteProvisionerLiveness,
  probeRemoteProvisionerHealth,
  readSolanaBridgeLivenessPolicy,
} from '../../../server/_lib/onchain/solanaBridgePolicy.js'
import { resolveShareTokenMetadataUrls } from '../../../server/_lib/infra/shareTokenMetadata.js'
import {
  isRunnerUnavailable,
  runWrapToken,
} from '../../../server/_lib/onchain/solanaBridgeCliRunner.js'
import {
  ERC20_METADATA_ABI,
  WRAP_TOKEN_NAME_MAX_LENGTH,
  WRAP_TOKEN_SYMBOL_MAX_LENGTH,
  isLikelyUnsupportedMetadataUriFlagError,
  normalizeWrapTokenMetadataUri,
  normalizeWrapTokenName,
  normalizeWrapTokenSymbol,
  readBridgeTokenMetadata,
} from '../../../server/_lib/onchain/solanaBridgeTokenMetadata.js'
import {
  parseMintPubkeyFromWrapOutput,
  solanaPubkeyToBytes32Hex,
} from '../../../server/_lib/onchain/solanaBridgePubkey.js'

type RegisterSolanaBridgeTokenRequest = {
  bridgeToken?: string
  batcherAddress?: string
  solanaMint?: string
  solanaDecimals?: number | string
  tokenMetadataUri?: string
  creatorToken?: string
  expectedSolanaAmount?: string | number
  shareDecimals?: number | string
  buildOnly?: boolean
  assetMintOrigin?: 'existing' | 'new'
  enforceCompatibility?: boolean
  mintCompatibilityHints?: unknown
}

type SolanaBridgeIxPayload = {
  programId: Hex
  serializedAccounts: Hex[]
  data: Hex
}

type RegisterSolanaBridgeTokenResponse = {
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
  mintCompatibility: ReturnType<typeof evaluateSolanaOvaultMintCompatibility>['mintCompatibility']
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  assetPeerSet: boolean
  sharePeerSet: boolean
}

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
const REGISTER_SOLANA_BRIDGE_TOKEN_MAX_BODY_BYTES = 64 * 1024

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

function isBytes32Hex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function readSolanaMintFromEnv(): Hex | null {
  const candidates = [process.env.SOLANA_DEFAULT_MINT_BYTES32, process.env.SOLANA_MINT_BYTES32]
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

type MintCompatibilityHints = ReturnType<typeof parseSolanaOvaultMintCompatibilityHints>

function mergeMintCompatibilityHints(
  primary: MintCompatibilityHints,
  fallback: MintCompatibilityHints | null,
): MintCompatibilityHints {
  if (!fallback) return primary
  return {
    tokenProgram: primary.tokenProgram ?? fallback.tokenProgram,
    transferHookDetected: primary.transferHookDetected ?? fallback.transferHookDetected,
    oftFeeBps: primary.oftFeeBps ?? fallback.oftFeeBps,
    adapterMode: primary.adapterMode ?? fallback.adapterMode,
    authorityCompatible: primary.authorityCompatible ?? fallback.authorityCompatible,
    rentValueLamports: primary.rentValueLamports ?? fallback.rentValueLamports,
  }
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

function readStrictSolPairEnabled(): boolean {
  const raw = String(process.env.SOLANA_STRICT_SOL_PAIR ?? '1').trim().toLowerCase()
  if (!raw) return true
  return !['0', 'false', 'no', 'off'].includes(raw)
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

function requestHeader(req: VercelRequest, key: string): string {
  const value = req.headers[key] as string | string[] | undefined
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return typeof value === 'string' ? value.trim() : ''
}

function readFirstNonEmptyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim()
    if (value) return value
  }
  return ''
}

function readInternalSolanaRegistrationSecret(): string {
  return readFirstNonEmptyEnv([
    'DEPLOY_SOLANA_REGISTRATION_SECRET',
    'SOLANA_REGISTRATION_INTERNAL_SECRET',
  ])
}

function safeCompareSecret(provided: string, configured: string): boolean {
  const expected = Buffer.from(configured)
  const actual = Buffer.from(provided)
  if (expected.length === 0 || actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function isInternalSolanaRegistrationAuthorized(req: VercelRequest): boolean {
  const secret = readInternalSolanaRegistrationSecret()
  if (!secret) return false
  const headerSecret = requestHeader(req, 'x-cv-solana-registration-secret')
  if (headerSecret && safeCompareSecret(headerSecret, secret)) return true
  const authz = requestHeader(req, 'authorization')
  if (authz.toLowerCase().startsWith('bearer ')) {
    const token = authz.slice(7).trim()
    if (token && safeCompareSecret(token, secret)) return true
  }
  return false
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
  return readFirstNonEmptyEnv([
    'SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET',
    'SOLANA_BRIDGE_PROVISIONER_SECRET',
    // Optional same-process fallback when app + provisioner share env.
    'PROVISIONER_BEARER_TOKEN',
  ])
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
  return readFirstNonEmptyEnv([
    'METEORA_IX_PROVISIONER_SECRET',
    'SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET',
    'SOLANA_BRIDGE_PROVISIONER_SECRET',
    // Optional same-process fallback when app + provisioner share env.
    'PROVISIONER_BEARER_TOKEN',
  ])
}

function readWrapTokenMetadataUriEnabled(): boolean {
  const raw = String(process.env.SOLANA_BRIDGE_WRAP_METADATA_URI_ENABLED ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return false
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function buildWrapTokenMetadata(metadata: { name: string; symbol: string }): {
  tokenName: string | null
  tokenSymbol: string | null
  tokenNameSource: string
  tokenSymbolSource: string
} {
  const originalName = String(metadata.name ?? '')
  const originalSymbol = String(metadata.symbol ?? '')
  const tokenName = normalizeWrapTokenName(originalName)
  const tokenSymbol = normalizeWrapTokenSymbol(originalSymbol)
  const tokenNameSource = 'base_bridge_token_lowercase'
  const tokenSymbolSource = 'base_bridge_token_lowercase'
  return { tokenName, tokenSymbol, tokenNameSource, tokenSymbolSource }
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

function looksLikeHtmlAppShell(contentType: string | null, body: string): boolean {
  const ct = String(contentType ?? '').toLowerCase()
  if (ct.includes('text/html')) return true
  const sample = String(body ?? '').trim().slice(0, 256).toLowerCase()
  if (!sample) return false
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.includes('<head') ||
    sample.includes('<body')
  )
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

async function tryProvisionDynamicRoute(params: {
  bridgeToken: Address
  solanaDecimals: number
  publicClient: any
  tokenMetadataUri?: string | null
}): Promise<{ mintBytes32: Hex; mintCompatibilityHints: MintCompatibilityHints | null } | null> {
  if (!readDynamicSolanaRouteEnabled()) return null

  const bridgeToken = params.bridgeToken
  const tokenMetadataUri = normalizeWrapTokenMetadataUri(params.tokenMetadataUri ?? null)

  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'auto').trim() || 'auto'
  const deployEnv = String(process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet'
  const payerKp = String(process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  const scalerExponent = parseDecimals(process.env.SOLANA_BRIDGE_SCALER_EXPONENT) ?? params.solanaDecimals
  const bridgeTokenMetadata = await readBridgeTokenMetadata({
    publicClient: params.publicClient,
    bridgeToken,
  })
  if (!bridgeTokenMetadata) {
    throw new Error(
      'Bridge token metadata unavailable for Solana wrap. Name/symbol are required before provisioning.',
    )
  }
  const { tokenName, tokenSymbol, tokenNameSource, tokenSymbolSource } = buildWrapTokenMetadata(
    bridgeTokenMetadata,
  )
  if (!tokenName || !tokenSymbol) {
    throw new Error(
      `Bridge token metadata is incompatible with strict Solana parity requirements (name<=${WRAP_TOKEN_NAME_MAX_LENGTH}, ` +
        `symbol<=${WRAP_TOKEN_SYMBOL_MAX_LENGTH}, lowercase-coerced).`,
    )
  }
  const payForRelay = String(process.env.SOLANA_BRIDGE_PAY_FOR_RELAY ?? '1').trim() !== '0'
  const provisionerUrls = readDynamicProvisionerUrls()
  const provisionerHealthUrls = readDynamicProvisionerHealthUrls(provisionerUrls)

  const provisionViaRemote = async (): Promise<{
    mintBytes32: Hex
    runner: string
    mintCompatibilityHints: MintCompatibilityHints | null
  }> => {
    const retryAttempts = readProvisionerRetryAttempts()
    const retryDelayMs = readProvisionerRetryDelayMs()
    const requestTimeoutMs = readProvisionerRequestTimeoutMs()
    const provisionerSecret = readDynamicProvisionerSecret()
    if (!provisionerSecret) {
      throw new Error(
        'Remote provisioner secret is missing. Set SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET to match provisioner PROVISIONER_BEARER_TOKEN.',
      )
    }
    const failures: string[] = []
    for (let i = 0; i < provisionerUrls.length; i += 1) {
      const provisionerUrl = provisionerUrls[i]
      const provisionerHealthUrl =
        provisionerHealthUrls[i] || readDynamicProvisionerHealthUrl(provisionerUrl)
      let candidateError = 'Unknown remote provisioner error'
      for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
        logger.info('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning start (remote provisioner)', {
          bridgeToken,
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
          tokenNameSource,
          tokenSymbolSource,
          tokenMetadataUri,
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
                bridgeToken,
                deployEnv,
                solanaDecimals: params.solanaDecimals,
                tokenName,
                tokenSymbol,
                tokenMetadataUri,
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
          const contentType =
            typeof (response as any)?.headers?.get === 'function'
              ? response.headers.get('content-type')
              : null
          if (looksLikeHtmlAppShell(contentType, rawBody)) {
            const healthHint = provisionerHealthUrl
              ? ` Check health endpoint: ${provisionerHealthUrl}`
              : ''
            throw new Error(
              `Remote provisioner URL appears misconfigured (returned HTML instead of JSON): ${provisionerUrl}.${healthHint}`,
            )
          }
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
          const compatibilityRaw = (json as any).mintCompatibilityHints ?? (json as any)?.data?.mintCompatibilityHints ?? null
          const mintCompatibilityHints = compatibilityRaw
            ? parseSolanaOvaultMintCompatibilityHints(compatibilityRaw)
            : null
          return { mintBytes32: mintBytes32Raw as Hex, runner, mintCompatibilityHints }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const retryable = isRetryableRemoteProvisionError(message)
          const willRetry = retryable && attempt < retryAttempts
          candidateError = message
          logger.warn('[deploy/registerSolanaBridgeToken] Remote provisioner candidate attempt failed', {
            bridgeToken,
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

  // Initialize to a sentinel so TS definite-assignment is satisfied; we validate
  // that provisioning replaced it before using it.
  let mintBytes32: Hex = ZERO_BYTES32
  let mintCompatibilityHints: MintCompatibilityHints | null = null
  let mintedPubkey: string | null = null
  let provisionRunner: string | null = null
  const includeMetadataUriByDefault = readWrapTokenMetadataUriEnabled() && Boolean(tokenMetadataUri)
  if (cliDir && existsSync(cliDir)) {
    const buildWrapArgs = (tokenSymbol: string, includeMetadataUri: boolean): string[] => {
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
      if (includeMetadataUri && tokenMetadataUri) {
        args.push('--metadata-uri', tokenMetadataUri)
      }
      if (payForRelay) args.push('--pay-for-relay')
      return args
    }

    try {
      logger.info('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning start (local CLI)', {
        bridgeToken,
        cliDir,
        deployEnv,
        payerKp,
        tokenName,
        tokenSymbol,
        tokenNameSource,
        tokenSymbolSource,
        tokenMetadataUri: includeMetadataUriByDefault ? tokenMetadataUri : null,
        payForRelay,
      })
      const metadataAttempts = includeMetadataUriByDefault ? [true, false] : [false]
      let combined: string | null = null
      let runner: string | null = null
      for (let metadataIdx = 0; metadataIdx < metadataAttempts.length; metadataIdx += 1) {
        const includeMetadataUri = metadataAttempts[metadataIdx]
        try {
          const result = await runWrapToken(cliDir, cliBin, buildWrapArgs(tokenSymbol, includeMetadataUri))
          combined = result.output
          runner = result.runner
          break
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const canRetryWithoutMetadata =
            includeMetadataUriByDefault &&
            includeMetadataUri &&
            isLikelyUnsupportedMetadataUriFlagError(message)
          if (!canRetryWithoutMetadata) throw error
          logger.warn('[deploy/registerSolanaBridgeToken] Local CLI metadata-uri flag unsupported; retrying without metadata-uri', {
            bridgeToken,
            tokenSymbol,
            metadataUriFlag: '--metadata-uri',
            error: message,
          })
        }
      }
      if (!combined || !runner) {
        throw new Error('Dynamic route provisioning did not return wrap-token output.')
      }
      provisionRunner = runner
      const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
      if (!mintPubkey) {
        throw new Error(`Dynamic route created unknown mint (could not parse output). Output: ${combined.slice(-1200)}`)
      }
      mintedPubkey = mintPubkey
      mintBytes32 = solanaPubkeyToBytes32Hex(mintPubkey)
    } catch (error) {
      const localError = error instanceof Error ? error.message : String(error)
      const canFallbackToRemote =
        provisionerUrls.length > 0 && (isRunnerUnavailable(error) || localError.includes('No usable bridge CLI runner found'))
      if (!canFallbackToRemote) throw error
      logger.warn('[deploy/registerSolanaBridgeToken] Local dynamic route provisioning failed; falling back to remote provisioner', {
        bridgeToken,
        cliDir,
        cliBin,
        localError,
        provisionerUrls,
      })
      const remote = await provisionViaRemote()
      mintBytes32 = remote.mintBytes32
      provisionRunner = remote.runner
      mintCompatibilityHints = remote.mintCompatibilityHints
    }
  } else if (provisionerUrls.length > 0) {
    const remote = await provisionViaRemote()
    mintBytes32 = remote.mintBytes32
    provisionRunner = remote.runner
    mintCompatibilityHints = remote.mintCompatibilityHints
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
        mintPubkey: mintedPubkey,
        mintBytes32,
        runner: provisionRunner,
        scalar: scalar.toString(),
      })
      return { mintBytes32, mintCompatibilityHints }
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }

  throw new Error(
    `Dynamic route provisioning completed, but bridge scalar was still 0 for bridgeToken ${bridgeToken} and mint ${mintBytes32}.`,
  )
}

async function buildMeteoraIxsViaProvisioner(params: {
  creatorToken: Address
  bridgeToken: Address
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
  if (!params.provisionerSecret) {
    throw new Error(
      'Meteora ix provisioner secret is missing. Set METEORA_IX_PROVISIONER_SECRET (or SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET) to match provisioner PROVISIONER_BEARER_TOKEN.',
    )
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
            bridgeToken: params.bridgeToken,
            meteoraAlphaVault: params.meteoraAlphaVault,
            alphaVaultProgramId: params.alphaVaultProgramId,
            expectedRemoteAmount: params.expectedRemoteAmount.toString(),
            depositAccounts: params.depositAccounts,
          }),
        },
        params.requestTimeoutMs,
      )
      const rawBody = await response.text().catch(() => '')
      const contentType =
        typeof (response as any)?.headers?.get === 'function'
          ? response.headers.get('content-type')
          : null
      if (looksLikeHtmlAppShell(contentType, rawBody)) {
        throw new Error(
          `status=${response.status} provisioner_url_misconfigured_html_response (${url})`,
        )
      }
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
  const internalAuthorized = isInternalSolanaRegistrationAuthorized(req)
  if (!auth?.address && !internalAuthorized) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }
  const callerAddress = auth?.address && isAddress(auth.address) ? getAddress(auth.address) : null
  const adminAuthorized = callerAddress ? isAdminAddress(callerAddress) : false
  if (!internalAuthorized && !adminAuthorized) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' } satisfies ApiEnvelope<never>)
  }

  const callerTag = internalAuthorized
    ? 'internal:solana-registration-secret'
    : (callerAddress ?? 'unknown-admin')
  const clientIp = getClientIp(req)
  const rate = checkRateLimit(
    rateLimitKey('deploy-register-solana-bridge-token', callerTag, clientIp),
    {
      windowMs: 60_000,
      maxRequests: internalAuthorized ? 120 : 20,
    },
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, {
    maxBytes: REGISTER_SOLANA_BRIDGE_TOKEN_MAX_BODY_BYTES,
  })) as RegisterSolanaBridgeTokenRequest | null
  if (!body) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body.',
    } satisfies ApiEnvelope<never>)
  }
  const requestedBridgeTokenRaw = typeof body?.bridgeToken === 'string' ? body.bridgeToken.trim() : ''
  const explicitBridgeToken = isAddress(requestedBridgeTokenRaw) ? getAddress(requestedBridgeTokenRaw) : null
  const buildOnly = body?.buildOnly === true
  if (!buildOnly && !internalAuthorized) {
    return res.status(403).json({
      success: false,
      error: 'Internal Solana registration secret is required for mutating registration.',
    } satisfies ApiEnvelope<never>)
  }
  const creatorTokenRaw = typeof body?.creatorToken === 'string' ? body.creatorToken.trim() : ''
  const creatorToken = isAddress(creatorTokenRaw) ? getAddress(creatorTokenRaw) : null
  const enforceCompatibility = body?.enforceCompatibility === true
  const assetMintOrigin = normalizeSolanaAssetMintOrigin(
    body?.assetMintOrigin,
    creatorToken ? 'existing' : 'new',
  )
  const envMintCompatibilityHints = readSolanaOvaultMintCompatibilityHintsFromEnv()
  const requestMintCompatibilityHints = internalAuthorized
    ? parseSolanaOvaultMintCompatibilityHints(body?.mintCompatibilityHints)
    : parseSolanaOvaultMintCompatibilityHints(null)
  // Only trusted internal calls may provide per-request hint overrides.
  // External/admin callers are pinned to server-configured compatibility hints.
  let mintCompatibilityHints = mergeMintCompatibilityHints(
    requestMintCompatibilityHints,
    envMintCompatibilityHints,
  )
  // Canonical selection order:
  // 1) explicit bridgeToken
  // 2) creatorToken (for creator-coin bridging flows)
  const bridgeToken: Address | null = explicitBridgeToken ?? creatorToken
  if (!bridgeToken) {
    return res.status(400).json({
      success: false,
      error: 'Invalid bridgeToken address.',
    } satisfies ApiEnvelope<never>)
  }
  // When a Creator Coin is provided, wrap and register it on Solana instead of
  // a receipt-token path. Dynamic mint metadata now preserves the exact Base
  // name/symbol bytes (including lowercase) and fails closed on incompatibility.
  const resolvedBridgeToken: Address = bridgeToken
  const canonicalBridgeTokenPolicy = evaluateCanonicalBridgeTokenPolicy({
    bridgeToken: resolvedBridgeToken,
  })
  if (!canonicalBridgeTokenPolicy.allowed) {
    const statusCode = canonicalBridgeTokenPolicy.code === 'allowlist_missing' ? 503 : 409
    return res.status(statusCode).json({
      success: false,
      error:
        canonicalBridgeTokenPolicy.message ??
        'Bridge token is blocked by canonical wrapped-asset policy.',
    } satisfies ApiEnvelope<never>)
  }
  const explicitTokenMetadataUriRaw =
    typeof body?.tokenMetadataUri === 'string' ? body.tokenMetadataUri.trim() : ''
  const explicitTokenMetadataUri = explicitTokenMetadataUriRaw
    ? normalizeWrapTokenMetadataUri(explicitTokenMetadataUriRaw)
    : null
  if (explicitTokenMetadataUriRaw && !explicitTokenMetadataUri) {
    return res.status(400).json({
      success: false,
      error: 'Invalid tokenMetadataUri. Expected http(s)://, ipfs://, or ar:// URL.',
    } satisfies ApiEnvelope<never>)
  }
  const derivedTokenMetadataUri = resolveShareTokenMetadataUrls({
    address: resolvedBridgeToken,
    chainId: base.id,
    apiHost: process.env.API_HOST?.trim().replace(/\/+$/, '') || 'api.4626.fun',
    appHost: process.env.APP_HOST?.trim().replace(/\/+$/, ''),
  }).metadataUrl
  const tokenMetadataUri = explicitTokenMetadataUri ?? derivedTokenMetadataUri
  const expectedSolanaAmountBase = parseBigIntLike(body?.expectedSolanaAmount)
  const requestedShareDecimals = parseDecimals(body?.shareDecimals)

  const contracts = getApiContracts()
  const batcherRaw = typeof body?.batcherAddress === 'string' && isAddress(body.batcherAddress)
    ? body.batcherAddress
    : contracts.creatorVaultBatcher

  if (!batcherRaw || !isAddress(batcherRaw)) {
    return res.status(503).json({
      success: false,
      error: 'Deployment batcher (DeploymentBatcher) is not configured on server.',
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
        error: 'Solana bridge is not enabled on deployment batcher (DeploymentBatcher) (adapter/destination unset).',
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
        args: [resolvedBridgeToken],
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
    const evaluateEligibility = (routeReady: boolean | null) =>
      evaluateSolanaOvaultMintCompatibility({
        assetMintOrigin,
        hints: mintCompatibilityHints,
        routeReady,
        requireHintsForExisting: enforceCompatibility,
      })
    const buildCompatibilityError = (
      eligibility: ReturnType<typeof evaluateSolanaOvaultMintCompatibility>,
    ): string => {
      const blockers = eligibility.mintCompatibility.blockers
      const details = blockers.length > 0 ? blockers.join(' ') : 'Unknown compatibility failure.'
      return `Existing Solana mint is not OVault compatible: ${details}`
    }

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
        const hints = await resolveMeteoraAlphaVaultConfigHints({ creatorToken }).catch(() => null)
        const supersededHint =
          hints?.latestDbRowEnabled === false && hints.supersededReason
            ? ` Latest DB row is disabled (${hints.supersededReason})` +
              (hints.supersededNewMint ? `, replacement mint=${hints.supersededNewMint}` : '') +
              (hints.supersededNewAdapter ? `, replacement adapter=${hints.supersededNewAdapter}` : '') +
              '.'
            : ''
        return res.status(409).json({
          success: false,
          error:
            `Missing Meteora DLMM+Alpha Vault mapping for creator token ${creatorToken}. ` +
            'Add an active creator mapping in creator_meteora_alpha_vaults or METEORA_CREATOR_ALPHA_VAULT_MAP_JSON, then retry. ' +
            'If you are bootstrapping Solana side, run `pnpm -C cre run solana:bootstrap-side` with METEORA_ALPHA_VAULT, ' +
            `ALPHA_VAULT_PROGRAM_ID, and DEPOSIT_ACCOUNTS_JSON set.${supersededHint}`,
        } satisfies ApiEnvelope<never>)
      }
      if (readStrictSolPairEnabled()) {
        const quoteMint = String(meteoraConfig.quoteMint ?? '').trim()
        if (!quoteMint) {
          return res.status(409).json({
            success: false,
            error:
              `Strict SOL pair policy is enabled, but creator token ${creatorToken} does not define quoteMint. ` +
              `Set quoteMint=${SOLANA_NATIVE_MINT} in creator_meteora_alpha_vaults (or METEORA_CREATOR_ALPHA_VAULT_MAP_JSON).`,
          } satisfies ApiEnvelope<never>)
        }
        if (quoteMint !== SOLANA_NATIVE_MINT) {
          return res.status(409).json({
            success: false,
            error:
              `Strict SOL pair policy is enabled, but creator token ${creatorToken} is mapped to quote mint ${quoteMint}. ` +
              `Only ${SOLANA_NATIVE_MINT} is allowed.`,
          } satisfies ApiEnvelope<never>)
        }
      }
      const shareDecimals =
        requestedShareDecimals ??
        (await publicClient
          .readContract({
            address: resolvedBridgeToken,
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
        bridgeToken: resolvedBridgeToken,
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
        bridgeToken: resolvedBridgeToken,
        configSource: meteoraConfig.source,
        quoteMint: meteoraConfig.quoteMint,
        expectedSolanaAmountBase: expectedSolanaAmountBase.toString(),
        expectedRemoteAmount: expectedRemoteAmount.toString(),
        meteoraAlphaVault,
        ixCount: solanaIxs.length,
      })
    }

    if (alreadyRegistered) {
      const eligibility = evaluateEligibility(true)
      if (enforceCompatibility && !eligibility.existingMintCompatible) {
        return res.status(409).json({
          success: false,
          error: buildCompatibilityError(eligibility),
        } satisfies ApiEnvelope<never>)
      }
      return res.status(200).json({
        success: true,
        data: {
          bridgeToken: resolvedBridgeToken,
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
          mintCompatibility: eligibility.mintCompatibility,
          existingMintCompatible: eligibility.existingMintCompatible,
          depositEligible: eligibility.depositEligible,
          redeemEligible: eligibility.redeemEligible,
          assetPeerSet: eligibility.depositEligible,
          sharePeerSet: eligibility.redeemEligible,
        },
      } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
    }

    if (buildOnly) {
      const hintedMint = typeof body?.solanaMint === 'string' && isBytes32Hex(body.solanaMint.trim())
        ? (body.solanaMint.trim() as Hex)
        : readSolanaMintFromEnv()
      const eligibility = evaluateEligibility(false)
      if (enforceCompatibility && !eligibility.existingMintCompatible) {
        return res.status(409).json({
          success: false,
          error: buildCompatibilityError(eligibility),
        } satisfies ApiEnvelope<never>)
      }
      return res.status(200).json({
        success: true,
        data: {
          bridgeToken: resolvedBridgeToken,
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
          mintCompatibility: eligibility.mintCompatibility,
          existingMintCompatible: eligibility.existingMintCompatible,
          depositEligible: eligibility.depositEligible,
          redeemEligible: eligibility.redeemEligible,
          assetPeerSet: false,
          sharePeerSet: false,
        },
      } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
    }

    const shareCode = await publicClient.getBytecode({ address: resolvedBridgeToken }).catch(() => '0x' as Hex)
    if (!shareCode || shareCode === '0x') {
      return res.status(409).json({
        success: false,
        error:
          `Bridge token ${resolvedBridgeToken} has no bytecode yet. ` +
          'Ensure the token is deployed on Base before Solana registration.',
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
    const bridgeLivenessPolicy = readSolanaBridgeLivenessPolicy()
    const dynamicRouteEnabled = readDynamicSolanaRouteEnabled()
    const dynamicProvisionerUrls = dynamicRouteEnabled ? readDynamicProvisionerUrls() : []
    const dynamicProvisionerHealthUrls =
      dynamicProvisionerUrls.length > 0
        ? readDynamicProvisionerHealthUrls(dynamicProvisionerUrls)
        : []
    const dynamicProvisionerSecret =
      dynamicProvisionerUrls.length > 0 ? readDynamicProvisionerSecret() : ''
    let dynamicLivenessChecked = false
    let dynamicLivenessError: string | null = null
    const ensureDynamicProvisionerLiveness = async (): Promise<boolean> => {
      if (dynamicLivenessChecked) return dynamicLivenessError === null
      dynamicLivenessChecked = true

      if (!bridgeLivenessPolicy.enforced || !dynamicRouteEnabled) {
        dynamicLivenessError = null
        return true
      }
      // Local CLI-only dynamic provisioning does not expose external health probes.
      if (dynamicProvisionerUrls.length === 0) {
        dynamicLivenessError = null
        return true
      }

      const healthUrl =
        dynamicProvisionerHealthUrls[0] ||
        readDynamicProvisionerHealthUrl(dynamicProvisionerUrls[0] ?? '')
      if (!healthUrl) {
        dynamicLivenessError =
          'Bridge liveness gate is enabled, but SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL is not configured.'
        return false
      }

      const probe = await probeRemoteProvisionerHealth({
        url: healthUrl,
        secret: dynamicProvisionerSecret,
        timeoutMs: 4_000,
      })
      const liveness = evaluateRemoteProvisionerLiveness({
        enforced: true,
        maxHealthAgeSeconds: bridgeLivenessPolicy.maxHealthAgeSeconds,
        probe,
      })
      if (!liveness.healthy) {
        dynamicLivenessError = `Bridge liveness gate blocked dynamic route provisioning. ${liveness.blockers.join(' ')}`
        return false
      }

      dynamicLivenessError = null
      return true
    }
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
      const livenessReady = await ensureDynamicProvisionerLiveness()
      if (!livenessReady) {
        dynamicProvisionError = dynamicLivenessError
        logger.warn('[deploy/registerSolanaBridgeToken] Dynamic Solana route blocked by liveness gate', {
          caller: callerTag,
          bridgeToken,
          error: dynamicProvisionError,
        })
        return false
      }
      try {
        const dynamicMint = await tryProvisionDynamicRoute({
          bridgeToken,
          solanaDecimals,
          publicClient,
          tokenMetadataUri,
        })
        if (!dynamicMint) return false
        solanaMint = dynamicMint.mintBytes32
        mintCompatibilityHints = mergeMintCompatibilityHints(
          mintCompatibilityHints,
          dynamicMint.mintCompatibilityHints,
        )
        dynamicProvisionError = null
        return true
      } catch (error) {
        dynamicProvisionError = error instanceof Error ? error.message : String(error)
        logger.warn('[deploy/registerSolanaBridgeToken] Dynamic Solana route provisioning failed', {
          caller: callerTag,
          bridgeToken,
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

    const eligibility = evaluateEligibility(true)
    if (enforceCompatibility && !eligibility.existingMintCompatible) {
      return res.status(409).json({
        success: false,
        error: buildCompatibilityError(eligibility),
      } satisfies ApiEnvelope<never>)
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
      caller: callerTag,
      bridgeToken,
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
        mintCompatibility: eligibility.mintCompatibility,
        existingMintCompatible: eligibility.existingMintCompatible,
        depositEligible: eligibility.depositEligible,
        redeemEligible: eligibility.redeemEligible,
        assetPeerSet: eligibility.depositEligible,
        sharePeerSet: eligibility.redeemEligible,
      },
    } satisfies ApiEnvelope<RegisterSolanaBridgeTokenResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[deploy/registerSolanaBridgeToken] Registration failed', {
      caller: callerTag,
      bridgeToken,
      batcher,
      error: message,
    })
    return res.status(500).json({
      success: false,
      error: `Failed to auto-register Solana bridge token: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
