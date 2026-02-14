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

type RegisterShareOftRequest = {
  shareOft?: string
  batcherAddress?: string
  solanaMint?: string
  solanaDecimals?: number | string
}

type RegisterShareOftResponse = {
  shareOft: Address
  batcher: Address
  adapter: Address
  destination: Hex
  adapterOwner: Address
  signer: Address | null
  registered: boolean
  txHash: Hex | null
  solanaMint: Hex | null
  solanaDecimals: number | null
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

function readDynamicProvisionerUrl(): string {
  return String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL ??
      process.env.SOLANA_BRIDGE_PROVISIONER_URL ??
      '',
  ).trim()
}

function readDynamicProvisionerSecret(): string {
  return String(
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET ??
      process.env.SOLANA_BRIDGE_PROVISIONER_SECRET ??
      '',
  ).trim()
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
  solanaDecimals: number
  publicClient: any
}): Promise<Hex | null> {
  if (!readDynamicSolanaRouteEnabled()) return null

  const cliDir = String(process.env.SOLANA_BRIDGE_CLI_DIR ?? '').trim()
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'auto').trim() || 'auto'
  const deployEnv = String(process.env.SOLANA_BRIDGE_DEPLOY_ENV ?? 'mainnet').trim() || 'mainnet'
  const payerKp = String(process.env.SOLANA_BRIDGE_PAYER_KP ?? 'config').trim() || 'config'
  const scalerExponent = parseDecimals(process.env.SOLANA_BRIDGE_SCALER_EXPONENT) ?? params.solanaDecimals
  const namePrefixRaw = process.env.SOLANA_BRIDGE_WRAP_NAME_PREFIX
  const namePrefix = namePrefixRaw === undefined ? 'CreatorShare' : String(namePrefixRaw).trim()
  const symbolPrefixRaw = process.env.SOLANA_BRIDGE_WRAP_SYMBOL_PREFIX
  const symbolPrefix = symbolPrefixRaw === undefined ? 'CS' : String(symbolPrefixRaw).trim()
  const symbolSuffix = String(process.env.SOLANA_BRIDGE_WRAP_SYMBOL_SUFFIX ?? '').trim()
  const suffix = params.shareOft.slice(2, 8)
  const tokenName = `${namePrefix || 'CreatorShare'}-${suffix}`
  const tokenSymbol = symbolSuffix
    ? `${symbolPrefix}${symbolSuffix}`
    : `${symbolPrefix}${suffix.slice(0, 4).toUpperCase()}`
  const payForRelay = String(process.env.SOLANA_BRIDGE_PAY_FOR_RELAY ?? '1').trim() !== '0'
  const provisionerUrl = readDynamicProvisionerUrl()

  const provisionViaRemote = async (): Promise<{ mintBytes32: Hex; runner: string }> => {
    logger.info('[deploy/registerShareOft] Dynamic Solana route provisioning start (remote provisioner)', {
      shareOft: params.shareOft,
      provisionerUrl,
      deployEnv,
      payerKp,
      tokenName,
      tokenSymbol,
      payForRelay,
    })
    const provisionerSecret = readDynamicProvisionerSecret()
    const response = await fetch(String(provisionerUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provisionerSecret ? { Authorization: `Bearer ${provisionerSecret}` } : {}),
      },
      body: JSON.stringify({
        shareOft: params.shareOft,
        deployEnv,
        solanaDecimals: params.solanaDecimals,
        tokenName,
        tokenSymbol,
        scalerExponent,
        payerKp,
        payForRelay,
      }),
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json) {
      throw new Error(
        `Remote provisioner failed (${response.status}). ` +
          `${json && typeof json === 'object' && 'error' in json ? String((json as any).error) : 'No error body.'}`,
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
  }

  let mintBytes32: Hex
  let mintedPubkey: string | null = null
  let provisionRunner: string | null = null
  if (cliDir && existsSync(cliDir)) {
    const wrapArgs = [
      'sol',
      'bridge',
      'wrap-token',
      '--deploy-env',
      deployEnv,
      '--remote-token',
      params.shareOft,
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
    if (payForRelay) wrapArgs.push('--pay-for-relay')

    logger.info('[deploy/registerShareOft] Dynamic Solana route provisioning start (local CLI)', {
      shareOft: params.shareOft,
      cliDir,
      deployEnv,
      payerKp,
      tokenName,
      tokenSymbol,
      payForRelay,
    })

    try {
      const { output: combined, runner } = await runWrapToken(cliDir, cliBin, wrapArgs)
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
        !!provisionerUrl && (isRunnerUnavailable(error) || localError.includes('No usable bridge CLI runner found'))
      if (!canFallbackToRemote) throw error
      logger.warn('[deploy/registerShareOft] Local dynamic route provisioning failed; falling back to remote provisioner', {
        shareOft: params.shareOft,
        cliDir,
        cliBin,
        localError,
        provisionerUrl,
      })
      const remote = await provisionViaRemote()
      mintBytes32 = remote.mintBytes32
      provisionRunner = remote.runner
    }
  } else if (provisionerUrl) {
    const remote = await provisionViaRemote()
    mintBytes32 = remote.mintBytes32
    provisionRunner = remote.runner
  } else {
    throw new Error(
      'Dynamic Solana route is enabled, but neither a valid local SOLANA_BRIDGE_CLI_DIR exists ' +
        'nor SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL is set.',
    )
  }

  for (let i = 0; i < 24; i += 1) {
    const scalar = await params.publicClient
      .readContract({
        address: BASE_SOLANA_BRIDGE,
        abi: BASE_SOLANA_BRIDGE_ABI,
        functionName: 'scalars',
        args: [params.shareOft, mintBytes32],
      })
      .then((v: unknown) => BigInt(v as bigint))
      .catch(() => 0n)
    if (scalar > 0n) {
      logger.info('[deploy/registerShareOft] Dynamic Solana route ready', {
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
    `Dynamic route provisioning completed, but bridge scalar was still 0 for share ${params.shareOft} and mint ${mintBytes32}.`,
  )
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

  const body = await readJsonBody<RegisterShareOftRequest>(req)
  const shareOftRaw = typeof body?.shareOft === 'string' ? body.shareOft.trim() : ''
  if (!isAddress(shareOftRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid shareOft address' } satisfies ApiEnvelope<never>)
  }
  const shareOft = getAddress(shareOftRaw)

  const contracts = getApiContracts()
  const batcherRaw = typeof body?.batcherAddress === 'string' && isAddress(body.batcherAddress)
    ? body.batcherAddress
    : contracts.creatorVaultBatcher

  if (!batcherRaw || !isAddress(batcherRaw)) {
    return res.status(503).json({
      success: false,
      error: 'CreatorVaultDeployer is not configured on server.',
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
        error: 'Solana bridge is not enabled on CreatorVaultDeployer (adapter/destination unset).',
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
        args: [shareOft],
      }),
      publicClient.readContract({
        address: adapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'owner',
      }),
    ])
    const alreadyRegistered = Boolean(alreadyRegisteredRaw)
    const adapterOwner = getAddress(String(adapterOwnerRaw) as Address)

    if (alreadyRegistered) {
      return res.status(200).json({
        success: true,
        data: {
          shareOft,
          batcher,
          adapter,
          destination,
          adapterOwner,
          signer: null,
          registered: true,
          txHash: null,
          solanaMint: null,
          solanaDecimals: null,
        },
      } satisfies ApiEnvelope<RegisterShareOftResponse>)
    }

    const shareCode = await publicClient.getBytecode({ address: shareOft }).catch(() => '0x' as Hex)
    if (!shareCode || shareCode === '0x') {
      return res.status(409).json({
        success: false,
        error:
          `ShareOFT ${shareOft} has no bytecode yet. ` +
          'Run phase1 finalize first, then retry Solana registration.',
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
    const solanaDecimals = parseDecimals(body?.solanaDecimals) ?? readSolanaDecimalsFromEnv()

    const readRouteScalar = async (mint: Hex): Promise<bigint | null> =>
      publicClient
        .readContract({
          address: BASE_SOLANA_BRIDGE,
          abi: BASE_SOLANA_BRIDGE_ABI,
          functionName: 'scalars',
          args: [shareOft, mint],
        })
        .then((v) => BigInt(v as bigint))
        .catch(() => null)
    const trySwitchToDynamicMint = async (): Promise<boolean> => {
      try {
        const dynamicMint = await tryProvisionDynamicRoute({
          shareOft,
          solanaDecimals,
          publicClient,
        })
        if (!dynamicMint) return false
        solanaMint = dynamicMint
        dynamicProvisionError = null
        return true
      } catch (error) {
        dynamicProvisionError = error instanceof Error ? error.message : String(error)
        logger.warn('[deploy/registerShareOft] Dynamic Solana route provisioning failed', {
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
      existingTokenForMint.toLowerCase() !== shareOft.toLowerCase()
    ) {
      const switched = await trySwitchToDynamicMint()
      if (!switched) {
        return res.status(409).json({
          success: false,
          error:
            `Solana mint ${solanaMint} is already mapped to ${existingTokenForMint}. ` +
            'Use a unique mint per ShareOFT.',
        } satisfies ApiEnvelope<never>)
      }
      existingTokenForMint = await readExistingTokenForMint(solanaMint)
      if (
        existingTokenForMint.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
        existingTokenForMint.toLowerCase() !== shareOft.toLowerCase()
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
          existingTokenForMint.toLowerCase() !== shareOft.toLowerCase()
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
            `Base Solana bridge route is not registered for ShareOFT ${shareOft} and mint ${solanaMint} ` +
              '(WrappedSplRouteNotRegistered). Use a bridge-supported Solana mint for this ShareOFT, ' +
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
      args: [shareOft, solanaMint, solanaDecimals],
      account,
      chain: base,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })

    logger.info('[deploy/registerShareOft] Registered ShareOFT for Solana bridge', {
      caller: auth.address,
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
        batcher,
        adapter,
        destination,
        adapterOwner,
        signer: signerAddress,
        registered: true,
        txHash,
        solanaMint,
        solanaDecimals,
      },
    } satisfies ApiEnvelope<RegisterShareOftResponse>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[deploy/registerShareOft] Registration failed', {
      caller: auth.address,
      shareOft,
      batcher,
      error: message,
    })
    return res.status(500).json({
      success: false,
      error: `Failed to auto-register ShareOFT: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
