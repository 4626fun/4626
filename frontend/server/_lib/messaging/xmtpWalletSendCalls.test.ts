import { describe, expect, it } from 'vitest'

import {
  buildWalletSendCallsFromSwapTransaction,
  extractWalletSendCallsFromUniswapActionReply,
} from './xmtpWalletSendCalls.js'

describe('xmtpWalletSendCalls', () => {
  it('builds wallet send calls from a validated swap payload', () => {
    const payload = buildWalletSendCallsFromSwapTransaction({
      from: '0x1111111111111111111111111111111111111111',
      chainId: 8453,
      swap: {
        to: '0x2222222222222222222222222222222222222222',
        data: '0xdeadbeef',
        value: '0',
        from: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
      },
      description: 'Swap AKITA for USDC',
    })

    expect(payload).toMatchObject({
      version: '1.0',
      from: '0x1111111111111111111111111111111111111111',
      calls: [
        {
          to: '0x2222222222222222222222222222222222222222',
          data: '0xdeadbeef',
          metadata: { description: 'Swap AKITA for USDC', transactionType: 'swap' },
        },
      ],
    })
  })

  it('extracts wallet send calls from uniswap build replies', () => {
    const reply = JSON.stringify({
      skill: 'uniswap_build_swap',
      data: {
        swap: {
          to: '0x3333333333333333333333333333333333333333',
          data: '0xabc123',
          value: '0',
          from: '0x4444444444444444444444444444444444444444',
          chainId: 8453,
        },
      },
    })

    const payload = extractWalletSendCallsFromUniswapActionReply({
      actionReply: reply,
      fallbackFrom: '0x4444444444444444444444444444444444444444',
    })

    expect(payload?.calls[0]?.to).toBe('0x3333333333333333333333333333333333333333')
  })
})
