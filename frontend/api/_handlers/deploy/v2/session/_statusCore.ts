import type { VercelRequest, VercelResponse } from '@vercel/node'

import { decodeEventLog, decodeFunctionData, getAddress, isAddress, type Address, type Hex, type SignableMessage } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { toAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount } from 'viem/account-abstraction'

import { resolveDeploySessionRpcUrl } from './deploySessionRpc.js'
import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  checkRateLimit,
  RATE_LIMITS,
  rateLimitKey,
  isDbConfigured,
} from '@4626/server-core'
import { getDeploySessionById, signDeployToken, transitionDeploySession, updateDeploySession } from '../../../../../server/_lib/deploy/deploySessions.js'
import { getCanonicalOrigin } from '../../../../../server/_lib/infra/origin.js'
import { buildUserOpErrorDebug } from '../../../../../server/_lib/deploy/userOpRevertDebug.js'
import { secp256k1SignHash, walletRpc } from '../../../../../server/_lib/wallet/privyWalletApi.js'
import { parseGrant, validateCallsAgainstGrant } from '../../../../../server/_lib/deploy/erc7712Permissions.js'
import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'
import { DEFAULT_CHAIN_ID } from '../../../../../server/zora/_shared.js'
import {
  ensureLaunchImageReady,
  LAUNCH_IMAGE_PROJECT_ID_KEY,
  LAUNCH_IMAGE_READY_AT_KEY,
  LAUNCH_IMAGE_SHARE_OFT_KEY,
  LAUNCH_IMAGE_VAULT_KEY,
  LAUNCH_IMAGE_VERIFIED_AT_KEY,
  LAUNCH_IMAGE_VERIFIED_BYTES_KEY,
} from '../../../../../server/_lib/deploy/deployLaunchImage.js'
import { verifyDeployPhase2Invariants } from '../../../../../server/_lib/deploy/deployPhase2Invariants.js'
import { ingestShareOftIntoManagedTokenlist } from '../../../token/_managedTokenList.js'
import {
  ensureShareMeshOvaultPreflight,
  isLegacySolanaBridgePreflightEnabled,
} from '../../../../../server/_lib/deploy/solanaShareMeshPreflight.js'
import { readSolanaOvaultMintCompatibilityHintsFromEnv } from '../../../../../server/_lib/onchain/solanaOvaultCompatibility.js'
import { validateSponsoredSmartWalletCalls } from '../../../paymaster/_paymaster.js'
import { upsertAjnaVaultRegistryEntry } from '../../../../../server/_lib/ajnaVaultManager/registry.js'
import { DeploySessionAccessError, loadAuthorizedDeploySession, normalizeDeploySessionId } from './_sessionAccess.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StatusRequest = { sessionId: string }

const CONCURRENT_MODIFICATION = 'concurrent_modification'
const STAGE_USEROP_HASH_PREFIX = 'stageUserOpHash_'
const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const SOLANA_RESERVE_PERCENT_BPS = 3_000n
const BPS_DENOMINATOR = 10_000n
const SESSION_EXPIRED_RESTART_REQUIRED = 'session_expired_restart_required'
const SESSION_EXPIRED_AT_KEY = 'sessionExpiredAt'
const SESSION_EXPIRED_REASON_KEY = 'sessionExpiredReason'
const REPLAY_SKIP_PHASE2_CORE_AT_KEY = 'replaySkipPhase2CoreAt'
const REPLAY_SKIP_PHASE2_CORE_REASON_KEY = 'replaySkipPhase2CoreReason'
const REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY = 'replaySkipPhase2FinalizeAt'
const REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY = 'replaySkipPhase2FinalizeReason'
const PHASE3_AJNA_ADMIN_ALIGNMENT_KEY = 'phase3AjnaAdminAlignment'
const PHASE2_INVARIANT_GATE_KEY = 'phase2InvariantGate'
const PHASE2_INVARIANT_GATE_CHECKED_AT_KEY = 'phase2InvariantGateCheckedAt'
const PHASE2_FINALIZE_SENT_STEP = 'phase2_finalize_sent'
const PHASE2_FINALIZE_CONFIRMED_STEP = 'phase2_finalize_confirmed'

type Phase3AjnaAdminAlignment = {
  ajnaAuthAddress: Address | null
  expectedAjnaAuthAdmin: Address | null
  ajnaAuthAdmin: Address | null
  ajnaAuthAdminMatchesOwner: boolean | null
  ajnaStrategyAdapter?: Address | null
  ajnaInnerVault?: Address | null
  ajnaPool?: Address | null
  ajnaBufferRatioBps?: number | null
  ajnaMinBucketIndex?: number | null
}

type LaunchImageStatus = {
  projectId: string | null
  shareOft: Address | null
  vaultAddress: Address | null
  readyAt: string | null
  verifiedAt: string | null
  verifiedBytes: number | null
}

function isSessionExpired(expiresAt: unknown): boolean {
  if (typeof expiresAt !== 'string') return false
  const expiresMs = Date.parse(expiresAt)
  return Number.isFinite(expiresMs) && expiresMs <= Date.now()
}

function readPayloadObjectSafe(value: unknown): Record<string, any> {
  try {
    return asPayloadObject(value)
  } catch {
    return {}
  }
}

function readPhase3AjnaAdminAlignment(value: unknown): Phase3AjnaAdminAlignment {
  const payload = readPayloadObjectSafe(value)
  const raw = isPlainObject(payload?.[PHASE3_AJNA_ADMIN_ALIGNMENT_KEY]) ? payload[PHASE3_AJNA_ADMIN_ALIGNMENT_KEY] : {}
  const ajnaAuthAddress = normalizeAddress(raw?.ajnaAuthAddress)
  const expectedAjnaAuthAdmin = normalizeAddress(raw?.expectedAjnaAuthAdmin)
  const ajnaAuthAdmin = normalizeAddress(raw?.ajnaAuthAdmin)
  const ajnaAuthAdminMatchesOwner =
    typeof raw?.ajnaAuthAdminMatchesOwner === 'boolean' ? raw.ajnaAuthAdminMatchesOwner : null
  const ajnaStrategyAdapter = normalizeAddress(raw?.ajnaStrategyAdapter)
  const ajnaInnerVault = normalizeAddress(raw?.ajnaInnerVault)
  const ajnaPool = normalizeAddress(raw?.ajnaPool)
  const ajnaBufferRatioRaw = Number(raw?.ajnaBufferRatioBps)
  const ajnaBufferRatioBps =
    Number.isFinite(ajnaBufferRatioRaw) && ajnaBufferRatioRaw >= 0 ? Math.trunc(ajnaBufferRatioRaw) : null
  const ajnaMinBucketRaw = Number(raw?.ajnaMinBucketIndex)
  const ajnaMinBucketIndex =
    Number.isFinite(ajnaMinBucketRaw) && ajnaMinBucketRaw >= 0 ? Math.trunc(ajnaMinBucketRaw) : null
  const base: Phase3AjnaAdminAlignment = {
    ajnaAuthAddress,
    expectedAjnaAuthAdmin,
    ajnaAuthAdmin,
    ajnaAuthAdminMatchesOwner,
  }
  if (ajnaStrategyAdapter) base.ajnaStrategyAdapter = ajnaStrategyAdapter
  if (ajnaInnerVault) base.ajnaInnerVault = ajnaInnerVault
  if (ajnaPool) base.ajnaPool = ajnaPool
  if (ajnaBufferRatioBps !== null) base.ajnaBufferRatioBps = ajnaBufferRatioBps
  if (ajnaMinBucketIndex !== null) base.ajnaMinBucketIndex = ajnaMinBucketIndex
  return base
}

function readLaunchImageStatus(value: unknown): LaunchImageStatus {
  const payload = readPayloadObjectSafe(value)
  const projectId =
    typeof payload?.[LAUNCH_IMAGE_PROJECT_ID_KEY] === 'string' && payload[LAUNCH_IMAGE_PROJECT_ID_KEY].trim()
      ? String(payload[LAUNCH_IMAGE_PROJECT_ID_KEY]).trim()
      : null
  const shareOft = normalizeAddress(payload?.[LAUNCH_IMAGE_SHARE_OFT_KEY])
  const vaultAddress = normalizeAddress(payload?.[LAUNCH_IMAGE_VAULT_KEY])
  const readyAt =
    typeof payload?.[LAUNCH_IMAGE_READY_AT_KEY] === 'string' && payload[LAUNCH_IMAGE_READY_AT_KEY].trim()
      ? String(payload[LAUNCH_IMAGE_READY_AT_KEY]).trim()
      : null
  const verifiedAt =
    typeof payload?.[LAUNCH_IMAGE_VERIFIED_AT_KEY] === 'string' && payload[LAUNCH_IMAGE_VERIFIED_AT_KEY].trim()
      ? String(payload[LAUNCH_IMAGE_VERIFIED_AT_KEY]).trim()
      : null
  const verifiedBytesRaw = payload?.[LAUNCH_IMAGE_VERIFIED_BYTES_KEY]
  const verifiedBytes =
    typeof verifiedBytesRaw === 'number' && Number.isFinite(verifiedBytesRaw) && verifiedBytesRaw >= 0
      ? Math.trunc(verifiedBytesRaw)
      : null
  return {
    projectId,
    shareOft,
    vaultAddress,
    readyAt,
    verifiedAt,
    verifiedBytes,
  }
}

function buildSessionDiagnostics(rec: any): {
  category: 'ok' | 'expired' | 'grant_expired' | 'session_signer_unavailable' | 'onchain_revert' | 'other_error'
  restartRequired: boolean
  expired: boolean
  replay: {
    phase2CoreSkipRecorded: boolean
    phase2CoreSkipAt: string | null
    phase2CoreSkipReason: string | null
    phase2FinalizeSkipRecorded: boolean
    phase2FinalizeSkipAt: string | null
    phase2FinalizeSkipReason: string | null
    phase2CoreSentWithoutStageHash: boolean
    phase2FinalizeSentWithoutStageHash: boolean
  }
} {
  const step = String(rec?.step ?? '')
  const payload = readPayloadObjectSafe(rec?.payload)
  const lastError = typeof rec?.lastError === 'string' ? rec.lastError : ''
  const lastErrorLower = lastError.toLowerCase()
  const expirationRelevant = step !== 'completed' && step !== 'cancelled'
  const expired = expirationRelevant && isSessionExpired(rec?.expiresAt)
  const phase2CoreSkipAt =
    typeof payload?.[REPLAY_SKIP_PHASE2_CORE_AT_KEY] === 'string' && payload[REPLAY_SKIP_PHASE2_CORE_AT_KEY].trim()
      ? String(payload[REPLAY_SKIP_PHASE2_CORE_AT_KEY]).trim()
      : null
  const phase2CoreSkipReason =
    typeof payload?.[REPLAY_SKIP_PHASE2_CORE_REASON_KEY] === 'string' && payload[REPLAY_SKIP_PHASE2_CORE_REASON_KEY].trim()
      ? String(payload[REPLAY_SKIP_PHASE2_CORE_REASON_KEY]).trim()
      : null
  const phase2FinalizeSkipAt =
    typeof payload?.[REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY] === 'string' &&
    payload[REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY].trim()
      ? String(payload[REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY]).trim()
      : null
  const phase2FinalizeSkipReason =
    typeof payload?.[REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY] === 'string' &&
    payload[REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY].trim()
      ? String(payload[REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY]).trim()
      : null
  const phase2CoreSentWithoutStageHash =
    step === 'phase2_core_sent' && !asHexHash(payload?.[stageUserOpHashKey('phase2_core_sent')])
  const phase2FinalizeSentWithoutStageHash =
    (step === PHASE2_FINALIZE_SENT_STEP || step === 'phase2_sent') &&
    !asHexHash(
      payload?.[stageUserOpHashKey(PHASE2_FINALIZE_SENT_STEP)] ?? payload?.[stageUserOpHashKey('phase2_sent')],
    )

  let category: 'ok' | 'expired' | 'grant_expired' | 'session_signer_unavailable' | 'onchain_revert' | 'other_error' =
    'ok'
  if (lastErrorLower.includes(SESSION_EXPIRED_RESTART_REQUIRED) || expired) {
    category = 'expired'
  } else if (lastErrorLower.includes('erc7712_expired')) {
    category = 'grant_expired'
  } else if (
    lastErrorLower.includes('deploy_signer_wallet_unavailable') ||
    lastErrorLower.includes('session_signer_unavailable') ||
    lastErrorLower.includes('session_signer_key_missing') ||
    lastErrorLower.includes('session_owner_unavailable') ||
    lastErrorLower.includes('session_owner_key_missing')
  ) {
    category = 'session_signer_unavailable'
  } else if (lastError && isOnchainRevertLike(lastError)) {
    category = 'onchain_revert'
  } else if (lastError) {
    category = 'other_error'
  }

  const restartRequired = category === 'expired' || category === 'grant_expired'

  return {
    category,
    restartRequired,
    expired: category === 'expired',
    replay: {
      phase2CoreSkipRecorded: Boolean(phase2CoreSkipAt),
      phase2CoreSkipAt,
      phase2CoreSkipReason,
      phase2FinalizeSkipRecorded: Boolean(phase2FinalizeSkipAt),
      phase2FinalizeSkipAt,
      phase2FinalizeSkipReason,
      phase2CoreSentWithoutStageHash,
      phase2FinalizeSentWithoutStageHash,
    },
  }
}

