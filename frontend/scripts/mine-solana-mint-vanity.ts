import { createHash } from 'node:crypto'

import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress, keccak256, type Address, type Hex } from 'viem'

const WRAPPED_TOKEN_SEED = Buffer.from('wrapped_token')
const TOKEN_NAME_MAX = 32
const TOKEN_SYMBOL_MAX = 12

const BRIDGE_PROGRAM_BY_ENV = {
  mainnet: 'HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM',
  'testnet-prod': '7c6mteAcTXaQ1MFBCrnuzoZVTTAEfZwa6wgy4bqX3KXC',
  'testnet-alpha': '6YpL1h2a9u6LuNVi55vAes36xNszt2UDm3Zk1kj4WSBm',
} as const

type SearchMode = 'symbol' | 'name' | 'both'

type CliArgs = {
  bridgeToken: Address
  suffix: string
  deployEnv: keyof typeof BRIDGE_PROGRAM_BY_ENV
  decimals: number
  scalerExponent: number
  baseName: string
  baseSymbol: string
  maxTries: number
  startAt: bigint
  progressEvery: number
  mode: SearchMode
}

function usage(): never {
  const lines = [
    'Usage:',
    '  pnpm -C frontend tsx scripts/mine-solana-mint-vanity.ts \\',
    '    --bridge-token 0x... --base-symbol AKITA [options]',
    '',
    'Options:',
    '  --suffix <str>            Base58 suffix target (default: 4626)',
    '  --deploy-env <env>        mainnet | testnet-prod | testnet-alpha (default: mainnet)',
    '  --decimals <n>            Solana mint decimals (default: 9)',
    '  --scaler-exponent <n>     Bridge scaler exponent (default: decimals)',
    '  --base-name <name>        Base token name template (default: Creator Share)',
    '  --base-symbol <symbol>    Base token symbol template (required)',
    '  --mode <mode>             symbol | name | both (default: symbol)',
    '  --max-tries <n>           Max attempts (default: 2000000)',
    '  --start-at <n|0xhex>      Deterministic start counter',
    '  --progress-every <n>      Progress log interval (default: 50000)',
  ]
  console.error(lines.join('\n'))
  process.exit(1)
}

function parseIntArg(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return n
}

function normalizeBase58Suffix(raw: string | undefined): string {
  const v = String(raw ?? '4626').trim()
  if (!v) throw new Error('suffix is required')
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(v)) {
    throw new Error(`Invalid base58 suffix "${v}"`)
  }
  return v
}

function sanitizeName(raw: string): string {
  const fallback = 'Creator Share'
  const normalized = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const out = normalized || fallback
  return out.slice(0, TOKEN_NAME_MAX)
}

