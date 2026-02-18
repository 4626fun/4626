import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { logger } from '../../../../server/_lib/logger.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { parseGrant, validateCallsAgainstGrant } from '../../../../server/_lib/erc7712Permissions.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type ContinueRequest = { sessionId: string }

function isTruthyEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function shouldPersistManagedSessionOwner(): boolean {
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, true)
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
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 512 } = params
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

  const body = await readJsonBody<ContinueRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  const rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Check session expiration
  if (Date.parse(rec.expiresAt) <= Date.now()) {
    return res.status(410).json({ success: false, error: 'Session expired' } satisfies ApiEnvelope<null>)
  }

  // Check session not in terminal state
  if (['cancelled', 'failed', 'completed'].includes(rec.step)) {
    return res.status(400).json({ success: false, error: `Session already ${rec.step}` } satisfies ApiEnvelope<null>)
  }

  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    // Server signs userops using the deploy-session owner.
    // New sessions use a Privy-managed deploy signer wallet; legacy sessions use an encrypted raw private key.
    const payload: any = rec.payload ?? {}
    const erc7712Grant = parseGrant(payload?.erc7712Grant)
    const deploySignerWalletId =
      typeof payload?.deploySignerWalletId === 'string'
        ? payload.deploySignerWalletId.trim()
        : typeof payload?.agentWalletId === 'string'
          ? payload.agentWalletId.trim()
          : ''
    const persistSessionOwner =
      payload?.persistSessionOwner === true ||
      (payload?.persistSessionOwner == null && Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner())
    const sessionOwner = getAddress(rec.sessionOwner)
    const ownerAccount = deploySignerWalletId
      ? toAccount({
          address: sessionOwner,
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
      : (() => {
          if (!rec.sessionOwnerKeyEnc) throw new Error('session_owner_unavailable')
          const pk = decryptWithSecret(rec.sessionOwnerKeyEnc) as Hex
          return privateKeyToAccount(pk)
        })()
    const smartWallet = getAddress(rec.smartWallet)
    const ownerIndex = await findOwnerIndex({
      publicClient: createPublicClient({ chain: base, transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()) }),
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 512,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

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

    const toBigInt = (v: any): bigint => {
      if (typeof v === 'bigint') return v
      if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v))
      if (typeof v === 'string') {
        const s = v.trim()
        if (!s) return 0n
        if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s)
        return BigInt(s)
      }
      return 0n
    }

    const normalizeCalls = (raw: any[]): Array<{ to: Address; value: bigint; data: Hex }> => {
      if (!Array.isArray(raw)) return []
      return raw
        .map((c) => ({
          to: getAddress(c.to),
          value: toBigInt(c.value ?? 0),
          data: c.data as Hex,
        }))
        .filter((c) => typeof c.data === 'string' && c.data.startsWith('0x'))
    }

    const phase1Calls = normalizeCalls(Array.isArray(payload.phase1Calls) ? payload.phase1Calls : [])
    const phase1CoreCalls = phase1Calls.length > 1 ? phase1Calls.slice(0, 1) : phase1Calls
    const phase1FinalizeCalls = phase1Calls.length > 1 ? phase1Calls.slice(1) : []
    const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
    const phase2FinalizeCallsRaw = normalizeCalls(
      Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : [],
    )
    const legacyPhase2Calls = normalizeCalls(Array.isArray(payload.phase2Calls) ? payload.phase2Calls : [])
    const phase2FinalizeCalls = phase2FinalizeCallsRaw.length > 0 ? phase2FinalizeCallsRaw : legacyPhase2Calls
    const phase3Calls = normalizeCalls(Array.isArray(payload.phase3Calls) ? payload.phase3Calls : [])
    const phase4Calls = normalizeCalls(Array.isArray(payload.phase4Calls) ? payload.phase4Calls : [])
    const postPhase2Calls = [...phase3Calls, ...phase4Calls]

    const isInFlight = ['phase1_sent', 'phase1_finalize_sent', 'phase2_core_sent', 'phase2_sent', 'phase3_sent', 'cleanup_sent'].includes(rec.step)

    // Cleanup call (remove session owner). For managed owners, this can be skipped to reduce repeated prompts.
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionOwner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWallet, value: 0n, data } as const
    })()

    const hasPostPhase2 = postPhase2Calls.length > 0
    const sendStage = async (toStep: string, stageCalls: Array<{ to: Address; value: bigint; data: Hex }>, attachCleanup: boolean) => {
      const calls = [...stageCalls]
      const shouldAttachCleanup = attachCleanup && !persistSessionOwner
      if (shouldAttachCleanup) calls.push(removeOwnerCall)

      const permissionCheck = validateCallsAgainstGrant({
        grant: erc7712Grant,
        calls,
        expectedChainId: 8453,
        expectedSessionId: rec.id,
      })
      if (!permissionCheck.ok) {
        return res.status(403).json({
          success: false,
          error: permissionCheck.reason ?? 'erc7712_permission_denied',
        } satisfies ApiEnvelope<null>)
      }

      const transitioned = await transitionDeploySession({
        id: rec.id,
        fromStep: rec.step,
        toStep: toStep as any,
      })
      if (!transitioned) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      const lastUserOpHash = await sendUserOperation(bundlerClient, {
        account,
        calls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      await updateDeploySession({ id: rec.id, step: toStep as any, lastUserOpHash, lastTxHash: null })
      return res.status(200).json({ success: true, data: { id: rec.id, step: toStep, lastUserOpHash } } satisfies ApiEnvelope<any>)
    }

    // Kick off whichever stage is next based on persisted step.
    // Note: we intentionally key off the persisted step (not call-array emptiness), because
    // the payload contains *all* calls for the full deploy.
    const runFromCreated = () => {
      if (phase1CoreCalls.length > 0) {
        const attachCleanup =
          phase1FinalizeCalls.length === 0 &&
          phase2CoreCalls.length === 0 &&
          phase2FinalizeCalls.length === 0 &&
          !hasPostPhase2
        return sendStage('phase1_sent', phase1CoreCalls, attachCleanup)
      }
      if (phase2CoreCalls.length > 0) {
        const attachCleanup = phase2FinalizeCalls.length === 0 && !hasPostPhase2
        return sendStage('phase2_core_sent', phase2CoreCalls, attachCleanup)
      }
      if (phase2FinalizeCalls.length > 0) {
        const attachCleanup = !hasPostPhase2
        return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
      }
      if (postPhase2Calls.length > 0) return sendStage('phase3_sent', postPhase2Calls, true)
      return null
    }

    const runFromPhase1Confirmed = () => {
      if (phase1FinalizeCalls.length > 0) {
        const attachCleanup = phase2CoreCalls.length === 0 && phase2FinalizeCalls.length === 0 && !hasPostPhase2
        return sendStage('phase1_finalize_sent', phase1FinalizeCalls, attachCleanup)
      }
      if (phase2CoreCalls.length > 0) {
        const attachCleanup = phase2FinalizeCalls.length === 0 && !hasPostPhase2
        return sendStage('phase2_core_sent', phase2CoreCalls, attachCleanup)
      }
      if (phase2FinalizeCalls.length > 0) {
        const attachCleanup = !hasPostPhase2
        return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
      }
      if (postPhase2Calls.length > 0) return sendStage('phase3_sent', postPhase2Calls, true)
      return null
    }

    const runFromPhase1FinalizeConfirmed = () => {
      if (phase2CoreCalls.length > 0) {
        const attachCleanup = phase2FinalizeCalls.length === 0 && !hasPostPhase2
        return sendStage('phase2_core_sent', phase2CoreCalls, attachCleanup)
      }
      if (phase2FinalizeCalls.length > 0) {
        const attachCleanup = !hasPostPhase2
        return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
      }
      if (postPhase2Calls.length > 0) return sendStage('phase3_sent', postPhase2Calls, true)
      return null
    }

    const runFromPhase2CoreConfirmed = () => {
      if (phase2FinalizeCalls.length > 0) {
        const attachCleanup = !hasPostPhase2
        return sendStage('phase2_sent', phase2FinalizeCalls, attachCleanup)
      }
      if (postPhase2Calls.length > 0) return sendStage('phase3_sent', postPhase2Calls, true)
      return null
    }

    if (rec.step === 'created') {
      const started = await runFromCreated()
      if (started) return started
    }
    if (rec.step === 'phase1_confirmed') {
      const started = await runFromPhase1Confirmed()
      if (started) return started
    }
    if (rec.step === 'phase1_finalize_confirmed') {
      const started = await runFromPhase1FinalizeConfirmed()
      if (started) return started
    }
    if (rec.step === 'phase2_core_confirmed') {
      const started = await runFromPhase2CoreConfirmed()
      if (started) return started
    }
    if (rec.step === 'phase2_confirmed' && postPhase2Calls.length > 0) {
      return await sendStage('phase3_sent', postPhase2Calls, true)
    }

    if (isInFlight) {
      return res.status(409).json({ success: false, error: 'Already in progress' } satisfies ApiEnvelope<null>)
    }

    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: rec.step,
      toStep: 'completed',
    })
    if (!transitioned) {
      return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
    }

    return res.status(200).json({
      success: true,
      data: {
        id: rec.id,
        step: 'completed',
      },
    } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'continue_failed'
    if (msg === 'session_owner_unavailable' || msg === 'session_owner_key_missing') {
      return res.status(409).json({
        success: false,
        error: 'Session owner credentials unavailable. Please restart deploy session.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg === 'session_owner_not_installed') {
      return res.status(409).json({
        success: false,
        error:
          'Deploy-session signer is not installed on the canonical smart wallet. Approve the one-time add-owner transaction, then retry.',
      } satisfies ApiEnvelope<null>)
    }
    if (msg === 'cdp_endpoint_missing_on_vercel') {
      return res.status(503).json({
        success: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
      } satisfies ApiEnvelope<null>)
    }
    logger.error('deploy session continue failed', msg)
    try {
      await updateDeploySession({ id: rec.id, step: 'failed', lastError: msg })
    } catch {
      // ignore
    }
    return res.status(500).json({ success: false, error: 'Internal server error' } satisfies ApiEnvelope<null>)
  }
}
