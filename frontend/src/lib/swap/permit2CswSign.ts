import { permit2ABI, permit2Address } from '@zoralabs/protocol-deployments'
import {
  getAddress,
  hashTypedData,
  isAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'

import { findCoinbaseSmartWalletOwnerIndex } from '@/lib/aa/coinbaseErc4337Owners'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import {
  assertCswAcceptsErc1271Signature,
  signOwnerSignatureForCswErc1271,
} from '@/lib/wallet/cswOwnerSignature'
import { sanitizePermitDataForSwapApi } from '@/lib/uniswap/swapQuoteSanitize'
import { toPermitSignPayload } from '@/lib/uniswap/tradingApi'

type Permit2WalletClient = {
  signTypedData: (args: Record<string, unknown>) => Promise<Hex | string>
  signMessage?: (args: Record<string, unknown>) => Promise<Hex | string>
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function isDeployedSmartWalletExecutionAddress(
  executionAddress?: string | null,
): Promise<boolean> {
  const executionRaw = String(executionAddress ?? '').trim()
  if (!executionRaw || !isAddress(executionRaw)) return false
  const readClient = getProductionBaseReadClient()
  const bytecode = await readClient.getBytecode({ address: getAddress(executionRaw) })
  return Boolean(bytecode && bytecode !== '0x')
}

async function readPermit2AllowanceNonce(params: {
  readClient: PublicClient
  permitOwner: Address
  token: Address
  spender: Address
}): Promise<number> {
  const [, , nonce] = (await params.readClient.readContract({
    abi: permit2ABI,
    address: permit2Address[base.id],
    functionName: 'allowance',
    args: [params.permitOwner, params.token, params.spender],
  })) as readonly [bigint, bigint, number]
  return Number(nonce)
}

function mergePermitDataChainNonce(
  permitData: Record<string, unknown>,
  chainNonce: number,
): Record<string, unknown> {
  const payloadKey = isPlainObject(permitData.values)
    ? 'values'
    : isPlainObject(permitData.message)
      ? 'message'
      : null
  if (!payloadKey) return permitData

  const payload = { ...(permitData[payloadKey] as Record<string, unknown>) }
  const detailsRaw = payload.details
  if (!isPlainObject(detailsRaw)) return permitData

  return sanitizePermitDataForSwapApi({
    ...permitData,
    [payloadKey]: {
      ...payload,
      details: {
        ...detailsRaw,
        nonce: chainNonce,
      },
    },
  })
}

function readPermitTokenSpender(message: Record<string, unknown>): {
  token: Address
  spender: Address
} | null {
  const details = message.details
  if (!isPlainObject(details)) return null
  const tokenRaw = details.token
  const spenderRaw = message.spender
  if (typeof tokenRaw !== 'string' || typeof spenderRaw !== 'string') return null
  if (!isAddress(tokenRaw) || !isAddress(spenderRaw)) return null
  return {
    token: getAddress(tokenRaw),
    spender: getAddress(spenderRaw),
  }
}

/**
 * Sign Uniswap Permit2 typed data for either an EOA or a parent CSW execution wallet.
 * CSW paths wrap the embedded owner signature for ERC-1271 and sync Permit2 nonce from chain.
 */
export async function signPermit2ForExecutionWallet(params: {
  permitData: Record<string, unknown>
  signerAddress: string
  executionAddress?: string | null
  walletClient: Permit2WalletClient
  publicClient: PublicClient
}): Promise<{ permitData: Record<string, unknown>; signature: Hex }> {
  const typed = toPermitSignPayload(params.permitData)
  if (!typed) {
    throw new Error('Permit2 payload is malformed. Please refresh the quote and try again.')
  }

  const signer = getAddress(params.signerAddress)
  const executionRaw = String(params.executionAddress ?? '').trim()
  const executionAddress =
    executionRaw && isAddress(executionRaw) ? getAddress(executionRaw) : null
  const permitOwnerIsCsw =
    executionAddress !== null &&
    executionAddress !== signer &&
    (await isDeployedSmartWalletExecutionAddress(executionAddress))

  let permitDataForBuild = params.permitData
  let messageForSign = typed.message

  if (permitOwnerIsCsw && executionAddress) {
    const tokenSpender = readPermitTokenSpender(typed.message)
    if (!tokenSpender) {
      throw new Error('Permit2 payload is missing token/spender details. Refresh the quote and try again.')
    }

    const readClient = getProductionBaseReadClient()
    const chainNonce = await readPermit2AllowanceNonce({
      readClient,
      permitOwner: executionAddress,
      token: tokenSpender.token,
      spender: tokenSpender.spender,
    })
    permitDataForBuild = mergePermitDataChainNonce(params.permitData, chainNonce)
    const refreshed = toPermitSignPayload(permitDataForBuild)
    if (!refreshed) {
      throw new Error('Permit2 payload is malformed after nonce refresh. Refresh the quote and try again.')
    }
    messageForSign = refreshed.message

    const ownerLookup = await findCoinbaseSmartWalletOwnerIndex({
      publicClient: readClient,
      smartWallet: executionAddress,
      ownerAddress: signer,
    })
    if (ownerLookup.ownerIndex === null) {
      throw new Error(
        'Embedded signer is not an on-chain owner of your Coinbase Smart Wallet. Finish waitlist signing setup, then retry the swap.',
      )
    }

    const permitDigest = hashTypedData({
      domain: typed.domain as Parameters<typeof hashTypedData>[0]['domain'],
      types: typed.types as Parameters<typeof hashTypedData>[0]['types'],
      primaryType: typed.primaryType as Parameters<typeof hashTypedData>[0]['primaryType'],
      message: messageForSign as Parameters<typeof hashTypedData>[0]['message'],
    })

    const signature = await signOwnerSignatureForCswErc1271({
      innerTypedDataDigest: permitDigest,
      smartWallet: executionAddress,
      ownerIndex: ownerLookup.ownerIndex,
      signerAddress: signer,
      walletClient: params.walletClient,
      publicClient: readClient,
    })

    await assertCswAcceptsErc1271Signature({
      publicClient: readClient,
      smartWallet: executionAddress,
      digest: permitDigest,
      signature,
    })

    return {
      permitData: sanitizePermitDataForSwapApi(permitDataForBuild),
      signature,
    }
  }

  const signatureRaw = await params.walletClient.signTypedData({
    account: signer,
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: messageForSign,
  })
  if (typeof signatureRaw !== 'string' || !signatureRaw.startsWith('0x')) {
    throw new Error('Wallet returned an invalid Permit2 signature.')
  }

  return {
    permitData: sanitizePermitDataForSwapApi(permitDataForBuild),
    signature: signatureRaw as Hex,
  }
}
