import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  logger,
} from '../../../../packages/server-core/src/index.js'


import { getDeploySessionById, signDeployToken, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { validateSponsoredSmartWalletCalls } from '../../_paymaster.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type CancelRequest = { sessionId: string }

function isTruthyEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function shouldPersistManagedSessionOwner(): boolean {
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, false)
}

function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('.vercel.app')
  } catch {
    return true
  }
}

function getBundlerEndpoint(origin: string): { url: string; viaProxy: boolean } {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  if (direct) return { url: direct, viaProxy: false }

  // On Vercel previews/production, same-origin /api/paymaster can be protected and fail
  // with HTML auth responses for server-to-server calls. Require direct CDP config instead.
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  if (isVercelEnv && isVercelDeploymentOrigin(origin)) {
    throw new Error('cdp_endpoint_missing_on_vercel')
  }

  return { url: `${origin}/api/paymaster`, viaProxy: true }
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 128 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  let upperBound = Number.isFinite(count) ? count : 0
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
  } catch {
    // ignore: not all contract versions expose nextOwnerIndex
  }
  if (!Number.isFinite(upperBound) || upperBound <= 0) return null

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    let b: Hex
    try {
      b = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as Hex
    } catch {
      continue
    }
    if (String(b).toLowerCase() === expected) return i
  }
  return null
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

  const body = await readJsonBody<CancelRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  const rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Check if already in terminal state
  if (['cancelled', 'completed'].includes(rec.step)) {
    return res.status(200).json({ success: true, data: { id: rec.id, step: rec.step } } satisfies ApiEnvelope<any>)
  }

  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    const payload: any = rec.payload ?? {}
    const deploySignerWalletIdFromPayload =
      typeof payload?.deploySignerWalletId === 'string'
        ? payload.deploySignerWalletId.trim()
        : ''
    const deploySignerWalletIdFromRecord =
      typeof (rec as any)?.sessionSignerWalletId === 'string'
        ? String((rec as any).sessionSignerWalletId).trim()
        : ''
    const deploySignerWalletId = deploySignerWalletIdFromPayload || deploySignerWalletIdFromRecord
    const persistSessionOwner =
      Boolean(deploySignerWalletId) &&
      (payload?.persistSessionOwner === true ||
        (payload?.persistSessionOwner == null && shouldPersistManagedSessionOwner()))
    if (persistSessionOwner) {
      await updateDeploySession({ id: rec.id, step: 'cancelled', lastError: null })
      return res.status(200).json({
        success: true,
        data: { id: rec.id, step: 'cancelled', cleanupSkipped: true, reason: 'persistent_session_owner' },
      } satisfies ApiEnvelope<any>)
    }
    if (!deploySignerWalletId) {
      await updateDeploySession({ id: rec.id, step: 'cancelled', lastError: 'cleanup_skipped_owner_unavailable' })
      return res.status(200).json({
        success: true,
        data: { id: rec.id, step: 'cancelled', cleanupSkipped: true, reason: 'session_signer_unavailable' },
      } satisfies ApiEnvelope<any>)
    }
    const sessionSigner = getAddress(rec.sessionSigner)
    const ownerAccount = toAccount({
      address: sessionSigner,
      sign: async ({ hash }: { hash: Hex }) => {
        return (await secp256k1SignHash({ walletId: deploySignerWalletId, hash })) as Hex
      },
      signTransaction: async () => {
        throw new Error('privy_sign_transaction_unsupported')
      },
      signMessage: async ({ message }: { message: SignableMessage }) => {
        const msg =
          typeof message === 'string'
            ? message
            : typeof message.raw === 'string'
              ? message.raw
              : `0x${Buffer.from(message.raw).toString('hex')}`
        const out = await walletRpc<any>({
          walletId: deploySignerWalletId,
          method: 'personal_sign',
          rpcParams: { message: msg, encoding: 'hex' },
        })
        const sig = String(out?.data?.signature ?? '').trim()
        if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('privy_personal_sign_invalid_signature')
        return sig as Hex
      },
      signTypedData: async () => {
        throw new Error('privy_sign_typed_data_unsupported')
      },
    })
    const smartWallet = getAddress(rec.smartWallet)

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

    const ownerIndex = await findOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress: sessionSigner,
      maxScan: 256,
    })
    if (ownerIndex === null) {
      await updateDeploySession({ id: rec.id, step: 'cancelled', lastError: null })
      return res.status(200).json({ success: true, data: { id: rec.id, step: 'cancelled' } } satisfies ApiEnvelope<any>)
    }

    const origin = getCanonicalOrigin(req)
    const bundlerEndpoint = getBundlerEndpoint(origin)

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const transport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
      ? {
          fetchOptions: {
            headers: {
              'X-CV-Deploy-Session': deployToken,
              'X-CV-Deploy-Session-Signature': deploySig,
            },
          },
        }
      : undefined)

    const paymasterClient = createPaymasterClient({ transport })
    const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWallet,
      owners: [ownerAccount as any],
      ownerIndex,
      version: '1',
    })

    const ownerBytes = asOwnerBytes(sessionSigner)
    const data = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
      functionName: 'removeOwnerAtIndex',
      args: [BigInt(ownerIndex), ownerBytes],
    })
    const cleanupCall = { to: smartWallet, value: 0n, data } as const

    await validateSponsoredSmartWalletCalls({
      sender: smartWallet,
      sessionAddress,
      calls: [cleanupCall],
      deploySessionOwner: sessionSigner,
      allowCleanupOnlyForInactiveDeploySession: true,
    })

    await updateDeploySession({ id: rec.id, step: 'cleanup_sent' })
    const hash = await sendUserOperation(bundlerClient, {
      account,
      calls: [cleanupCall],
      paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
    })
    await updateDeploySession({ id: rec.id, step: 'cleanup_sent', lastUserOpHash: hash, lastTxHash: null, lastError: null })

    return res.status(200).json({
      success: true,
      data: { id: rec.id, step: 'cleanup_sent', lastUserOpHash: hash },
    } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'cancel_failed'
    if (msg === 'cdp_endpoint_missing_on_vercel') {
      return res.status(503).json({
        success: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
      } satisfies ApiEnvelope<null>)
    }
    logger.error('deploy session cancel failed', msg)
    try {
      await updateDeploySession({ id: rec.id, step: 'failed', lastError: msg })
    } catch {
      // ignore
    }
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<null>)
  }
}
