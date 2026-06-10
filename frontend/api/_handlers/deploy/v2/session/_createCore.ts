import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  createPublicClient,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'

import { isShareOftSaltOverrideDisabledBatcher } from '../../../../../src/config/contracts.defaults.js'
import { attachFinalizeShareBridgeValueToCalls } from '../../../../../src/lib/deploy/finalizeShareBridgeFee.js'
import {
  CREATOR_OVAULT_MODULE_STORAGE_V2,
  CREATOR_OVAULT_MODULE_STORAGE_V3,
} from '../../../../../src/lib/deploy/ovaultModuleIdentity.js'
import {
  resolveAlignedPhase1DeployDeps,
  resolveBytecodeStoreForBatcher,
  resolveCreate2DeployerForBatcher,
  resolveWiredCreatorOvaultModules,
} from '../../../../../src/lib/deploy/phase1ModuleDeploy.js'
import { assertShareBridgeOftWiringForFinalize } from '../../../../../src/lib/deploy/shareBridgeOftWiring.js'
import { assertPhase3HelperCreate2Authorization } from '../../../../../server/_lib/deploy/ensurePhase3HelperCreate2Authorization.js'
import { ensurePhase3DryRunForkPrep } from '../../../../../server/_lib/deploy/ensurePhase3DryRunForkPrep.js'
import { isLocalForkRpcUrl, resolveDeploySessionRpcUrl } from './deploySessionRpc.js'
import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  isDbConfigured,
  getDb,
  checkRateLimit,
  checkDurableRateLimit,
  RATE_LIMITS,
  rateLimitKey,
} from '@4626/server-core'

import { ensureDeploySessionsSchema, hashDeployToken, insertDeploySession, randomDeployToken, randomId } from '../../../../../server/_lib/deploy/deploySessions.js'

import { ensureWaitlistSchema } from '../../../../../server/_lib/onboarding/waitlistSchema.js'

import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../../server/_lib/db/supabaseAdmin.js'
import { getOrCreateCreatorAgentWallet } from '../../../../../server/_lib/wallet/creatorAgentWallets.js'
import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'
import { buildDeployPermissionGrant } from '../../../../../server/_lib/deploy/erc7712Permissions.js'
import { getCanonicalOrigin } from '../../../../../server/_lib/infra/origin.js'
import { resolveCoinPartiesAndOwner } from '../../../../../server/_lib/onchain/coinParties.js'
import { charmPoolNotIndexedError, extractCharmCreateVaultPool, isCharmPoolIndexed } from '../../../../../server/_lib/deploy/charmVaults.js'
import { readProfileWalletAuthority } from '../../../../../server/_lib/wallet/canonicalWalletResolver.js'
import { isServerAdminAddress } from '../../../../../server/_lib/infra/trust.js'
import {
  normalizeSolanaAssetMintOrigin,
} from '../../../../../server/_lib/onchain/solanaOvaultCompatibility.js'
import {
  DEPLOY_VANITY_ALLOWED_LENGTHS,
} from '../../../../../server/_lib/creatorStrategy/catalog.js'
import {
  DEPLOY_FEATURE_POLICY_MATRIX,
  hasAnyFeatureActivation,
  listActiveCreatorFeatureKeys,
  missingDeployVanityFeatureHints,
  readPolicyFlagEnabled,
  validateFeatureCompatibility,
} from '../../../../../server/_lib/deploy/featurePolicy/policy.js'
import { hasContractBytecode } from '../../../../../shared/wallet/bytecode.js'
import {
  isDeprecatedCreatorVaultBatcherAddress,
} from '../../../../../src/config/contracts.defaults.js'
import { deploymentBatcherNotConfiguredMessage } from '../../../../../server/_lib/onchain/deploymentBatcherConfigError.js'
import { DEPLOY_BYTECODE } from '../../../../../src/deploy/bytecode.generated.js'

export type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

// JSON comes over the wire, so `value` may be a string/number.
export type Call = { to: Address; value?: bigint | number | string; data: Hex }

type SolanaOvaultRequest = {
  enabled?: boolean
  assetMintOrigin?: 'existing' | 'new'
  assetMeshMint?: string
  shareMeshMint?: string
  solanaEid?: number | string
  mintCompatibilityHints?: unknown
}

type DeployVanityRequest = {
  vaultPrefix?: string | null
  shareSuffix?: string | null
}

export type CreateDeploySessionRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  // Optional preflight mode:
  // validate auth + ownership + allowlist without creating a deploy session.
  preflightOnly?: boolean
  // Calls that the server will submit after the user approves a one-time setup
  // transaction that installs `sessionSigner` as a temporary onchain CSW owner.
  // These calls are executed by the Coinbase Smart Wallet via ERC-4337.
  // New (preferred): split Phase 2 into multiple UserOps server-side.
  phase1Calls?: Call[]
  phase2CoreCalls?: Call[]
  phase2FinalizeCalls?: Call[]
  // Phase 3 (strategies) + Phase 4 (deferred auction) are also executed server-side.
  phase3Calls?: Call[]
  phase4Calls?: Call[]
  solanaOvault?: SolanaOvaultRequest
  vanity?: DeployVanityRequest
  // Optional metadata for debugging/UI.
  version?: string
  // Optional per-session invariant expectations (preferred over env defaults).
  expectedTradeFeeCollector?: Address
  expectedPayoutRecipientMode?: 'gauge' | 'payout_router'
  expectedPayoutRecipient?: Address
  rolePolicyId?: number | string
}

type CreateDeploySessionResponse = {
  sessionId: string
  sessionSignerAddress: Address
  sessionSignerWalletId?: string
  expiresAt: string
}

type DeployPhase2InvariantExpectations = {
  expectedTradeFeeCollector?: Address
  expectedPayoutRecipientMode?: 'gauge' | 'payout_router'
  expectedPayoutRecipient?: Address
}

export class DeploySessionRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DeploySessionRequestError'
    this.status = status
  }
}

export type ValidatedDeploySessionRequest = {
  sessionAddress: Address
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  authType: 'session' | 'siwa'
  phase1Calls: Call[]
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  phase3Calls: Call[]
  phase4Calls: Call[]
  solanaOvault: Record<string, unknown> | null
  vanity: { vaultPrefix: string | null; shareSuffix: string | null }
  hasPhase2Finalize: boolean
  version: string
  phase2InvariantExpectations: DeployPhase2InvariantExpectations | null
  rolePolicyId: number | null
  rolePolicySource: 'request' | 'creator_default' | 'global_default' | 'none'
}

type OwnershipCheck = {
  ok: boolean
  reason?: string
}

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex
const PHASE1_SELECTOR_DEPLOY = '0x3c51ca4e'
const PHASE1_SELECTOR_CORE = '0x1331378b'
const PHASE1_SELECTOR_FINALIZE = '0xa98ec9d8'
const PHASE1_SELECTOR_DEPLOY_WITH_SALT = '0x297cb1e6'
const PHASE1_SELECTOR_CORE_WITH_SALT = '0x4154f24e'
const PHASE1_SELECTOR_FINALIZE_WITH_SALT = '0x3bc09a8b'
const SELECTOR_CREATE2_DEPLOY_FROM_STORE = '0xd76fad23'
const PHASE1_WITH_SALT_SELECTORS = new Set<string>([
  PHASE1_SELECTOR_DEPLOY_WITH_SALT,
  PHASE1_SELECTOR_CORE_WITH_SALT,
  PHASE1_SELECTOR_FINALIZE_WITH_SALT,
])
const BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR = 'e7fdf838'
const UNIVERSAL_CREATE2_FACTORY = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
const EXPECTED_VAULT_MODULE_STORAGE_VERSION = keccak256(encodePacked(['string'], ['CreatorOVaultModuleStorage.v3']))
const EXPECTED_VAULT_CORE_MODULE_KIND = keccak256(encodePacked(['string'], ['CreatorOVaultModule.core']))
const EXPECTED_VAULT_STRATEGIES_MODULE_KIND = keccak256(encodePacked(['string'], ['CreatorOVaultModule.strategies']))
const EXPECTED_VAULT_ADMIN_MODULE_KIND = keccak256(encodePacked(['string'], ['CreatorOVaultModule.admin']))
const DEFAULT_FREE_VAULT_VANITY_PREFIX = '4626'
const DEFAULT_FREE_SHARE_VANITY_SUFFIX = '4626'
const DEFAULT_DEPLOY_VANITY_CUSTOM_MAX_HEX = 5
const PHASE1_EXPECTED_CODE_IDS = {
  vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
  wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
  shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
  gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
  cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
  oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
  oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
} as const

const PHASE1_PARAMS_COMPONENTS = [
  { name: 'creatorToken', type: 'address' },
  { name: 'owner', type: 'address' },
  { name: 'vaultName', type: 'string' },
  { name: 'vaultSymbol', type: 'string' },
  { name: 'shareName', type: 'string' },
  { name: 'shareSymbol', type: 'string' },
  { name: 'version', type: 'string' },
] as const

const PHASE1_CODE_IDS_COMPONENTS = [
  { name: 'vault', type: 'bytes32' },
  { name: 'wrapper', type: 'bytes32' },
  { name: 'shareOFT', type: 'bytes32' },
  { name: 'gauge', type: 'bytes32' },
  { name: 'cca', type: 'bytes32' },
  { name: 'oracle', type: 'bytes32' },
  { name: 'oftBootstrap', type: 'bytes32' },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1CoreWithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'finalizePhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_ABI = [
  {
    type: 'function',
    name: 'deployPhase1',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase1Core',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI = [
  {
    type: 'function',
    name: 'finalizePhase1',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE1_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE1_CODE_IDS_COMPONENTS },
    ],
    outputs: [{ name: 'out', type: 'tuple', components: [] }],
  },
] as const

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
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

const CREATOR_VAULT_BATCHER_OVAULT_RUNTIME_VIEW_ABI = [
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

const CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
] as const

const CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI = [
  {
    type: 'function',
    name: 'deployPhase2CoreWithRolePolicy',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      { name: 'rolePolicyId', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
] as const

const CREATOR_VAULT_BATCHER_PENDING_AUCTION_ABI = [
  {
    type: 'function',
    name: 'pendingAuctions',
    stateMutability: 'view',
    inputs: [{ name: 'salt', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'shareToken', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
] as const

function deriveBaseSalt(params: { creatorToken: Address; owner: Address; chainId: number; version: string }): Hex {
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      params.creatorToken,
      params.owner,
      BigInt(params.chainId),
      `4626:deploy:${params.version}`,
    ]),
  ) as Hex
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
  // Safe default: cleanup temporary deploy signer unless explicitly opted in.
  return isTruthyEnv(process.env.DEPLOY_SESSION_PERSIST_OWNER, false)
}

const DEFAULT_DEPLOY_SESSION_TTL_MINUTES = 45
const MIN_DEPLOY_SESSION_TTL_MINUTES = 5
const MAX_DEPLOY_SESSION_TTL_MINUTES = 240

function readDeploySessionTtlMinutes(): number {
  const raw = String(process.env.DEPLOY_SESSION_TTL_MINUTES ?? '').trim()
  if (!raw) return DEFAULT_DEPLOY_SESSION_TTL_MINUTES
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEPLOY_SESSION_TTL_MINUTES
  const wholeMinutes = Math.floor(parsed)
  return Math.min(MAX_DEPLOY_SESSION_TTL_MINUTES, Math.max(MIN_DEPLOY_SESSION_TTL_MINUTES, wholeMinutes))
}

function readDeploySessionTtlMs(): number {
  return readDeploySessionTtlMinutes() * 60 * 1000
}

function parseUInt32Like(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 4_294_967_295) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 4_294_967_295) {
      return Math.floor(parsed)
    }
  }
  return null
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

function normalizeAddressOrNull(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const addr = getAddress(value as Address)
  return addr.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : addr
}

function normalizeHexVanityPattern(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const cleaned = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!cleaned) return null
  if (cleaned.length > 40) return null
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null
  return cleaned.toLowerCase()
}

function readDeployVanityCustomMaxHex(): number {
  const raw = String(process.env.DEPLOY_VANITY_CUSTOM_MAX_HEX ?? '').trim()
  if (!raw) return DEFAULT_DEPLOY_VANITY_CUSTOM_MAX_HEX
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEPLOY_VANITY_CUSTOM_MAX_HEX
  // Keep this bounded so custom vanity remains economically predictable.
  return Math.min(5, Math.max(1, Math.floor(parsed)))
}

function isFreeDefaultVaultPrefix(value: string | null): boolean {
  return String(value ?? '') === DEFAULT_FREE_VAULT_VANITY_PREFIX
}

function isFreeDefaultShareSuffix(value: string | null): boolean {
  return String(value ?? '') === DEFAULT_FREE_SHARE_VANITY_SUFFIX
}

