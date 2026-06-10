import { decodeFunctionData, getAddress } from 'viem'

import {
  MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '../wallet/cswOwnerAbi.js'

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
 * See `docs/operations/relay-owner-mutation-kit-guide.md` (golden Part 1 reference).
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
  if (valueWei < MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI) {
    return `Part 1 deposit ${valueWei.toString()} wei is below minimum ${MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI.toString()} wei (underfunded quotes skip Part 2 solver fill)`
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
