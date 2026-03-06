import { describe, expect, it } from 'vitest'
import {
  getCrossAppSafeRedirectPath,
  isPrivyRedirectUrlNotAllowedError,
} from './siweAuthCrossApp'

describe('siweAuthCrossApp', () => {
  it('detects Privy redirect allowlist errors', () => {
    expect(isPrivyRedirectUrlNotAllowedError(new Error('Redirect URL is not allowed'))).toBe(true)
    expect(isPrivyRedirectUrlNotAllowedError(new Error('401 oauth/init redirect url is not allowed'))).toBe(true)
    expect(isPrivyRedirectUrlNotAllowedError(new Error('user_exited'))).toBe(false)
  })

  it('derives a safe redirect path for cross-app auth', () => {
    expect(getCrossAppSafeRedirectPath({ pathname: '/', search: '', hash: '#waitlist' })).toEqual({
      safePath: '/',
      shouldSanitize: true,
    })
    expect(getCrossAppSafeRedirectPath({ pathname: '/waitlist', search: '?ref=abc', hash: '' })).toEqual({
      safePath: '/waitlist',
      shouldSanitize: true,
    })
    expect(getCrossAppSafeRedirectPath({ pathname: '/waitlist', search: '', hash: '' })).toEqual({
      safePath: '/waitlist',
      shouldSanitize: false,
    })
  })
})