function isCustomVaultPrefix(value: string | null): boolean {
  return Boolean(value) && !isFreeDefaultVaultPrefix(value)
}

function isCustomShareSuffix(value: string | null): boolean {
  return Boolean(value) && !isFreeDefaultShareSuffix(value)
}

function assertVanityCustomLength(params: {
  value: string | null
  label: 'vaultPrefix' | 'shareSuffix'
  isCustom: boolean
  maxHexChars: number
}): void {
  if (!params.value || !params.isCustom) return
  if (params.value.length <= params.maxHexChars) return
  throw new DeploySessionRequestError(
    400,
    `${params.label} custom vanity supports up to ${params.maxHexChars} hex characters (0-9, a-f).`,
  )
}

function normalizeDeployVanityRequest(value: unknown): { vaultPrefix: string | null; shareSuffix: string | null } {
  if (!value || typeof value !== 'object') {
    return { vaultPrefix: null, shareSuffix: null }
  }
  const raw = value as Record<string, unknown>
  return {
    vaultPrefix: normalizeHexVanityPattern(raw.vaultPrefix),
    shareSuffix: normalizeHexVanityPattern(raw.shareSuffix),
  }
}

function hasPhase1SaltOverrideCalls(calls: Call[]): boolean {
  for (const call of calls) {
    const data = typeof call?.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10) continue
    const selector = data.slice(0, 10)
    if (!PHASE1_WITH_SALT_SELECTORS.has(selector)) continue
    try {
      if (selector === PHASE1_SELECTOR_DEPLOY_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
          data: data as Hex,
        })
        const shareOftSaltOverride = decoded.args?.[2]
        if (
          typeof shareOftSaltOverride === 'string' &&
          /^0x[0-9a-f]{64}$/i.test(shareOftSaltOverride) &&
          !/^0x0{64}$/i.test(shareOftSaltOverride)
        ) {
          return true
        }
        continue
      }
      if (selector === PHASE1_SELECTOR_CORE_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
          data: data as Hex,
        })
        const shareOftSaltOverride = decoded.args?.[2]
        if (
          typeof shareOftSaltOverride === 'string' &&
          /^0x[0-9a-f]{64}$/i.test(shareOftSaltOverride) &&
          !/^0x0{64}$/i.test(shareOftSaltOverride)
        ) {
          return true
        }
        continue
      }
      if (selector === PHASE1_SELECTOR_FINALIZE_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
          data: data as Hex,
        })
        const shareOftSaltOverride = decoded.args?.[2]
        if (
          typeof shareOftSaltOverride === 'string' &&
          /^0x[0-9a-f]{64}$/i.test(shareOftSaltOverride) &&
          !/^0x0{64}$/i.test(shareOftSaltOverride)
        ) {
          return true
        }
      }
    } catch {
      // If malformed calldata is passed with a salted selector, keep conservative anti-bypass behavior.
      return true
    }
  }
  return false
}

function rewritePhase1SaltCallToZeroOverride(call: Call): Call {
  const data = typeof call?.data === 'string' ? call.data.trim() : ''
  if (!data.startsWith('0x') || data.length < 10) return call
  const selector = data.slice(0, 10).toLowerCase()
  const zeroOverride = `0x${'00'.repeat(32)}` as Hex
  try {
    if (selector === PHASE1_SELECTOR_DEPLOY_WITH_SALT) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
          functionName: 'deployPhase1WithSalt',
          args: [params as any, codeIds as any, zeroOverride],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_CORE_WITH_SALT) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
          functionName: 'deployPhase1CoreWithSalt',
          args: [params as any, codeIds as any, zeroOverride],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_FINALIZE_WITH_SALT) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
          functionName: 'finalizePhase1WithSalt',
          args: [params as any, codeIds as any, zeroOverride],
        }) as Hex,
      }
    }
  } catch {
    return call
  }
  return call
}

function rewritePhase1CallToWithSaltZeroOverride(call: Call): Call {
  const data = typeof call?.data === 'string' ? call.data.trim() : ''
  if (!data.startsWith('0x') || data.length < 10) return call
  const selector = data.slice(0, 10).toLowerCase()
  try {
    if (selector === PHASE1_SELECTOR_DEPLOY) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
          functionName: 'deployPhase1WithSalt',
          args: [params as any, codeIds as any, ZERO_BYTES32],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_CORE) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
          functionName: 'deployPhase1CoreWithSalt',
          args: [params as any, codeIds as any, ZERO_BYTES32],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_FINALIZE) {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI,
        data: data as Hex,
      })
      const params = decoded.args?.[0]
      const codeIds = decoded.args?.[1]
      if (!params || !codeIds) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
          functionName: 'finalizePhase1WithSalt',
          args: [params as any, codeIds as any, ZERO_BYTES32],
        }) as Hex,
      }
    }
  } catch {
    return call
  }
  return call
}

async function normalizePhase1EntrypointCalls(calls: Call[]): Promise<{ calls: Call[]; rewrote: boolean }> {
  if (!Array.isArray(calls) || calls.length === 0) return { calls: [], rewrote: false }

  const targetAddresses = new Set<string>()
  for (const call of calls) {
    const data = typeof call?.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10 || !call?.to || !isAddress(call.to)) continue
    const selector = data.slice(0, 10)
    if (selector === PHASE1_SELECTOR_DEPLOY || selector === PHASE1_SELECTOR_CORE || selector === PHASE1_SELECTOR_FINALIZE) {
      targetAddresses.add(getAddress(call.to as Address).toLowerCase())
    }
  }
  if (targetAddresses.size === 0) return { calls, rewrote: false }

  const rpc = resolveDeploySessionRpcUrl()
  const readClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })

  type EntrypointSupport = {
    deployNoSalt: boolean
    deployWithSalt: boolean
    coreNoSalt: boolean
    coreWithSalt: boolean
    finalizeNoSalt: boolean
    finalizeWithSalt: boolean
  }
  const supportByTarget = new Map<string, EntrypointSupport>()
  for (const target of targetAddresses) {
    let bytecodeLower = ''
    try {
      const bytecode = await readClient.getBytecode({ address: getAddress(target as Address) })
      bytecodeLower = String(bytecode ?? '').toLowerCase()
    } catch {
      bytecodeLower = ''
    }
    supportByTarget.set(target, {
      deployNoSalt: bytecodeLower.includes(PHASE1_SELECTOR_DEPLOY.slice(2)),
      deployWithSalt: bytecodeLower.includes(PHASE1_SELECTOR_DEPLOY_WITH_SALT.slice(2)),
      coreNoSalt: bytecodeLower.includes(PHASE1_SELECTOR_CORE.slice(2)),
      coreWithSalt: bytecodeLower.includes(PHASE1_SELECTOR_CORE_WITH_SALT.slice(2)),
      finalizeNoSalt: bytecodeLower.includes(PHASE1_SELECTOR_FINALIZE.slice(2)),
      finalizeWithSalt: bytecodeLower.includes(PHASE1_SELECTOR_FINALIZE_WITH_SALT.slice(2)),
    })
  }

  let rewrote = false
  const normalized = calls.map((call) => {
    if (!call?.to || !isAddress(call.to)) return call
    const data = typeof call?.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10) return call
    const selector = data.slice(0, 10)
    const target = getAddress(call.to as Address).toLowerCase()
    const support = supportByTarget.get(target)
    if (!support) return call

    const shouldRewrite =
      (selector === PHASE1_SELECTOR_DEPLOY && !support.deployNoSalt && support.deployWithSalt) ||
      (selector === PHASE1_SELECTOR_CORE && !support.coreNoSalt && support.coreWithSalt) ||
      (selector === PHASE1_SELECTOR_FINALIZE && !support.finalizeNoSalt && support.finalizeWithSalt)
    if (!shouldRewrite) return call

    const rewritten = rewritePhase1CallToWithSaltZeroOverride(call)
    if (rewritten.data !== call.data) rewrote = true
    return rewritten
  })

  return { calls: normalized, rewrote }
}

async function normalizePhase1SaltOverrideCalls(calls: Call[]): Promise<{ calls: Call[]; rewrote: boolean }> {
  if (!Array.isArray(calls) || calls.length === 0) return { calls: [], rewrote: false }
  const saltedTargets = new Set<string>()
  for (const call of calls) {
    const data = typeof call?.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10) continue
    const selector = data.slice(0, 10)
    if (!PHASE1_WITH_SALT_SELECTORS.has(selector)) continue
    if (!call?.to || !isAddress(call.to)) continue
    saltedTargets.add(getAddress(call.to as Address).toLowerCase())
  }
  if (saltedTargets.size === 0) return { calls, rewrote: false }

  const rpc = resolveDeploySessionRpcUrl()
  const readClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })
  const saltDisabledTargets = new Set<string>()
  for (const targetLc of saltedTargets) {
    if (isShareOftSaltOverrideDisabledBatcher(targetLc)) {
      saltDisabledTargets.add(targetLc)
      continue
    }
    const bytecode = await readClient.getBytecode({ address: getAddress(targetLc as Address) }).catch(() => null)
    const bytecodeLower = String(bytecode ?? '').toLowerCase()
    if (bytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR)) {
      saltDisabledTargets.add(targetLc)
    }
  }
  if (saltDisabledTargets.size === 0) return { calls, rewrote: false }

  let rewrote = false
  const normalized = calls.map((call) => {
    if (!call?.to || !isAddress(call.to)) return call
    const targetLc = getAddress(call.to as Address).toLowerCase()
    if (!saltDisabledTargets.has(targetLc)) return call
    const rewritten = rewritePhase1SaltCallToZeroOverride(call)
    if (rewritten.data !== call.data) rewrote = true
    return rewritten
  })
  return { calls: normalized, rewrote }
}

type Phase1CodeIdsTuple = {
  vault?: Hex
  wrapper?: Hex
  shareOFT?: Hex
  gauge?: Hex
  cca?: Hex
  oracle?: Hex
  oftBootstrap?: Hex
} | null

function normalizePhase1CodeIdsTuple(codeIds: Phase1CodeIdsTuple): { codeIds: Phase1CodeIdsTuple; changed: boolean } {
  if (!codeIds || typeof codeIds !== 'object') return { codeIds, changed: false }
  let changed = false
  const normalized: Record<string, unknown> = { ...codeIds }
  const entries: Array<[keyof typeof PHASE1_EXPECTED_CODE_IDS, Hex]> = [
    ['vault', PHASE1_EXPECTED_CODE_IDS.vault],
    ['wrapper', PHASE1_EXPECTED_CODE_IDS.wrapper],
    ['shareOFT', PHASE1_EXPECTED_CODE_IDS.shareOFT],
    ['gauge', PHASE1_EXPECTED_CODE_IDS.gauge],
    ['cca', PHASE1_EXPECTED_CODE_IDS.cca],
    ['oracle', PHASE1_EXPECTED_CODE_IDS.oracle],
    ['oftBootstrap', PHASE1_EXPECTED_CODE_IDS.oftBootstrap],
  ]
  for (const [label, expected] of entries) {
    const current = normalized[label]
    if (typeof current !== 'string' || !current.startsWith('0x')) continue
    if (current.toLowerCase() === expected.toLowerCase()) continue
    normalized[label] = expected
    changed = true
  }
  return { codeIds: normalized as Phase1CodeIdsTuple, changed }
}

function rewritePhase1CallCodeIdsToCurrent(call: Call): Call {
  const data = typeof call?.data === 'string' ? call.data.trim() : ''
  if (!data.startsWith('0x') || data.length < 10) return call
  const selector = data.slice(0, 10).toLowerCase()
  try {
    if (selector === PHASE1_SELECTOR_DEPLOY) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      if (!params || !codeIds || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_ABI,
          functionName: 'deployPhase1',
          args: [params as any, codeIds as any],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_CORE) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      if (!params || !codeIds || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI,
          functionName: 'deployPhase1Core',
          args: [params as any, codeIds as any],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_FINALIZE) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      if (!params || !codeIds || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI,
          functionName: 'finalizePhase1',
          args: [params as any, codeIds as any],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_DEPLOY_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      const shareOftSaltOverride = decoded.args?.[2] as Hex | undefined
      if (!params || !codeIds || typeof shareOftSaltOverride !== 'string' || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
          functionName: 'deployPhase1WithSalt',
          args: [params as any, codeIds as any, shareOftSaltOverride],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_CORE_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      const shareOftSaltOverride = decoded.args?.[2] as Hex | undefined
      if (!params || !codeIds || typeof shareOftSaltOverride !== 'string' || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
          functionName: 'deployPhase1CoreWithSalt',
          args: [params as any, codeIds as any, shareOftSaltOverride],
        }) as Hex,
      }
    }
    if (selector === PHASE1_SELECTOR_FINALIZE_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI, data: data as Hex })
      const params = decoded.args?.[0]
      const { codeIds, changed } = normalizePhase1CodeIdsTuple((decoded.args?.[1] ?? null) as Phase1CodeIdsTuple)
      const shareOftSaltOverride = decoded.args?.[2] as Hex | undefined
      if (!params || !codeIds || typeof shareOftSaltOverride !== 'string' || !changed) return call
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
          functionName: 'finalizePhase1WithSalt',
          args: [params as any, codeIds as any, shareOftSaltOverride],
        }) as Hex,
      }
    }
  } catch {
    return call
  }
  return call
}

