import type { VercelRequest } from '@vercel/node'

import { decodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  createImageGenerationProject,
  getCompletedImageProjectForVault,
  getImageGenerationProject,
  setImageProjectVaultAddress,
} from './imageProjects.js'
import { getCanonicalOrigin } from './origin.js'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const CHAIN_ID_BASE = 8453

export const LAUNCH_IMAGE_PROJECT_ID_KEY = 'launchImageProjectId'
export const LAUNCH_IMAGE_READY_AT_KEY = 'launchImageReadyAt'
export const LAUNCH_IMAGE_VAULT_KEY = 'launchImageVaultAddress'
export const LAUNCH_IMAGE_SHARE_OFT_KEY = 'launchImageShareOft'

const FINALIZE_PHASE2_ABI = [
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
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

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

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.find((entry) => typeof entry === 'string' && entry.trim())?.trim() ?? ''
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const addr = getAddress(value as Address)
  return addr.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : addr
}

function extractFinalizeInfo(calls: Array<{ data: Hex }>): { creatorToken: Address; vault: Address } | null {
  for (const call of calls) {
    for (const abi of [FINALIZE_PHASE2_ABI, FINALIZE_PHASE2_LEGACY_ABI]) {
      try {
        const decoded = decodeFunctionData({ abi, data: call.data })
        if (decoded.functionName !== 'finalizePhase2') continue
        const params = (decoded.args?.[0] ?? null) as { creatorToken?: unknown; vault?: unknown } | null
        const creatorToken = normalizeAddress(params?.creatorToken)
        const vault = normalizeAddress(params?.vault)
        if (creatorToken && vault) return { creatorToken, vault }
      } catch {
        continue
      }
    }
  }
  return null
}

function extractLaunchInfo(calls: Array<{ data: Hex }>): { creatorToken: Address; shareOFT: Address } | null {
  for (const call of calls) {
    try {
      const decoded = decodeFunctionData({ abi: LAUNCH_DEFERRED_AUCTION_ABI, data: call.data })
      if (decoded.functionName !== 'launchDeferredAuction') continue
      const params = (decoded.args?.[0] ?? null) as { creatorToken?: unknown; shareOFT?: unknown } | null
      const creatorToken = normalizeAddress(params?.creatorToken)
      const shareOFT = normalizeAddress(params?.shareOFT)
      if (creatorToken && shareOFT) return { creatorToken, shareOFT }
    } catch {
      continue
    }
  }
  return null
}

