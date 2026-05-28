import { describe, expect, it } from 'vitest'
import { BASE_CHAIN_ID } from '../schemas'
import { createDefaultBaseMcpPolicyConfig, evaluateSwapPolicy, evaluateTransferPolicy } from '../policy'

const USDC = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const WETH = '0x4200000000000000000000000000000000000006'

describe('base mcp policy', () => {
  it('allows a valid swap', () => {
    const config = createDefaultBaseMcpPolicyConfig()
    config.allowedTokens = new Set([USDC.toLowerCase(), WETH.toLowerCase()])
    config.maxNotionalBaseUnits = 1_000_000_000n
    config.maxSlippageBps = 100

    const result = evaluateSwapPolicy(
      {
        chainId: BASE_CHAIN_ID,
        sellToken: WETH,
        buyToken: USDC,
        sellAmount: 1000n,
        maxSlippageBps: 50,
      },
      config,
    )

    expect(result).toEqual({ status: 'ok' })
  })

  it('blocks bad recipient transfer', () => {
    const config = createDefaultBaseMcpPolicyConfig()
    config.allowedTokens = new Set([USDC.toLowerCase()])

    const result = evaluateTransferPolicy(
      {
        chainId: BASE_CHAIN_ID,
        token: USDC,
        amount: 10n,
        recipient: '0x0000000000000000000000000000000000000000',
      },
      config,
    )

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.reasonCode).toBe('policy_recipient_not_allowed')
    }
  })
})