function normalizePhase1CodeIds(calls: Call[]): { calls: Call[]; rewrote: boolean } {
  if (!Array.isArray(calls) || calls.length === 0) return { calls: [], rewrote: false }
  let rewrote = false
  const normalized = calls.map((call) => {
    const rewritten = rewritePhase1CallCodeIdsToCurrent(call)
    if (rewritten.data !== call.data) rewrote = true
    return rewritten
  })
  return { calls: normalized, rewrote }
}

function decodePhase1CodeIdsFromCallData(data: Hex): Phase1CodeIdsTuple {
  const raw = typeof data === 'string' ? data.trim() : ''
  if (!raw.startsWith('0x') || raw.length < 10) return null
  const selector = raw.slice(0, 10).toLowerCase()
  try {
    if (selector === PHASE1_SELECTOR_DEPLOY) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
    if (selector === PHASE1_SELECTOR_CORE) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
    if (selector === PHASE1_SELECTOR_FINALIZE) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
    if (selector === PHASE1_SELECTOR_DEPLOY_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
    if (selector === PHASE1_SELECTOR_CORE_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
    if (selector === PHASE1_SELECTOR_FINALIZE_WITH_SALT) {
      const decoded = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI, data: raw as Hex })
      return (decoded.args?.[1] ?? null) as Phase1CodeIdsTuple
    }
  } catch {
    return null
  }
  return null
}

async function assertPhase1BatcherReadiness(phase1Calls: Call[]): Promise<void> {
  if (!Array.isArray(phase1Calls) || phase1Calls.length === 0) return

  const phase1Selectors = new Set<string>([
    PHASE1_SELECTOR_DEPLOY,
    PHASE1_SELECTOR_CORE,
    PHASE1_SELECTOR_FINALIZE,
    PHASE1_SELECTOR_DEPLOY_WITH_SALT,
    PHASE1_SELECTOR_CORE_WITH_SALT,
    PHASE1_SELECTOR_FINALIZE_WITH_SALT,
  ])
  const phase1BatcherCall = phase1Calls.find((call) => {
    if (!call?.to || !isAddress(call.to)) return false
    const data = typeof call.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10) return false
    return phase1Selectors.has(data.slice(0, 10))
  })
  if (!phase1BatcherCall || !isAddress(phase1BatcherCall.to)) return

  const batcherAddress = getAddress(phase1BatcherCall.to as Address)
  if (isDeprecatedCreatorVaultBatcherAddress(batcherAddress)) {
    throw new DeploySessionRequestError(409, deploymentBatcherNotConfiguredMessage(batcherAddress))
  }
  const rpc = resolveDeploySessionRpcUrl()
  const readClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })

  const BATCHER_DEPENDENCY_ABI = [
    { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'bytecodeStore', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  ] as const
  const CREATE2_AUTH_ABI = [
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    {
      type: 'function',
      name: 'authorizedDeployers',
      stateMutability: 'view',
      inputs: [{ name: 'deployer', type: 'address' }],
      outputs: [{ type: 'bool' }],
    },
  ] as const
  const BYTECODE_STORE_POINTER_ABI = [
    {
      type: 'function',
      name: 'pointers',
      stateMutability: 'view',
      inputs: [{ name: 'codeId', type: 'bytes32' }],
      outputs: [{ type: 'address' }],
    },
  ] as const
  const BYTECODE_STORE_CHUNKCOUNT_ABI = [
    {
      type: 'function',
      name: 'chunkCount',
      stateMutability: 'view',
      inputs: [{ name: 'codeId', type: 'bytes32' }],
      outputs: [{ type: 'uint256' }],
    },
  ] as const
  const BATCHER_VAULT_MODULES_ABI = [
    { type: 'function', name: 'vaultCoreModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'vaultStrategiesModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'vaultAdminModule', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  ] as const
  const MODULE_IDENTITY_ABI = [
    { type: 'function', name: 'moduleKind', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    { type: 'function', name: 'moduleStorageVersion', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  ] as const

  let create2Deployer: Address
  let bytecodeStore: Address
  try {
    const aligned = await resolveAlignedPhase1DeployDeps({
      publicClient: readClient,
      batcherAddress,
    })
    if (!aligned.ok) {
      throw new DeploySessionRequestError(409, `phase1 precheck failed: ${aligned.message}`)
    }
    create2Deployer = getAddress(aligned.create2Deployer)
    bytecodeStore = getAddress(aligned.bytecodeStore)
  } catch (error) {
    if (error instanceof DeploySessionRequestError) throw error
    throw new DeploySessionRequestError(
      409,
      `phase1 precheck failed: could not resolve create2 dependencies for batcher ${batcherAddress}.`,
    )
  }

  try {
    const [create2Owner, isAuthorized] = await Promise.all([
      readClient.readContract({
        address: create2Deployer,
        abi: CREATE2_AUTH_ABI,
        functionName: 'owner',
      }),
      readClient.readContract({
        address: create2Deployer,
        abi: CREATE2_AUTH_ABI,
        functionName: 'authorizedDeployers',
        args: [batcherAddress],
      }),
    ])
    if (!Boolean(isAuthorized)) {
      const ownerLower = String(create2Owner).toLowerCase()
      if (ownerLower === UNIVERSAL_CREATE2_FACTORY) {
        throw new DeploySessionRequestError(
          409,
          `phase1 precheck failed: batcher ${batcherAddress} is not authorized in create2Deployer ${create2Deployer} ` +
            `(owner ${String(create2Owner)}). This deployer is owned by the universal CREATE2 factory and its ` +
            `authorizedDeployers list cannot be updated post-deploy; rotate to a batcher wired to a deploy-capable ` +
            `create2Deployer, then retry.`,
        )
      }
      throw new DeploySessionRequestError(
        409,
        `phase1 precheck failed: batcher ${batcherAddress} is not authorized in create2Deployer ${create2Deployer} ` +
          `(owner ${String(create2Owner)}). Rotate to a deploy-capable batcher or authorize this batcher, then retry.`,
      )
    }
  } catch (error) {
    if (error instanceof DeploySessionRequestError) throw error
    // Some legacy deployers may not expose owner/authorizedDeployers; in that
    // case, skip this specific check and continue with bytecode presence checks.
  }

  // If batcher module getters exist, ensure they point to CreatorOVault-compatible
  // modules before we attempt phase1. This catches immutable module-mismatch
  // batchers up front (otherwise deployPhase1* reverts with InvalidModuleAddress()).
  try {
    const wiredModules = await resolveWiredCreatorOvaultModules({
      publicClient: readClient,
      batcherAddress,
    })
    if (!wiredModules) {
      throw new Error('could not resolve phase1 module wiring')
    }
    const { core: coreModule, strategies: strategiesModule, admin: adminModule } = wiredModules

    const moduleChecks: Array<{ label: 'core' | 'strategies' | 'admin'; address: Address; expectedKind: Hex }> = [
      { label: 'core', address: getAddress(coreModule), expectedKind: EXPECTED_VAULT_CORE_MODULE_KIND },
      { label: 'strategies', address: getAddress(strategiesModule), expectedKind: EXPECTED_VAULT_STRATEGIES_MODULE_KIND },
      { label: 'admin', address: getAddress(adminModule), expectedKind: EXPECTED_VAULT_ADMIN_MODULE_KIND },
    ]

    for (const moduleCheck of moduleChecks) {
      let moduleKind: Hex
      let moduleStorageVersion: Hex
      try {
        const [kindRead, storageVersionRead] = (await Promise.all([
          readClient.readContract({
            address: moduleCheck.address,
            abi: MODULE_IDENTITY_ABI,
            functionName: 'moduleKind',
          }),
          readClient.readContract({
            address: moduleCheck.address,
            abi: MODULE_IDENTITY_ABI,
            functionName: 'moduleStorageVersion',
          }),
        ])) as [Hex, Hex]
        moduleKind = kindRead
        moduleStorageVersion = storageVersionRead
      } catch {
        throw new DeploySessionRequestError(
          409,
          `phase1 precheck failed: batcher ${batcherAddress} ${moduleCheck.label} module ${moduleCheck.address} ` +
            `does not implement CreatorOVault module identity (InvalidModuleAddress). Rotate to a module-compatible batcher.`,
        )
      }

      if (
        moduleKind.toLowerCase() !== moduleCheck.expectedKind.toLowerCase() ||
        moduleStorageVersion.toLowerCase() !== EXPECTED_VAULT_MODULE_STORAGE_VERSION.toLowerCase()
      ) {
        const moduleIsV2 =
          moduleStorageVersion.toLowerCase() === CREATOR_OVAULT_MODULE_STORAGE_V2.toLowerCase()
        const v2Hint = moduleIsV2
          ? ' Live batcher Phase1Module still wires v2 modules while deploy bytecode expects v3 (v1.14.0). ' +
            'Rotate to the v1.14.0 v3 Phase1Module via setPhase1Module before greenfield deploy.'
          : ''
        throw new DeploySessionRequestError(
          409,
          `phase1 precheck failed: batcher ${batcherAddress} ${moduleCheck.label} module ${moduleCheck.address} ` +
            `is incompatible with current CreatorOVault module identity/version (InvalidModuleAddress).${v2Hint}`,
        )
      }
    }
  } catch (error) {
    if (error instanceof DeploySessionRequestError) throw error
    // Older batchers may not expose immutable module getters. If absent, keep
    // backwards compatibility and continue.
  }

  const requiredCodeIds = new Map<string, Hex>()
  for (const call of phase1Calls) {
    const codeIds = decodePhase1CodeIdsFromCallData(call.data)
    if (!codeIds) continue
    if (typeof codeIds.vault === 'string' && codeIds.vault.startsWith('0x')) requiredCodeIds.set('vault', codeIds.vault)
    if (typeof codeIds.wrapper === 'string' && codeIds.wrapper.startsWith('0x')) requiredCodeIds.set('wrapper', codeIds.wrapper)
    if (typeof codeIds.shareOFT === 'string' && codeIds.shareOFT.startsWith('0x')) requiredCodeIds.set('shareOFT', codeIds.shareOFT)
    if (typeof codeIds.oftBootstrap === 'string' && codeIds.oftBootstrap.startsWith('0x')) {
      requiredCodeIds.set('oftBootstrap', codeIds.oftBootstrap)
    }
  }
  if (requiredCodeIds.size === 0) return

  const missing: string[] = []
  for (const [label, codeId] of requiredCodeIds.entries()) {
    let hasCodeId = false
    try {
      const pointer = (await readClient.readContract({
        address: bytecodeStore,
        abi: BYTECODE_STORE_POINTER_ABI,
        functionName: 'pointers',
        args: [codeId],
      })) as Address
      hasCodeId = String(pointer).toLowerCase() !== ZERO_ADDRESS.toLowerCase()
    } catch {
      // Some store variants may not expose pointers(); fall back to chunkCount().
    }
    if (!hasCodeId) {
      try {
        const chunks = (await readClient.readContract({
          address: bytecodeStore,
          abi: BYTECODE_STORE_CHUNKCOUNT_ABI,
          functionName: 'chunkCount',
          args: [codeId],
        })) as bigint
        hasCodeId = chunks > 0n
      } catch {
        // Older stores may not expose chunkCount(); leave unresolved and report missing.
      }
    }
    if (!hasCodeId) {
      missing.push(`${label}:${codeId}`)
    }
  }
  if (missing.length > 0) {
    throw new DeploySessionRequestError(
      409,
      `phase1 precheck failed: bytecodeStore ${bytecodeStore} is missing required codeIds (${missing.join(', ')}).`,
    )
  }
}

function assertNoDirectCreate2DeployCalls(calls: Call[]): void {
  if (!Array.isArray(calls) || calls.length === 0) return

  for (const call of calls) {
    if (!call?.to || !isAddress(call.to)) continue
    const data = typeof call.data === 'string' ? call.data.trim().toLowerCase() : ''
    if (!data.startsWith('0x') || data.length < 10) continue
    if (data.slice(0, 10) !== SELECTOR_CREATE2_DEPLOY_FROM_STORE) continue
    throw new DeploySessionRequestError(
      409,
      `Direct create2 deploy calls are not allowed in deploy sessions. Route stored-bytecode deployments through DeploymentBatcher.`,
    )
  }
}

function isDeployVanityPaywallEnabled(): boolean {
  return readPolicyFlagEnabled('DEPLOY_VANITY_PAYWALL_ENABLED', true)
}

function isDeployOvaultMeshPaywallEnabled(): boolean {
  return readPolicyFlagEnabled('DEPLOY_OVAULT_MESH_PAYWALL_ENABLED', true)
}

function normalizeDeployVanityLength(value: number): number | null {
  const normalized = Math.floor(value)
  if (!Number.isFinite(normalized)) return null
  if (!DEPLOY_VANITY_ALLOWED_LENGTHS.includes(normalized as (typeof DEPLOY_VANITY_ALLOWED_LENGTHS)[number])) {
    return null
  }
  return normalized
}

function inferPayoutRecipientMode(value: unknown): 'gauge' | 'payout_router' | null {
  if (value === 'gauge' || value === 'payout_router') return value
  return null
}

function extractPhase2CoreInvariantInfo(data: Hex): {
  creatorToken: Address
  // Internal name kept close to ABI; represents creatorCoinPayoutRecipient (external earnings)
  payoutRecipient: Address | null
  rolePolicyId: bigint | null
} | null {
  for (const abi of [
    CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI,
    CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
  ] as const) {
    try {
      const decoded = decodeFunctionData({
        abi,
        data,
      })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        payoutRecipient?: string
      } | null
      const creatorToken = normalizeAddressOrNull(params?.creatorToken)
      if (!creatorToken) continue
      const rolePolicyIdRaw = decoded.args?.[2]
      const rolePolicyId = typeof rolePolicyIdRaw === 'bigint' ? rolePolicyIdRaw : null
      return {
        creatorToken,
        payoutRecipient: normalizeAddressOrNull(params?.payoutRecipient),
        rolePolicyId,
      }
    } catch {
      continue
    }
  }
  return null
}

function isDeployPhase2CoreCall(call: Call): boolean {
  for (const abi of [
    CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI,
    CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
  ] as const) {
    try {
      const decoded = decodeFunctionData({
        abi,
        data: call.data,
      })
      if (decoded.functionName === 'deployPhase2Core' || decoded.functionName === 'deployPhase2CoreWithRolePolicy') {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

function normalizePhase2CoreCalls(calls: Call[]): { calls: Call[]; rewrote: boolean } {
  if (!Array.isArray(calls) || calls.length === 0) return { calls: [], rewrote: false }
  const normalized: Call[] = []
  let seenDeployPhase2Core = false
  let rewrote = false

  for (const call of calls) {
    if (!isDeployPhase2CoreCall(call)) {
      normalized.push(call)
      continue
    }
    if (seenDeployPhase2Core) {
      rewrote = true
      continue
    }
    seenDeployPhase2Core = true
    normalized.push(call)
  }

  return { calls: normalized, rewrote }
}

function extractPhase1VersionFromCalls(calls: Call[]): string | null {
  if (!Array.isArray(calls) || calls.length === 0) return null

  for (const call of calls) {
    const data = typeof call?.data === 'string' ? call.data.trim() : ''
    if (!data.startsWith('0x') || data.length < 10) continue
    const selector = data.slice(0, 10).toLowerCase()
    try {
      if (selector === PHASE1_SELECTOR_DEPLOY || selector === PHASE1_SELECTOR_DEPLOY_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi:
            selector === PHASE1_SELECTOR_DEPLOY
              ? CREATOR_VAULT_BATCHER_PHASE1_ABI
              : CREATOR_VAULT_BATCHER_PHASE1_WITH_SALT_ABI,
          data: data as Hex,
        })
        const params = decoded.args?.[0] as { version?: string } | undefined
        const version = typeof params?.version === 'string' ? params.version.trim() : ''
        if (version) return version
      }
      if (selector === PHASE1_SELECTOR_CORE || selector === PHASE1_SELECTOR_CORE_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi:
            selector === PHASE1_SELECTOR_CORE
              ? CREATOR_VAULT_BATCHER_PHASE1_CORE_ABI
              : CREATOR_VAULT_BATCHER_PHASE1_CORE_WITH_SALT_ABI,
          data: data as Hex,
        })
        const params = decoded.args?.[0] as { version?: string } | undefined
        const version = typeof params?.version === 'string' ? params.version.trim() : ''
        if (version) return version
      }
      if (selector === PHASE1_SELECTOR_FINALIZE || selector === PHASE1_SELECTOR_FINALIZE_WITH_SALT) {
        const decoded = decodeFunctionData({
          abi:
            selector === PHASE1_SELECTOR_FINALIZE
              ? CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_ABI
              : CREATOR_VAULT_BATCHER_PHASE1_FINALIZE_WITH_SALT_ABI,
          data: data as Hex,
        })
        const params = decoded.args?.[0] as { version?: string } | undefined
        const version = typeof params?.version === 'string' ? params.version.trim() : ''
        if (version) return version
      }
    } catch {
      continue
    }
  }

  return null
}

function normalizePhase2CallVersions(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
  targetVersion: string | null
}): { phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[]; rewrote: boolean } {
  const targetVersion = (params.targetVersion ?? '').trim()
  if (!targetVersion) {
    return {
      phase2CoreCalls: params.phase2CoreCalls,
      phase2FinalizeCalls: params.phase2FinalizeCalls,
      rewrote: false,
    }
  }

  let rewrote = false

  const phase2CoreCalls = params.phase2CoreCalls.map((call) => {
    for (const abi of [
      CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI,
      CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
    ] as const) {
      try {
        const decoded = decodeFunctionData({
          abi,
          data: call.data,
        })
        if (decoded.functionName !== 'deployPhase2Core' && decoded.functionName !== 'deployPhase2CoreWithRolePolicy') {
          continue
        }
        const phase2Params = decoded.args?.[0] as Record<string, unknown> | undefined
        const codeIds = decoded.args?.[1]
        if (!phase2Params || !codeIds) return call
        const currentVersion = typeof phase2Params.version === 'string' ? phase2Params.version.trim() : ''
        if (currentVersion === targetVersion) return call
        rewrote = true
        if (decoded.functionName === 'deployPhase2CoreWithRolePolicy') {
          const rolePolicyId = decoded.args?.[2] as bigint | undefined
          return {
            ...call,
            data: encodeFunctionData({
              abi: CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
              functionName: 'deployPhase2CoreWithRolePolicy',
              args: [{ ...phase2Params, version: targetVersion } as any, codeIds as any, rolePolicyId ?? 0n],
            }) as Hex,
          }
        }
        return {
          ...call,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI,
            functionName: 'deployPhase2Core',
            args: [{ ...phase2Params, version: targetVersion } as any, codeIds as any],
          }) as Hex,
        }
      } catch {
        continue
      }
    }
    return call
  })

  const phase2FinalizeCalls = params.phase2FinalizeCalls.map((call) => {
    try {
      const decoded = decodeFunctionData({
        abi: CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI,
        data: call.data,
      })
      if (decoded.functionName !== 'finalizePhase2') return call
      const phase2Params = decoded.args?.[0] as Record<string, unknown> | undefined
      if (!phase2Params) return call
      const currentVersion = typeof phase2Params.version === 'string' ? phase2Params.version.trim() : ''
      if (currentVersion === targetVersion) return call
      rewrote = true
      return {
        ...call,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI,
          functionName: 'finalizePhase2',
          args: [{ ...phase2Params, version: targetVersion } as any],
        }) as Hex,
      }
    } catch {
      return call
    }
  })

  return { phase2CoreCalls, phase2FinalizeCalls, rewrote }
}

