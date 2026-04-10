import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getSessionAddress,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../../packages/server-core/src/index.js'


import { computeConfigHash, type KeeprConfigV1, upsertKeeprVault } from '../../../../server/_lib/keeprRegistry.js'
import { validateCreatorRegistryBinding } from '../../../../server/_lib/creatorRegistryVerification.js'

const VAULT_OWNER_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com'] as const

function getBaseRpcUrl(): string {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  return raw.split(',')[0]?.trim() || DEFAULT_BASE_RPCS[0]
}

async function readOnchainVaultOwner(vaultAddr: Address): Promise<Address> {
  const client = createPublicClient({ chain: base, transport: http(getBaseRpcUrl(), { timeout: 10_000 }) })
  const ownerRaw = await client.readContract({ address: vaultAddr, abi: VAULT_OWNER_ABI, functionName: 'owner' })
  return getAddress(ownerRaw as Address)
}

type UpsertBody = {
  config?: KeeprConfigV1
}

type UpsertResponse = {
  vaultAddress: `0x${string}`
  groupId: string
  lensGroupAddress: `0x${string}` | null
  configHash: string
}

const KEEPR_UPSERT_BODY_MAX_BYTES = 65_536

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(rateLimitKey('keepr:vault:upsert', getClientIp(req)), RATE_LIMITS.workspaceActions)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const actor = getSessionAddress(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: KEEPR_UPSERT_BODY_MAX_BYTES })) as UpsertBody
  const config = body?.config
  if (!config || typeof config !== 'object') {
    return res.status(400).json({ success: false, error: 'Missing config' } satisfies ApiEnvelope<never>)
  }

  const owner = typeof config?.roles?.owner === 'string' ? config.roles.owner.trim() : ''
  const canonicalOwner = typeof config?.vault?.canonicalOwnerAddress === 'string' ? config.vault.canonicalOwnerAddress.trim() : ''
  const creatorCoinAddress = typeof config?.vault?.creatorCoinAddress === 'string' ? config.vault.creatorCoinAddress.trim() : ''
  const vaultAddress = typeof config?.vault?.vaultAddress === 'string' ? config.vault.vaultAddress.trim() : ''
  const shareTokenAddress = typeof config?.vault?.shareTokenAddress === 'string' ? config.vault.shareTokenAddress.trim() : null
  const groupId = typeof config?.xmtp?.groupId === 'string' ? config.xmtp.groupId.trim() : ''
  const lensGroupAddress = typeof config?.lens?.groupAddress === 'string' ? config.lens.groupAddress.trim() : ''

  if (
    !isAddressLike(owner)
    || !isAddressLike(canonicalOwner)
    || !isAddressLike(creatorCoinAddress)
    || !isAddressLike(vaultAddress)
    || !groupId
  ) {
    return res.status(400).json({ success: false, error: 'Invalid config fields' } satisfies ApiEnvelope<never>)
  }
  if (shareTokenAddress && !isAddressLike(shareTokenAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid share token address' } satisfies ApiEnvelope<never>)
  }
  if (lensGroupAddress && !isAddressLike(lensGroupAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid lens group address' } satisfies ApiEnvelope<never>)
  }

  if (owner.toLowerCase() !== canonicalOwner.toLowerCase()) {
    return res.status(400).json({ success: false, error: 'roles.owner must match vault.canonicalOwnerAddress' } satisfies ApiEnvelope<never>)
  }

  if (actor.toLowerCase() !== owner.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'OWNER authorization required' } satisfies ApiEnvelope<never>)
  }

  const chainId = Number(config?.chainId)
  if (chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'Unsupported chainId (expected 8453)' } satisfies ApiEnvelope<never>)
  }

  try {
    const registryValidation = await validateCreatorRegistryBinding({
      creatorCoinAddress,
      vaultAddress,
      shareTokenAddress,
    })
    if (!registryValidation.ok) {
      return res.status(403).json({
        success: false,
        error: `Config must match active onchain registry bindings (${registryValidation.reason})`,
      } satisfies ApiEnvelope<never>)
    }
  } catch (err) {
    console.error('[keepr/vault/upsert] Registry verification unavailable:', err)
    return res.status(503).json({
      success: false,
      error: 'Onchain registry verification unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const onchainOwner = await readOnchainVaultOwner(vaultAddress as Address)
    if (onchainOwner.toLowerCase() !== owner.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Caller does not match on-chain vault owner',
      } satisfies ApiEnvelope<never>)
    }
  } catch (err) {
    console.error('[keepr/vault/upsert] On-chain vault owner verification failed:', err)
    return res.status(503).json({
      success: false,
      error: 'On-chain vault owner verification unavailable',
    } satisfies ApiEnvelope<never>)
  }

  const configHash = computeConfigHash(config)
  const row = await upsertKeeprVault({ config, actorWallet: actor })

  return res.status(200).json({
    success: true,
    data: {
      vaultAddress: row.vaultAddress,
      groupId: row.groupId,
      lensGroupAddress: row.lensGroupAddress,
      configHash,
    } satisfies UpsertResponse,
  } satisfies ApiEnvelope<UpsertResponse>)
}
