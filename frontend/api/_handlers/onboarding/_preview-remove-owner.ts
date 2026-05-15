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
import { getRelayQuote } from '../../../server/_lib/relay/getQuote.js'

const PREVIEW_REMOVE_OWNER_BODY_MAX_BYTES = 8 * 1024

// RelayDepository on Base mainnet. Smart-wallet flows MUST call this directly
// (not via RelayRouterV3) because the router's user-transaction shape that
// /quote/v2 returns is the EOA path — it requires the caller to be an EOA and
// fails Base App's UserOp simulation. The May 5 owner[3] flow confirmed this:
// the working Part 1 was a CSW UserOp whose executeBatch called
// RelayDepository.depositNative(CSW, requestId) directly with value attached.
const RELAY_DEPOSITORY_BASE = '0x4cD00E387622C35bDDB9b4c962C136462338BC31' as const
const DEFAULT_RELAY_QUOTE_GAS_LIMIT = 250_000n
const RELAY_QUOTE_MIN_GAS_LIMIT = 80_000n
const RELAY_QUOTE_MIN_WEI = 1_000_000_000_000n

const RELAY_DEPOSITORY_ABI = [
  {
    type: 'function',
    name: 'depositNative',
    stateMutability: 'payable',
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'id', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

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

/**
 * One EIP-5792 call. Mirrors the shape passed to wallet_sendCalls.calls[].
 * All fields are 0x-prefixed hex; value is hex wei.
 */
type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

/**
 * The Relay-orchestrated submission spec. When present, the page submits the
 * single `userCall` via wallet_sendCalls; Relay's solver handles the actual
 * mutation execution from its own bundler. This re-creates the exact May 5
 * pattern: ONE user signature (Part 1 deposit), and Relay's pre-signed Part 2
 * lands in the same Base block, dispatched by Relay's solver bundler.
 */
type RelayFlow = {
  /** Relay's request id for this quote (status polling + diagnostics). */
  requestId: `0x${string}`
  /**
   * The single transaction the user must sign + submit. Goes to RelayRouterV3
   * (e.g. 0xb92fe925…fff4f on Base), which internally multicalls into
   * RelayDepository.depositNative(user, requestId) + cleanupNative. The user
   * never signs the destination mutation — Relay handles that off-chain.
   */
  userCall: Eip5792Call
  /** Relay's USD-decimal quoted fee, informational. */
  feeUsd: string | null
}

type RemoveOwnerPreviewResponse = {
  /**
   * Legacy single-call shape kept for backward compatibility. This is the
   * raw destination-call (Part 2) calldata; only useful for the funder-EOA
   * fallback lane where the page hand-builds the UserOp itself.
   */
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  /**
   * The EIP-5792 call array to pass to wallet_sendCalls. When `relay` is
   * present this is exactly one entry: the Relay-router deposit transaction.
   * Relay's solver runs the destination mutation behind the scenes. When the
   * Relay quote failed, this falls back to the raw mutation call (useful only
   * for the funder-EOA lane, which can't actually dispatch it without Relay).
   */
  calls: Eip5792Call[]
  /**
   * Relay quote metadata. Null when the upstream /quote call failed. The page
   * should surface the failure (no Relay-orchestrated lane available) and
   * offer the funder-EOA fallback (which itself depends on Relay being up).
   */
  relay: RelayFlow | null
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
    relayQuoteError: string | null
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

async function deriveRelayQuoteTxsGasLimit(params: {
  publicClient: any
  cswAddress: Address
  data: Hex
}): Promise<number> {
  try {
    const estimated = await params.publicClient.estimateGas({
      account: params.cswAddress,
      to: params.cswAddress,
      data: params.data,
      value: 0n,
    })
    const withBuffer = estimated + estimated / 2n
    const bounded =
      withBuffer < RELAY_QUOTE_MIN_GAS_LIMIT
        ? RELAY_QUOTE_MIN_GAS_LIMIT
        : withBuffer > DEFAULT_RELAY_QUOTE_GAS_LIMIT
          ? DEFAULT_RELAY_QUOTE_GAS_LIMIT
          : withBuffer
    return Number(bounded)
  } catch {
    return Number(DEFAULT_RELAY_QUOTE_GAS_LIMIT)
  }
}

async function simulateRemoveCall(params: {
  publicClient: any
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

    // ─────────────────────────────────────────────────────────────────────
    // RELAY QUOTE — single user transaction, two-part on-chain flow
    //
    // We ask Relay's /quote/v2 to orchestrate executing our mutation calldata
    // on Base. Relay returns ONE transaction the user must submit (a deposit
    // into RelayRouterV3, which multicalls RelayDepository.depositNative).
    // After that single tx lands, Relay's solver picks up the deposit event,
    // pre-signs and submits Part 2 (our destination mutation) from its own
    // bundler infrastructure, in the same block.
    //
    // Reference May 5 flow:
    //   Part 1 — tx 0x34edd28d…2aadf (CSW → router → depository, signed by CSW)
    //   Part 2 — tx 0xa9a06340…9a36 (Relay's solver bundler → EntryPoint →
    //                                   CSW.executeWithoutChainIdValidation,
    //                                   signed off-chain by session-key)
    // Both in block 45,600,637.
    //
    // If the quote fails (rate limit, Relay downtime, unsupported pair), we
    // still return a single-call response containing just the raw mutation
    // calldata so the page can fall back to the funder-EOA lane.
    // ─────────────────────────────────────────────────────────────────────
    let relay: RelayFlow | null = null
    let relayQuoteError: string | null = null
    try {
      // Relay should own the final fee math. We first request an exact quote
      // for zero destination output (owner mutation sends no value), then only
      // fall back to a seeded amount when Relay returns a zero-value user tx.
      const relayQuoteTxsGasLimit = await deriveRelayQuoteTxsGasLimit({
        publicClient,
        cswAddress,
        data,
      })
      const quoteParams = {
        user: cswAddress,
        recipient: cswAddress,
        originChainId: 8453,
        destinationChainId: 8453,
        tradeType: 'EXACT_OUTPUT' as const,
        txs: [
          {
            to: cswAddress,
            data,
            value: '0',
          },
        ],
        txsGasLimit: relayQuoteTxsGasLimit,
      }
      let quote = await getRelayQuote({
        ...quoteParams,
        amount: '0',
      })
      if (quote.ok) {
        const userValue = quote.extract.userTransaction?.value
        if (!userValue || !/^[1-9][0-9]*$/.test(userValue)) {
          // Keep fallback tiny and deterministic for test loops; we only need a
          // non-zero destination amount so Relay returns a non-zero user tx.
          const fallbackAmountWei = RELAY_QUOTE_MIN_WEI.toString(10)
          quote = await getRelayQuote({
            ...quoteParams,
            amount: fallbackAmountWei,
          })
        }
      }
      if (quote.ok) {
        const e = quote.extract
        if (e.requestId && e.userTransaction) {
          // Relay's /quote returns a router-targeted user transaction designed
          // for EOA submission. That path fails Base App's UserOp simulation
          // (the wallet shows "error generating transaction"). For CSW flows
          // we MUST call RelayDepository.depositNative directly instead, the
          // way the May 5 reference flow did it.
          //
          // We take the requestId from Relay's quote (so their solver can
          // still match the deposit event), use the value Relay quoted (so
          // their fee math is satisfied), and construct our own depositNative
          // calldata against the canonical depository address.
          const depositValueBig = BigInt(e.userTransaction.value)
          const depositNativeData = encodeFunctionData({
            abi: RELAY_DEPOSITORY_ABI,
            functionName: 'depositNative',
            args: [cswAddress, e.requestId],
          })
          relay = {
            requestId: e.requestId,
            userCall: {
              to: RELAY_DEPOSITORY_BASE,
              data: depositNativeData,
              value: `0x${depositValueBig.toString(16)}` as `0x${string}`,
            },
            feeUsd: e.feeUsd,
          }
        } else {
          relayQuoteError =
            'Relay quote returned no requestId or user transaction; cannot orchestrate the flow.'
        }
      } else {
        relayQuoteError = quote.error
      }
    } catch (error) {
      relayQuoteError = `Relay quote threw: ${errorMessage(error)}`
    }

    // Build the EIP-5792 calls array. When we have a working relay quote we
    // emit just the Relay-router deposit transaction; Relay's solver runs the
    // destination mutation off-chain. When the quote failed, fall back to the
    // raw mutation calldata so the funder-EOA lane can still proceed.
    const calls: Eip5792Call[] = relay
      ? [relay.userCall]
      : [
          {
            to: cswAddress,
            data,
            value: '0x0',
          },
        ]

    const response: RemoveOwnerPreviewResponse = {
      txRequest: {
        chainId: 8453,
        to: cswAddress,
        data,
        value: '0x0',
      },
      calls,
      relay,
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
        relayQuoteError,
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

