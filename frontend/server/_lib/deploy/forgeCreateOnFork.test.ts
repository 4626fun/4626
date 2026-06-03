import { describe, expect, it } from 'vitest'

import { isForgeCreateCollisionError } from './forgeCreateOnFork.js'

describe('isForgeCreateCollisionError', () => {
  it('detects anvil create collision errors', () => {
    expect(isForgeCreateCollisionError('server returned an error response: error code -32603: EVM error CreateCollision')).toBe(
      true,
    )
    expect(isForgeCreateCollisionError('execution reverted: create collision')).toBe(true)
  })

  it('ignores unrelated forge failures', () => {
    expect(isForgeCreateCollisionError('forge create did not report Deployed to address')).toBe(false)
    expect(isForgeCreateCollisionError('insufficient funds for gas')).toBe(false)
  })
})

describe('parseDeployedAddress', () => {
  it('parses forge broadcast output with remapping noise', async () => {
    const { parseDeployedAddressForTest: parseDeployedAddress } = await import('./forgeCreateOnFork.js')
    const output = `
      v4-periphery/=/home/example/lib/v4-periphery/
      No files changed, compilation skipped
      Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      Deployed to: 0x2Af09DB6897159Bac32943188bC1BC3Af22908AB
      Transaction hash: 0xabc
    `
    expect(parseDeployedAddress(output)).toBe('0x2Af09DB6897159Bac32943188bC1BC3Af22908AB')
  })
})