function readRequestedRolePolicyId(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = parseBigIntLike(value)
  if (parsed === null) return null
  return parsed
}

type RolePolicySource = 'request' | 'creator_default' | 'global_default' | 'none'

function readRolePolicyFromEnv(name: string): bigint | null {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return null
  const parsed = parseBigIntLike(raw)
  if (parsed === null || parsed > 65_535n) return null
  return parsed
}

function readCreatorRolePolicyMap(): Record<string, bigint> {
  const raw = String(process.env.DEPLOY_ROLE_POLICY_BY_CREATOR_JSON ?? '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, bigint> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const creator = typeof key === 'string' && isAddress(key) ? getAddress(key as Address).toLowerCase() : ''
      if (!creator) continue
      const policyId = parseBigIntLike(value)
      if (policyId === null || policyId > 65_535n) continue
      out[creator] = policyId
    }
    return out
  } catch {
    return {}
  }
}

export function resolveRolePolicyIdForSession(params: {
  creatorToken: Address
  requestedRolePolicyId: bigint | null
}): { rolePolicyId: bigint | null; source: RolePolicySource } {
  if (params.requestedRolePolicyId !== null) {
    return {
      rolePolicyId: params.requestedRolePolicyId,
      source: 'request',
    }
  }

  const creatorMap = readCreatorRolePolicyMap()
  const creatorPolicy = creatorMap[params.creatorToken.toLowerCase()]
  if (creatorPolicy !== undefined) {
    return {
      rolePolicyId: creatorPolicy,
      source: 'creator_default',
    }
  }

  const globalDefault = readRolePolicyFromEnv('DEPLOY_DEFAULT_ROLE_POLICY_ID')
  if (globalDefault !== null) {
    return {
      rolePolicyId: globalDefault,
      source: 'global_default',
    }
  }

  return {
    rolePolicyId: null,
    source: 'none',
  }
}

export function normalizePhase2RolePolicyCalls(params: {
  phase2CoreCalls: Call[]
  rolePolicyId: bigint | null
}): { phase2CoreCalls: Call[]; rewrote: boolean } {
  if (params.rolePolicyId === null || params.rolePolicyId === 0n) {
    return { phase2CoreCalls: params.phase2CoreCalls, rewrote: false }
  }
  const activeRolePolicyId = params.rolePolicyId

  let rewrote = false
  const normalized = params.phase2CoreCalls.map((call) => {
    for (const abi of [
      CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_ABI,
      CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
    ] as const) {
      try {
        const decoded = decodeFunctionData({
          abi,
          data: call.data,
        })
        if (decoded.functionName !== 'deployPhase2Core' && decoded.functionName !== 'deployPhase2CoreWithRolePolicy') {
          continue
        }

        const phase2Params = decoded.args?.[0]
        const codeIds = decoded.args?.[1]
        const existingRolePolicyId = decoded.functionName === 'deployPhase2CoreWithRolePolicy'
          ? (decoded.args?.[2] as bigint | undefined) ?? null
          : null
        if (!phase2Params || !codeIds) return call
        if (existingRolePolicyId === activeRolePolicyId) return call

        rewrote = true
        return {
          ...call,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
            functionName: 'deployPhase2CoreWithRolePolicy',
            args: [phase2Params as any, codeIds as any, activeRolePolicyId],
          }),
        }
      } catch {
        continue
      }
    }
    return call
  })

  return {
    phase2CoreCalls: normalized,
    rewrote,
  }
}

export function validatePhase2RolePolicyInput(params: {
  phase2CoreCalls: Call[]
  requestedRolePolicyId: bigint | null
}) {
  const observed = new Set<string>()
  for (const call of params.phase2CoreCalls) {
    const info = extractPhase2CoreInvariantInfo(call.data)
    if (!info || info.rolePolicyId === null) continue
    const rolePolicyId = info.rolePolicyId
    if (rolePolicyId > 65_535n) {
      throw new DeploySessionRequestError(400, 'rolePolicyId out of supported range (max 65535)')
    }
    observed.add(rolePolicyId.toString())
  }
  if (observed.size > 1) {
    throw new DeploySessionRequestError(400, 'Multiple rolePolicyId values detected in phase2 core calls')
  }
  if (params.requestedRolePolicyId !== null && observed.size > 0) {
    const observedValue = BigInt(Array.from(observed)[0]!)
    if (observedValue !== params.requestedRolePolicyId) {
      throw new DeploySessionRequestError(400, 'rolePolicyId request/body mismatch')
    }
  }
}

function extractFinalizePhase2InvariantInfo(data: Hex): {
  creatorToken: Address
  shareToken: Address
  gaugeController: Address
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        shareToken?: string
        gaugeController?: string
      } | null
      const creatorToken = normalizeAddressOrNull(params?.creatorToken)
      const shareToken = normalizeAddressOrNull(params?.shareToken)
      const gaugeController = normalizeAddressOrNull(params?.gaugeController)
      if (!creatorToken || !shareToken || !gaugeController) continue
      return {
        creatorToken,
        shareToken,
        gaugeController,
      }
    } catch {
      continue
    }
  }
  return null
}

