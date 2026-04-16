import type { VercelRequest } from '@vercel/node'

import { decodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  createImageGenerationProject,
  getCompletedImageProjectForVault,
  getImageGenerationProject,
  setImageProjectVaultAddress,
} from '../image/imageProjects.js'
import { getCanonicalOrigin } from '../infra/origin.js'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const CHAIN_ID_BASE = 8453

export const LAUNCH_IMAGE_PROJECT_ID_KEY = 'launchImageProjectId'
export const LAUNCH_IMAGE_READY_AT_KEY = 'launchImageReadyAt'
export const LAUNCH_IMAGE_VAULT_KEY = 'launchImageVaultAddress'
export const LAUNCH_IMAGE_SHARE_OFT_KEY = 'launchImageShareOft'
export const LAUNCH_IMAGE_VERIFIED_AT_KEY = 'launchImageVerifiedAt'
export const LAUNCH_IMAGE_VERIFIED_BYTES_KEY = 'launchImageVerifiedBytes'

const IMAGE_GATE_RETRY_ATTEMPTS = 5
const IMAGE_GATE_VERIFY_RETRY_ATTEMPTS = 4
const IMAGE_GATE_RETRY_BASE_MS = 250

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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

function isComposeInProgressError(message: string): boolean {
  const text = message.toLowerCase()
  return text.includes('/api/image/projects/direct-compose') && (text.includes('(409)') || text.includes('in progress'))
}

async function composeProjectOutputWithRetry(params: {
  req: VercelRequest
  projectId: string
  deployToken?: string
  deployTokenSignature?: string
}): Promise<void> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= IMAGE_GATE_RETRY_ATTEMPTS; attempt++) {
    try {
      await postImageApi({
        req: params.req,
        path: '/api/image/projects/direct-compose',
        body: { projectId: params.projectId },
        deployToken: params.deployToken,
        deployTokenSignature: params.deployTokenSignature,
      })
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      if (!isComposeInProgressError(message)) throw error
      lastError = error instanceof Error ? error : new Error(message)

      const existingProject = await getImageGenerationProject(params.projectId).catch(() => null)
      const hasOutputAsset = Array.isArray(existingProject?.assets)
        ? existingProject.assets.some((asset) => String((asset as { role?: unknown })?.role ?? '') === 'output')
        : false
      if (existingProject?.status === 'completed' && hasOutputAsset) {
        return
      }
      if (existingProject?.status === 'failed') {
        const latestError =
          typeof existingProject.latestError === 'string' && existingProject.latestError.trim()
            ? existingProject.latestError.trim()
            : 'unknown_error'
        throw new Error(`phase4 image gate failed: image composition failed (${latestError})`)
      }

      if (attempt < IMAGE_GATE_RETRY_ATTEMPTS) {
        await sleep(IMAGE_GATE_RETRY_BASE_MS * attempt)
      }
    }
  }
  throw lastError ?? new Error('phase4 image gate failed: image composition retry exhausted')
}

async function verifyTokenImageEndpointReady(params: {
  req: VercelRequest
  shareOFT: Address
}): Promise<{ verifiedUrl: string; byteSize: number }> {
  const origin = getCanonicalOrigin(params.req)
  const verifiedUrl = `${origin}/api/v1/token/${params.shareOFT.toLowerCase()}/image?chain=8453&format=png`
  let lastFailure = 'unknown'

  for (let attempt = 1; attempt <= IMAGE_GATE_VERIFY_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(verifiedUrl, { method: 'GET' })
      if (!response.ok) {
        lastFailure = `http_${response.status}`
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.byteLength > 0) {
          return { verifiedUrl, byteSize: bytes.byteLength }
        }
        lastFailure = 'empty_image_body'
      }
    } catch {
      lastFailure = 'request_failed'
    }
    if (attempt < IMAGE_GATE_VERIFY_RETRY_ATTEMPTS) {
      await sleep(IMAGE_GATE_RETRY_BASE_MS * attempt)
    }
  }

  throw new Error(`phase4 image gate failed: token image endpoint not ready (${lastFailure})`)
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
    const verification = await verifyTokenImageEndpointReady({
      req: params.req,
      shareOFT: launch.shareOFT,
    })
    await params.persistPayloadPatch({
      [LAUNCH_IMAGE_PROJECT_ID_KEY]: existingReady.projectId,
      [LAUNCH_IMAGE_SHARE_OFT_KEY]: launch.shareOFT,
      [LAUNCH_IMAGE_VAULT_KEY]: finalize.vault,
      [LAUNCH_IMAGE_READY_AT_KEY]: new Date().toISOString(),
      [LAUNCH_IMAGE_VERIFIED_AT_KEY]: new Date().toISOString(),
      [LAUNCH_IMAGE_VERIFIED_BYTES_KEY]: verification.byteSize,
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
  await composeProjectOutputWithRetry({
    req: params.req,
    projectId,
    deployToken: params.deployToken,
    deployTokenSignature: params.deployTokenSignature,
  })

  await setImageProjectVaultAddress(projectId, finalize.vault)

  const completed = await getCompletedImageProjectForVault(finalize.vault)
  if (!completed) {
    throw new Error('phase4 image gate failed: generated image did not bind to vault')
  }

  const verification = await verifyTokenImageEndpointReady({
    req: params.req,
    shareOFT: launch.shareOFT,
  })

  await params.persistPayloadPatch({
    [LAUNCH_IMAGE_PROJECT_ID_KEY]: completed.projectId,
    [LAUNCH_IMAGE_SHARE_OFT_KEY]: launch.shareOFT,
    [LAUNCH_IMAGE_VAULT_KEY]: finalize.vault,
    [LAUNCH_IMAGE_READY_AT_KEY]: new Date().toISOString(),
    [LAUNCH_IMAGE_VERIFIED_AT_KEY]: new Date().toISOString(),
    [LAUNCH_IMAGE_VERIFIED_BYTES_KEY]: verification.byteSize,
  })

  return {
    projectId: completed.projectId,
    outputBlobUrl: completed.outputBlobUrl,
    vaultAddress: finalize.vault,
    shareOFT: launch.shareOFT,
  }
}
