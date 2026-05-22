import { describe, expect, it } from 'vitest'
import { selectCrossAppAuthAction } from './crossAppWalletUtils'

describe('selectCrossAppAuthAction', () => {
  const noop = async () => null

  it('prefers link helper for authenticated users', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: noop,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('link')
  })

  it('falls back to login helper when link helper is unavailable', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: null,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('login')
  })

  it('uses login helper first for unauthenticated users', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: false,
        linkCrossAppAccount: noop,
        loginWithCrossAppAccount: noop,
      }),
    ).toBe('login')
  })

  it('returns null when no helper is available', () => {
    expect(
      selectCrossAppAuthAction({
        privyAuthed: true,
        linkCrossAppAccount: null,
        loginWithCrossAppAccount: null,
      }),
    ).toBeNull()
  })
})
