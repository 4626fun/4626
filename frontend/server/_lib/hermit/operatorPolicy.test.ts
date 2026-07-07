import { describe, expect, it } from 'vitest'
import { isHermitOperatorOnlyCommand, isTrustedHermitOperator, formatInverseAkitaPilotDeniedMessage } from './operatorPolicy.js'

describe('operatorPolicy', () => {
  it('recognizes operator-only hermit commands', () => {
    expect(isHermitOperatorOnlyCommand('/arena status')).toBe(true)
    expect(isHermitOperatorOnlyCommand('/signal')).toBe(true)
    expect(isHermitOperatorOnlyCommand('/strategy bias bearish')).toBe(true)
    expect(isHermitOperatorOnlyCommand('/strategy status')).toBe(false)
    expect(isHermitOperatorOnlyCommand('/strategy optin balanced')).toBe(false)
  })

  it('derives trusted operator truth from role + allowlist', () => {
    expect(
      isTrustedHermitOperator({
        senderIsAllowlisted: false,
        role: 'MEMBER',
        isRoomOwner: false,
      }),
    ).toBe(false)
    expect(
      isTrustedHermitOperator({
        senderIsAllowlisted: true,
        role: 'MEMBER',
        isRoomOwner: false,
      }),
    ).toBe(true)
    expect(
      isTrustedHermitOperator({
        senderIsAllowlisted: false,
        role: 'ADMIN',
        isRoomOwner: false,
      }),
    ).toBe(true)
  })

  it('formats 1659 pilot denial copy', () => {
    expect(formatInverseAkitaPilotDeniedMessage('/arena')).toContain('Stake at least 1 FriendKey')
    expect(formatInverseAkitaPilotDeniedMessage('/arena')).toContain('room 1659')
  })
})

