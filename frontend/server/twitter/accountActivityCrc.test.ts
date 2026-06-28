import { describe, expect, it } from 'vitest'

import { buildAccountActivityCrcResponseToken } from './accountActivityCrc.js'

describe('accountActivityCrc', () => {
  it('builds the sha256 response token expected by X webhook registration', () => {
    const response = buildAccountActivityCrcResponseToken('example_crc_token', 'example_consumer_secret')
    expect(response.startsWith('sha256=')).toBe(true)
    expect(response.length).toBeGreaterThan('sha256='.length)
  })

  it('rejects empty inputs', () => {
    expect(() => buildAccountActivityCrcResponseToken('', 'secret')).toThrow('account_activity_crc_inputs_missing')
    expect(() => buildAccountActivityCrcResponseToken('token', '')).toThrow('account_activity_crc_inputs_missing')
  })
})