function stageUserOpHashKey(step: string): string {
  const normalized = step === 'phase2_sent' ? PHASE2_FINALIZE_SENT_STEP : step
  return `${STAGE_USEROP_HASH_PREFIX}${normalized}`
}

function asHexHash(value: unknown): Hex | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{64}$/.test(raw) ? (raw as Hex) : null
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function asPayloadObject(value: unknown): Record<string, any> {
  if (isPlainObject(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (isPlainObject(parsed)) return parsed
    } catch {
      // ignore malformed payload strings
    }
  }
  throw new Error('deploy_payload_invalid')
}

function isTruthyEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

function shouldPersistManagedSessionOwner(): boolean {
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, false)
}

function shouldRequireInlineMeteoraPayload(): boolean {
  return isTruthyEnv(process.env.DEPLOY_SOLANA_REQUIRE_INLINE_METEORA_PAYLOAD, false)
}

function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('.vercel.app')
  } catch {
    return true
  }
}

function getBundlerEndpoint(origin: string): { url: string; viaProxy: boolean } {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  if (direct) return { url: direct, viaProxy: false }

  // On Vercel previews/production, same-origin /api/paymaster can be protected and fail
  // with HTML auth responses for server-to-server calls. Require direct CDP config instead.
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  if (isVercelEnv && isVercelDeploymentOrigin(origin)) {
    throw new Error('cdp_endpoint_missing_on_vercel')
  }

  return { url: `${origin}/api/paymaster`, viaProxy: true }
}

function isOnchainRevertLike(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('execution reverted') ||
    m.includes('user operation execution failed') ||
    m.includes('useroperationexecutionerror') ||
    m.includes('aa23 reverted') ||
    m.includes('aa33 reverted')
  )
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

const CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI = [
  {
    type: 'function',
    name: 'solanaBridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'solanaDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getOVaultRuntimeConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'hubComposer', type: 'address' },
          { name: 'solanaEid', type: 'uint32' },
          { name: 'enabled', type: 'bool' },
        ],
      },
    ],
  },
] as const

