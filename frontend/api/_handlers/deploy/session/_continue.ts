import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { logger } from '../../../../server/_lib/logger.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../server/_lib/deploySessions.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { secp256k1SignHash, walletRpc } from '../../../../server/_lib/privyWalletApi.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type ContinueRequest = { sessionId: string }

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
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

  const sessionAddress = getAddress(session.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    // Server signs userops using the temporary owner.
    // New sessions use a Privy-managed agent wallet; legacy sessions use an encrypted raw private key.
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
    const smartWallet = getAddress(rec.smartWallet)
    const ownerIndex = await findOwnerIndex({
      publicClient: createPublicClient({ chain: base, transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()) }),
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 128,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

    const origin = getCanonicalOrigin(req)
    const bundlerUrl = `${origin}/api/paymaster`

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const transport = http(bundlerUrl, {
      fetchOptions: {
        headers: {
          'X-CV-Deploy-Session': deployToken,
          'X-CV-Deploy-Session-Signature': deploySig,
        },
      },
    })

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
    const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
    const phase2FinalizeCallsRaw = normalizeCalls(
      Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : [],
    )
    const legacyPhase2Calls = normalizeCalls(Array.isArray(payload.phase2Calls) ? payload.phase2Calls : [])
    const phase2FinalizeCalls = phase2FinalizeCallsRaw.length > 0 ? phase2FinalizeCallsRaw : legacyPhase2Calls
    const phase3Calls = normalizeCalls(Array.isArray(payload.phase3Calls) ? payload.phase3Calls : [])
    const phase4Calls = normalizeCalls(Array.isArray(payload.phase4Calls) ? payload.phase4Calls : [])
    const postPhase2Calls = [...phase3Calls, ...phase4Calls]

    const isInFlight = ['phase1_sent', 'phase2_core_sent', 'phase2_sent', 'phase3_sent', 'cleanup_sent'].includes(rec.step)

    // Cleanup call (remove the temporary owner). Attach it to the last UserOp we send.
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
      const transitioned = await transitionDeploySession({
        id: rec.id,
        fromStep: rec.step,
        toStep: toStep as any,
      })
      if (!transitioned) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      const calls = [...stageCalls]
      if (attachCleanup) calls.push(removeOwnerCall)
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
      if (phase1Calls.length > 0) {
        const attachCleanup = phase2CoreCalls.length === 0 && phase2FinalizeCalls.length === 0 && !hasPostPhase2
        return sendStage('phase1_sent', phase1Calls, attachCleanup)
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
    logger.error('deploy session continue failed', msg)
    try {
      await updateDeploySession({ id: rec.id, step: 'failed', lastError: msg })
    } catch {
      // ignore
    }
    return res.status(500).json({ success: false, error: 'Internal server error' } satisfies ApiEnvelope<null>)
  }
}
