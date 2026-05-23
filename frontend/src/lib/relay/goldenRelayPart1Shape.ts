import { decodeFunctionData, getAddress } from 'viem'

import {
  GOLDEN_RELAY_PART1_DEPOSIT_WEI,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '../wallet/cswOwnerAbi'

/** Tenderly UserOp reference: 0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3 */
export const GOLDEN_RELAY_PART1_USER_OP_HASH =
  '0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3' as const

/** Bundle tx wrapping the UserOp: 0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf */
export const GOLDEN_RELAY_PART1_BUNDLE_TX_HASH =
  '0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf' as const

export type GoldenPart1UserCall = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}` | bigint | string
}

/**
 * Validates the EIP-5792 `wallet_sendCalls` entry Base App wraps as:
 *
 * EntryPoint → CSW.executeBatch([{ target: RelayDepository, value, data: depositNative }])
 *
 * See [Tenderly golden UserOp](https://dashboard.tenderly.co/Akita/cerberus/tx/0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3).
 */
export function validateGoldenCswDepositoryPart1UserCall(params: {
  userCall: GoldenPart1UserCall
  fundingCsw: `0x${string}`
  orderId?: `0x${string}` | null
}): string | null {
  const target = params.userCall.to.toLowerCase()
  if (target !== RELAY_DEPOSITORY_BASE.toLowerCase()) {
    return `Part 1 call target must be RelayDepository (${RELAY_DEPOSITORY_BASE}), got ${params.userCall.to}`
  }

  const selector = params.userCall.data.slice(0, 10).toLowerCase()
  if (selector !== RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR) {
    return `Part 1 call must be depositNative (${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}), got ${selector}`
  }

  let valueWei: bigint
  try {
    valueWei = BigInt(params.userCall.value)
  } catch {
    return 'Part 1 call value is not valid wei'
  }
  if (valueWei <= 0n) {
    return 'Part 1 call value must be non-zero'
  }
  // Historical floor from block 45600637 — underfunded quotes skip Part 2 solver fill.
  // Higher deposits from live Relay quotes (gas price moves) are valid.
  if (valueWei < GOLDEN_RELAY_PART1_DEPOSIT_WEI) {
    return `Part 1 deposit ${valueWei.toString()} wei is below golden minimum ${GOLDEN_RELAY_PART1_DEPOSIT_WEI.toString()} wei`
  }

  try {
    const decoded = decodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      data: params.userCall.data,
    })
    if (decoded.functionName !== 'depositNative') {
      return 'Part 1 calldata must decode to depositNative'
    }
    const [depositor, depositId] = decoded.args as [`0x${string}`, `0x${string}`]
    if (getAddress(depositor) !== getAddress(params.fundingCsw)) {
      return `depositNative depositor must be funding CSW ${params.fundingCsw}, got ${depositor}`
    }
    if (params.orderId && depositId.toLowerCase() !== params.orderId.toLowerCase()) {
      return 'depositNative id must match Relay order id'
    }
  } catch {
    return 'Part 1 depositNative calldata could not be decoded'
  }

  return null
}

/** Single executeBatch entry shape shown in Tenderly decoded input. */
export function describeGoldenPart1ExecuteBatchInnerCall(userCall: GoldenPart1UserCall): {
  target: string
  value: string
  data: string
} {
  return {
    target: getAddress(userCall.to),
    value: BigInt(userCall.value).toString(10),
    data: userCall.data,
  }
}
