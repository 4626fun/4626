import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount, toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StatusRequest = { sessionId: string }

const CONCURRENT_MODIFICATION = 'concurrent_modification'

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
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
  const { publicClient, smartWallet, ownerAddress, maxScan = 64 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return null

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(count, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    const b = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex
    if (String(b).toLowerCase() === expected) return i
  }
  return null
}

async function getOwnerAccount(rec: any) {
  const payload: any = rec.payload ?? {}
  const agentWalletId = typeof payload?.agentWalletId === 'string' ? payload.agentWalletId.trim() : ''
  const sessionOwner = getAddress(rec.sessionOwner)
  const ownerAccount = agentWalletId
    ? toAccount({
        address: sessionOwner,
        sign: async ({ hash }: { hash: Hex }) => {
          return (await secp256k1SignHash({ walletId: agentWalletId, hash })) as Hex
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
            walletId: agentWalletId,
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
        if (!rec.sessionOwnerKeyEnc) throw new Error('session_owner_key_missing')
        const pk = decryptWithSecret(rec.sessionOwnerKeyEnc) as Hex
        return privateKeyToAccount(pk)
      })()
  return { ownerAccount, sessionOwner }
}

async function advanceDeploySession(rec: any, req: VercelRequest): Promise<void> {
  const step = String(rec.step ?? '')
  if (!['phase1_sent', 'phase2_core_sent', 'phase2_sent', 'phase3_sent', 'cleanup_sent'].includes(step)) return
  if (!rec.lastUserOpHash) return

  const origin = getCanonicalOrigin(req)
  const bundlerUrl = `${origin}/api/paymaster`
  const transport = http(bundlerUrl)

  const publicClient = createPublicClient({
    chain: base,
    transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
  })
  const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

  const receipt = await bundlerClient.getUserOperationReceipt({ hash: rec.lastUserOpHash as Hex }).catch(() => null)
  const txHash = receipt?.receipt?.transactionHash as Hex | undefined
  if (!txHash) return

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
  const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
  const phase2FinalizeCallsRaw = normalizeCalls(Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : [])
  const legacyPhase2Calls = normalizeCalls(Array.isArray(payload.phase2Calls) ? payload.phase2Calls : [])
  const phase2FinalizeCalls = phase2FinalizeCallsRaw.length > 0 ? phase2FinalizeCallsRaw : legacyPhase2Calls
  const phase3Calls = normalizeCalls(Array.isArray(payload.phase3Calls) ? payload.phase3Calls : [])
  const phase4Calls = normalizeCalls(Array.isArray(payload.phase4Calls) ? payload.phase4Calls : [])
  const postPhase2Calls = [...phase3Calls, ...phase4Calls]

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
      maxScan: 128,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const authedTransport = http(bundlerUrl, {
      fetchOptions: {
        headers: {
          'X-CV-Deploy-Session': deployToken,
          'X-CV-Deploy-Session-Signature': deploySig,
        },
      },
    })
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
    const transitioned = await transitionDeploySession({ id: rec.id, fromStep: fromStep as any, toStep: toStep as any })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    const { bundler, paymasterClient, account, removeOwnerCall } = await getCtx()
    const fullCalls = [...calls]
    if (attachCleanup) fullCalls.push(removeOwnerCall)
    const nextHash = await sendUserOperation(bundler, {
      account,
      calls: fullCalls,
      paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
    })
    await updateDeploySession({ id: rec.id, step: toStep as any, lastUserOpHash: nextHash, lastTxHash: null })
  }

  if (step === 'phase1_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_sent',
      toStep: 'phase1_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase2CoreCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_core_sent', phase2CoreCalls, phase2FinalizeCalls.length === 0 && postPhase2Calls.length === 0)
      return
    }
    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase1_confirmed', 'phase2_sent', phase2FinalizeCalls, postPhase2Calls.length === 0)
      return
    }
    if (postPhase2Calls.length > 0) {
      await startStage('phase1_confirmed', 'phase3_sent', postPhase2Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase1_confirmed', toStep: 'completed' })
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

    if (phase2FinalizeCalls.length > 0) {
      await startStage('phase2_core_confirmed', 'phase2_sent', phase2FinalizeCalls, postPhase2Calls.length === 0)
      return
    }
    if (postPhase2Calls.length > 0) {
      await startStage('phase2_core_confirmed', 'phase3_sent', postPhase2Calls, true)
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

    if (postPhase2Calls.length > 0) {
      await startStage('phase2_confirmed', 'phase3_sent', postPhase2Calls, true)
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
    const completed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase3_confirmed',
      toStep: 'completed',
    })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const session = readSessionFromRequest(req)
  if (!session?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<StatusRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  let rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Ensure the SIWE session matches the recorded sessionAddress.
  const sessionAddress = getAddress(session.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    await advanceDeploySession(rec, req)
    rec = (await getDeploySessionById(sessionId)) ?? rec
  } catch (err) {
    if (err instanceof Error && err.message === CONCURRENT_MODIFICATION) {
      return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
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
      sessionOwner: rec.sessionOwner,
    },
  } satisfies ApiEnvelope<any>)
}
