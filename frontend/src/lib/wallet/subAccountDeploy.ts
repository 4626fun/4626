import {
  createPublicClient,
  getAddress,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'

import { resolveSelfAuthSendCallsRequest } from '@/lib/relay/resolveOwnerMutationWallet'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'

type DeployProvider = {
  getProvider?: () => { request?: (args: unknown) => Promise<unknown> } | null | undefined
}

export async function readSubAccountIsDeployed(
  publicClient: PublicClient,
  subAccountAddress: Address,
): Promise<boolean> {
  const code = await publicClient.getBytecode({ address: subAccountAddress }).catch(() => null)
  return Boolean(code && code !== '0x')
}

export async function waitForSubAccountDeployed(params: {
  publicClient: PublicClient
  subAccountAddress: Address
  timeoutMs?: number
  intervalMs?: number
}): Promise<boolean> {
  const deadline = Date.now() + (params.timeoutMs ?? 90_000)
  while (Date.now() < deadline) {
    if (await readSubAccountIsDeployed(params.publicClient, params.subAccountAddress)) return true
    await new Promise((resolve) => setTimeout(resolve, params.intervalMs ?? 2_000))
  }
  return false
}

/**
 * Base App sub-accounts stay counterfactual until their first UserOp. Relay
 * Part 2 `addOwnerAddress` requires bytecode at the app wallet, so submit a
 * minimal EIP-5792 bundle from the sub-account first to trigger lazy deploy.
 */
export async function deployCounterfactualSubAccount(params: {
  baseAccountSdk: DeployProvider
  subAccountAddress: Address
  publicClient?: PublicClient
}): Promise<{ callBundleId: string; txHash: string | null; deployed: boolean }> {
  const subAccount = getAddress(params.subAccountAddress) as Address
  const walletRequest = resolveSelfAuthSendCallsRequest({
    wagmiWalletClient: null,
    baseAccountSdk: params.baseAccountSdk,
    ownerSignerAddress: subAccount,
  })
  if (!walletRequest) {
    throw new Error('Base App wallet session is unavailable. Open 4626 in Base App and retry.')
  }

  const { callBundleId } = await _submitOwnerViaSendCalls({
    walletRequest,
    csw: subAccount,
    chainId: base.id,
    calls: [
      {
        to: subAccount,
        data: '0x' as Hex,
        value: 0n,
      },
    ],
  })

  const txHash = await waitForCallsTxHash({
    walletRequest,
    callBundleId,
    timeoutMs: 90_000,
  })

  const publicClient =
    params.publicClient ??
    createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
  const deployed = await waitForSubAccountDeployed({
    publicClient,
    subAccountAddress: subAccount,
    timeoutMs: txHash ? 60_000 : 15_000,
  })

  return { callBundleId, txHash, deployed }
}
