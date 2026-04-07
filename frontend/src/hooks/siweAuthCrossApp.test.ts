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
    expect(getCrossAppSafeRedirectPath({ pathname: '/faq', search: '', hash: '#intro' })).toEqual({
      safePath: '/faq',
      shouldSanitize: true,
    })
    expect(getCrossAppSafeRedirectPath({ pathname: '/r/FRIEND42', search: '?foo=bar', hash: '' })).toEqual({
      safePath: '/r/FRIEND42',
      shouldSanitize: true,
    })
    expect(getCrossAppSafeRedirectPath({ pathname: '/accounts', search: '?cv_handoff=handoff-123', hash: '' })).toEqual({
      safePath: '/accounts',
      shouldSanitize: true,
    })
    expect(getCrossAppSafeRedirectPath({ pathname: '/accounts', search: '', hash: '' })).toEqual({
      safePath: '/accounts',
      shouldSanitize: false,
    })
  })
})
