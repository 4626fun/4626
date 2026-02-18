import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount, toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { parseGrant, validateCallsAgainstGrant } from '../../../../server/_lib/erc7712Permissions.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StatusRequest = { sessionId: string }

const CONCURRENT_MODIFICATION = 'concurrent_modification'

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function asPayloadObject(value: unknown): Record<string, any> {
  if (isPlainObject(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (isPlainObject(parsed)) return parsed
    } catch {
      // ignore malformed payload strings
    }
  }
  throw new Error('deploy_payload_invalid')
}

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

async function getOwnerAccount(rec: any) {
  const payload = asPayloadObject(rec.payload)
  const deploySignerWalletId =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : typeof payload?.agentWalletId === 'string'
        ? payload.agentWalletId.trim()
        : ''
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
  return { ownerAccount, sessionOwner }
}

async function advanceDeploySession(rec: any, req: VercelRequest): Promise<void> {
  const step = String(rec.step ?? '')
  if (
    ![
      'phase1_sent',
      'phase1_confirmed',
      'phase1_finalize_sent',
      'phase1_finalize_confirmed',
      'phase2_core_sent',
      'phase2_core_confirmed',
      'phase2_sent',
      'phase2_confirmed',
      'phase3_sent',
      'phase3_confirmed',
      'phase4_sent',
      'phase4_confirmed',
      'cleanup_sent',
    ].includes(step)
  ) {
    return
  }
  const receiptBackedSteps = ['phase1_sent', 'phase1_finalize_sent', 'phase2_core_sent', 'phase2_sent', 'phase3_sent', 'phase4_sent', 'cleanup_sent']
  const needsReceipt = receiptBackedSteps.includes(step)

  const origin = getCanonicalOrigin(req)
  const bundlerEndpoint = getBundlerEndpoint(origin)
  const transport = http(bundlerEndpoint.url)

  const publicClient = createPublicClient({
    chain: base,
    transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
  })
  const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

  let txHash: Hex | undefined
  if (needsReceipt) {
    if (!rec.lastUserOpHash) return
    const receipt = await bundlerClient.getUserOperationReceipt({ hash: rec.lastUserOpHash as Hex }).catch(() => null)
    txHash = receipt?.receipt?.transactionHash as Hex | undefined
    if (!txHash) return
  }

  if (step === 'cleanup_sent') {
    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: 'cleanup_sent',
      toStep: 'cancelled',
      lastTxHash: txHash,
      lastError: null,
    })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  const payload: any = rec.payload ?? {}
  const deploySignerWalletId =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : typeof payload?.agentWalletId === 'string'
        ? payload.agentWalletId.trim()
        : ''
  const persistSessionOwner =
    payload?.persistSessionOwner === true ||
    (payload?.persistSessionOwner == null && Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner())
  const erc7712Grant = parseGrant(payload?.erc7712Grant)
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
  const normalizeCalls = (raw: unknown): Array<{ to: Address; value: bigint; data: Hex }> => {
    if (!Array.isArray(raw)) return []
    const out: Array<{ to: Address; value: bigint; data: Hex }> = []
    for (const entry of raw) {
      const c = entry as any
      if (!c || typeof c !== 'object') continue
      const data = typeof c.data === 'string' ? c.data : ''
      if (!data.startsWith('0x')) continue
      try {
        out.push({
          to: getAddress(c.to),
          value: toBigInt(c.value ?? 0),
          data: data as Hex,
        })
      } catch {
        // Skip malformed calls; required-stage checks below prevent false completion.
      }
    }
    return out
  }
  const rawPhase1Calls = Array.isArray(payload.phase1Calls) ? payload.phase1Calls : []
  const phase1Calls = normalizeCalls(rawPhase1Calls)
  const phase1FinalizeCalls = phase1Calls.length > 1 ? phase1Calls.slice(1) : []
  const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
  const expectedStages = isPlainObject(payload.expectedStages) ? payload.expectedStages : {}
  const rawPhase2FinalizeCalls = Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : []
  const rawLegacyPhase2Calls = Array.isArray(payload.phase2Calls) ? payload.phase2Calls : []
  const rawSelectedPhase2FinalizeCalls = rawPhase2FinalizeCalls.length > 0 ? rawPhase2FinalizeCalls : rawLegacyPhase2Calls
  const hasPhase2Finalize =
    expectedStages.hasPhase2Finalize === true || rawSelectedPhase2FinalizeCalls.length > 0
  const phase2FinalizeCalls = normalizeCalls(rawSelectedPhase2FinalizeCalls)
  const rawPhase3Calls = Array.isArray(payload.phase3Calls) ? payload.phase3Calls : []
  const rawPhase4Calls = Array.isArray(payload.phase4Calls) ? payload.phase4Calls : []
  const hasPhase3 = expectedStages.hasPhase3 === true || rawPhase3Calls.length > 0
  const hasPhase4 = expectedStages.hasPhase4 === true || rawPhase4Calls.length > 0
  const phase3Calls = normalizeCalls(rawPhase3Calls)
  const phase4Calls = normalizeCalls(rawPhase4Calls)
  if (hasPhase2Finalize && phase2FinalizeCalls.length === 0) throw new Error('phase2_finalize_calls_invalid')
  if (hasPhase3 && phase3Calls.length === 0) throw new Error('phase3_calls_invalid')
  if (hasPhase4 && phase4Calls.length === 0) throw new Error('phase4_calls_invalid')
  const hasPostPhase2 = hasPhase3 || hasPhase4

  type AuthedCtx = {
    bundler: any
    paymasterClient: any
    account: any
    removeOwnerCall: { to: Address; value: bigint; data: Hex }
  }
  let ctx: AuthedCtx | null = null
  const getCtx = async (): Promise<AuthedCtx> => {
    if (ctx) return ctx
    const { ownerAccount, sessionOwner } = await getOwnerAccount(rec)
    const smartWallet = getAddress(rec.smartWallet)
    const ownerIndex = await findOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 512,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const authedTransport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
      ? {
          fetchOptions: {
            headers: {
              'X-CV-Deploy-Session': deployToken,
              'X-CV-Deploy-Session-Signature': deploySig,
            },
          },
        }
      : undefined)
    const paymasterClient = createPaymasterClient({ transport: authedTransport })
    const bundler = createBundlerClient({ client: publicClient as any, transport: authedTransport })
    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWallet,
      owners: [ownerAccount as any],
      ownerIndex,
      version: '1',
    })
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionOwner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWallet, value: 0n, data } as const
    })()

    ctx = { bundler, paymasterClient, account, removeOwnerCall }
    return ctx
  }

  const startStage = async (
    fromStep: string,
    toStep: string,
    calls: Array<{ to: Address; value: bigint; data: Hex }>,
    attachCleanup: boolean,
  ) => {
    const fullCalls = [...calls]
    const shouldAttachCleanup = attachCleanup && !persistSessionOwner
    if (shouldAttachCleanup) fullCalls.push((await getCtx()).removeOwnerCall)

    const permissionCheck = validateCallsAgainstGrant({
      grant: erc7712Grant,
      calls: fullCalls,
      expectedChainId: 8453,
      expectedSessionId: rec.id,
    })
    if (!permissionCheck.ok) throw new Error(permissionCheck.reason ?? 'erc7712_permission_denied')

    const transitioned = await transitionDeploySession({ id: rec.id, fromStep: fromStep as any, toStep: toStep as any })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    const { bundler, paymasterClient, account } = await getCtx()
    const nextHash = await sendUserOperation(bundler, {
      account,
      calls: fullCalls,
      paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
    })
    await updateDeploySession({ id: rec.id, step: toStep as any, lastUserOpHash: nextHash, lastTxHash: null })
  }

  const startNextAfterPhase2 = async (fromStep: string) => {
    if (hasPhase3) {
      await startStage(fromStep, 'phase3_sent', phase3Calls, !hasPhase4)
      return true
    }
    if (hasPhase4) {
      await startStage(fromStep, 'phase4_sent', phase4Calls, true)
      return true
    }
    return false
  }

  if (step === 'phase1_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_sent',
      toStep: 'phase1_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      )
      return
    }
    if (phase2CoreCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_core_sent', phase2CoreCalls, !hasPhase2Finalize && !hasPostPhase2)
      return
    }
    if (hasPhase2Finalize) {
      await startStage('phase1_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase1_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase1_finalize_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_sent',
      toStep: 'phase1_finalize_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase2CoreCalls.length > 0) {
      await startStage(
        'phase1_finalize_confirmed',
        'phase2_core_sent',
        phase2CoreCalls,
        !hasPhase2Finalize && !hasPostPhase2,
      )
      return
    }
    if (hasPhase2Finalize) {
      await startStage('phase1_finalize_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_finalize_confirmed')
      return
    }
    const completed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_confirmed',
      toStep: 'completed',
    })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_core_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase2_core_sent',
      toStep: 'phase2_core_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (hasPhase2Finalize) {
      await startStage('phase2_core_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_core_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_core_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase2_sent',
      toStep: 'phase2_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase3_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase3_sent',
      toStep: 'phase3_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase4_sent',
      toStep: 'phase4_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  // Resume-safe advancement for sessions that already reached a confirmed state.
  if (step === 'phase1_confirmed') {
    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && phase2FinalizeCalls.length === 0 && !hasPostPhase2,
      )
      return
    }
    if (phase2CoreCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_core_sent', phase2CoreCalls, phase2FinalizeCalls.length === 0 && !hasPostPhase2)
      return
    }
    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase1_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase1_finalize_confirmed') {
    if (phase2CoreCalls.length > 0) {
      await startStage(
        'phase1_finalize_confirmed',
        'phase2_core_sent',
        phase2CoreCalls,
        phase2FinalizeCalls.length === 0 && !hasPostPhase2,
      )
      return
    }
    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase1_finalize_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase1_finalize_confirmed')
      return
    }
    const completed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_confirmed',
      toStep: 'completed',
    })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_core_confirmed') {
    if (hasPhase2Finalize) {
      await startStage('phase2_core_confirmed', 'phase2_sent', phase2FinalizeCalls, !hasPostPhase2)
      return
    }
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_core_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_core_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase2_confirmed') {
    if (hasPostPhase2) {
      await startNextAfterPhase2('phase2_confirmed')
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase2_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase3_confirmed') {
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_confirmed') {
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }
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

  const body = await readJsonBody<StatusRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  let rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Ensure the SIWE session matches the recorded sessionAddress.
  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    await advanceDeploySession(rec, req)
    rec = (await getDeploySessionById(sessionId)) ?? rec
  } catch (err) {
    if (err instanceof Error && (err.message === 'deploy_payload_invalid' || err.message.endsWith('_calls_invalid'))) {
      return res.status(409).json({
        success: false,
        error: 'Deploy session payload is invalid or missing required stage calls. Please restart deploy session.',
      } satisfies ApiEnvelope<null>)
    }
    if (err instanceof Error && err.message === CONCURRENT_MODIFICATION) {
      return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
    }
    if (err instanceof Error && err.message === 'cdp_endpoint_missing_on_vercel') {
      return res.status(503).json({
        success: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
      } satisfies ApiEnvelope<null>)
    }
    if (err instanceof Error && (err.message === 'session_owner_unavailable' || err.message === 'session_owner_key_missing')) {
      // Legacy/broken session: keep status readable without failing the endpoint.
      rec = {
        ...rec,
        lastError: rec.lastError || 'session_owner_unavailable',
      }
    }
    // Best-effort: if background advancement fails, still return current state.
  }

  return res.status(200).json({
    success: true,
    data: {
      id: rec.id,
      step: rec.step,
      expiresAt: rec.expiresAt,
      lastError: rec.lastError,
      lastUserOpHash: rec.lastUserOpHash,
      lastTxHash: rec.lastTxHash,
      smartWallet: rec.smartWallet,
      sessionSignerAddress: rec.sessionOwner,
      sessionSignerWalletId:
        (typeof rec?.payload?.deploySignerWalletId === 'string' && rec.payload.deploySignerWalletId.trim()) ||
        (typeof rec?.payload?.agentWalletId === 'string' && rec.payload.agentWalletId.trim()) ||
        null,
      sessionOwner: rec.sessionOwner,
    },
  } satisfies ApiEnvelope<any>)
}
