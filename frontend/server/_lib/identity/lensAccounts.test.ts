import { beforeEach, describe, expect, it, vi } from 'vitest'

const { lensGqlMock } = vi.hoisted(() => ({
  lensGqlMock: vi.fn(),
}))

vi.mock('../lens/lensClient.js', () => ({
  lensGql: lensGqlMock,
}))

import { resolveLensUserByOwner } from './lensAccounts.js'

describe('resolveLensUserByOwner', () => {
  beforeEach(() => {
    lensGqlMock.mockReset()
  })

  it('queries Lens using ownedBy semantics first', async () => {
    lensGqlMock.mockResolvedValueOnce({
      accountsBulk: [
        {
          address: '0x1111111111111111111111111111111111111111',
          owner: '0x2222222222222222222222222222222222222222',
          username: { value: 'alice', localName: 'alice' },
          metadata: { name: 'Alice', picture: null },
        },
      ],
    })

    const result = await resolveLensUserByOwner('0x2222222222222222222222222222222222222222')

    expect(lensGqlMock).toHaveBeenCalledTimes(1)
    expect(lensGqlMock.mock.calls[0]?.[1]).toEqual({
      request: { ownedBy: ['0x2222222222222222222222222222222222222222'] },
    })
    expect(result?.accountAddress).toBe('0x1111111111111111111111111111111111111111')
    expect(result?.ownerAddress).toBe('0x2222222222222222222222222222222222222222')
  })

  it('falls back to address lookup when ownedBy returns no profiles', async () => {
    lensGqlMock
      .mockResolvedValueOnce({ accountsBulk: [] })
      .mockResolvedValueOnce({
        accountsBulk: [
          {
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            owner: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            username: { value: 'bob', localName: 'bob' },
            metadata: { name: 'Bob', picture: null },
          },
        ],
      })

    const result = await resolveLensUserByOwner('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')

    expect(lensGqlMock).toHaveBeenCalledTimes(2)
    expect(lensGqlMock.mock.calls[0]?.[1]).toEqual({
      request: { ownedBy: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] },
    })
    expect(lensGqlMock.mock.calls[1]?.[1]).toEqual({
      request: { addresses: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] },
    })
    expect(result?.accountAddress).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })
})
