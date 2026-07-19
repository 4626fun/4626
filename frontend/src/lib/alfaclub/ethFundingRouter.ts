import {
  decodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from 'viem'

import type { TransactionRequest } from '@/lib/uniswap/tradingApi'

import {
  buildAlfaClubSudoswapCalls,
  type Permit2AllowanceSnapshot,
} from './sudoswapRouter'
import { assertZoraFundingExecute } from './zoraFundingExecute'

/** Base ZORA token used by the Room 1659 creator-coin pool. */
export const ROOM_1659_ZORA_TOKEN = getAddress(
  '0x1111111111166b7FE7bd91427724B487980aFc69',
)

/** Native ETH alias accepted by the server-side Zora trade quote adapter. */
export const ZORA_NATIVE_ETH_TOKEN =
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const

/** Zora's Base Universal Router, returned as the target of executable quotes. */
export const ZORA_BASE_UNIVERSAL_ROUTER = getAddress(
  '0x6ff5693b99212da76ad316178a184ab56d299b43',
)

export const BASE_WETH_TOKEN = getAddress(
  '0x4200000000000000000000000000000000000006',
)

const WETH_DEPOSIT_SELECTOR = '0xd0e30db0'
const WETH_APPROVE_SELECTOR = '0x095ea7b3'

export type AlfaClubEthFundingCallsParams = {
  fundingSwap: TransactionRequest
  /** WETH.deposit and WETH.approve(Permit2), used by canonical sponsored wallets. */
  preparatoryCalls?: TransactionRequest[]
  fundingOutputAmount: bigint
  sender: Address
  router: Address
  adapter: Address
  permit2: Address
  friendKey: Address
  creatorCoin: Address
  pair: Address
  keyAmount: bigint
  buyLimit: bigint
  deadline: bigint
  erc20AllowanceToPermit2?: bigint
  permit2AllowanceToAdapter?: Permit2AllowanceSnapshot
}

/**
 * Compose a quoted ETH -> Creator Coin leg with the existing Sudoswap buy call sequence.
 *
 * The funding call is kept first so the acquired Creator Coin is available to
 * the approval/Permit2/router calls that follow in a wallet batch when the
 * connected wallet supports atomic batches. The quote target is allowlisted
 * because this helper is intentionally for the Zora funding route, not
 * arbitrary third-party calldata.
 */
export function buildAlfaClubEthFundingCalls(
  params: AlfaClubEthFundingCallsParams,
): TransactionRequest[] {
  const sender = getAddress(params.sender)
  if (params.preparatoryCalls && params.preparatoryCalls.length > 0 && params.preparatoryCalls.length !== 2) {
    throw new Error('Canonical ETH funding requires WETH.deposit and WETH.approve')
  }
  const preparatoryCalls = (params.preparatoryCalls ?? []).map((call, index) =>
    normalizePreparatoryCall(call, sender, index, getAddress(params.permit2)),
  )
  if (preparatoryCalls.length === 2) {
    const depositValue = BigInt(String(preparatoryCalls[0]?.value ?? '0'))
    const approval = decodeFunctionData({
      abi: erc20Abi,
      data: preparatoryCalls[1]?.data as Hex,
    })
    const approvalAmount = BigInt(String(approval.args?.[1] ?? '0'))
    if (approvalAmount !== depositValue) {
      throw new Error('WETH.approve amount must match the ETH funding amount')
    }
  }
  const fundingMode = preparatoryCalls.length > 0 ? 'wethPermit2' : 'nativeEth'
  const funding = normalizeFundingSwap(params.fundingSwap, sender, fundingMode === 'wethPermit2')
  const fundingInputAmount =
    fundingMode === 'wethPermit2'
      ? BigInt(String(preparatoryCalls[0]?.value ?? '0'))
      : BigInt(String(funding.value ?? '0'))
  if (params.fundingOutputAmount < params.buyLimit) {
    throw new Error('ETH funding quote does not cover the Sudoswap buy limit')
  }
  assertZoraFundingExecute({
    data: funding.data as Hex,
    sender,
    creatorCoin: getAddress(params.creatorCoin),
    inputAmount: fundingInputAmount,
    mode: fundingMode,
    minOutputAmount: params.buyLimit,
  })

  const sudoswapCalls = buildAlfaClubSudoswapCalls({
    direction: 'buy',
    router: params.router,
    adapter: params.adapter,
    permit2: params.permit2,
    friendKey: params.friendKey,
    creatorCoin: params.creatorCoin,
    pair: params.pair,
    sender,
    keyAmount: params.keyAmount,
    limit: params.buyLimit,
    deadline: params.deadline,
    erc20AllowanceToPermit2: params.erc20AllowanceToPermit2,
    permit2AllowanceToAdapter: params.permit2AllowanceToAdapter,
  })

  return [...preparatoryCalls, funding, ...sudoswapCalls]
}

function normalizeFundingSwap(
  input: TransactionRequest,
  sender: Address,
  allowZeroValue: boolean,
): TransactionRequest {
  const target = String(input.to ?? '').trim()
  if (!isAddress(target)) throw new Error('ETH funding quote target is invalid')
  if (getAddress(target) !== ZORA_BASE_UNIVERSAL_ROUTER) {
    throw new Error('ETH funding quote target is not the approved Zora router')
  }
  if (!input.data || input.data === '0x') {
    throw new Error('ETH funding quote is missing executable calldata')
  }
  if (Number(input.chainId ?? 8453) !== 8453) {
    throw new Error('ETH funding quote must target Base')
  }
  if (input.from && getAddress(input.from) !== sender) {
    throw new Error('ETH funding quote sender does not match the execution wallet')
  }

  const rawValue = input.value
  const value =
    typeof rawValue === 'bigint'
      ? rawValue
      : BigInt(String(rawValue ?? '0').trim() || '0')
  if (allowZeroValue ? value !== 0n : value <= 0n) {
    throw new Error(
      allowZeroValue
        ? 'WETH funding quote must not include native ETH value'
        : 'ETH funding quote must include a positive ETH value',
    )
  }

  return {
    ...input,
    to: ZORA_BASE_UNIVERSAL_ROUTER,
    from: sender,
    value: value.toString(),
    chainId: 8453,
  }
}

function normalizePreparatoryCall(
  input: TransactionRequest,
  sender: Address,
  index: number,
  permit2: Address,
): TransactionRequest {
  const target = String(input.to ?? '').trim()
  if (!isAddress(target) || getAddress(target) !== BASE_WETH_TOKEN) {
    throw new Error('Canonical ETH funding preparatory target must be Base WETH')
  }
  if (!input.data || input.data === '0x') {
    throw new Error('Canonical ETH funding preparatory calldata is missing')
  }
  if (Number(input.chainId ?? 8453) !== 8453) {
    throw new Error('Canonical ETH funding preparatory call must target Base')
  }
  if (input.from && getAddress(input.from) !== sender) {
    throw new Error('Canonical ETH funding preparatory sender does not match the execution wallet')
  }

  const data = input.data.toLowerCase()
  if (index === 0) {
    if (!data.startsWith(WETH_DEPOSIT_SELECTOR) || data.length !== WETH_DEPOSIT_SELECTOR.length) {
      throw new Error('Canonical ETH funding must begin with WETH.deposit')
    }
    const value = BigInt(String(input.value ?? '0'))
    if (value <= 0n) throw new Error('WETH.deposit must include a positive ETH value')
  } else if (index === 1) {
    if (!data.startsWith(WETH_APPROVE_SELECTOR) || data.length <= WETH_APPROVE_SELECTOR.length) {
      throw new Error('Canonical ETH funding must approve WETH to Permit2')
    }
    if (BigInt(String(input.value ?? '0')) !== 0n) {
      throw new Error('WETH.approve must not include native ETH value')
    }
    const approval = decodeFunctionData({
      abi: erc20Abi,
      data: input.data as Hex,
    })
    if (
      approval.functionName !== 'approve' ||
      getAddress(String(approval.args?.[0] ?? '')) !== permit2
    ) {
      throw new Error('WETH.approve must authorize Permit2')
    }
  } else {
    throw new Error('Canonical ETH funding has too many preparatory calls')
  }

  return {
    ...input,
    to: BASE_WETH_TOKEN,
    from: sender,
    value: String(input.value ?? '0'),
    chainId: 8453,
  }
}
