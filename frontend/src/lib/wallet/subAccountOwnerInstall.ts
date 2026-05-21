/**
 * On-chain owner install for Base App sub-accounts.
 *
 * `wallet_addSubAccount` registers the Privy embedded EOA as an app signer key,
 * but we still install it as a CSW owner on the sub-account contract so
 * execution paths that read `isOwnerAddress` stay aligned with the legacy model.
 *
 * Parent CSW owner mutation from third-party dapps remains blocked; this targets
 * the per-app sub-account address only.
 */

import { createPublicClient, http, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { addOwnerViaBaseAppSendCalls, encodeAddOwnerCall } from '@/lib/wallet/baseAppOwnerCalls'

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export type InstallEmbeddedOwnerResult = {
  /** True when we submitted addOwnerAddress (user signed). */
  installed: boolean
  /** True when the embedded EOA was already an on-chain owner. */
  alreadyOwner: boolean
  transactionHash: Hex | null
  callBundleId: string | null
}

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

function walletRequestFromProvider(provider: { request: WalletRequest }) {
  return async (args: { method: string; params?: unknown[] }) => provider.request(args)
}

function isTxHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function isUserRejectedWalletAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')
}

function isUnauthorizedMethodOrAccount(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('not been authorized by the user') ||
    lower.includes('requested method and/or account has not been authorized')
  )
}

export function createBaseSubAccountReadClient() {
  const rpcUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env.VITE_BASE_RPC_URL as string | undefined)?.trim()) ||
    'https://mainnet.base.org'
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  })
}

export async function readEmbeddedOwnerOnSubAccount(params: {
  publicClient?: ReturnType<typeof createBaseSubAccountReadClient>
  subAccountAddress: Address
  embeddedEoaAddress: Address
}): Promise<boolean | null> {
  const client = params.publicClient ?? createBaseSubAccountReadClient()
  try {
    const isOwner = await client.readContract({
      address: params.subAccountAddress,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [params.embeddedEoaAddress],
    })
    return Boolean(isOwner)
  } catch {
    // Counterfactual / not-yet-deployed sub-accounts have no code to read.
    return null
  }
}

async function addOwnerViaEthSendTransaction(params: {
  walletRequest: WalletRequest
  subAccountAddress: Address
  embeddedEoaAddress: Address
}): Promise<{ transactionHash: Hex | null }> {
  const call = encodeAddOwnerCall({
    csw: params.subAccountAddress,
    ownerToAdd: params.embeddedEoaAddress,
  })
  const result = await params.walletRequest({
    method: 'eth_sendTransaction',
    params: [
      {
        from: params.subAccountAddress,
        to: call.to,
        data: call.data,
        value: call.value,
      },
    ],
  })
  if (isTxHash(result)) {
    return { transactionHash: result }
  }
  throw new Error('eth_sendTransaction did not return a transaction hash.')
}

/**
 * Install the Privy embedded EOA as an owner of the sub-account CSW.
 *
 * Primary lane: `eth_sendTransaction` self-call (Base App allows this for
 * addOwnerAddress). Fallback: `wallet_sendCalls` when the direct lane fails
 * for non-user-rejection reasons.
 */
export async function installEmbeddedOwnerOnSubAccount(params: {
  provider: { request: WalletRequest }
  subAccountAddress: Address
  embeddedEoaAddress: Address
  publicClient?: ReturnType<typeof createBaseSubAccountReadClient>
  chainId?: number
}): Promise<InstallEmbeddedOwnerResult> {
  const chainId = params.chainId ?? base.id
  const walletRequest = walletRequestFromProvider(params.provider)
  const ownerState = await readEmbeddedOwnerOnSubAccount({
    publicClient: params.publicClient,
    subAccountAddress: params.subAccountAddress,
    embeddedEoaAddress: params.embeddedEoaAddress,
  })
  if (ownerState === true) {
    return {
      installed: false,
      alreadyOwner: true,
      transactionHash: null,
      callBundleId: null,
    }
  }

  async function submitViaSendCalls() {
    const submitted = await addOwnerViaBaseAppSendCalls({
      walletRequest,
      csw: params.subAccountAddress,
      ownerToAdd: params.embeddedEoaAddress,
      chainId,
    })
    return {
      installed: true,
      alreadyOwner: false,
      transactionHash: submitted.transactionHash,
      callBundleId: submitted.callBundleId,
    } satisfies InstallEmbeddedOwnerResult
  }

  try {
    const direct = await addOwnerViaEthSendTransaction({
      walletRequest,
      subAccountAddress: params.subAccountAddress,
      embeddedEoaAddress: params.embeddedEoaAddress,
    })
    return {
      installed: true,
      alreadyOwner: false,
      transactionHash: direct.transactionHash,
      callBundleId: null,
    }
  } catch (directError) {
    if (isUserRejectedWalletAction(directError)) {
      throw directError
    }

    try {
      return await submitViaSendCalls()
    } catch (sendCallsError) {
      if (!isUnauthorizedMethodOrAccount(sendCallsError)) {
        throw sendCallsError
      }
      await walletRequest({ method: 'eth_requestAccounts' })
      return await submitViaSendCalls()
    }
  }
}
