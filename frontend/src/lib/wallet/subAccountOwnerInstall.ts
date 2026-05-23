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
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

export type InstallEmbeddedOwnerResult = {
  /** True when we submitted addOwnerAddress (user signed). */
  installed: boolean
  /** True when the embedded EOA was already an on-chain owner. */
  alreadyOwner: boolean
  transactionHash: Hex | null
  callBundleId: string | null
}

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>
const BASE_MAINNET_CHAIN_ID_HEX = '0x2105'

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
    lower.includes('requested method and/or account has not been authorized') ||
    lower.includes('must call eth_requestaccounts') ||
    lower.includes('must call "eth_requestaccounts"')
  )
}

function isHexChainId(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)
}

async function ensureBaseMainnetWalletContext(walletRequest: WalletRequest): Promise<void> {
  const current = await walletRequest({ method: 'eth_chainId' })
  if (isHexChainId(current) && current.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX) return

  try {
    await walletRequest({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_MAINNET_CHAIN_ID_HEX }],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    throw new Error(
      `Base App is currently in testnet mode. 4626 signing setup requires Base Mainnet. ${message}`.trim(),
    )
  }

  const postSwitch = await walletRequest({ method: 'eth_chainId' })
  if (!isHexChainId(postSwitch) || postSwitch.toLowerCase() !== BASE_MAINNET_CHAIN_ID_HEX) {
    throw new Error('Base App is currently in testnet mode. 4626 signing setup requires Base Mainnet.')
  }
}

async function refreshBaseAppAuthorization(walletRequest: WalletRequest): Promise<void> {
  await walletRequest({ method: 'eth_requestAccounts' })
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
  return readIsOwnerAddressIfDeployed({
    publicClient: client,
    cswAddress: params.subAccountAddress,
    ownerAddress: params.embeddedEoaAddress,
  })
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
 * Primary lane: `wallet_sendCalls` (Base App builds UserOps for CSW self-calls).
 * Fallback: `eth_sendTransaction` when sendCalls is unavailable outside Base App.
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
  await ensureBaseMainnetWalletContext(walletRequest)
  await refreshBaseAppAuthorization(walletRequest)

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

  async function submitViaEthSendTransaction() {
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
    } satisfies InstallEmbeddedOwnerResult
  }

  async function reauthorizeAndRetry<T>(fn: () => Promise<T>): Promise<T> {
    await refreshBaseAppAuthorization(walletRequest)
    return await fn()
  }

  try {
    return await submitViaSendCalls()
  } catch (sendCallsError) {
    if (isUserRejectedWalletAction(sendCallsError)) {
      throw sendCallsError
    }
    if (isUnauthorizedMethodOrAccount(sendCallsError)) {
      try {
        return await reauthorizeAndRetry(submitViaSendCalls)
      } catch (retrySendCallsError) {
        if (isUserRejectedWalletAction(retrySendCallsError)) {
          throw retrySendCallsError
        }
        // Fall through to direct lane after reauth + sendCalls retry.
      }
    }

    try {
      return await submitViaEthSendTransaction()
    } catch (directError) {
      if (isUserRejectedWalletAction(directError)) {
        throw directError
      }
      if (isUnauthorizedMethodOrAccount(directError)) {
        try {
          return await reauthorizeAndRetry(submitViaEthSendTransaction)
        } catch (directRetryError) {
          if (isUserRejectedWalletAction(directRetryError)) {
            throw directRetryError
          }
          throw sendCallsError
        }
      }
      throw sendCallsError
    }
  }
}
