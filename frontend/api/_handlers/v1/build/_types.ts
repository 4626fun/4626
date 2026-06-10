import type { Address, Hex } from 'viem'

export type BuildTxResponse = {
  chainId: number
  to: Address
  data: Hex
  value: string
  description: string
  warnings: string[]
}

