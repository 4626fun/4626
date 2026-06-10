import { type Address, type Hex } from 'viem'

export function encodeUniswapV3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length < 2) throw new Error('Uniswap path requires at least two tokens')
  if (fees.length !== tokens.length - 1) throw new Error('Uniswap path fee count mismatch')
  let out = `0x${tokens[0]!.slice(2)}`
  for (let i = 0; i < fees.length; i += 1) {
    const fee = fees[i]
    if (fee === undefined || !Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) {
      throw new Error(`Invalid Uniswap fee tier: ${fee}`)
    }
    out += fee.toString(16).padStart(6, '0')
    out += tokens[i + 1]!.slice(2)
  }
  return out as Hex
}
