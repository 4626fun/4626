import { describe, expect, it } from 'vitest'

import { deriveAdminStatus } from './useAdminStatus'

describe('deriveAdminStatus', () => {
  it('does not block loading when no session address exists', () => {
    expect(
      deriveAdminStatus({
        authAddress: null,
        sessionHydrated: false,
        queryLoading: true,
        queryIsAdmin: false,
      }),
    ).toEqual({
      hasSessionAddress: false,
      isAdmin: false,
      isLoading: false,
    })
  })

  it('stays loading while session hydration is pending for session users', () => {
    expect(
      deriveAdminStatus({
        authAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        sessionHydrated: false,
        queryLoading: false,
        queryIsAdmin: false,
      }),
    ).toEqual({
      hasSessionAddress: true,
      isAdmin: false,
      isLoading: true,
    })
  })

  it('stays loading while admin query is still resolving', () => {
    expect(
      deriveAdminStatus({
        authAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        sessionHydrated: true,
        queryLoading: true,
        queryIsAdmin: false,
      }),
    ).toEqual({
      hasSessionAddress: true,
      isAdmin: false,
      isLoading: true,
    })
  })

  it('marks admin users as ready once hydration and query resolve', () => {
    expect(
      deriveAdminStatus({
        authAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        sessionHydrated: true,
        queryLoading: false,
        queryIsAdmin: true,
      }),
    ).toEqual({
      hasSessionAddress: true,
      isAdmin: true,
      isLoading: false,
    })
  })
})
