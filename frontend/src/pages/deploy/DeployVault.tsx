import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useChainId, useConnect, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi'
import { debugLogsFlag } from '@/lib/flags/featureFlags'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import {
  ZERO_BYTES32,
  encodeUniswapV3Path,
  findCreate2SaltForSuffix,
  normalizeAddressArray,
  normalizeAddressLike,
  normalizeBytes32,
  normalizeDeploymentVersion,
  normalizeHexSuffix,
  parsePositiveTokenAmount,
  parseUint8,
  parseUniswapV3Fee,
  sameAddress,
} from './deployVaultHelpers'
import {
  debugSignatureReady,
  ensureSignatureHex,
  isTransientRpcFailure,
  isUserRejectedErrorMessage,
  logNonEoaSignature,
  setAaDebugMode,
  withTimeout,
} from './deployVaultSignatureUtils'
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  formatUnits,
  getAddress,
  getCreate2Address,
  isAddress,
  http,
  keccak256,
  parseAbiParameters,
  toHex,
  toBytes,
} from 'viem'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { RequestCreatorAccess } from '@/components/deploy/RequestCreatorAccess'
import { LaunchCoinCard } from '@/features/waitlist/LaunchCoinCard'
import { CONTRACTS } from '@/config/contracts'
import {
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  isDeprecatedCreatorVaultBatcherAddress,
  normalizeCreatorVaultBatcherAddress,
} from '@/config/contracts.defaults'
import { deploymentBatcherNotConfiguredMessage } from '@/lib/deploy/deploymentBatcherConfigError'
import { useCreatorAllowlist, useDeploymentTracker } from '@/hooks'
import { DeploymentSuccess, AlreadyDeployedBanner } from '@/components/deploy/DeploymentSuccess'
import { VaultImageGenerator } from '@/components/deploy/VaultImageGenerator'
import type { DeploymentRecord } from '@/hooks/useDeploymentTracker'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { logger } from '@/lib/observability/logger'
import { buildBaseAppProlinkUrl, encodeSingleCallSendCallsProlink } from '@/lib/base/prolink'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { resolveCreatorIdentity } from '@/lib/identity/creatorIdentity'
import { ensureProviderOnBase } from '@/lib/wallet/safeSwitchToBase'
import { selectPreferredWalletConnector } from '@/lib/wallet/wagmiConnectorSelection'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import {
  normalizeUnderlyingSymbol,
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
  underlyingSymbolUpper as deriveUnderlyingUpper,
} from '@/lib/tokens/tokenSymbols'
import { computeMarketFloorQuote } from '@/lib/cca/marketFloor'
import { q96ToCurrencyPerTokenBaseUnits } from '@/lib/cca/q96'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { buildPermit2SignatureTransfer, createPermit2Deadline, createPermit2Nonce } from '@/lib/deploy/permit2'
import {
  deriveCreatorCoinPolicyControllerSalt,
  derivePayoutRouterSalt,
  deriveVaultShareBurnStreamSalt,
} from '@/lib/deploy/create2Salts'
import { findPerVaultVanityVersionWithWasm } from '@/lib/vanity/perVaultVanityWasm'
import {
  type DeploySessionStatusData,
} from '@/lib/deploy/sessionClient'
import { useDeploySessionV2 } from '@/features/deploy-vault/useDeploySessionV2'
import {
  buildShareVanitySkipLogKey,
  deployTimelineProgressLabel,
  deriveDeployTimelineProgressState,
  isProviderCollisionErrorMessage,
  summarizeDeployTimelineProgress,
  shouldEmitShareVanitySkipLog,
} from './deployVaultSignals'
import { 
  sendCoinbaseSmartWalletUserOperation, 
  simulateSmartWalletCalls,
  ERC4337_ENTRYPOINT_V06,
  assertEntryPointV06,
} from '@/lib/aa/coinbaseErc4337'
import { PageMeta, META } from '@/components/seo/PageMeta'
import { LoadingInline, LoadingText } from '@/components/ui/LoadingState'
import {
  DEPLOY_TIMELINE_STAGE_INDEX,
  DEPLOY_TIMELINE_STAGES,
  legacyPhaseFromTimelineStage,
  timelineStageFromDeployStep,
  txSlotFromTimelineStage,
  type DeployTimelineStage,
  type DeployTimelineStageId,
} from '@/features/deploy-vault/deploySteps'

const DEFAULT_MIN_FIRST_DEPOSIT_TOKENS = 10_000_000n
const MIN_FIRST_DEPOSIT = DEFAULT_MIN_FIRST_DEPOSIT_TOKENS * 10n ** 18n
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')
const SPLIT_PHASE1_PHASE3_HELPER = addr('A2Bb16F729229705a7F101d3be11ad51Ae90aC83')
const BASE_PUBLIC_RPC_URL = 'https://mainnet.base.org'
const BASE_SWAP_ROUTER = addr('2626664c2603336E57B271c5C0b26F421741e481')
const BASE_WETH = addr('4200000000000000000000000000000000000006')
const BASE_USDC = addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const BASE_CHAINLINK_ETH_USD = addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const CHARM_FACTORY = addr('5B7B8b487D05F77977b7ABEec5F922925B9b2aFa')
const DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE = 3_000

// Uniswap CCA uses Q96 fixed-point prices + a compact step schedule.
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
// Phase-2 split in the deployment batcher is 50% auction / 50% vesting.
// Keep this as a boolean gate for deferred launch wiring.
const DEFAULT_AUCTION_PERCENT = 50
// Strategy deployment targets (of total deposited creator tokens):
// - 30% Charm
// - 30% Ajna
// - 30% SolanaStrategy
// - 10% idle operational buffer
const DEFAULT_CHARM_WEIGHT_BPS = 3_000n
const DEFAULT_AJNA_WEIGHT_BPS = 3_000n
const DEFAULT_SOLANA_WEIGHT_BPS = 3_000n
const DEFAULT_IDLE_PERCENT_BPS = 1_000n // 10% explicit idle target
const DEFAULT_MIN_IDLE_PERCENT_BPS = DEFAULT_IDLE_PERCENT_BPS
const DEFAULT_SOLANA_MAX_NAV_AGE = 3_600n
const DEFAULT_SOLANA_MAX_NAV_DELTA_BPS = 500
const DEFAULT_SOLANA_MIN_BASE_LIQUIDITY_BPS = 1_000
const DEFAULT_SOLANA_OVAULT_MESH_ENABLED = true
const DEFAULT_CHARM_EXPECTED_PROTOCOL_FEE_PIPS = 10_000 // 1% in Charm 1e6 precision
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)
const DEFAULT_SHARE_OFT_VANITY_SUFFIX = '4626'
const DEFAULT_SHARE_OFT_VANITY_MAX_TRIES = 1_000_000
const DEFAULT_VAULT_VANITY_PREFIX = '4626'
const DEFAULT_VAULT_VANITY_MAX_TRIES = 250_000
const DEFAULT_DEPLOY_VANITY_CUSTOM_MAX_HEX = 5
const BATCHER_PHASE1_SELECTOR = '3c51ca4e'
const BATCHER_PHASE1_WITH_SALT_SELECTOR = '297cb1e6'
const BATCHER_PHASE1_CORE_SELECTOR = '1331378b'
const BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR = '4154f24e'
const BATCHER_PHASE1_FINALIZE_SELECTOR = 'a98ec9d8'
const BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR = '3bc09a8b'
const BATCHER_PHASE2_FINALIZE_WITH_PERMIT2_SELECTOR = '0ecf9382'
const BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR = 'e7fdf838'
const UNIVERSAL_CREATE2_FACTORY = addr('4e59b44847b379578588920cA78FbF26c0B4956C')
const KNOWN_SALT_OVERRIDE_DISABLED_BATCHERS = new Set<string>([
  '0xe3f9490cfd6bd3d68010405d18bf772c167e7178',
  '0xf941bb68e4f083f3f531cc598d5c08d0b8ffba7e',
])
const CREATE2_DEPLOYER_AUTH_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'authorizedDeployers',
    stateMutability: 'view',
    inputs: [{ name: 'deployer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const
// The phased deployment batcher v4+ exposes these immutables as getters. We use this as a
// compatibility gate to avoid legacy batchers that deploy module-uninitialized vaults.
const BATCHER_VAULT_CORE_MODULE_SELECTOR = '22c40b75'
const BATCHER_VAULT_STRATEGIES_MODULE_SELECTOR = '3283d513'
const BATCHER_VAULT_ADMIN_MODULE_SELECTOR = '822f9d9b'
function hasSaltOverrideDisabledError(error: unknown): boolean {
  const text = String((error as { message?: unknown; shortMessage?: unknown } | null)?.shortMessage
    ?? (error as { message?: unknown } | null)?.message
    ?? error
    ?? '')
    .toLowerCase()
  return text.includes(`0x${BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR}`) || text.includes('saltoverridedisabled')
}
const NO_EOA_STRICT_BLOCKER =
  'No-EOA deploy requires Privy owner signer readiness on your canonical CSW. Complete one-time Base Account owner approval (or use Base App prolink), then retry.'
const CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'previewLaunchPricing',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'floorPriceQ96', type: 'uint256' },
      { name: 'tickSpacingQ96', type: 'uint256' },
      { name: 'creatorUsdPrice', type: 'uint256' },
      { name: 'ethUsdPrice', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

type DeployMode = 'default' | 'no_eoa_strict'

function resolveDeployMode(): DeployMode {
  // Deploy defaults to no-external-EOA mode.
  // Allowed lanes: canonical self-auth + Privy embedded/smart-wallet owners.
  return 'no_eoa_strict'
}

// Minimum age for a Creator Coin before allowing vault deployment.
// Rationale: reduce launch-manipulation surface area on brand new coins with thin/no trading history.
const DEFAULT_MIN_COIN_AGE_DAYS = 7
const MIN_COIN_AGE_LOCALSTORAGE_KEY = 'cv:deploy:minCoinAgeDays'
const DEFAULT_DEPLOYMENT_VERSION = 'v1.9.2'

function isDebugEnabled(): boolean {
  if (debugLogsFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

const AA_DEBUG = isDebugEnabled()
setAaDebugMode(AA_DEBUG)

function resolveDeploymentVersionFromRuntime(): string {
  const envVersion = normalizeDeploymentVersion(import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined)
  if (typeof window === 'undefined') return envVersion ?? DEFAULT_DEPLOYMENT_VERSION
  const params = new URLSearchParams(window.location.search)
  const queryVersion = normalizeDeploymentVersion(params.get('deploymentVersion'))
  return queryVersion ?? envVersion ?? DEFAULT_DEPLOYMENT_VERSION
}

function normalizeDeploymentBatcherAddress(value: unknown): Address | null {
  const normalized = normalizeAddressLike(typeof value === 'string' ? value : null)
  if (!normalized) return null
  if (isDeprecatedCreatorVaultBatcherAddress(normalized)) return null
  const mapped = normalizeCreatorVaultBatcherAddress(normalized)
  return mapped ? (mapped as Address) : null
}

function defaultPhase3HelperForBatcher(batcher: Address | null | undefined): Address | null {
  return batcher && sameAddress(batcher, SPLIT_PHASE1_DEPLOYMENT_BATCHER) ? SPLIT_PHASE1_PHASE3_HELPER : null
}

function createBaseFallbackClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_PUBLIC_RPC_URL, { timeout: 12_000 }),
  })
}


async function postJsonWithTimeout<T>(params: {
  url: string
  body: unknown
  label: string
  requestTimeoutMs?: number
  parseTimeoutMs?: number
}): Promise<{ response: Response; json: ApiEnvelope<T> | null }> {
  const response = await withTimeout(
    fetch(params.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.body),
    }),
    params.requestTimeoutMs ?? 20_000,
    `${params.label} request`,
  )
  const json = await withTimeout(
    response.json().catch(() => null) as Promise<ApiEnvelope<T> | null>,
    params.parseTimeoutMs ?? 10_000,
    `${params.label} response parse`,
  )
  return { response, json }
}

async function waitForContractsDeployed(params: {
  publicClient: { getBytecode: (args: { address: Address }) => Promise<string | null> }
  addresses: Address[]
  label: string
  timeoutMs?: number
  intervalMs?: number
}): Promise<void> {
  const timeoutMs = params.timeoutMs ?? 90_000
  const intervalMs = params.intervalMs ?? 1_500
  const started = Date.now()
  while (true) {
    const codes = await Promise.all(params.addresses.map((a) => params.publicClient.getBytecode({ address: a })))
    const allDeployed = codes.every((c) => !!c && c !== '0x')
    if (allDeployed) return
    if (Date.now() - started > timeoutMs) {
      throw new Error(`${params.label} contracts not deployed after ${Math.round(timeoutMs / 1000)}s`)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

const CREATOR_VAULT_BATCHER_PHASE1_STATE_ABI = [
  {
    type: 'function',
    name: 'phase1SplitStates',
    stateMutability: 'view',
    inputs: [{ name: 'salt', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareOftSalt', type: 'bytes32' },
          { name: 'paramsHash', type: 'bytes32' },
          { name: 'codeIdsHash', type: 'bytes32' },
          { name: 'coreDone', type: 'bool' },
          { name: 'finalized', type: 'bool' },
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
          { name: 'shareOFT', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
  },
] as const

async function waitForPhase1CoreState(params: {
  publicClient: {
    readContract: (args: {
      address: Address
      abi: readonly unknown[]
      functionName: string
      args: readonly unknown[]
    }) => Promise<unknown>
  }
  batcher: Address
  baseSalt: Hex
  expectedVault?: Address | null
  expectedWrapper?: Address | null
  timeoutMs?: number
  intervalMs?: number
}): Promise<void> {
  const timeoutMs = params.timeoutMs ?? 60_000
  const intervalMs = params.intervalMs ?? 1_000
  const started = Date.now()

  while (true) {
    try {
      const state = (await params.publicClient.readContract({
        address: params.batcher,
        abi: CREATOR_VAULT_BATCHER_PHASE1_STATE_ABI as unknown as readonly unknown[],
        functionName: 'phase1SplitStates',
        args: [params.baseSalt],
      })) as any

      const coreDone = Boolean(state?.coreDone ?? state?.[7])
      const vaultRaw = (state?.vault ?? state?.[1] ?? ZERO_ADDRESS) as Address
      const wrapperRaw = (state?.wrapper ?? state?.[2] ?? ZERO_ADDRESS) as Address
      const vaultMatches = params.expectedVault ? getAddress(vaultRaw) === getAddress(params.expectedVault) : true
      const wrapperMatches = params.expectedWrapper ? getAddress(wrapperRaw) === getAddress(params.expectedWrapper) : true

      if (coreDone && vaultMatches && wrapperMatches) return
    } catch {
      // Keep polling through transient RPC lag/errors.
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error(`Phase 1 core state not visible after ${Math.round(timeoutMs / 1000)}s`)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

type AdminAuthResponse = { address: string; isAdmin: boolean } | null
type DeployRuntimeConfigResponse = {
  creatorVaultBatcher: Address | null
  creatorVaultBatcherConfigError: string | null
  deploymentVersion: string
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
  payoutRouterKeeperAddress: Address | null
  payoutRouterApprovedExternalSwapTargets: Address[]
  payoutRouterApprovedExternalSwapSpenders: Address[]
  zoraToken: Address | null
  payoutRouterZoraWethFee: number
  payoutRouterWethCreatorFee: number
}
type ServerDeployResponse = {
  userOpHash: string
  addresses: {
    vault: Address
    wrapper: Address
    shareOFT: Address
    gaugeController: Address
    ccaStrategy: Address
    oracle: Address
    burnStream?: Address
    payoutRouter?: Address
  }
}
type DeploySessionCall = { to: Address; value: string; data: Hex }
type DeploySessionVanityRequest = {
  vaultPrefix?: string
  shareSuffix?: string
}
type DeploySessionCreateRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  preflightOnly?: boolean
  phase1Calls: DeploySessionCall[]
  phase2CoreCalls: DeploySessionCall[]
  phase2FinalizeCalls: DeploySessionCall[]
  phase3Calls: DeploySessionCall[]
  phase4Calls: DeploySessionCall[]
  solanaOvault?: {
    enabled: boolean
    assetMintOrigin?: 'existing' | 'wrapped'
  }
  vanity?: DeploySessionVanityRequest
  version: string
}
type DeploySessionDryRunPhase = {
  name: 'phase1' | 'phase2Core' | 'phase2Finalize' | 'phase3' | 'phase4'
  status: 'passed' | 'failed'
  callCount: number
}
type DeploySessionDryRunFailure = {
  phase: DeploySessionDryRunPhase['name']
  callIndex: number
  to: Address
  error: string
}
type DeploySessionDryRunResponse = {
  ok: boolean
  forkMode: string
  phases: DeploySessionDryRunPhase[]
  failure?: DeploySessionDryRunFailure
}

type OvaultMeshStatus = {
  existingMintCompatible: boolean
  depositEligible: boolean
  redeemEligible: boolean
  assetPeerSet: boolean
  sharePeerSet: boolean
  meshStep: string | null
}

function readOvaultMeshStatus(raw: unknown): OvaultMeshStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const hasKnownField = (
    'existingMintCompatible' in value ||
    'depositEligible' in value ||
    'redeemEligible' in value ||
    'assetPeerSet' in value ||
    'sharePeerSet' in value ||
    'meshStep' in value
  )
  if (!hasKnownField) return null
  return {
    existingMintCompatible: value.existingMintCompatible !== false,
    depositEligible: value.depositEligible !== false,
    redeemEligible: value.redeemEligible !== false,
    assetPeerSet: value.assetPeerSet !== false,
    sharePeerSet: value.sharePeerSet !== false,
    meshStep: typeof value.meshStep === 'string' && value.meshStep.trim() ? value.meshStep.trim() : null,
  }
}

const DRY_RUN_PHASE_NAMES = new Set<DeploySessionDryRunPhase['name']>([
  'phase1',
  'phase2Core',
  'phase2Finalize',
  'phase3',
  'phase4',
])

const DRY_RUN_PHASE_LABELS: Record<DeploySessionDryRunPhase['name'], string> = {
  phase1: 'Phase 1 core/finalize',
  phase2Core: 'Phase 2 core',
  phase2Finalize: 'Phase 2 finalize',
  phase3: 'Phase 3 strategies',
  phase4: 'Phase 4 launch',
}

function normalizeDryRunResponse(data: unknown): DeploySessionDryRunResponse | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const forkMode =
    typeof raw.forkMode === 'string' && raw.forkMode.trim().length > 0
      ? raw.forkMode.trim()
      : 'unknown'
  const ok = raw.ok === true
  const phasesRaw = Array.isArray(raw.phases) ? raw.phases : []
  const phases: DeploySessionDryRunPhase[] = []
  for (const entry of phasesRaw) {
    if (!entry || typeof entry !== 'object') continue
    const phase = entry as Record<string, unknown>
    const name = String(phase.name ?? '').trim() as DeploySessionDryRunPhase['name']
    if (!DRY_RUN_PHASE_NAMES.has(name)) continue
    const status = phase.status === 'failed' ? 'failed' : 'passed'
    const parsedCallCount = Number(phase.callCount ?? 0)
    const callCount = Number.isFinite(parsedCallCount) && parsedCallCount >= 0
      ? Math.floor(parsedCallCount)
      : 0
    phases.push({ name, status, callCount })
  }

  let failure: DeploySessionDryRunFailure | undefined
  const failureRaw = raw.failure
  if (failureRaw && typeof failureRaw === 'object') {
    const parsed = failureRaw as Record<string, unknown>
    const phase = String(parsed.phase ?? '').trim() as DeploySessionDryRunFailure['phase']
    const to = String(parsed.to ?? '').trim()
    if (DRY_RUN_PHASE_NAMES.has(phase) && to) {
      const parsedCallIndex = Number(parsed.callIndex ?? 0)
      const callIndex = Number.isFinite(parsedCallIndex) && parsedCallIndex >= 0
        ? Math.floor(parsedCallIndex)
        : 0
      const error =
        typeof parsed.error === 'string' && parsed.error.trim().length > 0
          ? parsed.error.trim()
          : 'Dry-run simulation failed'
      failure = {
        phase,
        callIndex,
        to: to as Address,
        error,
      }
    }
  }

  const out: DeploySessionDryRunResponse = {
    ok,
    forkMode,
    phases,
  }
  if (failure) out.failure = failure
  return out
}

function isLocalForkRpcUrl(rpcUrl: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(rpcUrl.trim())
}
type DeployPlanExport = {
  generatedAt: string
  chainId: number
  useServerContinue: boolean
  batcher: Address
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  deploymentVersion: string
  expectedAddresses: {
    vault: Address
    wrapper: Address
    shareOFT: Address
    gaugeController: Address
    ccaStrategy: Address
    oracle: Address
    burnStream: Address
    payoutRouter: Address
  }
  phaseCounts: {
    phase1: number
    phase2Core: number
    phase2Finalize: number
    phase3: number
    phase4: number
  }
  sessionCreateRequest: DeploySessionCreateRequest
}

const CREATOR_COIN_OWNERS_ABI = [
  { type: 'function', name: 'totalOwners', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerAt', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  { type: 'error', name: 'AlreadyOwner', inputs: [{ name: 'owner', type: 'bytes' }] },
] as const

async function isCoinbaseSmartWalletOwner(params: {
  smartWallet: Address
  ownerAddress: Address
}): Promise<boolean> {
  const { smartWallet, ownerAddress } = params
  // Use server-side API to avoid client-side RPC rate limits
  try {
    const res = await fetch('/api/deploy/smartWalletOwner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smartWallet, ownerAddress }),
    })
    const json = await res.json()
    return json?.success === true && json?.data?.isOwner === true
  } catch {
    return false
  }
}

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

function formatEthPerTokenForUi(weiPerToken: bigint): string {
  if (weiPerToken <= 0n) return '0'

  const BASE = 10n ** 18n
  const whole = weiPerToken / BASE
  const frac = weiPerToken % BASE

  const wholeStr = whole.toString()
  const fracStrFull = frac.toString().padStart(18, '0')

  const MIN_DECIMALS = 6
  const DEFAULT_MAX_DECIMALS = 12
  const FULL_MAX_DECIMALS = 18

  const formatWithMaxDecimals = (maxDecimals: number): string => {
    const firstNonZero = fracStrFull.search(/[1-9]/)
    const desiredDecimals =
      firstNonZero === -1
        ? MIN_DECIMALS
        : Math.min(maxDecimals, Math.max(MIN_DECIMALS, firstNonZero + 4 /* show a few significant digits */))

    const fracShownRaw = fracStrFull.slice(0, desiredDecimals)
    const fracShownTrimmed = fracShownRaw.replace(/0+$/, '')

    if (!fracShownTrimmed) return wholeStr
    return `${wholeStr}.${fracShownTrimmed}`
  }

  // Prefer a compact display, but never show "0" for non-zero values.
  const compact = formatWithMaxDecimals(DEFAULT_MAX_DECIMALS)
  if (compact === '0' && weiPerToken > 0n) return formatWithMaxDecimals(FULL_MAX_DECIMALS)
  return compact
}

function encodeUniswapCcaLinearSteps(durationBlocks: bigint): Hex {
  const MPS = 10_000_000n
  if (durationBlocks <= 0n) return '0x'

  const mpsLow = MPS / durationBlocks
  const remainder = MPS - mpsLow * durationBlocks
  const mpsHigh = mpsLow + 1n

  const highBlocks = remainder
  const lowBlocks = durationBlocks - highBlocks

  const packStep = (mps: bigint, blockDelta: bigint) =>
    encodePacked(['uint24', 'uint40'], [Number(mps), Number(blockDelta)]) as Hex

  const steps: Hex[] = []
  if (highBlocks > 0n) steps.push(packStep(mpsHigh, highBlocks))
  if (lowBlocks > 0n) steps.push(packStep(mpsLow, lowBlocks))
  return concatHex(steps)
}

function deriveBaseSalt(params: { creatorToken: Address; owner: Address; chainId: number; version: string }): Hex {
  const { creatorToken, owner, chainId, version } = params
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      creatorToken,
      owner,
      BigInt(chainId),
      `4626:deploy:${version}`,
    ]),
  )
}

// L-16: Map known revert reasons / extension conflicts to user-friendly
// messages. Raw error.message is never rendered in production because it
// may leak internal contract storage slot names, addresses, or logic
// structure. Dev-only raw view is gated on import.meta.env.DEV.
const DEPLOY_VAULT_ERROR_PATTERNS: ReadonlyArray<{ match: RegExp; userMessage: string }> = [
  { match: /wallet.*extension|metamask|rabby|ethereum.*request|window\.ethereum/i,
    userMessage: 'A wallet extension (MetaMask, Rabby, etc.) is interfering with the page. Disable other wallet extensions and reload.' },
  { match: /user rejected|user denied|rejected the request/i,
    userMessage: 'The request was cancelled in the wallet. Retry when ready.' },
  { match: /insufficient funds|insufficient balance/i,
    userMessage: 'Insufficient funds to cover the deployment fee. Top up and retry.' },
  { match: /network.*mismatch|wrong.*network|unsupported chain|chain.*not.*supported/i,
    userMessage: 'Wallet is on the wrong network. Switch to Base Mainnet and retry.' },
  { match: /timeout|timed out|abort|AbortError/i,
    userMessage: 'The operation timed out. Check your connection and retry.' },
  { match: /nonce|replacement transaction underpriced/i,
    userMessage: 'Wallet transaction state is out of sync. Reset the account activity in your wallet and retry.' },
]

function sanitizeDeployVaultError(err: Error | null): string {
  if (!err) return 'Unexpected error. Please retry or reload the page.'
  const raw = String(err.message ?? '')
  for (const { match, userMessage } of DEPLOY_VAULT_ERROR_PATTERNS) {
    if (match.test(raw)) return userMessage
  }
  return 'Unexpected error. Please retry or reload the page.'
}

// Error boundary to catch React rendering errors (like #426) and allow retry
class DeployVaultErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full error to console for developer debugging (only visible to
    // users who open DevTools). The user-facing render path never exposes
    // raw error.message in production builds (L-16).
    console.error('[DeployVault] Error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState((s) => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      const userMessage = sanitizeDeployVaultError(this.state.error)
      const showRawForDev = import.meta.env.DEV && this.state.error?.message
      return (
        <div className="vault-shell min-h-screen bg-vault-bg text-white">
          <section className="max-w-[1400px] mx-auto px-6 py-16">
            <div className="text-[10px] font-medium text-zinc-500 mb-4">Deploy</div>
            <div className="vault-surface vault-hover-lift p-8 space-y-4">
              <div className="text-lg font-medium text-red-400">Something went wrong</div>
              <div className="text-sm text-zinc-400 leading-relaxed">
                {userMessage}
              </div>
              {showRawForDev ? (
                <div className="text-xs text-zinc-600 font-mono break-all">
                  [dev-only] {this.state.error?.message}
                </div>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-accent"
                  onClick={this.handleRetry}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => window.location.reload()}
                >
                  Reload page
                </button>
              </div>
              <div className="text-xs text-zinc-600">
                Tip: Try disabling other wallet extensions (MetaMask, Rabby) if this persists.
              </div>
            </div>
          </section>
        </div>
      )
    }

    return this.props.children
  }
}

export function DeployVault() {
  const privyClientStatus = usePrivyClientStatus()

  if (privyClientStatus === 'loading') {
    return (
      <div className="vault-shell min-h-screen bg-vault-bg text-white">
        <section className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-[10px] font-medium text-zinc-500 mb-4">Deploy</div>
          <div className="vault-surface vault-hover-lift p-8 space-y-3">
            <div className="text-lg font-medium">Initializing authentication</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              Waiting for Privy client readiness before loading deploy controls.
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Privy is used for auth/session - if disabled, show setup hint.
  if (privyClientStatus === 'disabled') {
    return (
      <div className="vault-shell min-h-screen bg-vault-bg text-white">
        <section className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-[10px] font-medium text-zinc-500 mb-4">Deploy</div>
          <div className="vault-surface vault-hover-lift p-8 space-y-3">
            <div className="text-lg font-medium">Authentication not configured</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              Deploy requires Privy authentication and canonical CSW context. Your app sub-account handles in-app execution; deploy signing uses your canonical CSW plus delegated server signer.
            </div>
            <div className="text-xs text-zinc-500 leading-relaxed">
              Set <span className="font-mono text-zinc-300">VITE_PRIVY_ENABLED=true</span> in environment variables.
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <DeployVaultErrorBoundary>
      <DeployVaultMain />
    </DeployVaultErrorBoundary>
  )
}

function saltFor(baseSalt: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
}

function deriveShareOftSalt(params: { owner: Address; shareSymbol: string; version: string }): Hex {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))
}

async function findDeploymentVersionForVanityTargets(params: {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  chainId: number
  baseVersion: string
  vaultPrefix?: string | null
  shareSuffix?: string | null
  maxTries: number
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
  isAddressDeployed?: (addr: Address) => Promise<boolean>
  yieldEvery?: number
}): Promise<string | null> {
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix ?? null)
  if (!vaultPrefix && !shareSuffix) return null
  const maxTries = Math.max(1, Math.floor(params.maxTries))

  if (typeof WebAssembly !== 'undefined' && typeof fetch === 'function') {
    let startAttempt = 0
    try {
      while (startAttempt < maxTries) {
        const result = await findPerVaultVanityVersionWithWasm({
          create2Deployer: params.create2Deployer,
          creatorToken: params.creatorToken,
          owner: params.owner,
          chainId: params.chainId,
          baseVersion: params.baseVersion,
          vaultPrefix,
          shareSuffix,
          startAttempt,
          maxAttempts: maxTries - startAttempt,
          vaultInitCodeHash: vaultPrefix ? keccak256(params.vaultInitCode) : null,
          shareOftInitCodeHash: shareSuffix ? keccak256(params.shareOftInitCode) : null,
          shareSymbol: shareSuffix ? params.shareSymbol : null,
        })
        const toCheck: Address[] = []
        for (const value of [result.vaultAddress, result.shareOftAddress]) {
          if (value && isAddress(value)) toCheck.push(getAddress(value))
        }
        if (params.isAddressDeployed && toCheck.length > 0) {
          const deployedStates = await Promise.all(toCheck.map((addr) => params.isAddressDeployed!(addr)))
          if (deployedStates.some(Boolean)) {
            startAttempt = result.attempt + 1
            continue
          }
        }
        return result.version
      }
      return null
    } catch (err) {
      logger.warn('[DeployVault] Rust WASM vanity search failed; falling back to TypeScript mirror', {
        error: err instanceof Error ? err.message : String(err ?? ''),
      })
    }
  }

  return findDeploymentVersionForVanityTargetsInTypescript({
    ...params,
    vaultPrefix,
    shareSuffix,
    maxTries,
  })
}

async function findDeploymentVersionForVanityTargetsInTypescript(params: {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  chainId: number
  baseVersion: string
  vaultPrefix?: string | null
  shareSuffix?: string | null
  maxTries: number
  vaultInitCode: Hex
  shareOftInitCode: Hex
  shareSymbol: string
  isAddressDeployed?: (addr: Address) => Promise<boolean>
  yieldEvery?: number
}): Promise<string | null> {
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix ?? null)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix ?? null)
  if (!vaultPrefix && !shareSuffix) return null
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const yieldEvery = Math.max(256, Math.floor(params.yieldEvery ?? 4096))

  for (let i = 0; i < maxTries; i += 1) {
    if (i > 0 && i % yieldEvery === 0) {
      // Yield periodically so large vanity scans do not freeze the UI thread.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const candidateVersion = i === 0 ? params.baseVersion : `${params.baseVersion}-v${i.toString(36)}`
    const baseSalt = deriveBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version: candidateVersion,
    })

    let vaultAddress: Address | null = null
    if (vaultPrefix) {
      const vaultSalt = saltFor(baseSalt, 'vault')
      vaultAddress = predictCreate2Address({
        create2Deployer: params.create2Deployer,
        salt: vaultSalt,
        initCode: params.vaultInitCode,
      })
      if (vaultAddress.slice(2, 2 + vaultPrefix.length).toLowerCase() !== vaultPrefix) continue
    }

    let shareAddress: Address | null = null
    if (shareSuffix) {
      const shareSalt = deriveShareOftSalt({
        owner: params.owner,
        shareSymbol: params.shareSymbol,
        version: candidateVersion,
      })
      shareAddress = predictCreate2Address({
        create2Deployer: params.create2Deployer,
        salt: shareSalt,
        initCode: params.shareOftInitCode,
      })
      if (!shareAddress.toLowerCase().endsWith(shareSuffix)) continue
    }

    if (params.isAddressDeployed) {
      const toCheck = [vaultAddress, shareAddress].filter((v): v is Address => Boolean(v))
      if (toCheck.length > 0) {
        try {
          const deployedStates = await Promise.all(toCheck.map((addr) => params.isAddressDeployed!(addr)))
          if (deployedStates.some(Boolean)) continue
        } catch {
          // ignore deployed-check failures; allow candidate version
        }
      }
    }
    return candidateVersion
  }
  return null
}

function predictCreate2Address(params: { create2Deployer: Address; salt: Hex; initCode: Hex }): Address {
  const bytecodeHash = keccak256(params.initCode)
  return getCreate2Address({ from: params.create2Deployer, salt: params.salt, bytecodeHash })
}

async function fetchAdminAuth(): Promise<AdminAuthResponse> {
  const res = await apiFetch('/api/auth/admin', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminAuthResponse> | null
  if (!res.ok || !json) return null
  if (!json.success) return null
  return (json.data ?? null) as AdminAuthResponse
}

async function fetchDeployRuntimeConfig(): Promise<DeployRuntimeConfigResponse | null> {
  const res = await apiFetch('/api/deploy/config', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<DeployRuntimeConfigResponse> | null
  if (!res.ok || !json) return null
  if (!json.success) return null
  return (json.data ?? null) as DeployRuntimeConfigResponse
}

const STALE_DEPLOY_CONFIG_RELOAD_KEY = 'cv:deploy:staleConfigAutoReloadAt'
const STALE_DEPLOY_CONFIG_RELOAD_WINDOW_MS = 10_000
const RUNTIME_BATCHER_WARNING_DISMISS_KEY = 'cv:deploy:runtimeBatcherWarningDismissed'

function isLocalhostRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

function tryAutoRecoverStaleDeployConfig(params: {
  reason: 'batcher' | 'deploymentVersion'
  clientValue: string
  runtimeValue: string
}): boolean {
  if (!isLocalhostRuntime()) return false
  if (typeof window === 'undefined') return false

  try {
    const now = Date.now()
    const lastRaw = window.sessionStorage.getItem(STALE_DEPLOY_CONFIG_RELOAD_KEY) ?? '0'
    const last = Number(lastRaw)
    if (Number.isFinite(last) && last > 0 && now - last < STALE_DEPLOY_CONFIG_RELOAD_WINDOW_MS) {
      return false
    }
    window.sessionStorage.setItem(STALE_DEPLOY_CONFIG_RELOAD_KEY, String(now))
    logger.info('[DeployVault] stale_runtime_config_detected', {
      reason: params.reason,
      clientValue: params.clientValue,
      runtimeValue: params.runtimeValue,
      href: window.location.href,
    })
    // Do not force a client reload here. In environments with many injected wallets, reload can
    // repeatedly re-trigger provider-injection races and look like a crash loop.
    return false
  } catch {
    return false
  }
}

// Use the canonical EntryPoint v0.6 from the ERC-4337 module
// This ensures the UI and the UserOp sender use the same address
const COINBASE_ENTRYPOINT_V06 = ERC4337_ENTRYPOINT_V06

// BUILD-TIME ASSERTION: Verify EntryPoint v0.6 matches expected address
// This will throw at module load if there's a mismatch
assertEntryPointV06(addr('5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'))

const COIN_PAYOUT_RECIPIENT_ABI = [
  {
    type: 'function',
    name: 'setPayoutRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newPayoutRecipient', type: 'address' }],
    outputs: [],
  },
] as const

const COIN_OWNERSHIP_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'transferOwnership',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },
] as const

const UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'codeId', type: 'bytes32' },
      { name: 'constructorArgs', type: 'bytes' },
    ],
    outputs: [{ name: 'deployed', type: 'address' }],
  },
] as const

const PAYOUT_ROUTER_ADMIN_ABI = [
  {
    type: 'function',
    name: 'keeper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'swapPathToCreator',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setKeeper',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newKeeper', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapTargetApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapSpenderApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSwapPath',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'path', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

const UNISWAP_V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const

const BATCHER_PHASE3_CONFIG_ABI = [
  {
    type: 'function',
    name: 'phase3Helper',
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
  {
    type: 'function',
    name: 'uniswapRouter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniswapV3Factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ajnaFactory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const AJNA_FACTORY_ABI = [
  {
    type: 'function',
    name: 'ERC20_NON_SUBSET_HASH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'deployedPools',
    stateMutability: 'view',
    inputs: [
      { name: 'subsetHash', type: 'bytes32' },
      { name: 'quoteToken', type: 'address' },
      { name: 'collateralToken', type: 'address' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'MIN_RATE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'MAX_RATE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deployPool',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'quoteToken', type: 'address' },
      { name: 'collateralToken', type: 'address' },
      { name: 'interestRate', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

const CHARM_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createVault',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'pool', type: 'address' },
          { name: 'manager', type: 'address' },
          { name: 'managerFee', type: 'uint24' },
          { name: 'rebalanceDelegate', type: 'address' },
          { name: 'maxTotalSupply', type: 'uint256' },
          { name: 'baseThreshold', type: 'int24' },
          { name: 'limitThreshold', type: 'int24' },
          { name: 'fullRangeWeight', type: 'uint24' },
          { name: 'period', type: 'uint32' },
          { name: 'minTickMove', type: 'int24' },
          { name: 'maxTwapDeviation', type: 'int24' },
          { name: 'twapDuration', type: 'uint32' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
        ],
      },
    ],
    outputs: [{ name: 'vault', type: 'address' }],
  },
] as const

const CREATOR_VAULT_ADMIN_ABI = [
  {
    type: 'function',
    name: 'burnStream',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'setBurnStream',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'burnStream', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'status', type: 'bool' },
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

// Legacy permit/permit2 ABIs were used for the one-tx deploy paths (now removed).

const CREATOR_VAULT_BATCHER_ABI = [
  {
    type: 'function',
    name: 'bytecodeStore',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'protocolTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'registry',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'chainlinkEthUsd',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'permit2',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'deployNonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deployPhase1',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase1Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase1CoreWithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'finalizePhase1',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'finalizePhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
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
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase2AndLaunch',
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
          { name: 'shareOFT', type: 'address' },
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
  {
    type: 'function',
    name: 'finalizePhase2WithPermit2',
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
          { name: 'shareOFT', type: 'address' },
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
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
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
  {
    type: 'function',
    name: 'deployPhase2AndLaunchWithPermit',
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
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
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
      {
        name: 'permit',
        type: 'tuple',
        components: [
          { name: 'deadline', type: 'uint256' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
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
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'v3Pool', type: 'address' },
          { name: 'charmVault', type: 'address' },
          { name: 'charmStrategy', type: 'address' },
          { name: 'ajnaVaultAuth', type: 'address' },
          { name: 'ajnaVault', type: 'address' },
          { name: 'ajnaStrategy', type: 'address' },
          { name: 'solanaStrategy', type: 'address' },
        ],
      },
    ],
  },
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

// UniversalBytecodeStore (v1 + v2 compatible) helpers.
const UNIVERSAL_BYTECODE_STORE_POINTERS_ABI = [
  {
    type: 'function',
    name: 'pointers',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const

// UniversalBytecodeStoreV2 adds chunking for >24KB creation code. v1 stores won't recognize this selector.
const UNIVERSAL_BYTECODE_STORE_CHUNKCOUNT_ABI = [
  {
    type: 'function',
    name: 'chunkCount',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const BATCHER_PHASE1_SPLIT_STATE_VIEW_ABI = [
  {
    type: 'function',
    name: 'phase1SplitStates',
    stateMutability: 'view',
    inputs: [{ name: 'baseSalt', type: 'bytes32' }],
    outputs: [
      { name: 'oftBootstrapRegistry', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'shareOftSalt', type: 'bytes32' },
      { name: 'paramsHash', type: 'bytes32' },
      { name: 'codeIdsHash', type: 'bytes32' },
      { name: 'coreDone', type: 'bool' },
      { name: 'finalized', type: 'bool' },
    ],
  },
] as const

const CREATE2_DEPLOYER_STORE_ABI = [
  {
    type: 'function',
    name: 'store',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

function AddressRow({
  label,
  address,
  deployed,
}: {
  label: string
  address: Address | null | undefined
  deployed?: boolean | null
}) {
  const a = address ? String(address) : ''
  const ok = a && a !== String(ZERO_ADDRESS)
  const href = ok ? `https://basescan.org/address/${a}` : null
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <div className="text-zinc-500">{label}</div>
      {ok && deployed === false ? (
        <div className="font-mono text-zinc-400">
          {shortAddress(a)} <span className="text-zinc-600">(pending)</span>
        </div>
      ) : ok && deployed === null ? (
        <div className="font-mono text-zinc-500">
          {shortAddress(a)} <span className="text-zinc-600">(checking…)</span>
        </div>
      ) : ok && href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-zinc-200/90 hover:text-white transition-colors"
        >
          {shortAddress(a)}
        </a>
      ) : (
        <div className="font-mono text-zinc-600">—</div>
      )}
    </div>
  )
}

function DeployVaultBatcher({
  creatorToken,
  owner,
  minFirstDeposit,
  tokenDecimals,
  depositSymbol,
  shareSymbol,
  shareName,
  vaultSymbol,
  vaultName,
  deploymentVersion: deploymentVersionProp,
  shareOftSaltOverride,
  currentPayoutRecipient,
  marketFloorText,
  floorPriceQ96Aligned,
  getAccessToken,
  signInWithPrivyToken,
  onSuccess,
  switchAuthCta,
  smartWalletClient,
  canonicalSmartWallet,
  privySmartWalletAddress,
  privySmartWalletIsCanonicalOwner,
  privySmartWalletCanSign,
  privyEmbeddedEoaWallet,
  privyEmbeddedEoaAddress,
  privyEmbeddedEoaIsCanonicalOwner,
  privyEmbeddedEoaCanSign,
  connectedEoaOwnerReady,
  strictNoEoaMode,
  solanaMintOverride,
  solanaDecimalsOverride,
  connectorId,
  wagmiWalletClient,
}: {
  creatorToken: Address
  owner: Address
  minFirstDeposit: bigint
  tokenDecimals: number | null
  depositSymbol: string
  shareSymbol: string
  shareName: string
  vaultSymbol: string
  vaultName: string
  deploymentVersion: string
  shareOftSaltOverride: Hex | null
  currentPayoutRecipient: Address | null
  marketFloorText: string | null
  floorPriceQ96Aligned: bigint | null
  getAccessToken?: (() => Promise<string | null>) | null
  signInWithPrivyToken?: ((token: string) => Promise<string | null>) | null
  onSuccess: (addresses: ServerDeployResponse['addresses']) => void
  switchAuthCta?: { label: string; onClick: () => void }
  smartWalletClient: any
  canonicalSmartWallet: Address | null
  privySmartWalletAddress: Address | null
  privySmartWalletIsCanonicalOwner: boolean
  privySmartWalletCanSign: boolean
  privyEmbeddedEoaWallet: any
  privyEmbeddedEoaAddress: Address | null
  privyEmbeddedEoaIsCanonicalOwner: boolean
  privyEmbeddedEoaCanSign: boolean
  connectedEoaOwnerReady: boolean
  strictNoEoaMode: boolean
  solanaMintOverride: Hex | null
  solanaDecimalsOverride: number | null
  // For direct Coinbase Wallet connection (supports eth_sign)
  connectorId: string | undefined
  wagmiWalletClient: any
}) {
  const { address: connectedAddress } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const [batcherOverride, setBatcherOverride] = useState<Address | null>(null)
  const [deploymentVersionOverride, setDeploymentVersionOverride] = useState<string | null>(null)
  const deploymentVersion = deploymentVersionOverride ?? deploymentVersionProp
  // Legacy ShareOFT Solana overrides are intentionally unused in main deploy flow now.
  void solanaMintOverride
  void solanaDecimalsOverride
  
  // Detect Coinbase Wallet direct connection (not via Privy)
  const isCoinbaseWalletDirect = connectorId === 'coinbaseWalletSDK' || connectorId === 'com.coinbase.wallet'
  const strictNoEoaEnforced = strictNoEoaMode

  // NOTE: Zora cross-app integration is read-only in this app, so we do not use it for signing/transactions.

  const getPrivyEmbeddedEoaProvider = useCallback(async () => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return null
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') {
      return walletAny.provider
    }
    if (typeof walletAny.getEthereumProvider === 'function') {
      const provider = await walletAny.getEthereumProvider().catch(() => null)
      if (provider && typeof provider.request === 'function') return provider
    }
    if (typeof walletAny.request === 'function') {
      return { request: walletAny.request.bind(walletAny) }
    }
    return null
  }, [privyEmbeddedEoaWallet])

  const signOwnerPermit2TypedData = useCallback(
    async (typedData: Record<string, unknown>): Promise<Hex> => {
      if (privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign && privyEmbeddedEoaAddress) {
        const embeddedProvider = await getPrivyEmbeddedEoaProvider()
        if (embeddedProvider?.request) {
          await ensureProviderOnBase({ provider: embeddedProvider, label: 'Privy embedded EOA' })
          const rawSig = await embeddedProvider.request({
            method: 'eth_signTypedData_v4',
            params: [privyEmbeddedEoaAddress, JSON.stringify(typedData)],
          })
          return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
        }
      }

      if (privySmartWalletIsCanonicalOwner && privySmartWalletCanSign && smartWalletClient && privySmartWalletAddress) {
        await ensureProviderOnBase({ provider: smartWalletClient, label: 'Privy smart wallet' })
        const client: any = smartWalletClient as any
        const account: any = client?.account
        if (typeof account?.signTypedData === 'function' || typeof client?.signTypedData === 'function') {
          const context =
            typeof account?.signTypedData === 'function'
              ? 'privySmartWallet.account.signTypedData'
              : 'privySmartWallet.signTypedData'
          const rawResult = await withTimeout(
            typeof account?.signTypedData === 'function'
              ? account.signTypedData(typedData as any)
              : client.signTypedData({ account: privySmartWalletAddress, ...(typedData as any) }),
            20_000,
            context,
          )
          const sig = ensureSignatureHex(rawResult, context)
          logNonEoaSignature(sig, context)
          return sig
        }
      }

      if (connectedAddress && wagmiWalletClient) {
        await ensureProviderOnBase({ provider: wagmiWalletClient, label: 'Connected wallet' })
        const walletAny: any = wagmiWalletClient as any
        if (typeof walletAny?.signTypedData === 'function') {
          const rawResult = await withTimeout(
            walletAny.signTypedData({ account: connectedAddress as Address, ...(typedData as any) }),
            20_000,
            'connectedWallet.signTypedData',
          )
          return ensureSignatureHex(rawResult, 'connectedWallet.signTypedData')
        }
        if (typeof walletAny?.request === 'function') {
          const rawResult = await walletAny.request({
            method: 'eth_signTypedData_v4',
            params: [connectedAddress, JSON.stringify(typedData)],
          })
          return ensureSignatureHex(rawResult, 'connectedWallet.eth_signTypedData_v4')
        }
      }

      throw new Error('Connected wallet does not support typed-data signatures required for Permit2 deploy activation.')
    },
    [
      connectedAddress,
      getPrivyEmbeddedEoaProvider,
      privyEmbeddedEoaAddress,
      privyEmbeddedEoaCanSign,
      privyEmbeddedEoaIsCanonicalOwner,
      privySmartWalletAddress,
      privySmartWalletCanSign,
      privySmartWalletIsCanonicalOwner,
      smartWalletClient,
      wagmiWalletClient,
    ],
  )

  const smartWalletAddrForAuth = useMemo(() => {
    try {
      return smartWalletClient ? getAddress(String((smartWalletClient as any)?.account?.address ?? '')) : null
    } catch {
      return null
    }
  }, [smartWalletClient])

  // Require the Privy Smart Wallet client for deployment; its account address
  // is the smart wallet itself and can sign/submit without relying on eth_sign from EOAs.
  const canUsePrivySmartWallet = useMemo(() => {
    return !!smartWalletClient && !!smartWalletAddrForAuth
  }, [smartWalletAddrForAuth, smartWalletClient])

  // Check if connected wallet supports EIP-5792 wallet_sendCalls
  // Coinbase Wallet supports this (cross-app wallets are read-only in this app).
  const canUseWalletSendCalls = useMemo(() => {
    if (!connectorId) return false
    const supportedConnectors = ['coinbaseWalletSDK']
    return supportedConnectors.includes(connectorId)
  }, [connectorId])

  const resolvedTokenDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const formatDeposit = (raw?: bigint): string => {
    if (raw === undefined) return '—'
    const s = formatUnits(raw, resolvedTokenDecimals)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

  const [busy, setBusy] = useState(false)
  const [dryRunBusy, setDryRunBusy] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<DeploySessionDryRunResponse | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runtimeBatcherConfigError, setRuntimeBatcherConfigError] = useState<string | null>(null)
  const [runtimeBatcherWarningDismissed, setRuntimeBatcherWarningDismissed] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'done'>('idle')
  const [lastSessionStep, setLastSessionStep] = useState<string>('')
  const [seenOvaultMeshStep, setSeenOvaultMeshStep] = useState<boolean>(false)
  const [ovaultMeshStatus, setOvaultMeshStatus] = useState<OvaultMeshStatus | null>(null)
  const [phaseTxs, setPhaseTxs] = useState<{
    userOp1?: Hex
    userOp2?: Hex
    userOp3?: Hex
    userOp4?: Hex
    tx1?: Hex
    tx2?: Hex
    tx3?: Hex
    tx4?: Hex
  }>({})
  const dryRunLocalForkRpc = useMemo(
    () => isLocalForkRpcUrl(String(import.meta.env.VITE_BASE_RPC ?? '')),
    [],
  )
  const expectedRef = useRef<ServerDeployResponse['addresses'] | null>(null)
  const lastPolledStepRef = useRef<string>('')
  const useServerContinue = useMemo(() => {
    // Keep server-continue enabled for both default and strict modes.
    // Strict policy is enforced by signer lanes (canonical/Privy), not by disabling continuation.
    return true
  }, [])
  const legacyDeploySessionStorageKey = useMemo(() => {
    const ct = String(creatorToken ?? '').toLowerCase()
    const ow = String(owner ?? '').toLowerCase()
    return `cv:deploy:session:${ct}:${ow}`
  }, [creatorToken, owner])
  const deploySessionStorageKey = useMemo(() => {
    const ct = String(creatorToken ?? '').toLowerCase()
    const ow = String(owner ?? '').toLowerCase()
    const vv = String(deploymentVersion ?? '').trim().toLowerCase()
    return `cv:deploy:session:${ct}:${ow}:${vv}`
  }, [creatorToken, deploymentVersion, owner])
  const persistDeploySession = useCallback(
    (sessionId: string) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(
          deploySessionStorageKey,
          JSON.stringify({
            sessionId,
            creatorToken: String(creatorToken).toLowerCase(),
            owner: String(owner).toLowerCase(),
            version: String(deploymentVersion),
            createdAt: new Date().toISOString(),
          }),
        )
      } catch {
        // ignore storage errors
      }
    },
    [creatorToken, deploySessionStorageKey, deploymentVersion, owner],
  )
  const clearDeploySession = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(deploySessionStorageKey)
      localStorage.removeItem(legacyDeploySessionStorageKey)
    } catch {
      // ignore
    }
  }, [deploySessionStorageKey, legacyDeploySessionStorageKey])
  const loadDeploySession = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(deploySessionStorageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const rawVersion = typeof parsed?.version === 'string' ? parsed.version.trim() : ''
      if (rawVersion && rawVersion !== deploymentVersion) return null
      const sessionId = typeof parsed?.sessionId === 'string' ? parsed.sessionId.trim() : ''
      return sessionId.length > 0 ? sessionId : null
    } catch {
      return null
    }
  }, [deploySessionStorageKey, deploymentVersion])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      // One-time cleanup so old unscoped sessions cannot be resumed after version bumps.
      localStorage.removeItem(legacyDeploySessionStorageKey)
    } catch {
      // ignore
    }
  }, [legacyDeploySessionStorageKey])
  const shareOftVanityCacheRef = useRef<{ key: string; salt: Hex } | null>(null)
  const vaultVanityVersionCacheRef = useRef<{ key: string; version: string } | null>(null)
  const shareOftVanitySkipLogKeyRef = useRef<string | null>(null)
  const creatorCoinOwnerUnresolvedLogKeyRef = useRef<string | null>(null)
  const ensurePaymasterSession = useCallback(async () => {
    if (!getAccessToken || typeof signInWithPrivyToken !== 'function') return
    try {
      const token = await getAccessToken()
      if (!token) return
      await signInWithPrivyToken(token)
    } catch {
      // If we can't bridge, we still let the paymaster decide.
    }
  }, [getAccessToken, signInWithPrivyToken])
  const { postSessionRequest, pollSession } = useDeploySessionV2()
  const postDeploySessionJson = useCallback(
    async <T,>(params: {
      url: string
      body: unknown
      label: string
    }): Promise<ApiEnvelope<T>> => {
      return await postSessionRequest<T>({
        postJson: postJsonWithTimeout,
        url: params.url,
        body: params.body,
        label: params.label,
        ensurePaymasterSession,
      })
    },
    [ensurePaymasterSession, postSessionRequest],
  )
  const switchAuthLabel = typeof switchAuthCta?.label === 'string' && switchAuthCta.label.trim().length > 0 ? switchAuthCta.label.trim() : null
  const creatorStrategyFeaturesHref = useMemo(
    () => `/creator/strategy/features?creator=${creatorToken}`,
    [creatorToken],
  )
  const isVanityPaidFeatureError = useCallback((message: string | null | undefined): boolean => {
    const lower = String(message ?? '').toLowerCase()
    if (!lower) return false
    return (
      lower.includes('vanity deploy requires paid feature activation') ||
      lower.includes('deploy_vanity_')
    )
  }, [])
  const isOvaultMeshPaidFeatureError = useCallback((message: string | null | undefined): boolean => {
    const lower = String(message ?? '').toLowerCase()
    if (!lower) return false
    return (
      lower.includes('ovault mesh deploy lane requires paid feature activation') ||
      lower.includes('solana_ovault_mesh')
    )
  }, [])

  const lastAuthAtMs = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('cv:privy:lastAuthAt')
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    } catch {
      return null
    }
  }, [])

  const authIsStale = useMemo(() => {
    if (!lastAuthAtMs) return false
    // “Soft” guardrail (no extra prompts): remind the user if they’re resuming an old session.
    return Date.now() - lastAuthAtMs > 2 * 60 * 60 * 1000
  }, [lastAuthAtMs])

  const formatDeployError = useCallback((e: unknown): string => {
    const raw = e instanceof Error ? e.message : String(e ?? '')
    const msg = String(raw || 'Deployment failed')
    const lower = msg.toLowerCase()

    // Check if a transaction was actually submitted despite the error (common with bundler estimation errors)
    const submittedMatch = msg.match(/Submitted:\s*(0x[a-fA-F0-9]{64})/)
    if (submittedMatch && lower.includes('execution reverted')) {
      const txHash = submittedMatch[1]
      return (
        `⚠️ The bundler reported an estimation error, but your transaction was submitted!\n\n` +
        `Transaction: ${txHash}\n\n` +
        `Check Basescan to verify if it succeeded. If it did, refresh the page to continue.`
      )
    }

    if (lower.includes('blocked the raw signature method') && lower.includes('eth_sign')) {
      return (
        "Your current wallet can’t sign the UserOp hash required for smart wallet execution (`eth_sign`). " +
        'Sign in to 4626 to restore your embedded signer, or use Coinbase Wallet (Base Account), then retry.'
      )
    }
    if (lower.includes('method not supported') && lower.includes('eth_sign')) {
      return (
        "Your signer doesn’t support `eth_sign`, which is required to sign smart wallet UserOp hashes. " +
        'Sign in to 4626 to restore your embedded signer, or use Coinbase Wallet (Base Account), then retry.'
      )
    }
    if (lower.includes('no-eoa deploy requires') || lower.includes('no-eoa deploy is only available')) {
      return `${NO_EOA_STRICT_BLOCKER} Click “${switchAuthLabel ?? 'Restore account connection'}” and retry.`
    }
    if (
      lower.includes('smart wallet client required') ||
      lower.includes('privy smart wallet client required') ||
      lower.includes('smart wallet required')
    ) {
      return 'Smart wallet required. Sign in to 4626 to restore your canonical Coinbase Smart Wallet session, or use Coinbase Wallet (Base Account), then retry.'
    }
    if (lower.includes('wallet_sendcalls') && lower.includes('unsupported method')) {
      return 'Your wallet does not support call batching (wallet_sendCalls). Use Coinbase Wallet (Base Account) or Privy smart wallet, then retry.'
    }
    if (lower.includes('chain: undefined') && lower.includes('wallet_sendcalls')) {
      return 'Call batching failed to resolve the Base chain. Reconnect your wallet or use Coinbase Wallet (Base Account), then retry.'
    }
    if (lower.includes('switch') && lower.includes('base')) {
      return 'Please switch your wallet to Base and retry.'
    }
    if (
      isProviderCollisionErrorMessage(msg) ||
      (lower.includes('metamask') &&
        (lower.includes('not found') || lower.includes('failed to connect')))
    ) {
      return 'MetaMask failed to initialize because another wallet extension already controls window.ethereum. Disable one extension (MetaMask/Coinbase/Rabby), or use Coinbase Wallet/Privy sign-in.'
    }
    // Paymaster/bundler errors: be specific (don’t mask real server-side errors).
    if (lower.includes('bundler entrypoint probe failed')) {
      if (lower.includes('cdp paymaster endpoint is not configured')) {
        return 'Paymaster proxy is missing a server-side CDP endpoint. Keep `VITE_CDP_PAYMASTER_URL=/api/paymaster`, and set `CDP_PAYMASTER_URL` (server env) to `https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>`.'
      }
      if (
        lower.includes('method not found') ||
        lower.includes('method not allowed') ||
        lower.includes('unsupported method')
      ) {
        return (
          'Bundler endpoint rejected `eth_supportedEntryPoints`. ' +
          'Set `VITE_CDP_BUNDLER_URL` to a real ERC-4337 bundler endpoint (or remove it to use `/api/paymaster`), ' +
          'and verify server env `CDP_PAYMASTER_URL` points to the same CDP RPC.'
        )
      }
      return (
        'Bundler probe failed before deployment. Check `VITE_CDP_BUNDLER_URL` (client) and `CDP_PAYMASTER_URL` (server), ' +
        'then retry.'
      )
    }
    if (lower.includes('bundler does not support entrypoint v0.6')) {
      return (
        'Bundler does not advertise EntryPoint v0.6 (0x5FF1...). ' +
        'Use a bundler that supports v0.6 (CDP Base endpoint), or route through `/api/paymaster` with a valid `CDP_PAYMASTER_URL`.'
      )
    }
    if (lower.includes('cdp paymaster endpoint is not configured')) {
      return 'Paymaster proxy is missing a server-side CDP endpoint. Keep `VITE_CDP_PAYMASTER_URL=/api/paymaster`, and set `CDP_PAYMASTER_URL` (server env) to `https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>`.'
    }
    if (lower.includes('aa21')) {
      return (
        'Bundler rejected the UserOp with AA21 during account/init validation. ' +
        'Re-auth with wallet sign-in, ensure the canonical sender can pass validation on Base, and retry.'
      )
    }
    if (
      lower.includes('sponsored userop exceeds paymaster total gas cap') ||
      (lower.includes('total gas used by the user operation') && lower.includes('allowed limit'))
    ) {
      return (
        'Sponsored UserOp exceeds the paymaster total-gas cap for this phase. ' +
        'Increase your CDP paymaster per-UserOp gas limit, or use a lower-gas deploy path.'
      )
    }
    if (lower.includes('server misconfigured: auth_session_secret')) {
      return 'Server misconfigured: set `AUTH_SESSION_SECRET` in production so `/api/paymaster` can validate SIWE sessions.'
    }
    // Only show the “not configured” message for true missing-config errors.
    if (
      msg === 'Bundler / paymaster endpoint is not configured.' ||
      lower.includes('missing bundler url') ||
      lower.includes('missing bundler') ||
      lower.includes('missing paymaster url') ||
      lower.includes('missing paymaster')
    ) {
      return 'Bundler / paymaster is not configured. Set `VITE_CDP_PAYMASTER_URL=/api/paymaster` and configure `CDP_PAYMASTER_URL` server-side, then retry.'
    }
    if (lower.includes('no_session') || lower.includes('not authenticated') || lower.includes('request denied - no_session')) {
      return `Gas sponsorship requires a session. Click “${switchAuthLabel ?? 'Restore account connection'}” and retry.`
    }
    if (lower.includes('session address must match owner or smart wallet')) {
      return (
        'Your current auth session does not match the deploy sender expected by the server. ' +
        `Click “${switchAuthLabel ?? 'Restore account connection'}” to re-auth, or disable server-continue (` +
        'set `VITE_DEPLOY_USE_SERVER_CONTINUE=false`) and retry.'
      )
    }
    if (lower.includes('deploy ownership mismatch')) {
      const reasonMatch = msg.match(/deploy ownership mismatch:\s*([a-z0-9_]+)/i)
      const reasonCode = reasonMatch?.[1] ? String(reasonMatch[1]) : null
      const reasonSuffix = reasonCode ? ` (reason: ${reasonCode})` : ''
      const ownerSetupHint =
        reasonCode === 'canonical_wallet_not_verified' ||
        reasonCode === 'session_not_onchain_owner' ||
        reasonCode === 'session_not_linked'
          ? ' Complete the one-time owner approval to add your app Privy wallet as an owner of your canonical Coinbase Smart Wallet, then retry.'
          : ''
      return (
        'Deploy session ownership validation failed' +
        reasonSuffix +
        '. Re-auth to refresh wallet linkage, then retry.' +
        ownerSetupHint +
        ' Ensure the connected signer is your canonical Base Account session.'
      )
    }
    if (lower.includes('session_owner_not_installed') || lower.includes('deploy-session signer is not installed')) {
      return (
        'Deploy-session signer is not installed on your canonical smart wallet yet. ' +
        'Approve the one-time add-owner transaction from your canonical Base Account session (or Base App prolink), then retry deploy.'
      )
    }
    if (isVanityPaidFeatureError(lower)) {
      return (
        'Custom vanity deploy options are a paid feature. ' +
        'Default vanity remains free (vault prefix 0x4626, share suffix 4626). ' +
        `Activate vanity access in Creator Strategy features (${creatorStrategyFeaturesHref}), then retry.`
      )
    }
    if (isOvaultMeshPaidFeatureError(lower)) {
      return (
        'OVault mesh alignment is a paid feature. ' +
        `Activate it in Creator Strategy features (${creatorStrategyFeaturesHref}), then retry.`
      )
    }
    if (lower.includes('0xe7fdf838') || lower.includes('saltoverridedisabled')) {
      return (
        'The active deployment batcher does not support ShareOFT salt overrides. ' +
        'Refresh the page so the deploy planner can use the no-salt Phase 1 path, then retry.'
      )
    }
    if (lower.includes('0x5cfe78fe') || lower.includes('invalidmoduleaddress')) {
      return (
        'The selected deployment batcher is wired to incompatible CreatorOVault modules (InvalidModuleAddress). ' +
        'Switch to a module-compatible batcher/runtime deploy stack, then retry.'
      )
    }
    if (
      lower.includes('user rejected') ||
      lower.includes('rejected the request') ||
      lower.includes('action_rejected') ||
      lower.includes('user denied') ||
      lower.includes('user cancelled')
    ) {
      return (
        'Wallet request was cancelled. Approve the wallet prompt to continue deploy, or reconnect your canonical Base Account session and retry.'
      )
    }
    if (lower.includes('missing_primary_call')) {
      const expectedMatch = msg.match(/expectedBatcher=(0x[a-fA-F0-9]{40})/i)
      const seenMatch = msg.match(/seen=(0x[a-fA-F0-9]{40}):(0x[a-fA-F0-9]{8})/i)
      const expectedBatcher = expectedMatch?.[1] ?? null
      const seenBatcher = seenMatch?.[1] ?? null
      const seenSelector = seenMatch?.[2] ?? null
      const mismatchDetail =
        expectedBatcher && seenBatcher
          ? ` server expects ${expectedBatcher}, but request used ${seenBatcher}${seenSelector ? ` (${seenSelector})` : ''}.`
          : ''
      return (
        'Paymaster rejected the deploy call shape (`missing_primary_call`).' +
        mismatchDetail +
        ' This is usually a frontend/backend batcher mismatch. On Vercel, keep `ALLOW_API_CONTRACT_OVERRIDES` unset/0, remove stale `CREATOR_VAULT_BATCHER`, and redeploy latest commit.'
      )
    }
    if (lower.includes('signature check failed') || lower.includes('invalid userop signature')) {
      return (
        "UserOp signature failed. This usually means the signer isn’t an onchain owner or didn’t sign the raw UserOp hash with `eth_sign`. " +
        'Sign in to 4626 to restore your embedded signer or canonical Base Account session, then retry. If you just added a new owner, refresh and retry.'
      )
    }
    if (lower.includes('failed to fetch')) {
      return 'Paymaster request failed to reach the endpoint (network/CORS). Prefer `VITE_CDP_PAYMASTER_URL=/api/paymaster` and ensure the server env `CDP_PAYMASTER_URL` is set.'
    }
    if (lower.includes('banned opcode') || lower.includes('stake/unstake delay') || lower.includes('unstake delay too low')) {
      return (
        'Gas sponsorship was rejected by the bundler (paymaster stake/unstake delay too low). ' +
        'Retry with a funded smart wallet or contact support to fix paymaster staking.'
      )
    }
    if (lower.includes('market floor price not available')) {
      return 'Market floor price is still loading. Wait a moment and try again.'
    }
    if (lower.includes('deployment batcher is not configured') || lower.includes('deploymentbatcher is not configured')) {
      return deploymentBatcherNotConfiguredMessage()
    }
    return msg
  }, [creatorStrategyFeaturesHref, isOvaultMeshPaidFeatureError, isVanityPaidFeatureError, switchAuthLabel])

  const ensureDeploySessionSignerInstalled = useCallback(async (sessionSigner: Address): Promise<void> => {
    let installed = await isCoinbaseSmartWalletOwner({ smartWallet: owner, ownerAddress: sessionSigner })
    if (installed) return

    const addOwnerData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
      functionName: 'addOwnerAddress',
      args: [sessionSigner],
    })
    const addOwnerCalls = [{ to: owner, value: 0n, data: addOwnerData }]
    const bundlerUrl = resolveCdpPaymasterUrl(import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined) || '/api/paymaster'

    // Try gas-sponsored ERC-4337 UserOp when a Privy signer is already an onchain owner
    let erc4337Succeeded = false
    if (publicClient) {
      // PATH A: Privy embedded EOA owner
      if (privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign && privyEmbeddedEoaAddress) {
        try {
          const embeddedProvider = await getPrivyEmbeddedEoaProvider()
          if (embeddedProvider?.request) {
            await ensureProviderOnBase({ provider: embeddedProvider, label: 'Privy embedded EOA' })
            const embeddedWalletClientAdapter = {
              request: async (args: { method: string; params?: any[] }) => {
                if (args?.method === 'eth_sign') {
                  const p = Array.isArray(args.params) ? args.params : []
                  const hashCandidate = typeof p[1] === 'string' ? p[1] : ''
                  const isHash = /^0x[0-9a-fA-F]{64}$/.test(hashCandidate)
                  if (isHash) {
                    try {
                      const rawSig = await embeddedProvider.request({
                        method: 'secp256k1_sign',
                        params: [hashCandidate],
                      })
                      return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
                    } catch (signErr) {
                      logger.warn('[DeployVault] Privy embedded secp256k1_sign failed; falling back to eth_sign', {
                        context: 'addOwner',
                        error: signErr instanceof Error ? signErr.message : String(signErr ?? ''),
                      })
                    }
                  }
                }
                return await embeddedProvider.request(args as any)
              },
              signMessage: async (args: { account: Address; message: any }) => {
                const raw =
                  typeof args?.message === 'object' && args.message !== null && 'raw' in args.message
                    ? (args.message as any).raw
                    : args?.message
                const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
                const rawSig = await embeddedProvider.request({
                  method: 'personal_sign',
                  params: [msgHex, privyEmbeddedEoaAddress],
                })
                return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
              },
              signTypedData: async (typedData: any) => {
                const rawSig = await embeddedProvider.request({
                  method: 'eth_signTypedData_v4',
                  params: [privyEmbeddedEoaAddress, JSON.stringify(typedData)],
                })
                return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
              },
            }
            const result = await sendCoinbaseSmartWalletUserOperation({
              publicClient: publicClient as any,
              walletClient: embeddedWalletClientAdapter as any,
              bundlerUrl,
              smartWallet: owner,
              ownerAddress: privyEmbeddedEoaAddress,
              calls: addOwnerCalls,
              version: '1',
              userOpSignMode: 'eth_sign',
              ownerIsContract: false,
              allowEoaSignMessageFallback: false,
              retryWithLowGasContractSigner: false,
            })
            setTxId(result.transactionHash)
            erc4337Succeeded = true
            logger.info('[DeployVault] addOwner via ERC-4337 (privy embedded EOA owner)', {
              sessionSigner,
              txHash: result.transactionHash,
            })
          }
        } catch (embeddedErr) {
          logger.warn('[DeployVault] Privy embedded EOA addOwner UserOp failed; trying smart wallet lane', {
            privyEmbeddedEoaAddress,
            error: embeddedErr instanceof Error ? embeddedErr.message : String(embeddedErr ?? ''),
          })
        }
      }

      // PATH B: Privy smart wallet owner
      if (!erc4337Succeeded && privySmartWalletIsCanonicalOwner && privySmartWalletCanSign && smartWalletClient && privySmartWalletAddress) {
        try {
          await ensureProviderOnBase({ provider: smartWalletClient, label: 'Privy smart wallet' })
          const smartWalletClientAdapter = {
            request: async (args: { method: string; params: any[] }) => {
              const client: any = smartWalletClient as any
              if (args.method === 'eth_sign' || args.method === 'personal_sign') {
                if (typeof client?.request !== 'function') {
                  throw new Error('Privy smart wallet client does not support request()')
                }
                const rawResult = await client.request(args)
                const sig = ensureSignatureHex(rawResult, `privySmartWallet.${args.method}`)
                logNonEoaSignature(sig, `privySmartWallet.${args.method}`)
                return sig
              }
              if (typeof client?.request === 'function') {
                return await client.request(args)
              }
              throw new Error('Privy smart wallet client does not support request()')
            },
            signMessage: async (args: { account: Address; message: any }) => {
              const msg =
                typeof args.message === 'object' && args.message !== null && 'raw' in args.message
                  ? args.message.raw
                  : args.message
              const client: any = smartWalletClient as any
              const account: any = client?.account
              const hasAccountSignMessage = typeof account?.signMessage === 'function'
              const hasClientSignMessage = typeof client?.signMessage === 'function'
              const hasSignMessage = hasAccountSignMessage || hasClientSignMessage

              if (hasSignMessage) {
                const rawMessage =
                  typeof msg === 'string' && /^0x[0-9a-fA-F]{64}$/.test(msg)
                    ? ({ raw: msg } as any)
                    : msg
                const rawResult = await withTimeout(
                  (async () => {
                    try {
                      return hasAccountSignMessage
                        ? await account.signMessage({ message: rawMessage })
                        : await client.signMessage({ account: privySmartWalletAddress, message: rawMessage })
                    } catch {
                      return hasAccountSignMessage
                        ? await account.signMessage({ message: msg })
                        : await client.signMessage({ account: privySmartWalletAddress, message: msg })
                    }
                  })(),
                  20_000,
                  'privySmartWallet.signMessage',
                )
                const sig = ensureSignatureHex(rawResult, 'privySmartWallet.signMessage')
                logNonEoaSignature(sig, 'privySmartWallet.signMessage')
                return sig
              }
              throw new Error(
                'Privy smart wallet signer not supported. Reconnect your canonical Base Account session or use Base App prolink.',
              )
            },
            signTypedData: async (args: any) => {
              const client: any = smartWalletClient as any
              const account: any = client?.account
              if (typeof account?.signTypedData === 'function' || typeof client?.signTypedData === 'function') {
                const rawResult = await withTimeout(
                  typeof account?.signTypedData === 'function'
                    ? account.signTypedData(args as any)
                    : client.signTypedData({ account: privySmartWalletAddress, ...(args as any) }),
                  20_000,
                  'privySmartWallet.signTypedData',
                )
                const sig = ensureSignatureHex(rawResult, 'privySmartWallet.signTypedData')
                logNonEoaSignature(sig, 'privySmartWallet.signTypedData')
                return sig
              }
              throw new Error(
                'Privy smart wallet signer not supported. Reconnect your canonical Base Account session or use Base App prolink.',
              )
            },
          }
          const result = await sendCoinbaseSmartWalletUserOperation({
            publicClient: publicClient as any,
            walletClient: smartWalletClientAdapter as any,
            bundlerUrl,
            smartWallet: owner,
            ownerAddress: privySmartWalletAddress,
            calls: addOwnerCalls,
            version: '1',
            userOpSignMode: 'auto',
            ownerIsContract: true,
            retryWithLowGasContractSigner: false,
          })
          setTxId(result.transactionHash)
          erc4337Succeeded = true
          logger.info('[DeployVault] addOwner via ERC-4337 (privy smart wallet owner)', {
            sessionSigner,
            txHash: result.transactionHash,
          })
        } catch (smartWalletErr) {
          logger.warn('[DeployVault] Privy smart wallet addOwner UserOp failed; no external-EOA fallback permitted', {
            privySmartWalletAddress,
            error: smartWalletErr instanceof Error ? smartWalletErr.message : String(smartWalletErr ?? ''),
          })
        }
      }
    }

    if (erc4337Succeeded) {
      installed = await isCoinbaseSmartWalletOwner({ smartWallet: owner, ownerAddress: sessionSigner })
      if (installed) return
    }

    throw new Error(
      'session_owner_not_installed: canonical Base Account owner approval is still required (external EOA fallback disabled).',
    )
  }, [
    getPrivyEmbeddedEoaProvider,
    owner,
    privyEmbeddedEoaAddress,
    privyEmbeddedEoaCanSign,
    privyEmbeddedEoaIsCanonicalOwner,
    privySmartWalletAddress,
    privySmartWalletCanSign,
    privySmartWalletIsCanonicalOwner,
    publicClient,
    setTxId,
    smartWalletClient,
  ])

  const pollServerDeploySession = useCallback(async (sessionId: string) => {
    const isHexHash = (value: unknown): value is Hex => typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
    const applyStatus = (statusData: DeploySessionStatusData) => {
      const step = String(statusData.step ?? '')
      const lastTxHash = typeof statusData.lastTxHash === 'string' ? statusData.lastTxHash : null
      const lastUserOpHash = typeof statusData.lastUserOpHash === 'string' ? statusData.lastUserOpHash : null
      const lastError = statusData.lastError ? String(statusData.lastError) : null
      setOvaultMeshStatus(readOvaultMeshStatus((statusData as { ovault?: unknown }).ovault))
      setLastSessionStep(step)
      if (step.startsWith('ovault_mesh')) setSeenOvaultMeshStep(true)
      if (lastPolledStepRef.current !== step) {
        lastPolledStepRef.current = step
        // Keep plain console logs visible even when debug logger is disabled.
        console.log('[DeployVault] session_step', {
          sessionId,
          step,
          lastTxHash,
          lastUserOpHash,
          lastError,
        })
      }
      const mappedStage = timelineStageFromDeployStep(step)
      if (mappedStage) {
        setPhase(legacyPhaseFromTimelineStage(mappedStage))
      }
      if (lastTxHash && isHexHash(lastTxHash)) {
        const stageForTx = timelineStageFromDeployStep(step)
        setPhaseTxs((s) => {
          const slot = stageForTx ? txSlotFromTimelineStage(stageForTx) : null
          if (!slot) return s
          return { ...s, [slot]: lastTxHash as Hex }
        })
      }
    }

    const completed = await pollSession({
      sessionId,
      postJson: postJsonWithTimeout,
      ensurePaymasterSession,
      ensureDeploySessionSignerInstalled,
      clearDeploySession,
      onStatus: applyStatus,
    })
    const completedTxHash = (completed.lastTxHash ?? null) as Hex | null
    if (completedTxHash) {
      setTxId(completedTxHash)
      setPhaseTxs((s) => (s.tx4 ? s : { ...s, tx4: completedTxHash }))
    }
    setPhase('done')
    if (expectedRef.current) {
      logger.info('[DeployVault] deploy_success (server-continued)', { creatorToken, owner, deploymentVersion, sessionId })
      onSuccess(expectedRef.current)
    }
  }, [
    clearDeploySession,
    creatorToken,
    deploymentVersion,
    ensureDeploySessionSignerInstalled,
    ensurePaymasterSession,
    onSuccess,
    owner,
    pollSession,
  ])

  useEffect(() => {
    if (!useServerContinue) return
    if (busy) return
    const sessionId = loadDeploySession()
    if (!sessionId) return

    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      setPhase('phase1')
      lastPolledStepRef.current = ''
      try {
        await pollServerDeploySession(sessionId)
      } catch (e) {
        if (!cancelled) setError(formatDeployError(e))
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    busy,
    ensureDeploySessionSignerInstalled,
    ensurePaymasterSession,
    formatDeployError,
    loadDeploySession,
    pollServerDeploySession,
    useServerContinue,
  ])

  const isTxHash = (h?: string | null) => typeof h === 'string' && /^0x[a-fA-F0-9]{64}$/.test(h)
  const hrefForTx = (h?: string | null) => (isTxHash(h) ? `https://basescan.org/tx/${h}` : null)
  const href1 = hrefForTx(phaseTxs.tx1 ?? null)
  const href2 = hrefForTx(phaseTxs.tx2 ?? null)
  const href3 = hrefForTx(phaseTxs.tx3 ?? null)
  const href4 = hrefForTx(phaseTxs.tx4 ?? null)

  const batcherAddress = useMemo(() => {
    const normalizedOverride = normalizeDeploymentBatcherAddress(batcherOverride)
    if (normalizedOverride) return normalizedOverride
    const configured = CONTRACTS.creatorVaultBatcher ?? null
    return normalizeDeploymentBatcherAddress(configured)
  }, [batcherOverride])

  const vaultVanityPrefix = useMemo(() => {
    const raw = (import.meta.env.VITE_VAULT_VANITY_PREFIX as string | undefined) ?? DEFAULT_VAULT_VANITY_PREFIX
    return normalizeHexSuffix(raw)
  }, [])

  const vaultVanityMaxTries = useMemo(() => {
    const raw = import.meta.env.VITE_VAULT_VANITY_MAX_TRIES as string | undefined
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VAULT_VANITY_MAX_TRIES
    return Math.floor(parsed)
  }, [])

  const marketFloorWeiPerTokenAligned = useMemo(() => {
    if (!floorPriceQ96Aligned || floorPriceQ96Aligned <= 0n) return null
    // ShareOFT (■token) uses 18 decimals, so convert Q96 → wei/token using 18.
    return q96ToCurrencyPerTokenBaseUnits(floorPriceQ96Aligned, 18)
  }, [floorPriceQ96Aligned])

  // ERC-4337 deploy requires the initial deposit to be owned by the smart wallet sender.
  const { data: smartWalletTokenBalance } = useReadContract({
    address: creatorToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner as `0x${string}`],
    query: { enabled: Boolean(creatorToken && owner) },
  })

  const codeIds = useMemo(() => {
    return {
      vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
      wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
      shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
      gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
      cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
      oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
      oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
    } as const
  }, [])

  const shareOftVanitySuffix = useMemo(() => {
    const raw = (import.meta.env.VITE_SHARE_OFT_VANITY_SUFFIX as string | undefined) ?? DEFAULT_SHARE_OFT_VANITY_SUFFIX
    return normalizeHexSuffix(raw)
  }, [])

  const shareOftVanityMaxTries = useMemo(() => {
    const raw = import.meta.env.VITE_SHARE_OFT_VANITY_MAX_TRIES as string | undefined
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SHARE_OFT_VANITY_MAX_TRIES
    return Math.floor(parsed)
  }, [])

  const vanityCustomMaxHex = useMemo(() => {
    const raw = import.meta.env.VITE_DEPLOY_VANITY_CUSTOM_MAX_HEX as string | undefined
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEPLOY_VANITY_CUSTOM_MAX_HEX
    return Math.max(1, Math.min(5, Math.floor(parsed)))
  }, [])
  const vaultVanityIsDefault = vaultVanityPrefix === DEFAULT_VAULT_VANITY_PREFIX
  const shareVanityIsDefault = shareOftVanitySuffix === DEFAULT_SHARE_OFT_VANITY_SUFFIX
  const vaultVanityIsCustom = Boolean(vaultVanityPrefix) && !vaultVanityIsDefault
  const shareVanityIsCustom = Boolean(shareOftVanitySuffix) && !shareVanityIsDefault

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const runtimeConfig = await fetchDeployRuntimeConfig().catch(() => null)
      if (cancelled || !runtimeConfig) {
        if (!cancelled) setRuntimeBatcherConfigError(null)
        return
      }
      setRuntimeBatcherConfigError(runtimeConfig.creatorVaultBatcherConfigError ?? null)
      const runtimeBatcher = normalizeDeploymentBatcherAddress(runtimeConfig?.creatorVaultBatcher ?? null)
      if (runtimeBatcher && (!batcherAddress || !sameAddress(runtimeBatcher, batcherAddress))) {
        setBatcherOverride(runtimeBatcher)
      }
      const hasDeploymentVersionOverride =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deploymentVersion')?.trim()
      const runtimeDeploymentVersion = runtimeConfig?.deploymentVersion?.trim() ?? ''
      const clientRuntimeDeploymentVersion = deploymentVersionProp
      if (
        !hasDeploymentVersionOverride &&
        !vaultVanityIsCustom &&
        runtimeDeploymentVersion &&
        runtimeDeploymentVersion !== clientRuntimeDeploymentVersion
      ) {
        setDeploymentVersionOverride(runtimeDeploymentVersion)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batcherAddress, deploymentVersionProp, vaultVanityIsCustom])

  useEffect(() => {
    const currentMessage = String(runtimeBatcherConfigError ?? '').trim()
    if (!currentMessage) {
      setRuntimeBatcherWarningDismissed(false)
      return
    }
    if (typeof window === 'undefined') {
      setRuntimeBatcherWarningDismissed(false)
      return
    }
    try {
      const dismissedMessage = window.sessionStorage.getItem(RUNTIME_BATCHER_WARNING_DISMISS_KEY) ?? ''
      setRuntimeBatcherWarningDismissed(dismissedMessage === currentMessage)
    } catch {
      setRuntimeBatcherWarningDismissed(false)
    }
  }, [runtimeBatcherConfigError])

  const dismissRuntimeBatcherWarning = useCallback(() => {
    const currentMessage = String(runtimeBatcherConfigError ?? '').trim()
    if (!currentMessage) return
    setRuntimeBatcherWarningDismissed(true)
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(RUNTIME_BATCHER_WARNING_DISMISS_KEY, currentMessage)
    } catch {
      // ignore storage failures
    }
  }, [runtimeBatcherConfigError])

  const payoutRouterCodeId = useMemo(() => {
    return keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex)
  }, [])

  const vaultShareBurnStreamCodeId = useMemo(() => {
    return keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex)
  }, [])

  const creatorCoinPolicyControllerCodeId = useMemo(() => {
    return keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex)
  }, [])

  const strategyCodeIds = useMemo(() => {
    return {
      // Phase 3 now deploys Charm alpha vault through Charm's factory (not via bytecode store).
      // Contract ABI still requires this field and only checks for non-zero.
      charmAlphaVaultDeploy: keccak256(toBytes('charm-factory-sentinel-v1')),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaVaultAuth: keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex),
      ajnaVault: keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex),
      erc4626StrategyAdapter: keccak256(DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex),
      solanaStrategy: keccak256(DEPLOY_BYTECODE.SolanaStrategy as Hex),
    } as const
  }, [])

  const expectedQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'expected',
      batcherAddress,
      creatorToken,
      owner,
      shareSymbol,
      shareName,
      vaultName,
      vaultSymbol,
      deploymentVersion,
      shareOftSaltOverride,
      shareOftVanitySuffix,
      shareOftVanityMaxTries,
      vaultVanityPrefix,
      vaultVanityMaxTries,
    ],
    enabled: !!publicClient && !!batcherAddress && !!creatorToken && !!owner && !!shareSymbol && !!shareName && !!vaultName && !!vaultSymbol,
    staleTime: 30_000,
    retry: 0,
    queryFn: async () => {
      let create2Deployer: Address | null = null
      try {
        create2Deployer = (await publicClient!.readContract({
          address: batcherAddress as Address,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'create2Deployer',
        })) as Address
      } catch {
        create2Deployer = null
      }
      if (!create2Deployer || !isAddress(String(create2Deployer))) {
        const fallback = (CONTRACTS.universalCreate2DeployerFromStore ?? null) as Address | null
        create2Deployer = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!create2Deployer) throw new Error('Create2 deployer not available')

      let protocolTreasury: Address | null = null
      try {
        protocolTreasury = (await publicClient!.readContract({
          address: batcherAddress as Address,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'protocolTreasury',
        })) as Address
      } catch {
        protocolTreasury = null
      }
      if (!protocolTreasury || !isAddress(String(protocolTreasury))) {
        const fallback = (CONTRACTS.protocolTreasury ?? null) as Address | null
        protocolTreasury = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!protocolTreasury) throw new Error('Protocol treasury not available')

      let registryAddress: Address | null = null
      try {
        registryAddress = (await publicClient!.readContract({
          address: batcherAddress as Address,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'registry',
        })) as Address
      } catch {
        registryAddress = null
      }
      if (!registryAddress || !isAddress(String(registryAddress))) {
        const fallback = (CONTRACTS.registry ?? null) as Address | null
        registryAddress = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!registryAddress) throw new Error('Registry not available')

      let chainlinkEthUsd: Address | null = null
      try {
        chainlinkEthUsd = (await publicClient!.readContract({
          address: batcherAddress as Address,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'chainlinkEthUsd',
        })) as Address
      } catch {
        chainlinkEthUsd = null
      }
      if (!chainlinkEthUsd || !isAddress(String(chainlinkEthUsd))) {
        const fallback = (CONTRACTS.chainlinkEthUsd ?? null) as Address | null
        chainlinkEthUsd = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!chainlinkEthUsd) throw new Error('Chainlink feed not available')

      const tempOwner = batcherAddress as Address
      const batcherBytecode =
        (await publicClient!
          .getBytecode({ address: batcherAddress as Address })
          .catch(() => null)) ?? null
      const batcherBytecodeLower = (batcherBytecode ?? '0x').toLowerCase()
      const batcherAddressLower = String(batcherAddress ?? '').toLowerCase()
      const saltOverridesDisabledByBatcher =
        KNOWN_SALT_OVERRIDE_DISABLED_BATCHERS.has(batcherAddressLower) ||
        batcherBytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR)
      const supportsLegacyPhase1WithSaltSelector = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return !saltOverridesDisabledByBatcher && batcherBytecodeLower.includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
      })()
      const supportsSplitPhase1WithSaltSelectors = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          !saltOverridesDisabledByBatcher &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
        )
      })()
      const supportsPhase1WithSalt = (() => {
        return supportsLegacyPhase1WithSaltSelector || supportsSplitPhase1WithSaltSelectors
      })()

      // IMPORTANT: The onchain deployment batcher uses *lowercase* symbols for salts + oracle wiring,
      // but uses *uppercase* symbols for ShareOFT metadata. We must mirror both to keep expected
      // addresses deterministic (especially for ShareOFT + gauge + oracle predictions).
      const shareSymbolLower = shareSymbol.toLowerCase()
      const shareSymbolUpper = shareSymbol.toUpperCase()

      const oftBootstrapSalt = deriveOftBootstrapSalt()
      const oftBootstrapRegistry = predictCreate2Address({
        create2Deployer,
        salt: oftBootstrapSalt,
        initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
      })

      const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
        shareName,
        shareSymbolUpper,
        oftBootstrapRegistry,
        tempOwner,
      ])
      const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
      const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
        creatorToken,
        tempOwner,
        vaultName,
        vaultSymbol,
      ])
      const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])

      let deploymentVersionUsed = deploymentVersion
      let vanityVersionSearchWarning: string | null = null
      // Apply deployment-version search for deterministic vanity when possible.
      // When Phase-1 salt overrides are unavailable, also attempt share-suffix matching
      // via version search (with share suffix taking priority over vault prefix fallback).
      const useVersionSearchForShareSuffix = Boolean(shareOftVanitySuffix) && !supportsPhase1WithSalt
      const versionSearchVaultPrefix = vaultVanityPrefix ?? null
      const versionSearchShareSuffix = useVersionSearchForShareSuffix ? shareOftVanitySuffix : null
      const usingDefaultVaultVanityTarget = versionSearchVaultPrefix === DEFAULT_VAULT_VANITY_PREFIX
      const usingDefaultShareVanityTarget =
        !versionSearchShareSuffix || versionSearchShareSuffix === DEFAULT_SHARE_OFT_VANITY_SUFFIX
      if (versionSearchVaultPrefix || versionSearchShareSuffix) {
        const vanityTargetsKey = [
          create2Deployer.toLowerCase(),
          creatorToken.toLowerCase(),
          owner.toLowerCase(),
          String(base.id),
          vaultName,
          vaultSymbol,
          shareName,
          shareSymbol,
          deploymentVersion,
          versionSearchVaultPrefix ?? '',
          versionSearchShareSuffix ?? '',
          String(vaultVanityMaxTries),
          String(shareOftVanityMaxTries),
          '0',
        ].join(':')
        const cached = vaultVanityVersionCacheRef.current
        if (cached?.key === vanityTargetsKey) {
          deploymentVersionUsed = cached.version
        } else {
          const versionSearchMaxTries =
            versionSearchVaultPrefix && versionSearchShareSuffix
              ? Math.min(10_000, vaultVanityMaxTries, shareOftVanityMaxTries)
              : versionSearchVaultPrefix
                ? vaultVanityMaxTries
                : shareOftVanityMaxTries
          let foundVersion = await findDeploymentVersionForVanityTargets({
            create2Deployer,
            creatorToken,
            owner,
            chainId: base.id,
            baseVersion: deploymentVersion,
            vaultPrefix: versionSearchVaultPrefix,
            shareSuffix: versionSearchShareSuffix,
            maxTries: versionSearchMaxTries,
            vaultInitCode,
            shareOftInitCode,
            shareSymbol,
            isAddressDeployed: async (addr) => {
              const bc = await publicClient!.getBytecode({ address: addr })
              return !!bc && bc !== '0x'
            },
          })
          // If both targets are requested and a combined hit wasn't found,
          // prioritize deterministic share suffix for deploy correctness/UX.
          if (!foundVersion && versionSearchVaultPrefix && versionSearchShareSuffix) {
            foundVersion = await findDeploymentVersionForVanityTargets({
              create2Deployer,
              creatorToken,
              owner,
              chainId: base.id,
              baseVersion: deploymentVersion,
              vaultPrefix: null,
              shareSuffix: versionSearchShareSuffix,
              maxTries: shareOftVanityMaxTries,
              vaultInitCode,
              shareOftInitCode,
              shareSymbol,
              isAddressDeployed: async (addr) => {
                const bc = await publicClient!.getBytecode({ address: addr })
                return !!bc && bc !== '0x'
              },
            })
            if (foundVersion) {
              vanityVersionSearchWarning =
                `Could not satisfy vault prefix 0x${versionSearchVaultPrefix} with share suffix ${versionSearchShareSuffix} in the same version search window. ` +
                `Prioritizing share suffix ${versionSearchShareSuffix} for this deploy.`
            }
          }
          if (!foundVersion) {
            if (versionSearchVaultPrefix && versionSearchShareSuffix) {
              if (!usingDefaultVaultVanityTarget || !usingDefaultShareVanityTarget) {
                throw new Error(
                  `Unable to find a deployment version matching vault prefix "0x${versionSearchVaultPrefix}" and share suffix "${versionSearchShareSuffix}" ` +
                    `in ${versionSearchMaxTries.toLocaleString()} tries (share-only fallback also failed after ${shareOftVanityMaxTries.toLocaleString()} tries).`,
                )
              }
              vanityVersionSearchWarning =
                `Default vanity targets (0x${versionSearchVaultPrefix} / ${versionSearchShareSuffix}) were not found in the current search window. ` +
                'Continuing with deterministic deployment addresses.'
            } else if (versionSearchShareSuffix) {
              if (!usingDefaultShareVanityTarget) {
                throw new Error(
                  `Unable to find ShareOFT vanity suffix "${versionSearchShareSuffix}" in ${shareOftVanityMaxTries.toLocaleString()} deployment-version tries.`,
                )
              }
              vanityVersionSearchWarning =
                `Default share suffix "${versionSearchShareSuffix}" was not found in the current search window. ` +
                'Continuing with deterministic deployment addresses.'
            } else if (versionSearchVaultPrefix) {
              if (!usingDefaultVaultVanityTarget) {
                throw new Error(
                  `Unable to find vault vanity prefix "0x${versionSearchVaultPrefix}" in ${vaultVanityMaxTries.toLocaleString()} deployment-version tries. ` +
                    'Increase VITE_VAULT_VANITY_MAX_TRIES and retry.',
                )
              }
              vanityVersionSearchWarning =
                `Default vault prefix "0x${versionSearchVaultPrefix}" was not found in the current search window. ` +
                'Continuing with deterministic deployment addresses.'
            }
          }
          if (foundVersion) {
            deploymentVersionUsed = foundVersion
            vaultVanityVersionCacheRef.current = { key: vanityTargetsKey, version: foundVersion }
          }
        }
      }

      const baseSalt = deriveBaseSalt({ creatorToken, owner, chainId: base.id, version: deploymentVersionUsed })
      const vaultSalt = saltFor(baseSalt, 'vault')
      const wrapperSalt = saltFor(baseSalt, 'wrapper')
      const gaugeSalt = saltFor(baseSalt, 'gauge')
      const ccaSalt = saltFor(baseSalt, 'cca')
      const oracleSalt = saltFor(baseSalt, 'oracle')

      const shareOftVanityUnsupportedByBatcher = !supportsPhase1WithSalt && Boolean(shareOftVanitySuffix)
      const batcherDisplay = batcherAddress ? shortAddress(batcherAddress) : 'unknown'
      let shareOftVanityWarning: string | null = null
      if (shareOftVanityUnsupportedByBatcher) {
        if (shareVanityIsCustom) {
          const blockingMessage =
            `Active batcher ${batcherDisplay} does not support Phase-1 salt overrides. ` +
            `Custom share token vanity suffix "${shareOftVanitySuffix}" is blocked for this deploy.`
          logger.warn('[DeployVault] share_oft_vanity_suffix_blocked', {
            batcher: batcherAddress,
            suffix: shareOftVanitySuffix,
            reason: 'phase1_salt_overrides_not_supported',
          })
          throw new Error(blockingMessage)
        }
        const skipLogKey = buildShareVanitySkipLogKey({
          batcher: batcherAddress,
          suffix: shareOftVanitySuffix,
          reason: 'phase1_salt_overrides_not_supported',
        })
        if (shouldEmitShareVanitySkipLog({ lastKey: shareOftVanitySkipLogKeyRef.current, nextKey: skipLogKey })) {
          shareOftVanitySkipLogKeyRef.current = skipLogKey
          logger.debug('[DeployVault] share_oft_vanity_suffix_skipped_default', {
            batcher: batcherAddress,
            suffix: shareOftVanitySuffix,
            reason: 'phase1_salt_overrides_not_supported',
          })
        }
        shareOftVanityWarning =
          `Active batcher ${batcherDisplay} does not support Phase-1 salt overrides, so default share suffix ` +
          `"${shareOftVanitySuffix}" is not guaranteed for this deploy.`
      }
      if (vanityVersionSearchWarning) {
        shareOftVanityWarning = shareOftVanityWarning
          ? `${shareOftVanityWarning} ${vanityVersionSearchWarning}`
          : vanityVersionSearchWarning
      }

      const derivedShareOftSalt = deriveShareOftSalt({ owner, shareSymbol, version: deploymentVersionUsed })
      let shareOftSaltOverrideUsed = shareOftSaltOverride
      if (shareOftSaltOverrideUsed && shareOftVanityUnsupportedByBatcher) {
        logger.warn('[DeployVault] share_oft_salt_override_ignored', {
          batcher: batcherAddress,
          reason: 'phase1_salt_overrides_not_supported',
          shareOftSaltOverride: shareOftSaltOverrideUsed,
        })
        shareOftSaltOverrideUsed = null
        const overrideWarning =
          `Ignoring ShareOFT salt override because active batcher ${batcherDisplay} does not support Phase-1 salt overrides.`
        shareOftVanityWarning = shareOftVanityWarning
          ? `${shareOftVanityWarning} ${overrideWarning}`
          : overrideWarning
      }
      if (!shareOftSaltOverrideUsed && shareOftVanitySuffix && !shareOftVanityUnsupportedByBatcher) {
        const initCodeHash = keccak256(shareOftInitCode)
        const vanitySeed = keccak256(
          encodePacked(['string', 'address', 'address', 'string'], [
            'CreatorShareOFT:vanity',
            creatorToken,
            owner,
            deploymentVersionUsed,
          ]),
        )
        const vanityStart = BigInt(vanitySeed)
        const vanityKey = [
          create2Deployer.toLowerCase(),
          initCodeHash.toLowerCase(),
          shareOftVanitySuffix,
          String(shareOftVanityMaxTries),
          deploymentVersionUsed,
          creatorToken.toLowerCase(),
          owner.toLowerCase(),
        ].join(':')
        const cached = shareOftVanityCacheRef.current
        if (cached?.key === vanityKey) {
          shareOftSaltOverrideUsed = cached.salt
        } else {
          const found = await findCreate2SaltForSuffix({
            create2Deployer,
            initCode: shareOftInitCode,
            suffix: shareOftVanitySuffix,
            maxTries: shareOftVanityMaxTries,
            startAt: vanityStart,
            isAddressDeployed: async (addr) => {
              const bc = await publicClient!.getBytecode({ address: addr })
              return !!bc && bc !== '0x'
            },
          })
          if (!found) {
            throw new Error(
              `Unable to find ShareOFT vanity suffix "${shareOftVanitySuffix}" in ${shareOftVanityMaxTries.toLocaleString()} tries. ` +
                'Increase VITE_SHARE_OFT_VANITY_MAX_TRIES and retry.',
            )
          }
          shareOftSaltOverrideUsed = found
          shareOftVanityCacheRef.current = { key: vanityKey, salt: found }
        }
      }
      const shareOftSalt = shareOftSaltOverrideUsed ?? derivedShareOftSalt
      const shareOftAddress = predictCreate2Address({ create2Deployer, salt: shareOftSalt, initCode: shareOftInitCode })
      const vaultAddress = predictCreate2Address({ create2Deployer, salt: vaultSalt, initCode: vaultInitCode })

      const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [creatorToken, vaultAddress, tempOwner])
      const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
      const wrapperAddress = predictCreate2Address({ create2Deployer, salt: wrapperSalt, initCode: wrapperInitCode })

      // Must mirror DeploymentBatcherPhase2Module.deployPhase2Core exactly:
      // gauge ctor args = (shareOFT, protocolTreasury, protocolTreasury, batcher).
      // Using `owner` here predicts the wrong CREATE2 address and causes
      // finalizePhase2 to revert with Phase2Missing().
      const gaugeArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
        shareOftAddress,
        protocolTreasury,
        protocolTreasury,
        tempOwner,
      ])
      const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeArgs])
      const gaugeAddress = predictCreate2Address({ create2Deployer, salt: gaugeSalt, initCode: gaugeInitCode })

      const ccaArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address'), [
        shareOftAddress,
        ZERO_ADDRESS,
        vaultAddress,
        vaultAddress,
        tempOwner,
      ])
      const ccaInitCode = concatHex([DEPLOY_BYTECODE.CCALaunchStrategy as Hex, ccaArgs])
      const ccaAddress = predictCreate2Address({ create2Deployer, salt: ccaSalt, initCode: ccaInitCode })

      const weth = getAddress((CONTRACTS.weth ?? BASE_WETH) as Address)
      const burnStreamSalt = deriveVaultShareBurnStreamSalt({ creatorToken, owner })
      const burnStreamArgs = encodeAbiParameters(parseAbiParameters('address'), [vaultAddress])
      const burnStreamInitCode = concatHex([DEPLOY_BYTECODE.VaultShareBurnStream as Hex, burnStreamArgs])

      const payoutRouterSalt = derivePayoutRouterSalt({ creatorToken, owner })
      const creatorCoinPolicyControllerSalt = deriveCreatorCoinPolicyControllerSalt({ creatorToken, owner })

      // IMPORTANT: burnStream + payoutRouter are deployed via UniversalCreate2DeployerFromStore in Phase 2.
      // The paymaster computes expected addresses using `bytecodeStore.get(codeId)` + CREATE2.
      // To avoid mismatches, compute these expected addresses the same way (fall back to local bytecode if needed).
      let burnStreamAddress = predictCreate2Address({ create2Deployer, salt: burnStreamSalt, initCode: burnStreamInitCode })
      let payoutRouterAddress = (() => {
        const args = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
          creatorToken,
          vaultAddress,
          burnStreamAddress,
          protocolTreasury,
          getAddress(BASE_SWAP_ROUTER as Address),
          weth,
        ])
        const init = concatHex([DEPLOY_BYTECODE.PayoutRouter as Hex, args])
        return predictCreate2Address({ create2Deployer, salt: payoutRouterSalt, initCode: init })
      })()
      let creatorCoinPolicyControllerAddress = (() => {
        const args = encodeAbiParameters(parseAbiParameters('address,address,address'), [
          creatorToken,
          payoutRouterAddress,
          protocolTreasury,
        ])
        const init = concatHex([DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex, args])
        return predictCreate2Address({ create2Deployer, salt: creatorCoinPolicyControllerSalt, initCode: init })
      })()

      try {
        const BYTECODE_STORE_GET_ABI = [
          {
            type: 'function',
            name: 'get',
            stateMutability: 'view',
            inputs: [{ name: 'codeId', type: 'bytes32' }],
            outputs: [{ name: 'creationCode', type: 'bytes' }],
          },
        ] as const

        let bytecodeStore: Address | null = null
        try {
          bytecodeStore = (await publicClient!.readContract({
            address: batcherAddress as Address,
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'bytecodeStore',
          })) as Address
        } catch {
          bytecodeStore = null
        }
        if (!bytecodeStore || !isAddress(String(bytecodeStore))) {
          const fallback = (CONTRACTS.universalBytecodeStore ?? null) as Address | null
          bytecodeStore = fallback && isAddress(String(fallback)) ? fallback : null
        }

        if (bytecodeStore) {
          const [burnCreation, routerCreation, policyControllerCreation] = (await Promise.all([
            publicClient!.readContract({
              address: bytecodeStore,
              abi: BYTECODE_STORE_GET_ABI,
              functionName: 'get',
              args: [vaultShareBurnStreamCodeId],
            }),
            publicClient!.readContract({
              address: bytecodeStore,
              abi: BYTECODE_STORE_GET_ABI,
              functionName: 'get',
              args: [payoutRouterCodeId],
            }),
            publicClient!.readContract({
              address: bytecodeStore,
              abi: BYTECODE_STORE_GET_ABI,
              functionName: 'get',
              args: [creatorCoinPolicyControllerCodeId],
            }),
          ])) as [Hex, Hex, Hex]

          const burnInitHash = keccak256(concatHex([burnCreation as Hex, burnStreamArgs]))
          burnStreamAddress = getCreate2Address({ from: create2Deployer, salt: burnStreamSalt, bytecodeHash: burnInitHash })

          const routerArgsFixed = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
            creatorToken,
            vaultAddress,
            burnStreamAddress,
            protocolTreasury,
            getAddress(BASE_SWAP_ROUTER as Address),
            weth,
          ])
          const routerInitHash = keccak256(concatHex([routerCreation as Hex, routerArgsFixed]))
          payoutRouterAddress = getCreate2Address({ from: create2Deployer, salt: payoutRouterSalt, bytecodeHash: routerInitHash })

          const policyControllerArgsFixed = encodeAbiParameters(parseAbiParameters('address,address,address'), [
            creatorToken,
            payoutRouterAddress,
            protocolTreasury,
          ])
          const policyControllerInitHash = keccak256(
            concatHex([policyControllerCreation as Hex, policyControllerArgsFixed]),
          )
          creatorCoinPolicyControllerAddress = getCreate2Address({
            from: create2Deployer,
            salt: creatorCoinPolicyControllerSalt,
            bytecodeHash: policyControllerInitHash,
          })
        }
      } catch {
        // Best-effort: fall back to local bytecode predictions
      }

      const oracleArgs = encodeAbiParameters(parseAbiParameters('address,address,string,address'), [
        registryAddress,
        chainlinkEthUsd,
        shareSymbolLower,
        tempOwner,
      ])
      const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, oracleArgs])
      const oracleAddress = predictCreate2Address({ create2Deployer, salt: oracleSalt, initCode: oracleInitCode })

      return {
        create2Deployer,
        protocolTreasury,
        deploymentVersion: deploymentVersionUsed,
        shareOftSaltOverride: shareOftSaltOverrideUsed ?? null,
        shareOftVanityWarning,
        expected: {
          vault: vaultAddress,
          wrapper: wrapperAddress,
          shareOFT: shareOftAddress,
          gaugeController: gaugeAddress,
          ccaStrategy: ccaAddress,
          oracle: oracleAddress,
          burnStream: burnStreamAddress,
          payoutRouter: payoutRouterAddress,
          creatorCoinPolicyController: creatorCoinPolicyControllerAddress,
        },
      }
    },
  })

  const expected = expectedQuery.data?.expected ?? null
  const expectedCreate2Deployer = expectedQuery.data?.create2Deployer ?? null
  const expectedProtocolTreasury = normalizeAddressLike(expectedQuery.data?.protocolTreasury ?? CONTRACTS.protocolTreasury)
  const expectedDeploymentVersion = expectedQuery.data?.deploymentVersion ?? deploymentVersion
  const expectedShareOftSaltOverride = expectedQuery.data?.shareOftSaltOverride ?? null
  const expectedShareOftVanityWarning = expectedQuery.data?.shareOftVanityWarning ?? null
  const expectedGauge = expected?.gaugeController ?? null
  const expectedBurnStream = expected?.burnStream ?? null
  const expectedPayoutRouter = expected?.payoutRouter ?? null
  const expectedCreatorCoinPolicyController = expected?.creatorCoinPolicyController ?? null

  useEffect(() => {
    if (expectedDeploymentVersion && expectedDeploymentVersion !== deploymentVersion) {
      setDeploymentVersionOverride(expectedDeploymentVersion)
    }
  }, [deploymentVersion, expectedDeploymentVersion])

  const phase3ExpectedQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'phase3Expected',
      batcherAddress,
      expectedCreate2Deployer,
      expectedProtocolTreasury,
      expected?.vault,
      creatorToken,
      owner,
      expectedDeploymentVersion,
      depositSymbol,
      phase,
    ],
    enabled:
      !!publicClient &&
      !!batcherAddress &&
      !!expected &&
      !!expectedCreate2Deployer &&
      !!expectedProtocolTreasury,
    staleTime: 15_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    queryFn: async () => {
      const expectedPhase = expected!
      const fallbackUsdc = normalizeAddressLike((CONTRACTS as any).usdc ?? BASE_USDC)
      const fallbackUniswapRouter = normalizeAddressLike((CONTRACTS as any).swapRouter ?? BASE_SWAP_ROUTER)
      const fallbackUniswapV3Factory = normalizeAddressLike((CONTRACTS as any).uniswapV3Factory ?? null)
      const fallbackAjnaFactory = normalizeAddressLike((CONTRACTS as any).ajnaErc20Factory ?? null)
      const fallbackSolanaBridge = normalizeAddressLike((CONTRACTS as any).solanaBridgeAdapter ?? null)

      const [phase3HelperRaw, usdcRaw, uniswapRouterRaw, uniswapV3FactoryRaw, ajnaFactoryRaw] = await Promise.all([
        publicClient!
          .readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE3_CONFIG_ABI,
            functionName: 'phase3Helper',
          })
          .catch(() => null),
        publicClient!
          .readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE3_CONFIG_ABI,
            functionName: 'usdc',
          })
          .catch(() => null),
        publicClient!
          .readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE3_CONFIG_ABI,
            functionName: 'uniswapRouter',
          })
          .catch(() => null),
        publicClient!
          .readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE3_CONFIG_ABI,
            functionName: 'uniswapV3Factory',
          })
          .catch(() => null),
        publicClient!
          .readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE3_CONFIG_ABI,
            functionName: 'ajnaFactory',
          })
          .catch(() => null),
      ])

      const phase3HelperAddress = normalizeAddressLike(phase3HelperRaw) ?? defaultPhase3HelperForBatcher(batcherAddress)
      const usdcAddress = normalizeAddressLike(usdcRaw) ?? fallbackUsdc
      const uniswapRouterAddress = normalizeAddressLike(uniswapRouterRaw) ?? fallbackUniswapRouter
      const uniswapV3FactoryAddress = normalizeAddressLike(uniswapV3FactoryRaw) ?? fallbackUniswapV3Factory
      const ajnaFactoryAddress = normalizeAddressLike(ajnaFactoryRaw) ?? fallbackAjnaFactory
      const solanaBridgeAddress = fallbackSolanaBridge

      let v3PoolAddress: Address | null = null
      if (uniswapV3FactoryAddress && usdcAddress) {
        try {
          const pool = (await publicClient!.readContract({
            address: uniswapV3FactoryAddress,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: 'getPool',
            args: [creatorToken, usdcAddress, 3_000],
          })) as Address
          const normalizedPool = normalizeAddressLike(pool)
          if (normalizedPool && !sameAddress(normalizedPool, ZERO_ADDRESS)) {
            v3PoolAddress = normalizedPool
          }
        } catch {
          v3PoolAddress = null
        }
      }

      let ajnaPoolAddress: Address | null = null
      if (ajnaFactoryAddress && usdcAddress) {
        try {
          const subsetHash = (await publicClient!.readContract({
            address: ajnaFactoryAddress,
            abi: AJNA_FACTORY_ABI,
            functionName: 'ERC20_NON_SUBSET_HASH',
          })) as Hex
          const deployedPool = (await publicClient!.readContract({
            address: ajnaFactoryAddress,
            abi: AJNA_FACTORY_ABI,
            functionName: 'deployedPools',
            args: [subsetHash, usdcAddress, creatorToken],
          })) as Address
          const normalizedPool = normalizeAddressLike(deployedPool)
          if (normalizedPool && !sameAddress(normalizedPool, ZERO_ADDRESS)) {
            ajnaPoolAddress = normalizedPool
          } else {
            try {
              const [minRate, maxRate] = (await Promise.all([
                publicClient!.readContract({
                  address: ajnaFactoryAddress,
                  abi: AJNA_FACTORY_ABI,
                  functionName: 'MIN_RATE',
                }),
                publicClient!.readContract({
                  address: ajnaFactoryAddress,
                  abi: AJNA_FACTORY_ABI,
                  functionName: 'MAX_RATE',
                }),
              ])) as [bigint, bigint]
              let interestRate = 50_000_000_000_000_000n
              if (interestRate < minRate) interestRate = minRate
              if (interestRate > maxRate) interestRate = maxRate
              const simulatedPool = (await publicClient!.simulateContract({
                address: ajnaFactoryAddress,
                abi: AJNA_FACTORY_ABI,
                functionName: 'deployPool',
                args: [usdcAddress, creatorToken, interestRate],
                account: owner,
              }).then((v) => v.result)) as Address
              const normalizedSimulatedPool = normalizeAddressLike(simulatedPool)
              if (normalizedSimulatedPool && !sameAddress(normalizedSimulatedPool, ZERO_ADDRESS)) {
                ajnaPoolAddress = normalizedSimulatedPool
              }
            } catch {
              ajnaPoolAddress = null
            }
          }
        } catch {
          ajnaPoolAddress = null
        }
      }

      let charmVaultAddress: Address | null = null
      if (v3PoolAddress && expectedProtocolTreasury) {
        const charmLabel = (depositSymbol || '').toLowerCase()
        const charmVaultName = charmLabel ? `4626: ${charmLabel}/USDC` : '4626: CREATOR/USDC'
        const charmVaultSymbol = charmLabel ? `CV-${charmLabel}-USDC` : 'CV-CREATOR-USDC'
        try {
          const simulatedCharmVault = (await publicClient!.simulateContract({
            address: CHARM_FACTORY,
            abi: CHARM_FACTORY_ABI,
            functionName: 'createVault',
            args: [
              {
                pool: v3PoolAddress,
                manager: expectedProtocolTreasury,
                managerFee: 160_000,
                rebalanceDelegate: expectedProtocolTreasury,
                maxTotalSupply: (1n << 256n) - 1n,
                baseThreshold: 3_000,
                limitThreshold: 6_000,
                fullRangeWeight: 0,
                period: 1_800,
                minTickMove: 10,
                maxTwapDeviation: 500,
                twapDuration: 300,
                name: charmVaultName,
                symbol: charmVaultSymbol,
              },
            ],
            account: owner,
          }).then((v) => v.result)) as Address
          const normalizedCharmVault = normalizeAddressLike(simulatedCharmVault)
          if (normalizedCharmVault && !sameAddress(normalizedCharmVault, ZERO_ADDRESS)) {
            charmVaultAddress = normalizedCharmVault
          }
        } catch {
          charmVaultAddress = null
        }
      }

      const baseSalt = deriveBaseSalt({ creatorToken, owner, chainId: base.id, version: expectedDeploymentVersion })
      const ajnaVaultAuthSalt = saltFor(baseSalt, 'ajnaVaultAuth')
      const ajnaVaultSalt = saltFor(baseSalt, 'ajnaVault')
      const ajnaStrategySalt = saltFor(baseSalt, 'ajnaStrategyAdapter')
      const solanaStrategySalt = saltFor(baseSalt, 'solanaStrategy')
      const charmStrategySalt = saltFor(baseSalt, 'charmStrategyV3')

      let creatorCharmStrategyAddress: Address | null = null
      let ajnaVaultAuthAddress: Address | null = null
      let ajnaVaultAddress: Address | null = null
      let erc4626StrategyAdapterAddress: Address | null = null
      let solanaStrategyAddress: Address | null = null

      if (phase3HelperAddress && expectedCreate2Deployer) {
        const ajnaAuthArgs = encodeAbiParameters(parseAbiParameters('address'), [phase3HelperAddress])
        const ajnaAuthInitCode = concatHex([DEPLOY_BYTECODE.AjnaVaultAuth as Hex, ajnaAuthArgs])
        ajnaVaultAuthAddress = predictCreate2Address({
          create2Deployer: expectedCreate2Deployer,
          salt: ajnaVaultAuthSalt,
          initCode: ajnaAuthInitCode,
        })

        if (ajnaPoolAddress && ajnaVaultAuthAddress) {
          const charmLabel = (depositSymbol || '').toLowerCase()
          const ajnaVaultName = charmLabel ? `Ajna 4626: ${charmLabel}/USDC` : 'Ajna 4626: CREATOR/USDC'
          const ajnaVaultSymbol = charmLabel ? `AJ-${charmLabel}-USDC` : 'AJ-CREATOR-USDC'
          const ajnaVaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string,address'), [
            ajnaPoolAddress,
            creatorToken,
            ajnaVaultName,
            ajnaVaultSymbol,
            ajnaVaultAuthAddress,
          ])
          const ajnaVaultInitCode = concatHex([DEPLOY_BYTECODE.AjnaERC4626Vault as Hex, ajnaVaultArgs])
          ajnaVaultAddress = predictCreate2Address({
            create2Deployer: expectedCreate2Deployer,
            salt: ajnaVaultSalt,
            initCode: ajnaVaultInitCode,
          })

          const ajnaStrategyArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
            expectedPhase.vault,
            ajnaVaultAddress,
            phase3HelperAddress,
          ])
          const ajnaStrategyInitCode = concatHex([DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex, ajnaStrategyArgs])
          erc4626StrategyAdapterAddress = predictCreate2Address({
            create2Deployer: expectedCreate2Deployer,
            salt: ajnaStrategySalt,
            initCode: ajnaStrategyInitCode,
          })
        }

        if (solanaBridgeAddress && expectedProtocolTreasury) {
          const solanaStrategyArgs = encodeAbiParameters(
            parseAbiParameters('address,address,address,address,uint64,uint16,uint16,address'),
            [
              expectedPhase.vault,
              creatorToken,
              phase3HelperAddress,
              expectedProtocolTreasury,
              DEFAULT_SOLANA_MAX_NAV_AGE,
              DEFAULT_SOLANA_MAX_NAV_DELTA_BPS,
              DEFAULT_SOLANA_MIN_BASE_LIQUIDITY_BPS,
              solanaBridgeAddress,
            ],
          )
          const solanaStrategyInitCode = concatHex([DEPLOY_BYTECODE.SolanaStrategy as Hex, solanaStrategyArgs])
          solanaStrategyAddress = predictCreate2Address({
            create2Deployer: expectedCreate2Deployer,
            salt: solanaStrategySalt,
            initCode: solanaStrategyInitCode,
          })
        }

        if (usdcAddress && uniswapRouterAddress && charmVaultAddress && v3PoolAddress) {
          const charmStrategyArgs = encodeAbiParameters(
            parseAbiParameters('address,address,address,address,address,address,address'),
            [
              expectedPhase.vault,
              creatorToken,
              usdcAddress,
              uniswapRouterAddress,
              charmVaultAddress,
              v3PoolAddress,
              phase3HelperAddress,
            ],
          )
          const charmStrategyInitCode = concatHex([DEPLOY_BYTECODE.CreatorCharmStrategy as Hex, charmStrategyArgs])
          creatorCharmStrategyAddress = predictCreate2Address({
            create2Deployer: expectedCreate2Deployer,
            salt: charmStrategySalt,
            initCode: charmStrategyInitCode,
          })
        }
      }

      return {
        v3Pool: v3PoolAddress,
        charmVault: charmVaultAddress,
        creatorCharmStrategy: creatorCharmStrategyAddress,
        ajnaPool: ajnaPoolAddress,
        ajnaVaultAuth: ajnaVaultAuthAddress,
        ajnaVault: ajnaVaultAddress,
        erc4626StrategyAdapter: erc4626StrategyAdapterAddress,
        solanaStrategy: solanaStrategyAddress,
      }
    },
  })

  const phase3Expected = phase3ExpectedQuery.data ?? null

  const phase3ExpectedAddressDeploymentQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'phase3ExpectedAddressDeployment',
      phase3Expected?.v3Pool,
      phase3Expected?.charmVault,
      phase3Expected?.creatorCharmStrategy,
      phase3Expected?.ajnaPool,
      phase3Expected?.ajnaVaultAuth,
      phase3Expected?.ajnaVault,
      phase3Expected?.erc4626StrategyAdapter,
      phase3Expected?.solanaStrategy,
      phase,
    ],
    enabled: !!publicClient && !!phase3Expected,
    staleTime: 5_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    refetchInterval: (query) => {
      if (!busy) return false
      const data = query.state.data as
        | {
            v3Pool: boolean | null
            charmVault: boolean | null
            creatorCharmStrategy: boolean | null
            ajnaPool: boolean | null
            ajnaVaultAuth: boolean | null
            ajnaVault: boolean | null
            erc4626StrategyAdapter: boolean | null
            solanaStrategy: boolean | null
          }
        | undefined
      if (!data) return 5_000
      const known = Object.values(data).filter((value): value is boolean => typeof value === 'boolean')
      if (known.length === 0) return false
      const allDeployed = known.every(Boolean)
      if (allDeployed) return false
      return busy ? 3_000 : 5_000
    },
    queryFn: async () => {
      const out: {
        v3Pool: boolean | null
        charmVault: boolean | null
        creatorCharmStrategy: boolean | null
        ajnaPool: boolean | null
        ajnaVaultAuth: boolean | null
        ajnaVault: boolean | null
        erc4626StrategyAdapter: boolean | null
        solanaStrategy: boolean | null
      } = {
        v3Pool: null,
        charmVault: null,
        creatorCharmStrategy: null,
        ajnaPool: null,
        ajnaVaultAuth: null,
        ajnaVault: null,
        erc4626StrategyAdapter: null,
        solanaStrategy: null,
      }

      const entries = Object.entries(phase3Expected ?? {}) as Array<[keyof typeof out, Address | null]>
      const known = entries.filter(([, address]) => !!address) as Array<[keyof typeof out, Address]>
      if (known.length === 0) return out

      const codes = await Promise.all(known.map(([, address]) => publicClient!.getBytecode({ address })))
      for (let i = 0; i < known.length; i += 1) {
        const [key] = known[i]!
        out[key] = Boolean(codes[i] && codes[i] !== '0x')
      }
      return out
    },
  })

  const phase3ExpectedAddressDeployment = phase3ExpectedAddressDeploymentQuery.data
  const phase3LikelyMissingHelperConfig = useMemo(() => {
    if (!phase3Expected) return false
    const hasPools = Boolean(phase3Expected.v3Pool || phase3Expected.ajnaPool || phase3Expected.charmVault)
    const missingHelperDependent =
      !phase3Expected.creatorCharmStrategy &&
      !phase3Expected.ajnaVaultAuth &&
      !phase3Expected.ajnaVault &&
      !phase3Expected.erc4626StrategyAdapter &&
      !phase3Expected.solanaStrategy
    return hasPools && missingHelperDependent
  }, [phase3Expected])

  const phase4AuctionAddressQuery = useQuery({
    queryKey: ['creatorVaultBatcher', 'phase4AuctionAddress', expected?.ccaStrategy, phase],
    enabled: !!publicClient && !!expected?.ccaStrategy,
    staleTime: 5_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    queryFn: async () => {
      const status = (await publicClient!.readContract({
        address: expected!.ccaStrategy,
        abi: CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI,
        functionName: 'getAuctionStatus',
      })) as readonly [Address, boolean, boolean, bigint, bigint]
      const auction = normalizeAddressLike(status?.[0] ?? null)
      if (!auction || sameAddress(auction, ZERO_ADDRESS)) return null
      return auction
    },
  })

  const phase4AuctionAddress = phase4AuctionAddressQuery.data ?? null
  const phase4AuctionDeploymentQuery = useQuery({
    queryKey: ['creatorVaultBatcher', 'phase4AuctionDeployment', phase4AuctionAddress, phase],
    enabled: !!publicClient && !!phase4AuctionAddress,
    staleTime: 5_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    refetchInterval: (query) => {
      const deployed = query.state.data as boolean | undefined
      if (deployed === true) return false
      return busy ? 3_000 : 5_000
    },
    queryFn: async () => {
      const code = await publicClient!.getBytecode({ address: phase4AuctionAddress as Address })
      return Boolean(code && code !== '0x')
    },
  })
  const phase4AuctionDeployment = phase4AuctionAddress ? (phase4AuctionDeploymentQuery.data ?? null) : null

  useEffect(() => {
    expectedRef.current = expected
  }, [expected])

  const phase1ExistsQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'phase1Exists',
      deploymentVersion,
      expected?.vault,
      expected?.wrapper,
      expected?.shareOFT,
    ],
    enabled: !!publicClient && !!expected,
    staleTime: 15_000,
    retry: 0,
    queryFn: async () => {
      const addrs = [expected!.vault, expected!.wrapper, expected!.shareOFT] as const
      const codes = await Promise.all(addrs.map((a) => publicClient!.getBytecode({ address: a })))
      const deployed = codes.map((c) => !!c && c !== '0x')
      return { anyDeployed: deployed.some(Boolean), allDeployed: deployed.every(Boolean) } as const
    },
  })

  const expectedAddressDeploymentQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'expectedAddressDeployment',
      expected?.vault,
      expected?.wrapper,
      expected?.shareOFT,
      expected?.gaugeController,
      expected?.ccaStrategy,
      expected?.oracle,
      expected?.burnStream,
      expected?.payoutRouter,
      expected?.creatorCoinPolicyController,
      phase,
    ],
    enabled: !!publicClient && !!expected,
    staleTime: 5_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    refetchInterval: (query) => {
      if (!busy) return false
      const data = query.state.data as
        | {
            vault: boolean
            wrapper: boolean
            shareOFT: boolean
            gaugeController: boolean
            ccaStrategy: boolean
            oracle: boolean
            burnStream: boolean
            payoutRouter: boolean
            creatorCoinPolicyController: boolean
          }
        | undefined
      if (!data) return 5_000
      const allDeployed = Object.values(data).every(Boolean)
      if (allDeployed) return false
      return busy ? 3_000 : 5_000
    },
    queryFn: async () => {
      const addresses = {
        vault: expected!.vault,
        wrapper: expected!.wrapper,
        shareOFT: expected!.shareOFT,
        gaugeController: expected!.gaugeController,
        ccaStrategy: expected!.ccaStrategy,
        oracle: expected!.oracle,
        burnStream: expected!.burnStream,
        payoutRouter: expected!.payoutRouter,
        creatorCoinPolicyController: expected!.creatorCoinPolicyController,
      } as const

      const entries = Object.entries(addresses) as Array<[keyof typeof addresses, Address]>
      const codes = await Promise.all(entries.map(([, address]) => publicClient!.getBytecode({ address })))
      return Object.fromEntries(
        entries.map(([key], index) => [key, Boolean(codes[index] && codes[index] !== '0x')]),
      ) as {
        vault: boolean
        wrapper: boolean
        shareOFT: boolean
        gaugeController: boolean
        ccaStrategy: boolean
        oracle: boolean
        burnStream: boolean
        payoutRouter: boolean
        creatorCoinPolicyController: boolean
      }
    },
  })

  const expectedAddressDeployment = expectedAddressDeploymentQuery.data

  const payoutMismatch =
    !!expectedPayoutRouter &&
    !!currentPayoutRecipient &&
    !sameAddress(expectedPayoutRouter, currentPayoutRecipient)

  const serializeSessionCalls = useCallback(
    (calls: Array<{ target: Address; value: bigint; data: Hex }>): DeploySessionCall[] =>
      calls.map((c) => ({ to: c.target, value: String(c.value ?? 0n), data: c.data })),
    [],
  )

  const submit = async (opts?: { planOnly?: boolean; validateDepositBalance?: boolean }): Promise<DeployPlanExport | null> => {
    const planOnly = opts?.planOnly === true
    const validateDepositBalance = !planOnly || opts?.validateDepositBalance === true
    if (busy || exportBusy) return null

    // Simple rate limit: avoid accidental double-submits after a quick reload/click.
    if (!planOnly && typeof window !== 'undefined') {
      try {
        const now = Date.now()
        const last = Number(localStorage.getItem('cv:deploy:lastAttemptAt') ?? '0')
        const retryWindowMs = 2000
        if (Number.isFinite(last) && last > 0 && now - last < retryWindowMs) {
          const remainingMs = retryWindowMs - (now - last)
          const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000))
          setError(`Please wait ${remainingSec}s before retrying deploy.`)
          window.setTimeout(() => setError(null), retryWindowMs)
          return null
        }
        localStorage.setItem('cv:deploy:lastAttemptAt', String(now))
      } catch {
        // ignore
      }
    }

    if (!planOnly) {
      setBusy(true)
      setError(null)
      setDryRunError(null)
      setExportStatus(null)
      setTxId(null)
      setLastSessionStep('')
      setSeenOvaultMeshStep(false)
      setOvaultMeshStatus(null)
      setPhase('idle')
      setPhaseTxs({})
      lastPolledStepRef.current = ''
    }

    try {
      const runtimeConfig = await fetchDeployRuntimeConfig().catch(() => null)
      await ensurePaymasterSession()
      if (!batcherAddress) {
        throw new Error(runtimeConfig?.creatorVaultBatcherConfigError || deploymentBatcherNotConfiguredMessage())
      }
      const runtimeBatcher = normalizeDeploymentBatcherAddress(runtimeConfig?.creatorVaultBatcher ?? null)
      if (runtimeBatcher && !sameAddress(runtimeBatcher, batcherAddress)) {
        const recovered = tryAutoRecoverStaleDeployConfig({
          reason: 'batcher',
          clientValue: batcherAddress,
          runtimeValue: runtimeBatcher,
        })
        setBatcherOverride(runtimeBatcher)
        setError(
          recovered
            ? 'Deploy runtime changed. Syncing to server batcher…'
            : `Deploy runtime changed. Synced batcher to ${shortAddress(runtimeBatcher)}. Click Run dry-run again.`,
        )
        return null
      }
      const hasDeploymentVersionOverride =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deploymentVersion')?.trim()
      const runtimeDeploymentVersion = runtimeConfig?.deploymentVersion?.trim() ?? ''
      const clientRuntimeDeploymentVersion = deploymentVersionProp
      if (
        !hasDeploymentVersionOverride &&
        !vaultVanityIsCustom &&
        runtimeDeploymentVersion &&
        runtimeDeploymentVersion !== clientRuntimeDeploymentVersion
      ) {
        const recovered = tryAutoRecoverStaleDeployConfig({
          reason: 'deploymentVersion',
          clientValue: clientRuntimeDeploymentVersion,
          runtimeValue: runtimeDeploymentVersion,
        })
        setDeploymentVersionOverride(runtimeDeploymentVersion)
        setError(
          recovered
            ? 'Deploy runtime changed. Syncing to server deployment version…'
            : `Deploy runtime changed. Synced deployment version to ${runtimeDeploymentVersion}. Click Run dry-run again.`,
        )
        return null
      }
      if (vaultVanityIsCustom && (vaultVanityPrefix ?? '').length > vanityCustomMaxHex) {
        throw new Error(`Custom vault vanity supports up to ${vanityCustomMaxHex} hex characters (0-9, a-f).`)
      }
      if (shareVanityIsCustom && (shareOftVanitySuffix ?? '').length > vanityCustomMaxHex) {
        throw new Error(`Custom share vanity supports up to ${vanityCustomMaxHex} hex characters (0-9, a-f).`)
      }
      const payoutRouterKeeperAddress = normalizeAddressLike(runtimeConfig?.payoutRouterKeeperAddress)
      const payoutRouterApprovedExternalSwapTargets = normalizeAddressArray(
        runtimeConfig?.payoutRouterApprovedExternalSwapTargets,
      )
      const payoutRouterApprovedExternalSwapSpenders = normalizeAddressArray(
        runtimeConfig?.payoutRouterApprovedExternalSwapSpenders,
      )
      const payoutRouterZoraToken =
        normalizeAddressLike(runtimeConfig?.zoraToken) ?? normalizeAddressLike(CONTRACTS.zora)
      const payoutRouterZoraWethFee =
        parseUniswapV3Fee(runtimeConfig?.payoutRouterZoraWethFee) ?? DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE
      const payoutRouterWethCreatorFee =
        parseUniswapV3Fee(runtimeConfig?.payoutRouterWethCreatorFee) ?? DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE
      if (!publicClient) throw new Error('Network client not ready')
      if (
        !expected ||
        !expectedGauge ||
        !expectedBurnStream ||
        !expectedPayoutRouter ||
        !expectedCreatorCoinPolicyController ||
        !expectedCreate2Deployer ||
        !expectedProtocolTreasury
      )
        throw new Error('Failed to compute expected deployment addresses')
      const deployVersion = expectedDeploymentVersion
      // Compatibility-only placeholder. CCA strategy now derives launch floor onchain from oracle data.
      const floorPriceQ96ForBatcher =
        floorPriceQ96Aligned && floorPriceQ96Aligned > 0n ? floorPriceQ96Aligned : 1n
      if (strictNoEoaEnforced) {
        const strictSignerReady =
          (privySmartWalletIsCanonicalOwner && privySmartWalletCanSign) ||
          (privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign)
        logger.info('[DeployVault] deploy_mode=no_eoa_strict', {
          deploy_mode: 'no_eoa_strict',
          useServerContinue,
          batcher: batcherAddress,
        })
        if (!canonicalSmartWallet || !strictSignerReady) {
          logger.warn('[DeployVault] eligibility_blocked', {
            deploy_mode: 'no_eoa_strict',
            canonicalSmartWallet,
            privyEmbeddedEoaIsCanonicalOwner,
            privyEmbeddedEoaCanSign,
            privySmartWalletIsCanonicalOwner,
            privySmartWalletCanSign,
          })
          throw new Error(NO_EOA_STRICT_BLOCKER)
        }
      }

      const depositAmount = minFirstDeposit
      const minimumTotalIdle = (depositAmount * DEFAULT_MIN_IDLE_PERCENT_BPS) / 10_000n
      const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
      // Safety: the deployment batcher tries to call `CreatorCoin.setPayoutRecipient(payoutRecipient)` when non-zero.
      // Zora Creator Coins restrict that setter to the coin owner, so the batcher-side internal call reverts (msg.sender=batcher).
      // We always pass `address(0)` to the batcher and, when needed, set CreatorCoin payoutRecipient from the identity wallet separately.
      const payoutForDeploy = ZERO_ADDRESS as Address

      const weth = getAddress((CONTRACTS.weth ?? BASE_WETH) as Address)
      const usdc = getAddress((CONTRACTS.usdc ?? BASE_USDC) as Address)
      const burnStreamSalt = deriveVaultShareBurnStreamSalt({ creatorToken, owner })
      const burnStreamConstructorArgs = encodeAbiParameters(parseAbiParameters('address'), [expected.vault])
      const burnStreamDeployCall = {
        target: expectedCreate2Deployer,
        value: 0n,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [burnStreamSalt, vaultShareBurnStreamCodeId, burnStreamConstructorArgs],
        }),
      } as const

      const burnStreamAlreadyDeployed = await (async () => {
        const bc = await publicClient.getBytecode({ address: expectedBurnStream })
        return !!bc && bc !== '0x'
      })()

      const payoutRouterSalt = derivePayoutRouterSalt({ creatorToken, owner })
      const payoutRouterConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
        creatorToken,
        expected.vault,
        expectedBurnStream,
        expectedProtocolTreasury,
        getAddress(BASE_SWAP_ROUTER as Address),
        weth,
      ])
      const payoutRouterDeployCall = {
        target: expectedCreate2Deployer,
        value: 0n,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [payoutRouterSalt, payoutRouterCodeId, payoutRouterConstructorArgs],
        }),
      } as const

      const payoutRouterAlreadyDeployed = await (async () => {
        const bc = await publicClient.getBytecode({ address: expectedPayoutRouter })
        return !!bc && bc !== '0x'
      })()

      const creatorCoinPolicyControllerSalt = deriveCreatorCoinPolicyControllerSalt({ creatorToken, owner })
      const creatorCoinPolicyControllerConstructorArgs = encodeAbiParameters(
        parseAbiParameters('address,address,address'),
        [creatorToken, expectedPayoutRouter, expectedProtocolTreasury],
      )
      const creatorCoinPolicyControllerDeployCall = {
        target: expectedCreate2Deployer,
        value: 0n,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [creatorCoinPolicyControllerSalt, creatorCoinPolicyControllerCodeId, creatorCoinPolicyControllerConstructorArgs],
        }),
      } as const

      const creatorCoinPolicyControllerAlreadyDeployed = await (async () => {
        const bc = await publicClient.getBytecode({ address: expectedCreatorCoinPolicyController })
        return !!bc && bc !== '0x'
      })()

      const senderCanAdminPayoutRouter = sameAddress(owner, expectedProtocolTreasury)
      const payoutRouterDesiredSwapPaths: Array<{ tokenIn: Address; path: Hex; label: 'WETH' | 'ZORA' }> = []
      if (senderCanAdminPayoutRouter) {
        const uniswapV3Factory = normalizeAddressLike(CONTRACTS.uniswapV3Factory)
        const hasV3Pool = async (tokenA: Address, tokenB: Address, fee: number): Promise<boolean> => {
          if (!uniswapV3Factory) return false
          if (sameAddress(tokenA, tokenB)) return false
          try {
            const pool = await publicClient.readContract({
              address: uniswapV3Factory,
              abi: UNISWAP_V3_FACTORY_ABI,
              functionName: 'getPool',
              args: [tokenA, tokenB, fee],
            })
            return typeof pool === 'string' && isAddress(pool) && !sameAddress(pool as Address, ZERO_ADDRESS)
          } catch {
            return false
          }
        }
        const candidateV3Fees = (preferredFee: number): number[] => {
          const common = [preferredFee, DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE, 500, 3_000, 10_000, 100]
          const out: number[] = []
          for (const fee of common) {
            if (!Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) continue
            if (!out.includes(fee)) out.push(fee)
          }
          return out
        }
        const resolveV3Fee = async (tokenA: Address, tokenB: Address, preferredFee: number): Promise<number | null> => {
          for (const fee of candidateV3Fees(preferredFee)) {
            if (await hasV3Pool(tokenA, tokenB, fee)) return fee
          }
          return null
        }
        const usdcCreatorFee = !sameAddress(usdc, creatorToken)
          ? await resolveV3Fee(usdc, creatorToken, DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE)
          : null

        if (!sameAddress(weth, creatorToken)) {
          const directWethCreatorFee = await resolveV3Fee(weth, creatorToken, payoutRouterWethCreatorFee)
          if (directWethCreatorFee !== null) {
            payoutRouterDesiredSwapPaths.push({
              tokenIn: weth,
              path: encodeUniswapV3Path([weth, creatorToken], [directWethCreatorFee]),
              label: 'WETH',
            })
          } else {
            const wethUsdcFee = await resolveV3Fee(weth, usdc, DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE)
            if (wethUsdcFee !== null && usdcCreatorFee !== null) {
              payoutRouterDesiredSwapPaths.push({
                tokenIn: weth,
                path: encodeUniswapV3Path(
                  [weth, usdc, creatorToken],
                  [wethUsdcFee, usdcCreatorFee],
                ),
                label: 'WETH',
              })
            } else {
              logger.warn('[DeployVault] No viable WETH->creator V3 route found; skipping WETH swap-path auto-config', {
                directWethCreatorFee,
                wethUsdcFee,
                usdcCreatorFee,
                creatorToken,
              })
            }
          }
        }
        if (payoutRouterZoraToken) {
          if (
            !sameAddress(payoutRouterZoraToken, creatorToken) &&
            !sameAddress(payoutRouterZoraToken, weth) &&
            !sameAddress(payoutRouterZoraToken, usdc)
          ) {
            const directZoraCreatorFee = await resolveV3Fee(
              payoutRouterZoraToken,
              creatorToken,
              DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE,
            )
            if (directZoraCreatorFee !== null) {
              payoutRouterDesiredSwapPaths.push({
                tokenIn: payoutRouterZoraToken,
                path: encodeUniswapV3Path(
                  [payoutRouterZoraToken, creatorToken],
                  [directZoraCreatorFee],
                ),
                label: 'ZORA',
              })
            } else {
              const zoraWethFee = await resolveV3Fee(payoutRouterZoraToken, weth, payoutRouterZoraWethFee)
              const wethCreatorFee = await resolveV3Fee(weth, creatorToken, payoutRouterWethCreatorFee)
              if (zoraWethFee !== null && wethCreatorFee !== null) {
                payoutRouterDesiredSwapPaths.push({
                  tokenIn: payoutRouterZoraToken,
                  path: encodeUniswapV3Path(
                    [payoutRouterZoraToken, weth, creatorToken],
                    [zoraWethFee, wethCreatorFee],
                  ),
                  label: 'ZORA',
                })
              } else {
                const zoraUsdcFee = await resolveV3Fee(
                  payoutRouterZoraToken,
                  usdc,
                  DEFAULT_PAYOUT_ROUTER_ROUTE_FALLBACK_FEE,
                )
                if (zoraUsdcFee !== null && usdcCreatorFee !== null) {
                  payoutRouterDesiredSwapPaths.push({
                    tokenIn: payoutRouterZoraToken,
                    path: encodeUniswapV3Path(
                      [payoutRouterZoraToken, usdc, creatorToken],
                      [zoraUsdcFee, usdcCreatorFee],
                    ),
                    label: 'ZORA',
                  })
                } else {
                  logger.warn('[DeployVault] No viable ZORA->creator V3 route found; skipping ZORA swap-path auto-config', {
                    directZoraCreatorFee,
                    zoraWethFee,
                    wethCreatorFee,
                    zoraUsdcFee,
                    usdcCreatorFee,
                    zoraToken: payoutRouterZoraToken,
                    creatorToken,
                  })
                }
              }
            }
          }
        } else {
          logger.warn('[DeployVault] Missing runtime ZORA token address; skipping payout router ZORA swap-path auto-config')
        }
        if (payoutRouterZoraToken) {
          const isCreatorToken = sameAddress(payoutRouterZoraToken, creatorToken)
          const isWethToken = sameAddress(payoutRouterZoraToken, weth)
          const isUsdcToken = sameAddress(payoutRouterZoraToken, usdc)
          if (isCreatorToken || isWethToken || isUsdcToken) {
            logger.warn('[DeployVault] Runtime ZORA token overlaps with creator/WETH/USDC; skipping ZORA swap-path auto-config', {
              zoraToken: payoutRouterZoraToken,
              creatorToken,
              weth,
              usdc,
            })
          }
        }
      }

      const currentPayoutRouterKeeper = await (async () => {
        if (!payoutRouterAlreadyDeployed) return ZERO_ADDRESS as Address
        try {
          const keeper = await publicClient.readContract({
            address: expectedPayoutRouter,
            abi: PAYOUT_ROUTER_ADMIN_ABI,
            functionName: 'keeper',
          })
          if (typeof keeper === 'string' && isAddress(keeper)) return getAddress(keeper as Address)
          return ZERO_ADDRESS as Address
        } catch {
          return ZERO_ADDRESS as Address
        }
      })()

      const currentRouterPaths = await (async () => {
        const out = new Map<string, Hex>()
        if (!payoutRouterAlreadyDeployed || payoutRouterDesiredSwapPaths.length === 0) return out
        const reads = await Promise.all(
          payoutRouterDesiredSwapPaths.map(async ({ tokenIn }) => {
            try {
              const raw = await publicClient.readContract({
                address: expectedPayoutRouter,
                abi: PAYOUT_ROUTER_ADMIN_ABI,
                functionName: 'swapPathToCreator',
                args: [tokenIn],
              })
              const normalized = typeof raw === 'string' && raw.startsWith('0x') ? (raw as Hex) : ('0x' as Hex)
              return [tokenIn.toLowerCase(), normalized] as const
            } catch {
              return [tokenIn.toLowerCase(), '0x' as Hex] as const
            }
          }),
        )
        for (const [token, path] of reads) out.set(token, path)
        return out
      })()

      const currentRouterExternalTargetApprovals = await (async () => {
        const out = new Map<string, boolean>()
        if (!payoutRouterAlreadyDeployed || payoutRouterApprovedExternalSwapTargets.length === 0) return out
        const reads = await Promise.all(
          payoutRouterApprovedExternalSwapTargets.map(async (target) => {
            try {
              const raw = await publicClient.readContract({
                address: expectedPayoutRouter,
                abi: PAYOUT_ROUTER_ADMIN_ABI,
                functionName: 'approvedExternalSwapTargets',
                args: [target],
              })
              return [target.toLowerCase(), raw === true] as const
            } catch {
              return [target.toLowerCase(), false] as const
            }
          }),
        )
        for (const [target, approved] of reads) out.set(target, approved)
        return out
      })()

      const currentRouterExternalSpenderApprovals = await (async () => {
        const out = new Map<string, boolean>()
        if (!payoutRouterAlreadyDeployed || payoutRouterApprovedExternalSwapSpenders.length === 0) return out
        const reads = await Promise.all(
          payoutRouterApprovedExternalSwapSpenders.map(async (spender) => {
            try {
              const raw = await publicClient.readContract({
                address: expectedPayoutRouter,
                abi: PAYOUT_ROUTER_ADMIN_ABI,
                functionName: 'approvedExternalSwapSpenders',
                args: [spender],
              })
              return [spender.toLowerCase(), raw === true] as const
            } catch {
              return [spender.toLowerCase(), false] as const
            }
          }),
        )
        for (const [spender, approved] of reads) out.set(spender, approved)
        return out
      })()

      const payoutRouterSetKeeperCall =
        senderCanAdminPayoutRouter &&
        payoutRouterKeeperAddress &&
        !sameAddress(currentPayoutRouterKeeper, payoutRouterKeeperAddress)
          ? ({
              target: expectedPayoutRouter,
              value: 0n,
              data: encodeFunctionData({
                abi: PAYOUT_ROUTER_ADMIN_ABI,
                functionName: 'setKeeper',
                args: [payoutRouterKeeperAddress],
              }),
            } as const)
          : null

      const payoutRouterSetExternalSwapTargetApprovalCalls: Array<{ target: Address; value: bigint; data: Hex }> =
        senderCanAdminPayoutRouter
          ? payoutRouterApprovedExternalSwapTargets
              .filter((target) => currentRouterExternalTargetApprovals.get(target.toLowerCase()) !== true)
              .map((target) => ({
                target: expectedPayoutRouter,
                value: 0n,
                data: encodeFunctionData({
                  abi: PAYOUT_ROUTER_ADMIN_ABI,
                  functionName: 'setExternalSwapTargetApproval',
                  args: [target, true],
                }),
              }))
          : []

      const payoutRouterSetExternalSwapSpenderApprovalCalls: Array<{ target: Address; value: bigint; data: Hex }> =
        senderCanAdminPayoutRouter
          ? payoutRouterApprovedExternalSwapSpenders
              .filter((spender) => currentRouterExternalSpenderApprovals.get(spender.toLowerCase()) !== true)
              .map((spender) => ({
                target: expectedPayoutRouter,
                value: 0n,
                data: encodeFunctionData({
                  abi: PAYOUT_ROUTER_ADMIN_ABI,
                  functionName: 'setExternalSwapSpenderApproval',
                  args: [spender, true],
                }),
              }))
          : []

      const payoutRouterSetSwapPathCalls: Array<{ target: Address; value: bigint; data: Hex }> = senderCanAdminPayoutRouter
        ? payoutRouterDesiredSwapPaths
            .filter(({ tokenIn, path }) => {
              const current = currentRouterPaths.get(tokenIn.toLowerCase()) ?? ('0x' as Hex)
              return String(current).toLowerCase() !== String(path).toLowerCase()
            })
            .map(({ tokenIn, path }) => ({
              target: expectedPayoutRouter,
              value: 0n,
              data: encodeFunctionData({
                abi: PAYOUT_ROUTER_ADMIN_ABI,
                functionName: 'setSwapPath',
                args: [tokenIn, path],
              }),
            }))
        : []

      if (!payoutRouterKeeperAddress) {
        logger.warn('[DeployVault] Missing payoutRouter keeper runtime config; skipping setKeeper auto-config')
      }
      if (
        !senderCanAdminPayoutRouter &&
        (payoutRouterKeeperAddress ||
          payoutRouterDesiredSwapPaths.length > 0 ||
          payoutRouterApprovedExternalSwapTargets.length > 0 ||
          payoutRouterApprovedExternalSwapSpenders.length > 0)
      ) {
        logger.debug(
          '[DeployVault] PayoutRouter owner is protocol treasury; creator-side setKeeper/setSwapPath/setExternalSwap* auto-config intentionally skipped',
        )
      }

      const vaultSetBurnStreamCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setBurnStream',
          args: [expectedBurnStream],
        }),
      } as const

      const currentVaultBurnStream = await (async () => {
        try {
          const value = await publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: 'burnStream',
          })
          if (typeof value === 'string' && isAddress(value)) return getAddress(value as Address)
          return ZERO_ADDRESS as Address
        } catch {
          return ZERO_ADDRESS as Address
        }
      })()
      const burnStreamAlreadyConfigured = currentVaultBurnStream.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
      const burnStreamMatchesExpected = currentVaultBurnStream.toLowerCase() === expectedBurnStream.toLowerCase()
      if (burnStreamAlreadyConfigured && !burnStreamMatchesExpected) {
        throw new Error(
          `Vault burn stream is already set to ${currentVaultBurnStream} (expected ${expectedBurnStream}). ` +
            `Bump VITE_DEPLOYMENT_VERSION to deploy a fresh set, or reconcile the existing deployment state.`,
        )
      }

      const vaultWhitelistRouterCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setWhitelist',
          args: [expectedPayoutRouter, true],
        }),
      } as const

      const vaultSetMinimumIdleCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setMinimumTotalIdle',
          args: [minimumTotalIdle],
        }),
      } as const

      const vaultDeployToStrategiesCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'deployToStrategies',
          args: [],
        }),
      } as const

      const payoutRecipientCallData = encodeFunctionData({
        abi: COIN_PAYOUT_RECIPIENT_ABI,
        functionName: 'setPayoutRecipient',
        args: [expectedPayoutRouter],
      })
      const coinTransferOwnershipCallData = encodeFunctionData({
        abi: COIN_OWNERSHIP_ABI,
        functionName: 'transferOwnership',
        args: [expectedCreatorCoinPolicyController],
      })
      const currentCoinOwner = await (async () => {
        try {
          const value = await publicClient.readContract({
            address: creatorToken,
            abi: COIN_OWNERSHIP_ABI,
            functionName: 'owner',
          })
          if (typeof value === 'string' && isAddress(value)) return getAddress(value as Address)
          return null
        } catch {
          return null
        }
      })()
      if (!currentCoinOwner) {
        const unresolvedLogKey = `${creatorToken.toLowerCase()}:${batcherAddress.toLowerCase()}`
        if (creatorCoinOwnerUnresolvedLogKeyRef.current !== unresolvedLogKey) {
          creatorCoinOwnerUnresolvedLogKeyRef.current = unresolvedLogKey
          logger.debug('[DeployVault] creator_coin_owner_unresolved', {
            creatorToken,
            batcher: batcherAddress,
          })
        }
      }
      const coinOwnershipNeedsTransfer = currentCoinOwner
        ? !sameAddress(currentCoinOwner, expectedCreatorCoinPolicyController)
        : false
      const canSetPayoutRecipientFromOwner = await (async () => {
        if (!payoutMismatch) return false
        try {
          await publicClient.call({
            to: creatorToken,
            data: payoutRecipientCallData,
            account: owner,
          })
          return true
        } catch {
          return false
        }
      })()
      const canTransferCoinOwnershipFromOwner = await (async () => {
        if (!coinOwnershipNeedsTransfer) return false
        if (currentCoinOwner && !sameAddress(currentCoinOwner, owner)) return false
        try {
          await publicClient.call({
            to: creatorToken,
            data: coinTransferOwnershipCallData,
            account: owner,
          })
          return true
        } catch {
          return false
        }
      })()

      // ===========================
      // Two-step batcher (Phase 1 + Phase 2) path
      // ===========================
      // Base mainnet can no longer fit the full stack deploy (vault + wrapper + shareOFT + gauge + CCA + oracle + deposit + launch)
      // in a single transaction due to code-deposit gas limits. If the configured batcher supports the two-step ABI,
      // prefer it and bypass the legacy one-tx deploy flow below.
      const batcherBytecode = await publicClient.getBytecode({ address: batcherAddress })
      const isTwoStepBatcher = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        const phase1Topic = keccak256(
          toBytes('Phase1Deployed(address,address,address,address,address,address)'),
        ).slice(2).toLowerCase()
        return batcherBytecode.toLowerCase().includes(phase1Topic)
      })()
      const batcherBytecodeLower = (batcherBytecode ?? '0x').toLowerCase()
      const supportsVaultModuleGetters = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          batcherBytecodeLower.includes(BATCHER_VAULT_CORE_MODULE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_VAULT_STRATEGIES_MODULE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_VAULT_ADMIN_MODULE_SELECTOR)
        )
      })()
      const supportsPhase2Permit2 = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return batcherBytecodeLower.includes(BATCHER_PHASE2_FINALIZE_WITH_PERMIT2_SELECTOR)
      })()
      if (isTwoStepBatcher && !supportsVaultModuleGetters) {
        logger.warn('[DeployVault] legacy_batcher_blocked', {
          deploy_mode: strictNoEoaEnforced ? 'no_eoa_strict' : 'default',
          batcher: batcherAddress,
          reason: 'missing_vault_module_getters',
          selectors: {
            coreModule: batcherBytecodeLower.includes(BATCHER_VAULT_CORE_MODULE_SELECTOR),
            strategiesModule: batcherBytecodeLower.includes(BATCHER_VAULT_STRATEGIES_MODULE_SELECTOR),
            adminModule: batcherBytecodeLower.includes(BATCHER_VAULT_ADMIN_MODULE_SELECTOR),
          },
        })
        throw new Error(
          `Legacy deployment batcher active on this deployment (${batcherAddress}). ` +
            'This version cannot initialize CreatorOVault modules and will stall at Phase 1 finalize. ' +
            'Update `VITE_CREATOR_VAULT_BATCHER` (and server `CREATOR_VAULT_BATCHER`) to the current batcher.',
        )
      }
      const supportsSplitPhase1NoSalt = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_SELECTOR)
        )
      })()
      const supportsSplitPhase1WithSaltSelectors = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
        )
      })()
      let supportsSplitPhase1 = supportsSplitPhase1NoSalt || supportsSplitPhase1WithSaltSelectors
      const supportsLegacyPhase1 = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return batcherBytecodeLower.includes(BATCHER_PHASE1_SELECTOR)
      })()
      if (!supportsSplitPhase1) {
        try {
          await publicClient.readContract({
            address: batcherAddress as Address,
            abi: BATCHER_PHASE1_SPLIT_STATE_VIEW_ABI,
            functionName: 'phase1SplitStates',
            args: [ZERO_BYTES32 as Hex],
          })
          supportsSplitPhase1 = true
        } catch {
          // no-op: keep selector-derived capability
        }
      }
      if (!supportsSplitPhase1 && !supportsLegacyPhase1) {
        throw new Error(
          `Configured batcher at ${batcherAddress} exposes neither split Phase-1 nor legacy deployPhase1 entrypoints. ` +
            'Update VITE_CREATOR_VAULT_BATCHER / CREATOR_VAULT_BATCHER.',
        )
      }
      const batcherAddressLower = String(batcherAddress ?? '').toLowerCase()
      const splitPhase1SaltOverrideDisabled = (
        KNOWN_SALT_OVERRIDE_DISABLED_BATCHERS.has(batcherAddressLower) ||
        batcherBytecodeLower.includes(BATCHER_SALT_OVERRIDE_DISABLED_ERROR_SELECTOR)
      )
      const supportsLegacyPhase1WithSalt = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        if (splitPhase1SaltOverrideDisabled) {
          return false
        }
        if (!expectedShareOftSaltOverride) return true
        return (
          batcherBytecodeLower.includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
        )
      })()
      const supportsSplitPhase1WithSalt = supportsSplitPhase1WithSaltSelectors
      if (strictNoEoaEnforced) {
        const requiresShareSaltOverride = Boolean(expectedShareOftSaltOverride)
        const saltOverrideRequiredButUnavailable =
          requiresShareSaltOverride && (!supportsSplitPhase1WithSalt || splitPhase1SaltOverrideDisabled) && shareVanityIsCustom
        if (!supportsSplitPhase1 || saltOverrideRequiredButUnavailable) {
          logger.warn('[DeployVault] legacy_batcher_blocked', {
            deploy_mode: 'no_eoa_strict',
            batcher: batcherAddress,
            requiresShareSaltOverride,
            supportsSplitPhase1,
            supportsSplitPhase1WithSalt,
            saltOverrideRequiredButUnavailable,
            selectors: {
              core: batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_SELECTOR),
              coreWithSalt: batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR),
              finalize: batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_SELECTOR),
              finalizeWithSalt: batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR),
            },
          })
          throw new Error(
            `Legacy batcher active on this deployment (${batcherAddress}). Update to split Phase-1 deployment batcher.`,
          )
        }
      }
      let phase1CallsPrepared: Array<{ target: Address; value: bigint; data: Hex }> = []

      if (isTwoStepBatcher) {
        const phase1State = await (async () => {
          try {
            const addrs = [expected!.vault, expected!.wrapper, expected!.shareOFT] as const
            const codes = await Promise.all(addrs.map((a) => publicClient!.getBytecode({ address: a })))
            const deployed = codes.map((c) => !!c && c !== '0x')
            return {
              vaultDeployed: deployed[0] ?? false,
              wrapperDeployed: deployed[1] ?? false,
              shareOftDeployed: deployed[2] ?? false,
            } as const
          } catch {
            const anyDeployed = phase1ExistsQuery.data?.anyDeployed ?? false
            const allDeployed = phase1ExistsQuery.data?.allDeployed ?? false
            return {
              vaultDeployed: anyDeployed && allDeployed,
              wrapperDeployed: anyDeployed && allDeployed,
              shareOftDeployed: allDeployed,
            } as const
          }
        })()
        const { vaultDeployed, wrapperDeployed, shareOftDeployed } = phase1State
        const phase1Any = vaultDeployed || wrapperDeployed || shareOftDeployed
        const phase1All = vaultDeployed && wrapperDeployed && shareOftDeployed

        const phase1Params = {
          creatorToken,
          owner,
          vaultName,
          vaultSymbol,
          shareName,
          shareSymbol,
          version: deployVersion,
        } as const
        const asBatcherCall = (data: Hex) =>
          ({
            target: batcherAddress,
            value: 0n,
            data,
          }) as const

        if (!supportsSplitPhase1) {
          if (expectedShareOftSaltOverride && !supportsLegacyPhase1WithSalt) {
            if (shareVanityIsCustom) {
              logger.warn('[DeployVault] Batcher lacks legacy phase1 vanity salt support; continuing without override', {
                batcher: batcherAddress,
              })
            }
          }
          if (phase1Any && !phase1All) {
            throw new Error(
              `Phase 1 is partially deployed for this creator + deployment version (${deployVersion}). ` +
                'Bump VITE_DEPLOYMENT_VERSION to start a fresh slate, or contact support to reconcile the partial deploy.',
            )
          }
          const phase1CallData = expectedShareOftSaltOverride && supportsLegacyPhase1WithSalt
            ? encodeFunctionData({
                abi: CREATOR_VAULT_BATCHER_ABI,
                functionName: 'deployPhase1WithSalt',
                args: [phase1Params, codeIds, expectedShareOftSaltOverride],
              })
            : encodeFunctionData({
                abi: CREATOR_VAULT_BATCHER_ABI,
                functionName: 'deployPhase1',
                args: [phase1Params, codeIds],
              })
          phase1CallsPrepared = phase1All ? [] : [asBatcherCall(phase1CallData)]
        } else {
          if (shareOftDeployed && (!vaultDeployed || !wrapperDeployed)) {
            throw new Error(
              `Phase 1 split state is invalid for deployment version (${deployVersion}). ` +
                'ShareOFT is deployed while vault/wrapper are missing. Bump VITE_DEPLOYMENT_VERSION or contact support.',
            )
          }
          if (vaultDeployed !== wrapperDeployed) {
            throw new Error(
              `Phase 1 split state is invalid for deployment version (${deployVersion}). ` +
                'Vault/wrapper deployment is inconsistent. Bump VITE_DEPLOYMENT_VERSION or contact support.',
            )
          }
          const coreDone = vaultDeployed && wrapperDeployed
          let saltEnabled = supportsSplitPhase1WithSalt
          let shareOftSaltOverride: Hex = (expectedShareOftSaltOverride ?? ZERO_BYTES32) as Hex
          if (splitPhase1SaltOverrideDisabled && shareOftSaltOverride !== ZERO_BYTES32) {
            logger.warn('[DeployVault] Batcher runtime disabled phase1 salt overrides; forcing zero override for split phase1 calls', {
              batcher: batcherAddress,
            })
            shareOftSaltOverride = ZERO_BYTES32 as Hex
          }
          if (saltEnabled && shareOftSaltOverride !== ZERO_BYTES32) {
            try {
              const phase1SaltProbeParams = {
                creatorToken,
                owner,
                vaultName,
                vaultSymbol,
                shareName,
                shareSymbol,
                version: deployVersion,
              } as const
              await publicClient.call({
                account: owner,
                to: batcherAddress,
                data: encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'deployPhase1CoreWithSalt',
                  args: [phase1SaltProbeParams, codeIds, shareOftSaltOverride],
                }),
              })
            } catch (probeError: unknown) {
              if (hasSaltOverrideDisabledError(probeError)) {
                shareOftSaltOverride = ZERO_BYTES32 as Hex
                if (supportsSplitPhase1NoSalt) {
                  saltEnabled = false
                  logger.warn('[DeployVault] Batcher runtime disabled phase1 salt overrides; falling back to no-salt phase1 calls', {
                    batcher: batcherAddress,
                  })
                } else {
                  logger.warn('[DeployVault] Batcher runtime disabled phase1 salt overrides; using split with-salt entrypoints and zero override', {
                    batcher: batcherAddress,
                  })
                }
              }
            }
          }
          if (expectedShareOftSaltOverride && (!saltEnabled || splitPhase1SaltOverrideDisabled)) {
            if (shareVanityIsCustom) {
              logger.warn('[DeployVault] Batcher lacks split phase1 vanity salt support; continuing without override', {
                batcher: batcherAddress,
              })
            }
          }
          const useSplitWithSaltSelectors = saltEnabled || !supportsSplitPhase1NoSalt
          if (!useSplitWithSaltSelectors && !supportsSplitPhase1NoSalt) {
            throw new Error(
              `Batcher ${batcherAddress} does not expose split Phase-1 entrypoints compatible with this deploy.`,
            )
          }
          if (phase1All) {
            phase1CallsPrepared = []
          } else if (!coreDone) {
            const coreCallData = useSplitWithSaltSelectors
              ? encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'deployPhase1CoreWithSalt',
                  args: [phase1Params, codeIds, shareOftSaltOverride],
                })
              : encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'deployPhase1Core',
                  args: [phase1Params, codeIds],
                })
            const finalizeCallData = useSplitWithSaltSelectors
              ? encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'finalizePhase1WithSalt',
                  args: [phase1Params, codeIds, shareOftSaltOverride],
                })
              : encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'finalizePhase1',
                  args: [phase1Params, codeIds],
                })
            phase1CallsPrepared = [asBatcherCall(coreCallData), asBatcherCall(finalizeCallData)]
          } else {
            const finalizeCallData = useSplitWithSaltSelectors
              ? encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'finalizePhase1WithSalt',
                  args: [phase1Params, codeIds, shareOftSaltOverride],
                })
              : encodeFunctionData({
                  abi: CREATOR_VAULT_BATCHER_ABI,
                  functionName: 'finalizePhase1',
                  args: [phase1Params, codeIds],
                })
            phase1CallsPrepared = [asBatcherCall(finalizeCallData)]
          }
        }

        const phase2CoreParams = {
          creatorToken,
          owner,
          creatorTreasury: expectedProtocolTreasury,
          payoutRecipient: payoutForDeploy,
          vault: expected.vault,
          wrapper: expected.wrapper,
          shareOFT: expected.shareOFT,
          shareSymbol,
          version: deployVersion,
          floorPriceQ96: floorPriceQ96ForBatcher,
        } as const

        const phase2FinalizeParams = {
          creatorToken,
          owner,
          vault: expected.vault,
          wrapper: expected.wrapper,
          shareOFT: expected.shareOFT,
          gaugeController: expected.gaugeController,
          ccaStrategy: expected.ccaStrategy,
          oracle: expected.oracle,
          version: deployVersion,
          depositAmount,
          requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
          floorPriceQ96: floorPriceQ96ForBatcher,
          auctionSteps,
          meteoraAlphaVault: ZERO_BYTES32 as `0x${string}`,
          solanaIxs: [],
        } as const

        // Phase 3 (strategies): Charm CREATOR/USDC + nested Ajna + SolanaStrategy
        const charmWeightBps = DEFAULT_CHARM_WEIGHT_BPS
        const ajnaWeightBps = DEFAULT_AJNA_WEIGHT_BPS
        const solanaWeightBps = DEFAULT_SOLANA_WEIGHT_BPS
        if (charmWeightBps <= 0n) throw new Error('Charm strategy is required')
        if (ajnaWeightBps <= 0n) throw new Error('Ajna strategy is required')
        if (solanaWeightBps <= 0n) throw new Error('Solana strategy is required')
        if (charmWeightBps + ajnaWeightBps + solanaWeightBps > 10_000n) {
          throw new Error('Strategy weights exceed 100%')
        }
        const configuredSolanaBridge = (CONTRACTS as any).solanaBridgeAdapter
        if (!configuredSolanaBridge || !isAddress(String(configuredSolanaBridge))) {
          throw new Error('Solana bridge adapter is not configured.')
        }
        const solanaBridgeAddress = getAddress(configuredSolanaBridge as Address)
        const solanaKeeper = expectedProtocolTreasury
        const ajnaKeeper = solanaKeeper
        const ajnaBufferRatioBps = 1_000n
        const ajnaMinBucketIndex = 4_156n
        const charmLabel = (depositSymbol || '').toLowerCase()

        // If the CREATOR/USDC v3 pool doesn't exist yet, `deployPhase3Strategies` needs a non-zero
        // `initialSqrtPriceX96` to create+initialize it.
        //
        // Prefer the same onchain market-derived pricing we use for the CCA floor price (CREATOR/ZORA v4 + references),
        // converted into USDC per CREATOR via Chainlink ETH/USD. Fall back to a conservative default (100 CREATOR/USDC).
        const sqrtBigInt = (n: bigint) => {
          if (n < 0n) throw new Error('sqrtBigInt: negative')
          if (n < 2n) return n
          // Newton iteration
          let x0 = n
          let x1 = (x0 + 1n) >> 1n
          while (x1 < x0) {
            x0 = x1
            x1 = (x1 + n / x1) >> 1n
          }
          return x0
        }

        const usdcForV3 = getAddress(((CONTRACTS as any).usdc ?? BASE_USDC) as Address)
        const chainlinkEthUsdForPricing = getAddress(((CONTRACTS as any).chainlinkEthUsd ?? BASE_CHAINLINK_ETH_USD) as Address)

        const fallbackV3InitialSqrtPriceX96 = (() => {
          try {
            // Conservative fallback when market-derived pricing is unavailable:
            // target ~100 CREATOR per 1 USDC (i.e. 0.01 USDC per CREATOR).
            const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
            const usdcDecimals = 6
            const pow10 = (d: number) => 10n ** BigInt(d)
            const creatorUnit = pow10(creatorDecimals)
            const usdcUnit = pow10(usdcDecimals)
            const usdcPerCreatorBase = 10_000n // 0.01 USDC in 6-decimal base units

            const creatorAddr = getAddress(creatorToken as Address)
            const usdcAddr = usdcForV3
            const token0IsCreator = creatorAddr.toLowerCase() < usdcAddr.toLowerCase()

            let amount0: bigint
            let amount1: bigint
            if (token0IsCreator) {
              amount0 = creatorUnit
              amount1 = usdcPerCreatorBase
            } else {
              amount0 = usdcUnit
              amount1 = (creatorUnit * usdcUnit) / usdcPerCreatorBase
            }
            if (amount0 <= 0n || amount1 <= 0n) return 1n << 96n

            const ratioX192 = (amount1 << 192n) / amount0
            const sqrtPriceX96 = sqrtBigInt(ratioX192)
            return sqrtPriceX96 > (2n ** 160n - 1n) ? (2n ** 160n - 1n) : sqrtPriceX96
          } catch {
            // Final guard: 1:1 price so phase3 can proceed.
            return 1n << 96n
          }
        })()

        const CHAINLINK_AGGREGATOR_ABI = [
          { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
          {
            type: 'function',
            name: 'latestRoundData',
            stateMutability: 'view',
            inputs: [],
            outputs: [
              { name: 'roundId', type: 'uint80' },
              { name: 'answer', type: 'int256' },
              { name: 'startedAt', type: 'uint256' },
              { name: 'updatedAt', type: 'uint256' },
              { name: 'answeredInRound', type: 'uint80' },
            ],
          },
        ] as const

        const marketV3InitialSqrtPriceX96 = await (async () => {
          try {
            // `floorPriceQ96Aligned` is derived from the same market pricing logic we use for CCA;
            // convert it back to a wei/token quote (ShareOFT uses 18 decimals).
            const weiPerCreator = marketFloorWeiPerTokenAligned
            if (typeof weiPerCreator !== 'bigint' || weiPerCreator <= 0n) return null

            const chainlink = chainlinkEthUsdForPricing
            const [decimals, round] = await Promise.all([
              publicClient.readContract({
                address: chainlink,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: 'decimals',
              }) as Promise<number>,
              publicClient.readContract({
                address: chainlink,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: 'latestRoundData',
              }),
            ])

            const answer = BigInt((round as any)?.[1] ?? 0n)
            if (answer <= 0n) return null

            // USDC per 1 CREATOR (in USDC base units, 6 decimals):
            // usdPerCreator = ethPerCreator * ethUsd
            // usdcBase = weiPerCreator * ethUsdAnswer * 1e6 / (1e18 * 10^chainlinkDecimals)
            const usdcPerCreatorBase =
              (weiPerCreator * answer * 1_000_000n) / (10n ** 18n * 10n ** BigInt(Number(decimals)))
            if (usdcPerCreatorBase <= 0n) return null

            const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
            const usdcDecimals = 6
            const pow10 = (d: number) => 10n ** BigInt(d)
            const creatorUnit = pow10(creatorDecimals)
            const usdcUnit = pow10(usdcDecimals)

            const usdcAddr = usdcForV3
            const creatorAddr = getAddress(creatorToken as Address)

            // Uniswap v3 init expects sqrt(price) where price = amount1/amount0 in raw units (token1/token0).
            // If token0=CREATOR, token1=USDC: amount0 = 1 CREATOR, amount1 = USDC per CREATOR.
            // If token0=USDC, token1=CREATOR: amount0 = 1 USDC, amount1 = CREATOR per USDC.
            const token0IsCreator = creatorAddr.toLowerCase() < usdcAddr.toLowerCase()

            let amount0: bigint
            let amount1: bigint
            if (token0IsCreator) {
              amount0 = creatorUnit
              amount1 = usdcPerCreatorBase
            } else {
              amount0 = usdcUnit
              // creatorPerUsdcBase = (creatorUnit * 1 USDC) / (USDC per CREATOR)
              amount1 = (creatorUnit * usdcUnit) / usdcPerCreatorBase
            }

            if (amount0 <= 0n || amount1 <= 0n) return null

            const ratioX192 = (amount1 << 192n) / amount0
            const sqrtPriceX96 = sqrtBigInt(ratioX192)
            return sqrtPriceX96 > (2n ** 160n - 1n) ? (2n ** 160n - 1n) : sqrtPriceX96
          } catch {
            return null
          }
        })()

        if (!marketV3InitialSqrtPriceX96) {
          logger.warn('[DeployVault] Market-derived V3 price unavailable; using conservative fallback', {
            creatorToken,
            owner,
            deploymentVersion: deployVersion,
          })
        }

        const phase3Params = {
          creatorToken,
          owner,
          vault: expected.vault,
          version: deployVersion,
          initialSqrtPriceX96: marketV3InitialSqrtPriceX96 ?? fallbackV3InitialSqrtPriceX96,
          charmVaultName: charmLabel ? `4626: ${charmLabel}/USDC` : '4626: CREATOR/USDC',
          charmVaultSymbol: charmLabel ? `CV-${charmLabel}-USDC` : 'CV-CREATOR-USDC',
          ajnaVaultName: charmLabel ? `Ajna 4626: ${charmLabel}/USDC` : 'Ajna 4626: CREATOR/USDC',
          ajnaVaultSymbol: charmLabel ? `AJ-${charmLabel}-USDC` : 'AJ-CREATOR-USDC',
          charmWeightBps,
          ajnaWeightBps,
          solanaWeightBps,
          ajnaBufferRatioBps,
          ajnaMinBucketIndex,
          ajnaKeeper,
          solanaKeeper,
          solanaMaxNavAge: DEFAULT_SOLANA_MAX_NAV_AGE,
          solanaMaxNavDeltaBpsPerUpdate: DEFAULT_SOLANA_MAX_NAV_DELTA_BPS,
          solanaMinBaseLiquidityBps: DEFAULT_SOLANA_MIN_BASE_LIQUIDITY_BPS,
          solanaBridgeAddress,
          enableAutoAllocate: false,
          expectedCharmProtocolFeePips: DEFAULT_CHARM_EXPECTED_PROTOCOL_FEE_PIPS,
        } as const

        // ============================================================
        // Deploy path: smart wallet signer (Privy or wallet_sendCalls)
        // ============================================================
        if (!publicClient) throw new Error('Public client not ready.')

        // Hard guard: require at least one executable signer path (canonical/Privy lanes only).
        if (!planOnly && !canUsePrivySmartWallet && !canUseWalletSendCalls) {
          throw new Error(
            'Smart wallet required. Sign in to 4626 to restore your canonical Coinbase Smart Wallet session, or use Coinbase Wallet (Base Account), then retry.',
          )
        }

        // Enforce custody: the smart wallet sender must already hold the initial deposit.
        const smartWalletBalance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        })) as bigint
        if (validateDepositBalance && smartWalletBalance < depositAmount) {
          throw new Error(
            `Creator smart wallet needs ${formatDeposit(depositAmount)} ${depositSymbol} (has ${formatDeposit(smartWalletBalance)}). Transfer funds to ${shortAddress(owner)} and retry.`,
          )
        }

        const phase1Calls: Array<{ target: Address; value: bigint; data: Hex }> = phase1CallsPrepared

        const phase2Calls: Array<{ target: Address; value: bigint; data: Hex }> = []
        const phase2ApproveCalls: Array<{ target: Address; value: bigint; data: Hex }> = []
        let phase2UsesPermit2 = false
        if (!planOnly && supportsPhase2Permit2 && CONTRACTS.permit2) {
          try {
            const permit2Address = getAddress(CONTRACTS.permit2 as Address)
            const nonce = createPermit2Nonce()
            const deadline = createPermit2Deadline()
            const { permit, typedData } = buildPermit2SignatureTransfer({
              chainId: base.id,
              permit2: permit2Address,
              token: creatorToken,
              amount: depositAmount,
              spender: batcherAddress,
              nonce,
              deadline,
            })
            let signature: Hex
            try {
              signature = await signOwnerPermit2TypedData(typedData as unknown as Record<string, unknown>)
            } catch (permit2SignErr) {
              if (!isUserRejectedErrorMessage(permit2SignErr)) throw permit2SignErr
              logger.info('[DeployVault] Permit2 signature was rejected; retrying once', {
                owner,
                batcher: batcherAddress,
              })
              await new Promise((resolve) => setTimeout(resolve, 250))
              signature = await signOwnerPermit2TypedData(typedData as unknown as Record<string, unknown>)
            }
            phase2UsesPermit2 = true
            logger.info('[DeployVault] phase2 finalize using Permit2 signature transfer', {
              owner,
              batcher: batcherAddress,
              permit2: permit2Address,
              nonce: nonce.toString(),
              deadline: deadline.toString(),
            })
            const phase2FinalizeCall = {
              target: batcherAddress,
              value: 0n,
              data: encodeFunctionData({
                abi: CREATOR_VAULT_BATCHER_ABI,
                functionName: 'finalizePhase2WithPermit2',
                args: [phase2FinalizeParams, permit, signature],
              }),
            } as const
            phase2Calls.push(phase2FinalizeCall)
          } catch (permit2Err) {
            if (isUserRejectedErrorMessage(permit2Err)) {
              throw permit2Err
            }
            logger.warn('[DeployVault] Permit2 phase2 finalize unavailable; falling back to approvals', {
              batcher: batcherAddress,
              owner,
              error: permit2Err instanceof Error ? permit2Err.message : String(permit2Err ?? ''),
            })
          }
        }

        if (!phase2UsesPermit2) {
          const swAllowanceToBatcher = (await publicClient.readContract({
            address: creatorToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, batcherAddress],
          })) as bigint

          if (swAllowanceToBatcher < depositAmount) {
            if (swAllowanceToBatcher !== 0n) {
              phase2ApproveCalls.push({
                target: creatorToken,
                value: 0n,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: 'approve',
                  args: [batcherAddress, 0n],
                }),
              })
            }
            phase2ApproveCalls.push({
              target: creatorToken,
              value: 0n,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [batcherAddress, depositAmount],
              }),
            })
          }
        }

        const phase2CoreState = await (async () => {
          try {
            const addrs = [expected.gaugeController, expected.ccaStrategy, expected.oracle] as const
            const codes = await Promise.all(addrs.map((a) => publicClient.getBytecode({ address: a })))
            const deployed = codes.map((c) => !!c && c !== '0x')
            return {
              gaugeDeployed: deployed[0] ?? false,
              ccaDeployed: deployed[1] ?? false,
              oracleDeployed: deployed[2] ?? false,
            } as const
          } catch {
            return {
              gaugeDeployed: false,
              ccaDeployed: false,
              oracleDeployed: false,
            } as const
          }
        })()
        const phase2CoreAny =
          phase2CoreState.gaugeDeployed || phase2CoreState.ccaDeployed || phase2CoreState.oracleDeployed
        const phase2CoreAll =
          phase2CoreState.gaugeDeployed && phase2CoreState.ccaDeployed && phase2CoreState.oracleDeployed
        if (phase2CoreAny && !phase2CoreAll) {
          throw new Error(
            `Phase 2 core is partially deployed for deployment version (${deploymentVersion}). ` +
              `Expected gauge/CCA/oracle to be all present or all absent. ` +
              `Bump VITE_DEPLOYMENT_VERSION to start a fresh slate, or reconcile this partial state.`,
          )
        }

        const phase2CoreCall = {
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase2Core',
            args: [phase2CoreParams, codeIds],
          }),
        } as const

        const phase2FinalizeCall = phase2UsesPermit2
          ? (phase2Calls[0] as { target: Address; value: bigint; data: Hex })
          : ({
              target: batcherAddress,
              value: 0n,
              data: encodeFunctionData({
                abi: CREATOR_VAULT_BATCHER_ABI,
                functionName: 'finalizePhase2',
                args: [phase2FinalizeParams],
              }),
            } as const)

        const phase2CoreNeeded = !phase2CoreAll
        if (phase2CoreNeeded) {
          if (phase2UsesPermit2) {
            phase2Calls.unshift(phase2CoreCall)
          } else {
            phase2Calls.push(...phase2ApproveCalls, phase2CoreCall, phase2FinalizeCall)
          }
        } else {
          logger.info('[DeployVault] phase2.core already deployed; skipping deployPhase2Core call', {
            expectedGauge: expected.gaugeController,
            expectedCca: expected.ccaStrategy,
            expectedOracle: expected.oracle,
          })
          if (!phase2UsesPermit2) {
            phase2Calls.push(...phase2ApproveCalls, phase2FinalizeCall)
          }
        }

        if (!burnStreamAlreadyDeployed) phase2Calls.push(burnStreamDeployCall)
        if (!payoutRouterAlreadyDeployed) phase2Calls.push(payoutRouterDeployCall)
        if (!creatorCoinPolicyControllerAlreadyDeployed) phase2Calls.push(creatorCoinPolicyControllerDeployCall)
        if (!burnStreamAlreadyConfigured) phase2Calls.push(vaultSetBurnStreamCall)
        phase2Calls.push(vaultWhitelistRouterCall)
        if (payoutRouterSetKeeperCall) phase2Calls.push(payoutRouterSetKeeperCall)
        if (payoutRouterSetExternalSwapTargetApprovalCalls.length > 0) {
          phase2Calls.push(...payoutRouterSetExternalSwapTargetApprovalCalls)
        }
        if (payoutRouterSetExternalSwapSpenderApprovalCalls.length > 0) {
          phase2Calls.push(...payoutRouterSetExternalSwapSpenderApprovalCalls)
        }
        if (payoutRouterSetSwapPathCalls.length > 0) phase2Calls.push(...payoutRouterSetSwapPathCalls)
        if (payoutMismatch) {
          if (!canSetPayoutRecipientFromOwner) {
            throw new Error(
              `Cannot set CreatorCoin payout recipient to router from ${shortAddress(owner)}. ` +
                `Current payout recipient is ${shortAddress(currentPayoutRecipient)}.`,
            )
          }
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: payoutRecipientCallData,
          })
        }
        if (coinOwnershipNeedsTransfer) {
          if (!canTransferCoinOwnershipFromOwner) {
            const ownerDisplay = currentCoinOwner ? shortAddress(currentCoinOwner) : 'unknown'
            throw new Error(
              `Cannot transfer CreatorCoin ownership to policy controller ${shortAddress(expectedCreatorCoinPolicyController)} ` +
                `from current owner ${ownerDisplay}.`,
            )
          }
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: coinTransferOwnershipCallData,
          })
        } else if (!currentCoinOwner) {
          logger.info('[DeployVault] creator_coin_owner_unresolved_skip_transfer', {
            creatorToken,
            owner,
            policyController: expectedCreatorCoinPolicyController,
          })
        }

        const phase3StrategyCalls: Array<{ target: Address; value: bigint; data: Hex }> = [
          {
            target: batcherAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: CREATOR_VAULT_BATCHER_ABI,
              functionName: 'deployPhase3Strategies',
              args: [phase3Params, strategyCodeIds],
            }),
          },
        ]

        const phase4Calls: Array<{ target: Address; value: bigint; data: Hex }> = []
        if (DEFAULT_AUCTION_PERCENT > 0) {
          phase4Calls.push({
            target: batcherAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: CREATOR_VAULT_BATCHER_ABI,
              functionName: 'launchDeferredAuction',
              args: [
                {
                  creatorToken,
                  owner,
                  shareOFT: phase2CoreParams.shareOFT,
                  version: deployVersion,
                  floorPriceQ96: floorPriceQ96ForBatcher,
                  requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
                  auctionSteps,
                },
              ],
            }),
          })
        }

        // Safety: constrain target addresses to known deploy surfaces (no arbitrary calldata UI).
        const assertSafe = (calls: Array<{ target: Address; value: bigint; data: Hex }>) => {
          const allow = new Set<string>([
            getAddress(creatorToken).toLowerCase(),
            getAddress(batcherAddress).toLowerCase(),
            getAddress(expectedCreate2Deployer).toLowerCase(),
            getAddress(expected.vault).toLowerCase(),
            getAddress(expectedPayoutRouter).toLowerCase(),
          ])
          for (const c of calls) {
            const to = getAddress(c.target).toLowerCase()
            if (!allow.has(to)) throw new Error(`Unsafe call target blocked: ${to}`)
            if (c.value !== 0n) throw new Error('Unsafe call value blocked (non-zero ETH value)')
            const d = String(c.data ?? '')
            if (!d.startsWith('0x')) throw new Error('Unsafe call data blocked (missing 0x prefix)')
          }
        }

        assertSafe(phase1Calls)
        assertSafe(phase2Calls)
        assertSafe(phase4Calls)

        const phase2PostCalls = phase2Calls.filter(
          (c) => c !== phase2CoreCall && c !== phase2FinalizeCall && !phase2ApproveCalls.includes(c),
        )
        const phase2Create2Calls = phase2PostCalls.filter(
          (c) => String(c.target).toLowerCase() === String(expectedCreate2Deployer).toLowerCase(),
        )
        const phase2ConfigCalls = phase2PostCalls.filter((c) => !phase2Create2Calls.includes(c))
        if (phase2Create2Calls.length > 0) {
          let create2Owner: Address | null = null
          let ownerAuthorized = false
          try {
            const [create2OwnerRead, ownerAuthorizedRead] = await Promise.all([
              publicClient.readContract({
                address: expectedCreate2Deployer,
                abi: CREATE2_DEPLOYER_AUTH_ABI,
                functionName: 'owner',
              }),
              publicClient.readContract({
                address: expectedCreate2Deployer,
                abi: CREATE2_DEPLOYER_AUTH_ABI,
                functionName: 'authorizedDeployers',
                args: [owner],
              }),
            ])
            create2Owner = getAddress(create2OwnerRead as Address)
            ownerAuthorized = Boolean(ownerAuthorizedRead)
          } catch (error) {
            logger.warn('[DeployVault] create2 authorization precheck skipped', {
              create2Deployer: expectedCreate2Deployer,
              owner,
              error: String(error),
            })
          }
          if (create2Owner && !ownerAuthorized && !sameAddress(create2Owner, owner)) {
            if (sameAddress(create2Owner, UNIVERSAL_CREATE2_FACTORY)) {
              throw new Error(
                `Configured create2 deployer ${expectedCreate2Deployer} blocks direct deploy calls from ${shortAddress(owner)}. ` +
                  `Owner is the universal CREATE2 factory (${shortAddress(create2Owner)}), so authorized deployers cannot be updated. ` +
                  `Rotate to a batcher wired to a deploy-capable create2 deployer, then retry.`,
              )
            }
            throw new Error(
              `Configured create2 deployer ${expectedCreate2Deployer} blocks direct deploy calls from ${shortAddress(owner)} ` +
                `(owner ${shortAddress(create2Owner)}). Authorize ${shortAddress(owner)} via setAuthorizedDeployer, ` +
                `or rotate to a deploy-capable batcher, then retry.`,
            )
          }
        }
        // Keep phase2 deterministic: finalize-only (deposit + split + ownership transfer).
        // Move CREATE2 + post-config behind a batcher-primary phase3 UserOp.
        const phase2FinalizeCalls = [phase2FinalizeCall]
        const phase3Calls: Array<{ target: Address; value: bigint; data: Hex }> = [
          ...phase3StrategyCalls,
          vaultSetMinimumIdleCall,
          // Apply 30/30/30 from the 90% deployable bucket; keep 10% idle.
          vaultDeployToStrategiesCall,
          ...phase2Create2Calls,
          ...phase2ConfigCalls,
        ]
        assertSafe(phase3Calls)

        const sessionVanityRequest: DeploySessionVanityRequest | undefined =
          vaultVanityPrefix || shareOftVanitySuffix
            ? {
                ...(vaultVanityPrefix ? { vaultPrefix: `0x${vaultVanityPrefix}` } : {}),
                ...(shareOftVanitySuffix ? { shareSuffix: shareOftVanitySuffix } : {}),
              }
            : undefined

        const sessionCreatePayload: DeploySessionCreateRequest = {
          smartWallet: owner,
          creatorToken,
          ownerAddress: owner,
          phase1Calls: serializeSessionCalls(phase1Calls),
          phase2CoreCalls: serializeSessionCalls(
            phase2CoreNeeded ? [...phase2ApproveCalls, phase2CoreCall] : [...phase2ApproveCalls],
          ),
          phase2FinalizeCalls: serializeSessionCalls(phase2FinalizeCalls),
          phase3Calls: serializeSessionCalls(phase3Calls),
          phase4Calls: serializeSessionCalls(phase4Calls),
          solanaOvault: {
            // Force deploy-session OVault mesh preflight for Solana strategy wiring.
            enabled: DEFAULT_SOLANA_OVAULT_MESH_ENABLED,
            assetMintOrigin: 'existing',
          },
          ...(sessionVanityRequest ? { vanity: sessionVanityRequest } : {}),
          version: deployVersion,
        }
        const deployPlanExport: DeployPlanExport = {
          generatedAt: new Date().toISOString(),
          chainId: base.id,
          useServerContinue,
          batcher: batcherAddress,
          create2Deployer: expectedCreate2Deployer,
          creatorToken,
          owner,
          deploymentVersion: deployVersion,
          expectedAddresses: {
            vault: expected.vault,
            wrapper: expected.wrapper,
            shareOFT: expected.shareOFT,
            gaugeController: expected.gaugeController,
            ccaStrategy: expected.ccaStrategy,
            oracle: expected.oracle,
            burnStream: expected.burnStream,
            payoutRouter: expected.payoutRouter,
          },
          phaseCounts: {
            phase1: sessionCreatePayload.phase1Calls.length,
            phase2Core: sessionCreatePayload.phase2CoreCalls.length,
            phase2Finalize: sessionCreatePayload.phase2FinalizeCalls.length,
            phase3: sessionCreatePayload.phase3Calls.length,
            phase4: sessionCreatePayload.phase4Calls.length,
          },
          sessionCreateRequest: sessionCreatePayload,
        }

        logger.info('[DeployVault] deploy_start', {
          deploy_mode: strictNoEoaEnforced ? 'no_eoa_strict' : 'default',
          creatorToken,
          owner,
          deploymentVersion: deployVersion,
          batcher: batcherAddress,
          phases: { phase1: phase1Calls.length, phase2: phase2Calls.length, phase3: phase3Calls.length, phase4: phase4Calls.length },
        })
        if (planOnly) return deployPlanExport

        // Debug helper: expose phase1 call data on window for console testing
        if (typeof window !== 'undefined' && phase1Calls.length > 0) {
          const phaseCallMap = {
            phase1: phase1Calls,
            phase2: phase2FinalizeCalls,
            phase3: phase3Calls,
            phase4: phase4Calls,
          } as const
          const testPhaseCall = async (
            phase: 'phase1' | 'phase2' | 'phase3' | 'phase4' = 'phase1',
            index = 0,
          ) => {
            if (!publicClient) throw new Error('No publicClient')
            const calls = phaseCallMap[phase]
            const call = calls[index]
            if (!call) throw new Error(`No call at ${phase}[${index}]`)
            console.log('[DEBUG] Testing direct eth_call', {
              phase,
              index,
              to: call.target,
              data: call.data.slice(0, 10),
              from: owner,
            })
            try {
              const result = await (publicClient as any).call({
                to: call.target,
                data: call.data,
                account: owner,
              })
              console.log('[DEBUG] Direct call SUCCESS', { phase, index, result })
              return { success: true, result }
            } catch (e: any) {
              console.error('[DEBUG] Direct call FAILED', {
                phase,
                index,
                error: e?.message,
                shortMessage: e?.shortMessage,
                cause: e?.cause,
                data: e?.cause?.data ?? e?.data,
              })
              return { success: false, error: e }
            }
          }
          const debugInfo = {
            phase1Call: phase1Calls[0],
            phaseCallCounts: {
              phase1: phase1Calls.length,
              phase2: phase2FinalizeCalls.length,
              phase3: phase3Calls.length,
              phase4: phase4Calls.length,
            },
            owner,
            batcherAddress,
            creatorToken,
            deploymentVersion: deployVersion,
            testPhaseCall,
            // Backward compatibility with existing console hint.
            testDirectCall: () => testPhaseCall('phase1', 0),
          }
          ;(window as any).__cvDeployDebug = debugInfo
          console.log(
            '[DeployVault] Debug helper available: window.__cvDeployDebug.testDirectCall(), window.__cvDeployDebug.testPhaseCall("phase3", 0)',
          )
        }

        // Helper to convert calls format
        const toCalls = (calls: Array<{ target: Address; value: bigint; data: Hex }>) =>
          calls.map((c) => ({ to: c.target, value: c.value, data: c.data }))
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'

        const ownerSlotForPhase = (phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4') =>
          phaseLabel === 'phase1' ? 'userOp1' : phaseLabel === 'phase2' ? 'userOp2' : phaseLabel === 'phase3' ? 'userOp3' : 'userOp4'
        const txSlotForPhase = (phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4') =>
          phaseLabel === 'phase1' ? 'tx1' : phaseLabel === 'phase2' ? 'tx2' : phaseLabel === 'phase3' ? 'tx3' : 'tx4'
        const persistUserOpResult = (
          phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4',
          logPhaseLabel: string,
          result: { userOpHash: Hex; transactionHash: Hex },
          context: string,
        ) => {
          setTxId(result.transactionHash)
          setPhaseTxs((s) => ({
            ...s,
            [ownerSlotForPhase(phaseLabel)]: result.userOpHash,
            [txSlotForPhase(phaseLabel)]: result.transactionHash,
          }))
          logger.info(`[DeployVault] ${logPhaseLabel}_confirmed via ${context}`, {
            userOpHash: result.userOpHash,
            txHash: result.transactionHash,
          })
          // In production, logger.info is hidden unless debug is enabled.
          // Keep a plain console line so operators can still see phase progress.
          console.log(`[DeployVault] ${logPhaseLabel}_confirmed`, {
            via: context,
            userOpHash: result.userOpHash,
            txHash: result.transactionHash,
          })
        }

        const sendPhaseCalls = async (
          calls: Array<{ target: Address; value: bigint; data: Hex }>,
          phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4',
          opts?: { noSplit?: boolean; segment?: string },
        ) => {
          const logPhaseLabel = opts?.segment ? `${phaseLabel}.${opts.segment}` : phaseLabel
          const batcherAddressLc = getAddress(batcherAddress).toLowerCase()
          const batcherCallCount = calls.reduce((acc, c) => {
            return getAddress(c.target).toLowerCase() === batcherAddressLc ? acc + 1 : acc
          }, 0)
          const hasBatcherCall = batcherCallCount > 0

          if (!opts?.noSplit && phaseLabel === 'phase1' && calls.length > 1 && batcherCallCount > 1) {
            const firstBatcherIdx = calls.findIndex((c) => getAddress(c.target).toLowerCase() === batcherAddressLc)
            if (firstBatcherIdx > -1 && firstBatcherIdx < calls.length - 1) {
              const phase1Core = calls.slice(0, firstBatcherIdx + 1)
              const phase1Finalize = calls.slice(firstBatcherIdx + 1)
              logger.info('[DeployVault] Splitting phase1 into multiple UserOps', {
                coreCount: phase1Core.length,
                finalizeCount: phase1Finalize.length,
              })
              await sendPhaseCalls(phase1Core, phaseLabel, { noSplit: true, segment: 'core' })
              if (phase1Finalize.length > 0) {
                const phase1BaseSalt = deriveBaseSalt({
                  creatorToken,
                  owner,
                  chainId: base.id,
                  version: deployVersion,
                })
                await waitForPhase1CoreState({
                  publicClient: publicClient as any,
                  batcher: batcherAddress,
                  baseSalt: phase1BaseSalt,
                  expectedVault: expected?.vault ?? null,
                  expectedWrapper: expected?.wrapper ?? null,
                })
              }
              await sendPhaseCalls(phase1Finalize, phaseLabel, { noSplit: false, segment: 'finalize' })
              return
            }
          }

          if (!opts?.noSplit && phaseLabel === 'phase2' && calls.length > 1) {
            const approveSelector = '0x095ea7b3'
            const creatorTokenAddr = getAddress(creatorToken).toLowerCase()
            const approveCalls = calls.filter((c) => {
              if (!c?.data || typeof c.data !== 'string') return false
              if (!c.data.startsWith(approveSelector)) return false
              return getAddress(c.target).toLowerCase() === creatorTokenAddr
            })
            const otherCalls = calls.filter((c) => !approveCalls.includes(c))
            if (approveCalls.length > 0 && otherCalls.length > 0) {
              logger.info('[DeployVault] Splitting phase2 approvals', {
                approvalCount: approveCalls.length,
                remainingCount: otherCalls.length,
              })
              const approveSegment = opts?.segment ? `${opts.segment}.approve` : 'approve'
              const remainingSegment = opts?.segment ? `${opts.segment}.afterApprove` : 'afterApprove'
              await sendPhaseCalls(approveCalls, phaseLabel, { noSplit: true, segment: approveSegment })
              await sendPhaseCalls(otherCalls, phaseLabel, { noSplit: false, segment: remainingSegment })
              return
            }
          }

          if (!opts?.noSplit && phaseLabel === 'phase2' && calls.length > 2 && batcherCallCount > 1) {
            const batcherIdx = calls.findIndex(
              (c) => getAddress(c.target).toLowerCase() === batcherAddressLc
            )
            if (batcherIdx > -1 && batcherIdx < calls.length - 1) {
              const phase2Primary = calls.slice(0, batcherIdx + 1)
              const phase2Secondary = calls.slice(batcherIdx + 1)
              logger.info('[DeployVault] Splitting phase2 into multiple UserOps', {
                primaryCount: phase2Primary.length,
                secondaryCount: phase2Secondary.length,
              })
              await sendPhaseCalls(phase2Primary, phaseLabel, { noSplit: true, segment: 'part1' })
              await sendPhaseCalls(phase2Secondary, phaseLabel, { noSplit: false, segment: 'part2' })
              return
            }
          }

          if (!opts?.noSplit && phaseLabel === 'phase2' && calls.length > 1 && !hasBatcherCall) {
            const create2Addr = getAddress(expectedCreate2Deployer).toLowerCase()
            const create2Calls = calls.filter(
              (c) => getAddress(c.target).toLowerCase() === create2Addr
            )
            const otherCalls = calls.filter(
              (c) => getAddress(c.target).toLowerCase() !== create2Addr
            )
            if (create2Calls.length > 0 && otherCalls.length > 0) {
              logger.info('[DeployVault] Splitting phase2 deploys/config', {
                deployCount: create2Calls.length,
                configCount: otherCalls.length,
              })
              const deploySegment = opts?.segment ? `${opts.segment}.deploys` : 'deploys'
              const configSegment = opts?.segment ? `${opts.segment}.config` : 'config'
              await sendPhaseCalls(create2Calls, phaseLabel, { noSplit: true, segment: deploySegment })
              await sendPhaseCalls(otherCalls, phaseLabel, { noSplit: true, segment: configSegment })
              return
            }
          }

          if (!opts?.noSplit && phaseLabel === 'phase3' && calls.length > 1 && hasBatcherCall) {
            const firstBatcherIdx = calls.findIndex((c) => getAddress(c.target).toLowerCase() === batcherAddressLc)
            if (firstBatcherIdx > -1 && firstBatcherIdx < calls.length - 1) {
              const phase3Core = calls.slice(0, firstBatcherIdx + 1)
              const phase3Post = calls.slice(firstBatcherIdx + 1)
              logger.info('[DeployVault] Splitting phase3 strategy/core from post-config', {
                coreCount: phase3Core.length,
                postCount: phase3Post.length,
              })
              await sendPhaseCalls(phase3Core, phaseLabel, { noSplit: true, segment: 'core' })
              await sendPhaseCalls(phase3Post, phaseLabel, { noSplit: false, segment: 'post' })
              return
            }
          }

          if (!opts?.noSplit && phaseLabel === 'phase3' && calls.length > 1 && !hasBatcherCall) {
            const create2Addr = getAddress(expectedCreate2Deployer).toLowerCase()
            const create2Calls = calls.filter((c) => getAddress(c.target).toLowerCase() === create2Addr)
            const otherCalls = calls.filter((c) => getAddress(c.target).toLowerCase() !== create2Addr)
            if (create2Calls.length > 0 && otherCalls.length > 0) {
              logger.info('[DeployVault] Splitting phase3 deploys/config', {
                deployCount: create2Calls.length,
                configCount: otherCalls.length,
              })
              const deploySegment = opts?.segment ? `${opts.segment}.deploys` : 'deploys'
              const configSegment = opts?.segment ? `${opts.segment}.config` : 'config'
              await sendPhaseCalls(create2Calls, phaseLabel, { noSplit: true, segment: deploySegment })
              await sendPhaseCalls(otherCalls, phaseLabel, { noSplit: true, segment: configSegment })
              return
            }
          }

          // Pre-flight simulation: check if the underlying call would succeed
          // This helps diagnose contract-level reverts vs ERC-4337 issues
          if (canonicalSmartWallet && publicClient) {
            logger.info(`[DeployVault] ${logPhaseLabel} running pre-flight simulation`, {
              smartWallet: canonicalSmartWallet,
              callCount: calls.length,
              firstCallTo: calls[0]?.target,
              firstCallSelector: calls[0]?.data?.slice(0, 10),
            })
            try {
              const simResult = await simulateSmartWalletCalls({
                publicClient: publicClient as any,
                smartWallet: canonicalSmartWallet,
                calls: toCalls(calls),
              })
              if (!simResult.success) {
                logger.error(`[DeployVault] ${logPhaseLabel} pre-flight simulation FAILED`, {
                  smartWallet: canonicalSmartWallet,
                  callCount: calls.length,
                  error: simResult.error,
                  revertData: simResult.revertData,
                  errorName: simResult.errorName,
                  directCallResult: simResult.directCallResult,
                  firstCallTo: calls[0]?.target,
                  firstCallSelector: calls[0]?.data?.slice(0, 10),
                })
                // Provide a more helpful error message based on the detected error
                if (simResult.errorName) {
                  const errorMessages: Record<string, string> = {
                    'NotOwner()': 'The batcher requires msg.sender == owner, but the smart wallet may not be recognized as the caller. Check owner address and ERC-4337 setup.',
                    'ZeroAddress()': 'One of the required addresses is zero. Check creator token, owner, or other parameters.',
                    'InvalidCodeId()': 'Bytecode not registered in the bytecode store. Run the bytecode registration script first.',
                    'DeployFailed()': 'CREATE2 deployment failed (address likely already used for this deployment version). If this is a retry, keep the same version only when the full phase already exists; otherwise bump VITE_DEPLOYMENT_VERSION.',
                    'NotAuthorizedDeployer()':
                      'Create2 deployer rejected this caller. The smart wallet is not authorized for direct deploy(bytes32,bytes32,bytes) calls on the configured create2 deployer.',
                    'Phase1Missing()': 'Phase 1 contracts must be deployed before Phase 2. Deploy Phase 1 first.',
                    'Phase1CoreMissing()': 'Phase 1 core must be deployed before finalize. Run deployPhase1Core first.',
                    'Phase1StateMismatch()': 'Phase 1 finalize inputs do not match the stored core deployment state.',
                    'Phase2Missing()': 'Phase 2 contracts must be deployed before finalization.',
                    'InvalidPercent()': 'Auction percent must be 0-100.',
                    'InvalidWeight()': 'Strategy weights must be valid (0-10000 bps).',
                    'V3PoolMissing()': 'Uniswap V3 pool creation failed.',
                    'MissingInitialSqrtPriceX96()': 'V3 pool needs initial price to be set.',
                    'AuctionAlreadyPending()': 'A deferred auction already exists for this deployment.',
                    'NoPendingAuction()': 'No deferred auction found to launch.',
                  }
                  const helpText = errorMessages[simResult.errorName] ?? `Contract reverted with: ${simResult.errorName}`
                  throw new Error(`${logPhaseLabel} would revert: ${helpText}`)
                }
                if (simResult.revertData?.toLowerCase().startsWith('0xe092ade8')) {
                  throw new Error(
                    `${logPhaseLabel} would revert: Solana bridge route is not registered ` +
                      '(WrappedSplRouteNotRegistered). Register a supported ShareOFT↔SPL route first, ' +
                      'or disable Solana bridging for this deploy.',
                  )
                }
                // If we have directCallResult with an error, show that too
                if (simResult.directCallResult && !simResult.directCallResult.success) {
                  logger.error(`[DeployVault] ${logPhaseLabel} direct call simulation also failed`, {
                    error: simResult.directCallResult.error,
                    revertData: simResult.directCallResult.revertData,
                    errorName: simResult.directCallResult.errorName,
                  })
                  if (simResult.directCallResult.errorName) {
                    const errorMessages: Record<string, string> = {
                      'NotOwner()': 'The batcher requires msg.sender == owner. The smart wallet address must match the owner parameter.',
                      'ZeroAddress()': 'One of the required addresses is zero.',
                      'InvalidCodeId()': 'Bytecode not registered. Run bytecode registration first.',
                      'DeployFailed()': 'CREATE2 deployment failed (address likely already used for this deployment version).',
                      'NotAuthorizedDeployer()':
                        'Create2 deployer rejected this caller. The smart wallet is not authorized for direct deploy(bytes32,bytes32,bytes) calls on the configured create2 deployer.',
                      'Phase1Missing()': 'Phase 1 contracts must be deployed first.',
                      'Phase1CoreMissing()': 'Phase 1 core must be deployed before finalize.',
                      'Phase1StateMismatch()': 'Phase 1 finalize inputs do not match the stored core deployment state.',
                      'Phase2Missing()': 'Phase 2 contracts must be deployed first.',
                    }
                    const helpText = errorMessages[simResult.directCallResult.errorName] ?? `Contract reverted with: ${simResult.directCallResult.errorName}`
                    throw new Error(`${logPhaseLabel} would revert: ${helpText}`)
                  }
                  if (simResult.directCallResult.revertData?.toLowerCase().startsWith('0xe092ade8')) {
                    throw new Error(
                      `${logPhaseLabel} would revert: Solana bridge route is not registered ` +
                        '(WrappedSplRouteNotRegistered). Register a supported ShareOFT↔SPL route first, ' +
                        'or disable Solana bridging for this deploy.',
                    )
                  }
                }
                // Don't throw for unknown errors - let the UserOp attempt proceed to get more context
              } else {
                logger.info(`[DeployVault] ${logPhaseLabel} pre-flight simulation PASSED`, {
                  directCallResult: simResult.directCallResult?.success ? 'passed' : 'failed',
                })
              }
            } catch (simError) {
              // If the simulation itself throws (not the contract reverting), log but continue
              if (simError instanceof Error && simError.message.includes('would revert')) {
                throw simError // Re-throw our formatted error
              }
              logger.warn(`[DeployVault] ${logPhaseLabel} pre-flight simulation error`, {
                error: simError instanceof Error ? simError.message : String(simError),
              })
            }
          } else {
            logger.warn(`[DeployVault] ${logPhaseLabel} skipping pre-flight simulation`, {
              hasCanonicalSmartWallet: !!canonicalSmartWallet,
              hasPublicClient: !!publicClient,
            })
          }

          // PATH 1.5: Privy embedded EOA is already an owner (lower verification gas than EIP-1271 owner path)
          if (
            canonicalSmartWallet &&
            privyEmbeddedEoaIsCanonicalOwner &&
            privyEmbeddedEoaCanSign &&
            privyEmbeddedEoaAddress &&
            publicClient
          ) {
            logger.info(`[DeployVault] Using ERC-4337 via Privy embedded EOA owner for ${logPhaseLabel}`, {
              canonicalSmartWallet,
              privyEmbeddedEoaAddress,
            })
            try {
              const embeddedProvider = await getPrivyEmbeddedEoaProvider()
              if (!embeddedProvider?.request) {
                throw new Error('Privy embedded EOA provider not available')
              }
              await ensureProviderOnBase({ provider: embeddedProvider, label: 'Privy embedded EOA' })
              const embeddedWalletClientAdapter = {
                request: async (args: { method: string; params?: any[] }) => {
                  // Privy embedded providers may block eth_sign, but often support
                  // secp256k1_sign for raw 32-byte digests (ideal for UserOp hashes).
                  if (args?.method === 'eth_sign') {
                    const p = Array.isArray(args.params) ? args.params : []
                    const hashCandidate = typeof p[1] === 'string' ? p[1] : ''
                    const isHash = /^0x[0-9a-fA-F]{64}$/.test(hashCandidate)
                    if (isHash) {
                      try {
                        const rawSig = await embeddedProvider.request({
                          method: 'secp256k1_sign',
                          params: [hashCandidate],
                        })
                        return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
                      } catch (signErr) {
                        logger.warn('[DeployVault] Privy embedded secp256k1_sign failed; falling back to eth_sign', {
                          phaseLabel: logPhaseLabel,
                          error: signErr instanceof Error ? signErr.message : String(signErr ?? ''),
                        })
                      }
                    }
                  }
                  return await embeddedProvider.request(args as any)
                },
                signMessage: async (args: { account: Address; message: any }) => {
                  const raw =
                    typeof args?.message === 'object' && args.message !== null && 'raw' in args.message
                      ? (args.message as any).raw
                      : args?.message
                  const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
                  const rawSig = await embeddedProvider.request({
                    method: 'personal_sign',
                    params: [msgHex, privyEmbeddedEoaAddress],
                  })
                  return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
                },
                signTypedData: async (typedData: any) => {
                  const rawSig = await embeddedProvider.request({
                    method: 'eth_signTypedData_v4',
                    params: [privyEmbeddedEoaAddress, JSON.stringify(typedData)],
                  })
                  return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
                },
              }
              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: embeddedWalletClientAdapter as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: privyEmbeddedEoaAddress,
                calls: toCalls(calls),
                version: '1',
                userOpSignMode: 'eth_sign',
                ownerIsContract: false,
                allowEoaSignMessageFallback: false,
                retryWithLowGasContractSigner: false,
              })
              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'ERC-4337 (privy embedded EOA owner)')
              return
            } catch (embeddedErr) {
              logger.warn('[DeployVault] Privy embedded EOA owner signer failed; trying app smart wallet owner path', {
                phaseLabel: logPhaseLabel,
                privyEmbeddedEoaAddress,
                error: embeddedErr instanceof Error ? embeddedErr.message : String(embeddedErr ?? ''),
              })
            }
          }

          // PATH 2: Privy app smart wallet is an owner (EIP-1271 signer)
          // Original deploy pattern: avoid this path when the embedded EOA owner flow is available.
          if (
            canonicalSmartWallet &&
            privySmartWalletIsCanonicalOwner &&
            privySmartWalletCanSign &&
            smartWalletClient &&
            privySmartWalletAddress &&
            publicClient
          ) {
            logger.info(`[DeployVault] Using ERC-4337 via Privy smart wallet owner for ${logPhaseLabel}`, {
              canonicalSmartWallet,
              privySmartWalletAddress,
            })

            await ensureProviderOnBase({ provider: smartWalletClient, label: 'Privy smart wallet' })

            const smartWalletClientAdapter = {
              request: async (args: { method: string; params: any[] }) => {
                const client: any = smartWalletClient as any
                // For Privy smart wallets, prefer the native provider `request()` paths for eth_sign / personal_sign.
                // Some client.account helpers can return non-standard signature envelopes that bundlers reject.
                if (args.method === 'eth_sign' || args.method === 'personal_sign') {
                  if (typeof client?.request !== 'function') {
                    throw new Error('Privy smart wallet client does not support request()')
                  }
                  const rawResult = await client.request(args)
                  const sig = ensureSignatureHex(rawResult, `privySmartWallet.${args.method}`)
                  logNonEoaSignature(sig, `privySmartWallet.${args.method}`)
                  return sig
                }
                if (typeof client?.request === 'function') {
                  return await client.request(args)
                }
                throw new Error('Privy smart wallet client does not support request()')
              },
              signMessage: async (args: { account: Address; message: any }) => {
                const msg =
                  typeof args.message === 'object' && args.message !== null && 'raw' in args.message
                    ? args.message.raw
                    : args.message
                const client: any = smartWalletClient as any
                const account: any = client?.account
                const hasAccountSign = typeof account?.sign === 'function'
                const hasAccountSignMessage = typeof account?.signMessage === 'function'
                const hasClientSignMessage = typeof client?.signMessage === 'function'
                const hasSignMessage = hasAccountSignMessage || hasClientSignMessage
                const hasRequest = typeof client?.request === 'function'

                if (AA_DEBUG) {
                  logger.debug('[DeployVault] Privy smart wallet signer capabilities', {
                    hasAccountSign,
                    hasSignMessage,
                    hasRequest,
                  })
                }

                if (hasSignMessage) {
                  const context = hasAccountSignMessage
                    ? 'privySmartWallet.account.signMessage'
                    : 'privySmartWallet.signMessage'
                  // For UserOp signing we are typically signing a 32-byte digest (0x + 64 hex chars).
                  // Prefer the `{ raw }` form when supported so we sign bytes, not the string "0x...".
                  const rawMessage =
                    typeof msg === 'string' && /^0x[0-9a-fA-F]{64}$/.test(msg)
                      ? ({ raw: msg } as any)
                      : msg
                  const rawResult = await withTimeout(
                    (async () => {
                      try {
                        return hasAccountSignMessage
                          ? await account.signMessage({ message: rawMessage })
                          : await client.signMessage({ account: privySmartWalletAddress, message: rawMessage })
                      } catch {
                        // Fallback for SDKs that don't support `{ raw }` in signMessage.
                        return hasAccountSignMessage
                          ? await account.signMessage({ message: msg })
                          : await client.signMessage({ account: privySmartWalletAddress, message: msg })
                      }
                    })(),
                    20_000,
                    context,
                  )
                  const sig = ensureSignatureHex(rawResult, context)
                  logNonEoaSignature(sig, context)
                  debugSignatureReady(context, sig, { signer: privySmartWalletAddress })
                  return sig
                }

                throw new Error(
                  'Privy smart wallet signer not supported in this environment. ' +
                    'Reconnect your canonical Base Account session or use Base App prolink.',
                )
              },
              signTypedData: async (args: any) => {
                const client: any = smartWalletClient as any
                const account: any = client?.account
                if (typeof account?.signTypedData === 'function' || typeof client?.signTypedData === 'function') {
                  const context =
                    typeof account?.signTypedData === 'function'
                      ? 'privySmartWallet.account.signTypedData'
                      : 'privySmartWallet.signTypedData'
                  const rawResult = await withTimeout(
                    typeof account?.signTypedData === 'function'
                      ? account.signTypedData(args as any)
                      : client.signTypedData({ account: privySmartWalletAddress, ...(args as any) }),
                    20_000,
                    context,
                  )
                  const sig = ensureSignatureHex(rawResult, context)
                  logNonEoaSignature(sig, context)
                  debugSignatureReady(context, sig, { signer: privySmartWalletAddress })
                  return sig
                }
                throw new Error(
                  'Privy smart wallet signer not supported in this environment. ' +
                    'Reconnect your canonical Base Account session or use Base App prolink.',
                )
              },
            }

            try {
              const isStrictPhase1CoreSegment =
                strictNoEoaEnforced && phaseLabel === 'phase1' && (!opts?.segment || opts.segment === 'core')
              const contractOwnerVerificationGasProfile = isStrictPhase1CoreSegment
                ? [1_000_000n, 1_300_000n, 1_600_000n, 1_900_000n, 2_200_000n, 2_500_000n]
                : undefined
              if (contractOwnerVerificationGasProfile) {
                logger.info('[DeployVault] Applying low-total-gas verification profile', {
                  phaseLabel: logPhaseLabel,
                  verificationGasLimits: contractOwnerVerificationGasProfile.map((v) => v.toString()),
                })
              }
              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: smartWalletClientAdapter as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: privySmartWalletAddress,
                calls: toCalls(calls),
                version: '1',
                // Contract owners (EIP-1271) should default to signMessage/personal_sign.
                // Forcing eth_sign often produces non-EOA signatures and can trigger bundler rejections.
                userOpSignMode: 'auto',
                ownerIsContract: true,
                verificationGasLimits: contractOwnerVerificationGasProfile,
                retryWithLowGasContractSigner: false,
              })

              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'ERC-4337 (privy smart wallet owner)')
              return
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e ?? '')
              const lc = msg.toLowerCase()
              const isMissingPrimaryCall = lc.includes('missing_primary_call')
              const isPaymasterPolicyFailure =
                lc.includes('request denied -') ||
                lc.includes('paymaster rejected this request') ||
                lc.includes('requested resource not available') ||
                lc.includes('resource not available')
              const isVerificationGasFailure =
                lc.includes('aa40') ||
                lc.includes('signature verification used more gas') ||
                lc.includes('over verificationgaslimit') ||
                lc.includes('over verification gas limit')
              const failureClass =
                isMissingPrimaryCall
                  ? 'paymaster_primary_call_mismatch'
                  : lc.includes('sponsored userop exceeds paymaster total gas cap') ||
                      (lc.includes('total gas used by the user operation') && lc.includes('allowed limit'))
                    ? 'paymaster_total_gas_cap'
                  : lc.includes('total gas used by the user operation') || (lc.includes('total gas used') && lc.includes('allowed limit'))
                  ? 'paymaster_total_gas_cap'
                  : isVerificationGasFailure
                    ? 'verification_gas_limit'
                    : lc.includes('invalid signature') || lc.includes('signature check failed')
                      ? 'invalid_signature'
                      : lc.includes('invalid fields')
                        ? 'invalid_userop_fields'
                        : isPaymasterPolicyFailure
                          ? 'paymaster_policy_rejected'
                        : lc.includes('banned opcode') || lc.includes('stake/unstake delay') || lc.includes('unstake delay too low')
                          ? 'paymaster_stake_policy'
                          : 'unknown'
              const shouldFallback =
                !isMissingPrimaryCall &&
                !isPaymasterPolicyFailure &&
                (lc.includes('invalid signature') ||
                  lc.includes('signature check failed') ||
                  isVerificationGasFailure ||
                  lc.includes('invalid fields'))
              if (shouldFallback) {
                logger.warn('[DeployVault] Privy smart wallet signer failed; setup still required', {
                  phaseLabel: logPhaseLabel,
                  privySmartWalletAddress,
                  failureClass,
                  error: msg,
                })
                logger.warn('[DeployVault] fallback_blocked', {
                  deploy_mode: 'no_eoa_strict',
                  phaseLabel: logPhaseLabel,
                  failureClass,
                })
                throw new Error(
                  `ERC-4337 signing failed (${failureClass}). External-EOA fallback is disabled for deploy.`,
                )
              } else {
                throw e
              }
            }
          }
          
          // No additional signer fallback branches: keep deploy deterministic.
          // No valid ERC-4337 path available
          if (strictNoEoaEnforced) {
            throw new Error(NO_EOA_STRICT_BLOCKER)
          }
          throw new Error(
            'ERC-4337 deployment requires one of:\n' +
            '1. Connect with Coinbase Wallet (recommended)\n' +
            '2. Add your app smart wallet as an owner of your Zora wallet (EIP-1271)',
          )
        }

        if (!useServerContinue) {
          // Phase 1: Deploy core contracts (skip if already deployed)
          if (phase1Calls.length > 0) {
            setPhase('phase1')
            await sendPhaseCalls(phase1Calls, 'phase1')
            // Ensure Phase 1 is mined before Phase 2 preflight.
            await waitForContractsDeployed({
              publicClient: publicClient as any,
              addresses: [expected.vault, expected.wrapper, expected.shareOFT],
              label: 'Phase 1',
            })
          }

          // Phase 2: Launch + configure
          setPhase('phase2')
          if (phase2ApproveCalls.length > 0) {
            await sendPhaseCalls(phase2ApproveCalls, 'phase2', { noSplit: true, segment: 'approve' })
          }
        }

        // IMPORTANT: Keep a batcher call in the same sponsored UserOp.
        // The paymaster requires a "primary" call to `creatorVaultBatcher` / `vaultActivationBatcher`,
        // so we bundle finalize + post into one executeBatch to avoid `missing_primary_call`.

        if (useServerContinue) {
          let sessionId: string | null = null
          const cancelSession = async () => {
            if (!sessionId) return
            try {
              await postDeploySessionJson({
                url: '/api/deploy/v2/session/cancel',
                body: { sessionId },
                label: 'deploy session cancel',
              })
            } catch {
              // ignore cleanup failures
            }
          }
          const shouldCancelSessionAfterError = async (): Promise<boolean> => {
            if (!sessionId) return false
            try {
              const statusJson = await postDeploySessionJson<any>({
                url: '/api/deploy/v2/session/status',
                body: { sessionId },
                label: 'deploy session post-error status',
              })
              const step = String(statusJson.data?.step ?? '')
              // Preserve progressed sessions (phase*_sent / confirmed) so retries can resume.
              // Cancel only brand-new sessions that never sent a stage.
              return step === 'created'
            } catch {
              return false
            }
          }
          const postDeploySessionCreate = async (preflightOnly: boolean): Promise<ApiEnvelope<any>> => {
            const body: DeploySessionCreateRequest = preflightOnly
              ? { ...sessionCreatePayload, preflightOnly: true }
              : sessionCreatePayload
            return await postDeploySessionJson<any>({
              url: '/api/deploy/v2/session/create',
              body,
              label: preflightOnly ? 'deploy session preflight create' : 'deploy session create',
            })
          }

          try {
            // Preflight before creating a real session so ownership/auth mismatches
            // are caught early and we can retry once after re-bridging auth.
            await postDeploySessionCreate(true)

            // Create a deploy session for the canonical CSW sender.
            // After installation of the temporary owner, the server will submit all phases and then clean up.
            const createJson = await postDeploySessionCreate(false)
            sessionId = String(createJson.data?.sessionId ?? '').trim()
            const sessionOwnerRaw = String(createJson.data?.sessionSignerAddress ?? createJson.data?.sessionOwner ?? '').trim()
            if (!sessionId || !isAddress(sessionOwnerRaw)) throw new Error('Invalid deploy session response')
            const sessionOwner = getAddress(sessionOwnerRaw) as Address
            persistDeploySession(sessionId)

            // Install the deploy-session signer via canonical owner approval if needed.
            await ensureDeploySessionSignerInstalled(sessionOwner)

            // Kick off server continuation; status polling will advance remaining phases.
            await postDeploySessionJson({
              url: '/api/deploy/v2/session/resume',
              body: { sessionId },
              label: 'deploy session continue',
            })

            await pollServerDeploySession(sessionId)
            return null
          } catch (err) {
            if (await shouldCancelSessionAfterError()) {
              await cancelSession()
            }
            throw err
          }
        }

        if (phase2CoreNeeded) {
          await sendPhaseCalls([phase2CoreCall], 'phase2', { noSplit: true, segment: 'core' })
          await waitForContractsDeployed({
            publicClient: publicClient as any,
            addresses: [expected.gaugeController, expected.ccaStrategy, expected.oracle],
            label: 'Phase 2 core',
          })
        } else {
          logger.info('[DeployVault] phase2.core skipped (already deployed)', {
            expectedGauge: expected.gaugeController,
            expectedCca: expected.ccaStrategy,
            expectedOracle: expected.oracle,
          })
        }
        await sendPhaseCalls(phase2FinalizeCalls, 'phase2', { noSplit: true, segment: 'finalize' })

        // Phase 3: Strategies (optional)
        if (phase3Calls.length > 0) {
          setPhase('phase3')
          await sendPhaseCalls(phase3Calls, 'phase3')
        }
        if (phase4Calls.length > 0) {
          const phase4BaseSalt = deriveBaseSalt({
            creatorToken,
            owner,
            chainId: base.id,
            version: deployVersion,
          })
          try {
            const pending = (await publicClient.readContract({
              address: batcherAddress,
              abi: CREATOR_VAULT_BATCHER_PENDING_AUCTION_ABI,
              functionName: 'pendingAuctions',
              args: [phase4BaseSalt],
            })) as any
            const pendingAmount = BigInt(pending?.amount ?? pending?.[2] ?? 0n)
            const pendingShare = (pending?.shareOFT ?? pending?.[0] ?? ZERO_ADDRESS) as Address
            if (pendingAmount <= 0n || getAddress(pendingShare) !== getAddress(expected.shareOFT)) {
              throw new Error(
                `No pending deferred auction for ${deploymentVersion} (share=${shortAddress(expected.shareOFT)}). ` +
                  'Phase 4 launch is blocked until phase2 finalize records pending auction state.',
              )
            }
          } catch (pendingErr) {
            const msg = pendingErr instanceof Error ? pendingErr.message : String(pendingErr)
            throw new Error(`Phase 4 precheck failed: ${msg}`)
          }
          try {
            await publicClient.readContract({
              address: expected.ccaStrategy,
              abi: CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI,
              functionName: 'previewLaunchPricing',
            })
          } catch (pricingErr) {
            const raw = pricingErr instanceof Error ? pricingErr.message : String(pricingErr ?? '')
            throw new Error(
              `Phase 4 pricing precheck failed: ${raw}. ` +
                'Launch floor is enforced onchain from oracle data; refresh oracle state before launching auction.',
            )
          }
          setPhase('phase4')
          await sendPhaseCalls(phase4Calls, 'phase4')
        }

        setPhase('done')
        logger.info('[DeployVault] deploy_success', { creatorToken, owner, deploymentVersion })
        onSuccess(expected)
        return null
      }
    } catch (e: any) {
      if (planOnly) throw e
      const rawMsg = e instanceof Error ? e.message : String(e ?? '')
      
      // Check if a transaction was actually submitted despite the error
      const submittedMatch = rawMsg.match(/Submitted:\s*(0x[a-fA-F0-9]{64})/)
      if (submittedMatch && publicClient) {
        const txHash = submittedMatch[1] as Hex
        logger.warn('[DeployVault] Transaction submitted despite error', { txHash, rawMsg })
        
        // Try to wait for the transaction receipt
        try {
          const receipt = await (publicClient as any).waitForTransactionReceipt({ 
            hash: txHash,
            timeout: 60_000 
          })
          if (receipt.status === 'success') {
            // Transaction succeeded! Update state
            setTxId(txHash)
            setPhaseTxs((s) => ({
              ...s,
              [
                phase === 'phase1'
                  ? 'tx1'
                  : phase === 'phase2'
                    ? 'tx2'
                    : phase === 'phase3'
                      ? 'tx3'
                      : 'tx4'
              ]: txHash,
            }))
            logger.info('[DeployVault] tx_confirmed_after_error; continuing deploy flow', {
              txHash,
              phase,
              useServerContinue,
            })
            if (useServerContinue) {
              const activeSessionId = loadDeploySession()
              if (activeSessionId) {
                await pollServerDeploySession(activeSessionId)
                return null
              }
            }
            throw new Error(
              `A ${phase.toUpperCase()} transaction was submitted and confirmed, but deploy completion could not be verified. ` +
                'Click Deploy again to continue from the latest confirmed phase.',
            )
          }
        } catch (receiptError) {
          logger.warn('[DeployVault] Failed to get receipt for submitted tx', { txHash, error: receiptError })
        }
      }
      
      let pretty = formatDeployError(e)
      const isUserRejected =
        rawMsg.toLowerCase().includes('user rejected') ||
        rawMsg.toLowerCase().includes('rejected the request') ||
        rawMsg.toLowerCase().includes('action_rejected') ||
        rawMsg.toLowerCase().includes('user denied') ||
        rawMsg.toLowerCase().includes('user cancelled')
      if (isUserRejected) logger.info('[DeployVault] deploy_cancelled_by_user', { error: pretty })
      else logger.warn('[DeployVault] deploy_failed', { error: pretty })
      setError(pretty)
    } finally {
      if (!planOnly) setBusy(false)
    }
    return null
  }

  const exportPlan = async () => {
    if (busy || exportBusy || dryRunBusy) return
    setExportBusy(true)
    setExportStatus(null)
    setError(null)
    try {
      const plan = await submit({ planOnly: true, validateDepositBalance: true })
      if (!plan) throw new Error('Could not prepare deployment plan.')
      if (typeof window === 'undefined') throw new Error('Plan export is only available in a browser session.')

      const tokenSuffix = String(creatorToken).slice(2, 8).toLowerCase()
      const ts = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)
      const filename = `deploy-plan-${tokenSuffix}-${ts}.json`
      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
      setExportStatus(`Exported ${filename}`)
    } catch (e) {
      setError(formatDeployError(e))
    } finally {
      setExportBusy(false)
    }
  }

  const runDryRun = async () => {
    if (busy || exportBusy || dryRunBusy) return
    setDryRunBusy(true)
    setDryRunResult(null)
    setDryRunError(null)
    setError(null)
    try {
      const plan = await submit({ planOnly: true })
      if (!plan) throw new Error('Could not prepare deployment plan.')

      const json = await postDeploySessionJson<DeploySessionDryRunResponse>({
        url: '/api/deploy/v2/session/dry-run',
        body: plan.sessionCreateRequest,
        label: 'deploy session dry-run',
      })
      const normalized = normalizeDryRunResponse(json.data)
      if (!normalized) throw new Error('Dry-run failed (invalid response)')
      setDryRunResult(normalized)
      return
    } catch (e) {
      setDryRunError(formatDeployError(e))
    } finally {
      setDryRunBusy(false)
    }
  }

  const expectedError = expectedQuery.isError
    ? ((expectedQuery.error as any)?.message || 'Failed to compute deployment addresses.')
    : null
  const vanityCustomPaidNotice =
    vaultVanityIsCustom || shareVanityIsCustom
      ? `Custom vanity requested (paid):${
          vaultVanityIsCustom ? ` vault prefix 0x${vaultVanityPrefix}` : ''
        }${
          shareVanityIsCustom ? `${vaultVanityIsCustom ? ',' : ''} share suffix ${shareOftVanitySuffix}` : ''
        }`
      : null
  const vanityDefaultNotice =
    !vanityCustomPaidNotice && (vaultVanityPrefix || shareOftVanitySuffix)
      ? `Default vanity targets: vault 0x${DEFAULT_VAULT_VANITY_PREFIX}, share ${DEFAULT_SHARE_OFT_VANITY_SUFFIX} (best-effort).`
      : null

  const disabledReason =
    busy
      ? 'Deployment in progress…'
      : expectedQuery.isLoading
        ? 'Computing deployment addresses…'
        : !expected
          ? expectedError || 'Deployment addresses are not ready.'
          : null

  const disabled = Boolean(disabledReason)
  const hasPrivyEmbeddedOwnerSigner = privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign
  const hasPrivySmartWalletOwnerSigner = privySmartWalletIsCanonicalOwner && privySmartWalletCanSign
  const hasDeploySignerPath = strictNoEoaEnforced
    ? hasPrivyEmbeddedOwnerSigner || hasPrivySmartWalletOwnerSigner
    : isCoinbaseWalletDirect || connectedEoaOwnerReady || hasPrivyEmbeddedOwnerSigner || hasPrivySmartWalletOwnerSigner
  const ovaultMeshEnabledForSession =
    DEFAULT_SOLANA_OVAULT_MESH_ENABLED ||
    seenOvaultMeshStep ||
    lastSessionStep.startsWith('ovault_mesh') ||
    ovaultMeshStatus !== null ||
    String(deploymentVersion).toLowerCase().includes('ovault')
  const isTimelineStageEnabled = useCallback(
    (stage: DeployTimelineStageId) => (stage === 'phase2bOvaultMesh' ? ovaultMeshEnabledForSession : true),
    [ovaultMeshEnabledForSession],
  )
  const timelineCurrentStage = useMemo<DeployTimelineStageId | null>(() => {
    if (phase === 'done') return 'cleanup'
    if (lastSessionStep) return timelineStageFromDeployStep(lastSessionStep)
    if (phase === 'phase1') return 'phase1Core'
    if (phase === 'phase2') return 'phase2Core'
    if (phase === 'phase3') return 'phase3Strategies'
    if (phase === 'phase4') return 'phase4Launch'
    if (busy) return 'setupOwnerApproval'
    return null
  }, [busy, lastSessionStep, phase])
  const timelineCurrentStageMeta = useMemo<DeployTimelineStage | null>(() => {
    if (!timelineCurrentStage) return null
    return DEPLOY_TIMELINE_STAGES.find((stage) => stage.id === timelineCurrentStage) ?? null
  }, [timelineCurrentStage])
  const workflowStatus = useMemo(() => {
    if (phase === 'done') {
      return {
        label: 'Completed',
        detail: 'All deploy phases and cleanup are confirmed on-chain.',
      }
    }
    if (timelineCurrentStageMeta) {
      return {
        label: busy ? 'In progress' : 'Awaiting continue tick',
        detail: `${timelineCurrentStageMeta.label}${lastSessionStep ? ` (${lastSessionStep})` : ''}`,
      }
    }
    if (busy) {
      return {
        label: 'Preparing',
        detail: 'Building deploy calls and validating preflight requirements.',
      }
    }
    return {
      label: 'Ready',
      detail: 'Waiting for deploy start.',
    }
  }, [busy, lastSessionStep, phase, timelineCurrentStageMeta])
  const workflowStatusToneClass = useMemo(() => {
    if (phase === 'done') return 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
    if (busy) return 'border-blue-400/35 bg-blue-500/10 text-blue-200'
    return 'border-zinc-600 bg-zinc-800/70 text-zinc-200'
  }, [busy, phase])
  const timelineProgressState = useCallback(
    (stage: DeployTimelineStageId): 'disabled' | 'inProgress' | 'done' | 'pending' => {
      return deriveDeployTimelineProgressState({
        stage,
        timelineCurrentStage,
        isDone: phase === 'done',
        isStageEnabled: isTimelineStageEnabled,
        stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
      })
    },
    [isTimelineStageEnabled, phase, timelineCurrentStage],
  )
  const timelineProgressText = useCallback(
    (stage: DeployTimelineStageId) => deployTimelineProgressLabel(timelineProgressState(stage)),
    [timelineProgressState],
  )
  const timelineProgressTone = useCallback(
    (stage: DeployTimelineStageId) => {
      const state = timelineProgressState(stage)
      if (state === 'disabled') return 'text-zinc-600'
      if (state === 'inProgress') return 'text-zinc-100'
      if (state === 'done') return 'text-zinc-300'
      return phase === 'idle' ? 'text-zinc-500' : 'text-zinc-600'
    },
    [phase, timelineProgressState],
  )
  const timelineProgressChipTone = useCallback(
    (stage: DeployTimelineStageId) => {
      const state = timelineProgressState(stage)
      if (state === 'disabled') return 'border-zinc-700 bg-zinc-900 text-zinc-500'
      if (state === 'inProgress') return 'border-blue-400/35 bg-blue-500/15 text-blue-200'
      if (state === 'done') return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
      return 'border-zinc-700 bg-zinc-900 text-zinc-400'
    },
    [timelineProgressState],
  )
  const timelineStageRowTone = useCallback(
    (stage: DeployTimelineStageId) => {
      const state = timelineProgressState(stage)
      if (state === 'disabled') return 'border-white/6 bg-black/5'
      if (state === 'inProgress') return 'border-blue-400/25 bg-blue-500/8'
      if (state === 'done') return 'border-emerald-400/20 bg-emerald-500/6'
      return 'border-white/8 bg-black/10'
    },
    [timelineProgressState],
  )
  const timelineCompletionSummary = useMemo(() => {
    const { completedEnabledStageCount, enabledStageCount } = summarizeDeployTimelineProgress({
      stages: DEPLOY_TIMELINE_STAGES,
      isStageEnabled: isTimelineStageEnabled,
      stateForStage: timelineProgressState,
    })
    return `${completedEnabledStageCount}/${enabledStageCount} enabled stages completed`
  }, [isTimelineStageEnabled, timelineProgressState])
  const timelinePendingCount = useMemo(() => {
    const { pendingStageCount } = summarizeDeployTimelineProgress({
      stages: DEPLOY_TIMELINE_STAGES,
      isStageEnabled: isTimelineStageEnabled,
      stateForStage: timelineProgressState,
    })
    return pendingStageCount
  }, [isTimelineStageEnabled, timelineProgressState])
  const timelineRemainingText = timelinePendingCount > 0 ? `${timelinePendingCount} remaining` : 'No stages remaining'
  const renderStageDetailStatus = useCallback(
    (stage: DeployTimelineStageId) => {
      const state = timelineProgressState(stage)
      if (state === 'pending') return null
      return <div className="text-zinc-700">{deployTimelineProgressLabel(state)}</div>
    },
    [timelineProgressState],
  )

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-zinc-400 leading-relaxed">
        {useServerContinue ? (
          <>
            Approve <span className="text-zinc-200">one</span> setup transaction. Then the server runs Phases 1–4 and removes the
            temporary owner.
          </>
        ) : (
          <>
            One click runs <span className="text-zinc-200">up to 4</span> onchain operations (Phases 1–4) through your smart wallet.
          </>
        )}
      </div>
      {authIsStale ? (
        <div className="text-[11px] text-amber-300/70">
          You’re signed in from an earlier session. Clicking deploy will submit transactions immediately.
        </div>
      ) : null}
      {vanityCustomPaidNotice ? (
        <div className="text-[11px] text-zinc-500">{vanityCustomPaidNotice}</div>
      ) : null}
      {vanityDefaultNotice ? (
        <div className="text-[11px] text-zinc-600">{vanityDefaultNotice}</div>
      ) : null}
      {expectedShareOftVanityWarning ? (
        <div className="text-[11px] text-amber-300/80">{expectedShareOftVanityWarning}</div>
      ) : null}

      <details className="vault-surface-muted group rounded-lg">
        <summary className="cursor-pointer select-none list-none px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500">Deployment plan</div>
            <div className="text-[12px] text-zinc-200 truncate">Canonical stage timeline · deterministic contract plan on Base</div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 sm:px-6 pb-5 pt-2">
          <div className="text-[11px] text-zinc-600 mb-3">
            Contract addresses are deterministic on Base. BaseScan links appear once each contract is live.
          </div>
          <div className="rounded-md border border-white/10 bg-white/4 px-4 py-3 mb-3 space-y-2 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 text-[11px]">
              <div className="text-zinc-500">Workflow status</div>
              <div className="text-right min-w-0">
                <div
                  className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium mb-1 ${workflowStatusToneClass}`}
                >
                  {workflowStatus.label}
                </div>
                <div className="text-zinc-500 leading-relaxed break-words">{workflowStatus.detail}</div>
              </div>
            </div>
            <div className="h-px bg-white/8" />
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <div className="text-zinc-500">Initial deposit</div>
              <div className="font-mono text-zinc-200/90">
                {formatDeposit(minFirstDeposit)} {depositSymbol}
              </div>
            </div>
            <AddressRow label="Active batcher" address={batcherAddress} />
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <div className="text-zinc-500">Deploy mode</div>
              <div className="font-mono text-zinc-200/90">{strictNoEoaEnforced ? 'no_eoa_strict' : 'default'}</div>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-white/4 px-4 py-3 mb-3 space-y-2 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-medium text-zinc-500">Canonical stage timeline</div>
              <div className="text-right text-[10px] leading-relaxed">
                <div className="text-zinc-400">{timelineCompletionSummary}</div>
                <div className="text-zinc-600">{timelineRemainingText}</div>
              </div>
            </div>
            {DEPLOY_TIMELINE_STAGES.map((stage) => (
              <div
                key={stage.id}
                className={`rounded-md border px-3 py-2 flex items-start justify-between gap-3 text-[11px] ${timelineStageRowTone(stage.id)}`}
              >
                <div className={timelineProgressTone(stage.id)}>
                  <div className="font-medium">{stage.label}</div>
                  <div className="text-[10px] text-zinc-600">{stage.description}</div>
                </div>
                <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${timelineProgressChipTone(stage.id)}`}>
                  {timelineProgressText(stage.id)}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-white/10 bg-white/4 divide-y divide-white/8 backdrop-blur-sm">
            <div className="px-4 py-4">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 1</div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase1Core')}>Deploy vault core (vault, wrapper, share token)</div>
                {href1 ? (
                  <a className="font-mono text-zinc-300 hover:text-white" href={href1} target="_blank" rel="noreferrer">
                    view tx
                  </a>
                ) : (
                  renderStageDetailStatus('phase1Core')
                )}
              </div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase1Finalize')}>Finalize phase-1 state</div>
                {renderStageDetailStatus('phase1Finalize')}
              </div>
              <div className="space-y-2">
                <AddressRow label="Vault" address={expected?.vault} deployed={expectedAddressDeployment?.vault ?? null} />
                <AddressRow label="Wrapper" address={expected?.wrapper} deployed={expectedAddressDeployment?.wrapper ?? null} />
                <AddressRow label="Share token" address={expected?.shareOFT} deployed={expectedAddressDeployment?.shareOFT ?? null} />
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 2</div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase2Core')}>Deploy gauge/CCA/oracle core</div>
                {href2 ? (
                  <a className="font-mono text-zinc-300 hover:text-white" href={href2} target="_blank" rel="noreferrer">
                    view tx
                  </a>
                ) : (
                  renderStageDetailStatus('phase2Core')
                )}
              </div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase2Finalize')}>Finalize + configure payout and ownership routing</div>
                {renderStageDetailStatus('phase2Finalize')}
              </div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase2bOvaultMesh')}>OVault mesh preflight + peer wiring</div>
                {renderStageDetailStatus('phase2bOvaultMesh')}
              </div>
              {ovaultMeshEnabledForSession ? (
                <div className="rounded-md border border-white/10 bg-black/10 px-3 py-3 mb-3 space-y-2">
                  <div className="text-[10px] font-medium text-zinc-500">Solana token lanes</div>
                  <div className="flex items-center justify-between gap-4 text-[11px]">
                    <div className="text-zinc-500">Solana wrapped asset mint (Base/Solana bridge)</div>
                    <div className="font-mono text-zinc-200/90">
                      {String(depositSymbol ?? '').trim() ? String(depositSymbol).trim().toLowerCase() : '$asset'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[11px]">
                    <div className="text-zinc-500">Solana share token lane (LayerZero ShareOFT)</div>
                    <div className="font-mono text-zinc-200/90">
                      {String(shareSymbol ?? '').trim() ? String(shareSymbol).trim() : '■ASSET'}
                    </div>
                  </div>
                  {ovaultMeshStatus ? (
                    <>
                      <div className="h-px bg-white/10" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        <div className={ovaultMeshStatus.existingMintCompatible ? 'text-emerald-300/80' : 'text-amber-300/90'}>
                          Asset mint compatibility: {ovaultMeshStatus.existingMintCompatible ? 'ready' : 'needs attention'}
                        </div>
                        <div className={ovaultMeshStatus.depositEligible ? 'text-emerald-300/80' : 'text-amber-300/90'}>
                          Deposit compose route: {ovaultMeshStatus.depositEligible ? 'ready' : 'blocked'}
                        </div>
                        <div className={ovaultMeshStatus.redeemEligible ? 'text-emerald-300/80' : 'text-amber-300/90'}>
                          Redeem compose route: {ovaultMeshStatus.redeemEligible ? 'ready' : 'blocked'}
                        </div>
                        <div className={ovaultMeshStatus.assetPeerSet ? 'text-emerald-300/80' : 'text-amber-300/90'}>
                          Asset peer wiring: {ovaultMeshStatus.assetPeerSet ? 'ready' : 'missing'}
                        </div>
                        <div className={ovaultMeshStatus.sharePeerSet ? 'text-emerald-300/80' : 'text-amber-300/90'}>
                          Share peer wiring: {ovaultMeshStatus.sharePeerSet ? 'ready' : 'missing'}
                        </div>
                        <div className="text-zinc-500">
                          Mesh step: <span className="font-mono text-zinc-300/90">{ovaultMeshStatus.meshStep ?? 'pending'}</span>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-md border border-white/8 bg-black/5 px-3 py-2 mb-3 text-[10px] text-zinc-600">
                  OVault mesh lane is disabled for this deployment profile.
                </div>
              )}
              <div className="space-y-2">
                <AddressRow
                  label="Gauge controller"
                  address={expected?.gaugeController}
                  deployed={expectedAddressDeployment?.gaugeController ?? null}
                />
                <AddressRow
                  label="CCA strategy"
                  address={expected?.ccaStrategy}
                  deployed={expectedAddressDeployment?.ccaStrategy ?? null}
                />
                <AddressRow
                  label="Oracle"
                  address={expected?.oracle}
                  deployed={expectedAddressDeployment?.oracle ?? null}
                />
                <AddressRow
                  label="Burn stream"
                  address={expected?.burnStream}
                  deployed={expectedAddressDeployment?.burnStream ?? null}
                />
                <AddressRow
                  label="Payout router"
                  address={expected?.payoutRouter}
                  deployed={expectedAddressDeployment?.payoutRouter ?? null}
                />
                <AddressRow
                  label="Creator coin policy controller"
                  address={expected?.creatorCoinPolicyController}
                  deployed={expectedAddressDeployment?.creatorCoinPolicyController ?? null}
                />
                <AddressRow label="Creator coin payout recipient" address={currentPayoutRecipient} />
              </div>
              {payoutMismatch ? (
                <div className="mt-2 text-[11px] text-amber-300/80">
                  Creator coin payout recipient will update to{' '}
                  <span className="font-mono text-amber-200">
                    {expectedPayoutRouter ? shortAddress(expectedPayoutRouter) : 'the configured payout router'}
                  </span>{' '}
                  during deploy. Continue only if this is intended.
                </div>
              ) : null}
            </div>

            <div className="px-4 py-4">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 3</div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase3Strategies')}>Deploy + register strategies (Charm, Ajna, Solana)</div>
                {href3 ? (
                  <a className="font-mono text-zinc-300 hover:text-white" href={href3} target="_blank" rel="noreferrer">
                    view tx
                  </a>
                ) : (
                  renderStageDetailStatus('phase3Strategies')
                )}
              </div>
              <div className="space-y-2">
                <AddressRow
                  label="Uniswap v3 pool (CREATOR/USDC)"
                  address={phase3Expected?.v3Pool}
                  deployed={phase3ExpectedAddressDeployment?.v3Pool ?? null}
                />
                <AddressRow
                  label="Charm alpha vault"
                  address={phase3Expected?.charmVault}
                  deployed={phase3ExpectedAddressDeployment?.charmVault ?? null}
                />
                <AddressRow
                  label="CreatorCharmStrategy"
                  address={phase3Expected?.creatorCharmStrategy}
                  deployed={phase3ExpectedAddressDeployment?.creatorCharmStrategy ?? null}
                />
                <AddressRow label="Ajna pool" address={phase3Expected?.ajnaPool} deployed={phase3ExpectedAddressDeployment?.ajnaPool ?? null} />
                <AddressRow
                  label="AjnaVaultAuth"
                  address={phase3Expected?.ajnaVaultAuth}
                  deployed={phase3ExpectedAddressDeployment?.ajnaVaultAuth ?? null}
                />
                <AddressRow
                  label="AjnaERC4626Vault"
                  address={phase3Expected?.ajnaVault}
                  deployed={phase3ExpectedAddressDeployment?.ajnaVault ?? null}
                />
                <AddressRow
                  label="ERC4626StrategyAdapter"
                  address={phase3Expected?.erc4626StrategyAdapter}
                  deployed={phase3ExpectedAddressDeployment?.erc4626StrategyAdapter ?? null}
                />
                <AddressRow
                  label="SolanaStrategy"
                  address={phase3Expected?.solanaStrategy}
                  deployed={phase3ExpectedAddressDeployment?.solanaStrategy ?? null}
                />
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                Phase-3 addresses are projected from current factory state and CREATE2 salts.
              </div>
              {phase3LikelyMissingHelperConfig ? (
                <div className="mt-1 text-[11px] text-amber-300/80">
                  Some Phase-3 predicted addresses require batcher helper/runtime config that is unavailable on the
                  current deployment batcher, so they remain hidden until runtime config is complete in the server
                  deploy runtime config source (`/api/deploy/config`).
                </div>
              ) : null}
            </div>

            <div className="px-4 py-4">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 4</div>
              <div className="flex items-center justify-between gap-4 text-[11px] mb-3">
                <div className={timelineProgressTone('phase4Launch')}>Launch deferred auction</div>
                {href4 ? (
                  <a className="font-mono text-zinc-300 hover:text-white" href={href4} target="_blank" rel="noreferrer">
                    view tx
                  </a>
                ) : (
                  renderStageDetailStatus('phase4Launch')
                )}
              </div>
              <div className="space-y-2">
                <AddressRow label="Deferred auction" address={phase4AuctionAddress} deployed={phase4AuctionDeployment} />
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                Auction address appears after Phase 4 writes CCA auction state.
              </div>
              {marketFloorText ? (
                <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
                  <div className="text-zinc-500">CCA floor (reference)</div>
                  <div className="text-zinc-300">{marketFloorText}</div>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
                <div className={timelineProgressTone('cleanup')}>Cleanup temporary deploy signer</div>
                {renderStageDetailStatus('cleanup')}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || exportBusy || dryRunBusy || expectedQuery.isLoading || !expected}
                onClick={() => void exportPlan()}
              >
                {exportBusy ? 'Preparing plan…' : 'Export Plan JSON'}
              </button>
              {dryRunLocalForkRpc ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || exportBusy || dryRunBusy || expectedQuery.isLoading || !expected}
                  onClick={() => void runDryRun()}
                >
                  {dryRunBusy ? 'Running dry-run…' : 'Run dry-run'}
                </button>
              ) : (
                <div className="text-[11px] text-zinc-500">
                  Dry-run is local-fork-only. Start local mode with{' '}
                  <span className="font-mono text-zinc-300">pnpm run dev:deploy-dry-run</span>.
                </div>
              )}
            </div>
            {exportStatus ? <div className="text-[11px] text-zinc-500">{exportStatus}</div> : null}
          </div>
          {dryRunError ? (
            <div className="mt-2 space-y-2">
              <div className="text-[11px] text-amber-300/80">{dryRunError}</div>
              {isVanityPaidFeatureError(dryRunError) ? (
                <Link to={creatorStrategyFeaturesHref} className="inline-flex text-[11px] text-blue-300 hover:text-blue-200">
                  Activate vanity feature access
                </Link>
              ) : null}
            </div>
          ) : null}
          {dryRunResult ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/4 p-3 space-y-2 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-medium text-zinc-500">Dry run</div>
                <div className={dryRunResult.ok ? 'text-[11px] text-green-400/80' : 'text-[11px] text-amber-300/80'}>
                  {dryRunResult.ok ? `Pass on ${dryRunResult.forkMode} fork` : `Fail on ${dryRunResult.forkMode} fork`}
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                {(Array.isArray(dryRunResult.phases) ? dryRunResult.phases : []).map((phaseEntry) => (
                  <div key={phaseEntry.name} className="flex items-center justify-between gap-3">
                    <div className="text-zinc-400">{DRY_RUN_PHASE_LABELS[phaseEntry.name] ?? phaseEntry.name}</div>
                    <div className={phaseEntry.status === 'passed' ? 'text-green-400/80' : 'text-amber-300/80'}>
                      {phaseEntry.status === 'passed'
                        ? `passed (${phaseEntry.callCount} call${phaseEntry.callCount === 1 ? '' : 's'})`
                        : `failed after ${phaseEntry.callCount} call${phaseEntry.callCount === 1 ? '' : 's'}`}
                    </div>
                  </div>
                ))}
              </div>
              {dryRunResult.failure ? (
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  First failure: <span className="text-zinc-200">{dryRunResult.failure.phase}</span> call{' '}
                  <span className="font-mono text-zinc-200">{dryRunResult.failure.callIndex + 1}</span> to{' '}
                  <span className="font-mono text-zinc-200">{shortAddress(dryRunResult.failure.to)}</span>.
                  <div className="mt-1 text-amber-300/80">{dryRunResult.failure.error}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      <div className="vault-surface-muted rounded-lg p-5 sm:p-6 space-y-2">
        <div className="text-[11px] text-zinc-400">
          Deploy runs as <span className="text-white">ERC‑4337 UserOperations</span> from{' '}
          <span className="font-mono text-zinc-200">{shortAddress(owner)}</span>.
        </div>
        {typeof smartWalletTokenBalance === 'bigint' ? (
          <div className="text-[11px] text-zinc-500">
            Smart wallet balance: <span className="text-zinc-200 font-mono">{formatDeposit(smartWalletTokenBalance)}</span> {depositSymbol}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-600">Checking smart wallet balance…</div>
        )}
      </div>

      {runtimeBatcherConfigError && !runtimeBatcherWarningDismissed ? (
        <div className="rounded-lg border border-amber-500/35 bg-linear-to-b from-amber-500/16 to-amber-500/9 p-3 space-y-1 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-medium text-amber-200">Deploy runtime warning</div>
            <button
              type="button"
              className="text-[10px] text-amber-200/80 hover:text-amber-100 underline underline-offset-2"
              onClick={dismissRuntimeBatcherWarning}
            >
              Dismiss
            </button>
          </div>
          <div className="text-[11px] text-amber-200/80 leading-relaxed whitespace-pre-wrap">
            {runtimeBatcherConfigError}
          </div>
        </div>
      ) : null}

      {/* Show deploy button only if we have a valid ERC-4337 path */}
      {hasDeploySignerPath ? (
        <div className="space-y-2">
          <div className="text-[10px] text-green-400/80 flex items-center gap-1">
            <span>✓</span>{' '}
            {strictNoEoaEnforced
              ? hasPrivyEmbeddedOwnerSigner
                ? 'Gas-free ERC-4337 via preconfigured owner signer'
                : 'Gas-free ERC-4337 via preconfigured app smart wallet owner'
              : `Gas-free ERC-4337 ${
                  isCoinbaseWalletDirect
                    ? 'via Coinbase Wallet'
                    : connectedEoaOwnerReady
                      ? 'via connected signer'
                      : hasPrivyEmbeddedOwnerSigner
                        ? 'via preconfigured owner signer'
                        : 'via app smart wallet owner'
                }`}
          </div>
          <button type="button" onClick={() => void submit()} disabled={disabled || exportBusy} className="btn-primary w-full rounded-lg">
            {busy ? 'Deploying…' : '1‑Click Deploy (Gas-Free)'}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/35 bg-linear-to-b from-amber-500/16 to-amber-500/9 p-4 space-y-3 backdrop-blur-sm">
          <div className="text-sm font-medium text-amber-200">
            {strictNoEoaEnforced ? 'No-EOA deploy requirements' : 'ERC-4337 Setup Required'}
          </div>
          {strictNoEoaEnforced ? (
            <div className="text-[11px] text-amber-200/70 leading-relaxed">{NO_EOA_STRICT_BLOCKER}</div>
          ) : (
            <>
              <div className="text-[11px] text-amber-200/70 leading-relaxed">
                All deployments use gas-sponsored ERC-4337 UserOperations.
              </div>
              <div className="text-[11px] text-zinc-400 space-y-1">
                <div>Option 1: Connect with <strong className="text-amber-200">Coinbase Wallet</strong> (instant)</div>
                <div>Option 2: Add your app smart wallet as owner (EIP-1271 setup below)</div>
              </div>
            </>
          )}
        </div>
      )}

      {disabledReason && !busy ? (
        <div className="text-[11px] text-amber-300/80">{disabledReason}</div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <div className="text-[11px] text-red-400/90 whitespace-pre-wrap">
            {/* If error contains a transaction hash, make it clickable */}
            {error.includes('0x') && error.match(/0x[a-fA-F0-9]{64}/) ? (
              <>
                {error.split(/(0x[a-fA-F0-9]{64})/).map((part, i) => 
                  /^0x[a-fA-F0-9]{64}$/.test(part) ? (
                    <a 
                      key={i}
                      href={`https://basescan.org/tx/${part}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline font-mono"
                    >
                      {part.slice(0, 10)}...{part.slice(-8)}
                    </a>
                  ) : part
                )}
              </>
            ) : error}
          </div>
          {/* Only show auth-switch CTA for auth/session issues (not for signing-method incompatibility). */}
          {switchAuthCta && /no_session|not authenticated|gas sponsorship requires a session|base account|email|privy|smart wallet/i.test(error) ? (
            <button type="button" className="btn-primary w-full" onClick={switchAuthCta.onClick}>
              {switchAuthCta.label}
            </button>
          ) : null}
          {isVanityPaidFeatureError(error) ? (
            <Link to={creatorStrategyFeaturesHref} className="inline-flex text-[11px] text-blue-300 hover:text-blue-200">
              Activate vanity feature access
            </Link>
          ) : null}
          {isProviderCollisionErrorMessage(error) ? (
            <div className="text-[11px] text-amber-300/80">
              Wallet extension collision detected around `window.ethereum`. Keep only one EVM wallet extension enabled
              in this browser profile (or use Coinbase Wallet / Privy sign-in), then retry.
            </div>
          ) : null}
        </div>
      ) : null}
      {txId ? (
        <div className="text-[11px] text-zinc-500">
          Submitted: <span className="font-mono text-zinc-300 break-all">{txId}</span>
        </div>
      ) : null}
    </div>
  )
}

function DeployVaultMain() {
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { ready: privyReady, authenticated: privyAuthenticated, user: privyUser, logout, getAccessToken } = usePrivy() as any
  const { login } = useLogin()
  const { connectors: wagmiConnectors, connectAsync: wagmiConnectAsync } = useConnect()
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const siwe = useSiweAuth()
  // State for adding Privy app smart wallet as owner (EIP-1271 signer)
  const [addPrivySmartWalletOwnerBusy, setAddPrivySmartWalletOwnerBusy] = useState(false)
  const [addPrivySmartWalletOwnerTxHash, setAddPrivySmartWalletOwnerTxHash] = useState<string | null>(null)
  const [addPrivySmartWalletOwnerError, setAddPrivySmartWalletOwnerError] = useState<string | null>(null)
  const [externalWalletConnectBusy, setExternalWalletConnectBusy] = useState(false)
  const [externalWalletConnectError, setExternalWalletConnectError] = useState<string | null>(null)
  const [autoSmartWalletOwnerAttemptCount, setAutoSmartWalletOwnerAttemptCount] = useState(0)
  const [autoSmartWalletOwnerRetryTick, setAutoSmartWalletOwnerRetryTick] = useState(0)
  const autoSmartWalletOwnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSmartWalletOwnerAttemptKeyRef = useRef<string | null>(null)
  const privyCrossAppLinkedAccounts = useMemo(() => {
    const linked = Array.isArray(privyUser?.linkedAccounts)
      ? (privyUser.linkedAccounts as any[])
      : Array.isArray((privyUser as any)?.linked_accounts)
        ? ((privyUser as any).linked_accounts as any[])
        : []
    return linked.filter((a: any) => String(a?.type ?? '').trim().toLowerCase() === 'cross_app')
  }, [privyUser])

  const privyCrossAppSmartWalletAddress = useMemo(() => {
    for (const account of privyCrossAppLinkedAccounts) {
      const wallets = Array.isArray((account as any)?.smart_wallets)
        ? ((account as any).smart_wallets as any[])
        : Array.isArray((account as any)?.smartWallets)
          ? ((account as any).smartWallets as any[])
          : []
      for (const wallet of wallets) {
        const raw = typeof wallet?.address === 'string' ? String(wallet.address) : ''
        if (!raw || !isAddress(raw)) continue
        return getAddress(raw) as Address
      }
    }
    return null
  }, [privyCrossAppLinkedAccounts])

  const privyCrossAppEmbeddedEoaAddress = useMemo(() => {
    for (const account of privyCrossAppLinkedAccounts) {
      const wallets = Array.isArray((account as any)?.embedded_wallets)
        ? ((account as any).embedded_wallets as any[])
        : Array.isArray((account as any)?.embeddedWallets)
          ? ((account as any).embeddedWallets as any[])
          : []
      for (const wallet of wallets) {
        const raw = typeof wallet?.address === 'string' ? String(wallet.address) : ''
        if (!raw || !isAddress(raw)) continue
        return getAddress(raw) as Address
      }
    }
    return null
  }, [privyCrossAppLinkedAccounts])

  // Get smart wallet address (local signer first, cross-app fallback for detection/ownership checks).
  // The connected wallet (from wagmi) is the EOA, the canonical identity might be a smart wallet.
  const privySmartWalletAddress = useMemo(() => {
    try {
      const addr = smartWalletClient?.account?.address
      if (addr && isAddress(addr)) return getAddress(addr) as Address
    } catch {
      // ignore
    }
    return privyCrossAppSmartWalletAddress
  }, [privyCrossAppSmartWalletAddress, smartWalletClient])

  const walletClientTypeOf = useCallback((w: any): string => {
    return String(
      w?.wallet_client_type ??
        w?.walletClientType ??
        w?.connector_type ??
        w?.connectorType ??
        w?.type ??
        '',
    )
      .trim()
      .toLowerCase()
  }, [])

  // If the user logged in with email, they may still need to link a wallet in this Privy app.
  // This is NOT the same as “Zora global wallet”, which only works when apps are configured for shared wallets.
  const privyEmbeddedEoaWallet = useMemo(() => {
    const ws = Array.isArray(wallets) ? (wallets as any[]) : []
    return pickPrivyEmbeddedEoaWallet(ws, privySmartWalletAddress)
  }, [privySmartWalletAddress, wallets])
  const privyEmbeddedEoaAddress = useMemo(() => {
    try {
      const raw = typeof (privyEmbeddedEoaWallet as any)?.address === 'string' ? String((privyEmbeddedEoaWallet as any).address) : ''
      if (raw && isAddress(raw)) return getAddress(raw) as Address
    } catch {
      // ignore
    }
    return privyCrossAppEmbeddedEoaAddress
  }, [privyCrossAppEmbeddedEoaAddress, privyEmbeddedEoaWallet])
  const privyEmbeddedEoaWalletId = useMemo(() => {
    const raw = typeof (privyEmbeddedEoaWallet as any)?.id === 'string' ? String((privyEmbeddedEoaWallet as any).id).trim() : ''
    return raw || null
  }, [privyEmbeddedEoaWallet])
  const privyEmbeddedEoaCanSign = useMemo(() => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    if (typeof walletAny?.request === 'function') return true
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return true
    if (typeof walletAny?.getEthereumProvider === 'function') return true
    if (typeof walletAny?.signMessage === 'function') return true
    return false
  }, [privyEmbeddedEoaWallet])

  const privyLinkedEoaWallet = useMemo(() => {
    const ws = Array.isArray(wallets) ? (wallets as any[]) : []
    return (
      ws.find((w) => {
        const t = walletClientTypeOf(w)
        // Exclude Privy embedded wallets; this bucket is for externally-linked EOAs/Base Account/etc.
        if (t === 'privy' || t.includes('privy') || t.includes('embedded')) return false
        const raw = typeof (w as any)?.address === 'string' ? String((w as any).address) : ''
        return raw && isAddress(raw)
      }) ?? null
    )
  }, [walletClientTypeOf, wallets])
  const privyLinkedEoaAddress = useMemo(() => {
    try {
      const raw = typeof (privyLinkedEoaWallet as any)?.address === 'string' ? String((privyLinkedEoaWallet as any).address) : ''
      return raw && isAddress(raw) ? (getAddress(raw) as Address) : null
    } catch {
      return null
    }
  }, [privyLinkedEoaWallet])
  
  const [creatorToken, setCreatorToken] = useState('')

  const ensureBaseChain = useCallback(async (label: string) => {
    if (chainId === base.id) return
    if (typeof switchChainAsync !== 'function') {
      throw new Error(`Please switch ${label} to Base network to continue.`)
    }
    try {
      await switchChainAsync({ chainId: base.id })
    } catch {
      throw new Error(`Please switch ${label} to Base network to continue.`)
    }
  }, [chainId, switchChainAsync])
  
  // Connected wallet is the user's Coinbase Smart Wallet
  const connectedWalletAddress = useMemo(() => {
    return address && isAddress(address) ? getAddress(address) as Address : null
  }, [address])
  
  // Unified wallet state - considers wagmi connection, Privy smart wallet, and Privy-linked EOAs.
  // This allows users who authenticated via Privy (waitlist) to proceed without re-connecting wagmi.
  const hasWallet = useMemo(() => {
    return (
      isConnected ||
      !!privySmartWalletAddress ||
      !!privyLinkedEoaAddress ||
      !!privyCrossAppEmbeddedEoaAddress ||
      !!privyCrossAppSmartWalletAddress
    )
  }, [isConnected, privyCrossAppEmbeddedEoaAddress, privyCrossAppSmartWalletAddress, privyLinkedEoaAddress, privySmartWalletAddress])
  
  // Effective wallet address for display - prefer Privy smart wallet (set during waitlist), fallback to wagmi
  const effectiveWalletAddress = useMemo(() => {
    return privySmartWalletAddress ?? connectedWalletAddress ?? privyLinkedEoaAddress ?? privyCrossAppEmbeddedEoaAddress
  }, [connectedWalletAddress, privyCrossAppEmbeddedEoaAddress, privyLinkedEoaAddress, privySmartWalletAddress])
  const ownerCandidateAddresses = useMemo(() => {
    const raw = [
      connectedWalletAddress,
      privyLinkedEoaAddress,
      privyEmbeddedEoaAddress,
      privyCrossAppEmbeddedEoaAddress,
      privyCrossAppSmartWalletAddress,
      privySmartWalletAddress,
    ]
    const seen = new Set<string>()
    const out: Address[] = []
    for (const value of raw) {
      if (!value || !isAddress(value)) continue
      const normalized = getAddress(value) as Address
      const key = normalized.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(normalized)
    }
    return out
  }, [
    connectedWalletAddress,
    privyCrossAppEmbeddedEoaAddress,
    privyCrossAppSmartWalletAddress,
    privyEmbeddedEoaAddress,
    privyLinkedEoaAddress,
    privySmartWalletAddress,
  ])
  const deploymentVersion = useMemo(() => resolveDeploymentVersionFromRuntime(), [])
  const deployMode = useMemo(() => resolveDeployMode(), [])
  const strictNoEoaMode = deployMode === 'no_eoa_strict'
  const minFirstDepositTokens = useMemo(() => {
    // Deployment flow currently enforces an exact 10M creator-token first deposit.
    // Keep UI/runtime locked to that value so query/env overrides cannot drift and fail late.
    const env = parsePositiveTokenAmount(
      (import.meta.env.VITE_MIN_FIRST_DEPOSIT_TOKENS as string | undefined) ?? '',
    )
    let requested: bigint | null = env
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const query = parsePositiveTokenAmount(params.get('minFirstDepositTokens'))
      requested = query ?? env
    }
    if (requested !== null && requested !== DEFAULT_MIN_FIRST_DEPOSIT_TOKENS) {
      logger.warn('[DeployVault] ignoring minFirstDepositTokens override; enforcing 10M policy', {
        requested: requested.toString(),
        enforced: DEFAULT_MIN_FIRST_DEPOSIT_TOKENS.toString(),
      })
    }
    return DEFAULT_MIN_FIRST_DEPOSIT_TOKENS
  }, [])
  const shareOftSaltOverride = useMemo(() => {
    const env = normalizeBytes32(import.meta.env.VITE_SHARE_OFT_SALT_OVERRIDE as string | undefined)
    if (typeof window === 'undefined') return env
    const params = new URLSearchParams(window.location.search)
    const query = normalizeBytes32(params.get('shareOftSaltOverride'))
    return query ?? env
  }, [])
  const [solanaMintOverrideInput] = useState<string>(() => {
    const env = normalizeBytes32(import.meta.env.VITE_SOLANA_DEFAULT_MINT_BYTES32 as string | undefined)
    if (typeof window === 'undefined') return String(env ?? '')
    try {
      const stored = normalizeBytes32(window.localStorage.getItem('cv:deploy:solanaMintOverride'))
      if (stored) return String(stored)
    } catch {
      // ignore
    }
    const params = new URLSearchParams(window.location.search)
    const query = normalizeBytes32(params.get('solanaMint'))
    return String(query ?? env ?? '')
  })
  const [solanaDecimalsOverrideInput] = useState<string>(() => {
    const env = parseUint8(import.meta.env.VITE_SOLANA_DEFAULT_MINT_DECIMALS as string | undefined)
    if (typeof window === 'undefined') return env !== null ? String(env) : ''
    try {
      const stored = parseUint8(window.localStorage.getItem('cv:deploy:solanaDecimalsOverride'))
      if (stored !== null) return String(stored)
    } catch {
      // ignore
    }
    const params = new URLSearchParams(window.location.search)
    const query = parseUint8(params.get('solanaDecimals'))
    const v = query ?? env
    return v !== null ? String(v) : ''
  })
  const solanaMintOverride = useMemo(
    () => normalizeBytes32(solanaMintOverrideInput),
    [solanaMintOverrideInput],
  )
  const solanaDecimalsOverride = useMemo(
    () => parseUint8(solanaDecimalsOverrideInput),
    [solanaDecimalsOverrideInput],
  )
  const solanaMintOverrideInvalid = solanaMintOverrideInput.trim().length > 0 && !solanaMintOverride
  const solanaDecimalsOverrideInvalid =
    solanaDecimalsOverrideInput.trim().length > 0 && solanaDecimalsOverride === null

  const switchAuthCta = useMemo(() => {
    if (!privyReady) return undefined
    const run = async () => {
      const loginOptions: { loginMethods: Array<'email' | 'wallet'> } = {
        loginMethods: ['email', 'wallet'],
      }
      // Prefer in-session re-auth first to avoid unnecessary identity churn.
      // Some Privy states still require a full logout/login cycle to switch.
      try {
        await login(loginOptions)
        return
      } catch (error) {
        const msg = String((error as any)?.message ?? '').toLowerCase()
        const likelyAlreadyLoggedIn =
          msg.includes('already logged in') ||
          msg.includes('already authenticated') ||
          msg.includes('session already exists')
        if (!privyAuthenticated || !likelyAlreadyLoggedIn || typeof logout !== 'function') return
      }

      try {
        await logout()
      } catch {
        // ignore
      }
      try {
        await login(loginOptions)
      } catch {
        // ignore
      }
    }
    return {
      label: privyAuthenticated ? 'Switch account connection' : 'Restore account connection',
      onClick: () => void run(),
    }
  }, [login, logout, privyAuthenticated, privyReady])

  const connectExternalSignerWallet = useCallback(() => {
    if (externalWalletConnectBusy) return
    const preferred = selectPreferredWalletConnector(wagmiConnectors)
    setExternalWalletConnectError(null)
    if (!preferred) {
      setExternalWalletConnectError(
        'No external wallet connector is available in this browser. Open 4626 in Base App, Coinbase Wallet, Rabby, or MetaMask and retry.',
      )
      return
    }

    setExternalWalletConnectBusy(true)
    void wagmiConnectAsync({ connector: preferred })
      .catch((connectError: unknown) => {
        const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
        const lower = message.toLowerCase()
        const rejected = lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')
        setExternalWalletConnectError(
          rejected
            ? 'Wallet connection was cancelled. Try again when you are ready.'
            : message || 'Failed to connect external wallet.',
        )
      })
      .finally(() => {
        setExternalWalletConnectBusy(false)
      })
  }, [externalWalletConnectBusy, wagmiConnectAsync, wagmiConnectors])

  useEffect(() => {
    if (isConnected) setExternalWalletConnectError(null)
  }, [isConnected])

  useEffect(() => {
    if (!privyAuthenticated || !smartWalletClient) return
    let mounted = true
    const run = async () => {
      try {
        const client: any = smartWalletClient as any
        if (typeof client.request !== 'function' || !mounted) return
        await ensureProviderOnBase({ provider: client, label: 'Privy smart wallet' })
      } catch {
        // ignore
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [privyAuthenticated, smartWalletClient])

  const [searchParams, setSearchParams] = useSearchParams()
  const initialQueryRef = useRef<{
    debugEnabledFromQuery: boolean
  } | null>(null)

  if (!initialQueryRef.current) {
    initialQueryRef.current = {
      debugEnabledFromQuery: (searchParams.get('debug') ?? '').trim() === '1',
    }
  }

  const debugEnabledFromQuery = initialQueryRef.current.debugEnabledFromQuery

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of ['shareOftSaltOverride', 'debug', 'token']) {
      if (next.has(key)) {
        next.delete(key)
        changed = true
      }
    }
    if (!changed) return
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const baseEase = useMemo(() => [0.4, 0, 0.2, 1] as const, [])
  const cdpPaymasterUrl = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
  const paymasterStatus = useMemo(() => {
    const paymasterUrl = resolveCdpPaymasterUrl(cdpPaymasterUrl ?? null)
    if (!paymasterUrl || typeof paymasterUrl !== 'string') {
      return { ok: false, hint: 'missing' }
    }
    try {
      const url = new URL(paymasterUrl)
      return { ok: true, hint: url.host }
    } catch {
      return { ok: true, hint: 'configured' }
    }
  }, [cdpPaymasterUrl])


  // Detect "your" creator coin + smart wallet from your Zora profile and prefill inputs once.
  const myProfileQuery = useZoraProfile(address)
  const myProfile = myProfileQuery.data
  
  // Also query Privy smart wallet's Zora profile (for Privy-first flow)
  const privyWalletProfileQuery = useZoraProfile(privySmartWalletAddress ?? undefined)
  const privyWalletProfile = privyWalletProfileQuery.data

  const adminAuthQuery = useQuery({
    queryKey: ['adminAuth'],
    enabled: hasWallet,
    queryFn: fetchAdminAuth,
    staleTime: 30_000,
    retry: 0,
  })
  const isAdmin = Boolean(adminAuthQuery.data?.isAdmin)

  const [minCoinAgeDays, setMinCoinAgeDays] = useState<number>(DEFAULT_MIN_COIN_AGE_DAYS)
  useEffect(() => {
    if (!isAdmin) {
      setMinCoinAgeDays(DEFAULT_MIN_COIN_AGE_DAYS)
      return
    }
    try {
      const raw = localStorage.getItem(MIN_COIN_AGE_LOCALSTORAGE_KEY)
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0 && n <= 3650) setMinCoinAgeDays(Math.floor(n))
    } catch {
      // ignore
    }
  }, [isAdmin])
  useEffect(() => {
    if (!isAdmin) return
    try {
      localStorage.setItem(MIN_COIN_AGE_LOCALSTORAGE_KEY, String(minCoinAgeDays))
    } catch {
      // ignore
    }
  }, [isAdmin, minCoinAgeDays])

  const detectedCreatorCoin = useMemo(() => {
    const v = myProfile?.creatorCoin?.address ? String(myProfile.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [myProfile?.creatorCoin?.address])

  // Detect creator coin from Privy smart wallet's Zora profile (Privy-first flow)
  const detectedCreatorCoinFromPrivy = useMemo(() => {
    const v = privyWalletProfile?.creatorCoin?.address ? String(privyWalletProfile.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [privyWalletProfile?.creatorCoin?.address])

  // Privy provides the smart wallet directly - no need to detect from Zora profile
  const publicClient = usePublicClient({ chainId: base.id })
  const entryPointBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'entryPointV06', COINBASE_ENTRYPOINT_V06],
    enabled: !!publicClient,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: COINBASE_ENTRYPOINT_V06 as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })
  const entryPointV06Ready = useMemo(() => {
    const code = entryPointBytecodeQuery.data
    return !!code && code !== '0x'
  }, [entryPointBytecodeQuery.data])

  const autofillRef = useRef<{ tokenFor?: string }>({})
  const addressLc = (address ?? '').toLowerCase()

  useEffect(() => {
    if (!isConnected || !addressLc) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoin) return
    if (autofillRef.current.tokenFor === addressLc) return

    setCreatorToken(detectedCreatorCoin)
    autofillRef.current.tokenFor = addressLc
  }, [isConnected, addressLc, creatorToken, detectedCreatorCoin])

  // Privy-first: auto-fill creator coin from Privy smart wallet's Zora profile
  useEffect(() => {
    if (!privyAuthenticated || !privySmartWalletAddress) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoinFromPrivy) return
    const key = `privy:${privySmartWalletAddress.toLowerCase()}`
    if (autofillRef.current.tokenFor === key) return
    setCreatorToken(detectedCreatorCoinFromPrivy)
    autofillRef.current.tokenFor = key
  }, [privyAuthenticated, privySmartWalletAddress, creatorToken, detectedCreatorCoinFromPrivy])

  const tokenIsValid = isAddress(creatorToken)

  // NOTE: selectedOwnerWallet (smart wallet vs connected wallet) is computed further down once we know
  // payoutRecipient/creatorAddress.

  const {
    data: zoraCoin,
    isLoading: zoraLoading,
  } = useZoraCoin(
    tokenIsValid ? (creatorToken as Address) : undefined,
  )
  // Prefetch creator profile (used elsewhere in the app); we don't depend on the result here.
  useZoraProfile(zoraCoin?.creatorAddress)

  const { data: tokenSymbol, isLoading: symbolLoading } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: tokenIsValid },
  })

  const { data: tokenName } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled: tokenIsValid },
  })
  const { data: tokenDecimals } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenIsValid },
  })
  const resolvedTokenDecimals = useMemo<number | null>(() => {
    if (typeof tokenDecimals === 'number' && Number.isFinite(tokenDecimals)) return tokenDecimals
    if (typeof tokenDecimals === 'bigint') return Number(tokenDecimals)
    return null
  }, [tokenDecimals])

  // Auto-derive ShareOFT symbol and name (preserve original case)
  const baseSymbol = tokenSymbol ?? zoraCoin?.symbol ?? ''
  const baseName = (tokenName ? String(tokenName) : zoraCoin?.name ?? '').trim()
  const showSymbolInReviewHeading = useMemo(() => {
    const normalizedName = baseName.replace(/\$/g, '').trim().toLowerCase()
    const normalizedSymbol = String(baseSymbol).replace(/\$/g, '').trim().toLowerCase()
    if (!normalizedName || !normalizedSymbol) return Boolean(baseSymbol)
    return normalizedName !== normalizedSymbol
  }, [baseName, baseSymbol])

  const underlyingSymbol = useMemo(() => {
    if (!baseSymbol) return ''
    return normalizeUnderlyingSymbol(String(baseSymbol))
  }, [baseSymbol])

  const underlyingSymbolUpper = useMemo(() => {
    if (underlyingSymbol) return deriveUnderlyingUpper(underlyingSymbol)
    if (baseSymbol) return deriveUnderlyingUpper(baseSymbol)
    return ''
  }, [baseSymbol, underlyingSymbol])

  const derivedVaultSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toVaultSymbol(underlyingSymbolUpper)
  }, [underlyingSymbolUpper])

  const derivedVaultName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toVaultName(underlyingSymbolUpper, baseName)
  }, [underlyingSymbolUpper, baseName])

  const derivedShareSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toShareSymbol(underlyingSymbolUpper)
  }, [underlyingSymbolUpper])

  const derivedShareName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toShareName(underlyingSymbolUpper, baseName)
  }, [underlyingSymbolUpper, baseName])

  // Onchain read of CreatorCoin payoutRecipient.
  const { data: onchainPayoutRecipient } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: coinABI,
    functionName: 'payoutRecipient',
    query: { enabled: tokenIsValid },
  })

  const payoutRecipient = useMemo(() => {
    // Prefer onchain value (instant). Fall back to indexed value.
    const onchain = typeof onchainPayoutRecipient === 'string' ? onchainPayoutRecipient : ''
    if (isAddress(onchain)) return onchain as Address
    const r = zoraCoin?.payoutRecipientAddress ? String(zoraCoin.payoutRecipientAddress) : ''
    return isAddress(r) ? (r as Address) : null
  }, [onchainPayoutRecipient, zoraCoin?.payoutRecipientAddress])

  // Canonical identity enforcement (prevents irreversible fragmentation).
  // Existing creator coin identity is authoritative.
  // Privy wallets are execution/session wallets and never auto-promoted as canonical.
  const identity = useMemo(() => {
    return resolveCreatorIdentity({
      connectedWallet: connectedWalletAddress,
      privySmartWallet: privySmartWalletAddress,
      zoraCoin: zoraCoin ?? null,
    })
  }, [connectedWalletAddress, privySmartWalletAddress, zoraCoin])

  const canonicalIdentityAddress = identity.canonicalIdentity.address
  const deploySender = (canonicalIdentityAddress as Address | null) ?? null

  // Deployment tracking: 1 deployment per owner per version
  const deploymentTracker = useDeploymentTracker(deploySender, deploymentVersion)
  const [justCompletedDeployment, setJustCompletedDeployment] = useState<DeploymentRecord | null>(null)
  const trackerDeployment = deploymentTracker.existingDeployment
  const justCompletedCcaStrategy = justCompletedDeployment?.contracts.ccaStrategy
  const trackerCcaStrategy = trackerDeployment?.contracts.ccaStrategy
  const hasRequiredContracts = useCallback((record: DeploymentRecord | null | undefined): boolean => {
    if (!record) return false
    return (
      isAddress(record.contracts.vault) &&
      isAddress(record.contracts.wrapper) &&
      isAddress(record.contracts.shareOFT) &&
      isAddress(record.contracts.gaugeController ?? '') &&
      isAddress(record.contracts.ccaStrategy ?? '') &&
      isAddress(record.contracts.oracle ?? '')
    )
  }, [])
  const isAuctionReadyForStrategy = useCallback(
    async (ccaStrategy: Address | null | undefined): Promise<boolean> => {
      if (!ccaStrategy || !publicClient) return false
      const status = (await publicClient.readContract({
        address: ccaStrategy,
        abi: CCA_LAUNCH_STRATEGY_AUCTION_STATUS_ABI,
        functionName: 'getAuctionStatus',
      })) as readonly [Address, boolean, boolean, bigint, bigint]
      const auction = String(status?.[0] ?? '').toLowerCase()
      return /^0x[a-f0-9]{40}$/.test(auction) && auction !== ZERO_ADDRESS
    },
    [publicClient],
  )
  const trackerAuctionReadyQuery = useQuery({
    queryKey: ['deployVault', 'trackerDeployment', 'auctionReady', trackerCcaStrategy],
    enabled: !!trackerCcaStrategy && !!publicClient,
    staleTime: 20_000,
    queryFn: async () => isAuctionReadyForStrategy(trackerCcaStrategy as Address),
  })
  const justCompletedAuctionReadyQuery = useQuery({
    queryKey: ['deployVault', 'justCompletedDeployment', 'auctionReady', justCompletedCcaStrategy],
    enabled: !!justCompletedCcaStrategy && !!publicClient,
    staleTime: 20_000,
    queryFn: async () => isAuctionReadyForStrategy(justCompletedCcaStrategy as Address),
  })
  const trackerDeploymentIsComplete = useMemo(() => {
    if (!hasRequiredContracts(trackerDeployment)) return false
    return trackerAuctionReadyQuery.data === true
  }, [hasRequiredContracts, trackerAuctionReadyQuery.data, trackerDeployment])
  const justCompletedDeploymentIsComplete = useMemo(() => {
    if (!hasRequiredContracts(justCompletedDeployment)) return false
    return justCompletedAuctionReadyQuery.data === true
  }, [hasRequiredContracts, justCompletedAuctionReadyQuery.data, justCompletedDeployment])
  const staleIncompleteDeploymentRecord = Boolean(trackerDeployment && !trackerDeploymentIsComplete)
  const pendingJustCompletedDeployment = Boolean(justCompletedDeployment && !justCompletedDeploymentIsComplete)
  const alreadyDeployed = Boolean(justCompletedDeploymentIsComplete || trackerDeploymentIsComplete)

  // Handler for when deployment completes successfully
  const handleDeploymentSuccess = useCallback((addresses: ServerDeployResponse['addresses']) => {
    if (!deploySender || !creatorToken || !isAddress(creatorToken)) return

    const record = deploymentTracker.recordDeployment({
      creatorToken: creatorToken as Address,
      contracts: {
        vault: addresses.vault,
        wrapper: addresses.wrapper,
        shareOFT: addresses.shareOFT,
        gaugeController: addresses.gaugeController,
        ccaStrategy: addresses.ccaStrategy,
        burnStream: addresses.burnStream,
        payoutRouter: addresses.payoutRouter,
        oracle: addresses.oracle,
      },
    })

    if (record) {
      setJustCompletedDeployment(record)
    }
  }, [creatorToken, deploySender, deploymentTracker])

  const canonicalIdentityBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'canonicalIdentity', canonicalIdentityAddress],
    enabled: !!publicClient && !!canonicalIdentityAddress,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: canonicalIdentityAddress as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const canonicalIdentityIsContract = useMemo(() => {
    const b = canonicalIdentityBytecodeQuery.data
    return typeof b === 'string' && b !== '0x'
  }, [canonicalIdentityBytecodeQuery.data])
  const canonicalIdentityType = useMemo<'contract' | 'eoa' | 'unknown'>(() => {
    if (canonicalIdentityIsContract) return 'contract'
    if (canonicalIdentityBytecodeQuery.isSuccess) return 'eoa'
    return 'unknown'
  }, [canonicalIdentityBytecodeQuery.isSuccess, canonicalIdentityIsContract])
  const addPrivySmartWalletOwnerCalldata = useMemo(() => {
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress || !privySmartWalletAddress) return null
    try {
      return encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [privySmartWalletAddress],
      })
    } catch {
      return null
    }
  }, [canonicalIdentityAddress, canonicalIdentityIsContract, privySmartWalletAddress])
  const addPrivySmartWalletOwnerProlinkQuery = useQuery({
    queryKey: [
      'deploy-vault',
      'add-privy-smart-wallet-owner-prolink',
      canonicalIdentityAddress,
      privySmartWalletAddress,
      addPrivySmartWalletOwnerCalldata,
    ],
    queryFn: async () => {
      if (!canonicalIdentityAddress || !addPrivySmartWalletOwnerCalldata) return null
      return await encodeSingleCallSendCallsProlink({
        to: canonicalIdentityAddress,
        data: addPrivySmartWalletOwnerCalldata,
      })
    },
    enabled: Boolean(canonicalIdentityAddress && addPrivySmartWalletOwnerCalldata),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const addPrivySmartWalletOwnerProlinkUrl = useMemo(() => {
    if (!addPrivySmartWalletOwnerProlinkQuery.data) return null
    try {
      return buildBaseAppProlinkUrl(addPrivySmartWalletOwnerProlinkQuery.data)
    } catch {
      return null
    }
  }, [addPrivySmartWalletOwnerProlinkQuery.data])

  const privySmartWalletIsCanonicalOwnerQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwner', 'privySmartWallet', canonicalIdentityAddress, privySmartWalletAddress],
    enabled: !!canonicalIdentityIsContract && !!canonicalIdentityAddress && !!privySmartWalletAddress,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      const canonical = canonicalIdentityAddress as Address
      const smartWallet = privySmartWalletAddress as Address
      return await isCoinbaseSmartWalletOwner({ smartWallet: canonical, ownerAddress: smartWallet })
    },
  })
  const privySmartWalletIsCanonicalOwner = privySmartWalletIsCanonicalOwnerQuery.data === true
  const privyEmbeddedEoaIsCanonicalOwnerQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwner', 'privyEmbeddedEoa', canonicalIdentityAddress, privyEmbeddedEoaAddress],
    enabled: !!canonicalIdentityIsContract && !!canonicalIdentityAddress && !!privyEmbeddedEoaAddress,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      const canonical = canonicalIdentityAddress as Address
      const embeddedEoa = privyEmbeddedEoaAddress as Address
      return await isCoinbaseSmartWalletOwner({ smartWallet: canonical, ownerAddress: embeddedEoa })
    },
  })
  const privyEmbeddedEoaIsCanonicalOwner = privyEmbeddedEoaIsCanonicalOwnerQuery.data === true

  // NOTE: Embedded EOA signing requires eth_sign support.
  // App smart wallet signing uses EIP-1271 and costs more verification gas.

  // Add Privy app smart wallet as owner (EIP-1271 signer for canonical wallet)
  const handleAddPrivyAppSmartWalletOwner = useCallback(async (opts?: { skipConfirm?: boolean }): Promise<boolean> => {
    if (addPrivySmartWalletOwnerBusy) return false
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress) {
      setAddPrivySmartWalletOwnerError('Missing canonical smart wallet address.')
      return false
    }
    if (!privySmartWalletAddress) {
      setAddPrivySmartWalletOwnerError('Privy smart wallet not ready. Please wait and retry.')
      return false
    }
    // Re-check ownership inline to avoid false negatives from stale/initial query state.
    const appWalletAlreadyOwner = await isCoinbaseSmartWalletOwner({
      smartWallet: canonicalIdentityAddress as Address,
      ownerAddress: privySmartWalletAddress as Address,
    })
    if (appWalletAlreadyOwner) {
      setAddPrivySmartWalletOwnerError(null)
      await privySmartWalletIsCanonicalOwnerQuery.refetch()
      return true
    }
    if (privySmartWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()) {
      setAddPrivySmartWalletOwnerError(null)
      return true
    }
    if (!opts?.skipConfirm && typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will add your app smart wallet as an owner of your canonical Coinbase Smart Wallet. ' +
          'The canonical wallet will remain the sender. Proceed?'
      )
      if (!ok) return false
    }

    setAddPrivySmartWalletOwnerBusy(true)
    setAddPrivySmartWalletOwnerError(null)
    setAddPrivySmartWalletOwnerTxHash(null)

    try {
      const addOwnerData = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [privySmartWalletAddress],
      })

      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected. Please connect a wallet that is an owner of your canonical Coinbase Smart Wallet.')
      }
      if (!connectedWalletAddress) {
        throw new Error('Wallet not connected. Please connect a wallet that is an owner of your canonical Coinbase Smart Wallet.')
      }

      await ensureBaseChain('your wallet')
      const walletIsCanonicalSelfSigner = connectedWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
      const finalizeOwnerAddTx = async (txHash: Hex, submissionPath: string): Promise<boolean> => {
        setAddPrivySmartWalletOwnerTxHash(txHash)
        logger.info('[DeployVault] App smart wallet add-owner transaction submitted', {
          txHash,
          canonical: canonicalIdentityAddress,
          smartWallet: privySmartWalletAddress,
          submissionPath,
        })
        await publicClient.waitForTransactionReceipt({ hash: txHash })
        await privySmartWalletIsCanonicalOwnerQuery.refetch()
        return true
      }

      // Primary lane: canonical self-auth (Base Account / CSW-as-signer)
      if (walletIsCanonicalSelfSigner) {
        const walletRequest =
          typeof (walletClient as any)?.request === 'function'
            ? ((walletClient as any).request as (args: { method: string; params?: unknown[] }) => Promise<unknown>)
            : null

        if (walletRequest) {
          try {
            const rawTxHash = await walletRequest({
              method: 'eth_sendTransaction',
              params: [{
                from: canonicalIdentityAddress as Address,
                to: canonicalIdentityAddress as Address,
                data: addOwnerData,
                value: '0x0',
              }],
            })
            if (typeof rawTxHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(rawTxHash)) {
              return await finalizeOwnerAddTx(rawTxHash as Hex, 'canonical_self_auth.eth_sendTransaction')
            }
            throw new Error('eth_sendTransaction did not return a valid transaction hash.')
          } catch (canonicalSelfAuthError: any) {
            if (isUserRejectedErrorMessage(canonicalSelfAuthError?.message ?? String(canonicalSelfAuthError ?? ''))) {
              throw canonicalSelfAuthError
            }
            logger.warn('[DeployVault] Canonical self-auth eth_sendTransaction failed; trying fallback lane', {
              error: canonicalSelfAuthError?.message,
              connector: connector?.id,
            })
          }
        }

        try {
          const txHash = await walletClient.sendTransaction({
            to: canonicalIdentityAddress as Address,
            data: addOwnerData,
            value: 0n,
            chain: base,
          })
          return await finalizeOwnerAddTx(txHash, 'canonical_self_auth.sendTransaction')
        } catch (canonicalFallbackError: any) {
          if (isUserRejectedErrorMessage(canonicalFallbackError?.message ?? String(canonicalFallbackError ?? ''))) {
            throw canonicalFallbackError
          }
          logger.warn('[DeployVault] Canonical self-auth fallback sendTransaction failed', {
            error: canonicalFallbackError?.message,
            connector: connector?.id,
          })
          throw new Error(
            'Base Account owner approval could not be completed in this session. Use the Base App prolink above or reconnect with your canonical Base Account wallet and retry.',
          )
        }
      }

      throw new Error(
        'This setup now requires canonical Base Account self-auth only. Reconnect with your canonical Base Account wallet (sender must equal your CSW) or use the Base App prolink above.',
      )
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to add app smart wallet as owner'
      setAddPrivySmartWalletOwnerError(msg)
      logger.error('[DeployVault] Failed to add app smart wallet as owner', { error: e })
      return false
    } finally {
      setAddPrivySmartWalletOwnerBusy(false)
    }
    return false
  }, [
    addPrivySmartWalletOwnerBusy,
    canonicalIdentityAddress,
    canonicalIdentityIsContract,
    connectedWalletAddress,
    connector?.id,
    ensureBaseChain,
    privySmartWalletAddress,
    privySmartWalletIsCanonicalOwnerQuery,
    publicClient,
    walletClient,
  ])

  useEffect(() => {
    return () => {
      if (autoSmartWalletOwnerTimerRef.current) {
        clearTimeout(autoSmartWalletOwnerTimerRef.current)
        autoSmartWalletOwnerTimerRef.current = null
      }
    }
  }, [])


  // Check whether candidate wallets are onchain owners of the canonical CSW.
  // Uses server-side API to avoid client-side RPC rate limits.
  const executionCanOperateCanonicalQuery = useQuery({
    queryKey: [
      'coinbaseSmartWalletOwner',
      canonicalIdentityAddress,
      canonicalIdentityType,
      ownerCandidateAddresses.map((a) => a.toLowerCase()).join(','),
    ],
    // Run when: identity blocking reason OR canonical is a contract (for ERC-4337 PATH 3)
    enabled:
      !!canonicalIdentityAddress &&
      ownerCandidateAddresses.length > 0 &&
      (!!identity.blockingReason || canonicalIdentityIsContract || canonicalIdentityType === 'unknown'),
    staleTime: 0, // Always refetch - ownership can change externally
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      const canonical = canonicalIdentityAddress as Address
      for (const execution of ownerCandidateAddresses) {
        if (canonical.toLowerCase() === execution.toLowerCase()) return true
      }
      // For canonical EOAs, exact match above is sufficient.
      if (canonicalIdentityType === 'eoa') return false

      // Use server-side API to check ownership (avoids client RPC rate limits)
      for (const execution of ownerCandidateAddresses) {
        const isOwner = await isCoinbaseSmartWalletOwner({
          smartWallet: canonical,
          ownerAddress: execution,
        })
        if (isOwner) return true
      }
      return false
    },
  })

  const executionCanOperateCanonical = executionCanOperateCanonicalQuery.data === true
  const executionCanOperateCanonicalPending =
    (!!identity.blockingReason || canonicalIdentityIsContract) &&
    (canonicalIdentityType === 'unknown' || executionCanOperateCanonicalQuery.isFetching)

  // Check if connected EOA is an owner of the Creator Coin itself (via ownerAt)
  const creatorCoinOwnersQuery = useQuery({
    queryKey: ['creatorCoinOwners', creatorToken],
    enabled: !!publicClient && tokenIsValid && ownerCandidateAddresses.length > 0 && !!identity.blockingReason,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const totalOwners = await publicClient!.readContract({
        address: creatorToken as Address,
        abi: CREATOR_COIN_OWNERS_ABI,
        functionName: 'totalOwners',
      }) as bigint
      const owners: Address[] = []
      for (let i = 0n; i < totalOwners && i < 64n; i++) {
        const owner = await publicClient!.readContract({
          address: creatorToken as Address,
          abi: CREATOR_COIN_OWNERS_ABI,
          functionName: 'ownerAt',
          args: [i],
        }) as Address
        owners.push(owner)
      }
      return owners
    },
  })

  const isCreatorCoinOwner = useMemo(() => {
    if (!creatorCoinOwnersQuery.data || ownerCandidateAddresses.length === 0) return false
    const candidateSet = new Set(ownerCandidateAddresses.map((a) => a.toLowerCase()))
    return creatorCoinOwnersQuery.data.some((owner) => candidateSet.has(owner.toLowerCase()))
  }, [creatorCoinOwnersQuery.data, ownerCandidateAddresses])

  const creatorCoinOwnershipPending = !!identity.blockingReason && creatorCoinOwnersQuery.isFetching

  const identityBlockingReason = identity.blockingReason
    ? (executionCanOperateCanonical || isCreatorCoinOwner)
      ? null
      : (executionCanOperateCanonicalPending || creatorCoinOwnershipPending)
        ? 'Checking whether your connected wallet is an owner…'
        : identity.blockingReason
    : null

  // Privy-first deploy: we only allow deploying when the connected wallet *is* the canonical identity.
  // If the canonical identity is a smart wallet contract, wagmi should reflect that smart wallet address
  // via the Privy smart-wallet bridge.
  const isAuthorizedDeployer = !identityBlockingReason

  const { data: deploySenderTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((deploySender ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!deploySender },
  })

  // Creator access gate:
  // - include the connected wallet (for smart-wallet-owned coins, this may be the only EOA we can approve)
  // - include the coin (so we can also allowlist creator/payoutRecipient)
  const creatorAllowlistQuery = useCreatorAllowlist(
    connectedWalletAddress || tokenIsValid
      ? {
          address: connectedWalletAddress ?? null,
          coin: tokenIsValid ? creatorToken : null,
        }
      : undefined,
  )
  const allowlistMode = creatorAllowlistQuery.data?.mode
  const allowlistEnforced = allowlistMode === 'enforced'
  const isAllowlistedCreator = creatorAllowlistQuery.data?.allowed === true
  const passesCreatorAllowlist = allowlistMode === 'disabled' ? true : isAllowlistedCreator


  // NOTE: We previously supported an optional signer funding helper flow, but it’s not wired into
  // the current UX. Keeping the deploy path deterministic + minimal for now.

  // Creator Vaults are creator-initiated. If we can't confidently identify the creator, default to locked.
  const coinTypeUpper = String(zoraCoin?.coinType ?? '').toUpperCase()
  const isCreatorCoin = coinTypeUpper === 'CREATOR'
  const coinTypeLabel =
    coinTypeUpper === 'CREATOR' ? 'Creator Coin' : coinTypeUpper === 'CONTENT' ? 'Content Coin' : 'Coin'
  const coinTypePillClass =
    coinTypeUpper === 'CREATOR'
      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
      : coinTypeUpper === 'CONTENT'
        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
        : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-300'

  const coinCreatedAtMs = useMemo(() => {
    const raw = typeof zoraCoin?.createdAt === 'string' ? zoraCoin.createdAt.trim() : ''
    if (!raw) return null
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }, [zoraCoin?.createdAt])

  const coinAgeDays = useMemo(() => {
    if (!coinCreatedAtMs) return null
    const ageMs = Date.now() - coinCreatedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return null
    return ageMs / (1000 * 60 * 60 * 24)
  }, [coinCreatedAtMs])

  const coinAgeOk = useMemo(() => {
    if (!tokenIsValid || !zoraCoin || !isCreatorCoin) return false
    if (!coinCreatedAtMs) return false
    const ageMs = Date.now() - coinCreatedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return false
    return ageMs >= minCoinAgeDays * 24 * 60 * 60 * 1000
  }, [coinCreatedAtMs, isCreatorCoin, minCoinAgeDays, tokenIsValid, zoraCoin])

  const marketFloorQuery = useQuery({
    queryKey: ['cca', 'marketFloor', creatorToken],
    enabled: !!publicClient && tokenIsValid && !!zoraCoin && isCreatorCoin,
    queryFn: async () => {
      // Derive a market-based ETH floor price for the CCA:
      // - CREATOR/ZORA v4 spot tick (from the coin’s pool key)
      // - ZORA→ETH via Uniswap v3 TWAP (ZORA/WETH + ZORA/USDC+Chainlink), conservative min + discount
      return await computeMarketFloorQuote({
        publicClient: publicClient!,
        creatorCoin: creatorToken as Address,
      })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const marketFloorText = useMemo(() => {
    const weiPerToken = marketFloorQuery.data?.weiPerToken
    if (typeof weiPerToken !== 'bigint' || weiPerToken <= 0n) return null
    const ethShort = formatEthPerTokenForUi(weiPerToken)
    const durationSec = marketFloorQuery.data?.creatorZora?.durationSec
    const mins = typeof durationSec === 'number' && durationSec > 0 ? Math.round(durationSec / 60) : null
    const discount = marketFloorQuery.data?.zoraEth?.discountBps
    const bufferBps = typeof discount === 'number' ? Math.max(0, 10_000 - discount) : null
    const bufferPct = bufferBps !== null ? Math.round(bufferBps / 100) : null
    const meta = [mins ? `TWAP ${mins}m` : null, bufferPct !== null ? `-${bufferPct}% buffer` : null]
      .filter(Boolean)
      .join(', ')
    return meta ? `${ethShort} ETH / ${derivedShareSymbol} (${meta})` : `${ethShort} ETH / ${derivedShareSymbol}`
  }, [derivedShareSymbol, marketFloorQuery.data])

  const creatorVaultBatcherAddress = (() => {
    const v = String((CONTRACTS as any).creatorVaultBatcher ?? '')
    return isAddress(v) ? (v as Address) : null
  })()
  const creatorVaultBatcherConfigured = Boolean(creatorVaultBatcherAddress)

  const deployCodeIds = useMemo(() => {
    return {
      vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
      wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
      shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
      gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
      cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
      oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
      oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
      // Newly required per-vault contracts (deployed via UniversalCreate2DeployerFromStore)
      payoutRouter: keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex),
      vaultShareBurnStream: keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex),
      creatorCoinPolicyController: keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaVaultAuth: keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex),
      ajnaVault: keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex),
      erc4626StrategyAdapter: keccak256(DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex),
      solanaStrategy: keccak256(DEPLOY_BYTECODE.SolanaStrategy as Hex),
    } as const
  }, [])

  const bytecodeInfraQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'bytecodeInfra',
      creatorVaultBatcherAddress,
      deployCodeIds.vault,
      deployCodeIds.wrapper,
      deployCodeIds.shareOFT,
      deployCodeIds.gauge,
      deployCodeIds.cca,
      deployCodeIds.oracle,
      deployCodeIds.oftBootstrap,
      deployCodeIds.payoutRouter,
      deployCodeIds.vaultShareBurnStream,
      deployCodeIds.creatorCoinPolicyController,
      deployCodeIds.creatorCharmStrategy,
      deployCodeIds.ajnaVaultAuth,
      deployCodeIds.ajnaVault,
      deployCodeIds.erc4626StrategyAdapter,
      deployCodeIds.solanaStrategy,
    ],
    enabled: Boolean(publicClient && creatorVaultBatcherAddress),
    staleTime: 60_000,
    retry: (failureCount, error) => isTransientRpcFailure(error) && failureCount < 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async () => {
      const batcher = creatorVaultBatcherAddress as Address
      let readClient = publicClient!

      let batcherCode = await readClient.getBytecode({ address: batcher })
      if (!batcherCode || batcherCode === '0x') {
        const fallbackClient = createBaseFallbackClient()
        const fallbackCode = await fallbackClient.getBytecode({ address: batcher }).catch(() => null)
        if (fallbackCode && fallbackCode !== '0x') {
          readClient = fallbackClient
          batcherCode = fallbackCode
        }
      }
      if (!batcherCode || batcherCode === '0x') {
        const chainId = publicClient?.chain?.id
        throw new Error(
          `Deployment batcher has no code at ${batcher} on chain ${chainId ?? 'unknown'}. Switch to Base (8453) or update VITE_CREATOR_VAULT_BATCHER / CREATOR_VAULT_BATCHER.`,
        )
      }

      const getterErrors: unknown[] = []
      let bytecodeStore: Address | null = null
      let create2Deployer: Address | null = null
      try {
        bytecodeStore = (await readClient.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'bytecodeStore',
        })) as Address
      } catch (err: unknown) {
        getterErrors.push(err)
      }
      try {
        create2Deployer = (await readClient.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'create2Deployer',
        })) as Address
      } catch (err: unknown) {
        getterErrors.push(err)
      }

      if (!bytecodeStore || !isAddress(String(bytecodeStore))) {
        const fallback = (CONTRACTS.universalBytecodeStore ?? null) as Address | null
        bytecodeStore = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!create2Deployer || !isAddress(String(create2Deployer))) {
        const fallback = (CONTRACTS.universalCreate2DeployerFromStore ?? null) as Address | null
        create2Deployer = fallback && isAddress(String(fallback)) ? fallback : null
      }
      if (!bytecodeStore || !create2Deployer) {
        if (getterErrors.some((e) => isTransientRpcFailure(e))) {
          throw new Error(
            'Could not verify deployment batcher interface due to temporary RPC/network limits. Retry in a few seconds.',
          )
        }
        throw new Error(
          `Configured batcher at ${batcher} does not expose expected phased deploy interface (bytecodeStore/create2Deployer). Update VITE_CREATOR_VAULT_BATCHER / CREATOR_VAULT_BATCHER.`,
        )
      }
      const bytecodeStoreAddress = bytecodeStore as Address
      const create2DeployerAddress = create2Deployer as Address

      let deployerStore: Address | null = null
      try {
        deployerStore = (await readClient.readContract({
          address: create2DeployerAddress,
          abi: CREATE2_DEPLOYER_STORE_ABI,
          functionName: 'store',
        })) as Address
      } catch (err: unknown) {
        if (isTransientRpcFailure(err)) {
          throw new Error(
            'Could not verify deployment CREATE2 store due to temporary RPC/network limits. Retry in a few seconds.',
          )
        }
        throw err
      }
      if (!deployerStore || !isAddress(String(deployerStore))) {
        throw new Error(
          `Configured create2 deployer at ${create2DeployerAddress} does not expose expected store() interface.`,
        )
      }

      if (bytecodeStoreAddress.toLowerCase() !== deployerStore.toLowerCase()) {
        throw new Error(
          `Misconfigured infra: batcher.bytecodeStore=${bytecodeStoreAddress} but create2Deployer.store=${deployerStore}`,
        )
      }

      // v2 store detection: v1 stores won't have `chunkCount(bytes32)`.
      let storeSupportsChunking = false
      try {
        await readClient.readContract({
          address: bytecodeStoreAddress,
          abi: UNIVERSAL_BYTECODE_STORE_CHUNKCOUNT_ABI,
          functionName: 'chunkCount',
          args: [deployCodeIds.vault],
        })
        storeSupportsChunking = true
      } catch {
        storeSupportsChunking = false
      }

      const codeEntries = [
        { key: 'oftBootstrap', label: 'OFTBootstrapRegistry', codeId: deployCodeIds.oftBootstrap },
        { key: 'shareOFT', label: 'CreatorShareOFT', codeId: deployCodeIds.shareOFT },
        { key: 'vault', label: 'CreatorOVault', codeId: deployCodeIds.vault },
        { key: 'wrapper', label: 'CreatorOVaultWrapper', codeId: deployCodeIds.wrapper },
        { key: 'gauge', label: 'CreatorGaugeController', codeId: deployCodeIds.gauge },
        { key: 'cca', label: 'CCALaunchStrategy', codeId: deployCodeIds.cca },
        { key: 'oracle', label: 'CreatorOracle', codeId: deployCodeIds.oracle },
        { key: 'vaultShareBurnStream', label: 'VaultShareBurnStream', codeId: deployCodeIds.vaultShareBurnStream },
        { key: 'payoutRouter', label: 'PayoutRouter', codeId: deployCodeIds.payoutRouter },
        {
          key: 'creatorCoinPolicyController',
          label: 'CreatorCoinPolicyController',
          codeId: deployCodeIds.creatorCoinPolicyController,
        },
        // Charm alpha vault is created via Charm's official factory in phase 3 (not from bytecode store).
        { key: 'creatorCharmStrategy', label: 'CreatorCharmStrategy', codeId: deployCodeIds.creatorCharmStrategy },
        { key: 'ajnaVaultAuth', label: 'AjnaVaultAuth', codeId: deployCodeIds.ajnaVaultAuth },
        { key: 'ajnaVault', label: 'AjnaERC4626Vault', codeId: deployCodeIds.ajnaVault },
        {
          key: 'erc4626StrategyAdapter',
          label: 'ERC4626StrategyAdapter',
          codeId: deployCodeIds.erc4626StrategyAdapter,
        },
        { key: 'solanaStrategy', label: 'SolanaStrategy', codeId: deployCodeIds.solanaStrategy },
      ] as const

      const pointerResults = await readClient.multicall({
        allowFailure: true,
        contracts: codeEntries.map((c) => ({
          address: bytecodeStoreAddress,
          abi: UNIVERSAL_BYTECODE_STORE_POINTERS_ABI,
          functionName: 'pointers',
          args: [c.codeId],
        })),
      })

      const entries = codeEntries.map((c, i) => {
        const r: any = pointerResults[i]
        const pointer = r?.status === 'success' ? (r.result as Address) : (ZERO_ADDRESS as Address)
        const ok = r?.status === 'success' && pointer !== ZERO_ADDRESS
        return { ...c, pointer, ok }
      })

      const missing = entries.filter((e) => !e.ok).map((e) => e.label)

      return {
        bytecodeStore: bytecodeStoreAddress,
        create2Deployer: create2DeployerAddress,
        storeSupportsChunking,
        entries,
        missing,
      }
    },
  })

  const bytecodeInfraOk = Boolean(
    creatorVaultBatcherConfigured &&
      bytecodeInfraQuery.isSuccess &&
      bytecodeInfraQuery.data &&
      bytecodeInfraQuery.data.missing.length === 0,
  )

  const bytecodeInfraBlocker = useMemo(() => {
    if (!creatorVaultBatcherConfigured) return null
    if (bytecodeInfraQuery.isFetching) return 'Checking deployment bytecode store…'
    if (bytecodeInfraQuery.isError) return (bytecodeInfraQuery.error as any)?.message || 'Deployment bytecode check failed.'
    if (!bytecodeInfraQuery.data) return 'Deployment bytecode check failed.'
    if (!bytecodeInfraQuery.data.storeSupportsChunking) {
      return 'Deployment infra uses a v1 bytecode store (no chunking). Deploy the v2 bytecode store + v2 deployer + new deployment batcher.'
    }
    if (bytecodeInfraQuery.data.missing.length > 0) {
      return `Bytecode store is missing: ${bytecodeInfraQuery.data.missing.join(', ')}. Seed the v2 store, then retry.`
    }
    return null
  }, [
    creatorVaultBatcherConfigured,
    bytecodeInfraQuery.data,
    bytecodeInfraQuery.error,
    bytecodeInfraQuery.isError,
    bytecodeInfraQuery.isFetching,
  ])

  const minFirstDeposit = useMemo(() => {
    if (typeof resolvedTokenDecimals === 'number' && resolvedTokenDecimals >= 0) {
      return minFirstDepositTokens * 10n ** BigInt(resolvedTokenDecimals)
    }
    return MIN_FIRST_DEPOSIT
  }, [minFirstDepositTokens, resolvedTokenDecimals])

  const minFirstDepositDisplay = useMemo(() => {
    const decimals =
      typeof resolvedTokenDecimals === 'number' && resolvedTokenDecimals >= 0
        ? resolvedTokenDecimals
        : 18
    const raw = formatUnits(minFirstDeposit, decimals)
    const [whole, fraction = ''] = raw.split('.')
    const groupedWhole = (whole ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const trimmedFraction = fraction.replace(/0+$/, '')
    return trimmedFraction ? `${groupedWhole}.${trimmedFraction}` : groupedWhole
  }, [minFirstDeposit, resolvedTokenDecimals])

  const walletHasMinDeposit =
    typeof deploySenderTokenBalance === 'bigint' && deploySenderTokenBalance >= minFirstDeposit

  const isAuthorizedDeployerOrOperator = isAuthorizedDeployer

  const fundingGateOk = walletHasMinDeposit

  const debugControlsVisible = useMemo(() => {
    if (debugEnabledFromQuery) return true
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('cv:debug') === 'true'
    } catch {
      return false
    }
  }, [debugEnabledFromQuery])

  const toggleDebugLogs = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      if (isDebugEnabled()) {
        window.localStorage.removeItem('cv:debug')
      } else {
        window.localStorage.setItem('cv:debug', 'true')
      }
    } catch {
      // ignore
    }
    window.location.reload()
  }, [])

  const privySmartWalletReady = Boolean(privySmartWalletAddress && smartWalletClient)
  const privySmartWalletCanSign = useMemo(() => {
    const client: any = smartWalletClient as any
    return (
      typeof client?.account?.sign === 'function' ||
      typeof client?.account?.signMessage === 'function' ||
      typeof client?.signMessage === 'function'
    )
  }, [smartWalletClient])
  
  // Check if Privy smart wallet matches the canonical identity (canonical Coinbase Smart Wallet)
  // If they don't match, user can add the app smart wallet as an owner (EIP-1271)
  const smartWalletMatchesCanonical = useMemo(() => {
    if (!privySmartWalletAddress || !canonicalIdentityAddress) return false
    return privySmartWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
  }, [privySmartWalletAddress, canonicalIdentityAddress])
  const connectedWalletMatchesCanonical = useMemo(() => {
    if (!connectedWalletAddress || !canonicalIdentityAddress) return false
    return connectedWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
  }, [connectedWalletAddress, canonicalIdentityAddress])
  
  const isCoinbaseWalletDirect = connector?.id === 'coinbaseWalletSDK' || connector?.id === 'com.coinbase.wallet'

  useEffect(() => {
    if (strictNoEoaMode) return
    if (isCoinbaseWalletDirect) return
    if (smartWalletMatchesCanonical) return
    if (!privySmartWalletAddress || !privySmartWalletCanSign) return
    // Wait until the owner-check query has resolved before attempting setup.
    // `data === undefined` during initial load should not be treated as "not owner".
    if (!privySmartWalletIsCanonicalOwnerQuery.isFetched) return
    if (privySmartWalletIsCanonicalOwnerQuery.isFetching) return
    if (privySmartWalletIsCanonicalOwner) return
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress) return
    if (!connectedWalletAddress) return
    if (!connectedWalletMatchesCanonical) return
    if (addPrivySmartWalletOwnerBusy) return
    if (autoSmartWalletOwnerAttemptCount >= 3) return

    const attemptKey = `${canonicalIdentityAddress.toLowerCase()}:${connectedWalletAddress.toLowerCase()}:${privySmartWalletAddress.toLowerCase()}`
    if (autoSmartWalletOwnerAttemptKeyRef.current !== attemptKey) {
      autoSmartWalletOwnerAttemptKeyRef.current = attemptKey
      if (autoSmartWalletOwnerTimerRef.current) {
        clearTimeout(autoSmartWalletOwnerTimerRef.current)
        autoSmartWalletOwnerTimerRef.current = null
      }
      setAutoSmartWalletOwnerAttemptCount(0)
    }

    const run = async () => {
      const ok = await handleAddPrivyAppSmartWalletOwner({ skipConfirm: true })
      if (ok) return
      if (autoSmartWalletOwnerAttemptCount >= 2) return
      if (autoSmartWalletOwnerTimerRef.current) {
        clearTimeout(autoSmartWalletOwnerTimerRef.current)
      }
      const backoffMs = 2000 * (autoSmartWalletOwnerAttemptCount + 1)
      autoSmartWalletOwnerTimerRef.current = setTimeout(() => {
        setAutoSmartWalletOwnerAttemptCount((count) => count + 1)
        setAutoSmartWalletOwnerRetryTick((tick) => tick + 1)
      }, backoffMs)
    }

    void run()
  }, [
    addPrivySmartWalletOwnerBusy,
    autoSmartWalletOwnerAttemptCount,
    autoSmartWalletOwnerRetryTick,
    canonicalIdentityAddress,
    canonicalIdentityIsContract,
    connectedWalletAddress,
    connectedWalletMatchesCanonical,
    handleAddPrivyAppSmartWalletOwner,
    isCoinbaseWalletDirect,
    strictNoEoaMode,
    privySmartWalletAddress,
    privySmartWalletCanSign,
    privySmartWalletIsCanonicalOwner,
    privySmartWalletIsCanonicalOwnerQuery.isFetched,
    privySmartWalletIsCanonicalOwnerQuery.isFetching,
    smartWalletMatchesCanonical,
  ])
  
  const privyEmbeddedOwnerReady = privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign
  const privySmartWalletOwnerReady = privySmartWalletIsCanonicalOwner && privySmartWalletCanSign
  const connectedEoaOwnerReady = Boolean(
    canonicalIdentityIsContract &&
      connectedWalletAddress &&
      walletClient &&
      executionCanOperateCanonical,
  )
  const strictNoEoaEnforced = strictNoEoaMode
  const strictNoEoaEligibility = Boolean(
    canonicalIdentityIsContract &&
      canonicalIdentityAddress &&
      (privyEmbeddedOwnerReady || privySmartWalletOwnerReady),
  )
  // Smart wallet is ready only if canonical/Privy owner signer lanes are available.
  const smartWalletCapabilityReady = strictNoEoaEnforced
    ? strictNoEoaEligibility
    : isCoinbaseWalletDirect ||
      connectedEoaOwnerReady ||
      (privySmartWalletReady &&
        (smartWalletMatchesCanonical || privySmartWalletOwnerReady || privyEmbeddedOwnerReady))
  const oneTimePrivyOwnerApprovalNeeded = Boolean(
    canonicalIdentityIsContract &&
      canonicalIdentityAddress &&
      privySmartWalletAddress &&
      !smartWalletMatchesCanonical &&
      !privySmartWalletIsCanonicalOwner,
  )
  const hasDetectedZoraCrossAppWallet = Boolean(privyCrossAppSmartWalletAddress || privyCrossAppEmbeddedEoaAddress)

  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    canonicalIdentityType === 'contract' &&
    coinAgeOk &&
    isAuthorizedDeployerOrOperator &&
    creatorAllowlistQuery.isSuccess &&
    passesCreatorAllowlist &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    !!derivedVaultName &&
    !!derivedVaultSymbol &&
    !!connectedWalletAddress &&
    fundingGateOk &&
    creatorVaultBatcherConfigured &&
    bytecodeInfraOk &&
    !solanaMintOverrideInvalid &&
    !solanaDecimalsOverrideInvalid &&
    !identityBlockingReason &&
    smartWalletCapabilityReady

  const vrfConsumerAddress = (CONTRACTS.vrfConsumer ?? null) as Address | null
  const vrfConsumerConfigured = isAddress(String(vrfConsumerAddress ?? ''))
  const allowlistReady = allowlistMode === 'disabled' ? true : isAllowlistedCreator
  const creatorCoinReady = tokenIsValid && !!zoraCoin && isCreatorCoin
  const canCreateCoinInApp = Boolean(canonicalIdentityAddress && connectedWalletAddress)
  const zoraCoinHandoffHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set('from', 'zora')
    params.set('gate', 'vault')
    if (tokenIsValid && creatorToken) params.set('token', creatorToken)
    return buildZoraHandoffUrl({ returnPath: `/deploy?${params.toString()}`, context: 'vault' })
  }, [creatorToken, tokenIsValid])
  const coinAgeReady = creatorCoinReady && coinAgeOk
  const fundingReady = fundingGateOk
  const authReady = isAuthorizedDeployerOrOperator

  const firstLaunchChecklist = [
    {
      label: 'Deployment batcher configured',
      ok: creatorVaultBatcherConfigured,
      hint: creatorVaultBatcherConfigured && creatorVaultBatcherAddress ? shortAddress(creatorVaultBatcherAddress) : 'missing',
    },
    {
      label: 'Deployment bytecode ready',
      ok: bytecodeInfraOk,
      hint: !creatorVaultBatcherConfigured
        ? 'missing'
        : bytecodeInfraQuery.isFetching
          ? 'checking'
          : bytecodeInfraQuery.isError
            ? 'error'
            : bytecodeInfraOk
              ? 'ok'
              : bytecodeInfraQuery.data?.storeSupportsChunking
                ? 'missing code'
                : 'needs v2 store',
    },
    {
      label: 'Identity wallet connected',
      ok: Boolean(connectedWalletAddress && canonicalIdentityAddress && !identityBlockingReason),
      hint: identityBlockingReason ? 'mismatch' : canonicalIdentityAddress ? 'ok' : 'missing',
    },
    {
      label: 'EntryPoint v0.6 deployed',
      ok: entryPointV06Ready,
      hint: entryPointBytecodeQuery.isFetching
        ? 'checking'
        : entryPointV06Ready
          ? shortAddress(COINBASE_ENTRYPOINT_V06)
          : 'no bytecode',
    },
    {
      label: 'Paymaster configured',
      ok: paymasterStatus.ok,
      hint: paymasterStatus.hint,
    },
    {
      label: 'VRF consumer configured',
      ok: vrfConsumerConfigured,
      hint: vrfConsumerConfigured && vrfConsumerAddress ? shortAddress(vrfConsumerAddress) : 'missing',
    },
    {
      label: 'Allowlist status',
      ok: allowlistReady,
      hint: allowlistMode === 'disabled' ? 'disabled' : isAllowlistedCreator ? 'allowed' : 'blocked',
    },
    {
      label: 'Creator coin detected',
      ok: creatorCoinReady,
      hint: creatorCoinReady ? (underlyingSymbolUpper || 'ok') : tokenIsValid ? 'not a creator coin' : 'invalid token',
    },
    {
      label: `Coin age ≥ ${minCoinAgeDays}d`,
      ok: coinAgeReady,
      hint:
        coinAgeDays !== null
          ? `${coinAgeDays.toFixed(1)}d`
          : typeof zoraCoin?.createdAt === 'string' && zoraCoin.createdAt.trim().length > 0
            ? 'invalid createdAt'
            : 'missing',
    },
    {
      label: 'Authorized + funded',
      ok: authReady && fundingReady,
      hint: authReady
        ? fundingReady
          ? 'ready'
          : `needs ${minFirstDepositDisplay} ${underlyingSymbolUpper || 'TOKENS'}`
        : 'not authorized',
    },
    {
      label: 'Market floor reference (UI only)',
      ok: true,
      hint: marketFloorQuery.isFetching
        ? 'computing'
        : marketFloorQuery.isError
          ? 'error'
          : marketFloorQuery.data?.weiPerToken
            ? `${Number(formatUnits(marketFloorQuery.data.weiPerToken, 18)).toFixed(6)} ETH`
            : 'missing',
    },
    {
      label: 'Ready to deploy',
      ok: canDeploy,
      hint: canDeploy ? 'ready' : 'missing requirements',
    },
  ] as const

  const deployBlocker =
    !tokenIsValid
      ? 'Enter a creator coin address to continue.'
      : tokenIsValid && !zoraCoin
        ? 'Token is not a Zora Creator Coin.'
        : tokenIsValid && zoraCoin && !isCreatorCoin
          ? 'Only Creator Coins can deploy a vault.'
          : tokenIsValid && zoraCoin && canonicalIdentityType === 'eoa'
            ? 'Deploy requires your canonical Coinbase Smart Wallet as sender. Connect with the canonical smart wallet identity.'
          : tokenIsValid && zoraCoin && isCreatorCoin && !coinAgeOk
            ? `Creator Coin must be at least ${minCoinAgeDays} days old to deploy.`
          : creatorAllowlistQuery.isLoading
            ? 'Checking vault allowlist…'
            : creatorAllowlistQuery.isError
              ? 'Vault allowlist check failed.'
              : allowlistEnforced && !isAllowlistedCreator
                ? 'Vault allowlist required.'
                : !creatorVaultBatcherConfigured
                  ? 'Deployment not configured (missing deployment batcher).'
                  : !isAuthorizedDeployerOrOperator
                    ? 'Connect the creator or CreatorCoin payout recipient wallet.'
                    : !fundingGateOk
                      ? `Needs ${minFirstDepositDisplay} ${underlyingSymbolUpper || 'TOKENS'} to deploy.`
                      : strictNoEoaEnforced && !strictNoEoaEligibility
                        ? NO_EOA_STRICT_BLOCKER
                      : identityBlockingReason
                        ? identityBlockingReason
                      : solanaMintOverrideInvalid
                        ? 'Solana mint override must be bytes32 hex (`0x` + 64 chars).'
                      : solanaDecimalsOverrideInvalid
                        ? 'Solana decimals override must be 0-255.'
                      : oneTimePrivyOwnerApprovalNeeded
                        ? connectedWalletAddress
                          ? 'One-time owner approval required before deploy. Approve your app Privy wallet as a canonical CSW owner so deploy-session server signing can run.'
                          : 'One-time owner approval required. Connect your canonical Base Account wallet, approve once for deploy-session server signing, then deploy.'
                      : !smartWalletCapabilityReady
                        ? hasDetectedZoraCrossAppWallet
                          ? 'Detected your Zora wallet, but this session is read-only for deploy signing. Reconnect with your canonical Base Account wallet and retry.'
                          : 'Smart wallet required. Sign in to 4626 to restore your canonical Coinbase Smart Wallet session, then connect via Base Account.'
                    : bytecodeInfraQuery.isFetching
                      ? 'Checking deployment bytecode store…'
                      : bytecodeInfraQuery.isError
                        ? (bytecodeInfraQuery.error as any)?.message || 'Deployment bytecode check failed.'
                        : !bytecodeInfraOk
                          ? bytecodeInfraBlocker || 'Deployment infra is not ready.'
                          : null

  const hasPrimaryDeployAuthAction = Boolean(
    privyReady &&
      (!privyAuthenticated || (!privySmartWalletAddress && !privyLinkedEoaAddress && !isConnected)),
  )

  return (
    <div className="vault-shell relative">
      <PageMeta title={META.deploy.title} description={META.deploy.description} canonicalPath="/deploy/vault" />
      <section className="cinematic-section">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <span className="label">Deploy</span>
                <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
                <p className="text-zinc-600 text-sm font-light">
                  Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy.
                </p>
                <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-[11px]">
                  <Link className="rounded-lg px-3 py-1 text-zinc-400 hover:text-white" to="/deploy/coin">
                    Coin
                  </Link>
                  <span className="rounded-lg bg-white/12 px-3 py-1 text-white">Vault</span>
                </div>
                {privyReady && privyAuthenticated && !smartWalletCapabilityReady ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: baseEase }}
                    className="mt-3 rounded-xl border border-amber-500/25 bg-linear-to-b from-amber-500/18 to-amber-500/8 px-4 py-3 text-[12px] text-amber-200/90 backdrop-blur-sm"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-amber-200/80 font-medium">
                      Active signer · external
                    </div>
                    <div className="mt-1 text-amber-200/80">
                      Connect an external wallet so 4626 can see the signer for this deploy session.
                    </div>
                    <div className="text-[10px] text-amber-200/60 mt-0.5">
                      Optional — use Rabby / MetaMask / Coinbase Wallet as a secondary signer.
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={externalWalletConnectBusy}
                        onClick={connectExternalSignerWallet}
                      >
                        {externalWalletConnectBusy ? 'Connecting…' : 'Connect external wallet'}
                      </button>
                    </div>
                    {externalWalletConnectError ? (
                      <div className="mt-2 text-[11px] text-red-300/90" role="alert">
                        {externalWalletConnectError}
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}
              </div>
              <div className="vault-pill normal-case tracking-[0.02em] px-3 py-1 gap-2">
                <img src="/protocols/base.png" alt="" aria-hidden="true" loading="lazy" className="w-3.5 h-3.5 opacity-90" />
                Base
              </div>
            </div>

          {oneTimePrivyOwnerApprovalNeeded ? (
              <div id="owner-approval-setup" className="rounded-lg border border-purple-500/28 bg-linear-to-b from-purple-500/16 to-purple-500/8 p-4 space-y-3 backdrop-blur-sm">
                <div className="text-sm font-medium text-purple-200">One-time wallet approval (recommended first step)</div>
                <div className="text-[11px] text-purple-200/75 leading-relaxed">
                  Before deploy, approve your app Privy wallet once as an owner of your canonical Coinbase Smart Wallet (EIP-1271).
                  This enables deploy-session and agent server signing. Your app sub-account remains your in-app execution wallet.
                </div>
                <div className="text-[11px] text-zinc-300/90">
                  Canonical wallet: <span className="font-mono">{shortAddress(canonicalIdentityAddress as Address)}</span>
                  {' · '}
                  App Privy wallet: <span className="font-mono">{shortAddress(privySmartWalletAddress as Address)}</span>
                </div>
                {addPrivySmartWalletOwnerProlinkQuery.isLoading ? (
                  <div className="text-[11px] text-zinc-400">Encoding Base App prolink…</div>
                ) : addPrivySmartWalletOwnerProlinkQuery.data ? (
                  <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">Base App prolink (same owner-add call)</div>
                    {addPrivySmartWalletOwnerProlinkUrl ? (
                      <a
                        href={addPrivySmartWalletOwnerProlinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-purple-300/30 bg-purple-400/10 px-2 py-1 text-[10px] text-purple-100 hover:bg-purple-400/20"
                      >
                        Open in Base App <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-zinc-300 font-mono break-all">{addPrivySmartWalletOwnerProlinkQuery.data}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                await navigator.clipboard.writeText(addPrivySmartWalletOwnerProlinkQuery.data ?? '')
                                return
                              }
                            } catch {
                              // ignore clipboard failures
                            }
                          })()
                        }}
                        className="shrink-0 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-zinc-300 hover:bg-black/40"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : addPrivySmartWalletOwnerProlinkQuery.error ? (
                  <div className="text-[11px] text-amber-200/80">
                    Prolink unavailable: {(addPrivySmartWalletOwnerProlinkQuery.error as Error)?.message}
                  </div>
                ) : null}
                {!connectedWalletAddress ? (
                  <div className="space-y-2">
                    <div className="text-[11px] text-amber-200/85">
                      Connect your canonical Base Account wallet to submit this one-time approval.
                    </div>
                    <button
                      type="button"
                      className="btn-secondary w-full sm:w-auto"
                      onClick={() => void login({ loginMethods: ['wallet'] })}
                    >
                      Connect Base Account Wallet
                    </button>
                  </div>
                ) : null}
                {connectedWalletAddress && !connectedWalletMatchesCanonical ? (
                  <div className="text-[11px] text-amber-200/85">
                    Connected signer does not match your canonical CSW. Reconnect with Base Account (canonical sender) or use the Base App prolink.
                  </div>
                ) : null}
                {addPrivySmartWalletOwnerTxHash ? (
                  <div className="text-[11px] text-green-400">
                    Approval submitted:{' '}
                    <a
                      href={`https://basescan.org/tx/${addPrivySmartWalletOwnerTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono underline"
                    >
                      {shortAddress(addPrivySmartWalletOwnerTxHash)}
                    </a>
                  </div>
                ) : null}
                {addPrivySmartWalletOwnerError ? (
                  <div className="text-[11px] text-red-400">{addPrivySmartWalletOwnerError}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleAddPrivyAppSmartWalletOwner()}
                  disabled={addPrivySmartWalletOwnerBusy || !connectedWalletAddress || !connectedWalletMatchesCanonical}
                  className="btn-primary w-full sm:w-auto"
                >
                  {addPrivySmartWalletOwnerBusy ? 'Waiting for wallet confirmation…' : 'Approve Once'}
                </button>
              </div>
            ) : null}

          {/* Deployment Status */}
          {justCompletedDeployment && justCompletedDeploymentIsComplete ? (
            <DeploymentSuccess
              deployment={justCompletedDeployment}
              tokenSymbol={underlyingSymbolUpper || undefined}
              shareSymbol={derivedShareSymbol || undefined}
              canonicalCswAddress={canonicalIdentityIsContract ? (canonicalIdentityAddress as Address) : null}
              embeddedEoaAddress={privyEmbeddedEoaAddress}
              privyWalletId={privyEmbeddedEoaWalletId}
            />
          ) : trackerDeploymentIsComplete && trackerDeployment ? (
            <AlreadyDeployedBanner
              deployment={trackerDeployment}
              tokenSymbol={underlyingSymbolUpper || undefined}
            />
          ) : null}
          {pendingJustCompletedDeployment ? (
            <div className="rounded-lg border border-amber-500/25 bg-linear-to-b from-amber-500/16 to-amber-500/8 p-4 text-[12px] text-amber-200/90 backdrop-blur-sm">
              Deployment is still finalizing on-chain. We now wait for the deferred auction (Phase 4) to be confirmed before
              marking this version complete.
            </div>
          ) : null}
          {staleIncompleteDeploymentRecord ? (
            <div className="rounded-lg border border-amber-500/25 bg-linear-to-b from-amber-500/16 to-amber-500/8 p-4 space-y-3 backdrop-blur-sm">
              <div className="text-[12px] text-amber-200">
                Found an older local deployment record for this version, but final on-chain completion is missing. You can resume
                deployment now.
              </div>
              <button
                type="button"
                className="btn-secondary text-[12px]"
                onClick={() => {
                  deploymentTracker.clearCurrentDeployment()
                  setJustCompletedDeployment(null)
                }}
              >
                Clear stale local record
              </button>
            </div>
          ) : null}

          {alreadyDeployed && (() => {
            const shareOft = justCompletedDeployment?.contracts.shareOFT ?? trackerDeployment?.contracts.shareOFT
            const creatorCoin = justCompletedDeployment?.creatorToken ?? trackerDeployment?.creatorToken
            return shareOft && isAddress(shareOft) && creatorCoin && isAddress(creatorCoin) ? (
              <div className="vault-surface-muted vault-hover-lift p-6 space-y-4">
                <div className="space-y-1">
                  <div className="label">Vault token icon</div>
                  <div className="text-xs text-zinc-600">
                    Generate a custom AI-composed icon using the 4626 frame and your Zora creator coin image. Edit the instruction and hit Generate — the result becomes the token image served by 4626.fun.
                  </div>
                </div>
                <VaultImageGenerator
                  vaultAddress={shareOft}
                  creatorCoinAddress={creatorCoin}
                  tokenSymbol={underlyingSymbolUpper || undefined}
                />
              </div>
            ) : null
          })()}

          {!alreadyDeployed && isAdmin ? (
              <div className="rounded-lg border border-amber-500/25 bg-linear-to-b from-amber-500/16 to-amber-500/8 p-4 space-y-2 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-wide text-amber-200">Launch checklist (admin)</div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>Min coin age (days)</span>
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      step={1}
                      value={minCoinAgeDays}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isFinite(n)) return
                        const clamped = Math.max(0, Math.min(3650, Math.floor(n)))
                        setMinCoinAgeDays(clamped)
                      }}
                      className="w-16 bg-black/30 border border-zinc-900/70 rounded-md px-2 py-1 text-zinc-200 font-mono text-[11px] outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  {firstLaunchChecklist.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <span className={`mt-[5px] h-1.5 w-1.5 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <span>{item.label}</span>
                        {item.hint ? (
                          <span className="ml-2 text-[11px] text-zinc-500 font-mono">{item.hint}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!alreadyDeployed && (
            <div className="vault-surface vault-hover-lift p-7 sm:p-8 space-y-6">
              {/* Review */}
              {tokenIsValid ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden"
                >
                  {symbolLoading || zoraLoading ? (
                    <LoadingText intent="processing" labelOverride="Loading coin details..." />
                  ) : !zoraCoin ? (
                    <div className="text-sm text-red-400/80">
                      This token does not appear to be a Zora Coin. Creator Vaults can only be created for Zora{' '}
                      <span className="text-zinc-200">Creator Coins</span>.
                    </div>
                  ) : baseSymbol ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex items-center gap-4 min-w-0">
                          {zoraCoin?.mediaContent?.previewImage?.medium ? (
                            <img
                              src={zoraCoin.mediaContent.previewImage.medium}
                              alt={zoraCoin.symbol ? String(zoraCoin.symbol) : 'Coin'}
                              className="w-14 h-14 rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-linear-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center text-sm font-medium text-brand-accent">
                              {String(baseSymbol).slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-white font-light text-xl">
                              {zoraCoin?.name
                                ? String(zoraCoin.name)
                                : tokenName
                                  ? String(tokenName)
                                  : String(baseSymbol)}
                              {baseSymbol && showSymbolInReviewHeading ? (
                                <span className="text-zinc-500"> ({`$${String(baseSymbol)}`})</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-zinc-600 font-mono mt-1">{String(creatorToken)}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-medium ${coinTypePillClass}`}>
                            {coinTypeLabel}
                          </span>
                        </div>
                      </div>

                      {String(zoraCoin?.coinType ?? '').toUpperCase() === 'CONTENT' && (
                        <div className="text-xs text-amber-300/90">
                          This is a <span className="font-mono">Content Coin</span>. Creator Vaults can only be created for{' '}
                          <span className="font-mono">Creator Coins</span>.
                        </div>
                      )}

                      {hasWallet && zoraCoin?.creatorAddress && !isAuthorizedDeployerOrOperator && (
                        <div className="text-xs text-red-400/90">
                          You are connected as{' '}
                          <span className="font-mono">
                            {effectiveWalletAddress?.slice(0, 6)}…{effectiveWalletAddress?.slice(-4)}
                          </span>
                          . Only the coin creator or current payout recipient can deploy this vault.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-red-400/80">Could not read token. Is this a valid ERC-20?</div>
                  )}
                </motion.div>
              ) : null}

            {/* Deploy */}
            <div className={`space-y-5 ${tokenIsValid ? 'pt-5 border-t border-zinc-900/50' : ''}`}>
              <div className="space-y-1.5">
                <div className="label">Deploy</div>
                <div className="text-xs text-zinc-500">Confirm the plan, run dry-run if needed, then deploy.</div>
              </div>
              {/* Auth flow */}
              {!privyReady ? (
                <div className="text-sm text-zinc-500 text-center py-4">
                  <LoadingInline intent="session" labelOverride="Loading..." />
                </div>
              ) : !privyAuthenticated ? (
                <button
                  type="button"
                  className="btn-accent w-full"
                  onClick={() => void login({ loginMethods: ['wallet'] })}
                >
                  Sign in to Deploy
                </button>
              ) : !privySmartWalletAddress && !privyLinkedEoaAddress && !isConnected ? (
                <div className="space-y-2">
                  <div className="text-sm text-amber-300/80">Connect your wallet to continue</div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={() => void login({ loginMethods: ['wallet'] })}
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : !tokenIsValid && creatorAllowlistQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking vault allowlist…
                </button>
              ) : !tokenIsValid && creatorAllowlistQuery.isError ? (
                <RequestCreatorAccess />
              ) : !tokenIsValid && allowlistEnforced && !isAllowlistedCreator ? (
                <RequestCreatorAccess />
              ) : tokenIsValid && zoraCoin && String(zoraCoin.coinType ?? '').toUpperCase() !== 'CREATOR' ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Not eligible: vaults are Creator Coin–only
                </button>
              ) : tokenIsValid && (symbolLoading || zoraLoading) ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  <LoadingInline intent="processing" labelOverride="Loading..." />
                </button>
              ) : tokenIsValid && zoraCoin && identityBlockingReason ? (
                <div className="p-4 bg-linear-to-b from-amber-500/16 to-amber-500/8 border border-amber-500/25 rounded-lg space-y-2 backdrop-blur-sm">
                  <div className="text-amber-300/90 text-sm font-medium">Identity mismatch</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">{identityBlockingReason}</div>
                </div>
              ) : tokenIsValid && zoraCoin && !isAuthorizedDeployerOrOperator ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Authorized only: connect the coin’s canonical identity wallet to deploy.
                </button>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking vault allowlist…
                </button>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isError ? (
                <RequestCreatorAccess coin={creatorToken} />
              ) : tokenIsValid && zoraCoin && allowlistEnforced && !isAllowlistedCreator ? (
                <RequestCreatorAccess coin={creatorToken} />
              ) : tokenIsValid && zoraCoin && !creatorVaultBatcherConfigured ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Deployment is not configured (missing deployment batcher address)
                </button>
              ) : tokenIsValid && zoraCoin && !walletHasMinDeposit ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {`Creator smart wallet needs ${minFirstDepositDisplay} ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`}
                </button>
              ) : oneTimePrivyOwnerApprovalNeeded ? (
                <button
                  type="button"
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-500 text-sm"
                  onClick={() => {
                    if (typeof document === 'undefined') return
                    document.getElementById('owner-approval-setup')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  Complete one-time wallet approval above to continue.
                </button>
              ) : canDeploy ? (
                <>
                  <DeployVaultBatcher
                    creatorToken={creatorToken as Address}
                    owner={identity.canonicalIdentity.address as Address}
                    minFirstDeposit={minFirstDeposit}
                    tokenDecimals={typeof tokenDecimals === 'number' ? tokenDecimals : null}
                    depositSymbol={underlyingSymbolUpper || 'TOKENS'}
                    shareSymbol={derivedShareSymbol}
                    shareName={derivedShareName}
                    vaultSymbol={derivedVaultSymbol}
                    vaultName={derivedVaultName}
                    deploymentVersion={deploymentVersion}
                    getAccessToken={getAccessToken}
                    signInWithPrivyToken={siwe?.signInWithPrivyToken}
                    shareOftSaltOverride={shareOftSaltOverride}
                    currentPayoutRecipient={payoutRecipient}
                    marketFloorText={marketFloorText}
                    floorPriceQ96Aligned={marketFloorQuery.data?.floorPriceQ96Aligned ?? null}
                    onSuccess={handleDeploymentSuccess}
                    switchAuthCta={switchAuthCta}
                    smartWalletClient={smartWalletClient}
                    canonicalSmartWallet={canonicalIdentityIsContract ? (canonicalIdentityAddress as Address) : null}
                    privySmartWalletAddress={privySmartWalletAddress}
                    privySmartWalletIsCanonicalOwner={privySmartWalletIsCanonicalOwner}
                    privySmartWalletCanSign={privySmartWalletCanSign}
                    privyEmbeddedEoaWallet={privyEmbeddedEoaWallet}
                    privyEmbeddedEoaAddress={privyEmbeddedEoaAddress}
                    privyEmbeddedEoaIsCanonicalOwner={privyEmbeddedEoaIsCanonicalOwner}
                    privyEmbeddedEoaCanSign={privyEmbeddedEoaCanSign}
                    connectedEoaOwnerReady={connectedEoaOwnerReady}
                    strictNoEoaMode={strictNoEoaMode}
                    solanaMintOverride={solanaMintOverride}
                    solanaDecimalsOverride={solanaDecimalsOverride}
                    connectorId={connector?.id}
                    wagmiWalletClient={walletClient}
                  />
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {deployBlocker || 'Enter token address to continue'}
                </button>
              )}


              {!canDeploy && deployBlocker ? (
                <div className="space-y-2">
                  <div className="text-xs text-amber-300/80">{deployBlocker}</div>
                  {!hasPrimaryDeployAuthAction && !privySmartWalletReady && switchAuthCta ? (
                    <button type="button" className="btn-primary w-full" onClick={switchAuthCta.onClick}>
                      {switchAuthCta.label}
                    </button>
                  ) : null}
                  {!creatorCoinReady ? (
                    <div className="space-y-3 rounded-lg border border-amber-500/25 bg-linear-to-b from-amber-500/16 to-amber-500/8 p-3 backdrop-blur-sm">
                      <div className="text-[11px] text-amber-200 font-medium">Creator Coin required before vault deploy</div>
                      <div className="text-[11px] text-amber-100/80">
                        Create your Zora Creator Coin first, then this page will resume vault deployment with the detected coin.
                      </div>
                      {canCreateCoinInApp && canonicalIdentityIsContract ? (
                        <LaunchCoinCard
                          smartWalletAddress={canonicalIdentityAddress}
                          ownerAddress={connectedWalletAddress}
                          onCoinCreated={(coinAddress) => setCreatorToken(coinAddress)}
                        />
                      ) : (
                        <a
                          href={zoraCoinHandoffHref}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-400/20"
                        >
                          Create or claim on Zora <ChevronDown className="h-3 w-3 -rotate-90" />
                        </a>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {debugControlsVisible ? (
                <div className="flex items-center justify-between text-[10px] text-zinc-600">
                  <span>Debug logs: {AA_DEBUG ? 'on' : 'off'}</span>
                  <button type="button" className="underline" onClick={toggleDebugLogs}>
                    {AA_DEBUG ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ) : null}

              <div className="text-xs text-zinc-600">
                Requires a {minFirstDepositDisplay} {underlyingSymbolUpper || 'TOKENS'} deposit. Some wallets may prompt multiple confirmations.
              </div>
            </div>
            </div>
          )}

          </div>
        </div>
      </section>
    </div>
  )
}