const SOLANA_BRIDGE_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const OWNABLE_OWNER_VIEW_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI = [
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

const CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI = [
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

const CREATOR_VAULT_BATCHER_DEPLOY_PHASE3_STRATEGIES_ABI = [
  {
    type: 'function',
    name: 'deployPhase3Strategies',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'initialSqrtPriceX96', type: 'uint160' },
          { name: 'charmVaultName', type: 'string' },
          { name: 'charmVaultSymbol', type: 'string' },
          { name: 'ajnaVaultName', type: 'string' },
          { name: 'ajnaVaultSymbol', type: 'string' },
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'solanaWeightBps', type: 'uint256' },
          { name: 'ajnaBufferRatioBps', type: 'uint256' },
          { name: 'ajnaMinBucketIndex', type: 'uint256' },
          { name: 'ajnaKeeper', type: 'address' },
          { name: 'solanaKeeper', type: 'address' },
          { name: 'solanaMaxNavAge', type: 'uint64' },
          { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
          { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
          { name: 'solanaBridgeAddress', type: 'address' },
          { name: 'enableAutoAllocate', type: 'bool' },
          { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaVaultAuth', type: 'bytes32' },
          { name: 'ajnaVault', type: 'bytes32' },
          { name: 'erc4626StrategyAdapter', type: 'bytes32' },
          { name: 'solanaStrategy', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const CREATOR_VAULT_BATCHER_LAUNCH_DEFERRED_AUCTION_ABI = [
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

const CREATOR_VAULT_BATCHER_PHASE3_VIEW_ABI = [
  {
    type: 'function',
    name: 'uniswapV3Factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'usdc',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const UNISWAP_V3_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_OVAULT_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'strategyList',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'strategyWeights',
    stateMutability: 'view',
    inputs: [{ name: 'strategy', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CREATOR_OVAULT_RUNTIME_CONFIG_ABI = [
  {
    type: 'function',
    name: 'setMinimumTotalIdle',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployToStrategies',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const CREATOR_OVAULT_RUNTIME_VIEW_ABI = [
  {
    type: 'function',
    name: 'minimumTotalIdle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CREATOR_CHARM_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'charmVault',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const ERC4626_STRATEGY_ADAPTER_VIEW_ABI = [
  {
    type: 'function',
    name: 'ERC4626_VAULT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const AJNA_INNER_VAULT_VIEW_ABI = [
  {
    type: 'function',
    name: 'AJNA_POOL',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'AUTH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const AJNA_AUTH_VIEW_ABI = [
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'bufferRatio',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'minBucketIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const SOLANA_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'bridgeAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'bridgeAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CCA_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'currentAuction',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ccaFactory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CONTINUOUS_CCA_VIEW_ABI = [
  {
    type: 'function',
    name: 'isGraduated',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint128' }],
  },
] as const

const ERC20_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CREATOR_VAULT_BATCHER_AUCTION_LAUNCHED_EVENT_ABI = [
  {
    type: 'event',
    name: 'AuctionLaunchedDeferred',
    inputs: [
      { indexed: true, name: 'creatorToken', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'shareOFT', type: 'address' },
      { indexed: false, name: 'ccaStrategy', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'auction', type: 'address' },
    ],
  },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 512 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  let upperBound = Number.isFinite(count) ? count : 0
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = Math.max(upperBound, next)
  } catch {
    // ignore: not all contract versions expose nextOwnerIndex
  }
  if (!Number.isFinite(upperBound) || upperBound <= 0) return null

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    let b: Hex
    try {
      b = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as Hex
    } catch {
      continue
    }
    if (String(b).toLowerCase() === expected) return i
  }
  return null
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

function parseConfiguredOrigin(value: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function readAdditionalSolanaRegistrationOrigins(): string[] {
  const raw =
    String(process.env.DEPLOY_SOLANA_REGISTRATION_ORIGINS ?? '').trim() ||
    String(process.env.SOLANA_REGISTRATION_ORIGINS ?? '').trim()
  if (!raw) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw.split(/[,\s]+/)) {
    const origin = parseConfiguredOrigin(entry)
    if (!origin) continue
    const key = origin.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(origin)
  }
  return out
}

type SolanaPreflightRoutePath = '/api/deploy/registerSolanaBridgeToken'
const SOLANA_PREFLIGHT_ROUTE_PATH: SolanaPreflightRoutePath = '/api/deploy/registerSolanaBridgeToken'

function dedupeOrigins(origins: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const origin of origins) {
    const key = origin.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(origin)
  }
  return out
}

function parseBigIntLike(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value >= 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return BigInt(Math.trunc(value))
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = BigInt(value.trim())
      return parsed >= 0n ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function isBytes32Hex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const addr = getAddress(value as Address)
  return addr.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : addr
}

function extractFinalizePhase2Info(data: Hex): {
  creatorToken: Address | null
  depositAmount: bigint | null
  owner: Address | null
  vault: Address | null
  gaugeController: Address | null
  ccaStrategy: Address | null
  oracle: Address | null
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        depositAmount?: bigint | string | number
        owner?: string
        vault?: string
        gaugeController?: string
        ccaStrategy?: string
        oracle?: string
      } | null
      const creatorTokenCandidate = params?.creatorToken && isAddress(params.creatorToken)
        ? getAddress(params.creatorToken as Address)
        : null
      const creatorToken =
        creatorTokenCandidate && creatorTokenCandidate.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
          ? creatorTokenCandidate
          : null
      if (!creatorToken) continue
      return {
        creatorToken,
        depositAmount: parseBigIntLike(params?.depositAmount),
        owner: normalizeAddress(params?.owner),
        vault: normalizeAddress(params?.vault),
        gaugeController: normalizeAddress(params?.gaugeController),
        ccaStrategy: normalizeAddress(params?.ccaStrategy),
        oracle: normalizeAddress(params?.oracle),
      }
    } catch {
      continue
    }
  }
  return null
}

function findFinalizePhase2Entry(calls: Array<{ to: Address; value: bigint; data: Hex }>): {
  call: { to: Address; value: bigint; data: Hex }
  info: NonNullable<ReturnType<typeof extractFinalizePhase2Info>>
} | null {
  for (const call of calls) {
    const info = extractFinalizePhase2Info(call.data)
    if (info?.creatorToken) return { call, info }
  }
  return null
}

function isOvaultRequestEnabled(value: unknown): boolean {
  return isPlainObject(value) && value.enabled === true
}

function isOvaultRuntimeConfigured(value: unknown): boolean {
  const tuple = Array.isArray(value) ? value : null
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const hubComposer =
    typeof obj?.hubComposer === 'string'
      ? obj.hubComposer
      : tuple && typeof tuple[0] === 'string'
        ? tuple[0]
        : ''
  const solanaEid =
    typeof obj?.solanaEid === 'number'
      ? obj.solanaEid
      : typeof obj?.solanaEid === 'bigint'
        ? Number(obj.solanaEid)
        : tuple && typeof tuple[1] === 'number'
          ? tuple[1]
          : tuple && typeof tuple[1] === 'bigint'
            ? Number(tuple[1])
            : 0
  const enabled =
    typeof obj?.enabled === 'boolean'
      ? obj.enabled
      : tuple && typeof tuple[2] === 'boolean'
        ? tuple[2]
        : false
  return (
    enabled === true &&
    typeof hubComposer === 'string' &&
    isAddress(hubComposer) &&
    getAddress(hubComposer as Address).toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    Number(solanaEid) > 0
  )
}

async function hasRuntimeCode(publicClient: any, address: Address | null): Promise<boolean> {
  if (!address) return false
  const getBytecode = publicClient?.getBytecode
  if (typeof getBytecode !== 'function') return false
  try {
    const bytecode = await getBytecode.call(publicClient, { address })
    return typeof bytecode === 'string' && bytecode !== '0x'
  } catch {
    return false
  }
}

async function readOwnableOwner(publicClient: any, address: Address | null): Promise<Address | null> {
  if (!address) return null
  try {
    const ownerRaw = await publicClient.readContract({
      address,
      abi: OWNABLE_OWNER_VIEW_ABI,
      functionName: 'owner',
    })
    if (typeof ownerRaw !== 'string' || !isAddress(ownerRaw)) return null
    const owner = getAddress(ownerRaw as Address)
    return owner.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : owner
  } catch {
    return null
  }
}

async function readPhase2ReplayState(params: {
  publicClient: any
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
}): Promise<{
  phase2CoreAlreadyDeployed: boolean
  phase2FinalizeAlreadyCompleted: boolean
}> {
  const finalizeCall = params.phase2FinalizeCalls[0]
  if (!finalizeCall) {
    return {
      phase2CoreAlreadyDeployed: false,
      phase2FinalizeAlreadyCompleted: false,
    }
  }
  const finalizeInfo = extractFinalizePhase2Info(finalizeCall.data)
  if (!finalizeInfo) {
    return {
      phase2CoreAlreadyDeployed: false,
      phase2FinalizeAlreadyCompleted: false,
    }
  }

  const [gaugeDeployed, ccaDeployed, oracleDeployed, vaultOwner] = await Promise.all([
    hasRuntimeCode(params.publicClient, finalizeInfo.gaugeController),
    hasRuntimeCode(params.publicClient, finalizeInfo.ccaStrategy),
    hasRuntimeCode(params.publicClient, finalizeInfo.oracle),
    readOwnableOwner(params.publicClient, finalizeInfo.vault),
  ])

  const phase2CoreAlreadyDeployed = gaugeDeployed && ccaDeployed && oracleDeployed
  const phase2FinalizeAlreadyCompleted =
    Boolean(finalizeInfo.owner) &&
    Boolean(vaultOwner) &&
    String(finalizeInfo.owner).toLowerCase() === String(vaultOwner).toLowerCase()

  return {
    phase2CoreAlreadyDeployed,
    phase2FinalizeAlreadyCompleted,
  }
}

function extractPhase3DeployInfo(calls: Array<{ to: Address; value: bigint; data: Hex }>): {
  batcher: Address
  creatorToken: Address
  owner: Address
  vault: Address
  charmWeightBps: bigint
  ajnaWeightBps: bigint
  solanaWeightBps: bigint
} | null {
  for (const call of calls) {
    try {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_DEPLOY_PHASE3_STRATEGIES_ABI,
        data: call.data,
      })
      if (decoded.functionName !== 'deployPhase3Strategies') continue
      const params = (decoded.args?.[0] ?? null) as
        | {
            creatorToken?: unknown
            owner?: unknown
            vault?: unknown
            charmWeightBps?: unknown
            ajnaWeightBps?: unknown
            solanaWeightBps?: unknown
          }
        | null
      const creatorToken = normalizeAddress(params?.creatorToken)
      const owner = normalizeAddress(params?.owner)
      const vault = normalizeAddress(params?.vault)
      const charmWeightBps = parseBigIntLike(params?.charmWeightBps)
      const ajnaWeightBps = parseBigIntLike(params?.ajnaWeightBps)
      const solanaWeightBps = parseBigIntLike(params?.solanaWeightBps) ?? 0n
      if (!creatorToken || !owner || !vault || charmWeightBps == null || ajnaWeightBps == null) continue
      return {
        batcher: call.to,
        creatorToken,
        owner,
        vault,
        charmWeightBps,
        ajnaWeightBps,
        solanaWeightBps,
      }
    } catch {
      continue
    }
  }
  return null
}

function extractPhase3RuntimeExpectations(params: {
  calls: Array<{ to: Address; value: bigint; data: Hex }>
  vault: Address
}): {
  expectedMinimumTotalIdle: bigint | null
  sawMinimumTotalIdleCall: boolean
  sawDeployToStrategiesCall: boolean
} {
  let expectedMinimumTotalIdle: bigint | null = null
  let sawMinimumTotalIdleCall = false
  let sawDeployToStrategiesCall = false

  for (const call of params.calls) {
    if (call.to.toLowerCase() !== params.vault.toLowerCase()) continue
    try {
      const decoded = decodeFunctionData({
        abi: CREATOR_OVAULT_RUNTIME_CONFIG_ABI,
        data: call.data,
      })
      if (decoded.functionName === 'setMinimumTotalIdle') {
        sawMinimumTotalIdleCall = true
        const parsed = parseBigIntLike(decoded.args?.[0])
        if (parsed != null) {
          expectedMinimumTotalIdle = parsed
        }
        continue
      }
      if (decoded.functionName === 'deployToStrategies') {
        sawDeployToStrategiesCall = true
      }
    } catch {
      continue
    }
  }

  return { expectedMinimumTotalIdle, sawMinimumTotalIdleCall, sawDeployToStrategiesCall }
}

function extractPhase4LaunchInfo(calls: Array<{ to: Address; value: bigint; data: Hex }>): {
  batcher: Address
  creatorToken: Address
  owner: Address
  shareOFT: Address
} | null {
  for (const call of calls) {
    try {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_LAUNCH_DEFERRED_AUCTION_ABI,
        data: call.data,
      })
      if (decoded.functionName !== 'launchDeferredAuction') continue
      const params = (decoded.args?.[0] ?? null) as
        | {
            creatorToken?: unknown
            owner?: unknown
            shareOFT?: unknown
          }
        | null
      const creatorToken = normalizeAddress(params?.creatorToken)
      const owner = normalizeAddress(params?.owner)
      const shareOFT = normalizeAddress(params?.shareOFT)
      if (!creatorToken || !owner || !shareOFT) continue
      return {
        batcher: call.to,
        creatorToken,
        owner,
        shareOFT,
      }
    } catch {
      continue
    }
  }
  return null
}

async function readVaultActiveStrategies(params: {
  publicClient: any
  vault: Address
  maxScan?: number
}): Promise<Array<{ strategy: Address; weight: bigint }>> {
  const out: Array<{ strategy: Address; weight: bigint }> = []
  const seen = new Set<string>()
  const maxScan = Number.isFinite(params.maxScan as number) ? Math.max(1, Number(params.maxScan)) : 6
  for (let i = 0; i < maxScan; i++) {
    const strategyRaw = await params.publicClient
      .readContract({
        address: params.vault,
        abi: CREATOR_OVAULT_STRATEGY_VIEW_ABI,
        functionName: 'strategyList',
        args: [BigInt(i)],
      })
      .catch(() => null)
    const strategy = normalizeAddress(strategyRaw)
    if (!strategy) break
    const key = strategy.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const weightRaw = await params.publicClient
      .readContract({
        address: params.vault,
        abi: CREATOR_OVAULT_STRATEGY_VIEW_ABI,
        functionName: 'strategyWeights',
        args: [strategy],
      })
      .catch(() => 0n)
    const weight = parseBigIntLike(weightRaw) ?? 0n
    if (weight > 0n) out.push({ strategy, weight })
  }
  return out
}

async function readCharmVaultAddress(params: {
  publicClient: any
  strategy: Address
}): Promise<Address | null> {
  const charmVaultRaw = await params.publicClient
    .readContract({
      address: params.strategy,
      abi: CREATOR_CHARM_STRATEGY_VIEW_ABI,
      functionName: 'charmVault',
    })
    .catch(() => null)
  return normalizeAddress(charmVaultRaw)
}

async function readNestedAjnaDetails(params: {
  publicClient: any
  strategy: Address
}): Promise<{ ajnaPool: Address | null; innerVault: Address | null; auth: Address | null }> {
  const innerVaultRaw = await params.publicClient
    .readContract({
      address: params.strategy,
      abi: ERC4626_STRATEGY_ADAPTER_VIEW_ABI,
      functionName: 'ERC4626_VAULT',
    })
    .catch(() => null)
  const innerVault = normalizeAddress(innerVaultRaw)
  if (!innerVault) {
    return { ajnaPool: null, innerVault: null, auth: null }
  }

  const [innerAjnaPoolRaw, authRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: innerVault,
        abi: AJNA_INNER_VAULT_VIEW_ABI,
        functionName: 'AJNA_POOL',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: innerVault,
        abi: AJNA_INNER_VAULT_VIEW_ABI,
        functionName: 'AUTH',
      })
      .catch(() => null),
  ])

  return {
    ajnaPool: normalizeAddress(innerAjnaPoolRaw),
    innerVault,
    auth: normalizeAddress(authRaw),
  }
}

async function readSolanaBridgeAddress(params: {
  publicClient: any
  strategy: Address
}): Promise<Address | null> {
  const bridgeAddressRaw = await params.publicClient
    .readContract({
      address: params.strategy,
      abi: SOLANA_STRATEGY_VIEW_ABI,
      functionName: 'bridgeAddress',
    })
    .catch(() => null)
  return normalizeAddress(bridgeAddressRaw)
}

async function verifyPhase3PostState(params: {
  publicClient: any
  phase3Calls: Array<{ to: Address; value: bigint; data: Hex }>
}): Promise<Phase3AjnaAdminAlignment> {
  const info = extractPhase3DeployInfo(params.phase3Calls)
  if (!info) {
    throw new Error('phase3 verification failed: phase3Calls missing deployPhase3Strategies')
  }

  if (!(await hasRuntimeCode(params.publicClient, info.vault))) {
    throw new Error(`phase3 verification failed: vault code missing at ${info.vault}`)
  }

  const [v3FactoryRaw, usdcRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: info.batcher,
        abi: CREATOR_VAULT_BATCHER_PHASE3_VIEW_ABI,
        functionName: 'uniswapV3Factory',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: info.batcher,
        abi: CREATOR_VAULT_BATCHER_PHASE3_VIEW_ABI,
        functionName: 'usdc',
      })
      .catch(() => null),
  ])
  const v3Factory = normalizeAddress(v3FactoryRaw)
  const usdc = normalizeAddress(usdcRaw)
  if (!v3Factory || !usdc) {
    throw new Error('phase3 verification failed: batcher v3 config is missing')
  }

  const v3PoolRaw = await params.publicClient
    .readContract({
      address: v3Factory,
      abi: UNISWAP_V3_FACTORY_VIEW_ABI,
      functionName: 'getPool',
      args: [info.creatorToken, usdc, 3000],
    })
    .catch(() => null)
  const v3Pool = normalizeAddress(v3PoolRaw)
  if (!v3Pool || !(await hasRuntimeCode(params.publicClient, v3Pool))) {
    throw new Error('phase3 verification failed: CREATOR/USDC v3 pool missing')
  }

  if (info.charmWeightBps <= 0n || info.ajnaWeightBps <= 0n || info.solanaWeightBps <= 0n) {
    throw new Error('phase3 verification failed: canonical launch requires non-zero Charm/Ajna/Solana weights')
  }
  const expectedTotalWeight = info.charmWeightBps + info.ajnaWeightBps + info.solanaWeightBps
  if (expectedTotalWeight >= BPS_DENOMINATOR) {
    throw new Error('phase3 verification failed: strategy weight sum must leave idle reserve')
  }

  const expectedStrategyCount =
    (info.charmWeightBps > 0n ? 1 : 0) + (info.ajnaWeightBps > 0n ? 1 : 0) + (info.solanaWeightBps > 0n ? 1 : 0)

  const strategies = await readVaultActiveStrategies({
    publicClient: params.publicClient,
    vault: info.vault,
    maxScan: 8,
  })
  if (strategies.length === 0) {
    throw new Error('phase3 verification failed: no active strategies found on vault')
  }
  if (strategies.length !== expectedStrategyCount) {
    throw new Error(
      `phase3 verification failed: unexpected active strategy count ${strategies.length} (expected ${expectedStrategyCount})`,
    )
  }
  const observedTotalWeight = strategies.reduce((sum, entry) => sum + entry.weight, 0n)
  if (observedTotalWeight !== expectedTotalWeight) {
    throw new Error(
      `phase3 verification failed: total strategy weight ${observedTotalWeight.toString()} does not match expected ${expectedTotalWeight.toString()}`,
    )
  }

  const strategyDetails = await Promise.all(
    strategies.map(async (entry) => ({
      ...entry,
      charmVault: await readCharmVaultAddress({ publicClient: params.publicClient, strategy: entry.strategy }),
      ajna: await readNestedAjnaDetails({ publicClient: params.publicClient, strategy: entry.strategy }),
      bridgeAddress: await readSolanaBridgeAddress({ publicClient: params.publicClient, strategy: entry.strategy }),
    })),
  )
  let charm: (typeof strategyDetails)[number] | undefined
  if (info.charmWeightBps > 0n) {
    charm = strategyDetails.find((entry) => Boolean(entry.charmVault))
    if (!charm) {
      throw new Error('phase3 verification failed: charm strategy not registered on vault')
    }
    if (charm.weight !== info.charmWeightBps) {
      throw new Error(
        `phase3 verification failed: charm strategy weight ${charm.weight.toString()} does not match expected ${info.charmWeightBps.toString()}`,
      )
    }
    if (!(await hasRuntimeCode(params.publicClient, charm.strategy))) {
      throw new Error(`phase3 verification failed: charm strategy code missing at ${charm.strategy}`)
    }
    if (!(await hasRuntimeCode(params.publicClient, charm.charmVault ?? null))) {
      throw new Error(`phase3 verification failed: charm vault code missing at ${String(charm.charmVault ?? '')}`)
    }
  }

  const remaining = charm
    ? strategyDetails.filter((entry) => entry.strategy.toLowerCase() !== charm!.strategy.toLowerCase())
    : [...strategyDetails]

  let ajna: (typeof strategyDetails)[number] | undefined
  let ajnaAuthAddress: Address | null = null
  let expectedAjnaAuthAdmin: Address | null = null
  let ajnaAuthAdmin: Address | null = null
  let ajnaBufferRatioBps: number | null = null
  let ajnaMinBucketIndex: number | null = null
  if (info.ajnaWeightBps > 0n) {
    ajna =
      remaining.find((entry) => Boolean(entry.ajna.ajnaPool)) ??
      remaining.find((entry) => !entry.bridgeAddress) ??
      remaining[0]
    if (!ajna) {
      throw new Error('phase3 verification failed: ajna strategy not registered on vault')
    }
    if (!ajna.ajna.innerVault || !ajna.ajna.auth) {
      throw new Error('phase3 verification failed: nested ajna adapter is missing inner vault wiring')
    }
    if (ajna.weight !== info.ajnaWeightBps) {
      throw new Error(
        `phase3 verification failed: ajna strategy weight ${ajna.weight.toString()} does not match expected ${info.ajnaWeightBps.toString()}`,
      )
    }
    if (!(await hasRuntimeCode(params.publicClient, ajna.strategy))) {
      throw new Error(`phase3 verification failed: ajna strategy code missing at ${ajna.strategy}`)
    }
    if (ajna.ajna.innerVault && !(await hasRuntimeCode(params.publicClient, ajna.ajna.innerVault))) {
      throw new Error(`phase3 verification failed: ajna inner vault code missing at ${ajna.ajna.innerVault}`)
    }
    if (ajna.ajna.auth && !(await hasRuntimeCode(params.publicClient, ajna.ajna.auth))) {
      throw new Error(`phase3 verification failed: ajna auth code missing at ${ajna.ajna.auth}`)
    }

    ajnaAuthAddress = ajna.ajna.auth
    expectedAjnaAuthAdmin = info.owner
    if (ajnaAuthAddress) {
      const [ajnaAuthAdminRaw, ajnaBufferRatioRaw, ajnaMinBucketRaw] = await Promise.all([
        params.publicClient
          .readContract({
            address: ajnaAuthAddress,
            abi: AJNA_AUTH_VIEW_ABI,
            functionName: 'admin',
          })
          .catch(() => null),
        params.publicClient
          .readContract({
            address: ajnaAuthAddress,
            abi: AJNA_AUTH_VIEW_ABI,
            functionName: 'bufferRatio',
          })
          .catch(() => null),
        params.publicClient
          .readContract({
            address: ajnaAuthAddress,
            abi: AJNA_AUTH_VIEW_ABI,
            functionName: 'minBucketIndex',
          })
          .catch(() => null),
      ])
      ajnaAuthAdmin = normalizeAddress(ajnaAuthAdminRaw)
      if (ajnaBufferRatioRaw != null && Number.isFinite(Number(ajnaBufferRatioRaw))) {
        ajnaBufferRatioBps = Number(ajnaBufferRatioRaw)
      }
      if (ajnaMinBucketRaw != null && Number.isFinite(Number(ajnaMinBucketRaw))) {
        ajnaMinBucketIndex = Number(ajnaMinBucketRaw)
      }
    }
  }

  if (info.solanaWeightBps > 0n) {
    const remainingAfterAjna = remaining.filter(
      (entry) => !ajna || entry.strategy.toLowerCase() !== ajna.strategy.toLowerCase(),
    )
    const solana =
      remainingAfterAjna.find((entry) => Boolean(entry.bridgeAddress)) ??
      (remainingAfterAjna.length === 1 ? remainingAfterAjna[0] : undefined)
    if (!solana) {
      throw new Error('phase3 verification failed: solana strategy not registered on vault')
    }
    if (solana.weight !== info.solanaWeightBps) {
      throw new Error(
        `phase3 verification failed: solana strategy weight ${solana.weight.toString()} does not match expected ${info.solanaWeightBps.toString()}`,
      )
    }
    if (!(await hasRuntimeCode(params.publicClient, solana.strategy))) {
      throw new Error(`phase3 verification failed: solana strategy code missing at ${solana.strategy}`)
    }
  }

  const runtimeExpectations = extractPhase3RuntimeExpectations({
    calls: params.phase3Calls,
    vault: info.vault,
  })
  if (expectedTotalWeight > 0n && !runtimeExpectations.sawDeployToStrategiesCall) {
    throw new Error('phase3 verification failed: deployToStrategies call missing from phase3 payload')
  }
  if (expectedTotalWeight < BPS_DENOMINATOR && !runtimeExpectations.sawMinimumTotalIdleCall) {
    throw new Error(
      'phase3 verification failed: setMinimumTotalIdle call missing from phase3 payload while idle reserve is required',
    )
  }
  if (runtimeExpectations.expectedMinimumTotalIdle != null) {
    if (runtimeExpectations.expectedMinimumTotalIdle <= 0n) {
      throw new Error('phase3 verification failed: minimumTotalIdle must be greater than zero')
    }
    const minimumTotalIdleRaw = await params.publicClient
      .readContract({
        address: info.vault,
        abi: CREATOR_OVAULT_RUNTIME_VIEW_ABI,
        functionName: 'minimumTotalIdle',
      })
      .catch(() => null)
    const minimumTotalIdle = parseBigIntLike(minimumTotalIdleRaw)
    if (minimumTotalIdle == null) {
      throw new Error('phase3 verification failed: minimumTotalIdle is unreadable')
    }
    if (minimumTotalIdle !== runtimeExpectations.expectedMinimumTotalIdle) {
      throw new Error(
        `phase3 verification failed: minimumTotalIdle ${minimumTotalIdle.toString()} does not match expected ${runtimeExpectations.expectedMinimumTotalIdle.toString()}`,
      )
    }
  }

  return {
    ajnaAuthAddress,
    expectedAjnaAuthAdmin,
    ajnaAuthAdmin,
    ajnaAuthAdminMatchesOwner:
      ajnaAuthAdmin && expectedAjnaAuthAdmin
        ? ajnaAuthAdmin.toLowerCase() === expectedAjnaAuthAdmin.toLowerCase()
        : null,
    ajnaStrategyAdapter: ajna?.strategy ?? null,
    ajnaInnerVault: ajna?.ajna.innerVault ?? null,
    ajnaPool: ajna?.ajna.ajnaPool ?? null,
    ajnaBufferRatioBps,
    ajnaMinBucketIndex,
  }
}

