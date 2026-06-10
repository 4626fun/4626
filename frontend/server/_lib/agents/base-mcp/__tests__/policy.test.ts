import { describe, expect, it } from 'vitest'
import { BASE_CHAIN_ID } from '../schemas'
import { createDefaultBaseMcpPolicyConfig, evaluateSwapPolicy, evaluateTransferPolicy } from '../policy'

const USDC = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const WETH = '0x4200000000000000000000000000000000000006'

describe('base mcp policy', () => {
  it('allows a valid swap', () => {
    const config = createDefaultBaseMcpPolicyConfig()
    config.allowedTokens = new Set([USDC.toLowerCase(), WETH.toLowerCase()])
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

  it('uses token-specific notional limits for 18-decimal WETH and 6-decimal USDC', () => {
    const config = createDefaultBaseMcpPolicyConfig()
    config.allowedTokens = new Set([USDC.toLowerCase(), WETH.toLowerCase()])

    expect(
      evaluateSwapPolicy(
        {
          chainId: BASE_CHAIN_ID,
          sellToken: WETH,
          buyToken: USDC,
          sellAmount: 20_000_000_000_000_000n,
          maxSlippageBps: 50,
        },
        config,
      ),
    ).toEqual({ status: 'ok' })

    const result = evaluateTransferPolicy(
      {
        chainId: BASE_CHAIN_ID,
        token: USDC,
        amount: 100_000_001n,
        recipient: '0x1111111111111111111111111111111111111111',
      },
      config,
    )

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.reasonCode).toBe('policy_notional_too_high')
    }
  })

  it('blocks an allowlisted token without a token-specific notional limit', () => {
    const config = createDefaultBaseMcpPolicyConfig()
    const tokenWithoutLimit = '0x2222222222222222222222222222222222222222'
    config.allowedTokens = new Set([tokenWithoutLimit.toLowerCase()])

    const result = evaluateTransferPolicy(
      {
        chainId: BASE_CHAIN_ID,
        token: tokenWithoutLimit,
        amount: 1n,
        recipient: '0x1111111111111111111111111111111111111111',
      },
      config,
    )

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.reasonCode).toBe('policy_notional_too_high')
    }
  })
})