async function postImageApi<T>(params: {
  req: VercelRequest
  path: '/api/image/projects/auto-assets' | '/api/image/projects/direct-compose'
  body: Record<string, unknown>
  deployToken?: string
  deployTokenSignature?: string
}): Promise<T> {
  const origin = getCanonicalOrigin(params.req)
  const cookie = headerValue(params.req.headers.cookie as string | string[] | undefined)
  const authorization = headerValue(params.req.headers.authorization as string | string[] | undefined)
  const siwaReceipt = headerValue(params.req.headers['x-siwa-receipt'] as string | string[] | undefined)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cookie) headers.Cookie = cookie
  if (authorization) headers.Authorization = authorization
  if (siwaReceipt) headers['X-SIWA-Receipt'] = siwaReceipt
  if (params.deployToken) headers['X-CV-Deploy-Session'] = params.deployToken
  if (params.deployTokenSignature) headers['X-CV-Deploy-Session-Signature'] = params.deployTokenSignature

  const response = await fetch(`${origin}${params.path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params.body),
  })
  const raw = await response.text().catch(() => '')
  let json: any = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = null
  }
  if (!response.ok || json?.success !== true) {
    const detail =
      typeof json?.error === 'string' && json.error.trim()
        ? json.error.trim()
        : raw
          ? raw.slice(0, 240)
          : `http_${response.status}`
    throw new Error(`phase4 image gate failed: ${params.path} (${response.status}) ${detail}`)
  }
  return json.data as T
}

export async function ensureLaunchImageReady(params: {
  req: VercelRequest
  sessionId: string
  sessionAddress: Address
  payload: Record<string, any>
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  phase4Calls: Array<{ to: Address; value: bigint; data: Hex }>
  persistPayloadPatch: (patch: Record<string, unknown>) => Promise<void>
  deployToken?: string
  deployTokenSignature?: string
}): Promise<{ projectId: string; outputBlobUrl: string; vaultAddress: Address; shareOFT: Address }> {
  const launch = extractLaunchInfo(params.phase4Calls)
  if (!launch) throw new Error('phase4 image gate failed: phase4Calls missing launchDeferredAuction')

  const finalize = extractFinalizeInfo(params.phase2FinalizeCalls)
  if (!finalize) throw new Error('phase4 image gate failed: phase2 finalize call missing creatorToken/vault')
  if (launch.creatorToken.toLowerCase() !== finalize.creatorToken.toLowerCase()) {
    throw new Error('phase4 image gate failed: creator token mismatch between phase2 finalize and phase4 launch')
  }

  const existingReady = await getCompletedImageProjectForVault(finalize.vault)
  if (existingReady) {
    await params.persistPayloadPatch({
      [LAUNCH_IMAGE_PROJECT_ID_KEY]: existingReady.projectId,
      [LAUNCH_IMAGE_SHARE_OFT_KEY]: launch.shareOFT,
      [LAUNCH_IMAGE_VAULT_KEY]: finalize.vault,
      [LAUNCH_IMAGE_READY_AT_KEY]: new Date().toISOString(),
    })
    return {
      projectId: existingReady.projectId,
      outputBlobUrl: existingReady.outputBlobUrl,
      vaultAddress: finalize.vault,
      shareOFT: launch.shareOFT,
    }
  }

  let projectId = ''
  if (typeof params.payload?.[LAUNCH_IMAGE_PROJECT_ID_KEY] === 'string') {
    projectId = String(params.payload[LAUNCH_IMAGE_PROJECT_ID_KEY]).trim()
  }
  if (projectId) {
    const existingProject = await getImageGenerationProject(projectId).catch(() => null)
    if (!existingProject) {
      projectId = ''
    }
  }
  if (!projectId) {
    const project = await createImageGenerationProject({
      ownerAddress: params.sessionAddress.toLowerCase(),
      creatorAddress: params.sessionAddress.toLowerCase(),
      instruction: `Create launch-ready ShareOFT artwork for ${launch.shareOFT}.`,
      stylePreset: 'deploy-launch',
      brandContext: [`deploy-session:${params.sessionId}`, `share-oft:${launch.shareOFT}`],
    })
    projectId = project.id
    await params.persistPayloadPatch({
      [LAUNCH_IMAGE_PROJECT_ID_KEY]: projectId,
      [LAUNCH_IMAGE_SHARE_OFT_KEY]: launch.shareOFT,
      [LAUNCH_IMAGE_VAULT_KEY]: finalize.vault,
    })
  }

  await postImageApi({
    req: params.req,
    path: '/api/image/projects/auto-assets',
    body: {
      projectId,
      creatorCoinAddress: finalize.creatorToken,
      chainId: CHAIN_ID_BASE,
    },
    deployToken: params.deployToken,
    deployTokenSignature: params.deployTokenSignature,
  })
  await postImageApi({
    req: params.req,
    path: '/api/image/projects/direct-compose',
    body: { projectId },
    deployToken: params.deployToken,
    deployTokenSignature: params.deployTokenSignature,
  })

  await setImageProjectVaultAddress(projectId, finalize.vault)

  const completed = await getCompletedImageProjectForVault(finalize.vault)
  if (!completed) {
    throw new Error('phase4 image gate failed: generated image did not bind to vault')
  }

  await params.persistPayloadPatch({
    [LAUNCH_IMAGE_PROJECT_ID_KEY]: completed.projectId,
    [LAUNCH_IMAGE_SHARE_OFT_KEY]: launch.shareOFT,
    [LAUNCH_IMAGE_VAULT_KEY]: finalize.vault,
    [LAUNCH_IMAGE_READY_AT_KEY]: new Date().toISOString(),
  })

  return {
    projectId: completed.projectId,
    outputBlobUrl: completed.outputBlobUrl,
    vaultAddress: finalize.vault,
    shareOFT: launch.shareOFT,
  }
}
