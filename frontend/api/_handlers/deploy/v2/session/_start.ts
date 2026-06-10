import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, encodeAbiParameters, getAddress, http, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'
import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '@4626/server-core'
import { getCanonicalOrigin } from '../../../../../server/_lib/infra/origin.js'
import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StartRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  phase1Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase2CoreCalls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase2FinalizeCalls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase3Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase4Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  version?: string
  autoContinue?: boolean
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function isOwnerInstalled(params: { smartWallet: Address; ownerAddress: Address; maxScan?: number }): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveDeploySessionRpcUrl(), { timeout: 12_000 }),
  })

  const countRaw = (await publicClient.readContract({
    address: params.smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  let upperBound = Number.isFinite(count) ? count : 0
  try {
    const nextRaw = (await publicClient.readContract({
      address: params.smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
  } catch {
    // ignore
  }
  if (!Number.isFinite(upperBound) || upperBound <= 0) return false

  const expected = asOwnerBytes(params.ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, params.maxScan ?? 512))
  for (let i = 0; i < limit; i++) {
    let owner: Hex
    try {
      owner = (await publicClient.readContract({
        address: params.smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as Hex
    } catch {
      continue
    }
    if (String(owner).toLowerCase() === expected) return true
  }
  return false
}

function forwardAuthHeaders(req: VercelRequest): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers?.authorization
  if (typeof auth === 'string' && auth.trim()) headers.Authorization = auth
  const siwaReceipt = req.headers?.['x-siwa-receipt']
  if (typeof siwaReceipt === 'string' && siwaReceipt.trim()) headers['X-SIWA-Receipt'] = siwaReceipt.trim()
  const cookie = req.headers?.cookie
  if (typeof cookie === 'string' && cookie.trim()) headers.Cookie = cookie
  return headers
}

async function proxyPost<T>(params: {
  origin: string
  path: string
  body: unknown
  headers: Record<string, string>
}): Promise<{ status: number; ok: boolean; payload: ApiEnvelope<T> | null }> {
  const url = `${params.origin.replace(/\/+$/, '')}/api/${params.path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: params.headers,
    body: JSON.stringify(params.body ?? {}),
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  return { status: response.status, ok: response.ok, payload }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('deploy-session-v2-start', auth.address.toLowerCase()),
    RATE_LIMITS.deploySessionStart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many start attempts' } satisfies ApiEnvelope<null>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 512_000 })) as StartRequest | null
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  }

  try {
    const origin = getCanonicalOrigin(req)
    const headers = forwardAuthHeaders(req)

    const created = await proxyPost<{
      sessionId: string
      sessionSignerAddress: Address
      expiresAt: string
    }>({
      origin,
      path: 'deploy/v2/session/create',
      body,
      headers,
    })
    if (!created.ok || !created.payload?.success || !created.payload.data) {
      return res
        .status(created.status || 500)
        .json(created.payload ?? ({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>))
    }

    const sessionId = String(created.payload.data.sessionId)
    const sessionSignerAddressRaw = String(created.payload.data.sessionSignerAddress ?? '').trim()
    const sessionSigner = getAddress(sessionSignerAddressRaw)
    const smartWallet = getAddress(body.smartWallet)

    const autoContinue = body.autoContinue !== false
    if (!autoContinue) {
      return res.status(200).json({
        success: true,
        data: {
          ...created.payload.data,
          ownerInstalled: null,
          continueTriggered: false,
          nextAction: 'manual_resume',
        },
      } satisfies ApiEnvelope<any>)
    }

    const ownerInstalled = await isOwnerInstalled({
      smartWallet,
      ownerAddress: sessionSigner,
      maxScan: 512,
    })
    if (!ownerInstalled) {
      return res.status(200).json({
        success: true,
        data: {
          ...created.payload.data,
          ownerInstalled: false,
          continueTriggered: false,
          nextAction: 'wait_for_owner_install',
        },
      } satisfies ApiEnvelope<any>)
    }

    const resumed = await proxyPost<any>({
      origin,
      path: 'deploy/v2/session/resume',
      body: { sessionId },
      headers,
    })

    const continueTriggered = resumed.ok || resumed.status === 409
    return res.status(200).json({
      success: true,
      data: {
        ...created.payload.data,
        ownerInstalled: true,
        continueTriggered,
        continueStatus: resumed.status,
        continueResponse: resumed.payload,
        nextAction: continueTriggered ? 'poll_status' : 'manual_resume',
      },
    } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const message = err?.message ? String(err.message) : 'start_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<null>)
  }
}
