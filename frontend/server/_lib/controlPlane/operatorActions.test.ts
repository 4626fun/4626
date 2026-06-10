import { describe, expect, it } from 'vitest'
import { parseOperatorAction } from './operatorActions.js'

describe('parseOperatorAction', () => {
  it('parses vault.sweep action payload', () => {
    const action = parseOperatorAction({
      type: 'vault.sweep',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      ccaStrategyAddress: '0x2222222222222222222222222222222222222222',
    })
    expect(action.type).toBe('vault.sweep')
  })

  it('rejects invalid payload', () => {
    expect(() =>
      parseOperatorAction({
        type: 'strategy.ajna.rebucket',
        vaultAddress: '0x1111111111111111111111111111111111111111',
        targetBucket: 'not-int',
      }),
    ).toThrow('invalid_target_bucket')
  })
})