function sanitizeSymbol(raw: string): string {
  const fallback = 'CS'
  const normalized = String(raw ?? '')
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
  const out = normalized || fallback
  return out.slice(0, TOKEN_SYMBOL_MAX)
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

function parseStartAt(raw: string | undefined, fallbackSeed: string): bigint {
  if (!raw) {
    const seedHash = createHash('sha256').update(fallbackSeed).digest('hex')
    return BigInt(`0x${seedHash}`)
  }
  const value = raw.trim().toLowerCase()
  if (value.startsWith('0x')) return BigInt(value)
  return BigInt(value)
}

function nonceBase36(counter: bigint): string {
  return counter.toString(36).toUpperCase()
}

function deriveNonceToken(counter: bigint, size: number): string {
  const digestHex = createHash('sha256').update(counter.toString()).digest('hex')
  const raw = BigInt(`0x${digestHex}`).toString(36).toUpperCase()
  if (raw.length >= size) return raw.slice(0, size)
  return `${raw}${'0'.repeat(size - raw.length)}`
}

function buildSymbolCandidate(baseSymbol: string, counter: bigint): string {
  const base = sanitizeSymbol(baseSymbol)
  if (!base) return deriveNonceToken(counter, TOKEN_SYMBOL_MAX)
  // Keep a stable brand head (e.g. AKITA) and vary the tail every attempt.
  const headLen = Math.min(base.length, Math.max(2, TOKEN_SYMBOL_MAX - 6))
  const tailLen = TOKEN_SYMBOL_MAX - headLen
  const tail = deriveNonceToken(counter, tailLen)
  return `${base.slice(0, headLen)}${tail}`.slice(0, TOKEN_SYMBOL_MAX)
}

function buildNameCandidate(baseName: string, counter: bigint): string {
  const nonce = deriveNonceToken(counter, 8)
  const suffix = `-${nonce}`
  const available = Math.max(1, TOKEN_NAME_MAX - suffix.length)
  const head = sanitizeName(baseName).slice(0, available)
  return `${head}${suffix}`.slice(0, TOKEN_NAME_MAX)
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? 'true' : argv[i + 1]
    map.set(key, value)
    if (value !== 'true') i += 1
  }

  const bridgeTokenRaw = String(map.get('bridge-token') ?? '').trim()
  if (!isAddress(bridgeTokenRaw)) {
    throw new Error('Missing or invalid --bridge-token')
  }
  const bridgeToken = getAddress(bridgeTokenRaw)

  const deployEnvRaw = String(map.get('deploy-env') ?? 'mainnet').trim() as keyof typeof BRIDGE_PROGRAM_BY_ENV
  if (!(deployEnvRaw in BRIDGE_PROGRAM_BY_ENV)) {
    throw new Error(`Invalid --deploy-env "${deployEnvRaw}"`)
  }

  const decimals = parseIntArg(map.get('decimals'), 9)
  const scalerExponent = parseIntArg(map.get('scaler-exponent'), decimals)
  if (decimals < 0 || decimals > 255) throw new Error('decimals must be 0..255')
  if (scalerExponent < 0 || scalerExponent > 255) throw new Error('scalerExponent must be 0..255')

  const baseSymbol = sanitizeSymbol(String(map.get('base-symbol') ?? ''))
  if (!baseSymbol) throw new Error('Missing --base-symbol')
  const baseName = sanitizeName(String(map.get('base-name') ?? 'Creator Share'))

  const modeRaw = String(map.get('mode') ?? 'symbol').trim().toLowerCase()
  const mode: SearchMode = modeRaw === 'name' || modeRaw === 'both' ? modeRaw : 'symbol'

  const suffix = normalizeBase58Suffix(map.get('suffix'))
  const maxTries = Math.max(1, parseIntArg(map.get('max-tries'), 2_000_000))
  const progressEvery = Math.max(1_000, parseIntArg(map.get('progress-every'), 50_000))

  const startAt = parseStartAt(
    map.get('start-at'),
    [
      '4626:solana-mint-vanity',
      bridgeToken.toLowerCase(),
      deployEnvRaw,
      String(decimals),
      String(scalerExponent),
      baseName,
      baseSymbol,
      suffix,
      mode,
    ].join(':'),
  )

  return {
    bridgeToken,
    suffix,
    deployEnv: deployEnvRaw,
    decimals,
    scalerExponent,
    baseName,
    baseSymbol,
    maxTries,
    startAt,
    progressEvery,
    mode,
  }
}