function findFinalizePhase2InvariantCall(calls: Call[]): {
  call: Call
  info: {
    creatorToken: Address
    shareToken: Address
    gaugeController: Address
  }
} | null {
  for (const call of calls) {
    const info = extractFinalizePhase2InvariantInfo(call.data)
    if (info) return { call, info }
  }
  return null
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

async function assertOvaultRuntimeReadyForBatcher(batcherAddress: Address): Promise<void> {
  const rpc = resolveDeploySessionRpcUrl()
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })
  const runtime = await publicClient
    .readContract({
      address: batcherAddress,
      abi: CREATOR_VAULT_BATCHER_OVAULT_RUNTIME_VIEW_ABI,
      functionName: 'getOVaultRuntimeConfig',
    })
    .catch(() => null)
  if (!isOvaultRuntimeConfigured(runtime)) {
    throw new DeploySessionRequestError(
      409,
      `OVault mesh deploy lane requires enabled runtime config on deployment batcher ${batcherAddress}.`,
    )
  }
}

function extractFinalizePhase2ApprovalInfo(data: Hex): {
  creatorToken: Address
  depositAmount: bigint
  vault: Address | null
} | null {
  for (const abi of [CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_ABI, CREATOR_VAULT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        depositAmount?: bigint | string | number
        vault?: string
      } | null
      const creatorTokenCandidate =
        params?.creatorToken && isAddress(params.creatorToken)
          ? getAddress(params.creatorToken as Address)
          : null
      const creatorToken =
        creatorTokenCandidate && creatorTokenCandidate.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
          ? creatorTokenCandidate
          : null
      const depositAmount = parseBigIntLike(params?.depositAmount)
      if (!creatorToken || !depositAmount || depositAmount <= 0n) continue
      const vault =
        params?.vault && isAddress(params.vault)
          ? getAddress(params.vault as Address)
          : null
      return { creatorToken, depositAmount, vault }
    } catch {
      continue
    }
  }
  return null
}

function callFingerprint(call: Call | null | undefined): string | null {
  if (!call) return null
  const to = typeof call.to === 'string' && isAddress(call.to) ? getAddress(call.to as Address).toLowerCase() : ''
  const data = typeof call.data === 'string' ? call.data.trim().toLowerCase() : ''
  if (!to || !data.startsWith('0x')) return null
  return `${to}|${data}`
}

function derivePhase2FinalizeApprovalCalls(calls: Call[]): Call[] {
  if (!Array.isArray(calls) || calls.length === 0) return []
  const approvals: Call[] = []
  const seen = new Set<string>()
  for (const call of calls) {
    const to = typeof call?.to === 'string' && isAddress(call.to) ? getAddress(call.to as Address) : null
    const data = typeof call?.data === 'string' ? call.data.trim() : ''
    if (!to || !data.startsWith('0x')) continue
    const approvalInfo = extractFinalizePhase2ApprovalInfo(data as Hex)
    if (!approvalInfo) continue
    const approveData = encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [to, approvalInfo.depositAmount],
    }) as Hex
    const approveCall: Call = {
      to: approvalInfo.creatorToken,
      // Keep payload JSON-safe when persisted to DB.
      value: '0',
      data: approveData,
    }
    const key = callFingerprint(approveCall)
    if (!key || seen.has(key)) continue
    seen.add(key)
    approvals.push(approveCall)
  }
  return approvals
}

function appendUniqueCalls(base: Call[], extras: Call[]): Call[] {
  const out: Call[] = [...base]
  const seen = new Set<string>()
  for (const existing of out) {
    const key = callFingerprint(existing)
    if (key) seen.add(key)
  }
  for (const extra of extras) {
    const key = callFingerprint(extra)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(extra)
  }
  return out
}

function prependPhase2FinalizeApprovals(calls: Call[]): Call[] {
  if (!Array.isArray(calls) || calls.length === 0) return []
  const approvals = derivePhase2FinalizeApprovalCalls(calls)
  return appendUniqueCalls(approvals, calls)
}

async function findNonIndexedCharmPool(calls: Call[]): Promise<Address | null> {
  if (!Array.isArray(calls) || calls.length === 0) return null
  const uniquePools = new Map<string, Address>()
  for (const call of calls) {
    const pool = extractCharmCreateVaultPool(call)
    if (!pool) continue
    uniquePools.set(pool.toLowerCase(), pool)
  }
  if (uniquePools.size === 0) return null

  const checks = await Promise.all(
    Array.from(uniquePools.values()).map(async (pool) => ({
      pool,
      indexed: await isCharmPoolIndexed({ poolAddress: pool }),
    })),
  )
  const missing = checks.find((entry) => entry.indexed === false)
  return missing?.pool ?? null
}

function distributePhase2FinalizeApprovals(params: {
  phase2CoreCalls: Call[]
  phase2FinalizeCalls: Call[]
}): { phase2CoreCalls: Call[]; phase2FinalizeCalls: Call[] } {
  const phase2CoreCalls = Array.isArray(params.phase2CoreCalls) ? [...params.phase2CoreCalls] : []
  const phase2FinalizeCalls = Array.isArray(params.phase2FinalizeCalls) ? [...params.phase2FinalizeCalls] : []
  const approvals = derivePhase2FinalizeApprovalCalls(phase2FinalizeCalls)
  if (approvals.length === 0) {
    return { phase2CoreCalls, phase2FinalizeCalls }
  }
  if (phase2CoreCalls.length > 0) {
    // Keep phase2 finalize focused on batcher finalize calls. Approval executes in phase2 core,
    // so allowance is already persisted before finalize is submitted.
    return {
      phase2CoreCalls: appendUniqueCalls(phase2CoreCalls, approvals),
      phase2FinalizeCalls,
    }
  }
  return {
    phase2CoreCalls,
    phase2FinalizeCalls: prependPhase2FinalizeApprovals(phase2FinalizeCalls),
  }
}

function normalizeSolanaOvaultConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>

  const enabled = raw.enabled === true
  const assetMintOrigin = normalizeSolanaAssetMintOrigin(raw.assetMintOrigin, 'existing')
  const assetMeshMint =
    typeof raw.assetMeshMint === 'string' && raw.assetMeshMint.trim()
      ? raw.assetMeshMint.trim()
      : null
  const shareMeshMint =
    typeof raw.shareMeshMint === 'string' && raw.shareMeshMint.trim()
      ? raw.shareMeshMint.trim()
      : null
  const solanaEid = parseUInt32Like(raw.solanaEid)

  return {
    enabled,
    assetMintOrigin,
    ...(assetMeshMint ? { assetMeshMint } : null),
    ...(shareMeshMint ? { shareMeshMint } : null),
    ...(solanaEid !== null ? { solanaEid } : null),
  }
}


function isVercelDeploymentOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase().endsWith('.vercel.app')
  } catch {
    return true
  }
}

// FIX: FINDING-10 — check DEPLOY_SESSION_TOKEN_HMAC_SECRET unconditionally, not just
// for Vercel origins. A missing secret on custom domains (e.g., app.4626.fun) would
// cause signDeployToken() to throw at continue-time instead of failing early at creation.
function checkDeploySessionSecretsReady(_origin: string): { ok: boolean; error?: string } {
  const missing: string[] = []
  if (!(process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET ?? '').trim()) {
    missing.push('DEPLOY_SESSION_TOKEN_HMAC_SECRET')
  }
  if (missing.length === 0) return { ok: true }

  return {
    ok: false,
    error: `Deploy session signing is not configured. Set ${missing.join(', ')}.`,
  }
}

function getDirectCdpEndpoint(): string {
  return (
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  )
}

async function checkDeployInfraReady(origin: string): Promise<{ ok: boolean; error?: string }> {
  const endpoint = getDirectCdpEndpoint()
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)

  if (!endpoint) {
    if (isVercelEnv && isVercelDeploymentOrigin(origin)) {
      return {
        ok: false,
        error:
          'Deploy bundler/paymaster is not configured for this Vercel deployment. Set CDP_PAYMASTER_URL (or CDP_PAYMASTER_AND_BUNDLER_URL) to the Coinbase RPC endpoint.',
      }
    }
    return { ok: true }
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8_000)
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_supportedEntryPoints', params: [] }),
      signal: ctrl.signal,
    })
    clearTimeout(t)

    const text = await upstream.text()
    const textLower = text.toLowerCase()
    if (textLower.includes('vercel authentication') || textLower.includes('x-vercel-protection-bypass') || textLower.includes('authentication required')) {
      return {
        ok: false,
        error:
          'Configured CDP_PAYMASTER_URL is Vercel-protected. Use the Coinbase RPC endpoint directly (https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>).',
      }
    }

    let rpcErr: string | null = null
    try {
      const j = JSON.parse(text)
      if (j && typeof j === 'object' && !Array.isArray(j) && (j as any)?.error?.message) {
        rpcErr = String((j as any).error.message)
      }
    } catch {
      // ignore parse errors
    }

    if (!upstream.ok) {
      return { ok: false, error: rpcErr || `CDP endpoint probe failed (HTTP ${upstream.status})` }
    }

    if (rpcErr) {
      return { ok: false, error: `CDP endpoint probe failed: ${rpcErr}` }
    }

    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'CDP endpoint probe failed'
    return { ok: false, error: `CDP endpoint probe failed: ${msg}` }
  }
}

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

const COINBASE_SMART_WALLET_OWNER_ADD_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
] as const

const CREATOR_VAULT_DEPLOY_RUNTIME_ABI = [
  {
    type: 'function',
    name: 'updateStrategyWeight',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'newWeight', type: 'uint256' },
    ],
    outputs: [],
  },
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

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

function extractAddedOwnerAddress(params: { smartWallet: Address; call: Call }): Address | null {
  const callTo = typeof params.call?.to === 'string' && isAddress(params.call.to) ? getAddress(params.call.to as Address) : null
  if (!callTo || callTo.toLowerCase() !== params.smartWallet.toLowerCase()) return null
  const data = typeof params.call?.data === 'string' ? params.call.data.trim() : ''
  if (!data || !data.startsWith('0x')) return null
  try {
    const decoded = decodeFunctionData({
      abi: COINBASE_SMART_WALLET_OWNER_ADD_ABI,
      data: data as Hex,
    })
    if (decoded.functionName !== 'addOwnerAddress') return null
    const ownerArg = decoded.args?.[0]
    if (typeof ownerArg !== 'string' || !isAddress(ownerArg)) return null
    return getAddress(ownerArg as Address)
  } catch {
    return null
  }
}

async function findContractOwnerAdditions(params: {
  smartWallet: Address
  calls: Call[]
  getBytecode: (address: Address) => Promise<Hex | null | undefined>
}): Promise<Address | null> {
  for (const call of params.calls) {
    const candidateOwner = extractAddedOwnerAddress({
      smartWallet: params.smartWallet,
      call,
    })
    if (!candidateOwner) continue
    const bytecode = await params.getBytecode(candidateOwner).catch(() => null)
    if (hasContractBytecode(bytecode)) return candidateOwner
  }
  return null
}

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

async function isOnchainSmartWalletOwner(params: { smartWallet: Address; ownerAddress: Address }): Promise<boolean> {
  try {
    const rpc = resolveDeploySessionRpcUrl()
    const publicClient = createPublicClient({
      chain: base,
      transport: http(rpc, { timeout: 12_000 }),
    })
    const result = (await publicClient.readContract({
      address: params.smartWallet,
      abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
      functionName: 'isOwnerAddress',
      args: [params.ownerAddress],
    })) as boolean
    return result === true
  } catch {
    return false
  }
}

type CreatorAllowlistMatch = 'admin' | 'allowlist' | 'creator_wallets' | 'none'

type CreatorAllowlistCheck = {
  allowed: boolean
  matchedBy: CreatorAllowlistMatch
  checkedAddresses: string[]
}

function normalizeAllowlistAddresses(input: Array<Address | string | null | undefined>): Address[] {
  const out = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'string') continue
    if (!isAddress(raw)) continue
    out.add(getAddress(raw).toLowerCase())
  }
  return Array.from(out).map((v) => getAddress(v as Address))
}

function buildSupabaseOrFilters(fields: string[], addresses: string[]): string {
  return addresses.flatMap((addr) => fields.map((field) => `${field}.ilike.${addr}`)).join(',')
}

async function resolveAllowlistAddresses(params: {
  sessionAddress: Address
  smartWallet: Address
  creatorToken: Address
}): Promise<Address[]> {
  const base = normalizeAllowlistAddresses([params.sessionAddress, params.smartWallet])
  try {
    const parties = await resolveCoinPartiesAndOwner(params.creatorToken as `0x${string}`)
    return normalizeAllowlistAddresses([params.sessionAddress, params.smartWallet, parties.creator, parties.payoutRecipient, parties.owner])
  } catch {
    return base
  }
}

/**
 * Check if the deploy actor is allowed to create a deploy session.
 *
 * Keep this aligned with `/api/creator-allowlist` so UI gate + deploy-session gate
 * evaluate the same address set:
 * - authenticated session wallet
 * - canonical smart wallet sender
 */
