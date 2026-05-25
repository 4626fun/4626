import { encodeFunctionData, getAddress, type Hex, type PublicClient } from 'viem'

import { CSW_OWNER_ABI } from '@/lib/wallet/cswOwnerAbi'
import { _submitOwnerViaSendCalls, waitForCallsTxHash, type CswSendCallsTelemetry } from './cswSendCalls'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

export type BaseAppOwnerCallResult = {
  callBundleId: string
  transactionHash: `0x${string}` | null
}

export type RemoveOwnerFunctionName = 'removeOwnerAtIndex' | 'removeLastOwner'

export type RemoveOwnerPlan = {
  ownerIndex: number
  ownerBytes: `0x${string}`
  selectedFunction: RemoveOwnerFunctionName
  ownerCount: number
  nextOwnerIndex: number
  highestPopulatedOwnerIndex: number
}

export async function planRemoveOwnerFromChain(params: {
  publicClient: PublicClient
  csw: `0x${string}`
  ownerIndex: number
  scanLimitCap?: number
}): Promise<RemoveOwnerPlan> {
  const { publicClient } = params
  const csw = getAddress(params.csw) as `0x${string}`
  const ownerIndex = Number(params.ownerIndex)
  const scanLimitCap = Math.max(1, Math.trunc(params.scanLimitCap ?? 64))

  if (!Number.isInteger(ownerIndex) || ownerIndex < 0) {
    throw new Error(`Invalid ownerIndex ${String(params.ownerIndex)}. Expected a non-negative integer.`)
  }

  const [ownerCountRaw, nextOwnerIndexRaw] = await Promise.all([
    publicClient.readContract({
      address: csw,
      abi: CSW_OWNER_ABI,
      functionName: 'ownerCount',
    }),
    publicClient.readContract({
      address: csw,
      abi: CSW_OWNER_ABI,
      functionName: 'nextOwnerIndex',
    }),
  ])

  const ownerCount = Number(ownerCountRaw)
  const nextOwnerIndex = Number(nextOwnerIndexRaw)
  const scanLimit = Math.min(Math.max(nextOwnerIndex, ownerCount), scanLimitCap)
  if (ownerIndex >= scanLimit) {
    throw new Error(`ownerIndex ${ownerIndex} is out of scan range ${scanLimit}.`)
  }

  let highestPopulatedOwnerIndex = -1
  let ownerBytes: `0x${string}` = '0x'
  for (let idx = 0; idx < scanLimit; idx += 1) {
    const slotBytes = (await publicClient.readContract({
      address: csw,
      abi: CSW_OWNER_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(idx)],
    })) as Hex
    const normalized = slotBytes as `0x${string}`
    if (normalized !== '0x') highestPopulatedOwnerIndex = idx
    if (idx === ownerIndex) ownerBytes = normalized
  }

  if (ownerBytes === '0x') {
    throw new Error(`ownerIndex ${ownerIndex} is empty.`)
  }

  const selectedFunction: RemoveOwnerFunctionName =
    ownerIndex === highestPopulatedOwnerIndex ? 'removeLastOwner' : 'removeOwnerAtIndex'

  return {
    ownerIndex,
    ownerBytes,
    selectedFunction,
    ownerCount,
    nextOwnerIndex,
    highestPopulatedOwnerIndex,
  }
}

export function encodeAddOwnerCall(params: {
  csw: `0x${string}`
  ownerToAdd: `0x${string}`
}): { to: `0x${string}`; data: Hex; value: '0x0' } {
  const csw = getAddress(params.csw) as `0x${string}`
  const ownerToAdd = getAddress(params.ownerToAdd) as `0x${string}`
  const data = encodeFunctionData({
    abi: CSW_OWNER_ABI,
    functionName: 'addOwnerAddress',
    args: [ownerToAdd],
  })
  return { to: csw, data, value: '0x0' }
}

export function encodeRemoveOwnerCall(params: {
  csw: `0x${string}`
  ownerIndex: number
  ownerBytes: `0x${string}`
  selectedFunction?: RemoveOwnerFunctionName
}): { to: `0x${string}`; data: Hex; value: '0x0'; selectedFunction: RemoveOwnerFunctionName } {
  const csw = getAddress(params.csw) as `0x${string}`
  const ownerIndex = Number(params.ownerIndex)
  if (!Number.isInteger(ownerIndex) || ownerIndex < 0) {
    throw new Error(`Invalid ownerIndex ${String(params.ownerIndex)}. Expected a non-negative integer.`)
  }
  if (!params.ownerBytes || params.ownerBytes === '0x') {
    throw new Error('ownerBytes must be a populated bytes value from ownerAtIndex.')
  }

  const selectedFunction = params.selectedFunction ?? 'removeOwnerAtIndex'
  const data = encodeFunctionData({
    abi: CSW_OWNER_ABI,
    functionName: selectedFunction,
    args: [BigInt(ownerIndex), params.ownerBytes],
  })
  return { to: csw, data, value: '0x0', selectedFunction }
}

export async function addOwnerViaBaseAppSendCalls(params: {
  walletRequest: WalletRequest
  csw: `0x${string}`
  ownerToAdd: `0x${string}`
  chainId: number
  timeoutMs?: number
  intervalMs?: number
  onTelemetry?: (event: CswSendCallsTelemetry) => void
}): Promise<BaseAppOwnerCallResult> {
  const call = encodeAddOwnerCall({ csw: params.csw, ownerToAdd: params.ownerToAdd })
  const submitted = await _submitOwnerViaSendCalls({
    walletRequest: params.walletRequest,
    csw: call.to,
    calls: [{ to: call.to, data: call.data, value: call.value }],
    chainId: params.chainId,
    onTelemetry: params.onTelemetry,
  })
  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: submitted.callBundleId,
    timeoutMs: params.timeoutMs,
    intervalMs: params.intervalMs,
    onTelemetry: params.onTelemetry,
  })
  return { callBundleId: submitted.callBundleId, transactionHash: resolution.transactionHash }
}

export async function removeOwnerViaBaseAppSendCalls(params: {
  walletRequest: WalletRequest
  csw: `0x${string}`
  ownerIndex: number
  ownerBytes: `0x${string}`
  selectedFunction?: RemoveOwnerFunctionName
  chainId: number
  timeoutMs?: number
  intervalMs?: number
  onTelemetry?: (event: CswSendCallsTelemetry) => void
}): Promise<BaseAppOwnerCallResult> {
  const call = encodeRemoveOwnerCall({
    csw: params.csw,
    ownerIndex: params.ownerIndex,
    ownerBytes: params.ownerBytes,
    selectedFunction: params.selectedFunction,
  })
  const submitted = await _submitOwnerViaSendCalls({
    walletRequest: params.walletRequest,
    csw: call.to,
    calls: [{ to: call.to, data: call.data, value: call.value }],
    chainId: params.chainId,
    onTelemetry: params.onTelemetry,
  })
  const resolution = await waitForCallsTxHash({
    walletRequest: params.walletRequest,
    callBundleId: submitted.callBundleId,
    timeoutMs: params.timeoutMs,
    intervalMs: params.intervalMs,
    onTelemetry: params.onTelemetry,
  })
  return { callBundleId: submitted.callBundleId, transactionHash: resolution.transactionHash }
}

