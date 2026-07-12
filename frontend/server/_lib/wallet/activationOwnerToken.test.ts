import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  issueActivationOwnerToken,
  readActivationOwnerToken,
} from './activationOwnerToken'

const SESSION = '0x1111111111111111111111111111111111111111'
const CSW = '0x2222222222222222222222222222222222222222'
const SERVER = '0x3333333333333333333333333333333333333333'

describe('activation owner token', () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET

  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = 'test-activation-secret-1234'
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SESSION_SECRET
    else process.env.AUTH_SESSION_SECRET = originalSecret
  })

  it('binds user, profile, CSW, embedded signer, server wallet, purpose, and expiry', () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: SESSION,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: SESSION,
      serverOwnerAddress: SERVER,
      nowMs: 1_000,
      ttlSeconds: 60,
    })

    expect(readActivationOwnerToken(token, 30_000)).toMatchObject({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: SESSION,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: SESSION,
      serverOwnerAddress: SERVER,
      purpose: 'enable_4626_server_owner',
      expiresAtMs: 61_000,
    })
  })

  it('rejects tampering and expiry', () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: SESSION,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: SESSION,
      serverOwnerAddress: SERVER,
      nowMs: 1_000,
      ttlSeconds: 10,
    })

    expect(readActivationOwnerToken(`${token}x`, 2_000)).toBeNull()
    expect(readActivationOwnerToken(token, 12_000)).toBeNull()
  })

  it('rejects wrong purpose and missing signature parts', () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: SESSION,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: SESSION,
      serverOwnerAddress: SERVER,
      nowMs: 1_000,
      ttlSeconds: 60,
    })
    const [payloadPart] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadPart!, 'base64url').toString('utf8'))
    payload.purpose = 'relay_owner_install'
    const forged = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.deadbeef`

    expect(readActivationOwnerToken(forged, 2_000)).toBeNull()
    expect(readActivationOwnerToken(payloadPart, 2_000)).toBeNull()
    expect(readActivationOwnerToken('', 2_000)).toBeNull()
  })

  it('rejects cross-profile binding payloads that fail signature checks after mutation', () => {
    const token = issueActivationOwnerToken({
      privyUserId: 'did:privy:user-1',
      profileId: 42,
      sessionAddress: SESSION,
      smartWalletAddress: CSW,
      embeddedOwnerAddress: SESSION,
      serverOwnerAddress: SERVER,
      nowMs: 1_000,
      ttlSeconds: 60,
    })
    const [payloadPart, signaturePart] = token.split('.')
    const payload = JSON.parse(Buffer.from(payloadPart!, 'base64url').toString('utf8'))
    payload.pid = 99
    payload.ow = '0x4444444444444444444444444444444444444444'
    const mutated = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signaturePart}`
    expect(readActivationOwnerToken(mutated, 2_000)).toBeNull()
  })
})
