import type { VercelRequest, VercelResponse } from '@vercel/node'

import { createPublicClient, encodeAbiParameters, getAddress, http, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StartRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  phase1Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase2CoreCalls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase2FinalizeCalls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase2Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase3Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  phase4Calls?: Array<{ to: Address; value?: bigint | number | string; data: Hex }>
  version?: string
  autoContinue?: boolean
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function isOwnerInstalled(params: { smartWallet: Address; ownerAddress: Address; maxScan?: number }): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
  })

  const countRaw = (await publicClient.readContract({
    address: params.smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return false

  const expected = asOwnerBytes(params.ownerAddress).toLowerCase()
  const limit = Math.min(count, Math.max(1, params.maxScan ?? 128))
  for (let i = 0; i < limit; i++) {
    const owner = (await publicClient.readContract({
      address: params.smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex
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

  const body = await readJsonBody<StartRequest>(req)
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  }

  try {
    const origin = getCanonicalOrigin(req)
    const headers = forwardAuthHeaders(req)

    const created = await proxyPost<{
      sessionId: string
      sessionSignerAddress?: Address
      sessionOwner: Address
      expiresAt: string
    }>({
      origin,
      path: 'deploy/session/create',
      body,
      headers,
    })
    if (!created.ok || !created.payload?.success || !created.payload.data) {
      return res
        .status(created.status || 500)
        .json(created.payload ?? ({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>))
    }

    const sessionId = String(created.payload.data.sessionId)
    const sessionSignerAddressRaw = String(
      created.payload.data.sessionSignerAddress ?? created.payload.data.sessionOwner ?? '',
    ).trim()
    const sessionOwner = getAddress(sessionSignerAddressRaw)
    const smartWallet = getAddress(body.smartWallet)

    const autoContinue = body.autoContinue !== false
    if (!autoContinue) {
      return res.status(200).json({
        success: true,
        data: {
          ...created.payload.data,
          ownerInstalled: null,
          continueTriggered: false,
          nextAction: 'manual_continue',
        },
      } satisfies ApiEnvelope<any>)
    }

    const ownerInstalled = await isOwnerInstalled({
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 256,
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

    const continued = await proxyPost<any>({
      origin,
      path: 'deploy/session/continue',
      body: { sessionId },
      headers,
    })

    // 409 "Already in progress" still means a valid started session.
    const continueTriggered = continued.ok || continued.status === 409

    return res.status(200).json({
      success: true,
      data: {
        ...created.payload.data,
        ownerInstalled: true,
        continueTriggered,
        continueStatus: continued.status,
        continueResponse: continued.payload,
        nextAction: continueTriggered ? 'poll_status' : 'manual_continue',
      },
    } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const message = err?.message ? String(err.message) : 'start_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<null>)
  }
}