async function checkCreatorAllowlist(params: {
  sessionAddress: Address
  smartWallet: Address
  creatorToken: Address
}): Promise<CreatorAllowlistCheck> {
  const addressesToCheck = await resolveAllowlistAddresses(params)
  const addressFilters = addressesToCheck.map((a) => a.toLowerCase())

  if (addressFilters.length === 0) {
    return { allowed: false, matchedBy: 'none', checkedAddresses: [] }
  }

  const isAdmin = addressesToCheck.some((address) => isServerAdminAddress(address))
  if (isAdmin) {
    return { allowed: true, matchedBy: 'admin', checkedAddresses: addressFilters }
  }

  // Try Supabase first
  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    try {
      const allowlistRes = await supabase
        .from('allowlist')
        .select('id')
        .or(buildSupabaseOrFilters(['address', 'csw_address'], addressFilters))
        .is('revoked_at', null)
        .limit(1)
      if (!allowlistRes.error && Array.isArray(allowlistRes.data) && allowlistRes.data.length > 0) {
        return { allowed: true, matchedBy: 'allowlist', checkedAddresses: addressFilters }
      }

      const walletRes = await supabase
        .from('creator_wallets')
        .select('id')
        .or(buildSupabaseOrFilters(['wallet_address'], addressFilters))
        .limit(1)
      if (!walletRes.error && Array.isArray(walletRes.data) && walletRes.data.length > 0) {
        return { allowed: true, matchedBy: 'creator_wallets', checkedAddresses: addressFilters }
      }

      return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
    } catch {
      // Fall through to Postgres
    }
  }

  // Fallback to Postgres
  const db = await getDb()
  if (!db?.query) return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }

  try {
    const allowlisted = await db.query(
      `SELECT 1
       FROM allowlist
       WHERE (LOWER(address) = ANY($1) OR LOWER(csw_address) = ANY($1))
         AND revoked_at IS NULL
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(allowlisted.rows) && allowlisted.rows.length > 0) {
      return { allowed: true, matchedBy: 'allowlist', checkedAddresses: addressFilters }
    }

    const linked = await db.query(
      `SELECT 1
       FROM creator_wallets
       WHERE LOWER(wallet_address) = ANY($1)
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(linked.rows) && linked.rows.length > 0) {
      return { allowed: true, matchedBy: 'creator_wallets', checkedAddresses: addressFilters }
    }

    return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
  } catch {
    return { allowed: false, matchedBy: 'none', checkedAddresses: addressFilters }
  }
}

async function assertCreatorTokenAuthority(params: {
  creatorToken: Address
  ownerAddress: Address
  sessionAddress: Address
}): Promise<void> {
  const parties = await resolveCoinPartiesAndOwner(params.creatorToken as `0x${string}`)
  const authorized = new Set<string>()
  if (typeof parties.creator === 'string' && isAddress(parties.creator)) {
    authorized.add(getAddress(parties.creator).toLowerCase())
  }
  if (typeof parties.payoutRecipient === 'string' && isAddress(parties.payoutRecipient)) {
    authorized.add(getAddress(parties.payoutRecipient).toLowerCase())
  }
  if (typeof parties.owner === 'string' && isAddress(parties.owner)) {
    authorized.add(getAddress(parties.owner).toLowerCase())
  }

  const ownerLc = params.ownerAddress.toLowerCase()
  const sessionLc = params.sessionAddress.toLowerCase()
  if (authorized.size === 0 || (!authorized.has(ownerLc) && !authorized.has(sessionLc))) {
    throw new DeploySessionRequestError(
      403,
      'Creator token authority mismatch: active session or canonical smart wallet must control the creator token.',
    )
  }
}

