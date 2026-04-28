import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readSessionFromRequestMock,
  createHermitMemeMock,
  listHermitMemesMock,
  softDeleteHermitMemeMock,
  isHermitOwnerMock,
  isHermitRoomAllowedForOwnerMock,
  getHermitOwnerAddressMock,
  resolveHermitGatewayUrlMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  readSessionFromRequestMock: vi.fn(),
  createHermitMemeMock: vi.fn(),
  listHermitMemesMock: vi.fn(),
  softDeleteHermitMemeMock: vi.fn(),
  isHermitOwnerMock: vi.fn(),
  isHermitRoomAllowedForOwnerMock: vi.fn(),
  getHermitOwnerAddressMock: vi.fn(),
  resolveHermitGatewayUrlMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../packages/server-core/src/index.js')>(
    '../../packages/server-core/src/index.js',
  )
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    getClientIp: getClientIpMock,
    rateLimitKey: rateLimitKeyMock,
    readSessionFromRequest: readSessionFromRequestMock,
  }
})

vi.mock('../../server/_lib/hermit/repository.js', () => ({
  createHermitMeme: createHermitMemeMock,
  listHermitMemes: listHermitMemesMock,
  softDeleteHermitMeme: softDeleteHermitMemeMock,
}))

vi.mock('../../server/_lib/hermit/policy.js', () => ({
  isHermitOwner: isHermitOwnerMock,
  isHermitRoomAllowedForOwner: isHermitRoomAllowedForOwnerMock,
  getHermitOwnerAddress: getHermitOwnerAddressMock,
  resolveHermitGatewayUrl: resolveHermitGatewayUrlMock,
}))

import saveHandler from '../_handlers/v1/chat/_hermit-meme-save.ts'
import listHandler from '../_handlers/v1/chat/_hermit-meme-list.ts'
import deleteHandler from '../_handlers/v1/chat/_hermit-meme-delete.ts'

describe('Hermit meme save/list/delete endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    readSessionFromRequestMock.mockReturnValue({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    isHermitOwnerMock.mockReturnValue(true)
    isHermitRoomAllowedForOwnerMock.mockResolvedValue(true)
    getHermitOwnerAddressMock.mockReturnValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    resolveHermitGatewayUrlMock.mockReturnValue('https://gateway.example/ipfs/bafk')
  })

  it('save: blocks non-owner session', async () => {
    isHermitOwnerMock.mockReturnValueOnce(false)
    const req = createMockReq({
      method: 'POST',
      body: { roomId: '1043', cid: 'bafk', caption: 'gm', tags: ['gm'] },
    })
    const res = createMockRes()

    await saveHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('Hermit owner only')
  })

  it('save: creates meme record for valid owner request', async () => {
    createHermitMemeMock.mockResolvedValueOnce({
      id: 1,
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      roomId: '1043',
      cid: 'bafk',
      url: 'https://gateway.example/ipfs/bafk',
      caption: 'gm',
      tags: ['gm'],
      createdBy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const req = createMockReq({
      method: 'POST',
      body: { roomId: '1043', cid: 'bafk', caption: 'gm', tags: ['gm'] },
    })
    const res = createMockRes()

    await saveHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(createHermitMemeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '1043',
        cid: 'bafk',
      }),
    )
  })

  it('list: requires signed-in user', async () => {
    readSessionFromRequestMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'GET',
      query: { roomId: '1043' },
    })
    const res = createMockRes()

    await listHandler(req, res)

    expect(res.statusCode).toBe(401)
  })

  it('list: fails when owner address is not configured', async () => {
    getHermitOwnerAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'GET',
      query: { roomId: '1043' },
    })
    const res = createMockRes()

    await listHandler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('Hermit owner address is not configured')
  })

  it('list: returns room memes for allowed room', async () => {
    listHermitMemesMock.mockResolvedValueOnce([
      {
        id: 1,
        ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        roomId: '1043',
        cid: 'bafk',
        url: 'https://gateway.example/ipfs/bafk',
        caption: 'gm',
        tags: ['gm'],
        createdBy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    const req = createMockReq({
      method: 'GET',
      query: { roomId: '1043', limit: '10' },
    })
    const res = createMockRes()

    await listHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.count).toBe(1)
    expect(listHermitMemesMock).toHaveBeenCalledWith({
      roomId: '1043',
      tag: undefined,
      limit: 10,
    })
  })

  it('delete: blocks non-owner session', async () => {
    isHermitOwnerMock.mockReturnValueOnce(false)
    const req = createMockReq({
      method: 'POST',
      body: { memeId: 1, roomId: '1043' },
    })
    const res = createMockRes()

    await deleteHandler(req, res)

    expect(res.statusCode).toBe(403)
  })

  it('delete: soft-deletes existing meme', async () => {
    softDeleteHermitMemeMock.mockResolvedValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: { memeId: 1, roomId: '1043' },
    })
    const res = createMockRes()

    await deleteHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.deleted).toBe(true)
  })
})
