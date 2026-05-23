import { createWalletClient, custom, getAddress, type Address, type Hex, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'
import {
  ENTRY_POINT_V06_BASE,
  GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI,
} from '@/lib/wallet/cswOwnerAbi'
import { waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import {
  buildSendPreparedCallsSignaturePayload,
  normalizePreparedCallValueToHex,
} from '@/lib/wallet/onboardingWalletPrepared'
import { unwrapDoubleHexEncodedHash } from '@/lib/wallet/onboardingWalletReplayable'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

const ENTRY_POINT_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export function readPreparedUserOpPaymasterAndData(userOp: unknown): Hex | null {
  if (!userOp || typeof userOp !== 'object') return null
  const record = userOp as Record<string, unknown>
  const raw = record.paymasterAndData ?? record.paymaster_and_data
  if (typeof raw !== 'string' || !raw.startsWith('0x')) return null
  return raw as Hex
}

/**
 * Mirrors EntryPoint v0.6 `_copyUserOpToMemory`: paymaster is set when
 * `paymasterAndData.length > 0` (first 20 bytes = paymaster address).
 */
export function parseEntryPointPaymasterAddress(paymasterAndData: Hex | null | undefined): Address | null {
  if (!paymasterAndData || paymasterAndData === '0x') return null
  const byteLength = (paymasterAndData.length - 2) / 2
  if (byteLength === 0) return null
  if (byteLength < 20) return null
  return getAddress(`0x${paymasterAndData.slice(2, 42)}`)
}

export function userOpHasPaymaster(userOp: unknown): boolean {
  return parseEntryPointPaymasterAddress(readPreparedUserOpPaymasterAndData(userOp)) != null
}

async function assertSelfFundedPrefundBudget(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  depositWei: bigint
  appendEvent: (row: string) => void
}): Promise<void> {
  const [nativeWei, entryPointDepositWei] = await Promise.all([
    params.publicClient.getBalance({ address: params.fundingCsw }),
    params.publicClient
      .readContract({
        address: ENTRY_POINT_V06_BASE,
        abi: ENTRY_POINT_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [params.fundingCsw],
      })
      .catch(() => 0n),
  ])

  params.appendEvent(`relay_part1:prefund_native_wei=${nativeWei.toString(10)}`)
  params.appendEvent(`relay_part1:prefund_entrypoint_deposit_wei=${entryPointDepositWei.toString(10)}`)

  const gasReserveWei = GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
  const requiredWei = params.depositWei + gasReserveWei

  if (nativeWei < params.depositWei) {
    throw new Error(
      `Smart wallet native balance (${nativeWei.toString()} wei) is below the Relay deposit (${params.depositWei.toString()} wei). Fund your main Base wallet with ETH and retry.`,
    )
  }

  if (nativeWei + entryPointDepositWei < requiredWei) {
    throw new Error(
      `Smart wallet prefund is too low for a self-funded UserOp (EntryPoint v0.6, paymasterAndData empty). ` +
        `Need deposit + gas reserve (${requiredWei.toString()} wei) from native ETH and/or EntryPoint.depositTo; ` +
        `have ${nativeWei.toString()} wei native + ${entryPointDepositWei.toString()} wei EntryPoint deposit.`,
    )
  }
}

function buildSelfFundedPrepareCapabilities(chainId: number): Record<string, unknown> {
  const chainIdHex = `0x${chainId.toString(16)}` as const
  // Do not pass a paymaster URL. Optional=true keeps the batch valid on wallets
  // that treat missing paymasterService as "use default sponsor".
  return {
    paymasterService: {
      [chainIdHex]: {
        optional: true,
      },
    },
  }
}

function extractWalletCallsId(sendResult: unknown): string | null {
  if (typeof sendResult === 'string') return sendResult
  if (!sendResult || typeof sendResult !== 'object') return null
  const record = sendResult as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  if (typeof record.callBundleId === 'string') return record.callBundleId
  return null
}

function createSelfAuth4337WalletClient(walletRequest: WalletRequest, account: Address) {
  return createWalletClient({
    account,
    chain: base,
    transport: custom({
      request: async (request) =>
        await walletRequest({
          method: request.method,
          params: request.params as unknown[] | undefined,
        }),
    }),
  })
}

function resolveBundlerUrl(): string {
  const bundlerEnv =
    (import.meta.env.VITE_CDP_BUNDLER_URL as string | undefined) ??
    (import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined)
  return resolveCdpPaymasterUrl(bundlerEnv) || '/api/paymaster'
}

async function submitViaBundlerSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  publicClient: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  params.appendEvent('relay_part1:lane=bundler_self_funded')
  await assertSelfFundedPrefundBudget({
    publicClient: params.publicClient,
    fundingCsw: params.fundingCsw,
    depositWei: BigInt(params.userCall.value),
    appendEvent: params.appendEvent,
  })
  const walletClient = createSelfAuth4337WalletClient(params.walletRequest, params.fundingCsw)
  const result = await sendCoinbaseSmartWalletUserOperation({
    publicClient: params.publicClient as any,
    walletClient: walletClient as any,
    bundlerUrl: resolveBundlerUrl(),
    smartWallet: params.fundingCsw,
    ownerAddress: params.fundingCsw,
    ownerIndexOverride: 0,
    calls: [
      {
        to: getAddress(params.userCall.to),
        data: params.userCall.data,
        value: BigInt(params.userCall.value),
      },
    ],
    skipPaymaster: true,
    retryOnPrefund: false,
    useTypedDataSigning: true,
  })
  params.appendEvent(`relay_part1:bundler_tx=${result.transactionHash}`)
  return result.transactionHash
}

async function submitViaPreparedCallsSelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  const chainIdHex = `0x${params.chainId.toString(16)}`
  const valueHex = normalizePreparedCallValueToHex(params.userCall.value)
  params.appendEvent('relay_part1:lane=prepare_calls_self_funded')

  if (params.publicClient) {
    await assertSelfFundedPrefundBudget({
      publicClient: params.publicClient,
      fundingCsw: params.fundingCsw,
      depositWei: BigInt(params.userCall.value),
      appendEvent: params.appendEvent,
    })
  }

  const prepareResult = (await params.walletRequest({
    method: 'wallet_prepareCalls',
    params: [
      {
        version: '1.0',
        from: getAddress(params.fundingCsw),
        chainId: chainIdHex,
        calls: [
          {
            to: getAddress(params.userCall.to),
            data: params.userCall.data,
            value: valueHex,
          },
        ],
        capabilities: buildSelfFundedPrepareCapabilities(params.chainId),
      },
    ],
  })) as {
    type?: string
    chainId?: string
    signatureRequest?: { hash?: string }
    userOp?: unknown
  } | null

  if (!prepareResult?.signatureRequest?.hash) {
    throw new Error('wallet_prepareCalls did not return a signature request hash.')
  }
  if (!prepareResult.userOp) {
    throw new Error('wallet_prepareCalls did not return a userOp.')
  }

  if (userOpHasPaymaster(prepareResult.userOp)) {
    const paymaster = parseEntryPointPaymasterAddress(
      readPreparedUserOpPaymasterAndData(prepareResult.userOp),
    )
    params.appendEvent(`relay_part1:warn prepared_userop_paymaster=${paymaster ?? 'unknown'}`)
    if (params.publicClient) {
      return await submitViaBundlerSelfFunded({
        walletRequest: params.walletRequest,
        fundingCsw: params.fundingCsw,
        userCall: params.userCall,
        publicClient: params.publicClient,
        appendEvent: params.appendEvent,
      })
    }
    throw new Error(
      'Base App prepared a paymaster-sponsored UserOp (non-empty paymasterAndData). Part 1 must use EntryPoint self-fund (paymasterAndData = 0x). Fund native ETH / EntryPoint deposit and retry.',
    )
  }

  params.appendEvent('relay_part1:prepared_userop_paymaster=0x0')

  const hashToSign = unwrapDoubleHexEncodedHash(prepareResult.signatureRequest.hash as Hex)
  const signature = (await params.walletRequest({
    method: 'personal_sign',
    params: [hashToSign, getAddress(params.fundingCsw)],
  })) as Hex
  if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('personal_sign did not return a valid signature.')
  }

  const signaturePayload = buildSendPreparedCallsSignaturePayload({
    sender: params.fundingCsw,
    signature,
    mode: 'auto',
  })

  const sendResult = await params.walletRequest({
    method: 'wallet_sendPreparedCalls',
    params: [
      {
        version: '1.0',
        type: prepareResult.type ?? 'user-operation-v06',
        data: prepareResult.userOp,
        chainId: prepareResult.chainId ?? chainIdHex,
        signature: signaturePayload,
      },
    ],
  })

  const callsId = extractWalletCallsId(sendResult)
  if (!callsId) {
    throw new Error('wallet_sendPreparedCalls returned no call bundle id.')
  }
  params.appendEvent(`relay_part1:prepared_calls_bundle=${callsId}`)

  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: callsId,
    timeoutMs: 90_000,
    intervalMs: 1_500,
    onTelemetry: (event) => {
      try {
        const detail = typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
        params.appendEvent(`relay_part1.prepared_status.${event.step}: ${detail.slice(0, 320)}`)
      } catch {
        params.appendEvent(`relay_part1.prepared_status.${event.step}: <unloggable>`)
      }
    },
  })

  const txHash = resolution.transactionHash ?? resolution.userOperationHash
  if (!txHash) {
    throw new Error('wallet_sendPreparedCalls completed without a transaction or UserOp hash.')
  }
  params.appendEvent(`relay_part1:prepared_tx=${txHash}`)
  return txHash
}

/**
 * Submit Relay Part 1 (Depository.depositNative) from a Base App self-auth CSW
 * without ERC-4337 paymaster sponsorship (native ETH / EntryPoint prefund only).
 *
 * EntryPoint v0.6 self-fund path: when `paymasterAndData` is empty, `_validateAccountPrepayment`
 * sets `missingAccountFunds = requiredPrefund - (nativeBalance + EntryPoint.deposits[sender])`
 * and the CSW `payPrefund` modifier tops up EntryPoint from native ETH. No paymaster
 * `validatePaymasterUserOp` / `postOp` runs.
 *
 * `wallet_sendCalls` in Base App can auto-attach Coinbase's USDC paymaster even
 * when the dapp omits paymasterService. This lane uses wallet_prepareCalls with
 * no paymaster URL and falls back to a direct self-funded bundler UserOp when
 * the wallet still injects paymasterAndData.
 */
export async function submitSelfAuthRelayPart1SelfFunded(params: {
  walletRequest: WalletRequest
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  chainId: number
  publicClient?: PublicClient
  appendEvent: (row: string) => void
}): Promise<`0x${string}`> {
  try {
    return await submitViaPreparedCallsSelfFunded(params)
  } catch (preparedError) {
    if (!params.publicClient) throw preparedError
    const message =
      preparedError instanceof Error ? preparedError.message : String(preparedError ?? 'prepare_calls_failed')
    params.appendEvent(`relay_part1:prepare_calls_error=${message.slice(0, 220)}`)
    return await submitViaBundlerSelfFunded({
      walletRequest: params.walletRequest,
      fundingCsw: params.fundingCsw,
      userCall: params.userCall,
      publicClient: params.publicClient,
      appendEvent: params.appendEvent,
    })
  }
}