async function verifyPhase4PostState(params: {
  publicClient: any
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  phase4Calls: Array<{ to: Address; value: bigint; data: Hex }>
  txHash?: Hex
}): Promise<void> {
  const launch = extractPhase4LaunchInfo(params.phase4Calls)
  if (!launch) {
    throw new Error('phase4 verification failed: phase4Calls missing launchDeferredAuction')
  }

  const finalizeInfo = params.phase2FinalizeCalls
    .map((call) => extractFinalizePhase2Info(call.data))
    .find((info): info is NonNullable<typeof info> => Boolean(info))

  const readLaunchEventFromReceipt = async (): Promise<{
    ccaStrategy: Address | null
    auction: Address | null
    creatorToken: Address | null
    owner: Address | null
    shareOFT: Address | null
  } | null> => {
    const txHash = params.txHash
    const getReceipt = params.publicClient?.getTransactionReceipt
    if (!txHash || typeof getReceipt !== 'function') return null
    const receipt = await getReceipt.call(params.publicClient, { hash: txHash }).catch(() => null)
    const logs = Array.isArray(receipt?.logs) ? receipt.logs : []
    for (const log of logs) {
      const logAddress = normalizeAddress((log as any)?.address)
      if (!logAddress || logAddress.toLowerCase() !== launch.batcher.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({
          abi: CREATOR_VAULT_BATCHER_AUCTION_LAUNCHED_EVENT_ABI,
          data: (log as any).data,
          topics: (log as any).topics,
        })
        if (!isPlainObject(decoded)) continue
        if (decoded.eventName !== 'AuctionLaunchedDeferred') continue
        const args: Record<string, unknown> = isPlainObject(decoded.args) ? decoded.args : {}
        return {
          creatorToken: normalizeAddress(args?.creatorToken),
          owner: normalizeAddress(args?.owner),
          shareOFT: normalizeAddress(args?.shareOFT),
          ccaStrategy: normalizeAddress(args?.ccaStrategy),
          auction: normalizeAddress(args?.auction),
        }
      } catch {
        continue
      }
    }
    return null
  }

  const launchEvent = await readLaunchEventFromReceipt()
  if (launchEvent?.creatorToken && launchEvent.creatorToken.toLowerCase() !== launch.creatorToken.toLowerCase()) {
    throw new Error('phase4 verification failed: launch event creator token mismatch')
  }
  if (launchEvent?.owner && launchEvent.owner.toLowerCase() !== launch.owner.toLowerCase()) {
    throw new Error('phase4 verification failed: launch event owner mismatch')
  }
  if (launchEvent?.shareOFT && launchEvent.shareOFT.toLowerCase() !== launch.shareOFT.toLowerCase()) {
    throw new Error('phase4 verification failed: launch event share OFT mismatch')
  }

  const finalizeCca = normalizeAddress(finalizeInfo?.ccaStrategy)
  const eventCca = normalizeAddress(launchEvent?.ccaStrategy)
  const ccaStrategy = finalizeCca ?? eventCca
  if (!ccaStrategy) {
    throw new Error('phase4 verification failed: could not resolve CCA strategy')
  }
  if (finalizeInfo?.creatorToken && launch.creatorToken.toLowerCase() !== finalizeInfo.creatorToken.toLowerCase()) {
    throw new Error('phase4 verification failed: creator token mismatch between phase2 and phase4 payloads')
  }
  if (finalizeInfo?.owner && launch.owner.toLowerCase() !== finalizeInfo.owner.toLowerCase()) {
    throw new Error('phase4 verification failed: owner mismatch between phase2 and phase4 payloads')
  }
  if (!(await hasRuntimeCode(params.publicClient, launch.shareOFT))) {
    throw new Error(`phase4 verification failed: share OFT code missing at ${launch.shareOFT}`)
  }
  if (!(await hasRuntimeCode(params.publicClient, ccaStrategy))) {
    throw new Error(`phase4 verification failed: CCA strategy code missing at ${ccaStrategy}`)
  }

  const [currentAuctionRaw, ccaFactoryRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: ccaStrategy,
        abi: CCA_STRATEGY_VIEW_ABI,
        functionName: 'currentAuction',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: ccaStrategy,
        abi: CCA_STRATEGY_VIEW_ABI,
        functionName: 'ccaFactory',
      })
      .catch(() => null),
  ])
  const currentAuction = normalizeAddress(currentAuctionRaw) ?? normalizeAddress(launchEvent?.auction)
  const ccaFactory = normalizeAddress(ccaFactoryRaw)
  if (!currentAuction) {
    throw new Error('phase4 verification failed: CCA currentAuction is empty')
  }
  if (!ccaFactory) {
    throw new Error('phase4 verification failed: CCA factory is empty')
  }
  if (!(await hasRuntimeCode(params.publicClient, currentAuction))) {
    throw new Error(`phase4 verification failed: auction code missing at ${currentAuction}`)
  }
  if (!(await hasRuntimeCode(params.publicClient, ccaFactory))) {
    throw new Error(`phase4 verification failed: CCA factory code missing at ${ccaFactory}`)
  }

  const [isGraduatedRaw, totalSupplyRaw, shareBalanceRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: currentAuction,
        abi: CONTINUOUS_CCA_VIEW_ABI,
        functionName: 'isGraduated',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: currentAuction,
        abi: CONTINUOUS_CCA_VIEW_ABI,
        functionName: 'totalSupply',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: launch.shareOFT,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [currentAuction],
      })
      .catch(() => null),
  ])
  if (typeof isGraduatedRaw !== 'boolean') {
    throw new Error('phase4 verification failed: auction does not expose expected Uniswap CCA interface')
  }
  const totalSupply = parseBigIntLike(totalSupplyRaw)
  if (totalSupply == null || totalSupply <= 0n) {
    throw new Error('phase4 verification failed: auction totalSupply is zero')
  }
  const shareBalance = parseBigIntLike(shareBalanceRaw)
  if (shareBalance == null) {
    throw new Error('phase4 verification failed: could not read auction share funding balance')
  }
  if (shareBalance < totalSupply) {
    throw new Error(
      `phase4 verification failed: auction not fully funded (${shareBalance.toString()} < ${totalSupply.toString()})`,
    )
  }
}

