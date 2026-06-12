import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import {
  resolvePayoutRouterKeeperAddress,
  resolvePayoutRouterKeeperPrivateKey,
} from './payoutRouterRuntime.js'

const TEST_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const TEST_PK_BARE = TEST_PK.slice(2)
const TEST_EOA = privateKeyToAccount(TEST_PK).address
const OTHER_ADDRESS = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'

const MANAGED_KEYS = [
  'PAYOUT_ROUTER_KEEPER',
  'KPR_KEEPER_ADDRESS',
  'KPR_ADDRESS',
  'KPR_ERC4337_ENABLED',
  'KPR_ERC4337_SMART_WALLET',
  'KPR_PRIVATE_KEY',
  '4626_KEEPER_AUTOMATION_PRIVATE_KEY',
  'PROTOCOL_TREASURY_SAFE_OWNER_PK',
  'PRIVATE_KEY',
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('resolvePayoutRouterKeeperAddress', () => {
  it('derives the keeper EOA from a 0x-prefixed KPR_PRIVATE_KEY', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK
    expect(resolvePayoutRouterKeeperAddress()?.toLowerCase()).toBe(TEST_EOA.toLowerCase())
  })

  it('derives the keeper EOA from a bare 64-hex KPR_PRIVATE_KEY (no 0x prefix)', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK_BARE
    expect(resolvePayoutRouterKeeperAddress()?.toLowerCase()).toBe(TEST_EOA.toLowerCase())
  })

  it('prefers explicit PAYOUT_ROUTER_KEEPER over key derivation', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK
    process.env.PAYOUT_ROUTER_KEEPER = OTHER_ADDRESS
    expect(resolvePayoutRouterKeeperAddress()?.toLowerCase()).toBe(OTHER_ADDRESS.toLowerCase())
  })
})

describe('resolvePayoutRouterKeeperPrivateKey', () => {
  it('returns a normalized 0x key when KPR_PRIVATE_KEY lacks the prefix and keeper auto-derives', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK_BARE
    expect(resolvePayoutRouterKeeperPrivateKey(process.env)).toBe(TEST_PK)
  })

  it('returns the key when the derived address matches an explicit PAYOUT_ROUTER_KEEPER', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK_BARE
    process.env.PAYOUT_ROUTER_KEEPER = TEST_EOA
    expect(resolvePayoutRouterKeeperPrivateKey(process.env)).toBe(TEST_PK)
  })

  it('fails closed when PAYOUT_ROUTER_KEEPER points at a different address (e.g. a CSW)', () => {
    process.env.KPR_PRIVATE_KEY = TEST_PK
    process.env.PAYOUT_ROUTER_KEEPER = OTHER_ADDRESS
    expect(resolvePayoutRouterKeeperPrivateKey(process.env)).toBeNull()
  })

  it('returns null when no candidate key is present', () => {
    expect(resolvePayoutRouterKeeperPrivateKey(process.env)).toBeNull()
  })
})
