import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, keccak256, type Address, type Hex } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'

import { normalizeHexSuffix } from '../../../src/lib/deploy/perVaultVanityVersionSearch.js'
import { findCreate2SaltForSuffixOnServer } from '../../../server/_lib/deploy/findCreate2SaltForSuffixServer.js'

type VanityShareOftSaltBody = {
  create2Deployer?: string
  initCode?: string
  startAt?: string
  suffix?: string | null
  maxAttempts?: number
}

const DEFAULT_SERVER_MAX_ATTEMPTS = 1_000_000
const SERVER_MAX_ATTEMPTS_CAP = 50_000_000

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

  const body = (req.body ?? {}) as VanityShareOftSaltBody
  const create2Deployer =
    typeof body.create2Deployer === 'string' && isAddress(body.create2Deployer)
      ? getAddress(body.create2Deployer)
      : null
  const initCode =
    typeof body.initCode === 'string' && body.initCode.startsWith('0x') ? (body.initCode as Hex) : null
  const startAt =
    typeof body.startAt === 'string' && /^0x[0-9a-f]{64}$/i.test(body.startAt) ? (body.startAt as Hex) : null
  const suffix = normalizeHexSuffix(body.suffix ?? null)
  const requestedMax =
    typeof body.maxAttempts === 'number' && body.maxAttempts > 0 ? Math.floor(body.maxAttempts) : DEFAULT_SERVER_MAX_ATTEMPTS
  const maxAttempts = Math.min(requestedMax, SERVER_MAX_ATTEMPTS_CAP)

  if (!create2Deployer || !initCode || !startAt || !suffix) {
    return res.status(400).json({ success: false, error: 'Invalid share oft vanity search payload' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await findCreate2SaltForSuffixOnServer({
      create2Deployer: create2Deployer as Address,
      initCodeHash: keccak256(initCode),
      startAt,
      suffix,
      maxAttempts,
    })
    if (!result) {
      return res.status(200).json({
        success: true,
        data: { salt: null, attempts: maxAttempts, maxAttempts },
      } satisfies ApiEnvelope<{ salt: Hex | null; attempts: number; maxAttempts: number }>)
    }
    return res.status(200).json({
      success: true,
      data: {
        salt: result.salt,
        attempts: result.attempts,
        maxAttempts,
        predictedAddress: result.predictedAddress,
      },
    } satisfies ApiEnvelope<{ salt: Hex; attempts: number; maxAttempts: number; predictedAddress: string }>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'share_oft_vanity_search_failed')
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}