import { describe, expect, it } from 'vitest'
import { isPrivyRedirectUrlNotAllowedError, shouldAttemptCrossAppLoginOnPath } from './siweAuthCrossApp'

describe('siweAuthCrossApp', () => {
  it('detects Privy redirect allowlist errors', () => {
    expect(isPrivyRedirectUrlNotAllowedError(new Error('Redirect URL is not allowed'))).toBe(true)
    expect(isPrivyRedirectUrlNotAllowedError(new Error('401 oauth/init redirect url is not allowed'))).toBe(true)
    expect(isPrivyRedirectUrlNotAllowedError(new Error('user_exited'))).toBe(false)
  })

  it('only attempts cross-app login on root path', () => {
    expect(shouldAttemptCrossAppLoginOnPath('/')).toBe(true)
    expect(shouldAttemptCrossAppLoginOnPath('')).toBe(true)
    expect(shouldAttemptCrossAppLoginOnPath('/deploy')).toBe(false)
    expect(shouldAttemptCrossAppLoginOnPath('/vault')).toBe(false)
  })
})
