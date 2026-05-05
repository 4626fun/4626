import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  checkRateLimit,
  getClientIp,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readJsonBody,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '../../../packages/server-core/src/index.js'
import {
  createPublicClient,
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { isOwner as isOwnerOnChain } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'

const PREVIEW_REMOVE_OWNER_BODY_MAX_BYTES = 8 * 1024

const CSW_OWNER_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'removeOwnerAtIndex',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeLastOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

type RemoveOwnerPreviewResponse = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  preflight: {
    selectedFunction: 'removeOwnerAtIndex' | 'removeLastOwner'
    selectedBy: 'heuristic' | 'simulation'
    targetOwnerIndex: number
    targetOwnerBytes: `0x${string}`
    targetOwnerAddress: `0x${string}` | null
    highestPopulatedOwnerIndex: number
    ownerCount: number
    nextOwnerIndex: number
    simulation: {
      ok: boolean
      error: string | null
      removeOwnerAtIndex: { ok: boolean; error: string | null }
      removeLastOwner: { ok: boolean; error: string | null }
    }
  }
}

function resolveBaseRpcUrl(): string {
  const envUrl = (process.env.BASE_RPC_URL ?? '').trim()
  return envUrl || 'https://mainnet.base.org'
}

function parseAddress(input: unknown): Address | null {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!isAddress(value)) return null
  return getAddress(value) as Address
}

function parseOwnerIndex(input: unknown): number | null {
  const parsed = Number(input)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function decodeOwnerBytesAddress(ownerBytes: Hex): Address | null {
  try {
    if ((ownerBytes.length - 2) / 2 !== 32) return null
    const [decoded] = decodeAbiParameters([{ type: 'address' }], ownerBytes)
    if (!isAddress(decoded)) return null
    const normalized = getAddress(decoded)
    if (normalized.toLowerCase() === '0x0000000000000000000000000000000000000000') return null
    return normalized as Address
  } catch {
    return null
  }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage
    if (typeof shortMessage === 'string' && shortMessage.trim()) return shortMessage
  }
  if (error instanceof Error) return error.message
  return String(error ?? 'unknown error')
}

