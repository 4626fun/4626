import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isInverseAkitaChatSelfSender,
  isInverseAkitaChatSelfUsername,
  readAlfaClubChatJwtWalletAddresses,
  readInverseAkitaChatSelfSenderAddresses,
} from './inverseAkitaChatSelfSenders.js'

function makeJwt(linkedAccounts: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      linked_accounts: JSON.stringify(linkedAccounts),
    }),
  ).toString('base64url')
  return `${header}.${payload}.sig`
}

describe('inverseAkitaChatSelfSenders', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts wallet addresses from ALFACLUB_CHAT_JWT linked_accounts', () => {
    const jwt = makeJwt([
      { type: 'wallet', address: '0x8719Fa7Be10533fd69885b124a8c84f9C51071AF' },
      { type: 'twitter_oauth', username: 'hermit4626' },
    ])
    expect(readAlfaClubChatJwtWalletAddresses(jwt)).toEqual([
      '0x8719fa7be10533fd69885b124a8c84f9c51071af',
    ])
  })

  it('blocks only Hermit bot wallets (JWT + explicit self senders), not the operator', () => {
    vi.stubEnv('HERMIT_OWNER_ADDRESS', '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9')
    vi.stubEnv('PROTOCOL_CSW_ADDRESS', '0x793ca28123cba3ca3c20b9c6c67f37510c89c145')
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_SELF_SENDERS',
      '0x1111111111111111111111111111111111111111',
    )
    vi.stubEnv(
      'ALFACLUB_CHAT_JWT',
      makeJwt([{ type: 'wallet', address: '0x8719fa7be10533fd69885b124a8c84f9c51071af' }]),
    )

    const addresses = readInverseAkitaChatSelfSenderAddresses()
    expect(addresses.has('0x8719fa7be10533fd69885b124a8c84f9c51071af')).toBe(true)
    expect(addresses.has('0x1111111111111111111111111111111111111111')).toBe(true)
    expect(addresses.has('0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9')).toBe(false)
    expect(addresses.has('0x793ca28123cba3ca3c20b9c6c67f37510c89c145')).toBe(false)
    expect(
      isInverseAkitaChatSelfSender('0x8719fa7be10533fd69885b124a8c84f9c51071af'),
    ).toBe(true)
    expect(
      isInverseAkitaChatSelfSender('0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'),
    ).toBe(false)
    expect(
      isInverseAkitaChatSelfSender('0x2222222222222222222222222222222222222222'),
    ).toBe(false)
  })

  it('recognizes Hermit bot usernames', () => {
    expect(isInverseAkitaChatSelfUsername('hermit4626')).toBe(true)
    expect(isInverseAkitaChatSelfUsername('@Hermit4626')).toBe(true)
    expect(isInverseAkitaChatSelfUsername('Flip_Research')).toBe(false)
  })
})
