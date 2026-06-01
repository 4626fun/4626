import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'

import { normalizeHexSuffix } from '../../../src/lib/deploy/perVaultVanityVersionSearch.js'
import {
  findPerVaultVanityVersionOnServer,
  readCombinedVanityServerMaxAttempts,
} from '../../../server/_lib/deploy/findPerVaultVanityVersionServer.js'

type VanityPerVaultVersionBody = {
  create2Deployer?: string
  creatorToken?: string
  owner?: string
  chainId?: number
  baseVersion?: string
  vaultPrefix?: string | null
  shareSuffix?: string | null
  startAttempt?: number
  maxAttempts?: number
  vaultInitCode?: string
  shareOftInitCode?: string
  shareSymbol?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const body = (req.body ?? {}) as VanityPerVaultVersionBody
  const create2Deployer = typeof body.create2Deployer === 'string' && isAddress(body.create2Deployer)
    ? getAddress(body.create2Deployer)
    : null
  const creatorToken = typeof body.creatorToken === 'string' && isAddress(body.creatorToken)
    ? getAddress(body.creatorToken)
    : null
  const owner = typeof body.owner === 'string' && isAddress(body.owner) ? getAddress(body.owner) : null
  const baseVersion = typeof body.baseVersion === 'string' ? body.baseVersion.trim() : ''
  const vaultInitCode = typeof body.vaultInitCode === 'string' && body.vaultInitCode.startsWith('0x')
    ? (body.vaultInitCode as Hex)
    : null
  const shareOftInitCode = typeof body.shareOftInitCode === 'string' && body.shareOftInitCode.startsWith('0x')
    ? (body.shareOftInitCode as Hex)
    : null
  const shareSymbol = typeof body.shareSymbol === 'string' ? body.shareSymbol.trim() : ''
  const chainId = typeof body.chainId === 'number' && Number.isInteger(body.chainId) ? body.chainId : null
  const vaultPrefix = normalizeHexSuffix(body.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(body.shareSuffix ?? null)

  if (!create2Deployer || !creatorToken || !owner || !baseVersion || !vaultInitCode || !shareOftInitCode || !shareSymbol || !chainId) {
    return res.status(400).json({ success: false, error: 'Invalid vanity search payload' } satisfies ApiEnvelope<never>)
  }
  if (!vaultPrefix && !shareSuffix) {
    return res.status(400).json({ success: false, error: 'At least one vanity target is required' } satisfies ApiEnvelope<never>)
  }

  const serverCap = readCombinedVanityServerMaxAttempts()
  const requestedMax = typeof body.maxAttempts === 'number' && body.maxAttempts > 0
    ? Math.floor(body.maxAttempts)
    : serverCap
  const maxAttempts = Math.min(requestedMax, serverCap)
  const startAttempt = typeof body.startAttempt === 'number' && body.startAttempt >= 0
    ? Math.floor(body.startAttempt)
    : 0

  try {
    const result = await findPerVaultVanityVersionOnServer({
      create2Deployer: create2Deployer as Address,
      creatorToken: creatorToken as Address,
      owner: owner as Address,
      chainId,
      baseVersion,
      vaultPrefix,
      shareSuffix,
      maxTries: maxAttempts,
      startAttempt,
      vaultInitCode,
      shareOftInitCode,
      shareSymbol,
      preferWasm: true,
    })

    return res.status(200).json({
      success: true,
      data: {
        version: result.version,
        attempts: result.attempts,
        maxAttempts,
        startAttempt,
      },
    } satisfies ApiEnvelope<{
      version: string | null
      attempts: number
      maxAttempts: number
      startAttempt: number
    }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'vanity_search_failed')
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
