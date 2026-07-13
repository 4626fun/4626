import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { createHash, timingSafeEqual } from 'node:crypto'

import { Connection, Keypair } from '@solana/web3.js'
import { type Hex } from 'viem'
import { solanaPubkeyToBytes32Hex } from '../_lib/onchain/solanaBridgePubkey.js'

const execFileAsync = promisify(execFile)
const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'

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

async function handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliExists = !!cliDir && existsSync(cliDir)
  const provisionerSecret = readProvisionerBearerSecret()
  const secretSet = provisionerSecret.value.length > 0

  // L-01 (audit 2026-04-25): redact diagnostic fields from unauthenticated
  // responses. Previously, when no secret was configured we returned the
  // full `{cliExists, secretSet, payerConfigured, payerHealthy, payerError,
  // baseRpcConfigured, solanaRpcConfigured, deployEnvDefault}` body to any
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
      service: 'solana-route-provisioner',
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
      service: 'solana-route-provisioner',
      reason: 'unconfigured',
      now: new Date().toISOString(),
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

async function handleProvision(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, 410, {
    success: false,
    error: 'gone',
    code: 'twin_wrap_token_provisioning_retired',
    message:
      'POST /provision Twin wrap-token provisioning is retired. Use LayerZero ShareOFT share-mesh provisioning instead: Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer) plus LZ OFT store/mint setup. See docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md and docs/_internal/operations/solana/solana-share-mesh-budget-paths.md.',
  })
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