async function ensureSolanaRouteReadyForPhase3(params: {
  req: VercelRequest
  publicClient: any
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  solanaOvault?: unknown
}): Promise<{
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  assetPeerSet: boolean
  sharePeerSet: boolean
  meshStep: 'ovault_mesh_confirmed'
}> {
  const defaultStatus = {
    existingMintCompatible: true,
    depositEligible: true,
    redeemEligible: true,
    assetPeerSet: true,
    sharePeerSet: true,
    meshStep: 'ovault_mesh_confirmed' as const,
  }
  const ovaultRequested = isOvaultRequestEnabled(params.solanaOvault)
  const finalizeEntry = findFinalizePhase2Entry(params.phase2FinalizeCalls)
  if (!finalizeEntry) {
    if (ovaultRequested) {
      throw new Error('Solana preflight failed: OVault mesh requires a decodable finalizePhase2 call.')
    }
    return defaultStatus
  }

  if (!isLegacySolanaBridgePreflightEnabled()) {
    return ensureShareMeshOvaultPreflight({
      publicClient: params.publicClient,
      finalizeCall: finalizeEntry.call,
      ovaultRequested,
    })
  }

  const { call: finalizeCall, info: finalizeInfo } = finalizeEntry
  const batcherAddress = getAddress(finalizeCall.to)
  const bridgeToken = finalizeInfo.creatorToken
  const expectedSolanaAmount =
    finalizeInfo.depositAmount && finalizeInfo.depositAmount > 0n
      ? (finalizeInfo.depositAmount * SOLANA_RESERVE_PERCENT_BPS) / BPS_DENOMINATOR
      : null
  const solanaOvault = isPlainObject(params.solanaOvault) ? params.solanaOvault : {}
  const assetMintOrigin =
    typeof solanaOvault.assetMintOrigin === 'string' && solanaOvault.assetMintOrigin.trim()
      ? solanaOvault.assetMintOrigin.trim()
      : 'existing'
  // Never trust session-persisted hints from client payloads.
  // Compatibility hints used for OVault gating must come from trusted server config.
  const mintCompatibilityHints = readSolanaOvaultMintCompatibilityHintsFromEnv()
  const hasMintCompatibilityHints = Object.values(mintCompatibilityHints).some((value) => value !== null)

  const [adapterRaw, destinationRaw, ovaultRuntimeRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
        functionName: 'solanaBridgeAdapter',
      })
      .catch(() => ZERO_ADDRESS as Address),
    params.publicClient
      .readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
        functionName: 'solanaDestination',
      })
      .catch(() => ZERO_BYTES32 as Hex),
    params.publicClient
      .readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_SOLANA_VIEW_ABI,
        functionName: 'getOVaultRuntimeConfig',
      })
      .catch(() => null),
  ])
  const adapter = getAddress((adapterRaw as Address) || ZERO_ADDRESS)
  const destination = ((destinationRaw as Hex) || ZERO_BYTES32).toLowerCase()
  const solanaEnabled =
    adapter.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    destination !== ZERO_BYTES32.toLowerCase()
  if (ovaultRequested && !isOvaultRuntimeConfigured(ovaultRuntimeRaw)) {
    throw new Error(
      `Solana preflight failed: OVault runtime config is not enabled on deployment batcher ${batcherAddress}.`,
    )
  }
  if (!solanaEnabled) {
    if (ovaultRequested) {
      throw new Error(
        `Solana preflight failed: Solana bridge is not enabled on deployment batcher ${batcherAddress}.`,
      )
    }
    return defaultStatus
  }

  const registered = await params.publicClient
    .readContract({
      address: adapter,
      abi: SOLANA_BRIDGE_ADAPTER_VIEW_ABI,
      functionName: 'isRegistered',
      args: [bridgeToken],
    })
    .then((v: unknown) => Boolean(v))
    .catch(() => null)

  // Use only trusted origins for internal API calls to avoid host-header injection.
  const canonicalOrigin = getCanonicalOrigin(params.req)
  const defaultOrigins = [canonicalOrigin].filter((o): o is string => Boolean(o))
  const configuredOrigins = readAdditionalSolanaRegistrationOrigins()
  const candidateOrigins = dedupeOrigins([...configuredOrigins, ...defaultOrigins])
  if (candidateOrigins.length === 0) {
    throw new Error(
      'Solana preflight failed: no registration origin available. Configure APP_ORIGIN or DEPLOY_SOLANA_REGISTRATION_ORIGINS.',
    )
  }
  if (registered !== true && (!expectedSolanaAmount || expectedSolanaAmount <= 0n)) {
    throw new Error(
      'Solana preflight failed: missing finalize deposit amount for reserve checks.',
    )
  }
  const internalRegistrationSecret = String(
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET ??
      process.env.SOLANA_REGISTRATION_INTERNAL_SECRET ??
      '',
  ).trim()
  if (!internalRegistrationSecret) {
    throw new Error(
      'Solana preflight failed: DEPLOY_SOLANA_REGISTRATION_SECRET is required for internal registration checks.',
    )
  }
  const routePath: SolanaPreflightRoutePath = SOLANA_PREFLIGHT_ROUTE_PATH
  const tryRegister = async (
    origin: string,
  ): Promise<{
    ok: boolean
    failure: string | null
    ovault: {
      existingMintCompatible: boolean
      depositEligible: boolean
      redeemEligible: boolean
      assetPeerSet: boolean
      sharePeerSet: boolean
      meshStep: 'ovault_mesh_confirmed'
    } | null
  }> => {
    try {
      const registerUrl = `${origin}${routePath}`
      const payload: Record<string, unknown> = {
        bridgeToken,
        buildOnly: true,
        batcherAddress,
        assetMintOrigin,
        enforceCompatibility: true,
      }
      if (hasMintCompatibilityHints) payload.mintCompatibilityHints = mintCompatibilityHints
      // Only force Meteora payload generation while the bridge token is not yet registered.
      if (registered !== true) {
        payload.creatorToken = bridgeToken
        payload.expectedSolanaAmount = expectedSolanaAmount?.toString()
      }
      const trustedInternalHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CV-Solana-Registration-Secret': internalRegistrationSecret,
      }
      const registerRes = await fetch(registerUrl, {
        method: 'POST',
        headers: trustedInternalHeaders,
        body: JSON.stringify(payload),
      })
      const rawBody = await registerRes.text().catch(() => '')
      let registerJson: ApiEnvelope<any> | null = null
      try {
        registerJson = rawBody ? (JSON.parse(rawBody) as ApiEnvelope<any>) : null
      } catch {
        registerJson = null
      }
      if (registerRes.ok && registerJson?.success) {
        const data = registerJson?.data ?? null
        const registered = data?.registered === true
        const existingMintCompatible = data?.existingMintCompatible === true
        const depositEligible = data?.depositEligible === true
        const redeemEligible = data?.redeemEligible === true
        const assetPeerSet = data?.assetPeerSet === false ? false : true
        const sharePeerSet = data?.sharePeerSet === false ? false : true
        const meteoraAlphaVault = data?.meteoraAlphaVault
        const hasMeteoraAlphaVault = isBytes32Hex(meteoraAlphaVault) && meteoraAlphaVault !== ZERO_BYTES32
        const hasSolanaIxs = Array.isArray(data?.solanaIxs) && data.solanaIxs.length > 0
        const requireInlineMeteoraPayload = shouldRequireInlineMeteoraPayload()
        if (
          !registered ||
          !existingMintCompatible ||
          !depositEligible ||
          !redeemEligible ||
          !assetPeerSet ||
          !sharePeerSet ||
          (requireInlineMeteoraPayload && (!hasMeteoraAlphaVault || !hasSolanaIxs))
        ) {
          const blockersRaw = data?.mintCompatibility?.blockers
          const blockers =
            Array.isArray(blockersRaw) && blockersRaw.length > 0
              ? blockersRaw.map((v: unknown) => String(v)).join(' ')
              : null
          return {
            ok: false,
            failure:
              `${origin}${routePath} (ovault readiness): ` +
              `registered=${String(data?.registered)} ` +
              `existingMintCompatible=${String(data?.existingMintCompatible)} ` +
              `depositEligible=${String(data?.depositEligible)} ` +
              `redeemEligible=${String(data?.redeemEligible)} ` +
              `assetPeerSet=${String(data?.assetPeerSet)} ` +
              `sharePeerSet=${String(data?.sharePeerSet)} ` +
              `meteoraAlphaVault=${String(data?.meteoraAlphaVault ?? '')} ` +
              `solanaIxs=${Array.isArray(data?.solanaIxs) ? String(data.solanaIxs.length) : '0'} ` +
              `inlineMeteoraRequired=${requireInlineMeteoraPayload ? 'yes' : 'no'}` +
              (blockers ? ` blockers=${blockers}` : ''),
            ovault: null,
          }
        }
        return {
          ok: true,
          failure: null,
          ovault: {
            existingMintCompatible,
            depositEligible,
            redeemEligible,
            assetPeerSet,
            sharePeerSet,
            meshStep: 'ovault_mesh_confirmed',
          },
        }
      }
      const detail =
        registerJson?.error
          ? String(registerJson.error)
          : rawBody
            ? rawBody.slice(0, 240)
            : `http_${registerRes.status}`
      return {
        ok: false,
        failure: `${origin}${routePath} (${registerRes.status}): ${detail}`,
        ovault: null,
      }
    } catch {
      return { ok: false, failure: `${origin}${routePath}: request_failed`, ovault: null }
    }
  }
  const failures: string[] = []
  for (const origin of candidateOrigins) {
    const registration = await tryRegister(origin)
    if (registration.ok) return registration.ovault ?? defaultStatus
    if (registration.failure) failures.push(registration.failure)
  }
  throw new Error(
    `Solana preflight failed: ${failures.join(' | ') || `${routePath} call failed.`}`,
  )
}