async function checkCanonicalWalletOwnership(params: {
  smartWallet: Address
  ownerAddress: Address
  sessionAddress: Address
}): Promise<OwnershipCheck> {
  const onchainOwnerCheck = async (): Promise<OwnershipCheck> => {
    // In deploy payloads, ownerAddress/sessionAddress can legitimately be the
    // canonical smart wallet itself. Treat that as valid ownership context.
    if (params.ownerAddress.toLowerCase() === params.smartWallet.toLowerCase()) {
      // If session is the CSW itself, it's valid immediately.
      if (params.sessionAddress.toLowerCase() === params.smartWallet.toLowerCase()) return { ok: true }
      // Otherwise the active session wallet must be an onchain owner of the CSW.
      const sessionIsOnchain = await isOnchainSmartWalletOwner({
        smartWallet: params.smartWallet,
        ownerAddress: params.sessionAddress,
      })
      if (sessionIsOnchain) return { ok: true }
      return { ok: false, reason: 'session_not_onchain_owner' }
    }

    const ownerIsOnchain = await isOnchainSmartWalletOwner({
      smartWallet: params.smartWallet,
      ownerAddress: params.ownerAddress,
    })
    if (!ownerIsOnchain) return { ok: false, reason: 'owner_not_onchain_owner' }

    // Session signer can be the same owner wallet, or another linked owner.
    if (params.sessionAddress.toLowerCase() === params.ownerAddress.toLowerCase()) return { ok: true }
    const sessionIsOnchain = await isOnchainSmartWalletOwner({
      smartWallet: params.smartWallet,
      ownerAddress: params.sessionAddress,
    })
    if (!sessionIsOnchain) return { ok: false, reason: 'session_not_onchain_owner' }
    return { ok: true }
  }

  const db = await getDb()
  // When the database is not configured at all (e.g. local dev / preview env
  // without Postgres), fall back to the on-chain ownership check. This is a
  // deliberate null-linkage case: there is no off-chain linkage to honour or
  // revoke, so the chain remains the source of truth.
  if (!db) return await onchainOwnerCheck()

  // Any failure past this point is a DB availability / schema failure
  // (connection error, transient query failure, migration lag). We must NOT
  // fall back to the on-chain check on a DB error — doing so would let a
  // wallet whose profile linkage was revoked regain deploy authority whenever
  // the DB is degraded. Fail closed with 503 so the client retries.
  try {
    await ensureWaitlistSchema(db as any)
  } catch (err) {
    console.warn('[deploy/v2/session/create] canonical_linkage_db_unavailable (schema)', {
      smartWallet: params.smartWallet.toLowerCase(),
      error: err instanceof Error ? err.message : String(err),
    })
    throw new DeploySessionRequestError(
      503,
      'Canonical wallet linkage lookup temporarily unavailable. Please retry.',
    )
  }

  const smartWalletLc = params.smartWallet.toLowerCase()
  const ownerLc = params.ownerAddress.toLowerCase()
  const sessionLc = params.sessionAddress.toLowerCase()

  let canonicalRow: { rows?: Array<{ profile_id?: unknown }> }
  try {
    canonicalRow = await db.sql`
      SELECT profile_id
      FROM profile_wallets
      WHERE LOWER(address) = ${smartWalletLc}
        AND is_canonical_smart_wallet = true
      LIMIT 1;
    `
  } catch (err) {
    console.warn('[deploy/v2/session/create] canonical_linkage_db_unavailable (canonicalRow)', {
      smartWallet: smartWalletLc,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new DeploySessionRequestError(
      503,
      'Canonical wallet linkage lookup temporarily unavailable. Please retry.',
    )
  }
  const profileId = canonicalRow.rows?.[0]?.profile_id ?? null
  if (!profileId) {
    // Null linkage: the smart wallet was never registered as canonical for any
    // profile. Fall through to the on-chain check — there is nothing to have
    // been revoked.
    const onchain = await onchainOwnerCheck()
    return onchain.ok ? onchain : { ok: false, reason: onchain.reason ?? 'canonical_wallet_not_verified' }
  }

  let authority: Awaited<ReturnType<typeof readProfileWalletAuthority>>
  try {
    authority = await readProfileWalletAuthority({
      db: db as any,
      profileId: Number(profileId),
    })
  } catch (err) {
    console.warn('[deploy/v2/session/create] canonical_linkage_db_unavailable (authority)', {
      smartWallet: smartWalletLc,
      profileId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new DeploySessionRequestError(
      503,
      'Canonical wallet linkage lookup temporarily unavailable. Please retry.',
    )
  }
  if (!authority) {
    // Null linkage: profile row exists but no authority record has been
    // written. Treat as not-yet-linked and fall back to on-chain.
    const onchain = await onchainOwnerCheck()
    return onchain.ok ? onchain : { ok: false, reason: onchain.reason ?? 'canonical_wallet_not_verified' }
  }

  if (authority.canonicalSmartWalletAddress !== smartWalletLc) {
    // Linkage exists and points to a DIFFERENT canonical smart wallet. This is
    // a deliberate revocation / re-linkage — must NOT fall back to on-chain,
    // or a previously-linked wallet retains deploy authority after being
    // unlinked.
    return { ok: false, reason: 'canonical_wallet_linkage_revoked' }
  }

  if (sessionLc === smartWalletLc) return { ok: true }
  if (authority.activeOwnerWalletAddress === sessionLc) return { ok: true }

  // Linkage exists for this CSW but the session wallet is not the recorded
  // active owner. This is also a revocation scenario (the session wallet was
  // rotated out). Do not fall back to on-chain ownership.
  return { ok: false, reason: 'session_not_linkage_owner' }
}

export async function validateDeploySessionRequest(params: {
  req: VercelRequest
  authAddress: Address
  authType: 'session' | 'siwa'
  body: CreateDeploySessionRequest
  requireCalls: boolean
}): Promise<ValidatedDeploySessionRequest> {
  const sessionAddress = getAddress(params.authAddress as Address)
  const smartWalletRaw = typeof params.body.smartWallet === 'string' ? params.body.smartWallet.trim() : ''
  const creatorTokenRaw = typeof params.body.creatorToken === 'string' ? params.body.creatorToken.trim() : ''
  const ownerAddressRaw = typeof params.body.ownerAddress === 'string' ? params.body.ownerAddress.trim() : ''

  if (!isAddress(smartWalletRaw) || !isAddress(creatorTokenRaw) || !isAddress(ownerAddressRaw)) {
    throw new DeploySessionRequestError(400, 'Invalid addresses')
  }

  const smartWallet = getAddress(smartWalletRaw as Address)
  const creatorToken = getAddress(creatorTokenRaw as Address)
  const ownerAddress = getAddress(ownerAddressRaw as Address)

  if (ownerAddress.toLowerCase() !== smartWallet.toLowerCase()) {
    throw new DeploySessionRequestError(400, 'ownerAddress must match smartWallet (canonical deploy sender)')
  }

  const origin = getCanonicalOrigin(params.req)
  const infra = await checkDeployInfraReady(origin)
  if (!infra.ok) {
    throw new DeploySessionRequestError(503, infra.error || 'Deploy infrastructure unavailable')
  }
  const signing = checkDeploySessionSecretsReady(origin)
  if (!signing.ok) {
    throw new DeploySessionRequestError(503, signing.error || 'Deploy session signing is unavailable')
  }

  const ownership = await checkCanonicalWalletOwnership({
    smartWallet,
    ownerAddress,
    sessionAddress,
  })
  if (!ownership.ok) {
    throw new DeploySessionRequestError(
      403,
      ownership.reason ? `Deploy ownership mismatch: ${ownership.reason}` : 'Deploy ownership mismatch',
    )
  }

  await assertCreatorTokenAuthority({
    creatorToken,
    ownerAddress,
    sessionAddress,
  })

  const allowlistCheck = await checkCreatorAllowlist({
    sessionAddress,
    smartWallet,
    creatorToken,
  })
  if (!allowlistCheck.allowed) {
    console.warn('[deploy/v2/session/create] creator_access_denied', {
      sessionAddress: sessionAddress.toLowerCase(),
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
      checkedAddresses: allowlistCheck.checkedAddresses,
    })
    const checked = allowlistCheck.checkedAddresses.length > 0 ? allowlistCheck.checkedAddresses.join(', ') : 'none'
    throw new DeploySessionRequestError(
      403,
      `Creator access required. Active session wallet ${sessionAddress} is not approved for this deploy. ` +
        `Checked addresses: ${checked}. Sign out/in with your approved wallet, or ask admin to approve your session wallet/canonical smart wallet.`,
    )
  }

  const phase1CallsRaw = Array.isArray(params.body.phase1Calls) ? params.body.phase1Calls : []
  const { calls: phase1EntrypointNormalizedCalls, rewrote: phase1EntrypointCallsRewritten } =
    await normalizePhase1EntrypointCalls(phase1CallsRaw)
  const { calls: phase1SaltNormalizedCalls, rewrote: phase1SaltCallsRewritten } =
    await normalizePhase1SaltOverrideCalls(phase1EntrypointNormalizedCalls)
  const { calls: phase1Calls, rewrote: phase1CodeIdsRewritten } = normalizePhase1CodeIds(phase1SaltNormalizedCalls)
  const phase2CoreCallsRaw = Array.isArray(params.body.phase2CoreCalls) ? params.body.phase2CoreCalls : []
  const { calls: phase2CoreCallsNormalized, rewrote: phase2CoreCallsRewritten } = normalizePhase2CoreCalls(phase2CoreCallsRaw)
  const phase2FinalizeCallsRaw = Array.isArray(params.body.phase2FinalizeCalls) ? params.body.phase2FinalizeCalls : []
  const { phase2CoreCalls: distributedPhase2CoreCalls, phase2FinalizeCalls: distributedPhase2FinalizeCalls } = distributePhase2FinalizeApprovals({
    phase2CoreCalls: phase2CoreCallsNormalized,
    phase2FinalizeCalls: phase2FinalizeCallsRaw,
  })
  const phase1Version = extractPhase1VersionFromCalls(phase1Calls)
  let {
    phase2CoreCalls,
    phase2FinalizeCalls,
    rewrote: phase2VersionCallsRewritten,
  } = normalizePhase2CallVersions({
    phase2CoreCalls: distributedPhase2CoreCalls,
    phase2FinalizeCalls: distributedPhase2FinalizeCalls,
    targetVersion: phase1Version,
  })
  if (phase2FinalizeCalls.length > 0) {
    const rpc = resolveDeploySessionRpcUrl()
    const readClient = createPublicClient({
      chain: base,
      transport: http(rpc, { timeout: 12_000 }),
    })
    try {
      if (params.requireCalls) {
        const finalizeBridgeCall = phase2FinalizeCalls.find((call) => {
          const data = typeof call.data === 'string' ? call.data.trim().toLowerCase() : ''
          return (
            data.startsWith('0xbd4583fb') ||
            data.startsWith('0xab56c176') ||
            data.startsWith('0xcafc9348')
          )
        })
        if (finalizeBridgeCall?.to && isAddress(finalizeBridgeCall.to)) {
          await assertShareBridgeOftWiringForFinalize({
            publicClient: readClient,
            batcherAddress: getAddress(finalizeBridgeCall.to as Address),
            finalizeCallData: finalizeBridgeCall.data,
          })
        }
      }
      phase2FinalizeCalls = await attachFinalizeShareBridgeValueToCalls({
        publicClient: readClient,
        calls: phase2FinalizeCalls,
      })
    } catch (error) {
      throw new DeploySessionRequestError(
        409,
        error instanceof Error ? error.message : 'finalize share bridge fee quote failed',
      )
    }
  }
  const phase3Calls = Array.isArray(params.body.phase3Calls) ? params.body.phase3Calls : []
  const phase4Calls = Array.isArray(params.body.phase4Calls) ? params.body.phase4Calls : []
  const solanaOvault = normalizeSolanaOvaultConfig(params.body.solanaOvault)
  const vanity = normalizeDeployVanityRequest(params.body.vanity)
  const phase1UsesSaltOverride = hasPhase1SaltOverrideCalls(phase1Calls)
  const vanityCustomMaxHex = readDeployVanityCustomMaxHex()
  const vaultPrefixCustom = isCustomVaultPrefix(vanity.vaultPrefix)
  const shareSuffixCustom = isCustomShareSuffix(vanity.shareSuffix)
  assertVanityCustomLength({
    value: vanity.vaultPrefix,
    label: 'vaultPrefix',
    isCustom: vaultPrefixCustom,
    maxHexChars: vanityCustomMaxHex,
  })
  assertVanityCustomLength({
    value: vanity.shareSuffix,
    label: 'shareSuffix',
    isCustom: shareSuffixCustom,
    maxHexChars: vanityCustomMaxHex,
  })
  const vaultPrefixCustomLength = vanity.vaultPrefix ? normalizeDeployVanityLength(vanity.vaultPrefix.length) : null
  const shareSuffixCustomLength = vanity.shareSuffix ? normalizeDeployVanityLength(vanity.shareSuffix.length) : null
  if (vaultPrefixCustom && !vaultPrefixCustomLength) {
    throw new DeploySessionRequestError(400, 'vaultPrefix custom vanity currently supports 1-5 hex characters (0-9, a-f).')
  }
  if (shareSuffixCustom && !shareSuffixCustomLength) {
    throw new DeploySessionRequestError(400, 'shareSuffix custom vanity currently supports 1-5 hex characters (0-9, a-f).')
  }
  if (isDeployVanityPaywallEnabled()) {
    const requiresVaultPrefixEntitlementLength = vaultPrefixCustom ? vaultPrefixCustomLength : null
    // Keep anti-bypass behavior for raw phase1 salt-override calls, but
    // allow the free default `shareSuffix=4626` path without paid activation.
    const requiresShareSuffixEntitlement =
      (shareSuffixCustom ? shareSuffixCustomLength : null) ||
      (phase1UsesSaltOverride && !isFreeDefaultShareSuffix(vanity.shareSuffix)
        ? DEPLOY_VANITY_ALLOWED_LENGTHS[DEPLOY_VANITY_ALLOWED_LENGTHS.length - 1]
        : null)
    if (requiresVaultPrefixEntitlementLength || requiresShareSuffixEntitlement) {
      const db = await getDb()
      if (!db?.sql) {
        throw new DeploySessionRequestError(503, 'Vanity entitlement check unavailable (database unavailable).')
      }
      const missingFeatures = await missingDeployVanityFeatureHints({
        db: db as any,
        creatorToken,
        vaultPrefixRequiredLength: requiresVaultPrefixEntitlementLength,
        shareSuffixRequiredLength: requiresShareSuffixEntitlement,
      })
      if (missingFeatures.length > 0) {
        throw new DeploySessionRequestError(
          402,
          `Vanity deploy requires paid feature activation: ${missingFeatures.join(', ')}. ` +
            `Free defaults are vault prefix 0x${DEFAULT_FREE_VAULT_VANITY_PREFIX} and share suffix ${DEFAULT_FREE_SHARE_VANITY_SUFFIX}. ` +
            `Activate at /creator/strategy/features?creator=${creatorToken}.`,
        )
      }
    }
  }
  if (phase1EntrypointCallsRewritten) {
    console.warn('[deploy/v2/session/create] phase1_entrypoint_calls_rewritten', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
    })
  }
  if (phase1SaltCallsRewritten) {
    console.warn('[deploy/v2/session/create] phase1_salt_calls_rewritten', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
    })
  }
  if (phase1CodeIdsRewritten) {
    console.warn('[deploy/v2/session/create] phase1_code_ids_rewritten', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
    })
  }
  if (phase2CoreCallsRewritten) {
    console.warn('[deploy/v2/session/create] phase2_core_calls_rewritten', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
    })
  }
  if (phase2VersionCallsRewritten) {
    console.warn('[deploy/v2/session/create] phase2_version_calls_rewritten', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
      phase1Version,
    })
  }
  if (isDeployOvaultMeshPaywallEnabled() && solanaOvault?.enabled === true) {
    const db = await getDb()
    if (!db?.sql) {
      throw new DeploySessionRequestError(503, 'OVault mesh entitlement check unavailable (database unavailable).')
    }
    const ovaultPolicy = DEPLOY_FEATURE_POLICY_MATRIX.find((entry) => entry.key === 'solana_ovault_mesh')
    const requiredFeatureKeys =
      ovaultPolicy?.requiresAnyOf ?? (['solana_ovault_mesh', 'solana_meteora_alpha_vault'] as const)
    const entitled = await hasAnyFeatureActivation({
      db: db as any,
      creatorToken,
      featureKeys: requiredFeatureKeys,
    })
    if (!entitled) {
      throw new DeploySessionRequestError(
        402,
        `OVault mesh deploy lane requires paid feature activation: ${requiredFeatureKeys.join(' or ')}. ` +
          `Activate at /creator/strategy/features?creator=${creatorToken}.`,
      )
    }
  }
  if (phase3Calls.length > 0) {
    const db = await getDb()
    if (!db?.sql) {
      throw new DeploySessionRequestError(503, 'Phase3 feature policy check unavailable (database unavailable).')
    }
    const activeFeatureKeys = await listActiveCreatorFeatureKeys({
      db: db as any,
      creatorToken,
    })
    const compatibility = validateFeatureCompatibility(activeFeatureKeys)
    if (!compatibility.ok) {
      throw new DeploySessionRequestError(409, compatibility.message)
    }
    const phase3Eligible = Array.from(
      new Set(
        DEPLOY_FEATURE_POLICY_MATRIX
          .filter((entry) => entry.stages.includes('phase3'))
          .flatMap((entry) => entry.requiresAnyOf),
      ),
    )
    const hasDeployGatingFeature = phase3Eligible.some((key) => activeFeatureKeys.includes(key))
    if (!hasDeployGatingFeature) {
      throw new DeploySessionRequestError(
        402,
        `Phase 3 strategy deploy requires the $499 full vault deploy package (vault_full_deploy) or legacy paid strategy activations: ${phase3Eligible.join(', ')}. ` +
          `Activate at /creator/strategy/features?creator=${creatorToken}.`,
      )
    }
  }
  const hasPhase2Finalize = phase2FinalizeCalls.length > 0
  const ovaultMeshRequested = solanaOvault?.enabled === true
  const hasPostPhase2Stage = phase3Calls.length > 0 || phase4Calls.length > 0
  if (ovaultMeshRequested) {
    if (!hasPostPhase2Stage) {
      throw new DeploySessionRequestError(
        400,
        'OVault mesh deploy lane requires a post-Phase-2 stage so preflight and peer wiring cannot be skipped.',
      )
    }
    const ovaultFinalize = findFinalizePhase2InvariantCall(phase2FinalizeCalls)
    if (!hasPhase2Finalize || !ovaultFinalize) {
      throw new DeploySessionRequestError(
        400,
        'OVault mesh deploy lane requires a decodable finalizePhase2 call with creator token and ShareOFT addresses.',
      )
    }
    if (params.requireCalls) {
      await assertOvaultRuntimeReadyForBatcher(getAddress(ovaultFinalize.call.to as Address))
    }
  }
  const version = String(params.body.version ?? '').trim()
  const requestedRolePolicyId = readRequestedRolePolicyId(params.body.rolePolicyId)
  if (requestedRolePolicyId !== null && requestedRolePolicyId > 65_535n) {
    throw new DeploySessionRequestError(400, 'rolePolicyId out of supported range (max 65535)')
  }
  const rolePolicyResolution = resolveRolePolicyIdForSession({
    creatorToken,
    requestedRolePolicyId,
  })
  const resolvedRolePolicyId = rolePolicyResolution.rolePolicyId
  const { phase2CoreCalls: phase2CoreCallsWithRolePolicy } = normalizePhase2RolePolicyCalls({
    phase2CoreCalls,
    rolePolicyId: resolvedRolePolicyId,
  })
  phase2CoreCalls = phase2CoreCallsWithRolePolicy
  if (rolePolicyResolution.source !== 'none') {
    console.info('[deploy/v2/session/create] role_policy_selected', {
      smartWallet: smartWallet.toLowerCase(),
      creatorToken: creatorToken.toLowerCase(),
      rolePolicyId: resolvedRolePolicyId?.toString() ?? null,
      source: rolePolicyResolution.source,
    })
  }
  validatePhase2RolePolicyInput({
    phase2CoreCalls,
    requestedRolePolicyId: resolvedRolePolicyId,
  })
  const requestedExternalMode = inferPayoutRecipientMode(params.body.expectedPayoutRecipientMode)
  const requestedPayoutRecipient = normalizeAddressOrNull(params.body.expectedPayoutRecipient)
  const requestedTradeFeeCollector = normalizeAddressOrNull(params.body.expectedTradeFeeCollector)
  const phase2CoreInvariantInfo =
    phase2CoreCalls
      .map((call) => extractPhase2CoreInvariantInfo(call.data))
      .find((info): info is NonNullable<typeof info> => Boolean(info)) ?? null
  const phase2FinalizeInvariantInfo =
    phase2FinalizeCalls
      .map((call) => extractFinalizePhase2InvariantInfo(call.data))
      .find((info): info is NonNullable<typeof info> => Boolean(info)) ?? null
  const inferredTradeFeeCollector = phase2FinalizeInvariantInfo?.gaugeController ?? null
  // Note on canonical terminology (AGENTS.md): the on-chain field is still named
  // `payoutRecipient` in Phase2CoreParams for ABI compatibility. In this code
  // it represents the `creatorCoinPayoutRecipient` (external earnings lane).
  // When different from the tradeFeeCollector (gaugeController), we route via
  // PayoutRouter → VaultShareBurnStream (the "payout_router" external mode).
  const inferredCreatorCoinPayoutRecipient = phase2CoreInvariantInfo?.payoutRecipient ?? null
  const resolvedTradeFeeCollector = requestedTradeFeeCollector ?? inferredTradeFeeCollector
  let resolvedExternalMode: 'gauge' | 'payout_router' = requestedExternalMode ?? 'gauge'
  if (
    !requestedExternalMode &&
    inferredCreatorCoinPayoutRecipient &&
    resolvedTradeFeeCollector &&
    inferredCreatorCoinPayoutRecipient.toLowerCase() !== resolvedTradeFeeCollector.toLowerCase()
  ) {
    resolvedExternalMode = 'payout_router'
  }
  const resolvedPayoutRecipient =
    requestedPayoutRecipient ??
    inferredCreatorCoinPayoutRecipient ??
    (resolvedExternalMode === 'gauge' ? resolvedTradeFeeCollector : null)
  const phase2InvariantExpectations: DeployPhase2InvariantExpectations | null = hasPhase2Finalize
    ? {
        ...(resolvedTradeFeeCollector ? { expectedTradeFeeCollector: resolvedTradeFeeCollector } : {}),
        expectedPayoutRecipientMode: resolvedExternalMode,
        ...(resolvedPayoutRecipient
          ? { expectedPayoutRecipient: resolvedPayoutRecipient }
          : {}),
      }
    : null

  if (params.requireCalls) {
    const allSubmittedCalls = [
      ...phase1Calls,
      ...phase2CoreCalls,
      ...phase2FinalizeCalls,
      ...phase3Calls,
      ...phase4Calls,
    ]

    const nonIndexedCharmPool = await findNonIndexedCharmPool(allSubmittedCalls)
    if (nonIndexedCharmPool) {
      throw new DeploySessionRequestError(400, charmPoolNotIndexedError(nonIndexedCharmPool))
    }

    if (allSubmittedCalls.length > 0) {
      const rpc = resolveDeploySessionRpcUrl()
      const readClient = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 12_000 }),
      })
      const contractOwnerToAdd = await findContractOwnerAdditions({
        smartWallet,
        calls: allSubmittedCalls,
        getBytecode: async (address) => (await readClient.getBytecode({ address })) as Hex | null | undefined,
      })
      if (contractOwnerToAdd) {
        throw new DeploySessionRequestError(
          400,
          `Only EOA owners can be added to the canonical smart wallet (blocked contract owner: ${contractOwnerToAdd}).`,
        )
      }
    }

    const hasAnyWork =
      phase1Calls.length > 0 ||
      phase2CoreCalls.length > 0 ||
      phase2FinalizeCalls.length > 0 ||
      phase3Calls.length > 0 ||
      phase4Calls.length > 0
    if (!hasAnyWork) {
      throw new DeploySessionRequestError(400, 'Missing deploy calls')
    }

    assertNoDirectCreate2DeployCalls(allSubmittedCalls)

    if (phase1Calls.length > 0) {
      await assertPhase1BatcherReadiness(phase1Calls)
    }

    if (phase3Calls.length > 0) {
      const batcherAddress = getAddress(phase3Calls[0]!.to)
      const rpc = resolveDeploySessionRpcUrl()
      const readClient = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 12_000 }),
      })
      if (isLocalForkRpcUrl(rpc)) {
        try {
          await ensurePhase3DryRunForkPrep({
            rpcUrl: rpc,
            batcher: batcherAddress,
          })
        } catch (error) {
          throw new DeploySessionRequestError(
            409,
            error instanceof Error ? error.message : String(error),
          )
        }
      }
      try {
        await assertPhase3HelperCreate2Authorization({
          publicClient: readClient,
          batcher: batcherAddress,
        })
      } catch (error) {
        throw new DeploySessionRequestError(
          409,
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    if (phase2CoreCalls.length > 0 && !hasPhase2Finalize) {
      throw new DeploySessionRequestError(400, 'Missing phase2 finalize calls')
    }

    if (phase4Calls.length > 0 && !hasPhase2Finalize) {
      if (!version) {
        throw new DeploySessionRequestError(400, 'version is required when phase4Calls are present')
      }
      const batcherAddress = getAddress(phase4Calls[0]!.to)
      const baseSalt = deriveBaseSalt({ creatorToken, owner: ownerAddress, chainId: 8453, version })
      const rpc = resolveDeploySessionRpcUrl()
      const readClient = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 12_000 }),
      })
      try {
        const pending = (await readClient.readContract({
          address: batcherAddress,
          abi: CREATOR_VAULT_BATCHER_PENDING_AUCTION_ABI,
          functionName: 'pendingAuctions',
          args: [baseSalt],
        })) as unknown
        const pendingAny = pending as any
        const pendingAmount = BigInt(pendingAny?.amount ?? pendingAny?.[2] ?? 0n)
        if (pendingAmount <= 0n) {
          throw new DeploySessionRequestError(
            409,
            `phase4 precheck failed: no pending deferred auction for deployment version ${version}`,
          )
        }
      } catch (error) {
        if (error instanceof DeploySessionRequestError) throw error
        throw new DeploySessionRequestError(
          409,
          `phase4 precheck failed: could not validate pending deferred auction for deployment version ${version}`,
        )
      }
    }
  }

  return {
    sessionAddress,
    smartWallet,
    creatorToken,
    ownerAddress,
    authType: params.authType,
    phase1Calls,
    phase2CoreCalls,
    phase2FinalizeCalls,
    phase3Calls,
    phase4Calls,
    solanaOvault,
    vanity,
    hasPhase2Finalize,
    version,
    phase2InvariantExpectations,
    rolePolicyId: resolvedRolePolicyId === null ? null : Number(resolvedRolePolicyId),
    rolePolicySource: rolePolicyResolution.source,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Deploy sessions require DB configuration' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 512_000 })) as CreateDeploySessionRequest | null
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  const preflightOnly = body.preflightOnly === true

  // Split throttles: preflight should not consume create quota, but it still must be limited.
  // H-07 / 4626-299: the full deploy-create path must use the durable
  // Postgres-backed limiter with failClosed=true so it cannot be multiplied
  // across warm serverless instances. Preflight remains on the in-memory
  // limiter because it is idempotent and low-risk.
  const rateLimit = preflightOnly
    ? checkRateLimit(rateLimitKey('deploy-preflight', auth.address.toLowerCase()), { windowMs: 60_000, maxRequests: 20 })
    : await checkDurableRateLimit(
        rateLimitKey('deploy', auth.address.toLowerCase()),
        RATE_LIMITS.deployCreate,
        { failClosed: true },
      )
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({
      success: false,
      error: preflightOnly
        ? 'Too many deploy preflight checks. Please retry shortly.'
        : 'Too many deploy attempts. Please try again later.',
    } satisfies ApiEnvelope<null>)
  }

  try {
    const {
      sessionAddress,
      smartWallet,
      creatorToken,
      ownerAddress,
      authType,
      phase1Calls,
      phase2CoreCalls,
      phase2FinalizeCalls,
      phase3Calls,
      phase4Calls,
      solanaOvault,
      vanity,
      hasPhase2Finalize,
      version,
      phase2InvariantExpectations,
      rolePolicyId,
      rolePolicySource,
    } = await validateDeploySessionRequest({
      req,
      authAddress: getAddress(auth.address as Address),
      authType: auth.type,
      body,
      requireCalls: !preflightOnly,
    })

    if (preflightOnly) {
      return res.status(200).json({
        success: true,
        data: {
          ready: true,
          authAddress: sessionAddress,
          smartWallet,
          ownerAddress,
          authType,
        },
      } satisfies ApiEnvelope<{
        ready: boolean
        authAddress: Address
        smartWallet: Address
        ownerAddress: Address
        authType: 'session' | 'siwa'
      }>)
    }

    const deployToken = randomDeployToken()
    const tokenHash = hashDeployToken(deployToken)
    const id = randomId()

    // Deploy sessions require the per-creator managed signer wallet.
    const agentWallet = await getOrCreateCreatorAgentWallet({
      creatorToken: creatorToken.toLowerCase() as `0x${string}`,
    }).catch((e: any) => {
      const reason = e?.message ? String(e.message) : 'agent_wallet_create_failed'
      throw new DeploySessionRequestError(
        503,
        `Managed deploy signer wallet is unavailable (${reason}). Please retry shortly.`,
      )
    })
    const deploySignerWalletId = String(agentWallet.walletId || '').trim()
    if (!deploySignerWalletId) {
      throw new DeploySessionRequestError(
        503,
        'Managed deploy signer wallet is unavailable (agent_wallet_id_missing). Please retry shortly.',
      )
    }
    const sessionSigner = getAddress(agentWallet.address)
    const deploySignerAddress = getAddress(agentWallet.address)

    const now = Date.now()
    const expiresAt = new Date(now + readDeploySessionTtlMs())
    const persistSessionOwner = shouldPersistManagedSessionOwner()

    const cleanupGrantCall = {
      to: smartWallet,
      value: 0n,
      data: encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [0n, asOwnerBytes(sessionSigner)],
      }),
    }

    const phase4RuntimeGrantCalls: Call[] = (() => {
      // Server-side continuation may prepend vault strategy runtime calls in phase-4
      // to safely deploy around Charm transfer-mismatch edge cases.
      if (phase3Calls.length === 0 || phase4Calls.length === 0) return []
      const finalizeInfo =
        phase2FinalizeCalls
          .map((c) => extractFinalizePhase2ApprovalInfo(c.data))
          .find((info): info is NonNullable<typeof info> => Boolean(info)) ?? null
      const vault = finalizeInfo?.vault ?? null
      if (!vault) return []
      return [
        {
          to: vault,
          value: '0',
          data: encodeFunctionData({
            abi: CREATOR_VAULT_DEPLOY_RUNTIME_ABI,
            functionName: 'deployToStrategies',
            args: [],
          }),
        },
        {
          to: vault,
          value: '0',
          data: encodeFunctionData({
            abi: CREATOR_VAULT_DEPLOY_RUNTIME_ABI,
            functionName: 'setMinimumTotalIdle',
            args: [0n],
          }),
        },
        {
          to: vault,
          value: '0',
          data: encodeFunctionData({
            abi: CREATOR_VAULT_DEPLOY_RUNTIME_ABI,
            functionName: 'updateStrategyWeight',
            args: [ZERO_ADDRESS, 0n],
          }),
        },
      ]
    })()

    const allCallsForGrant = [
      ...phase1Calls,
      ...phase2CoreCalls,
      ...phase2FinalizeCalls,
      ...phase3Calls,
      ...phase4Calls,
      ...phase4RuntimeGrantCalls,
      ...(persistSessionOwner ? [] : [cleanupGrantCall]),
    ]
      .map((c) => ({ to: getAddress(c.to), value: typeof c.value === 'bigint' ? c.value : BigInt(c.value ?? 0), data: c.data as Hex }))
      .filter((c) => typeof c.data === 'string' && c.data.startsWith('0x'))

    const erc7712Grant = buildDeployPermissionGrant({
      sessionId: id,
      chainId: 8453,
      validAfter: new Date(now),
      validUntil: expiresAt,
      calls: allCallsForGrant,
    })

    await ensureDeploySessionsSchema()
    await insertDeploySession({
      id,
      tokenHash,
      sessionAddress: sessionAddress,
      smartWallet,
      sessionSigner,
      deployToken,
      payload: {
        creatorToken,
        ownerAddress,
        smartWallet,
        sessionSigner,
        authType: auth.type,
        ...(auth.type === 'siwa'
          ? {
              authAgentId: auth.agentId,
              authAgentRegistry: auth.agentRegistry,
              authAgentChainId: auth.chainId,
            }
          : null),
        deploySignerWalletId,
        deploySignerAddress,
        persistSessionOwner,
        expectedStages: {
          hasPhase1Core: phase1Calls.length > 0,
          hasPhase1Finalize: phase1Calls.length > 1,
          hasPhase2Core: phase2CoreCalls.length > 0,
          hasPhase2Finalize,
          hasPhase3: phase3Calls.length > 0,
          hasPhase4: phase4Calls.length > 0,
          hasOvaultMesh: Boolean(solanaOvault?.enabled) && (phase3Calls.length > 0 || phase4Calls.length > 0),
        },
        version,
        vanity,
        phase1Calls,
        phase2CoreCalls,
        phase2FinalizeCalls,
        phase3Calls,
        phase4Calls,
        rolePolicyId,
        rolePolicySource,
        ...(phase2InvariantExpectations ? phase2InvariantExpectations : {}),
        ...(solanaOvault ? { solanaOvault } : null),
        erc7712Grant,
      },
      expiresAt,
    })

    const out: CreateDeploySessionResponse = {
      sessionId: id,
      sessionSignerAddress: sessionSigner,
      sessionSignerWalletId: deploySignerWalletId,
      expiresAt: expiresAt.toISOString(),
    }
    return res.status(200).json({ success: true, data: out } satisfies ApiEnvelope<CreateDeploySessionResponse>)
  } catch (e: any) {
    if (e instanceof DeploySessionRequestError) {
      return res.status(e.status).json({ success: false, error: e.message } satisfies ApiEnvelope<null>)
    }
    console.error('deploy/v2/session/create error', e?.message ? String(e.message) : e)
    return res.status(500).json({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>)
  }
}
