// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { appendLocalhostPrivyAuthNoteIfNeeded, LOCALHOST_PRIVY_AUTH_NOTE } from './localhostPrivyAuthNotice'

describe('appendLocalhostPrivyAuthNoteIfNeeded', () => {
  it('appends the localhost note for a Privy auth error on a loopback host (jsdom default origin)', () => {
    const result = appendLocalhostPrivyAuthNoteIfNeeded('Missing auth token.')
    expect(result).toBe(`Missing auth token.${LOCALHOST_PRIVY_AUTH_NOTE}`)
  })

  it('leaves unrelated errors unchanged even on a loopback host', () => {
    expect(appendLocalhostPrivyAuthNoteIfNeeded('Could not disconnect wallet.')).toBe(
      'Could not disconnect wallet.',
    )
  })

  it('does not double-append when the note is already present', () => {
    const once = appendLocalhostPrivyAuthNoteIfNeeded('Missing auth token.')
    const twice = appendLocalhostPrivyAuthNoteIfNeeded(once)
    expect(twice).toBe(once)
  })

  it('returns empty input unchanged', () => {
    expect(appendLocalhostPrivyAuthNoteIfNeeded('')).toBe('')
  })
})
