import { describe, expect, it, vi } from 'vitest'

import {
  assertAddOwnerSelfCallShape,
  assertAddOwnerSelfCallOwnerArg,
  assertSendCallsEntryPointAddOwnerBundle,
  parseAddOwnerAddressCalldataOwner,
  RELAY_ROUTER_BASE,
  verifyEntryPointHandleOpsTransaction,
} from '@/lib/wallet/addOwnerCallShape'
import {
  ADD_OWNER_ADDRESS_SELECTOR,
  ENTRY_POINT_V06_BASE,
  RELAY_DEPOSITORY_BASE,
} from '@/lib/wallet/cswOwnerAbi'

const CSW = '0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF' as const
const EMBEDDED = '0xb2aad65a5402714bf428a66731ae62ba5c45cac0' as const

function validAddOwnerData(owner: string = EMBEDDED): `0x${string}` {
  const stripped = owner.toLowerCase().replace(/^0x/, '')
  return `${ADD_OWNER_ADDRESS_SELECTOR}${'0'.repeat(24)}${stripped}` as `0x${string}`
}

describe('assertAddOwnerSelfCallShape', () => {
  it('accepts CSW self-call addOwnerAddress calldata', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: { to: CSW, data: validAddOwnerData() },
      }),
    ).not.toThrow()
  })

  it('rejects Relay router multicall target', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: {
          to: RELAY_ROUTER_BASE,
          data: '0xcd6e13f70000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
      }),
    ).toThrow(/RelayRouter multicall is not allowed/)
  })

  it('rejects Relay depository as target', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: {
          to: RELAY_DEPOSITORY_BASE,
          data: '0x49290c1c0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
      }),
    ).toThrow(/RelayRouter multicall is not allowed/)
  })

  it('rejects multicall selector even when to is CSW', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: {
          to: CSW,
          data: '0xcd6e13f70000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
      }),
    ).toThrow(/RelayRouter multicall is not allowed/)
  })

  it('rejects wrong target address', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: {
          to: '0x1111111111111111111111111111111111111111',
          data: validAddOwnerData(),
        },
      }),
    ).toThrow(/canonical CSW/)
  })

  it('rejects wrong function selector', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: {
          to: CSW,
          data: '0xdeadbeef0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
      }),
    ).toThrow(/addOwnerAddress selector/)
  })

  it('rejects owner arg mismatch when expectedOwnerToAdd is provided', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: { to: CSW, data: validAddOwnerData() },
        expectedOwnerToAdd: '0x1111111111111111111111111111111111111111',
      }),
    ).toThrow(/active Privy embedded EOA/)
  })

  it('accepts matching owner arg when expectedOwnerToAdd is provided', () => {
    expect(() =>
      assertAddOwnerSelfCallShape({
        csw: CSW,
        txRequest: { to: CSW, data: validAddOwnerData() },
        expectedOwnerToAdd: EMBEDDED,
      }),
    ).not.toThrow()
  })
})

describe('parseAddOwnerAddressCalldataOwner', () => {
  it('decodes the owner address from addOwnerAddress calldata', () => {
    expect(parseAddOwnerAddressCalldataOwner(validAddOwnerData())?.toLowerCase()).toBe(EMBEDDED.toLowerCase())
  })

  it('returns null for non-addOwner calldata', () => {
    expect(parseAddOwnerAddressCalldataOwner('0xdeadbeef')).toBeNull()
  })
})

describe('assertAddOwnerSelfCallOwnerArg', () => {
  it('throws when calldata owner differs from expected', () => {
    expect(() =>
      assertAddOwnerSelfCallOwnerArg({
        data: validAddOwnerData(),
        expectedOwnerToAdd: '0x1111111111111111111111111111111111111111',
      }),
    ).toThrow(/addOwnerAddress calldata targets/)
  })
})

describe('assertSendCallsEntryPointAddOwnerBundle', () => {
  it('accepts a single zero-value CSW self-call', () => {
    expect(() =>
      assertSendCallsEntryPointAddOwnerBundle({
        csw: CSW,
        calls: [{ to: CSW, data: validAddOwnerData(), value: 0n }],
      }),
    ).not.toThrow()
  })

  it('rejects multi-call bundles (Relay deposit + mutation)', () => {
    expect(() =>
      assertSendCallsEntryPointAddOwnerBundle({
        csw: CSW,
        calls: [
          { to: RELAY_DEPOSITORY_BASE, data: '0x49290c1c' as `0x${string}`, value: 1n },
          { to: CSW, data: validAddOwnerData() },
        ],
      }),
    ).toThrow(/exactly one CSW self-call/)
  })

  it('rejects non-zero value on the self-call', () => {
    expect(() =>
      assertSendCallsEntryPointAddOwnerBundle({
        csw: CSW,
        calls: [{ to: CSW, data: validAddOwnerData(), value: 1n }],
      }),
    ).toThrow(/zero native value/)
  })
})

describe('verifyEntryPointHandleOpsTransaction', () => {
  it('passes when outer tx targets EntryPoint v0.6', async () => {
    const publicClient = {
      getTransaction: vi.fn().mockResolvedValue({ to: ENTRY_POINT_V06_BASE }),
    }
    await expect(
      verifyEntryPointHandleOpsTransaction({
        publicClient,
        txHash: `0x${'a'.repeat(64)}`,
      }),
    ).resolves.toBeUndefined()
  })

  it('fails when outer tx targets RelayRouter', async () => {
    const publicClient = {
      getTransaction: vi.fn().mockResolvedValue({ to: RELAY_ROUTER_BASE }),
    }
    await expect(
      verifyEntryPointHandleOpsTransaction({
        publicClient,
        txHash: `0x${'b'.repeat(64)}`,
      }),
    ).rejects.toThrow(/EntryPoint/)
  })
})
