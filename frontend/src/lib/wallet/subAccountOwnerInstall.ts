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

import { addOwnerViaBaseAppSendCalls } from '@/lib/wallet/baseAppOwnerCalls'

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

function walletRequestFromProvider(provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }) {
  return async (args: { method: string; params?: unknown[] }) => provider.request(args)
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

/**
 * Install the Privy embedded EOA as an owner of the sub-account CSW via
 * `wallet_sendCalls` (Base App prepared-calls lane).
 */
export async function installEmbeddedOwnerOnSubAccount(params: {
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  subAccountAddress: Address
  embeddedEoaAddress: Address
  publicClient?: ReturnType<typeof createBaseSubAccountReadClient>
  chainId?: number
}): Promise<InstallEmbeddedOwnerResult> {
  const chainId = params.chainId ?? base.id
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

  const submitted = await addOwnerViaBaseAppSendCalls({
    walletRequest: walletRequestFromProvider(params.provider),
    csw: params.subAccountAddress,
    ownerToAdd: params.embeddedEoaAddress,
    chainId,
  })

  return {
    installed: true,
    alreadyOwner: false,
    transactionHash: submitted.transactionHash,
    callBundleId: submitted.callBundleId,
  }
}
