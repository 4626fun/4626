import type { Address } from 'viem'

/** Narrow read surface for ShareOFT bridge fee helpers (mock-friendly in tests). */
export type ShareBridgeReadClient = {
  readContract(args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
}
