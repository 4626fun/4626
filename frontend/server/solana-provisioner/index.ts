import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { createHash, timingSafeEqual } from 'node:crypto'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { createPublicClient, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

const execFileAsync = promisify(execFile)
const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'
const SOLANA_SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const SOLANA_TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
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

type ProvisionBody = {
  bridgeToken?: string
  deployEnv?: string
  solanaDecimals?: number | string
  tokenName?: string
  tokenSymbol?: string
  tokenSymbolFallback?: string
  tokenMetadataUri?: string
  scalerExponent?: number | string
  payerKp?: string
  payForRelay?: boolean
}

type MeteoraAccountMetaBody = {
  pubkey?: string
  isSigner?: boolean
  isWritable?: boolean
}

type MeteoraIxsBody = {
  creatorToken?: string
  bridgeToken?: string
  meteoraAlphaVault?: string
  alphaVaultProgramId?: string
  expectedRemoteAmount?: number | string
  depositAccounts?: MeteoraAccountMetaBody[]
}

type WrapRunner = {
  bin: string
  args: string[]
  label: string
}

const PROVISIONER_MAX_BODY_BYTES = 64 * 1024
const PROVISIONER_HEALTH_DEBUG_ENABLED = parseBooleanEnv(process.env.PROVISIONER_HEALTH_DEBUG, false)
const PROVISIONER_EXTENDED_ENDPOINTS_ENABLED = parseBooleanEnv(process.env.PROVISIONER_EXTENDED_ENDPOINTS, false)

type ProvisionerMintCompatibilityHints = {
  tokenProgram: 'spl-token' | 'token-2022' | null
  transferHookDetected: boolean | null
  oftFeeBps: number | null
  adapterMode: 'regular-oft' | 'oft-adapter' | null
  authorityCompatible: boolean | null
  rentValueLamports: string | null
}

const WRAP_TOKEN_NAME_MAX_LENGTH = 32
const WRAP_TOKEN_SYMBOL_MAX_LENGTH = 12
const WRAP_TOKEN_METADATA_URI_MAX_LENGTH = 512
type WrapTokenSymbolMode = 'auto' | 'unicode' | 'ascii'

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
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

function parseEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(String(value).trim(), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function readProvisionerWrapRetryAttempts(): number {
  const attempts = parseEnvInt(process.env.PROVISIONER_WRAP_RETRY_ATTEMPTS, 3)
  return Math.min(Math.max(attempts, 1), 8)
}

function readProvisionerWrapRetryDelayMs(): number {
  const delayMs = parseEnvInt(process.env.PROVISIONER_WRAP_RETRY_DELAY_MS, 1_200)
  return Math.max(delayMs, 0)
}

function isRetryableWrapTokenError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('blockhash not found') ||
    lower.includes('transaction simulation failed') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up')
  )
}