function deriveMintPubkey(params: {
  bridgeProgram: PublicKey
  bridgeToken: Address
  decimals: number
  scalerExponent: number
  name: string
  symbol: string
}): PublicKey {
  const nameBytes = Buffer.from(params.name, 'utf8')
  const symbolBytes = Buffer.from(params.symbol, 'utf8')
  const remoteTokenBytes = Buffer.from(params.bridgeToken.slice(2), 'hex')
  const metadataBytes = Buffer.concat([
    encodeU64LE(BigInt(nameBytes.length)),
    nameBytes,
    encodeU64LE(BigInt(symbolBytes.length)),
    symbolBytes,
    remoteTokenBytes,
    Buffer.from([params.scalerExponent]),
  ])
  const metadataHash = keccak256(metadataBytes) as Hex
  const metadataHashBytes = Buffer.from(metadataHash.slice(2), 'hex')
  const [mint] = PublicKey.findProgramAddressSync(
    [WRAPPED_TOKEN_SEED, Buffer.from([params.decimals]), metadataHashBytes],
    params.bridgeProgram,
  )
  return mint
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const bridgeProgram = new PublicKey(BRIDGE_PROGRAM_BY_ENV[args.deployEnv])

  const startedAt = Date.now()
  console.log(
    JSON.stringify(
      {
        phase: 'start',
        deployEnv: args.deployEnv,
        bridgeProgram: bridgeProgram.toBase58(),
        bridgeToken: args.bridgeToken,
        targetSuffix: args.suffix,
        mode: args.mode,
        maxTries: args.maxTries,
        startAt: args.startAt.toString(),
        decimals: args.decimals,
        scalerExponent: args.scalerExponent,
        baseName: args.baseName,
        baseSymbol: args.baseSymbol,
      },
      null,
      2,
    ),
  )

  for (let i = 0; i < args.maxTries; i += 1) {
    const counter = args.startAt + BigInt(i)
    const symbol =
      args.mode === 'name'
        ? args.baseSymbol
        : buildSymbolCandidate(args.baseSymbol, counter)
    const name =
      args.mode === 'symbol'
        ? args.baseName
        : buildNameCandidate(args.baseName, counter)

    const mint = deriveMintPubkey({
      bridgeProgram,
      bridgeToken: args.bridgeToken,
      decimals: args.decimals,
      scalerExponent: args.scalerExponent,
      name,
      symbol,
    })
    const mintBase58 = mint.toBase58()

    if (mintBase58.endsWith(args.suffix)) {
      const elapsedMs = Date.now() - startedAt
      console.log(
        JSON.stringify(
          {
            phase: 'found',
            attempts: i + 1,
            counter: counter.toString(),
            elapsedMs,
            elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
            ratePerSec: Number((((i + 1) * 1000) / Math.max(1, elapsedMs)).toFixed(2)),
            bridgeToken: args.bridgeToken,
            mintBase58,
            mintBytes32: (`0x${mint.toBuffer().toString('hex')}` as Hex),
            name,
            symbol,
            wrapCommand: [
              'bun run src/bin.ts sol bridge wrap-token',
              `--deploy-env ${args.deployEnv}`,
              `--remote-token ${args.bridgeToken}`,
              `--decimals ${args.decimals}`,
              `--name "${name}"`,
              `--symbol ${symbol}`,
              `--scaler-exponent ${args.scalerExponent}`,
              '--payer-kp config',
              '--pay-for-relay',
            ].join(' '),
          },
          null,
          2,
        ),
      )
      return
    }

    if ((i + 1) % args.progressEvery === 0) {
      const elapsedMs = Date.now() - startedAt
      console.error(
        JSON.stringify({
          phase: 'progress',
          attempts: i + 1,
          elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
          ratePerSec: Number((((i + 1) * 1000) / Math.max(1, elapsedMs)).toFixed(2)),
          latestCounter: counter.toString(),
          latestSymbol: symbol,
          latestName: name,
          latestMint: mintBase58,
        }),
      )
    }
  }

  const elapsedMs = Date.now() - startedAt
  console.log(
    JSON.stringify(
      {
        phase: 'not_found',
        attempts: args.maxTries,
        elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
        ratePerSec: Number(((args.maxTries * 1000) / Math.max(1, elapsedMs)).toFixed(2)),
        suggestion: 'Increase --max-tries or change --start-at and rerun.',
      },
      null,
      2,
    ),
  )
  process.exitCode = 2
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  usage()
})
