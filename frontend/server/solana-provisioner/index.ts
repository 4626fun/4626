import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { createHash, timingSafeEqual } from 'node:crypto'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  getMint,
  getTransferFeeConfig,
  getTransferHook,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'
import { type Hex } from 'viem'
import { solanaPubkeyToBytes32Hex } from '../_lib/onchain/solanaBridgePubkey.js'
import { CREATOR_SHARE_HOOK_PROGRAM_ID, deriveCreatorShareHookPdas } from '../_lib/onchain/creatorShareHookPdas.js'
import { sendLotteryEntryFromSolanaOapp } from '../_lib/onchain/solanaLotteryOappClient.js'
import { recordSolanaLotteryWinner } from '../_lib/onchain/solanaLotteryWinnerSettlement.js'
import { CANONICAL_LOTTERY_MANAGER, hashSolanaLotterySourceEventId } from '../_lib/onchain/solanaLotteryLzTransport.js'
import { parseSolanaLotterySourceEventId } from '../_lib/onchain/solanaLotterySourceEventId.js'
import { decodeMeteoraTokenBadge } from '../_lib/onchain/solanaMeteoraTokenBadge.js'
import { hasExactCreatorConfigAmmProgram } from '../_lib/onchain/solanaCreatorConfig.js'

const execFileAsync = promisify(execFile)
const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'
const DEFAULT_METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

type MeteoraAccountMetaBody = {
  pubkey?: string
  isSigner?: boolean
  isWritable?: boolean
}

type MeteoraIxsBody = {
  creatorToken?: string
  meteoraAlphaVault?: string
  alphaVaultProgramId?: string
  expectedRemoteAmount?: number | string
  depositAccounts?: MeteoraAccountMetaBody[]
}

const PROVISIONER_MAX_BODY_BYTES = 64 * 1024

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return fallback
}

const PROVISIONER_HEALTH_DEBUG_ENABLED = parseBooleanEnv('PROVISIONER_HEALTH_DEBUG', false)
const PROVISIONER_EXTENDED_ENDPOINTS_ENABLED = parseBooleanEnv('PROVISIONER_EXTENDED_ENDPOINTS', false)
const LOTTERY_OAPP_SEND_ENABLED = parseBooleanEnv('SOLANA_LOTTERY_OAPP_SEND_ENABLED', false)
const LOTTERY_WINNER_SETTLEMENT_ENABLED = parseBooleanEnv('SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED', false)

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
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

function toErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readStrictSolPairEnabled(): boolean {
  return envBool('SOLANA_STRICT_SOL_PAIR', true)
}

const CANONICAL_HOOK_ACCOUNT_SIZES = {
  creatorConfig: 501,
  pendingEntries: 12_352,
  winnerRecord: 89,
  extraAccountMetaList: 86,
} as const

/**
 * Verify the exact Token-2022/hook mint before invoking the pool creator.
 * Pool creation is a mutation, so a caller must not be able to turn an
 * arbitrary mint into a B2 pool merely by possessing the provisioner bearer.
 */
