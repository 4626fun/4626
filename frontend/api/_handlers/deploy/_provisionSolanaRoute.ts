import type { VercelRequest, VercelResponse } from '@vercel/node'

import { existsSync } from 'node:fs'

import { createPublicClient, http, isAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  logger,
} from '../../../packages/server-core/src/index.js'


import { evaluateCanonicalBridgeTokenPolicy } from '../../../server/_lib/solanaBridgePolicy.js'
import {
  WRAP_TOKEN_NAME_MAX_LENGTH,
  WRAP_TOKEN_SYMBOL_MAX_LENGTH,
  normalizeExactWrapTokenName,
  normalizeExactWrapTokenSymbol,
  readBridgeTokenMetadata,
} from '../../../server/_lib/solanaBridgeTokenMetadata.js'
import { runWrapToken } from '../../../server/_lib/solanaBridgeCliRunner.js'
import {
  parseMintPubkeyFromWrapOutput,
  solanaPubkeyToBytes32Hex,
} from '../../../server/_lib/solanaBridgePubkey.js'

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

const BASE_SOLANA_BRIDGE = '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188' as Address
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
  const tokenName = normalizeExactWrapTokenName(bridgeTokenMetadata.name)
  const tokenSymbol = normalizeExactWrapTokenSymbol(bridgeTokenMetadata.symbol)
  if (!tokenName || !tokenSymbol) {
    return res.status(409).json({
      success: false,
      error:
        `Bridge token metadata is incompatible with strict Solana parity requirements (name<=${WRAP_TOKEN_NAME_MAX_LENGTH}, ` +
        `symbol<=${WRAP_TOKEN_SYMBOL_MAX_LENGTH}, exact casing preserved).`,
    } satisfies ApiEnvelope<never>)
  }

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
    logger.info('[deploy/provisionSolanaRoute] Starting wrap-token provisioning', {
      bridgeToken,
      deployEnv,
      tokenName,
      tokenSymbol,
      payerKp,
      cliDir,
    })
    const result = await runWrapToken(cliDir, cliBin, buildWrapArgs(tokenSymbol))
    combined = result.output
    runner = result.runner

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
        tokenSymbol,
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
