export type BuildTxResponse = {
  chainId: number
  to: `0x${string}`
  data: `0x${string}`
  value: string
  description: string
  warnings: string[]
}