async function getOwnerAccount(rec: any) {
  const payload = asPayloadObject(rec.payload)
  const deploySignerWalletIdFromPayload =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : ''
  const deploySignerWalletIdFromRecord =
    typeof rec?.sessionSignerWalletId === 'string'
      ? rec.sessionSignerWalletId.trim()
      : ''
  const deploySignerWalletId = deploySignerWalletIdFromPayload || deploySignerWalletIdFromRecord
  if (!deploySignerWalletId) throw new Error('deploy_signer_wallet_unavailable')
  const sessionSigner = getAddress(rec.sessionSigner)
  const ownerAccount = toAccount({
    address: sessionSigner,
    sign: async ({ hash }: { hash: Hex }) => {
      return (await secp256k1SignHash({ walletId: deploySignerWalletId, hash })) as Hex
    },
    signTransaction: async () => {
      throw new Error('privy_sign_transaction_unsupported')
    },
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const msg =
        typeof message === 'string'
          ? message
          : typeof message.raw === 'string'
            ? message.raw
            : `0x${Buffer.from(message.raw).toString('hex')}`
      const out = await walletRpc<any>({
        walletId: deploySignerWalletId,
        method: 'personal_sign',
        rpcParams: { message: msg, encoding: 'hex' },
      })
      const sig = String(out?.data?.signature ?? '').trim()
      if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('privy_personal_sign_invalid_signature')
      return sig as Hex
    },
    signTypedData: async () => {
      throw new Error('privy_sign_typed_data_unsupported')
    },
  })
  return { ownerAccount, sessionSigner }
}