async function verifyB2PoolMint(params: {
  connection: Connection
  tokenMintX: PublicKey
  tokenMintY: PublicKey
}): Promise<void> {
  if (params.tokenMintX.equals(params.tokenMintY)) {
    throw new Error('meteora_pool_mints_must_be_distinct')
  }
  const mintAccount = await params.connection.getAccountInfo(params.tokenMintX, 'finalized')
  if (!mintAccount || !mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error('meteora_pool_token_x_not_token_2022')
  }
  const mint = await getMint(params.connection, params.tokenMintX, 'finalized', TOKEN_2022_PROGRAM_ID)
  const transferHook = getTransferHook(mint)
  if (!transferHook || !transferHook.programId.equals(new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID))) {
    throw new Error('meteora_pool_token_x_hook_mismatch')
  }
  const transferFees = getTransferFeeConfig(mint)
  if (!transferFees || transferFees.olderTransferFee.transferFeeBasisPoints !== 0 || transferFees.newerTransferFee.transferFeeBasisPoints !== 0) {
    throw new Error('meteora_pool_token_x_transfer_fee_not_zero')
  }
  const oftProgramRaw = String(process.env.SOLANA_OFT_PROGRAM_ID ?? '').trim()
  if (!oftProgramRaw) throw new Error('meteora_pool_oft_program_id_missing')
  let oftProgram: PublicKey
  try {
    oftProgram = new PublicKey(oftProgramRaw)
  } catch {
    throw new Error('meteora_pool_oft_program_id_invalid')
  }
  if (!mint.mintAuthority) throw new Error('meteora_pool_mint_authority_missing')
  const authorityInfo = await params.connection.getAccountInfo(mint.mintAuthority, 'finalized')
  if (!authorityInfo?.owner.equals(oftProgram)) {
    throw new Error('meteora_pool_mint_authority_not_oft_store')
  }

  // Meteora's admin token_badge must already be finalized for this exact
  // Token-2022 mint. Creating a DLMM pair before this approval produces a
  // pool that cannot be used by the intended B2 venue, so fail closed before
  // invoking the pool-creation script.
  let meteoraProgram: PublicKey
  try {
    meteoraProgram = new PublicKey(
      String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID,
    )
  } catch {
    throw new Error('meteora_pool_dlmm_program_id_invalid')
  }
  const [tokenBadge] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_badge'), params.tokenMintX.toBuffer()],
    meteoraProgram,
  )
  const tokenBadgeInfo = await params.connection.getAccountInfo(tokenBadge, 'finalized')
  const tokenBadgeDecoded = tokenBadgeInfo
    ? decodeMeteoraTokenBadge(tokenBadgeInfo.data, params.tokenMintX)
    : { valid: false, reason: 'missing' }
  if (!tokenBadgeInfo || !tokenBadgeInfo.owner.equals(meteoraProgram) || !tokenBadgeDecoded.valid) {
    throw new Error(`meteora_pool_token_badge_missing_or_malformed:${tokenBadgeDecoded.reason}`)
  }

  const hookPdas = deriveCreatorShareHookPdas(params.tokenMintX.toBase58())
  if (!hookPdas) throw new Error('meteora_pool_hook_pda_derivation_failed')
  const hookProgram = new PublicKey(CREATOR_SHARE_HOOK_PROGRAM_ID)
  const [extraAccountMetaList] = PublicKey.findProgramAddressSync(
    [Buffer.from('extra-account-metas'), params.tokenMintX.toBuffer()],
    hookProgram,
  )
  const accounts = await params.connection.getMultipleAccountsInfo([
    new PublicKey(hookPdas.creatorConfig),
    new PublicKey(hookPdas.pendingEntries),
    new PublicKey(hookPdas.winnerRecord),
    extraAccountMetaList,
  ], 'finalized')
  const expected = [
    CANONICAL_HOOK_ACCOUNT_SIZES.creatorConfig,
    CANONICAL_HOOK_ACCOUNT_SIZES.pendingEntries,
    CANONICAL_HOOK_ACCOUNT_SIZES.winnerRecord,
    CANONICAL_HOOK_ACCOUNT_SIZES.extraAccountMetaList,
  ]
  if (accounts.some((account, index) => !account || !account.owner.equals(hookProgram) || account.data.length !== expected[index])) {
    throw new Error('meteora_pool_hook_pdas_missing_or_malformed')
  }
  const creatorConfigInfo = accounts[0]
  if (!creatorConfigInfo || !hasExactCreatorConfigAmmProgram(creatorConfigInfo.data, meteoraProgram.toBase58())) {
    throw new Error('meteora_pool_creator_config_amm_allowlist_mismatch')
  }
}

/**
 * Verify the standard SPL share-mesh mint for B1. B1 deliberately has no
 * creator-share TransferHook or relay PDAs; the lottery remains on Base. The
 * mint authority still has to be the configured OFT Store so a bearer cannot
 * turn an arbitrary SPL mint into a trading pool.
 */