function parseMintPubkeyFromWrapOutput(text: string): string | null {
  const match = text.match(/Mint:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

function parseMintPubkeyFromAlreadyExistsError(text: string): string | null {
  const match = text.match(/Address\s*\{\s*address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

function parseMintPubkeyFromConstraintSeedsError(text: string): string | null {
  const match = text.match(
    /Program log:\s*Right:\s*[\s\S]{0,300}?Program log:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i,
  )
  return match?.[1] ?? null
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

function parseUint64(value: unknown): bigint | null {
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

function encodeU64LE(value: bigint): Buffer {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new Error('u64_out_of_range')
  }
  const out = Buffer.alloc(8)
  let v = value
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function encodeAnchorDiscriminator(signature: string): Buffer {
  return createHash('sha256').update(signature).digest().subarray(0, 8)
}

function serializeAccountMeta(meta: { pubkey: string; isSigner: boolean; isWritable: boolean }): Hex {
  const pubkey = solanaPubkeyToBytes32Hex(meta.pubkey).slice(2)
  const signer = meta.isSigner ? '01' : '00'
  const writable = meta.isWritable ? '01' : '00'
  return `0x${pubkey}${signer}${writable}` as Hex
}

function envBool(key: string, fallback = false): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function readStrictSolPairEnabled(): boolean {
  return envBool('SOLANA_STRICT_SOL_PAIR', true)
}

function readAdapterModeHint(): 'regular-oft' | 'oft-adapter' | null {
  const raw = String(process.env.SOLANA_OVAULT_ADAPTER_MODE ?? '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'regular-oft' || raw === 'regular' || raw === 'oft') return 'regular-oft'
  if (raw === 'oft-adapter' || raw === 'adapter') return 'oft-adapter'
  return null
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

function deepFindNumberByKey(value: unknown, keys: string[]): number | null {
  const want = new Set(keys.map((k) => k.toLowerCase()))
  const seen = new Set<unknown>()
  const stack: unknown[] = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
      continue
    }
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (want.has(key.toLowerCase())) {
        const parsed = parseNonNegativeInt(nested)
        if (parsed !== null) return parsed
      }
      stack.push(nested)
    }
  }
  return null
}

function ownerToTokenProgram(ownerRaw: unknown): 'spl-token' | 'token-2022' | null {
  const owner =
    typeof ownerRaw === 'string'
      ? ownerRaw
      : ownerRaw && typeof (ownerRaw as any).toBase58 === 'function'
        ? String((ownerRaw as any).toBase58())
        : ''
  if (owner === SOLANA_SPL_TOKEN_PROGRAM) return 'spl-token'
  if (owner === SOLANA_TOKEN_2022_PROGRAM) return 'token-2022'
  return null
}

function detectTransferHookFromParsedInfo(info: unknown): boolean | null {
  if (!info || typeof info !== 'object') return null
  const serialized = JSON.stringify(info).toLowerCase()
  if (!serialized) return null
  return (
    serialized.includes('transferhook') ||
    serialized.includes('transfer_hook') ||
    serialized.includes('transfer hook')
  )
}

function readAuthorityCompatibleHint(params: {
  parsedInfo: unknown
  payerPubkey: string | null
}): boolean | null {
  const info = params.parsedInfo as Record<string, unknown> | null
  if (!info || typeof info !== 'object') return null
  const mintAuthority = typeof info.mintAuthority === 'string' ? info.mintAuthority : null
  const freezeAuthority = typeof info.freezeAuthority === 'string' ? info.freezeAuthority : null
  if (!params.payerPubkey) {
    // Conservative default when payer authority is unknown: require authorities to be immutable.
    return mintAuthority === null && freezeAuthority === null
  }
  const payer = params.payerPubkey
  const mintOk = mintAuthority === null || mintAuthority === payer
  const freezeOk = freezeAuthority === null || freezeAuthority === payer
  return mintOk && freezeOk
}

async function readMintCompatibilityHints(params: {
  mintPubkey: string
  payerPubkey: string | null
}): Promise<ProvisionerMintCompatibilityHints> {
  const fallbackAdapterMode = readAdapterModeHint()
  const out: ProvisionerMintCompatibilityHints = {
    tokenProgram: null,
    transferHookDetected: null,
    oftFeeBps: null,
    adapterMode: fallbackAdapterMode,
    authorityCompatible: null,
    rentValueLamports: null,
  }

  const rpcUrl =
    String(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim()
    || 'https://api.mainnet-beta.solana.com'
  try {
    const connection = new Connection(rpcUrl, 'confirmed')
    const mintKey = new PublicKey(params.mintPubkey)
    const accountInfo = await connection.getParsedAccountInfo(mintKey, 'confirmed')
    const value: any = accountInfo?.value
    if (!value) return out

    out.tokenProgram = ownerToTokenProgram(value.owner)
    if (typeof value.lamports === 'number' && Number.isFinite(value.lamports) && value.lamports >= 0) {
      out.rentValueLamports = BigInt(Math.floor(value.lamports)).toString()
    }

    const parsedInfo = (value?.data as any)?.parsed?.info
    const transferHookDetected = detectTransferHookFromParsedInfo(parsedInfo)
    if (transferHookDetected !== null) out.transferHookDetected = transferHookDetected

    const detectedFeeBps = deepFindNumberByKey(parsedInfo, [
      'transferFeeBasisPoints',
      'newerTransferFeeBasisPoints',
      'basisPoints',
      'feeBps',
      'fee_basis_points',
    ])
    if (detectedFeeBps !== null) out.oftFeeBps = detectedFeeBps
    if (out.transferHookDetected === false && out.oftFeeBps === null) {
      out.oftFeeBps = 0
    }

    const authorityCompatible = readAuthorityCompatibleHint({
      parsedInfo,
      payerPubkey: params.payerPubkey,
    })
    if (authorityCompatible !== null) out.authorityCompatible = authorityCompatible
    if (out.authorityCompatible === null) out.authorityCompatible = true
    if (out.transferHookDetected === null) out.transferHookDetected = false
    return out
  } catch (error) {
    process.stderr.write(
      `[solana-provisioner] mint compatibility hint probe failed for ${params.mintPubkey}: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    return out
  }
}

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

function readWrapTokenMetadataUriEnabled(): boolean {
  const raw = String(process.env.SOLANA_BRIDGE_WRAP_METADATA_URI_ENABLED ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return false
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function normalizeWrapTokenMetadataUri(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (value.length > WRAP_TOKEN_METADATA_URI_MAX_LENGTH) return null
  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'ipfs:' && protocol !== 'ar:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
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
  const fallbackPrefix = (
    fallbackPrefixRaw === undefined ? 'CS' : String(fallbackPrefixRaw).trim().toUpperCase()
  ).replace(/[^A-Z0-9]/g, '')
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

function resolveProvisionerTokenSymbolCandidates(params: {
  bridgeToken: Address
  metadataSymbol: string | null
  requestedPrimarySymbol: string | null
  requestedFallbackSymbol: string | null
}): string[] {
  const primaryRaw =
    String(params.requestedPrimarySymbol ?? '').trim() ||
    String(params.metadataSymbol ?? '').trim() ||
    String(params.requestedFallbackSymbol ?? '').trim()
  const out = buildWrapTokenSymbolCandidates(primaryRaw, params.bridgeToken)
  const pushUnique = (value: string): void => {
    if (!value || out.includes(value)) return
    out.push(value)
  }
  const appendRaw = (raw: string | null): void => {
    const value = String(raw ?? '').trim()
    if (!value) return
    pushUnique(sanitizeWrapTokenSymbolUnicode(value, params.bridgeToken))
    pushUnique(sanitizeWrapTokenSymbolAscii(value, params.bridgeToken))
  }
  // Always keep an explicit fallback candidate when caller provides one, even if
  // mode is "unicode", so we can recover from seed/metadata constraints.
  appendRaw(params.requestedFallbackSymbol)
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

function isLikelyUnsupportedMetadataUriFlagError(message: string): boolean {
  const lower = message.toLowerCase()
  const mentionsMetadataUri =
    lower.includes('--metadata-uri') ||
    lower.includes('metadata-uri') ||
    lower.includes('--metadatauri') ||
    lower.includes('metadatauri')
  if (!mentionsMetadataUri) return false
  return (
    lower.includes('unknown option') ||
    lower.includes('unknown argument') ||
    lower.includes('unexpected argument') ||
    lower.includes('unrecognized option') ||
    lower.includes('wasn\'t expected') ||
    lower.includes('unexpected value')
  )
}

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

function readBody(req: IncomingMessage, maxBytes = PROVISIONER_MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const lengthHeader = String(req.headers['content-length'] ?? '').trim()
    const declaredLength = lengthHeader ? Number(lengthHeader) : NaN
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      reject(new Error('request_body_too_large'))
      req.resume()
      return
    }
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > maxBytes) {
        reject(new Error('request_body_too_large'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function authOk(req: IncomingMessage, secret: string): boolean {
  if (!secret) return false
  const header = String(req.headers.authorization ?? '')
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function readFirstNonEmptyEnv(keys: string[]): { value: string; source: string | null } {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim()
    if (value) return { value, source: key }
  }
  return { value: '', source: null }
}

function readProvisionerBearerSecret(): { value: string; source: string | null } {
  return readFirstNonEmptyEnv([
    'PROVISIONER_BEARER_TOKEN',
    'SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET',
    'METEORA_IX_PROVISIONER_SECRET',
  ])
}

function parseMinPayerSol(): number {
  const raw = String(process.env.PROVISIONER_MIN_PAYER_SOL ?? '0.05').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 0.05
  return parsed
}

function parseSecretKeyBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed) || parsed.length !== 64) return null
    if (!parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return null
    return Uint8Array.from(parsed as number[])
  } catch {
    return null
  }
}

function readSecretKeyFromFile(path: string): Uint8Array | null {
  if (!path || !existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf8')
    return parseSecretKeyBytes(raw)
  } catch {
    return null
  }
}

function resolveProvisionerPayerKeypair(): { keypair: Keypair | null; source: string } {
  const payerRef = String(process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  if (payerRef === 'config') {
    const home = String(process.env.HOME ?? '').trim()
    const keypairPath = home ? `${home}/.config/solana/id.json` : ''
    const bytes = readSecretKeyFromFile(keypairPath)
    if (!bytes) return { keypair: null, source: `config:${keypairPath || '<unknown>'}` }
    try {
      return { keypair: Keypair.fromSecretKey(bytes), source: `config:${keypairPath}` }
    } catch {
      return { keypair: null, source: `config:${keypairPath}` }
    }
  }
  const inlineBytes = parseSecretKeyBytes(payerRef)
  if (inlineBytes) {
    try {
      return { keypair: Keypair.fromSecretKey(inlineBytes), source: 'inline-secret-key' }
    } catch {
      return { keypair: null, source: 'inline-secret-key' }
    }
  }
  const fileBytes = readSecretKeyFromFile(payerRef)
  if (fileBytes) {
    try {
      return { keypair: Keypair.fromSecretKey(fileBytes), source: `file:${payerRef}` }
    } catch {
      return { keypair: null, source: `file:${payerRef}` }
    }
  }
  return { keypair: null, source: `unresolved:${payerRef}` }
}

async function readProvisionerPayerHealth(): Promise<{
  payerConfigured: boolean
  payerSource: string
  payerPubkey: string | null
  payerBalanceLamports: string | null
  payerBalanceSol: string | null
  payerMinSol: string
  payerHealthy: boolean
  payerError: string | null
}> {
  const minSol = parseMinPayerSol()
  const minLamports = BigInt(Math.ceil(minSol * 1_000_000_000))
  const { keypair, source } = resolveProvisionerPayerKeypair()
  if (!keypair) {
    return {
      payerConfigured: false,
      payerSource: source,
      payerPubkey: null,
      payerBalanceLamports: null,
      payerBalanceSol: null,
      payerMinSol: minSol.toString(),
      payerHealthy: false,
      payerError: 'Unable to resolve SOLANA_BRIDGE_PAYER_KP keypair.',
    }
  }

  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim()
    || 'https://api.mainnet-beta.solana.com'
  try {
    const connection = new Connection(rpcUrl, 'confirmed')
    const lamports = await connection.getBalance(keypair.publicKey, 'confirmed')
    const balanceLamports = BigInt(lamports)
    const wholeSol = balanceLamports / 1_000_000_000n
    const fractionalLamports = balanceLamports % 1_000_000_000n
    const balanceSol = `${wholeSol.toString()}.${fractionalLamports.toString().padStart(9, '0')}`
    return {
      payerConfigured: true,
      payerSource: source,
      payerPubkey: keypair.publicKey.toBase58(),
      payerBalanceLamports: balanceLamports.toString(),
      payerBalanceSol: balanceSol,
      payerMinSol: minSol.toString(),
      payerHealthy: balanceLamports >= minLamports,
      payerError: null,
    }
  } catch (error) {
    return {
      payerConfigured: true,
      payerSource: source,
      payerPubkey: keypair.publicKey.toBase58(),
      payerBalanceLamports: null,
      payerBalanceSol: null,
      payerMinSol: minSol.toString(),
      payerHealthy: false,
      payerError: error instanceof Error ? error.message : String(error),
    }
  }
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

async function runWrapTokenWithRetry(
  cliDir: string,
  cliBinRaw: string,
  wrapArgs: string[],
): Promise<{ output: string; runner: string }> {
  const retryAttempts = readProvisionerWrapRetryAttempts()
  const retryDelayMs = readProvisionerWrapRetryDelayMs()

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      return await runWrapToken(cliDir, cliBinRaw, wrapArgs)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = isRetryableWrapTokenError(message)
      const willRetry = retryable && attempt < retryAttempts
      process.stderr.write(
        `[solana-provisioner] wrap-token attempt failed attempt=${attempt}/${retryAttempts} retryable=${retryable} willRetry=${willRetry}: ${message}\n`,
      )
      if (!willRetry) throw error
      const backoffMs = retryDelayMs * attempt
      if (backoffMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw new Error('wrap-token failed after retries')
}

async function handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliExists = !!cliDir && existsSync(cliDir)
  const provisionerSecret = readProvisionerBearerSecret()
  const secretSet = provisionerSecret.value.length > 0
  if (secretSet && !authOk(req, provisionerSecret.value)) {
    return json(res, 401, {
      ok: false,
      service: 'solana-route-provisioner',
      error: 'Unauthorized',
    })
  }
  const payerHealth = await readProvisionerPayerHealth()
  const payload: Record<string, unknown> = {
    ok: cliExists && secretSet && payerHealth.payerHealthy,
    service: 'solana-route-provisioner',
    cliExists,
    secretSet,
    payerConfigured: payerHealth.payerConfigured,
    payerHealthy: payerHealth.payerHealthy,
    payerError: payerHealth.payerError,
    baseRpcConfigured: String(process.env.BASE_RPC_URL ?? '').trim().length > 0,
    solanaRpcConfigured: String(process.env.SOLANA_RPC_URL ?? '').trim().length > 0,
    deployEnvDefault: String(process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet',
    now: new Date().toISOString(),
  }
  if (PROVISIONER_HEALTH_DEBUG_ENABLED) {
    payload.cliDir = cliDir
    payload.secretSource = provisionerSecret.source
    payload.payerSource = payerHealth.payerSource
    payload.payerPubkey = payerHealth.payerPubkey
    payload.payerBalanceLamports = payerHealth.payerBalanceLamports
    payload.payerBalanceSol = payerHealth.payerBalanceSol
    payload.payerMinSol = payerHealth.payerMinSol
  }
  json(res, 200, payload)
}

async function handleProvision(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) {
    return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  }
  if (!authOk(req, secret)) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  if (!cliDir || !existsSync(cliDir)) {
    return json(res, 503, {
      success: false,
      error: 'SOLANA_BRIDGE_CLI_DIR is not configured or does not exist on this runtime.',
    })
  }

  let body: ProvisionBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as ProvisionBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const bridgeTokenRaw = String(body?.bridgeToken ?? '').trim()
  if (!isAddress(bridgeTokenRaw)) {
    return json(res, 400, { success: false, error: 'Invalid bridgeToken address' })
  }
  const bridgeToken = bridgeTokenRaw as Address

  const solanaDecimals = parseDecimals(body?.solanaDecimals) ?? parseDecimals(process.env.SOLANA_DEFAULT_MINT_DECIMALS) ?? 9
  const deployEnv = String(body?.deployEnv ?? process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet'
  const scalerExponent =
    parseDecimals(body?.scalerExponent) ??
    parseDecimals(process.env.SOLANA_BRIDGE_SCALER_EXPONENT) ??
    solanaDecimals
  const payerKp = String(body?.payerKp ?? process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'auto').trim() || 'auto'
  const payForRelay =
    typeof body?.payForRelay === 'boolean' ? body.payForRelay : envBool('SOLANA_BRIDGE_PAY_FOR_RELAY', true)
  const provisionerPayer = resolveProvisionerPayerKeypair()
  const provisionerPayerPubkey = provisionerPayer.keypair?.publicKey?.toBase58?.() ?? null
  const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })
  const bridgeTokenMetadata = await readBridgeTokenMetadata({ publicClient, bridgeToken })
  const tokenName = sanitizeWrapTokenName(
    bridgeTokenMetadata?.name ?? String(body?.tokenName ?? ''),
    bridgeToken,
  )
  const tokenSymbolCandidates = resolveProvisionerTokenSymbolCandidates({
    bridgeToken,
    metadataSymbol: bridgeTokenMetadata?.symbol ?? null,
    requestedPrimarySymbol:
      typeof body?.tokenSymbol === 'string' ? body.tokenSymbol.trim() : null,
    requestedFallbackSymbol:
      typeof body?.tokenSymbolFallback === 'string' ? body.tokenSymbolFallback.trim() : null,
  })
  const tokenMetadataUriRaw =
    typeof body?.tokenMetadataUri === 'string' ? body.tokenMetadataUri.trim() : ''
  const tokenMetadataUri = tokenMetadataUriRaw
    ? normalizeWrapTokenMetadataUri(tokenMetadataUriRaw)
    : null
  if (tokenMetadataUriRaw && !tokenMetadataUri) {
    return json(res, 400, {
      success: false,
      error: 'Invalid tokenMetadataUri. Expected http(s)://, ipfs://, or ar:// URL.',
    })
  }
  const includeMetadataUriByDefault = readWrapTokenMetadataUriEnabled() && Boolean(tokenMetadataUri)
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
    if (includeMetadataUri && tokenMetadataUri) {
      args.push('--metadata-uri', tokenMetadataUri)
    }
    if (payForRelay) args.push('--pay-for-relay')
    return args
  }

  try {
    let combined = ''
    let runner = ''
    let tokenSymbolUsed = tokenSymbolCandidates[0] ?? ''
    let wrapError: unknown = null
    for (let i = 0; i < tokenSymbolCandidates.length; i += 1) {
      const candidate = tokenSymbolCandidates[i]
      try {
        const metadataAttempts = includeMetadataUriByDefault ? [true, false] : [false]
        let result: { output: string; runner: string } | null = null
        for (let metadataIdx = 0; metadataIdx < metadataAttempts.length; metadataIdx += 1) {
          const includeMetadataUri = metadataAttempts[metadataIdx]
          try {
            result = await runWrapTokenWithRetry(cliDir, cliBin, buildWrapArgs(candidate, includeMetadataUri))
            break
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const canRetryWithoutMetadata =
              includeMetadataUriByDefault &&
              includeMetadataUri &&
              isLikelyUnsupportedMetadataUriFlagError(message)
            if (!canRetryWithoutMetadata) throw error
            process.stderr.write(
              `[solana-provisioner] wrap-token metadata-uri flag unsupported; retrying without metadata-uri symbol=${candidate}: ${message}\n`,
            )
          }
        }
        if (!result) {
          throw new Error('wrap-token did not return output')
        }
        combined = result.output
        runner = result.runner
        tokenSymbolUsed = candidate
        wrapError = null
        break
      } catch (error) {
        wrapError = error
        const message = error instanceof Error ? error.message : String(error)
        const hasFallback = i < tokenSymbolCandidates.length - 1
        const unicodeHint = isLikelyUnicodeSymbolUnsupportedError(message)
        const shouldFallback = hasFallback && !isRunnerUnavailable(error)
        process.stderr.write(
          `[solana-provisioner] wrap-token symbol candidate failed index=${i + 1}/${tokenSymbolCandidates.length} symbol=${candidate} fallback=${shouldFallback} unicodeHint=${unicodeHint}: ${message}\n`,
        )
        if (!shouldFallback) throw error
      }
    }
    if (wrapError) throw wrapError

    const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
    if (!mintPubkey) {
      return json(res, 500, {
        success: false,
        error: `Could not parse mint pubkey from wrap-token output: ${combined.slice(-1200)}`,
      })
    }
    const mintBytes32 = solanaPubkeyToBytes32Hex(mintPubkey)
    const mintCompatibilityHints = await readMintCompatibilityHints({
      mintPubkey,
      payerPubkey: provisionerPayerPubkey,
    })
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
      return json(res, 500, {
        success: false,
        error: `Route scalar remained 0 for ${bridgeToken} and ${mintBytes32} after wrap-token.`,
      })
    }

    // ── Post-provision: DLMM pool + Alpha Vault (opt-in) ──────────────
    // When SOLANA_AUTO_POOL=1 and CRE scripts are available, automatically
    // create a Meteora DLMM pool and Alpha Vault for the newly created mint.
    // This eliminates the chicken-and-egg problem where Phase 2 Finalize
    // needs a Meteora vault but the mint doesn't exist until wrap-token runs.
    let poolResult: { signature?: string; error?: string } | null = null
    let vaultResult: { vault?: string; signature?: string; error?: string } | null = null

    if (envBool('SOLANA_AUTO_POOL', false)) {
      const repoRoot = String(process.env.CRE_REPO_ROOT ?? process.env.REPO_ROOT ?? '').trim()
      const creDir = repoRoot ? `${repoRoot}/cre` : ''
      const strictSolPair = readStrictSolPairEnabled()
      const configuredQuoteMint = String(process.env.SOLANA_POOL_QUOTE_MINT ?? SOLANA_NATIVE_MINT).trim()
      const quoteMint = strictSolPair ? SOLANA_NATIVE_MINT : configuredQuoteMint
      const binStep = String(process.env.SOLANA_POOL_BIN_STEP ?? '25').trim()
      const poolFeeBps = String(process.env.SOLANA_POOL_FEE_BPS ?? '100').trim()
      if (strictSolPair && configuredQuoteMint && configuredQuoteMint !== SOLANA_NATIVE_MINT) {
        process.stderr.write(
          `[solana-provisioner] SOLANA_STRICT_SOL_PAIR=1 forcing quote mint ${SOLANA_NATIVE_MINT} (ignoring SOLANA_POOL_QUOTE_MINT=${configuredQuoteMint})\n`,
        )
      }

      if (creDir && existsSync(creDir)) {
        // Step 1: Create DLMM pool
        try {
          process.stderr.write(`[solana-provisioner] Creating DLMM pool for ${mintPubkey}...\n`)
          const poolEnv = {
            ...process.env,
            TOKEN_MINT_X: mintPubkey,
            TOKEN_MINT_Y: quoteMint,
            BIN_STEP: binStep,
            ACTIVE_ID: '0',
            FEE_BPS: poolFeeBps,
          }
          const { stdout: poolOut, stderr: poolErr } = await execFileAsync(
            'node',
            [`${creDir}/_create-pool.cjs`],
            { cwd: creDir, timeout: 3 * 60_000, maxBuffer: 4 * 1024 * 1024, env: poolEnv },
          )
          if (poolErr) process.stderr.write(poolErr)
          const sigMatch = (poolOut ?? '').match(/Signature:\s*(\S+)/)
          poolResult = { signature: sigMatch?.[1] ?? undefined }
          process.stderr.write(`[solana-provisioner] DLMM pool created: ${sigMatch?.[1] ?? 'unknown'}\n`)
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          poolResult = { error: errMsg }
          process.stderr.write(`[solana-provisioner] DLMM pool creation failed (non-fatal): ${errMsg}\n`)
        }

        // Step 2: Create Alpha Vault (only if pool succeeded)
        if (poolResult && !poolResult.error) {
          try {
            process.stderr.write(`[solana-provisioner] Creating Alpha Vault for ${mintPubkey}...\n`)
            const vaultEnv = {
              ...process.env,
              TOKEN_MINT: mintPubkey,
              // DLMM_POOL will be auto-derived by the script from the mint pair
            }
            const { stdout: vaultOut, stderr: vaultErr } = await execFileAsync(
              'node',
              [`${creDir}/_create-vault.cjs`],
              { cwd: creDir, timeout: 3 * 60_000, maxBuffer: 4 * 1024 * 1024, env: vaultEnv },
            )
            if (vaultErr) process.stderr.write(vaultErr)
            const vaultMatch = (vaultOut ?? '').match(/Vault:\s*(\S+)/)
            const vaultSigMatch = (vaultOut ?? '').match(/Signature:\s*(\S+)/)
            vaultResult = { vault: vaultMatch?.[1], signature: vaultSigMatch?.[1] }
            process.stderr.write(`[solana-provisioner] Alpha Vault created: ${vaultMatch?.[1] ?? 'unknown'}\n`)
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            vaultResult = { error: errMsg }
            process.stderr.write(`[solana-provisioner] Alpha Vault creation failed (non-fatal): ${errMsg}\n`)
          }
        }
      } else {
        process.stderr.write(`[solana-provisioner] SOLANA_AUTO_POOL=1 but CRE_REPO_ROOT not configured; skipping pool/vault\n`)
      }
    }

    return json(res, 200, {
      success: true,
      mintBytes32,
      data: {
        bridgeToken,
        mintPubkey,
        mintBytes32,
        runner,
        tokenSymbol: tokenSymbolUsed,
        routeScalar: scalar.toString(),
        mintCompatibilityHints,
        pool: poolResult,
        alphaVault: vaultResult,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Idempotency: if wrap-token fails because mint account already exists,
    // recover by extracting the mint pubkey and verifying route scalar.
    const existingMintPubkey =
      parseMintPubkeyFromAlreadyExistsError(message) ||
      parseMintPubkeyFromConstraintSeedsError(message)
    if (existingMintPubkey) {
      try {
        const mintBytes32 = solanaPubkeyToBytes32Hex(existingMintPubkey)
        const mintCompatibilityHints = await readMintCompatibilityHints({
          mintPubkey: existingMintPubkey,
          payerPubkey: provisionerPayerPubkey,
        })
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
        if (scalar > 0n) {
          return json(res, 200, {
            success: true,
            mintBytes32,
            data: {
              bridgeToken,
              mintPubkey: existingMintPubkey,
              mintBytes32,
              runner: 'existing-mint-reuse',
              routeScalar: scalar.toString(),
              mintCompatibilityHints,
            },
          })
        }
      } catch {
        // Fall through to standard error response below.
      }
    }

    return json(res, 500, {
      success: false,
      error: `Failed to provision dynamic Solana route: ${message}`,
    })
  }
}

async function handleBuildMeteoraIxs(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) {
    return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  }
  if (!authOk(req, secret)) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  let body: MeteoraIxsBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as MeteoraIxsBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const meteoraAlphaVault = String(body?.meteoraAlphaVault ?? '').trim()
  const alphaVaultProgramId = String(body?.alphaVaultProgramId ?? '').trim()
  const remoteAmount = parseUint64(body?.expectedRemoteAmount)
  const depositAccountsRaw = Array.isArray(body?.depositAccounts) ? body.depositAccounts : []
  if (!meteoraAlphaVault || !alphaVaultProgramId) {
    return json(res, 400, { success: false, error: 'Missing Meteora vault or program id.' })
  }
  if (remoteAmount === null || remoteAmount <= 0n) {
    return json(res, 400, { success: false, error: 'Invalid expectedRemoteAmount (must be uint64 > 0).' })
  }
  if (depositAccountsRaw.length === 0) {
    return json(res, 400, { success: false, error: 'Missing depositAccounts.' })
  }

  const parsedAccounts = depositAccountsRaw.map((entry) => ({
    pubkey: String(entry?.pubkey ?? '').trim(),
    isSigner: entry?.isSigner === true,
    isWritable: entry?.isWritable === true,
  }))
  for (const account of parsedAccounts) {
    if (!account.pubkey) return json(res, 400, { success: false, error: 'depositAccounts includes empty pubkey.' })
    try {
      solanaPubkeyToBytes32Hex(account.pubkey)
    } catch {
      return json(res, 400, { success: false, error: `Invalid deposit account pubkey: ${account.pubkey}` })
    }
  }

  let meteoraAlphaVaultBytes32: Hex
  let programIdBytes32: Hex
  try {
    meteoraAlphaVaultBytes32 = solanaPubkeyToBytes32Hex(meteoraAlphaVault)
    programIdBytes32 = solanaPubkeyToBytes32Hex(alphaVaultProgramId)
  } catch (error) {
    return json(res, 400, {
      success: false,
      error: `Invalid Meteora vault/program pubkey: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    // Anchor `deposit(max_amount: u64)` instruction discriminator.
    const discriminator = encodeAnchorDiscriminator('global:deposit')
    const amount = encodeU64LE(remoteAmount)
    const data = `0x${Buffer.concat([discriminator, amount]).toString('hex')}` as Hex
    const solanaIxs = [
      {
        programId: programIdBytes32,
        serializedAccounts: parsedAccounts.map((account) => serializeAccountMeta(account)),
        data,
      },
    ]
    return json(res, 200, {
      success: true,
      data: {
        creatorToken: typeof body.creatorToken === 'string' ? body.creatorToken : null,
        bridgeToken: typeof body.bridgeToken === 'string' ? body.bridgeToken : null,
        meteoraAlphaVault: meteoraAlphaVaultBytes32,
        expectedRemoteAmount: remoteAmount.toString(),
        solanaIxs,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json(res, 500, { success: false, error: `Failed to build Meteora ixs: ${message}` })
  }
}

type SetupCreatorBody = {
  hubCreatorCoin?: string
  hubShareToken?: string
  keeperPubkey?: string
  feeBps?: number
  decimals?: number
  ammPrograms?: string[]
  settlementThreshold?: string
  lotteryEnabled?: boolean
}

async function handleSetupCreator(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) {
    return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  }
  if (!authOk(req, secret)) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  const repoRoot = String(process.env.CRE_REPO_ROOT ?? '').trim()
    || String(process.env.REPO_ROOT ?? '').trim()
  const creDir = repoRoot ? `${repoRoot}/cre` : ''
  if (!creDir || !existsSync(creDir)) {
    return json(res, 503, {
      success: false,
      error: 'CRE_REPO_ROOT (or REPO_ROOT) is not configured or cre/ directory not found.',
    })
  }

  let body: SetupCreatorBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as SetupCreatorBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const hubCreatorCoin = String(body?.hubCreatorCoin ?? '').trim()
  const hubShareToken = String(body?.hubShareToken ?? '').trim()
  if (!hubCreatorCoin || !hubShareToken) {
    return json(res, 400, { success: false, error: 'hubCreatorCoin and hubShareToken are required.' })
  }

  let ammPrograms: string[] = []
  if (body?.ammPrograms !== undefined) {
    if (!Array.isArray(body.ammPrograms)) {
      return json(res, 400, { success: false, error: 'ammPrograms must be an array of non-empty strings when provided.' })
    }
    ammPrograms = body.ammPrograms
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
  }

  const args = [
    'scripts/solana/deploy/setup-creator-full.ts',
    '--hub-creator-coin', hubCreatorCoin,
    '--hub-share-token', hubShareToken,
  ]
  if (body?.keeperPubkey) args.push('--keeper-pubkey', body.keeperPubkey)
  if (body?.feeBps !== undefined) args.push('--fee-bps', String(body.feeBps))
  if (body?.decimals !== undefined) args.push('--decimals', String(body.decimals))
  if (ammPrograms.length) args.push('--amm-programs', ammPrograms.join(','))
  if (body?.settlementThreshold) args.push('--settlement-threshold', body.settlementThreshold)
  if (body?.lotteryEnabled === false) args.push('--lottery-disabled')

  try {
    const { stdout, stderr } = await execFileAsync('tsx', args, {
      cwd: creDir,
      timeout: 5 * 60_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    })
    if (stderr) process.stderr.write(stderr)

    const output = (stdout ?? '').trim()
    let result: unknown
    try {
      result = JSON.parse(output)
    } catch {
      return json(res, 500, {
        success: false,
        error: `setup-creator-full did not produce valid JSON. Output: ${output.slice(-1200)}`,
      })
    }

    return json(res, 200, result)
  } catch (error) {
    const message = toErrorText(error)
    return json(res, 500, {
      success: false,
      error: `setup-creator-full failed: ${message}`,
    })
  }
}

type CreatePoolBody = {
  tokenMintX?: string
  tokenMintY?: string
  binStep?: number
  activeId?: number
  baseFactor?: number
}

async function handleCreatePool(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) {
    return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  }
  if (!authOk(req, secret)) {
    return json(res, 401, { success: false, error: 'Unauthorized' })
  }

  const repoRoot = String(process.env.CRE_REPO_ROOT ?? '').trim()
    || String(process.env.REPO_ROOT ?? '').trim()
  const creDir = repoRoot ? `${repoRoot}/cre` : ''
  if (!creDir || !existsSync(creDir)) {
    return json(res, 503, {
      success: false,
      error: 'CRE_REPO_ROOT (or REPO_ROOT) is not configured or cre/ directory not found.',
    })
  }

  let body: CreatePoolBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as CreatePoolBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const tokenMintX = String(body?.tokenMintX ?? '').trim()
  const tokenMintY = String(body?.tokenMintY ?? '').trim()
  if (!tokenMintX || !tokenMintY) {
    return json(res, 400, { success: false, error: 'tokenMintX and tokenMintY are required.' })
  }
  if (readStrictSolPairEnabled() && tokenMintY !== SOLANA_NATIVE_MINT) {
    return json(res, 400, {
      success: false,
      error:
        `SOLANA_STRICT_SOL_PAIR is enabled. tokenMintY must be ${SOLANA_NATIVE_MINT}, received ${tokenMintY}.`,
    })
  }

  const env = {
    ...process.env,
    TOKEN_MINT_X: tokenMintX,
    TOKEN_MINT_Y: tokenMintY,
    BIN_STEP: String(body?.binStep ?? 25),
    ACTIVE_ID: String(body?.activeId ?? 0),
    BASE_FACTOR: String(body?.baseFactor ?? 10000),
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      'tsx',
      ['scripts/solana/launch/create-dlmm-pool.ts'],
      { cwd: creDir, timeout: 5 * 60_000, maxBuffer: 4 * 1024 * 1024, env },
    )
    if (stderr) process.stderr.write(stderr)
    const output = `${stdout ?? ''}\n${stderr ?? ''}`
    return json(res, 200, { success: true, output: output.trim() })
  } catch (error) {
    const message = toErrorText(error)
    return json(res, 500, { success: false, error: `create-dlmm-pool failed: ${message}` })
  }
}

async function main(): Promise<void> {
  const host = String(process.env.PROVISIONER_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
  const port = Number(process.env.PROVISIONER_PORT ?? 8788)
  const server = createServer(async (req, res) => {
    const method = String(req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (method === 'GET' && url.pathname === '/healthz') return handleHealth(req, res)
    if (method === 'POST' && url.pathname === '/provision') return handleProvision(req, res)
    if (method === 'POST' && url.pathname === '/meteora-ixs') return handleBuildMeteoraIxs(req, res)
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/setup-creator') {
      return handleSetupCreator(req, res)
    }
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/create-pool') {
      return handleCreatePool(req, res)
    }
    return json(res, 404, { success: false, error: 'Not found' })
  })

  server.listen(port, host, () => {
    process.stdout.write(`[solana-provisioner] listening on http://${host}:${port}\n`)
  })
}

void main()
