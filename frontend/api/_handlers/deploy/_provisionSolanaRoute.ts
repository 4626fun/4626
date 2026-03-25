import type { VercelRequest, VercelResponse } from '@vercel/node'

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

import { createPublicClient, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { logger } from '../../../server/_lib/logger.js'
import { evaluateCanonicalBridgeTokenPolicy } from '../../../server/_lib/solanaBridgePolicy.js'

type ProvisionRouteRequest = {
  bridgeToken?: string
  solanaDecimals?: number | string
  deployEnv?: string
  scalerExponent?: number | string
  payerKp?: string
  payForRelay?: boolean
}

type ProvisionRouteResponse = {
  bridgeToken: Address
  mintPubkey: string
  mintBytes32: Hex
  runner?: string
  tokenSymbol?: string
  routeScalar: string
}

type WrapRunner = {
  bin: string
  args: string[]
  label: string
}

const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
const execFileAsync = promisify(execFile)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((ch, idx) => [ch, idx]))

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
] as const

async function readBridgeTokenMetadata(params: {
  publicClient: any
  bridgeToken: Address
}): Promise<{ name: string; symbol: string } | null> {
  try {
    const [nameRaw, symbolRaw] = await Promise.all([
      params.publicClient.readContract({
        address: params.bridgeToken,
        abi: ERC20_METADATA_ABI,
        functionName: 'name',
      }),
      params.publicClient.readContract({
        address: params.bridgeToken,
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

function sanitizeWrapTokenName(raw: string, bridgeToken: Address): string {
  const fallback = `CreatorShare-${bridgeToken.slice(2, 8)}`
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

function sanitizeWrapTokenSymbolUnicode(raw: string, bridgeToken: Address): string {
  const fallback = `■${bridgeToken.slice(2, 6).toUpperCase()}`
  const normalized = String(raw ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/\s+/g, '')
  const cleaned = normalized.replace(/[^A-Z0-9■]/g, '')
  const resolved = cleaned || fallback
  return resolved.slice(0, WRAP_TOKEN_SYMBOL_MAX_LENGTH)
}

function sanitizeWrapTokenSymbolAscii(raw: string, bridgeToken: Address): string {
  const fallbackPrefixRaw = process.env.SOLANA_BRIDGE_WRAP_SYMBOL_PREFIX
  const fallbackPrefix = (fallbackPrefixRaw === undefined ? 'CS' : String(fallbackPrefixRaw))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const fallback = `${fallbackPrefix}${bridgeToken.slice(2, 6).toUpperCase()}`
  const cleaned = String(raw ?? '')
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const resolved = cleaned || fallback
  return resolved.slice(0, WRAP_TOKEN_SYMBOL_MAX_LENGTH)
}

function buildWrapTokenSymbolCandidates(raw: string, bridgeToken: Address): string[] {
  const mode = readWrapTokenSymbolMode()
  const unicode = sanitizeWrapTokenSymbolUnicode(raw, bridgeToken)
  const ascii = sanitizeWrapTokenSymbolAscii(raw, bridgeToken)
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
    lower.includes('invalid character')
  )
}

function readProvisionerSecret(): string {
  return String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET ??
      process.env.SOLANA_BRIDGE_PROVISIONER_SECRET ??
      '',
  ).trim()
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = readProvisionerSecret()
  // If no secret is configured, deny by default for safety.
  if (!secret) return false
  const header = String(req.headers.authorization ?? '').trim()
  return header === `Bearer ${secret}`
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<ProvisionRouteRequest>(req)
  const bridgeTokenRaw = typeof body?.bridgeToken === 'string' ? body.bridgeToken.trim() : ''
  if (!isAddress(bridgeTokenRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid bridgeToken address' } satisfies ApiEnvelope<never>)
  }
  const bridgeToken = bridgeTokenRaw as Address
  const canonicalBridgeTokenPolicy = evaluateCanonicalBridgeTokenPolicy({ bridgeToken })
  if (!canonicalBridgeTokenPolicy.allowed) {
    const statusCode = canonicalBridgeTokenPolicy.code === 'allowlist_missing' ? 503 : 409
    return res.status(statusCode).json({
      success: false,
      error:
        canonicalBridgeTokenPolicy.message ??
        'Bridge token is blocked by canonical wrapped-asset policy.',
    } satisfies ApiEnvelope<never>)
  }

  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  if (!cliDir || !existsSync(cliDir)) {
    return res.status(503).json({
      success: false,
      error: 'SOLANA_BRIDGE_CLI_DIR is not configured or does not exist on this runtime.',
    } satisfies ApiEnvelope<never>)
  }

  const solanaDecimals = parseDecimals(body?.solanaDecimals) ?? 9
  const deployEnv = String(body?.deployEnv ?? process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet'
  const scalerExponent = parseDecimals(body?.scalerExponent) ?? parseDecimals(process.env.SOLANA_BRIDGE_SCALER_EXPONENT) ?? solanaDecimals
  const payerKp = String(body?.payerKp ?? process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'auto').trim() || 'auto'
  const payForRelay = typeof body?.payForRelay === 'boolean'
    ? body.payForRelay
    : String(process.env.SOLANA_BRIDGE_PAY_FOR_RELAY ?? '1').trim() !== '0'
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })
  const bridgeTokenMetadata = await readBridgeTokenMetadata({ publicClient, bridgeToken })
  if (!bridgeTokenMetadata) {
    return res.status(409).json({
      success: false,
      error: 'Bridge token metadata unavailable. Name/symbol are required for Solana route provisioning.',
    } satisfies ApiEnvelope<never>)
  }
  const tokenName = sanitizeWrapTokenName(bridgeTokenMetadata.name, bridgeToken)
  const tokenSymbolCandidates = buildWrapTokenSymbolCandidates(bridgeTokenMetadata.symbol, bridgeToken)

  try {
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
        String(solanaDecimals),
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

    let combined = ''
    let runner = ''
    let tokenSymbolUsed = tokenSymbolCandidates[0] ?? ''
    let wrapError: unknown = null
    for (let i = 0; i < tokenSymbolCandidates.length; i += 1) {
      const candidate = tokenSymbolCandidates[i]
      logger.info('[deploy/provisionSolanaRoute] Starting wrap-token provisioning', {
        bridgeToken,
        deployEnv,
        tokenName,
        tokenSymbol: candidate,
        tokenSymbolCandidate: `${i + 1}/${tokenSymbolCandidates.length}`,
        payerKp,
        cliDir,
      })
      try {
        const result = await runWrapToken(cliDir, cliBin, buildWrapArgs(candidate))
        combined = result.output
        runner = result.runner
        tokenSymbolUsed = candidate
        wrapError = null
        break
      } catch (error) {
        wrapError = error
        const message = error instanceof Error ? error.message : String(error)
        const hasFallback = i < tokenSymbolCandidates.length - 1
        const shouldFallback = hasFallback && isLikelyUnicodeSymbolUnsupportedError(message)
        logger.warn('[deploy/provisionSolanaRoute] Symbol candidate failed', {
          bridgeToken,
          tokenSymbol: candidate,
          tokenSymbolCandidate: `${i + 1}/${tokenSymbolCandidates.length}`,
          fallback: shouldFallback,
          error: message,
        })
        if (!shouldFallback) throw error
      }
    }
    if (wrapError) throw wrapError

    const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
    if (!mintPubkey) {
      return res.status(500).json({
        success: false,
        error: `Could not parse mint pubkey from wrap-token output: ${combined.slice(-1200)}`,
      } satisfies ApiEnvelope<never>)
    }
    const mintBytes32 = solanaPubkeyToBytes32Hex(mintPubkey)

    let scalar = 0n
    for (let i = 0; i < 24; i += 1) {
      scalar = await publicClient
        .readContract({
          address: BASE_SOLANA_BRIDGE,
          abi: BASE_SOLANA_BRIDGE_ABI,
          functionName: 'scalars',
          args: [bridgeToken, mintBytes32],
        })
        .then((v) => BigInt(v as bigint))
        .catch(() => 0n)
      if (scalar > 0n) break
      await new Promise((resolve) => setTimeout(resolve, 5_000))
    }

    if (scalar === 0n) {
      return res.status(500).json({
        success: false,
        error: `Route scalar remained 0 for ${bridgeToken} and ${mintBytes32} after wrap-token.`,
      } satisfies ApiEnvelope<never>)
    }

    return res.status(200).json({
      success: true,
      data: {
        bridgeToken,
        mintPubkey,
        mintBytes32,
        runner,
        tokenSymbol: tokenSymbolUsed,
        routeScalar: scalar.toString(),
      },
    } satisfies ApiEnvelope<ProvisionRouteResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('[deploy/provisionSolanaRoute] Provisioning failed', {
      bridgeToken,
      error: message,
    })
    return res.status(500).json({
      success: false,
      error: `Failed to provision dynamic Solana route: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
