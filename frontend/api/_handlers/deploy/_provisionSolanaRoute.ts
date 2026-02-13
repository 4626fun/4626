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

type ProvisionRouteRequest = {
  shareOft?: string
  solanaDecimals?: number | string
  deployEnv?: string
  tokenName?: string
  tokenSymbol?: string
  scalerExponent?: number | string
  payerKp?: string
  payForRelay?: boolean
}

type ProvisionRouteResponse = {
  shareOft: Address
  mintPubkey: string
  mintBytes32: Hex
  routeScalar: string
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
  const shareOftRaw = typeof body?.shareOft === 'string' ? body.shareOft.trim() : ''
  if (!isAddress(shareOftRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid shareOft address' } satisfies ApiEnvelope<never>)
  }
  const shareOft = shareOftRaw as Address

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
  const cliBin = String(process.env.SOLANA_BRIDGE_CLI_BIN ?? 'bun').trim() || 'bun'
  const payForRelay = typeof body?.payForRelay === 'boolean'
    ? body.payForRelay
    : String(process.env.SOLANA_BRIDGE_PAY_FOR_RELAY ?? '1').trim() !== '0'
  const tokenName = String(body?.tokenName ?? `CreatorShare-${shareOft.slice(2, 8)}`).trim() || `CreatorShare-${shareOft.slice(2, 8)}`
  const tokenSymbol = String(body?.tokenSymbol ?? process.env.SOLANA_BRIDGE_WRAP_SYMBOL_SUFFIX ?? '4626').trim() || '4626'

  try {
    const args = [
      'cli',
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
    if (payForRelay) args.push('--pay-for-relay')

    logger.info('[deploy/provisionSolanaRoute] Starting wrap-token provisioning', {
      shareOft,
      deployEnv,
      tokenName,
      tokenSymbol,
      payerKp,
      cliDir,
    })

    const { stdout, stderr } = await execFileAsync(cliBin, args, {
      cwd: cliDir,
      timeout: 20 * 60_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const combined = `${stdout ?? ''}\n${stderr ?? ''}`
    const mintPubkey = parseMintPubkeyFromWrapOutput(combined)
    if (!mintPubkey) {
      return res.status(500).json({
        success: false,
        error: `Could not parse mint pubkey from wrap-token output: ${combined.slice(-1200)}`,
      } satisfies ApiEnvelope<never>)
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
      return res.status(500).json({
        success: false,
        error: `Route scalar remained 0 for ${shareOft} and ${mintBytes32} after wrap-token.`,
      } satisfies ApiEnvelope<never>)
    }

    return res.status(200).json({
      success: true,
      data: {
        shareOft,
        mintPubkey,
        mintBytes32,
        routeScalar: scalar.toString(),
      },
    } satisfies ApiEnvelope<ProvisionRouteResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('[deploy/provisionSolanaRoute] Provisioning failed', {
      shareOft,
      error: message,
    })
    return res.status(500).json({
      success: false,
      error: `Failed to provision dynamic Solana route: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}

