import { execFile } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { timingSafeEqual } from 'node:crypto'

import { createPublicClient, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

const execFileAsync = promisify(execFile)
const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
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

type ProvisionBody = {
  shareOft?: string
  deployEnv?: string
  solanaDecimals?: number | string
  tokenName?: string
  tokenSymbol?: string
  scalerExponent?: number | string
  payerKp?: string
  payForRelay?: boolean
}

type WrapRunner = {
  bin: string
  args: string[]
  label: string
}

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

function parseMintPubkeyFromWrapOutput(text: string): string | null {
  const match = text.match(/Mint:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

function parseMintPubkeyFromAlreadyExistsError(text: string): string | null {
  const match = text.match(/Address\s*\{\s*address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
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

function envBool(key: string, fallback = false): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
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

async function handleHealth(res: ServerResponse): Promise<void> {
  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliExists = !!cliDir && existsSync(cliDir)
  const secretSet = String(process.env.PROVISIONER_BEARER_TOKEN ?? '').trim().length > 0
  json(res, 200, {
    ok: cliExists && secretSet,
    service: 'solana-route-provisioner',
    cliDir,
    cliExists,
    secretSet,
    baseRpcConfigured: String(process.env.BASE_RPC_URL ?? '').trim().length > 0,
    deployEnvDefault: String(process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet',
    now: new Date().toISOString(),
  })
}

async function handleProvision(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = String(process.env.PROVISIONER_BEARER_TOKEN ?? '').trim()
  if (!secret) {
    return json(res, 503, { success: false, error: 'PROVISIONER_BEARER_TOKEN is not configured.' })
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
  } catch {
    return json(res, 400, { success: false, error: 'Invalid JSON body.' })
  }

  const shareOftRaw = String(body?.shareOft ?? '').trim()
  if (!isAddress(shareOftRaw)) {
    return json(res, 400, { success: false, error: 'Invalid shareOft address' })
  }
  const shareOft = shareOftRaw as Address

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
  const tokenName = String(body?.tokenName ?? `CreatorShare-${shareOft.slice(2, 8)}`).trim() || `CreatorShare-${shareOft.slice(2, 8)}`
  const symbolPrefixRaw = process.env.SOLANA_BRIDGE_WRAP_SYMBOL_PREFIX
  const defaultSymbolPrefix = symbolPrefixRaw === undefined ? 'CS' : String(symbolPrefixRaw).trim()
  const defaultTokenSymbol = `${defaultSymbolPrefix}${shareOft.slice(2, 6).toUpperCase()}`
  const tokenSymbol = String(body?.tokenSymbol ?? defaultTokenSymbol).trim() || defaultTokenSymbol

  const wrapArgs = [
    'sol',
    'bridge',
    'wrap-token',
    '--deploy-env',
    deployEnv,
    '--remote-token',
    shareOft,
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
  if (payForRelay) wrapArgs.push('--pay-for-relay')

  try {
    const { output: combined, runner } = await runWrapToken(cliDir, cliBin, wrapArgs)
    const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
    if (!mintPubkey) {
      return json(res, 500, {
        success: false,
        error: `Could not parse mint pubkey from wrap-token output: ${combined.slice(-1200)}`,
      })
    }
    const mintBytes32 = solanaPubkeyToBytes32Hex(mintPubkey)

    const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })
    let scalar = 0n
    for (let i = 0; i < 24; i += 1) {
      scalar = await publicClient
        .readContract({
          address: BASE_SOLANA_BRIDGE,
          abi: BASE_SOLANA_BRIDGE_ABI,
          functionName: 'scalars',
          args: [shareOft, mintBytes32],
        })
        .then((v) => BigInt(v as bigint))
        .catch(() => 0n)
      if (scalar > 0n) break
      await new Promise((resolve) => setTimeout(resolve, 5_000))
    }
    if (scalar === 0n) {
      return json(res, 500, {
        success: false,
        error: `Route scalar remained 0 for ${shareOft} and ${mintBytes32} after wrap-token.`,
      })
    }

    return json(res, 200, {
      success: true,
      mintBytes32,
      data: {
        shareOft,
        mintPubkey,
        mintBytes32,
        runner,
        routeScalar: scalar.toString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Idempotency: if wrap-token fails because mint account already exists,
    // recover by extracting the mint pubkey and verifying route scalar.
    const existingMintPubkey = parseMintPubkeyFromAlreadyExistsError(message)
    if (existingMintPubkey) {
      try {
        const mintBytes32 = solanaPubkeyToBytes32Hex(existingMintPubkey)
        const rpcUrl = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
        const publicClient = createPublicClient({
          chain: base,
          transport: http(rpcUrl, { timeout: 20_000 }),
        })
        let scalar = 0n
        for (let i = 0; i < 24; i += 1) {
          scalar = await publicClient
            .readContract({
              address: BASE_SOLANA_BRIDGE,
              abi: BASE_SOLANA_BRIDGE_ABI,
              functionName: 'scalars',
              args: [shareOft, mintBytes32],
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
              shareOft,
              mintPubkey: existingMintPubkey,
              mintBytes32,
              runner: 'existing-mint-reuse',
              routeScalar: scalar.toString(),
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

async function main(): Promise<void> {
  const host = String(process.env.PROVISIONER_HOST ?? '0.0.0.0').trim() || '0.0.0.0'
  const port = Number(process.env.PROVISIONER_PORT ?? 8788)
  const server = createServer(async (req, res) => {
    const method = String(req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (method === 'GET' && url.pathname === '/healthz') return handleHealth(res)
    if (method === 'POST' && url.pathname === '/provision') return handleProvision(req, res)
    return json(res, 404, { success: false, error: 'Not found' })
  })

  server.listen(port, host, () => {
    process.stdout.write(`[solana-provisioner] listening on http://${host}:${port}\n`)
  })
}

void main()
