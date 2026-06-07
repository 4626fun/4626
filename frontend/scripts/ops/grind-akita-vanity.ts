#!/usr/bin/env tsx
/**
 * Chunked Rust vanity grind for AKITA default targets (vault prefix 4626, share suffix 4626).
 *
 *   pnpm -C frontend ops:grind-akita-vanity
 *   pnpm -C frontend ops:grind-akita-vanity -- --start-attempt 100000000
 *   pnpm -C frontend ops:grind-akita-vanity -- --chunk 50000000 --max-chunks 20
 *   pnpm -C frontend ops:grind-akita-vanity -- --dry-run
 *   pnpm -C frontend ops:grind-akita-vanity -- --build
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated.js'
import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from '../../src/lib/deploy/perVaultVanityVersionSearch.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')

const DEFAULT_CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const DEFAULT_OWNER = getAddress('0xAb6d5C10b03300326cd7fab7267ae192842967b5')
const DEFAULT_BASE_VERSION = 'v1.13.0'
const DEFAULT_VAULT_PREFIX = '4626'
const DEFAULT_SHARE_SUFFIX = '4626'
const DEFAULT_CHUNK = 100_000_000

type GrinderResult = {
  version: string
  attempt: number
  attempts: number
  vaultAddress?: Address
  shareOftAddress?: Address
  vaultSalt?: Hex
  shareOftSalt?: Hex
}

type VanityPlan = {
  deploymentVersion: string
  attempt: number
  attemptsInChunk: number
  startAttempt: number
  chunkAttempts: number
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  batcher: Address
  baseVersion: string
  vaultPrefix: string
  shareSuffix: string
  vaultInitCodeHash: Hex
  shareOftInitCodeHash: Hex
  vault: Address
  wrapper: Address
  shareOFT: Address
  baseSalt: Hex
  deployUrl: string
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return next.trim()
}

function parsePositiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))
}

function buildAkitaInitCodes(params: {
  creatorToken: Address
  batcher: Address
  create2Deployer: Address
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbolUpper: string
}): { vaultInitCode: Hex; shareOftInitCode: Hex; oftBootstrapRegistry: Address } {
  const oftBootstrapRegistry = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: deriveOftBootstrapSalt(),
    initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
  })
  const vaultInitCode = concatHex([
    DEPLOY_BYTECODE.CreatorOVault as Hex,
    encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
      params.creatorToken,
      params.batcher,
      params.vaultName,
      params.vaultSymbol,
    ]),
  ])
  const shareOftInitCode = concatHex([
    DEPLOY_BYTECODE.CreatorShareOFT as Hex,
    encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
      params.shareName,
      params.shareSymbolUpper,
      oftBootstrapRegistry,
      params.batcher,
    ]),
  ])
  return { vaultInitCode, shareOftInitCode, oftBootstrapRegistry }
}

function resolveGrinderBin(): string {
  const fromEnv = process.env.VANITY_SALT_GRINDER_BIN?.trim()
  if (fromEnv) return fromEnv
  return resolve(REPO_ROOT, 'tools/vanity-salt-grinder/target/release/vanity-salt-grinder')
}

function buildGrinderBin(binPath: string): void {
  const manifest = resolve(REPO_ROOT, 'tools/vanity-salt-grinder/Cargo.toml')
  process.stderr.write(`Building vanity grinder: cargo build --release --manifest-path ${manifest}\n`)
  const result = spawnSync(
    'cargo',
    ['build', '--release', '--manifest-path', manifest],
    { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'cargo build failed\n')
    process.exit(1)
  }
  if (!existsSync(binPath)) {
    process.stderr.write(`Grinder binary missing after build: ${binPath}\n`)
    process.exit(1)
  }
}

function runGrinderChunk(params: {
  binPath: string
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  baseVersion: string
  vaultPrefix: string
  shareSuffix: string
  shareSymbol: string
  vaultInitCodeHash: Hex
  shareOftInitCodeHash: Hex
  startAttempt: number
  chunkAttempts: number
}): GrinderResult | null {
  const args = [
    'per-vault-version',
    '--create2-deployer',
    params.create2Deployer,
    '--creator-token',
    params.creatorToken,
    '--owner',
    params.owner,
    '--chain-id',
    '8453',
    '--base-version',
    params.baseVersion,
    '--vault-prefix',
    params.vaultPrefix,
    '--share-suffix',
    params.shareSuffix,
    '--share-symbol',
    params.shareSymbol,
    '--vault-init-code-hash',
    params.vaultInitCodeHash,
    '--share-oft-init-code-hash',
    params.shareOftInitCodeHash,
    '--start-attempt',
    String(params.startAttempt),
    '--max-attempts',
    String(params.chunkAttempts),
  ]

  const result = spawnSync(params.binPath, args, { encoding: 'utf8', stdio: 'pipe' })
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.status === 0) {
    try {
      return JSON.parse(combined) as GrinderResult
    } catch {
      throw new Error(`Grinder returned invalid JSON: ${combined.slice(0, 400)}`)
    }
  }
  if (combined.includes('failed to find per-vault vanity version')) return null
  throw new Error(combined || `Grinder exited with status ${result.status ?? 'unknown'}`)
}

function predictAddresses(params: {
  version: string
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  batcher: Address
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
}): { vault: Address; wrapper: Address; shareOFT: Address; baseSalt: Hex } {
  const baseSalt = deriveDeployBaseSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: base.id,
    version: params.version,
  })
  const vault = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: saltForDeployLabel(baseSalt, 'vault'),
    initCode: params.vaultInitCode,
  })
  const wrapperInitCode = concatHex([
    DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex,
    encodeAbiParameters(parseAbiParameters('address,address,address'), [
      params.creatorToken,
      vault,
      params.batcher,
    ]),
  ])
  const wrapper = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: saltForDeployLabel(baseSalt, 'wrapper'),
    initCode: wrapperInitCode,
  })
  const shareOFT = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: deriveShareOftSaltFromVersion({
      owner: params.owner,
      shareSymbol: params.shareSymbol,
      version: params.version,
    }),
    initCode: params.shareOftInitCode,
  })
  return { vault, wrapper, shareOFT, baseSalt }
}

async function main(): Promise<void> {
  loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
  loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

  const creatorRaw = getArg('--creator', DEFAULT_CREATOR)
  const ownerRaw = getArg('--owner', DEFAULT_OWNER)
  if (!isAddress(creatorRaw) || !isAddress(ownerRaw)) {
    throw new Error('Invalid --creator or --owner address')
  }

  const creatorToken = getAddress(creatorRaw)
  const owner = getAddress(ownerRaw)
  const batcher = getAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  const baseVersion = getArg('--base-version', DEFAULT_BASE_VERSION)
  const vaultPrefix = getArg('--vault-prefix', DEFAULT_VAULT_PREFIX).replace(/^0x/i, '').toLowerCase()
  const shareSuffix = getArg('--share-suffix', DEFAULT_SHARE_SUFFIX).replace(/^0x/i, '').toLowerCase()
  const shareSymbol = getArg('--share-symbol', 'AKITA')
  const vaultName = getArg('--vault-name', 'AKITA Vault')
  const vaultSymbol = getArg('--vault-symbol', 'vAKITA')
  const shareName = getArg('--share-name', 'AKITA Share')
  const shareSymbolUpper = shareSymbol.toUpperCase()

  const startAttempt = Math.max(0, parsePositiveInt(getArg('--start-attempt', '0'), 0))
  const chunkAttempts = parsePositiveInt(getArg('--chunk', String(DEFAULT_CHUNK)), DEFAULT_CHUNK)
  const maxChunksRaw = getArg('--max-chunks', '')
  const maxChunks = maxChunksRaw ? parsePositiveInt(maxChunksRaw, 1) : Number.POSITIVE_INFINITY

  const rpc =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 30_000 }) })
  const aligned = await resolveAlignedPhase1DeployDeps({ publicClient: client, batcherAddress: batcher })
  if (!aligned.ok) throw new Error(aligned.message)

  const create2Deployer = aligned.create2Deployer
  const { vaultInitCode, shareOftInitCode, oftBootstrapRegistry } = buildAkitaInitCodes({
    creatorToken,
    batcher,
    create2Deployer,
    vaultName,
    vaultSymbol,
    shareName,
    shareSymbolUpper,
  })
  const vaultInitCodeHash = keccak256(vaultInitCode)
  const shareOftInitCodeHash = keccak256(shareOftInitCode)

  const inputs = {
    create2Deployer,
    bytecodeStore: aligned.bytecodeStore,
    creatorToken,
    owner,
    batcher,
    baseVersion,
    vaultPrefix,
    shareSuffix,
    shareSymbol,
    vaultName,
    vaultSymbol,
    shareName,
    shareSymbolUpper,
    oftBootstrapRegistry,
    vaultInitCodeHash,
    shareOftInitCodeHash,
    startAttempt,
    chunkAttempts,
    maxChunks: Number.isFinite(maxChunks) ? maxChunks : null,
  }

  if (hasFlag('--dry-run')) {
    process.stdout.write(`${JSON.stringify(inputs, null, 2)}\n`)
    return
  }

  const binPath = resolveGrinderBin()
  if (!existsSync(binPath) || hasFlag('--build')) {
    buildGrinderBin(binPath)
  }

  let attemptCursor = startAttempt
  let chunksRun = 0
  let grinderResult: GrinderResult | null = null

  while (chunksRun < maxChunks) {
    process.stderr.write(
      `Grinding chunk ${chunksRun + 1}: startAttempt=${attemptCursor} maxAttempts=${chunkAttempts}\n`,
    )
    grinderResult = runGrinderChunk({
      binPath,
      create2Deployer,
      creatorToken,
      owner,
      baseVersion,
      vaultPrefix,
      shareSuffix,
      shareSymbol,
      vaultInitCodeHash,
      shareOftInitCodeHash,
      startAttempt: attemptCursor,
      chunkAttempts,
    })
    if (grinderResult) break
    attemptCursor += chunkAttempts
    chunksRun += 1
  }

  if (!grinderResult) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          message: 'No vanity version found in configured search window',
          lastStartAttempt: attemptCursor,
          chunkAttempts,
          chunksRun,
          resumeCommand: `pnpm -C frontend ops:grind-akita-vanity -- --start-attempt ${attemptCursor}`,
        },
        null,
        2,
      )}\n`,
    )
    process.exit(1)
  }

  const { vault, wrapper, shareOFT, baseSalt } = predictAddresses({
    version: grinderResult.version,
    create2Deployer,
    creatorToken,
    owner,
    batcher,
    vaultInitCode,
    shareOftInitCode,
    shareSymbol,
  })

  const deployUrl = `https://app.4626.fun/deploy/vault?deploymentVersion=${encodeURIComponent(grinderResult.version)}`
  const plan: VanityPlan = {
    deploymentVersion: grinderResult.version,
    attempt: grinderResult.attempt,
    attemptsInChunk: grinderResult.attempts,
    startAttempt: attemptCursor,
    chunkAttempts,
    create2Deployer,
    creatorToken,
    owner,
    batcher,
    baseVersion,
    vaultPrefix,
    shareSuffix,
    vaultInitCodeHash,
    shareOftInitCodeHash,
    vault,
    wrapper,
    shareOFT,
    baseSalt,
    deployUrl,
  }

  const deployed = {
    vault: Boolean(await client.getBytecode({ address: vault })),
    wrapper: Boolean(await client.getBytecode({ address: wrapper })),
    shareOFT: Boolean(await client.getBytecode({ address: shareOFT })),
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        plan,
        grinder: grinderResult,
        deployed,
      },
      null,
      2,
    )}\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})