async function simulateRemoveCall(params: {
  publicClient: ReturnType<typeof createPublicClient>
  cswAddress: Address
  data: Hex
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    await params.publicClient.call({
      to: params.cswAddress,
      account: params.cswAddress,
      data: params.data,
    })
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('onboarding-preview-remove-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: Record<string, unknown>
  try {
    body = (await readJsonBody(req, { maxBytes: PREVIEW_REMOVE_OWNER_BODY_MAX_BYTES })) as Record<string, unknown>
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const cswAddress = parseAddress(body.cswAddress)
  const connectedAddress = parseAddress(body.connectedAddress ?? body.connectedEoa)
  const ownerIndex = parseOwnerIndex(body.ownerIndex)
  if (!cswAddress || !connectedAddress || ownerIndex === null) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input. Expected { cswAddress, connectedAddress, ownerIndex }.',
    } satisfies ApiEnvelope<never>)
  }

  const connectedIsCswSelf = connectedAddress.toLowerCase() === cswAddress.toLowerCase()
  if (!connectedIsCswSelf) {
    let connectedIsOwner = false
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(resolveBaseRpcUrl()),
      })
      connectedIsOwner = await isOwnerOnChain(publicClient, cswAddress, connectedAddress)
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Could not verify connected owner on-chain: ${errorMessage(error)}`,
      } satisfies ApiEnvelope<never>)
    }
    if (!connectedIsOwner) {
      return res.status(403).json({
        success: false,
        error: 'Connected wallet is not an owner of this CSW.',
      } satisfies ApiEnvelope<never>)
    }
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveBaseRpcUrl()),
  })

  try {
    const [ownerCountRaw, nextOwnerIndexRaw] = await Promise.all([
      publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_ABI,
        functionName: 'ownerCount',
      }),
      publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_ABI,
        functionName: 'nextOwnerIndex',
      }),
    ])

    const ownerCount = Number(ownerCountRaw)
    const nextOwnerIndex = Number(nextOwnerIndexRaw)
    const scanLimit = Math.min(Math.max(nextOwnerIndex, ownerCount), 64)
    if (ownerIndex >= scanLimit) {
      return res.status(400).json({
        success: false,
        error: `ownerIndex ${ownerIndex} is out of range for scanLimit ${scanLimit}.`,
      } satisfies ApiEnvelope<never>)
    }

    let targetOwnerBytes: Hex = '0x'
    let highestPopulatedOwnerIndex = -1
    for (let idx = 0; idx < scanLimit; idx += 1) {
      const slotBytes = (await publicClient.readContract({
        address: cswAddress,
        abi: CSW_OWNER_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(idx)],
      })) as Hex
      if (slotBytes !== '0x') highestPopulatedOwnerIndex = idx
      if (idx === ownerIndex) targetOwnerBytes = slotBytes
    }

    if (targetOwnerBytes === '0x') {
      return res.status(400).json({
        success: false,
        error: `ownerIndex ${ownerIndex} is empty.`,
      } satisfies ApiEnvelope<never>)
    }

    const selectedByHeuristic: 'removeOwnerAtIndex' | 'removeLastOwner' =
      ownerIndex === highestPopulatedOwnerIndex ? 'removeLastOwner' : 'removeOwnerAtIndex'

    const removeOwnerAtIndexData = encodeFunctionData({
      abi: CSW_OWNER_ABI,
      functionName: 'removeOwnerAtIndex',
      args: [BigInt(ownerIndex), targetOwnerBytes],
    })
    const removeLastOwnerData = encodeFunctionData({
      abi: CSW_OWNER_ABI,
      functionName: 'removeLastOwner',
      args: [BigInt(ownerIndex), targetOwnerBytes],
    })

    const [removeOwnerAtIndexSimulation, removeLastOwnerSimulation] = await Promise.all([
      simulateRemoveCall({
        publicClient,
        cswAddress,
        data: removeOwnerAtIndexData,
      }),
      simulateRemoveCall({
        publicClient,
        cswAddress,
        data: removeLastOwnerData,
      }),
    ])

    let selectedFunction: 'removeOwnerAtIndex' | 'removeLastOwner' = selectedByHeuristic
    let selectedBy: 'heuristic' | 'simulation' = 'heuristic'
    if (!removeOwnerAtIndexSimulation.ok && removeLastOwnerSimulation.ok) {
      selectedFunction = 'removeLastOwner'
      selectedBy = 'simulation'
    } else if (removeOwnerAtIndexSimulation.ok && !removeLastOwnerSimulation.ok) {
      selectedFunction = 'removeOwnerAtIndex'
      selectedBy = 'simulation'
    }
    const data = selectedFunction === 'removeLastOwner' ? removeLastOwnerData : removeOwnerAtIndexData
    const selectedSimulation =
      selectedFunction === 'removeLastOwner' ? removeLastOwnerSimulation : removeOwnerAtIndexSimulation

    const response: RemoveOwnerPreviewResponse = {
      txRequest: {
        chainId: 8453,
        to: cswAddress,
        data,
        value: '0x0',
      },
      preflight: {
        selectedFunction,
        selectedBy,
        targetOwnerIndex: ownerIndex,
        targetOwnerBytes,
        targetOwnerAddress: decodeOwnerBytesAddress(targetOwnerBytes),
        highestPopulatedOwnerIndex,
        ownerCount,
        nextOwnerIndex,
        simulation: {
          ok: selectedSimulation.ok,
          error: selectedSimulation.error,
          removeOwnerAtIndex: removeOwnerAtIndexSimulation,
          removeLastOwner: removeLastOwnerSimulation,
        },
      },
    }

    return res.status(200).json({
      success: true,
      data: response,
    } satisfies ApiEnvelope<RemoveOwnerPreviewResponse>)
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Failed to preview owner removal: ${errorMessage(error)}`,
    } satisfies ApiEnvelope<never>)
  }
}