async function verifyB1PoolMint(params: {
  connection: Connection
  tokenMintX: PublicKey
  tokenMintY: PublicKey
}): Promise<void> {
  if (params.tokenMintX.equals(params.tokenMintY)) {
    throw new Error('meteora_pool_mints_must_be_distinct')
  }
  const mintAccount = await params.connection.getAccountInfo(params.tokenMintX, 'finalized')
  if (!mintAccount || !mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error('meteora_pool_token_x_not_standard_spl')
  }
  const mint = await getMint(params.connection, params.tokenMintX, 'finalized', TOKEN_PROGRAM_ID)
  const oftProgramRaw = String(process.env.SOLANA_OFT_PROGRAM_ID ?? '').trim()
  if (!oftProgramRaw) throw new Error('meteora_pool_oft_program_id_missing')
  let oftProgram: PublicKey
  try {
    oftProgram = new PublicKey(oftProgramRaw)
  } catch {
    throw new Error('meteora_pool_oft_program_id_invalid')
  }
  if (!mint.mintAuthority) throw new Error('meteora_pool_mint_authority_missing')
  const authorityInfo = await params.connection.getAccountInfo(mint.mintAuthority, 'finalized')
  if (!authorityInfo?.owner.equals(oftProgram)) {
    throw new Error('meteora_pool_mint_authority_not_oft_store')
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
    'METEORA_IX_PROVISIONER_SECRET',
  ])
}

function parseMinPayerSol(): number {
  const raw = String(process.env.PROVISIONER_MIN_PAYER_SOL ?? '0.05').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 0.05
  return parsed
}

function decodeBase58(value: string): Uint8Array | null {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let decoded = 0n
  for (const char of value) {
    const digit = alphabet.indexOf(char)
    if (digit < 0) return null
    decoded = decoded * 58n + BigInt(digit)
  }

  const bytes: number[] = []
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn))
    decoded >>= 8n
  }
  bytes.reverse()
  const leadingZeroes = value.length - value.replace(/^1+/, '').length
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes])
}

function parseSecretKeyBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!Array.isArray(parsed) || parsed.length !== 64) return null
      if (!parsed.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return null
      return Uint8Array.from(parsed as number[])
    } catch {
      return null
    }
  }
  const decoded = decodeBase58(trimmed)
  return decoded?.length === 64 ? decoded : null
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
  const payerRef = String(process.env.SOLANA_KEEPER_KEYPAIR ?? 'config').trim() || 'config'
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
      payerError: 'Unable to resolve SOLANA_KEEPER_KEYPAIR.',
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

