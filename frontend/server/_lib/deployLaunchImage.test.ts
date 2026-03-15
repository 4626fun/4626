import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import { createMockReq } from '../../api/__tests__/helpers'

const mocks = vi.hoisted(() => ({
  createImageGenerationProjectMock: vi.fn(),
  getCompletedImageProjectForVaultMock: vi.fn(),
  getImageGenerationProjectMock: vi.fn(),
  setImageProjectVaultAddressMock: vi.fn(),
  getCanonicalOriginMock: vi.fn(() => 'https://app.4626.fun'),
}))

vi.mock('./imageProjects.js', () => ({
  createImageGenerationProject: mocks.createImageGenerationProjectMock,
  getCompletedImageProjectForVault: mocks.getCompletedImageProjectForVaultMock,
  getImageGenerationProject: mocks.getImageGenerationProjectMock,
  setImageProjectVaultAddress: mocks.setImageProjectVaultAddressMock,
}))

vi.mock('./origin.js', () => ({
  getCanonicalOrigin: mocks.getCanonicalOriginMock,
}))

const FINALIZE_PHASE2_LEGACY_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const LAUNCH_DEFERRED_AUCTION_ABI = [
  {
    type: 'function',
    name: 'launchDeferredAuction',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
  },
] as const

const ADDR = {
  creatorToken: '0x1000000000000000000000000000000000000001',
  owner: '0x2000000000000000000000000000000000000002',
  vault: '0x3000000000000000000000000000000000000003',
  shareOft: '0x7000000000000000000000000000000000000007',
}

function makePhase2FinalizeCall() {
  const data = encodeFunctionData({
    abi: FINALIZE_PHASE2_LEGACY_ABI,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken: ADDR.creatorToken,
        owner: ADDR.owner,
        vault: ADDR.vault,
        wrapper: '0x4000000000000000000000000000000000000004',
        shareToken: ADDR.shareOft,
        gaugeController: '0x5000000000000000000000000000000000000005',
        ccaStrategy: '0x6000000000000000000000000000000000000006',
        oracle: '0x8000000000000000000000000000000000000008',
        version: 'v1.4.10',
        depositAmount: 1n,
        requiredRaise: 1n,
        floorPriceQ96: 1n,
        auctionSteps: '0x',
      },
    ],
  })
  return [{ to: ADDR.owner as `0x${string}`, value: 0n, data }]
}

function makePhase4LaunchCall() {
  const data = encodeFunctionData({
    abi: LAUNCH_DEFERRED_AUCTION_ABI,
    functionName: 'launchDeferredAuction',
    args: [
      {
        creatorToken: ADDR.creatorToken,
        owner: ADDR.owner,
        shareOFT: ADDR.shareOft,
        version: 'v1.4.10',
        floorPriceQ96: 1n,
        requiredRaise: 1n,
        auctionSteps: '0x',
      },
    ],
  })
  return [{ to: ADDR.owner as `0x${string}`, value: 0n, data }]
}

function makeJsonResponse(status: number, body: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  }
}

describe('deploy launch image gate', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCanonicalOriginMock.mockReturnValue('https://app.4626.fun')
  })

  afterEach(() => {
    ;(globalThis as { fetch?: typeof fetch }).fetch = originalFetch
  })

  it('uses existing vault-bound image and verifies the token image endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }))
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch

    mocks.getCompletedImageProjectForVaultMock.mockResolvedValueOnce({
      projectId: 'imgproj_ready',
      outputBlobUrl: 'https://blob.local/output.png',
    })

    const persisted: Record<string, unknown>[] = []
    const { ensureLaunchImageReady } = await import('./deployLaunchImage.ts')
    const result = await ensureLaunchImageReady({
      req: createMockReq({ method: 'POST' }),
      sessionId: 'sess_1',
      sessionAddress: ADDR.owner as `0x${string}`,
      payload: {},
      phase2FinalizeCalls: makePhase2FinalizeCall(),
      phase4Calls: makePhase4LaunchCall(),
      persistPayloadPatch: async (patch) => {
        persisted.push(patch)
      },
    })

    expect(result).toMatchObject({
      projectId: 'imgproj_ready',
      vaultAddress: ADDR.vault,
      shareOFT: ADDR.shareOft,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `https://app.4626.fun/api/v1/token/${ADDR.shareOft.toLowerCase()}/image?chain=8453&format=png`,
      { method: 'GET' },
    )
    expect(mocks.createImageGenerationProjectMock).not.toHaveBeenCalled()
    expect(mocks.setImageProjectVaultAddressMock).not.toHaveBeenCalled()
    expect(persisted[0]).toEqual(
      expect.objectContaining({
        launchImageProjectId: 'imgproj_ready',
        launchImageVaultAddress: ADDR.vault,
        launchImageShareOft: ADDR.shareOft,
        launchImageVerifiedBytes: 3,
      }),
    )
  })

  it('handles compose in-progress conflicts and still completes image gate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse(200, { success: true, data: {} })) // auto-assets
      .mockResolvedValueOnce(
        makeJsonResponse(409, { success: false, error: 'Composition already in progress for this project' }),
      ) // direct-compose
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
        arrayBuffer: async () => new Uint8Array([9, 8, 7, 6]).buffer,
      }) // endpoint verify
    ;(globalThis as { fetch?: typeof fetch }).fetch = fetchMock as typeof fetch

    mocks.getCompletedImageProjectForVaultMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        projectId: 'imgproj_new',
        outputBlobUrl: 'https://blob.local/output-new.png',
      })
    mocks.createImageGenerationProjectMock.mockResolvedValue({
      id: 'imgproj_new',
    })
    mocks.getImageGenerationProjectMock.mockResolvedValue({
      status: 'completed',
      latestError: null,
      assets: [{ role: 'output' }],
    })
    mocks.setImageProjectVaultAddressMock.mockResolvedValue(undefined)

    const persisted: Record<string, unknown>[] = []
    const { ensureLaunchImageReady } = await import('./deployLaunchImage.ts')
    const result = await ensureLaunchImageReady({
      req: createMockReq({ method: 'POST' }),
      sessionId: 'sess_2',
      sessionAddress: ADDR.owner as `0x${string}`,
      payload: {},
      phase2FinalizeCalls: makePhase2FinalizeCall(),
      phase4Calls: makePhase4LaunchCall(),
      persistPayloadPatch: async (patch) => {
        persisted.push(patch)
      },
    })

    expect(result).toMatchObject({
      projectId: 'imgproj_new',
      vaultAddress: ADDR.vault,
      shareOFT: ADDR.shareOft,
    })
    expect(mocks.getImageGenerationProjectMock).toHaveBeenCalledWith('imgproj_new')
    expect(mocks.setImageProjectVaultAddressMock).toHaveBeenCalledWith('imgproj_new', ADDR.vault)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://app.4626.fun/api/v1/token/${ADDR.shareOft.toLowerCase()}/image?chain=8453&format=png`,
      { method: 'GET' },
    )
    expect(persisted[persisted.length - 1]).toEqual(
      expect.objectContaining({
        launchImageProjectId: 'imgproj_new',
        launchImageVaultAddress: ADDR.vault,
        launchImageShareOft: ADDR.shareOft,
        launchImageVerifiedBytes: 4,
      }),
    )
  })
})
