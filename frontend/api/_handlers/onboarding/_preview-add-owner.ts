import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  checkRateLimit,
  getClientIp,
  getDb,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readJsonBody,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '../../../packages/server-core/src/index.js'
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { isOwnerIfDeployed } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { prepareAddOwnerTx } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import { buildOwnerMutationRelayFlow } from '../../../server/_lib/relay/buildOwnerMutationRelayFlow.js'
import { resolveServerBaseRpcUrl } from '../../../server/_lib/onchain/baseRpcUrl.js'
import { simulateRelayDepositUserCall } from '../../../server/_lib/relay/simulateRelayDepositUserCall.js'
import { validateGoldenCswDepositoryPart1UserCall } from '../../../src/lib/relay/goldenRelayPart1Shape.js'
import { ADD_OWNER_ADDRESS_SELECTOR } from '../../../src/lib/wallet/cswOwnerAbi.js'
import { issueCustomOwnerSponsorshipToken } from '../../../server/_lib/paymaster/customOwnerSponsorshipToken.js'

const PREVIEW_ADD_OWNER_BODY_MAX_BYTES = 8 * 1024

type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

type RelayFlow = {
  requestId: `0x${string}`
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}`
    currency: `0x${string}`
    amount: string
  } | null
  userCall: Eip5792Call
  feeUsd: string | null
}

type AddOwnerPreviewResponse = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  calls: Eip5792Call[]
  relay: RelayFlow | null
  preflight: {
    ownerToAdd: `0x${string}`
    alreadyOwner: boolean
    simulation: {
      ok: boolean
      error: string | null
    }
    counterfactualSubAccount: boolean
    relayQuoteError: string | null
    relayDepositSimulation: {
      ok: boolean
      error: string | null
      funderBalanceWei: string
      depositWei: string
      gasBufferWei: string
    } | null
    relayQuoteDiagnostics: {
      requestId: `0x${string}` | null
      orderId: `0x${string}` | null
      paymentDetails: {
        chainId: number | null
        depository: `0x${string}` | null
        currency: `0x${string}` | null
        amount: string | null
      } | null
      userTransaction: {
        to: `0x${string}`
        value: string
        chainId: number
        dataSelector: string | null
      } | null
      feeUsd: string | null
      rawSnippet: string | null
    } | null
  }
  sponsorship?: {
    customOwnerPolicyToken: string
  }
}

type PreviewAddOwnerErrorEnvelope = ApiEnvelope<never> & {
  needsEmbeddedWallet?: boolean
  needsBaseAppSetup?: boolean
}

function parseAddress(input: unknown): Address | null {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!isAddress(value)) return null
  return getAddress(value) as Address
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage
    if (typeof shortMessage === 'string' && shortMessage.trim()) return shortMessage
  }
  if (error instanceof Error) return error.message
  return String(error ?? 'unknown error')
}

function resolveStatusCode(error: unknown): number {
  const flags = extractDelegationFlags(error)
  if (flags.needsBaseAppSetup || flags.needsEmbeddedWallet) return 409
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('missing privy auth token') ||
    lower.includes('invalid privy auth token') ||
    lower.includes('privy verification failed') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 401
  }
  if (lower.includes('not configured')) return 503
  return 500
}

async function simulateAddOwnerCall(params: {
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
    rateLimitKey('onboarding-preview-add-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let body: Record<string, unknown>
  try {
    body = (await readJsonBody(req, { maxBytes: PREVIEW_ADD_OWNER_BODY_MAX_BYTES })) as Record<string, unknown>
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const connectedAddress = parseAddress(body.connectedAddress ?? body.connectedEoa)
  if (!connectedAddress) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input. Expected { connectedAddress }.',
    } satisfies ApiEnvelope<never>)
  }
  const relayFundingCswHint = parseAddress(body.relayFundingCswAddress)

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const parentCswAddress = getAddress(bootstrap.canonicalCswAddress) as Address
    const targetOverride = parseAddress(body.targetCswAddress)

    let cswAddress = parentCswAddress
    if (targetOverride) {
      if (targetOverride.toLowerCase() === parentCswAddress.toLowerCase()) {
        cswAddress = targetOverride
      } else {
        const persistedSub = bootstrap.baseSubAccount.address?.trim()
        if (!persistedSub) {
          return res.status(403).json({
            success: false,
            error: 'Sub-account is not registered for this account.',
          } satisfies ApiEnvelope<never>)
        }
        const allowedSub = getAddress(persistedSub) as Address
        if (targetOverride.toLowerCase() !== allowedSub.toLowerCase()) {
          return res.status(403).json({
            success: false,
            error: 'targetCswAddress does not match the registered sub-account.',
          } satisfies ApiEnvelope<never>)
        }
        cswAddress = targetOverride
      }
    }

    const isSubAccountTarget = cswAddress.toLowerCase() !== parentCswAddress.toLowerCase()
    const ownerToAdd = getAddress(bootstrap.privyEmbeddedEoaAddress) as Address
    if (
      ownerToAdd.toLowerCase() === parentCswAddress.toLowerCase() ||
      ownerToAdd.toLowerCase() === cswAddress.toLowerCase()
    ) {
      return res.status(409).json({
        success: false,
        error: 'Owner install must target the Privy embedded EOA, not the Coinbase Smart Wallet.',
        needsEmbeddedWallet: true,
      } satisfies PreviewAddOwnerErrorEnvelope)
    }
    const rawTxRequest = prepareAddOwnerTx(cswAddress, ownerToAdd)
    const txRequest: AddOwnerPreviewResponse['txRequest'] = {
      chainId: 8453,
      to: cswAddress,
      data: rawTxRequest.data,
      value: '0x0',
    }
    if (txRequest.data.slice(0, 10).toLowerCase() !== ADD_OWNER_ADDRESS_SELECTOR) {
      return res.status(500).json({
        success: false,
        error: 'Prepared add-owner calldata has unexpected selector.',
      } satisfies ApiEnvelope<never>)
    }

    const connectedIsCswSelf = connectedAddress.toLowerCase() === cswAddress.toLowerCase()
    const connectedIsParentFundingSubAccount =
      isSubAccountTarget && connectedAddress.toLowerCase() === parentCswAddress.toLowerCase()
    const publicClient = createPublicClient({
      chain: base,
      transport: http(resolveServerBaseRpcUrl()),
    })
    if (!connectedIsCswSelf && !connectedIsParentFundingSubAccount) {
      const connectedIsOwner = await isOwnerIfDeployed(publicClient, cswAddress, connectedAddress)
      if (connectedIsOwner !== true) {
        return res.status(403).json({
          success: false,
          error: 'Connected wallet is not an owner of this CSW.',
        } satisfies ApiEnvelope<never>)
      }
    }

    if (bootstrap.privyIsOwner && !isSubAccountTarget) {
      const response: AddOwnerPreviewResponse = {
        txRequest,
        calls: [],
        relay: null,
        preflight: {
          ownerToAdd,
          alreadyOwner: true,
          simulation: { ok: true, error: null },
          relayQuoteError: null,
          relayDepositSimulation: null,
          relayQuoteDiagnostics: null,
          counterfactualSubAccount: false,
        },
      }
      return res.status(200).json({
        success: true,
        data: response,
      } satisfies ApiEnvelope<AddOwnerPreviewResponse>)
    }

    const alreadyOwnerState = isSubAccountTarget
      ? await isOwnerIfDeployed(publicClient, cswAddress, ownerToAdd)
      : bootstrap.privyIsOwner
        ? true
        : await isOwnerIfDeployed(publicClient, cswAddress, ownerToAdd)

    if (alreadyOwnerState === true) {
      const response: AddOwnerPreviewResponse = {
        txRequest,
        calls: [],
        relay: null,
        preflight: {
          ownerToAdd,
          alreadyOwner: true,
          simulation: { ok: true, error: null },
          relayQuoteError: null,
          relayDepositSimulation: null,
          relayQuoteDiagnostics: null,
          counterfactualSubAccount: false,
        },
      }
      return res.status(200).json({
        success: true,
        data: response,
      } satisfies ApiEnvelope<AddOwnerPreviewResponse>)
    }
    const subAccountBytecode = isSubAccountTarget
      ? await publicClient.getBytecode({ address: cswAddress }).catch(() => null)
      : null
    const counterfactualSubAccount =
      isSubAccountTarget && (subAccountBytecode == null || subAccountBytecode === '0x')

    const simulation = counterfactualSubAccount
      ? {
          ok: false,
          error: 'App wallet not deployed on Base Mainnet (no contract bytecode). Deploy the app wallet first.',
        }
      : await simulateAddOwnerCall({
          publicClient,
          cswAddress,
          data: txRequest.data,
        })

    let relay: RelayFlow | null = null
    let relayQuoteError: string | null = null
    let relayDepositSimulation: AddOwnerPreviewResponse['preflight']['relayDepositSimulation'] = null
    let relayQuoteDiagnostics: AddOwnerPreviewResponse['preflight']['relayQuoteDiagnostics'] = null
    const relayQuoteUser =
      relayFundingCswHint &&
      (relayFundingCswHint.toLowerCase() === parentCswAddress.toLowerCase() ||
        relayFundingCswHint.toLowerCase() === cswAddress.toLowerCase())
        ? relayFundingCswHint
        : connectedIsParentFundingSubAccount || isSubAccountTarget
          ? parentCswAddress
          : connectedIsCswSelf
            ? cswAddress
            : connectedAddress
    if (counterfactualSubAccount) {
      relayQuoteError =
        'App wallet is not deployed on Base Mainnet yet. In Base App, tap Deploy app wallet, approve the prompt, then rebuild Enable 4626 signing. Relay cannot addOwnerAddress until the app wallet has on-chain bytecode.'
    } else {
      const relayQuote = await buildOwnerMutationRelayFlow({
        publicClient,
        cswAddress,
        relayQuoteUser,
        mutationCalldata: txRequest.data,
        relayQuoteOutputWeiEnvKey: 'RELAY_ADD_OWNER_QUOTE_OUTPUT_WEI',
        relaySource: '4626-add-owner',
        requireDepositoryDepositNative: true,
      })
      relayQuoteDiagnostics = relayQuote.diagnostics
      if (relayQuote.ok) {
        relay = relayQuote.relay
        if (relay) {
          const goldenShapeError = validateGoldenCswDepositoryPart1UserCall({
            userCall: relay.userCall,
            fundingCsw: relayQuoteUser,
            orderId: relay.orderId ?? relay.requestId,
          })
          if (goldenShapeError) {
            relayQuoteError = `CSW Relay Part 1 must be native ETH Depository.depositNative only: ${goldenShapeError}`
            relay = null
          }
        }
        if (relay) {
          relayDepositSimulation = await simulateRelayDepositUserCall({
            publicClient,
            funderAddress: relayQuoteUser,
            userCall: relay.userCall,
          })
          if (!relayDepositSimulation.ok) {
            relayQuoteError = relayDepositSimulation.error
            relay = null
          }
        }
      } else {
        relayQuoteError = relayQuote.error
      }
    }

    // Relay-only lane: never fall back to bare CSW addOwnerAddress in `calls`.
    const calls: Eip5792Call[] = relay ? [relay.userCall] : []

    const principalAddress = parseAddress(readRequestPrincipalAddress(req, { lowercase: false }))
    const sponsorshipToken =
      relay && principalAddress
        ? issueCustomOwnerSponsorshipToken({
            sessionAddress: principalAddress,
            smartWalletAddress: (relayFundingCswHint ?? cswAddress) as `0x${string}`,
            ownerToAdd,
            profileId: bootstrap.profileId,
            ttlSeconds: 15 * 60,
          })
        : null

    const response: AddOwnerPreviewResponse = {
      txRequest,
      calls,
      relay,
      ...(sponsorshipToken ? { sponsorship: { customOwnerPolicyToken: sponsorshipToken } } : null),
      preflight: {
        ownerToAdd,
        alreadyOwner: false,
        simulation,
        counterfactualSubAccount,
        relayQuoteError,
        relayDepositSimulation,
        relayQuoteDiagnostics,
      },
    }

    return res.status(200).json({
      success: true,
      data: response,
    } satisfies ApiEnvelope<AddOwnerPreviewResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to preview owner install'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
