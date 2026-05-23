/**
 * Read-only helpers for Base App sub-account owner state.
 *
 * Owner install is handled exclusively through Relay (`useAddOwnerFlow` /
 * `preview-add-owner`). Do not submit bare CSW `addOwnerAddress` sendCalls here.
 */

import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'

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
