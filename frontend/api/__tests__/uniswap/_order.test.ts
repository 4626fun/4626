import { describe, expect, it } from 'vitest'

import { validateOrderResponsePayload } from '../../_handlers/uniswap/_order'

const BASE_ORDER = {
  requestId: 'req_123',
  orderId: 'order_abc',
  orderStatus: 'OPEN',
}

describe('validateOrderResponsePayload', () => {
  it('accepts a valid order payload', () => {
    expect(validateOrderResponsePayload(BASE_ORDER)).toBeNull()
  })

  it('rejects non-object payloads', () => {
    expect(validateOrderResponsePayload(null)).toBe('Invalid order response from Uniswap API')
    expect(validateOrderResponsePayload('bad')).toBe('Invalid order response from Uniswap API')
  })

  it('rejects missing fields', () => {
    expect(validateOrderResponsePayload({ ...BASE_ORDER, requestId: '' })).toBe(
      'Uniswap order response missing requestId',
    )
    expect(validateOrderResponsePayload({ ...BASE_ORDER, orderId: '' })).toBe(
      'Uniswap order response missing orderId',
    )
    expect(validateOrderResponsePayload({ ...BASE_ORDER, orderStatus: '' })).toBe(
      'Uniswap order response missing orderStatus',
    )
  })
})

