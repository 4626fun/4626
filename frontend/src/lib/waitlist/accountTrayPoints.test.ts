import { describe, expect, it } from 'vitest'

import {
  AccountTrayPointsAuthError,
  fetchAccountTrayPoints,
  isAccountTrayPointsAuthError,
} from './accountTrayPoints'

describe('fetchAccountTrayPoints', () => {
  it('fails closed without a Privy access token', async () => {
    await expect(fetchAccountTrayPoints(40, null)).rejects.toBeInstanceOf(AccountTrayPointsAuthError)
    await expect(fetchAccountTrayPoints(40, '   ')).rejects.toBeInstanceOf(AccountTrayPointsAuthError)
  })

  it('classifies auth errors', () => {
    expect(isAccountTrayPointsAuthError(new AccountTrayPointsAuthError())).toBe(true)
    expect(isAccountTrayPointsAuthError(new Error('nope'))).toBe(false)
  })
})
