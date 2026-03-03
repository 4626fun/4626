import {
  EVMClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  encodeCallMsg,
  type Runtime,
} from "@chainlink/cre-sdk"
import { encodeFunctionData, zeroAddress } from "viem"

const CHAIN_NAME_TO_CHAIN_ID: Record<string, number> = {
  "ethereum-mainnet": 1,
  "ethereum-mainnet-base-1": 8453,
  "ethereum-testnet-sepolia-1": 11155111,
  "ethereum-testnet-base-sepolia-1": 84532,
}

export function resolveChainId(chainName: string, explicitChainId?: number): number {
  if (explicitChainId && Number.isFinite(explicitChainId)) return explicitChainId
  const mapped = CHAIN_NAME_TO_CHAIN_ID[chainName]
  if (mapped) return mapped
  throw new Error(`unsupported_chain_name_for_chain_id:${chainName}`)
}

export function createEvmClientForChain(chainName: string): EVMClient {
  const selector =
    EVMClient.SUPPORTED_CHAIN_SELECTORS[
      chainName as keyof typeof EVMClient.SUPPORTED_CHAIN_SELECTORS
    ]

  if (!selector) {
    throw new Error(`unsupported_chain_name_for_selector:${chainName}`)
  }

  return new EVMClient(selector)
}

export function readContractBytes<Config>(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  params: {
    address: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abi: any
    functionName: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any[]
    fallbackToLatest?: boolean
    retryAttempts?: number
    onRetry?: (attempt: number, error: unknown) => void
  },
): Uint8Array {
  const callData = params.args
    ? encodeFunctionData({
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    : encodeFunctionData({
        abi: params.abi,
        functionName: params.functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

  const call = {
    call: encodeCallMsg({
      from: zeroAddress,
      to: params.address as `0x${string}`,
      data: callData,
    }),
  }

  const maxAttempts = Math.max(1, params.retryAttempts ?? 1)
  const isRateLimitedError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return /429|too many requests|rate limit|over rate limit|-32016/i.test(message)
  }

  const attemptCall = (withFinalizedBlock: boolean): Uint8Array => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return withFinalizedBlock
          ? evmClient
              .callContract(runtime, {
                ...call,
                blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
              })
              .result().data
          : evmClient.callContract(runtime, call).result().data
      } catch (error) {
        lastError = error
        const canRetry = attempt < maxAttempts - 1 && isRateLimitedError(error)
        if (!canRetry) throw error
        params.onRetry?.(attempt + 1, error)
      }
    }
    throw lastError
  }

  try {
    return attemptCall(true)
  } catch (error) {
    if (!params.fallbackToLatest) {
      throw error
    }
    return attemptCall(false)
  }
}