async function handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const provisionerSecret = readProvisionerBearerSecret()
  const secretSet = provisionerSecret.value.length > 0

  // L-01 (audit 2026-04-25): redact diagnostic fields from unauthenticated
  // responses. Previously, when no secret was configured we returned the
  // full payer and runtime readiness body to any
  // caller — this is useful pre-attack reconnaissance for an attacker
  // probing a misconfigured deployment. We now require either:
  //   - a configured bearer secret AND a valid Authorization header, OR
  //   - the explicit dev-only flag PROVISIONER_HEALTH_ALLOW_UNAUTH=1.
  // Otherwise the response is reduced to `{ok:false, reason:"unconfigured"}`
  // which leaks no deployment-readiness state.
  const allowUnauth = String(process.env.PROVISIONER_HEALTH_ALLOW_UNAUTH ?? '').trim() === '1'
  const authenticated = secretSet && authOk(req, provisionerSecret.value)

  if (secretSet && !authenticated) {
    return json(res, 401, {
      ok: false,
      service: 'solana-provisioner',
      error: 'Unauthorized',
    })
  }

  if (!secretSet && !allowUnauth) {
    // Fail-closed: return a minimal unconfigured envelope. Operators can
    // still detect that the service is up (HTTP 200) without leaking any
    // deployment-readiness fields. To restore the previous behavior in a
    // dev/staging environment, set PROVISIONER_HEALTH_ALLOW_UNAUTH=1.
    return json(res, 200, {
      ok: false,
      service: 'solana-provisioner',
      reason: 'unconfigured',
      now: new Date().toISOString(),
    })
  }

  const payerHealth = await readProvisionerPayerHealth()
  const payload: Record<string, unknown> = {
    ok: secretSet && payerHealth.payerHealthy,
    service: 'solana-provisioner',
    secretSet,
    payerConfigured: payerHealth.payerConfigured,
    payerHealthy: payerHealth.payerHealthy,
    payerError: payerHealth.payerError,
    solanaRpcConfigured: String(process.env.SOLANA_RPC_URL ?? '').trim().length > 0,
    extendedEndpointsEnabled: PROVISIONER_EXTENDED_ENDPOINTS_ENABLED,
    now: new Date().toISOString(),
  }
  if (PROVISIONER_HEALTH_DEBUG_ENABLED) {
    payload.secretSource = provisionerSecret.source
    payload.payerSource = payerHealth.payerSource
    payload.payerPubkey = payerHealth.payerPubkey
    payload.payerBalanceLamports = payerHealth.payerBalanceLamports
    payload.payerBalanceSol = payerHealth.payerBalanceSol
    payload.payerMinSol = payerHealth.payerMinSol
  }
  json(res, 200, payload)
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
  mint?: string
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

  const repoRoot = String(process.env.KPR_REPO_ROOT ?? '').trim()
    || String(process.env.REPO_ROOT ?? '').trim()
  const keeperScriptsDir = repoRoot ? `${repoRoot}/kpr` : ''
  if (!keeperScriptsDir || !existsSync(keeperScriptsDir)) {
    return json(res, 503, {
      success: false,
      error: 'KPR_REPO_ROOT (or REPO_ROOT) is not configured or kpr/ directory not found.',
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
  const mint = String(body?.mint ?? '').trim()
  if (!hubCreatorCoin || !hubShareToken || !mint) {
    return json(res, 400, { success: false, error: 'mint, hubCreatorCoin and hubShareToken are required.' })
  }

  let ammPrograms: string[] = [
    String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID,
  ]
  if (body?.ammPrograms !== undefined) {
    if (!Array.isArray(body.ammPrograms)) {
      return json(res, 400, { success: false, error: 'ammPrograms must be an array of non-empty strings when provided.' })
    }
    ammPrograms = body.ammPrograms
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
  }
  const canonicalAmmProgram = String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() || DEFAULT_METEORA_DLMM_PROGRAM_ID
  let canonicalAmmProgramKey: PublicKey
  try {
    canonicalAmmProgramKey = new PublicKey(canonicalAmmProgram)
    ammPrograms = ammPrograms.map((value) => new PublicKey(value).toBase58())
  } catch {
    return json(res, 400, { success: false, error: 'configured Meteora DLMM program or ammPrograms is invalid.' })
  }
  const canonicalAmmProgramBase58 = canonicalAmmProgramKey.toBase58()
  if (ammPrograms.some((value) => value !== canonicalAmmProgramBase58)) {
    return json(res, 400, {
      success: false,
      error: `ammPrograms may only contain the configured Meteora DLMM program (${canonicalAmmProgram}).`,
    })
  }
  ammPrograms = [canonicalAmmProgramBase58]

  const args = [
    'scripts/solana/deploy/setup-creator-full.ts',
    '--hub-creator-coin', hubCreatorCoin,
    '--hub-share-token', hubShareToken,
    '--mint', mint,
  ]
  if (body?.keeperPubkey) args.push('--keeper-pubkey', body.keeperPubkey)
  if (body?.feeBps !== undefined) args.push('--fee-bps', String(body.feeBps))
  if (body?.decimals !== undefined) args.push('--decimals', String(body.decimals))
  if (ammPrograms.length) args.push('--amm-programs', ammPrograms.join(','))
  if (body?.settlementThreshold) args.push('--settlement-threshold', body.settlementThreshold)
  if (body?.lotteryEnabled === false) args.push('--lottery-disabled')

  try {
    const { stdout, stderr } = await execFileAsync('tsx', args, {
      cwd: keeperScriptsDir,
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
  mode?: 'b1' | 'b2'
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

  const repoRoot = String(process.env.KPR_REPO_ROOT ?? '').trim()
    || String(process.env.REPO_ROOT ?? '').trim()
  const keeperScriptsDir = repoRoot ? `${repoRoot}/kpr` : ''
  if (!keeperScriptsDir || !existsSync(keeperScriptsDir)) {
    return json(res, 503, {
      success: false,
      error: 'KPR_REPO_ROOT (or REPO_ROOT) is not configured or kpr/ directory not found.',
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
  const mode = body?.mode === 'b1' ? 'b1' : body?.mode === 'b2' ? 'b2' : 'b2'
  if (!tokenMintX || !tokenMintY) {
    return json(res, 400, { success: false, error: 'tokenMintX and tokenMintY are required.' })
  }
  let tokenMintXKey: PublicKey
  let tokenMintYKey: PublicKey
  try {
    tokenMintXKey = new PublicKey(tokenMintX)
    tokenMintYKey = new PublicKey(tokenMintY)
  } catch {
    return json(res, 400, { success: false, error: 'tokenMintX and tokenMintY must be valid Solana pubkeys.' })
  }
  if (tokenMintXKey.equals(tokenMintYKey)) {
    return json(res, 400, { success: false, error: 'tokenMintX and tokenMintY must be distinct.' })
  }
  if (readStrictSolPairEnabled() && tokenMintY !== SOLANA_NATIVE_MINT) {
    return json(res, 400, {
      success: false,
      error:
        `SOLANA_STRICT_SOL_PAIR is enabled. tokenMintY must be ${SOLANA_NATIVE_MINT}, received ${tokenMintY}.`,
    })
  }
  const configuredQuoteMint = String(process.env.SOLANA_METEORA_POOL_QUOTE_MINT ?? '').trim()
  if (configuredQuoteMint && tokenMintY !== configuredQuoteMint) {
    return json(res, 400, {
      success: false,
      error: `tokenMintY does not match SOLANA_METEORA_POOL_QUOTE_MINT (${configuredQuoteMint}).`,
    })
  }
  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim()
  if (!rpcUrl) return json(res, 503, { success: false, error: 'SOLANA_RPC_URL is not configured.' })
  try {
    const connection = new Connection(rpcUrl, 'finalized')
    if (mode === 'b1') {
      await verifyB1PoolMint({ connection, tokenMintX: tokenMintXKey, tokenMintY: tokenMintYKey })
    } else {
      await verifyB2PoolMint({ connection, tokenMintX: tokenMintXKey, tokenMintY: tokenMintYKey })
    }
  } catch (error) {
    return json(res, 409, {
      success: false,
      error: `${mode.toUpperCase()} pool mint verification failed: ${toErrorText(error)}`,
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
      { cwd: keeperScriptsDir, timeout: 5 * 60_000, maxBuffer: 4 * 1024 * 1024, env },
    )
    if (stderr) process.stderr.write(stderr)
    const output = `${stdout ?? ''}\n${stderr ?? ''}`
    return json(res, 200, { success: true, output: output.trim() })
  } catch (error) {
    const message = toErrorText(error)
    return json(res, 500, { success: false, error: `create-dlmm-pool failed: ${message}` })
  }
}

type LotteryOappSendBody = {
  payload?: string
  payloadHash?: string
  sourceEventId?: string
  sourceEventDigest?: string
  peerBytes32?: string
  lotteryManager?: string
}

async function handleLotteryOappSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  if (!authOk(req, secret)) return json(res, 401, { success: false, error: 'Unauthorized' })
  if (!LOTTERY_OAPP_SEND_ENABLED) {
    return json(res, 503, { success: false, error: 'Solana lottery OApp sender is disabled.' })
  }

  let body: LotteryOappSendBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as LotteryOappSendBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const payload = String(body.payload ?? '').trim().toLowerCase()
  const payloadHash = String(body.payloadHash ?? '').trim().toLowerCase()
  const sourceEventId = String(body.sourceEventId ?? '').trim()
  const sourceEventDigest = String(body.sourceEventDigest ?? '').trim().toLowerCase()
  const idempotencyKey = String(req.headers['idempotency-key'] ?? '').trim().toLowerCase()
  const peerBytes32 = String(body.peerBytes32 ?? '').trim().toLowerCase()
  const lotteryManager = String(body.lotteryManager ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]+$/.test(payload) || payload.length % 2 !== 0 || payload.length > 8_194) {
    return json(res, 400, { success: false, error: 'Invalid payload.' })
  }
  if (!sourceEventId || !/^0x[a-f0-9]{64}$/.test(payloadHash) || !/^0x[a-f0-9]{64}$/.test(sourceEventDigest)) {
    return json(res, 400, { success: false, error: 'Invalid payloadHash or sourceEventDigest.' })
  }
  try {
    parseSolanaLotterySourceEventId(sourceEventId)
  } catch {
    return json(res, 400, { success: false, error: 'Invalid sourceEventId.' })
  }
  if (/^0x0{64}$/.test(payloadHash) || /^0x0{64}$/.test(sourceEventDigest)) {
    return json(res, 400, { success: false, error: 'Payload hash and sourceEventDigest must be non-zero.' })
  }
  if (idempotencyKey !== sourceEventDigest) {
    return json(res, 400, { success: false, error: 'Idempotency-Key must match sourceEventDigest.' })
  }
  const payloadBytes = Buffer.from(payload.slice(2), 'hex')
  if (payloadBytes.length !== 224 || `0x${payloadBytes.subarray(192, 224).toString('hex')}` !== sourceEventDigest) {
    return json(res, 400, { success: false, error: 'sourceEventDigest is not bound to the V3 payload.' })
  }
  if (hashSolanaLotterySourceEventId(sourceEventId).toLowerCase() !== sourceEventDigest) {
    return json(res, 400, { success: false, error: 'sourceEventDigest does not match sourceEventId.' })
  }
  if (!/^0x[a-f0-9]{64}$/.test(peerBytes32) || !/^0x[a-f0-9]{40}$/.test(lotteryManager)) {
    return json(res, 400, { success: false, error: 'Invalid OApp peer or LotteryManager.' })
  }
  if (lotteryManager !== CANONICAL_LOTTERY_MANAGER.toLowerCase()) {
    return json(res, 400, { success: false, error: 'Non-canonical LotteryManager.' })
  }

  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim()
  const programIdRaw = String(process.env.SOLANA_LOTTERY_OAPP_PROGRAM_ID ?? '').trim()
  const expectedOperatorRaw = String(process.env.SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY ?? '').trim()
  const { keypair } = resolveProvisionerPayerKeypair()
  if (!rpcUrl || !programIdRaw || !expectedOperatorRaw || !keypair) {
    return json(res, 503, { success: false, error: 'OApp RPC, program id, operator, or payer is not configured.' })
  }
  let programId: PublicKey
  try {
    programId = new PublicKey(programIdRaw)
  } catch {
    return json(res, 503, { success: false, error: 'SOLANA_LOTTERY_OAPP_PROGRAM_ID is invalid.' })
  }
  let expectedOperator: PublicKey
  try {
    expectedOperator = new PublicKey(expectedOperatorRaw)
  } catch {
    return json(res, 503, { success: false, error: 'SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY is invalid.' })
  }
  if (!expectedOperator.equals(keypair.publicKey)) {
    return json(res, 503, { success: false, error: 'Configured OApp operator does not match the provisioner payer.' })
  }

  try {
    const sent = await sendLotteryEntryFromSolanaOapp({
      connection: new Connection(rpcUrl, 'finalized'),
      programId,
      payer: keypair,
      request: {
        payload: payload as Hex,
        expectedPayloadHash: payloadHash as Hex,
        expectedPeerBytes32: peerBytes32 as Hex,
        expectedLotteryManager: lotteryManager as `0x${string}`,
      },
    })
    return json(res, 200, {
      success: true,
      lzGuid: sent.lzGuid,
      solanaSignature: sent.solanaSignature,
      sourceEventDigest,
      payloadHash: sent.payloadHash,
      baseTxHash: null,
    })
  } catch (error) {
    return json(res, 502, { success: false, error: `OApp send failed: ${toErrorText(error)}` })
  }
}

type LotteryWinnerSettlementBody = {
  creatorMint?: string
  winnerSolana?: string
  sharesPaid?: string
  winId?: string
}

async function handleLotteryWinnerSettlement(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = readProvisionerBearerSecret().value
  if (!secret) return json(res, 503, { success: false, error: 'Provisioner bearer secret is not configured.' })
  if (!authOk(req, secret)) return json(res, 401, { success: false, error: 'Unauthorized' })
  if (!LOTTERY_WINNER_SETTLEMENT_ENABLED) {
    return json(res, 503, { success: false, error: 'Solana lottery winner settlement is disabled.' })
  }

  let body: LotteryWinnerSettlementBody
  try {
    const raw = await readBody(req)
    body = (raw ? JSON.parse(raw) : {}) as LotteryWinnerSettlementBody
  } catch (error) {
    if (error instanceof Error && error.message === 'request_body_too_large') {
      return json(res, 413, { success: false, error: 'Request body too large.' })
    }
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }
  const creatorMint = String(body.creatorMint ?? '').trim()
  const winnerSolana = String(body.winnerSolana ?? '').trim()
  const winId = String(body.winId ?? '').trim().toLowerCase()
  let sharesPaid: bigint
  try {
    sharesPaid = BigInt(String(body.sharesPaid ?? ''))
  } catch {
    return json(res, 400, { success: false, error: 'Invalid sharesPaid.' })
  }
  if (!/^0x[a-f0-9]{64}$/.test(winId) || sharesPaid <= 0n || sharesPaid > 0xffff_ffff_ffff_ffffn) {
    return json(res, 400, { success: false, error: 'Invalid winId or sharesPaid.' })
  }
  try {
    new PublicKey(creatorMint)
    new PublicKey(winnerSolana)
  } catch {
    return json(res, 400, { success: false, error: 'Invalid creatorMint or winnerSolana.' })
  }
  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim()
  const { keypair } = resolveProvisionerPayerKeypair()
  if (!rpcUrl || !keypair) {
    return json(res, 503, { success: false, error: 'Winner settlement RPC or payer is not configured.' })
  }
  try {
    const settled = await recordSolanaLotteryWinner({
      connection: new Connection(rpcUrl, 'finalized'),
      payer: keypair,
      request: { creatorMint, winnerSolana, sharesPaid, winId: winId as Hex },
    })
    return json(res, 200, { success: true, ...settled, winId })
  } catch (error) {
    return json(res, 502, { success: false, error: `Winner settlement failed: ${toErrorText(error)}` })
  }
}

async function main(): Promise<void> {
  const host = String(process.env.PROVISIONER_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
  const port = Number(process.env.PROVISIONER_PORT ?? 8788)
  const server = createServer(async (req, res) => {
    const method = String(req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (method === 'GET' && url.pathname === '/healthz') return handleHealth(req, res)
    if (method === 'POST' && url.pathname === '/meteora-ixs') return handleBuildMeteoraIxs(req, res)
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/setup-creator') {
      return handleSetupCreator(req, res)
    }
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/create-pool') {
      return handleCreatePool(req, res)
    }
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/send-lottery-oapp') {
      return handleLotteryOappSend(req, res)
    }
    if (PROVISIONER_EXTENDED_ENDPOINTS_ENABLED && method === 'POST' && url.pathname === '/record-lottery-winner') {
      return handleLotteryWinnerSettlement(req, res)
    }
    return json(res, 404, { success: false, error: 'Not found' })
  })

  server.listen(port, host, () => {
    process.stdout.write(`[solana-provisioner] listening on http://${host}:${port}\n`)
  })
}

void main()
