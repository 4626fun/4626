import { describe, expect, it } from 'vitest'
import { toFunctionSelector } from 'viem'

describe('ajna emergency adapter selectors', () => {
  it('pins drain / move selectors used for bytecode gates', () => {
    expect(toFunctionSelector('drainBucketsToBuffer()')).toBe('0xc7cc300d')
    expect(toFunctionSelector('moveToBuffer(uint256,uint256)')).toBe('0x070b49ba')
    expect(toFunctionSelector('moveFromBuffer(uint256,uint256)')).toBe('0xd6506540')
  })
})