async function advanceDeploySession(rec: any, req: VercelRequest): Promise<void> {
  const step = String(rec.step ?? '')
  if (
    ![
      'phase1_sent',
      'phase1_confirmed',
      'phase1_finalize_sent',
      'phase1_finalize_confirmed',
      'phase2_core_sent',
      'phase2_core_confirmed',
      PHASE2_FINALIZE_SENT_STEP,
      PHASE2_FINALIZE_CONFIRMED_STEP,
      'phase2_sent',
      'phase2_confirmed',
      'ovault_mesh_sent',
      'ovault_mesh_confirmed',
      'phase3_sent',
      'phase3_confirmed',
      'phase4_sent',
      'phase4_confirmed',
      'cleanup_sent',
    ].includes(step)
  ) {
    return
  }
  const receiptBackedSteps = [
    'phase1_sent',
    'phase1_finalize_sent',
    'phase2_core_sent',
    PHASE2_FINALIZE_SENT_STEP,
    'phase2_sent',
    'phase3_sent',
    'phase4_sent',
    'cleanup_sent',
  ]
  const needsReceipt = receiptBackedSteps.includes(step)

  const origin = getCanonicalOrigin(req)
  const bundlerEndpoint = getBundlerEndpoint(origin)
  const transport = http(bundlerEndpoint.url)

  const publicClient = createPublicClient({
    chain: base,
    transport: http(resolveDeploySessionRpcUrl(), { timeout: 12_000 }),
  })
  const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

  let txHash: Hex | undefined
  const payload = asPayloadObject(rec.payload)
  const sessionAddress = getAddress(rec.sessionAddress)
  const smartWalletAddress = getAddress(rec.smartWallet)

  const deploySignerWalletIdFromPayload =
    typeof payload?.deploySignerWalletId === 'string'
      ? payload.deploySignerWalletId.trim()
      : ''
  const deploySignerWalletIdFromRecord =
    typeof rec?.sessionSignerWalletId === 'string'
      ? rec.sessionSignerWalletId.trim()
      : ''
  const deploySignerWalletId = deploySignerWalletIdFromPayload || deploySignerWalletIdFromRecord
  const persistSessionOwner =
    payload?.persistSessionOwner === true ||
    (payload?.persistSessionOwner == null && Boolean(deploySignerWalletId) && shouldPersistManagedSessionOwner())
  const erc7712Grant = parseGrant(payload?.erc7712Grant)
  const toBigInt = (v: any): bigint => {
    if (typeof v === 'bigint') return v
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v))
    if (typeof v === 'string') {
      const s = v.trim()
      if (!s) return 0n
      if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s)
      return BigInt(s)
    }
    return 0n
  }
  const normalizeCalls = (raw: unknown): Array<{ to: Address; value: bigint; data: Hex }> => {
    if (!Array.isArray(raw)) return []
    const out: Array<{ to: Address; value: bigint; data: Hex }> = []
    for (const entry of raw) {
      const c = entry as any
      if (!c || typeof c !== 'object') continue
      const data = typeof c.data === 'string' ? c.data : ''
      if (!data.startsWith('0x')) continue
      try {
        out.push({
          to: getAddress(c.to),
          value: toBigInt(c.value ?? 0),
          data: data as Hex,
        })
      } catch {
        // Skip malformed calls; required-stage checks below prevent false completion.
      }
    }
    return out
  }
  const rawPhase1Calls = Array.isArray(payload.phase1Calls) ? payload.phase1Calls : []
  const phase1Calls = normalizeCalls(rawPhase1Calls)
  const phase1FinalizeCalls = phase1Calls.length > 1 ? phase1Calls.slice(1) : []
  const phase2CoreCalls = normalizeCalls(Array.isArray(payload.phase2CoreCalls) ? payload.phase2CoreCalls : [])
  const expectedStages = isPlainObject(payload.expectedStages) ? payload.expectedStages : {}
  const rawPhase2FinalizeCalls = Array.isArray(payload.phase2FinalizeCalls) ? payload.phase2FinalizeCalls : []
  const hasPhase2Finalize = expectedStages.hasPhase2Finalize === true || rawPhase2FinalizeCalls.length > 0
  const phase2FinalizeCalls = normalizeCalls(rawPhase2FinalizeCalls)
  const rawPhase3Calls = Array.isArray(payload.phase3Calls) ? payload.phase3Calls : []
  const rawPhase4Calls = Array.isArray(payload.phase4Calls) ? payload.phase4Calls : []
  const hasPhase3 = expectedStages.hasPhase3 === true || rawPhase3Calls.length > 0
  const hasPhase4 = expectedStages.hasPhase4 === true || rawPhase4Calls.length > 0
  const phase3Calls = normalizeCalls(rawPhase3Calls)
  const phase4Calls = normalizeCalls(rawPhase4Calls)
  if (hasPhase2Finalize && phase2FinalizeCalls.length === 0) throw new Error('phase2_finalize_calls_invalid')
  if (hasPhase3 && phase3Calls.length === 0) throw new Error('phase3_calls_invalid')
  if (hasPhase4 && phase4Calls.length === 0) throw new Error('phase4_calls_invalid')
  const hasPostPhase2 = hasPhase3 || hasPhase4
  const solanaOvaultConfig = isPlainObject(payload.solanaOvault) ? payload.solanaOvault : {}
  const hasOvaultMeshStage = solanaOvaultConfig.enabled === true && hasPostPhase2
  const enforcePhase2InvariantGate = isTruthyEnv(process.env.DEPLOY_ENFORCE_PHASE2_INVARIANTS, true)
  const defaultPayoutRecipientMode =
    String(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT_MODE ?? '').trim().toLowerCase() === 'payout_router'
      ? 'payout_router'
      : 'gauge'
  const defaultPayoutRecipient =
    typeof process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT === 'string' &&
    isAddress(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT)
      ? getAddress(process.env.DEPLOY_EXPECT_PAYOUT_RECIPIENT as Address)
      : null
  const phase2ReplayState =
    phase2CoreCalls.length > 0 || hasPhase2Finalize
      ? await readPhase2ReplayState({
          publicClient,
          phase2FinalizeCalls,
        })
      : {
          phase2CoreAlreadyDeployed: false,
          phase2FinalizeAlreadyCompleted: false,
        }
  const shouldSkipPhase2Core = phase2CoreCalls.length > 0 && phase2ReplayState.phase2CoreAlreadyDeployed
  const shouldSkipPhase2Finalize = hasPhase2Finalize && phase2ReplayState.phase2FinalizeAlreadyCompleted
  const markReplaySkip = async (phase: 'phase2Core' | 'phase2Finalize'): Promise<void> => {
    const atKey = phase === 'phase2Core' ? REPLAY_SKIP_PHASE2_CORE_AT_KEY : REPLAY_SKIP_PHASE2_FINALIZE_AT_KEY
    const reasonKey =
      phase === 'phase2Core' ? REPLAY_SKIP_PHASE2_CORE_REASON_KEY : REPLAY_SKIP_PHASE2_FINALIZE_REASON_KEY
    if (typeof payload?.[atKey] === 'string' && payload[atKey].trim()) return
    const reason =
      phase === 'phase2Core'
        ? 'onchain_phase2_core_already_deployed'
        : 'onchain_phase2_finalize_already_completed'
    const patch = {
      [atKey]: new Date().toISOString(),
      [reasonKey]: reason,
    }
    await updateDeploySession({
      id: rec.id,
      payloadPatch: patch,
    })
    payload[atKey] = patch[atKey]
    payload[reasonKey] = reason
  }

  const assertPhase2InvariantGate = async (): Promise<void> => {
    if (!enforcePhase2InvariantGate || !hasPhase2Finalize) return
    const result = await verifyDeployPhase2Invariants({
      publicClient,
      phase2FinalizeCalls,
      payload,
      defaultPayoutRecipientMode,
      defaultPayoutRecipient,
    })
    const gatePatch = {
      [PHASE2_INVARIANT_GATE_CHECKED_AT_KEY]: new Date().toISOString(),
      [PHASE2_INVARIANT_GATE_KEY]: result,
    }
    await updateDeploySession({
      id: rec.id,
      payloadPatch: gatePatch,
    })
    payload[PHASE2_INVARIANT_GATE_CHECKED_AT_KEY] = gatePatch[PHASE2_INVARIANT_GATE_CHECKED_AT_KEY]
    payload[PHASE2_INVARIANT_GATE_KEY] = gatePatch[PHASE2_INVARIANT_GATE_KEY]
    if (!result.checked || result.violations.length > 0) {
      const summary = result.violations.map((entry) => entry.code).join(',')
      throw new Error(`phase2_invariant_failed:${summary || 'unknown'}`)
    }
  }

  type AuthedCtx = {
    bundler: any
    paymasterClient: any
    account: any
    sessionSigner: Address
    removeOwnerCall: { to: Address; value: bigint; data: Hex }
  }
  let ctx: AuthedCtx | null = null
  const getCtx = async (): Promise<AuthedCtx> => {
    if (ctx) return ctx
    const { ownerAccount, sessionSigner } = await getOwnerAccount(rec)
    const ownerIndex = await findOwnerIndex({
      publicClient,
      smartWallet: smartWalletAddress,
      ownerAddress: sessionSigner,
      maxScan: 512,
    })
    if (ownerIndex === null) throw new Error('session_signer_not_installed')

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const authedTransport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
      ? {
          fetchOptions: {
            headers: {
              'X-CV-Deploy-Session': deployToken,
              'X-CV-Deploy-Session-Signature': deploySig,
            },
          },
        }
      : undefined)
    const paymasterClient = createPaymasterClient({ transport: authedTransport })
    const bundler = createBundlerClient({ client: publicClient as any, transport: authedTransport })
    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWalletAddress,
      owners: [ownerAccount as any],
      ownerIndex,
      version: '1',
    })
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionSigner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWalletAddress, value: 0n, data } as const
    })()

    ctx = { bundler, paymasterClient, account, sessionSigner, removeOwnerCall }
    return ctx
  }

  const startStage = async (
    fromStep: string,
    toStep: string,
    calls: Array<{ to: Address; value: bigint; data: Hex }>,
    attachCleanup: boolean,
  ) => {
    if (toStep === 'phase4_sent') {
      const deploySig = signDeployToken(rec.deployToken)
      await ensureLaunchImageReady({
        req,
        sessionId: rec.id,
        sessionAddress: getAddress(rec.sessionAddress),
        payload,
        phase2FinalizeCalls,
        phase4Calls,
        deployToken: rec.deployToken,
        deployTokenSignature: deploySig,
        persistPayloadPatch: async (patch) => {
          await updateDeploySession({ id: rec.id, payloadPatch: patch })
          Object.assign(payload, patch)
        },
      })
    }

    const authedCtx = await getCtx()
    const fullCalls = [...calls]
    const shouldAttachCleanup = attachCleanup && !persistSessionOwner
    const allowCleanupFallback = shouldAttachCleanup && toStep === 'phase4_sent'
    if (shouldAttachCleanup) fullCalls.push(authedCtx.removeOwnerCall)

    await validateSponsoredSmartWalletCalls({
      sender: smartWalletAddress,
      sessionAddress,
      calls: fullCalls,
      deploySessionOwner: authedCtx.sessionSigner,
    })

    const permissionCheck = validateCallsAgainstGrant({
      grant: erc7712Grant,
      calls: fullCalls,
      expectedChainId: 8453,
      expectedSessionId: rec.id,
    })
    if (!permissionCheck.ok) throw new Error(permissionCheck.reason ?? 'erc7712_permission_denied')

    const stageKey = stageUserOpHashKey(toStep)
    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: fromStep as any,
      toStep: toStep as any,
      lastUserOpHash: null,
      lastTxHash: null,
      lastError: null,
      payloadPatch: { [stageKey]: null },
    })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    const { bundler, paymasterClient, account } = authedCtx
    try {
      let nextHash: Hex
      let payloadPatch: Record<string, unknown> = { [stageKey]: null }
      try {
        nextHash = await sendUserOperation(bundler, {
          account,
          calls: fullCalls,
          paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
        })
      } catch (err) {
        if (!allowCleanupFallback) throw err
        const cleanupFailureReason = String(err instanceof Error ? err.message : err ?? 'inline_cleanup_failed')
          .trim()
          .slice(0, 220)
        nextHash = await sendUserOperation(bundler, {
          account,
          calls,
          paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
        })
        payloadPatch = {
          [stageKey]: null,
          cleanupDeferredAt: new Date().toISOString(),
          cleanupDeferredReason: cleanupFailureReason || 'inline_cleanup_failed',
        }
      }
      await updateDeploySession({
        id: rec.id,
        step: toStep as any,
        lastUserOpHash: nextHash,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { ...payloadPatch, [stageKey]: nextHash },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'send_userop_failed')
      const debug = buildUserOpErrorDebug({
        err,
        sessionId: rec.id,
        stage: toStep,
        calls: fullCalls,
      })
      await updateDeploySession({
        id: rec.id,
        step: toStep as any,
        lastUserOpHash: null,
        lastTxHash: null,
        lastError: `${toStep}_send_failed:${msg}`,
        payloadPatch: { lastErrorDebug: debug },
      })
      throw err
    }
  }

  const runOvaultMeshGate = async (fromStep: string): Promise<boolean> => {
    if (!hasOvaultMeshStage) return false
    const markedSent = await transitionDeploySession({
      id: rec.id,
      fromStep: fromStep as any,
      toStep: 'ovault_mesh_sent',
      lastError: null,
      lastUserOpHash: null,
      lastTxHash: null,
    })
    if (!markedSent) throw new Error(CONCURRENT_MODIFICATION)

    const ovault = await ensureSolanaRouteReadyForPhase3({
      req,
      publicClient,
      phase2FinalizeCalls,
      solanaOvault: payload.solanaOvault,
    })
    const markedConfirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'ovault_mesh_sent',
      toStep: 'ovault_mesh_confirmed',
      lastError: null,
      payloadPatch: { ovault },
    })
    if (!markedConfirmed) throw new Error(CONCURRENT_MODIFICATION)
    payload.ovault = ovault
    return true
  }

  const startNextAfterPhase2 = async (fromStep: string) => {
    if (hasPhase3) {
      if (!hasOvaultMeshStage) {
        const ovault = await ensureSolanaRouteReadyForPhase3({
          req,
          publicClient,
          phase2FinalizeCalls,
          solanaOvault: payload.solanaOvault,
        })
        await updateDeploySession({ id: rec.id, payloadPatch: { ovault } })
      }
      await startStage(fromStep, 'phase3_sent', phase3Calls, !hasPhase4)
      return true
    }
    if (hasPhase4) {
      await startStage(fromStep, 'phase4_sent', phase4Calls, true)
      return true
    }
    return false
  }

  const startOrCompleteAfterPhase2 = async (fromStep: string): Promise<void> => {
    await assertPhase2InvariantGate()
    if (hasPostPhase2) {
      if (hasOvaultMeshStage) {
        await runOvaultMeshGate(fromStep)
        await startNextAfterPhase2('ovault_mesh_confirmed')
        return
      }
      await startNextAfterPhase2(fromStep)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: fromStep as any, toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
  }

  const startFromPhase2 = async (fromStep: string): Promise<void> => {
    if (phase2CoreCalls.length > 0) {
      if (!shouldSkipPhase2Core) {
        await startStage(fromStep, 'phase2_core_sent', phase2CoreCalls, !hasPhase2Finalize && !hasPostPhase2)
        return
      }
      await markReplaySkip('phase2Core')
    }
    if (hasPhase2Finalize) {
      if (!shouldSkipPhase2Finalize) {
        await startStage(fromStep, PHASE2_FINALIZE_SENT_STEP, phase2FinalizeCalls, !hasPostPhase2)
        return
      }
      await markReplaySkip('phase2Finalize')
    }
    await startOrCompleteAfterPhase2(fromStep)
  }

  const startAfterPhase2Core = async (fromStep: string): Promise<void> => {
    if (hasPhase2Finalize) {
      if (!shouldSkipPhase2Finalize) {
        await startStage(fromStep, PHASE2_FINALIZE_SENT_STEP, phase2FinalizeCalls, !hasPostPhase2)
        return
      }
      await markReplaySkip('phase2Finalize')
    }
    await startOrCompleteAfterPhase2(fromStep)
  }

  const getSentStagePlan = (
    sentStep: string,
  ): { calls: Array<{ to: Address; value: bigint; data: Hex }>; attachCleanup: boolean } | null => {
    if (sentStep === 'phase1_sent') {
      const phase1CoreCalls = phase1Calls.length > 1 ? phase1Calls.slice(0, 1) : phase1Calls
      return {
        calls: phase1CoreCalls,
        attachCleanup: phase1FinalizeCalls.length === 0 && phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === 'phase1_finalize_sent') {
      return {
        calls: phase1FinalizeCalls,
        attachCleanup: phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === 'phase2_core_sent') {
      return {
        calls: phase2CoreCalls,
        attachCleanup: !hasPhase2Finalize && !hasPostPhase2,
      }
    }
    if (sentStep === PHASE2_FINALIZE_SENT_STEP || sentStep === 'phase2_sent') {
      return {
        calls: phase2FinalizeCalls,
        attachCleanup: !hasPostPhase2,
      }
    }
    if (sentStep === 'phase3_sent') {
      return {
        calls: phase3Calls,
        attachCleanup: !hasPhase4,
      }
    }
    if (sentStep === 'phase4_sent') {
      return {
        calls: phase4Calls,
        attachCleanup: true,
      }
    }
    return null
  }

  const dispatchSentStage = async (sentStep: string): Promise<void> => {
    const plan = getSentStagePlan(sentStep)
    if (!plan) return
    const authedCtx = await getCtx()
    const fullCalls = [...plan.calls]
    if (plan.attachCleanup && !persistSessionOwner) {
      fullCalls.push(authedCtx.removeOwnerCall)
    }

    await validateSponsoredSmartWalletCalls({
      sender: smartWalletAddress,
      sessionAddress,
      calls: fullCalls,
      deploySessionOwner: authedCtx.sessionSigner,
    })

    const permissionCheck = validateCallsAgainstGrant({
      grant: erc7712Grant,
      calls: fullCalls,
      expectedChainId: 8453,
      expectedSessionId: rec.id,
    })
    if (!permissionCheck.ok) throw new Error(permissionCheck.reason ?? 'erc7712_permission_denied')
    const { bundler, paymasterClient, account } = authedCtx
    try {
      const nextHash = await sendUserOperation(bundler, {
        account,
        calls: fullCalls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      await updateDeploySession({
        id: rec.id,
        lastUserOpHash: nextHash,
        lastTxHash: null,
        lastError: null,
        payloadPatch: { [stageUserOpHashKey(sentStep)]: nextHash },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'send_userop_failed')
      const debug = buildUserOpErrorDebug({
        err,
        sessionId: rec.id,
        stage: sentStep,
        calls: fullCalls,
      })
      await updateDeploySession({
        id: rec.id,
        lastUserOpHash: null,
        lastTxHash: null,
        lastError: `${sentStep}_send_failed:${msg}`,
        payloadPatch: { lastErrorDebug: debug },
      })
      throw err
    }
  }

  const resolveReceiptTxHash = async (): Promise<Hex | undefined> => {
    if (!needsReceipt) return undefined
    const stageKey = stageUserOpHashKey(step)
    const legacyStageKey = step === PHASE2_FINALIZE_SENT_STEP ? stageUserOpHashKey('phase2_sent') : null
    let stageHash = asHexHash(payload?.[stageKey]) ?? (legacyStageKey ? asHexHash(payload?.[legacyStageKey]) : null)
    if (!stageHash) {
      const fallback = asHexHash(rec.lastUserOpHash)
      // Adopt compatibility fallback only when tx hash is empty (means it wasn't reused from a prior stage).
      if (fallback && !asHexHash(rec.lastTxHash)) {
        stageHash = fallback
        await updateDeploySession({ id: rec.id, payloadPatch: { [stageKey]: stageHash } })
      }
    }
    if (!stageHash) {
      if (step === 'phase2_core_sent' && shouldSkipPhase2Core) {
        await markReplaySkip('phase2Core')
        const confirmed = await transitionDeploySession({
          id: rec.id,
          fromStep: 'phase2_core_sent',
          toStep: 'phase2_core_confirmed',
          lastTxHash: null,
          lastError: null,
        })
        if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
        await startAfterPhase2Core('phase2_core_confirmed')
        return undefined
      }
      if ((step === PHASE2_FINALIZE_SENT_STEP || step === 'phase2_sent') && shouldSkipPhase2Finalize) {
        await markReplaySkip('phase2Finalize')
        const confirmed = await transitionDeploySession({
          id: rec.id,
          fromStep: step as any,
          toStep: PHASE2_FINALIZE_CONFIRMED_STEP,
          lastTxHash: null,
          lastError: null,
        })
        if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
        await startOrCompleteAfterPhase2(PHASE2_FINALIZE_CONFIRMED_STEP)
        return undefined
      }
      if (step !== 'cleanup_sent') {
        await dispatchSentStage(step)
      }
      return undefined
    }
    const receipt = await bundlerClient.getUserOperationReceipt({ hash: stageHash }).catch(() => null)
    return receipt?.receipt?.transactionHash as Hex | undefined
  }

  if (needsReceipt) {
    txHash = await resolveReceiptTxHash()
    if (!txHash) return
  }

  if (step === 'cleanup_sent') {
    const transitioned = await transitionDeploySession({
      id: rec.id,
      fromStep: 'cleanup_sent',
      toStep: 'cancelled',
      lastTxHash: txHash,
      lastError: null,
    })
    if (!transitioned) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase1_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_sent',
      toStep: 'phase1_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && !hasPhase2Finalize && !hasPostPhase2,
      )
      return
    }
    await startFromPhase2('phase1_confirmed')
    return
  }

  if (step === 'phase1_finalize_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase1_finalize_sent',
      toStep: 'phase1_finalize_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)

    await startFromPhase2('phase1_finalize_confirmed')
    return
  }

  if (step === 'phase2_core_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase2_core_sent',
      toStep: 'phase2_core_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    await startAfterPhase2Core('phase2_core_confirmed')
    return
  }

  if (step === PHASE2_FINALIZE_SENT_STEP || step === 'phase2_sent') {
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: step as any,
      toStep: PHASE2_FINALIZE_CONFIRMED_STEP,
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    await startOrCompleteAfterPhase2(PHASE2_FINALIZE_CONFIRMED_STEP)
    return
  }

  if (step === 'ovault_mesh_sent') {
    const ovault = await ensureSolanaRouteReadyForPhase3({
      req,
      publicClient,
      phase2FinalizeCalls,
      solanaOvault: payload.solanaOvault,
    })
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'ovault_mesh_sent',
      toStep: 'ovault_mesh_confirmed',
      lastError: null,
      payloadPatch: { ovault },
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    payload.ovault = ovault
    await startNextAfterPhase2('ovault_mesh_confirmed')
    return
  }

  if (step === 'phase3_sent') {
    const ajnaAdminAlignment = await verifyPhase3PostState({
      publicClient,
      phase3Calls,
    })
    const phase3DeployInfo = extractPhase3DeployInfo(phase3Calls)
    if (
      phase3DeployInfo &&
      ajnaAdminAlignment.ajnaStrategyAdapter &&
      ajnaAdminAlignment.ajnaInnerVault &&
      ajnaAdminAlignment.ajnaAuthAddress &&
      ajnaAdminAlignment.ajnaPool
    ) {
      const row = await upsertAjnaVaultRegistryEntry({
        chainId: DEFAULT_CHAIN_ID,
        creatorToken: phase3DeployInfo.creatorToken,
        creatorVault: phase3DeployInfo.vault,
        strategyAdapter: ajnaAdminAlignment.ajnaStrategyAdapter,
        innerAjnaVault: ajnaAdminAlignment.ajnaInnerVault,
        ajnaAuth: ajnaAdminAlignment.ajnaAuthAddress,
        ajnaPool: ajnaAdminAlignment.ajnaPool,
        ownerAddress: phase3DeployInfo.owner,
        bufferRatioBps: ajnaAdminAlignment.ajnaBufferRatioBps ?? null,
        minBucketIndex: ajnaAdminAlignment.ajnaMinBucketIndex ?? null,
        metadata: {
          source: 'deploy_session_phase3_confirm',
          deploySessionId: rec.id,
        },
      })
      if (isDbConfigured() && !row) {
        console.warn('[deploy/session/status] ajna registry write unavailable', {
          sessionId: rec.id,
          creatorToken: phase3DeployInfo.creatorToken,
          strategyAdapter: ajnaAdminAlignment.ajnaStrategyAdapter,
        })
      }
    }
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase3_sent',
      toStep: 'phase3_confirmed',
      lastTxHash: txHash,
      payloadPatch: { [PHASE3_AJNA_ADMIN_ALIGNMENT_KEY]: ajnaAdminAlignment },
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_sent') {
    await verifyPhase4PostState({
      publicClient,
      phase2FinalizeCalls,
      phase4Calls,
      txHash,
    })
    const confirmed = await transitionDeploySession({
      id: rec.id,
      fromStep: 'phase4_sent',
      toStep: 'phase4_confirmed',
      lastTxHash: txHash,
    })
    if (!confirmed) throw new Error(CONCURRENT_MODIFICATION)
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  // Resume-safe advancement for sessions that already reached a confirmed state.
  if (step === 'phase1_confirmed') {
    if (phase1FinalizeCalls.length > 0) {
      await startStage(
        'phase1_confirmed',
        'phase1_finalize_sent',
        phase1FinalizeCalls,
        phase2CoreCalls.length === 0 && phase2FinalizeCalls.length === 0 && !hasPostPhase2,
      )
      return
    }
    await startFromPhase2('phase1_confirmed')
    return
  }

  if (step === 'phase1_finalize_confirmed') {
    await startFromPhase2('phase1_finalize_confirmed')
    return
  }

  if (step === 'phase2_core_confirmed') {
    await startAfterPhase2Core('phase2_core_confirmed')
    return
  }

  if (step === PHASE2_FINALIZE_CONFIRMED_STEP || step === 'phase2_confirmed') {
    await startOrCompleteAfterPhase2(step)
    return
  }

  if (step === 'ovault_mesh_confirmed') {
    await startNextAfterPhase2('ovault_mesh_confirmed')
    return
  }

  if (step === 'phase3_confirmed') {
    if (hasPhase4) {
      await startStage('phase3_confirmed', 'phase4_sent', phase4Calls, true)
      return
    }
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase3_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }

  if (step === 'phase4_confirmed') {
    const completed = await transitionDeploySession({ id: rec.id, fromStep: 'phase4_confirmed', toStep: 'completed' })
    if (!completed) throw new Error(CONCURRENT_MODIFICATION)
    return
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }
  const limiter = checkRateLimit(
    rateLimitKey('deploy-session-status', auth.address.toLowerCase()),
    RATE_LIMITS.deploySessionStatus,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many status checks' } satisfies ApiEnvelope<null>)
  }

  const body = ((await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) ?? {}) as StatusRequest
  const sessionId = normalizeDeploySessionId(body?.sessionId)
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' } satisfies ApiEnvelope<null>)

  let rec!: NonNullable<Awaited<ReturnType<typeof getDeploySessionById>>>
  let sessionAddress!: Address
  try {
    const access = await loadAuthorizedDeploySession({
      req,
      sessionId,
      getDeploySessionById,
    })
    rec = access.rec
    sessionAddress = access.sessionAddress
  } catch (error) {
    if (error instanceof DeploySessionAccessError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    throw error
  }

  const isTerminalStep = ['cancelled', 'completed', 'failed'].includes(String(rec.step ?? ''))
  if (isSessionExpired(rec.expiresAt) && !isTerminalStep) {
    const expiredAt = new Date().toISOString()
    try {
      await updateDeploySession({
        id: rec.id,
        step: 'failed',
        lastError: SESSION_EXPIRED_RESTART_REQUIRED,
        payloadPatch: {
          [SESSION_EXPIRED_AT_KEY]: expiredAt,
          [SESSION_EXPIRED_REASON_KEY]: SESSION_EXPIRED_RESTART_REQUIRED,
        },
      })
      rec = (await getDeploySessionById(sessionId)) ?? rec
    } catch {
      rec = {
        ...rec,
        step: 'failed',
        lastError: SESSION_EXPIRED_RESTART_REQUIRED,
      }
    }
  } else if (!isSessionExpired(rec.expiresAt)) {
    try {
      await advanceDeploySession(rec, req)
      rec = (await getDeploySessionById(sessionId)) ?? rec
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? 'deploy_session_advance_failed')
      if (err instanceof Error && (err.message === 'deploy_payload_invalid' || err.message.endsWith('_calls_invalid'))) {
        return res.status(409).json({
          success: false,
          error: 'Deploy session payload is invalid or missing required stage calls. Please restart deploy session.',
        } satisfies ApiEnvelope<null>)
      }
      if (err instanceof Error && err.message === CONCURRENT_MODIFICATION) {
        return res.status(409).json({ success: false, error: 'Concurrent modification' } satisfies ApiEnvelope<null>)
      }
      if (err instanceof Error && err.message === 'cdp_endpoint_missing_on_vercel') {
        return res.status(503).json({
          success: false,
          error:
            'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint; do not rely on same-origin /api/paymaster for server-side deploy-session calls.',
        } satisfies ApiEnvelope<null>)
      }
      if (err instanceof Error && err.message.startsWith('phase2_invariant_failed:')) {
        try {
          await updateDeploySession({
            id: rec.id,
            step: 'failed',
            lastError: errMsg,
          })
          rec = (await getDeploySessionById(sessionId)) ?? rec
        } catch {
          rec = {
            ...rec,
            step: 'failed',
            lastError: errMsg,
          }
        }
      }
      try {
        let serializedErr = ''
        try {
          serializedErr = JSON.stringify(err)
        } catch {
          serializedErr = ''
        }
        const advanceDebug = buildUserOpErrorDebug({
          err,
          sessionId: rec.id,
          stage: rec.step,
          calls: null,
        })
        const revertLike =
          isOnchainRevertLike(errMsg) ||
          isOnchainRevertLike(serializedErr) ||
          Boolean(advanceDebug.revertData || advanceDebug.selector)
        await updateDeploySession({
          id: rec.id,
          lastError: errMsg,
          ...(revertLike ? { payloadPatch: { lastErrorDebug: advanceDebug } } : {}),
        })
        rec = (await getDeploySessionById(sessionId)) ?? rec
      } catch {
        rec = {
          ...rec,
          lastError: errMsg,
        }
      }
      if (
        err instanceof Error &&
        (err.message === 'deploy_signer_wallet_unavailable' ||
          err.message === 'session_signer_unavailable' ||
          err.message === 'session_signer_key_missing' ||
          err.message === 'session_owner_unavailable' ||
          err.message === 'session_owner_key_missing')
      ) {
        // Legacy/broken session: keep status readable without failing the endpoint.
        rec = {
          ...rec,
          lastError: rec.lastError || 'session_signer_unavailable',
        }
      }
      // Best-effort: if background advancement fails, still return current state.
    }
  }

  const ovaultEnabled =
    isPlainObject(rec?.payload?.solanaOvault) && rec.payload.solanaOvault.enabled === true
  const ovaultRaw = isPlainObject(rec?.payload?.ovault) ? rec.payload.ovault : {}
  const phase3AjnaAdminAlignment = readPhase3AjnaAdminAlignment(rec?.payload)
  const launchImage = readLaunchImageStatus(rec?.payload)

  // Best-effort: if enabled, persist newly deployed ShareOFT addresses so a stable
  // managed tokenlist can include them once Uniswap/tokenlists ingestion approves.
  if (
    process.env.MANAGED_TOKENLIST_INGEST_ON_DEPLOY === 'true' &&
    String(rec?.step ?? '') === 'completed' &&
    launchImage?.shareOft
  ) {
    try {
      await ingestShareOftIntoManagedTokenlist(DEFAULT_CHAIN_ID, launchImage.shareOft)
    } catch {
      // Never block deploy status reads on tokenlist ingestion.
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      id: rec.id,
      step: rec.step,
      expiresAt: rec.expiresAt,
      lastError: rec.lastError,
      lastUserOpHash: rec.lastUserOpHash,
      lastTxHash: rec.lastTxHash,
      smartWallet: rec.smartWallet,
      sessionSignerAddress: rec.sessionSigner,
      sessionSignerWalletId:
        (typeof rec?.payload?.deploySignerWalletId === 'string' && rec.payload.deploySignerWalletId.trim()) || null,
      diagnostics: buildSessionDiagnostics(rec),
      phase3AjnaAdminAlignment,
      phase2InvariantGate:
        isPlainObject(rec?.payload?.[PHASE2_INVARIANT_GATE_KEY]) ? rec.payload[PHASE2_INVARIANT_GATE_KEY] : null,
      launchImage,
      ovault: ovaultEnabled
        ? {
            existingMintCompatible: ovaultRaw.existingMintCompatible === false ? false : true,
            depositEligible: ovaultRaw.depositEligible === false ? false : true,
            redeemEligible: ovaultRaw.redeemEligible === false ? false : true,
            assetPeerSet: ovaultRaw.assetPeerSet === false ? false : true,
            sharePeerSet: ovaultRaw.sharePeerSet === false ? false : true,
            meshStep:
              typeof ovaultRaw.meshStep === 'string' && ovaultRaw.meshStep.trim()
                ? ovaultRaw.meshStep.trim()
                : null,
          }
        : null,
    },
  } satisfies ApiEnvelope<any>)
}
