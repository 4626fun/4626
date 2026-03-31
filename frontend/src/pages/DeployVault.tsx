import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  formatUnits,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  parseAbiParameters,
  toHex,
  toBytes,
} from 'viem'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { ChevronDown } from 'lucide-react'
import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privyEmbeddedEoa'
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { LaunchCoinCard } from '@/components/waitlist/LaunchCoinCard'
import { CONTRACTS } from '@/config/contracts'
import { useCreatorAllowlist, useDeploymentTracker } from '@/hooks'
import { DeploymentSuccess, AlreadyDeployedBanner } from '@/components/DeploymentSuccess'
import { VaultImageGenerator } from '@/components/VaultImageGenerator'
import type { DeploymentRecord } from '@/hooks/useDeploymentTracker'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'
import { logger } from '@/lib/logger'
import { appendBuilderSuffixToHex } from '@/lib/baseBuilderCodes'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { resolveCreatorIdentity } from '@/lib/identity/creatorIdentity'
import { ensureProviderOnBase, ensureWagmiChainOnBase } from '@/lib/wallet/safeSwitchToBase'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import {
  normalizeUnderlyingSymbol,
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
  underlyingSymbolUpper as deriveUnderlyingUpper,
} from '@/lib/tokenSymbols'
import { computeMarketFloorQuote } from '@/lib/cca/marketFloor'
import { q96ToCurrencyPerTokenBaseUnits } from '@/lib/cca/q96'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { buildPermit2SignatureTransfer, createPermit2Deadline, createPermit2Nonce } from '@/lib/deploy/permit2'
import {
  postDeploySessionRequestWithAuthRetry,
  resumeAndPollDeploySession,
  type DeploySessionStatusData,
} from '@/lib/deploy/sessionClient'
import { 
  sendCoinbaseSmartWalletUserOperation, 
  simulateSmartWalletCalls,
  ERC4337_ENTRYPOINT_V06,
  assertEntryPointV06,
} from '@/lib/aa/coinbaseErc4337'
import { PageMeta, META } from '@/components/seo/PageMeta'

const DEFAULT_MIN_FIRST_DEPOSIT_TOKENS = 50_000_000n
const MIN_FIRST_DEPOSIT = DEFAULT_MIN_FIRST_DEPOSIT_TOKENS * 10n ** 18n
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')
const BASE_SWAP_ROUTER = addr('2626664c2603336E57B271c5C0b26F421741e481')
const BASE_WETH = addr('4200000000000000000000000000000000000006')
const BASE_USDC = addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const BASE_CHAINLINK_ETH_USD = addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const DEFAULT_PAYOUT_ROUTER_ZORA_WETH_FEE = 10_000
const DEFAULT_PAYOUT_ROUTER_WETH_CREATOR_FEE = 10_000
const PAYOUT_ROUTER_SALT_TAG = '4626:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = '4626:VaultShareBurnStream' as const
const CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG = '4626:CreatorCoinPolicyController' as const

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
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)
const DEFAULT_SHARE_OFT_VANITY_SUFFIX = '4626'
const DEFAULT_SHARE_OFT_VANITY_MAX_TRIES = 1_000_000
const BATCHER_PHASE1_WITH_SALT_SELECTOR = '297cb1e6'
const BATCHER_PHASE1_CORE_SELECTOR = '1331378b'
const BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR = '4154f24e'
const BATCHER_PHASE1_FINALIZE_SELECTOR = 'a98ec9d8'
const BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR = '3bc09a8b'
const BATCHER_PHASE2_FINALIZE_WITH_PERMIT2_SELECTOR = '0ecf9382'
// The phased deployment batcher v4+ exposes these immutables as getters. We use this as a
// compatibility gate to avoid legacy batchers that deploy module-uninitialized vaults.
const BATCHER_VAULT_CORE_MODULE_SELECTOR = '22c40b75'
const BATCHER_VAULT_STRATEGIES_MODULE_SELECTOR = '3283d513'
const BATCHER_VAULT_ADMIN_MODULE_SELECTOR = '822f9d9b'
const NO_EOA_STRICT_BLOCKER =
  'No-EOA deploy requires a preconfigured Privy owner signer that can sign on Base. Restore your 4626 connection to refresh wallet linkage.'
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
  // Keep deploy on the single proven path:
  // canonical CSW + connected owner/signer flow.
  // Ignore strict no-EOA runtime toggles to avoid accidental lockouts.
  return 'default'
}

// Minimum age for a Creator Coin before allowing vault deployment.
// Rationale: reduce launch-manipulation surface area on brand new coins with thin/no trading history.
const DEFAULT_MIN_COIN_AGE_DAYS = 7
const MIN_COIN_AGE_LOCALSTORAGE_KEY = 'cv:deploy:minCoinAgeDays'
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`
const MAX_UINT256 = (1n << 256n) - 1n
const DEFAULT_DEPLOYMENT_VERSION = 'v1.3.11'
const DEPLOYMENT_VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

function isDebugEnabled(): boolean {
  if (import.meta.env.VITE_DEBUG_LOGS === 'true') return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

const AA_DEBUG = isDebugEnabled()

const HEX_STRING_RE = /^0x[0-9a-fA-F]+$/
const HEX_SUFFIX_RE = /^[0-9a-fA-F]+$/

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_STRING_RE.test(value)
}

function getHexByteLength(hex: string): number | null {
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  return body.length / 2
}

function normalizeBytes32(value: unknown): Hex | null {
  if (!isHexString(value)) return null
  if (getHexByteLength(value) !== 32) return null
  if (value.toLowerCase() === ZERO_BYTES32) return null
  return value as Hex
}

function normalizeAddressLike(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  if (!isAddress(value)) return null
  try {
    return getAddress(value)
  } catch {
    return null
  }
}

function sameAddress(a: unknown, b: unknown): boolean {
  const left = normalizeAddressLike(a)
  const right = normalizeAddressLike(b)
  if (left && right) return left === right
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
}

function parseUint8(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return null
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= 255) return Math.floor(n)
  }
  return null
}

function parseUniswapV3Fee(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = Math.floor(value)
    if (parsed > 0 && parsed <= 1_000_000) return parsed
    return null
  }
  if (typeof value === 'string') {
    const v = value.trim()
    if (!v) return null
    const parsed = Number(v)
    if (!Number.isFinite(parsed)) return null
    const normalized = Math.floor(parsed)
    if (normalized > 0 && normalized <= 1_000_000) return normalized
  }
  return null
}

function encodeUniswapV3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length < 2) throw new Error('Uniswap path requires at least two tokens')
  if (fees.length !== tokens.length - 1) throw new Error('Uniswap path fee count mismatch')
  let out = `0x${tokens[0].slice(2)}`
  for (let i = 0; i < fees.length; i += 1) {
    const fee = fees[i]
    if (!Number.isInteger(fee) || fee <= 0 || fee > 1_000_000) {
      throw new Error(`Invalid Uniswap fee tier: ${fee}`)
    }
    out += fee.toString(16).padStart(6, '0')
    out += tokens[i + 1].slice(2)
  }
  return out as Hex
}

function parsePositiveTokenAmount(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return BigInt(Math.floor(value))
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '')
    if (!cleaned) return null
    if (!/^\d+$/.test(cleaned)) return null
    const parsed = BigInt(cleaned)
    return parsed > 0n ? parsed : null
  }
  return null
}

function normalizeDeploymentVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  if (!DEPLOYMENT_VERSION_RE.test(v)) return null
  return v
}

function resolveDeploymentVersionFromRuntime(): string {
  const envVersion = normalizeDeploymentVersion(import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined)
  if (typeof window === 'undefined') return envVersion ?? DEFAULT_DEPLOYMENT_VERSION
  const params = new URLSearchParams(window.location.search)
  const queryVersion = normalizeDeploymentVersion(params.get('deploymentVersion'))
  return queryVersion ?? envVersion ?? DEFAULT_DEPLOYMENT_VERSION
}

function normalizeHexSuffix(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const cleaned = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!cleaned || cleaned.length > 40) return null
  if (!HEX_SUFFIX_RE.test(cleaned)) return null
  return cleaned.toLowerCase()
}

async function findCreate2SaltForSuffix(params: {
  create2Deployer: Address
  initCode: Hex
  suffix: string
  maxTries: number
  yieldEvery?: number
  startAt?: bigint
  isAddressDeployed?: (addr: Address) => Promise<boolean>
}): Promise<Hex | null> {
  const suffix = normalizeHexSuffix(params.suffix)
  if (!suffix) return null
  const bytecodeHash = keccak256(params.initCode)
  const maxTries = Math.max(1, Math.floor(params.maxTries))
  const yieldEvery = Math.max(256, Math.floor(params.yieldEvery ?? 4096))
  const startAt = typeof params.startAt === 'bigint' ? params.startAt : 0n

  for (let i = 0; i < maxTries; i += 1) {
    const salt = toHex((startAt + BigInt(i)) & MAX_UINT256, { size: 32 }) as Hex
    const addr = getCreate2Address({ from: params.create2Deployer, salt, bytecodeHash })
    if (addr.slice(-suffix.length).toLowerCase() === suffix) {
      if (params.isAddressDeployed) {
        try {
          const deployed = await params.isAddressDeployed(addr)
          if (deployed) {
            continue
          }
        } catch {
          // If we can't check, still allow this salt.
        }
      }
      return salt
    }
    if (i > 0 && i % yieldEvery === 0) {
      // Yield to keep UI responsive on slower devices.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  return null
}
function signatureMeta(signature: Hex) {
  const byteLength = getHexByteLength(signature)
  return {
    signatureLength: signature.length,
    byteLength,
    is64Bytes: byteLength === 64,
    is65Bytes: byteLength === 65,
  }
}

function logNonEoaSignature(signature: Hex, context: string) {
  const meta = signatureMeta(signature)
  if (meta.byteLength !== 65 && AA_DEBUG) {
    logger.warn('[DeployVault] Non-EOA signature detected', {
      context,
      ...meta,
    })
  }
  return meta
}

type SignatureExtraction = { signature: Hex | null; source: string | null }

function extractSignatureHex(value: unknown, depth = 0): SignatureExtraction {
  if (isHexString(value)) {
    return { signature: value as Hex, source: depth === 0 ? 'string' : `nested.${depth}` }
  }
  if (!value || typeof value !== 'object' || depth > 2) {
    return { signature: null, source: null }
  }
  const record = value as Record<string, unknown>
  const direct = record.signature ?? record.sig
  if (isHexString(direct)) {
    return { signature: direct as Hex, source: 'object.signature' }
  }
  const candidates: Array<[string, unknown]> = [
    ['data', record.data],
    ['result', record.result],
    ['response', record.response],
    ['signature', record.signature],
    ['sig', record.sig],
  ]
  for (const [key, candidate] of candidates) {
    if (isHexString(candidate)) {
      return { signature: candidate as Hex, source: `object.${key}` }
    }
    if (candidate && typeof candidate === 'object') {
      const nested = extractSignatureHex(candidate, depth + 1)
      if (nested.signature) {
        return { signature: nested.signature, source: `object.${key}.${nested.source ?? 'nested'}` }
      }
    }
  }
  return { signature: null, source: null }
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  const { signature, source } = extractSignatureHex(value)
  if (!signature) {
    throw new Error(`Invalid signature returned from ${context}`)
  }
  if (AA_DEBUG) {
    logger.debug(`[DeployVault] ${context} signature`, {
      source: source ?? 'unknown',
      ...signatureMeta(signature),
    })
  }
  return signature
}

function isUserRejectedErrorMessage(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('action_rejected') ||
    lower.includes('user denied') ||
    lower.includes('user cancelled')
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || ''
  return String((error as any)?.message ?? error ?? '')
}

function isTransientRpcFailure(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase()
  const code = Number((error as any)?.code ?? (error as any)?.cause?.code ?? NaN)
  if (code === 429 || code === -32016 || code === -32011) return true
  return (
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('over rate limit') ||
    lower.includes('rate limit') ||
    lower.includes('requested resource not available') ||
    lower.includes('resource not available') ||
    lower.includes('no backend is currently healthy') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch')
  )
}

function debugSignatureReady(context: string, signature: Hex, details?: Record<string, unknown>) {
  if (!AA_DEBUG) return
  logger.debug('[DeployVault] UserOp signature ready', {
    context,
    ...signatureMeta(signature),
    ...(details ?? {}),
  })
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
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

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type AdminAuthResponse = { address: string; isAdmin: boolean } | null
type DeployRuntimeConfigResponse = {
  creatorVaultBatcher: Address | null
  deploymentVersion: string
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
  payoutRouterKeeperAddress: Address | null
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

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
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

function isPaymasterProxyUrl(value: string): boolean {
  const v = String(value ?? '').trim()
  if (!v) return false
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(v, base) : new URL(v)
    return u.pathname === '/api/paymaster'
  } catch {
    return v === '/api/paymaster' || v.endsWith('/api/paymaster')
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
    console.error('[DeployVault] Error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState((s) => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="vault-shell min-h-screen bg-vault-bg text-white">
          <section className="max-w-[1400px] mx-auto px-6 py-16">
            <div className="text-[10px] font-medium text-zinc-500 mb-4">Deploy</div>
            <div className="vault-surface vault-hover-lift p-8 space-y-4">
              <div className="text-lg font-medium text-red-400">Something went wrong</div>
              <div className="text-sm text-zinc-400 leading-relaxed">
                The deploy page encountered an error. This may be due to wallet extension conflicts or a temporary issue.
              </div>
              <div className="text-xs text-zinc-600 font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </div>
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

  // Privy is used for auth/session - if not configured, show setup hint
  if (privyClientStatus !== 'ready') {
    return (
      <div className="vault-shell min-h-screen bg-vault-bg text-white">
        <section className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="text-[10px] font-medium text-zinc-500 mb-4">Deploy</div>
          <div className="vault-surface vault-hover-lift p-8 space-y-3">
            <div className="text-lg font-medium">Authentication not configured</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              Deploy requires Privy for authentication. Your Coinbase Smart Wallet will be used for signing.
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

function derivePayoutRouterSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [PAYOUT_ROUTER_SALT_TAG, params.creatorToken, params.owner]),
  )
}

function deriveVaultShareBurnStreamSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [BURN_STREAM_SALT_TAG, params.creatorToken, params.owner]),
  )
}

function deriveCreatorCoinPolicyControllerSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(
      ['string', 'address', 'address'],
      [CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG, params.creatorToken, params.owner],
    ),
  )
}

function deriveShareOftSalt(params: { owner: Address; shareSymbol: string; version: string }): Hex {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['4626:OFTBootstrapRegistry:v1']))
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
    logger.warn('[DeployVault] stale_runtime_config_detected_auto_reload', {
      reason: params.reason,
      clientValue: params.clientValue,
      runtimeValue: params.runtimeValue,
      href: window.location.href,
    })
    // Force a hard navigation to refresh import.meta.env-backed config after local fork restart.
    window.location.reload()
    return true
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
    name: 'setKeeper',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newKeeper', type: 'address' }],
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

const CREATE2_DEPLOYER_STORE_ABI = [
  {
    type: 'function',
    name: 'store',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

function AddressRow({ label, address }: { label: string; address: Address | null | undefined }) {
  const a = address ? String(address) : ''
  const ok = a && a !== String(ZERO_ADDRESS)
  const href = ok ? `https://basescan.org/address/${a}` : null
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <div className="text-zinc-500">{label}</div>
      {ok && href ? (
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
  deploymentVersion,
  shareOftSaltOverride,
  currentPayoutRecipient,
  floorPriceQ96Aligned,
  marketFloorTwapDurationSec,
  marketFloorDiscountBps,
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
  floorPriceQ96Aligned: bigint | null
  marketFloorTwapDurationSec: number | null
  marketFloorDiscountBps: number | null
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
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: base.id })
  // Legacy ShareOFT Solana overrides are intentionally unused in main deploy flow now.
  void solanaMintOverride
  void solanaDecimalsOverride
  
  // Detect Coinbase Wallet direct connection (not via Privy)
  const isCoinbaseWalletDirect = connectorId === 'coinbaseWalletSDK' || connectorId === 'com.coinbase.wallet'
  // In strict no-EOA mode we still permit a verified connected owner EOA to unblock deploys.
  const strictNoEoaEnforced = strictNoEoaMode && !connectedEoaOwnerReady

  // NOTE: Zora cross-app integration is read-only in this app, so we do not use it for signing/transactions.

  const ensureBaseChain = useCallback(async (label: string) => {
    await ensureWagmiChainOnBase({
      currentChainId: chainId,
      switchChainAsync,
      label,
    })
  }, [chainId, switchChainAsync])

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
  const [txId, setTxId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'done'>('idle')
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
    if (strictNoEoaEnforced) return false
    // Enforce server-continue for default deploy mode:
    // one owner-EOA setup tx, then all phases run server-side.
    return true
  }, [strictNoEoaEnforced])
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
  const postDeploySessionJson = useCallback(
    async <T,>(params: {
      url: string
      body: unknown
      label: string
    }): Promise<ApiEnvelope<T>> => {
      return await postDeploySessionRequestWithAuthRetry<T>({
        postJson: postJsonWithTimeout,
        url: params.url,
        body: params.body,
        label: params.label,
        ensurePaymasterSession,
      })
    },
    [ensurePaymasterSession],
  )
  const switchAuthLabel = typeof switchAuthCta?.label === 'string' && switchAuthCta.label.trim().length > 0 ? switchAuthCta.label.trim() : null

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
      lower.includes('metamask') &&
      (lower.includes('not found') ||
        lower.includes('failed to connect') ||
        lower.includes('cannot set property ethereum') ||
        lower.includes('only a getter'))
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
        ' ' +
        'If needed, disable server-continue (`VITE_DEPLOY_USE_SERVER_CONTINUE=false`) and run phases client-side.'
      )
    }
    if (lower.includes('session_owner_not_installed') || lower.includes('deploy-session signer is not installed')) {
      return (
        'Deploy-session signer is not installed on your canonical smart wallet yet. ' +
        'Approve the one-time add-owner transaction from an owner EOA (for example Coinbase Wallet), then retry deploy.'
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
        'Wallet request was cancelled. Approve the wallet prompt to continue deploy, or reconnect your owner EOA/WalletConnect session and retry.'
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
        'Sign in to 4626 to restore your embedded signer, or use Coinbase Wallet (Base Account), then retry. If you just added a new owner, refresh and retry.'
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
      return 'Deployment is not configured: missing `VITE_CREATOR_VAULT_BATCHER` / `CONTRACTS.creatorVaultBatcher`.'
    }
    return msg
  }, [switchAuthLabel])

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
          logger.warn('[DeployVault] Privy embedded EOA addOwner UserOp failed; trying smart wallet or fallback', {
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
                'Privy smart wallet signer not supported. Use Coinbase Wallet (Base Account) or connect an owner EOA.',
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
                'Privy smart wallet signer not supported. Use Coinbase Wallet (Base Account) or connect an owner EOA.',
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
          logger.warn('[DeployVault] Privy smart wallet addOwner UserOp failed; trying fallback', {
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

    // Fallback: external owner EOA + direct tx (existing behavior)
    if (!connectedAddress || !wagmiWalletClient || sameAddress(connectedAddress, owner)) {
      throw new Error(
        'Deploy session signer is not installed. Connect an owner EOA wallet (for example Coinbase Wallet) and retry.',
      )
    }

    const callerIsOwner = await isCoinbaseSmartWalletOwner({
      smartWallet: owner,
      ownerAddress: connectedAddress as Address,
    })
    if (!callerIsOwner) {
      throw new Error('Connected wallet is not an owner of your canonical smart wallet.')
    }

    await ensureBaseChain('Owner wallet')

    if (publicClient) {
      try {
        await publicClient.simulateContract({
          account: connectedAddress as Address,
          address: owner,
          abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
          functionName: 'addOwnerAddress',
          args: [sessionSigner],
        })
      } catch (simErr: unknown) {
        const simMessage = simErr instanceof Error ? simErr.message : String(simErr)
        if (/AlreadyOwner/i.test(simMessage)) {
          installed = true
        }
      }
    }

    if (!installed) {
      const rawTxHash = await (wagmiWalletClient as any).sendTransaction({
        to: owner,
        data: addOwnerData,
        value: 0n,
        account: connectedAddress as Address,
        chain: base,
      })
      const txHash = ensureSignatureHex(rawTxHash, 'ownerWallet.sendTransaction(addOwner)') as Hex
      if (txHash.length !== 66) throw new Error('Invalid tx hash returned from owner wallet')
      setTxId(txHash)
      if (!publicClient) throw new Error('Missing Base public client')
      await publicClient.waitForTransactionReceipt({ hash: txHash })
    }

    installed = await isCoinbaseSmartWalletOwner({ smartWallet: owner, ownerAddress: sessionSigner })
    if (!installed) throw new Error('session_owner_not_installed')
  }, [
    connectedAddress,
    ensureBaseChain,
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
    wagmiWalletClient,
  ])

  const pollServerDeploySession = useCallback(async (sessionId: string) => {
    const isHexHash = (value: unknown): value is Hex => typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
    const applyStatus = (statusData: DeploySessionStatusData) => {
      const step = String(statusData.step ?? '')
      const lastTxHash = typeof statusData.lastTxHash === 'string' ? statusData.lastTxHash : null
      const lastUserOpHash = typeof statusData.lastUserOpHash === 'string' ? statusData.lastUserOpHash : null
      const lastError = statusData.lastError ? String(statusData.lastError) : null
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
      if (step === 'created' || step.startsWith('phase1')) setPhase('phase1')
      else if (step.startsWith('phase2')) setPhase('phase2')
      else if (step.startsWith('phase3')) setPhase('phase3')
      else if (step.startsWith('phase4')) setPhase('phase4')
      if (lastTxHash && isHexHash(lastTxHash)) {
        setPhaseTxs((s) => {
          if (step.startsWith('phase1')) return { ...s, tx1: lastTxHash as Hex }
          if (step.startsWith('phase2')) return { ...s, tx2: lastTxHash as Hex }
          if (step.startsWith('phase3')) return { ...s, tx3: lastTxHash as Hex }
          if (step.startsWith('phase4')) return { ...s, tx4: lastTxHash as Hex }
          return s
        })
      }
    }

    const completed = await resumeAndPollDeploySession({
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

  const batcherAddress = (CONTRACTS.creatorVaultBatcher ?? null) as Address | null

  const marketFloorWeiPerTokenAligned = useMemo(() => {
    if (!floorPriceQ96Aligned || floorPriceQ96Aligned <= 0n) return null
    // ShareOFT (■token) uses 18 decimals, so convert Q96 → wei/token using 18.
    return q96ToCurrencyPerTokenBaseUnits(floorPriceQ96Aligned, 18)
  }, [floorPriceQ96Aligned])

  const marketFloorText = useMemo(() => {
    if (!marketFloorWeiPerTokenAligned) return null
    const ethShort = formatEthPerTokenForUi(marketFloorWeiPerTokenAligned)

    const duration = typeof marketFloorTwapDurationSec === 'number' ? marketFloorTwapDurationSec : null
    const mins = duration && duration > 0 ? Math.round(duration / 60) : null

    const discount = typeof marketFloorDiscountBps === 'number' ? marketFloorDiscountBps : null
    const bufferBps = discount !== null ? Math.max(0, 10_000 - discount) : null
    const bufferPct = bufferBps !== null ? Math.round(bufferBps / 100) : null

    const meta = [
      mins ? `TWAP ${mins}m` : null,
      bufferPct !== null ? `-${bufferPct}% buffer` : null,
    ]
      .filter(Boolean)
      .join(', ')

    return meta ? `${ethShort} ETH / ${shareSymbol} (${meta})` : `${ethShort} ETH / ${shareSymbol}`
  }, [marketFloorWeiPerTokenAligned, marketFloorTwapDurationSec, marketFloorDiscountBps, shareSymbol])

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
      const supportsPhase1WithSalt = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        const bytecodeLower = batcherBytecode.toLowerCase()
        const supportsLegacySalt = bytecodeLower.includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
        const supportsSplitSalt =
          bytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
          bytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
        return supportsLegacySalt || supportsSplitSalt
      })()

      const baseSalt = deriveBaseSalt({ creatorToken, owner, chainId: base.id, version: deploymentVersion })
      const vaultSalt = saltFor(baseSalt, 'vault')
      const wrapperSalt = saltFor(baseSalt, 'wrapper')
      const gaugeSalt = saltFor(baseSalt, 'gauge')
      const ccaSalt = saltFor(baseSalt, 'cca')
      const oracleSalt = saltFor(baseSalt, 'oracle')

      const oftBootstrapSalt = deriveOftBootstrapSalt()

      const oftBootstrapRegistry = predictCreate2Address({
        create2Deployer,
        salt: oftBootstrapSalt,
        initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
      })

      // IMPORTANT: The onchain deployment batcher uses *lowercase* symbols for salts + oracle wiring,
      // but uses *uppercase* symbols for ShareOFT metadata. We must mirror both to keep expected
      // addresses deterministic (especially for ShareOFT + gauge + oracle predictions).
      const shareSymbolLower = shareSymbol.toLowerCase()
      const shareSymbolUpper = shareSymbol.toUpperCase()

      const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
        shareName,
        shareSymbolUpper,
        oftBootstrapRegistry,
        tempOwner,
      ])
      const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
      const derivedShareOftSalt = deriveShareOftSalt({ owner, shareSymbol, version: deploymentVersion })
      let shareOftSaltOverrideUsed = shareOftSaltOverride
      if (shareOftSaltOverrideUsed && !supportsPhase1WithSalt) {
        logger.warn('[DeployVault] Batcher lacks vanity salt support; ignoring ShareOFT override', {
          batcher: batcherAddress,
        })
        shareOftSaltOverrideUsed = null
      }
      if (!shareOftSaltOverrideUsed && shareOftVanitySuffix && supportsPhase1WithSalt) {
        const initCodeHash = keccak256(shareOftInitCode)
        const vanitySeed = keccak256(
          encodePacked(['string', 'address', 'address', 'string'], [
            'CreatorShareOFT:vanity',
            creatorToken,
            owner,
            deploymentVersion,
          ]),
        )
        const vanityStart = BigInt(vanitySeed)
        const vanityKey = [
          create2Deployer.toLowerCase(),
          initCodeHash.toLowerCase(),
          shareOftVanitySuffix,
          String(shareOftVanityMaxTries),
          deploymentVersion,
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

      const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
        creatorToken,
        tempOwner,
        vaultName,
        vaultSymbol,
      ])
      const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])
      const vaultAddress = predictCreate2Address({ create2Deployer, salt: vaultSalt, initCode: vaultInitCode })

      const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [creatorToken, vaultAddress, tempOwner])
      const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
      const wrapperAddress = predictCreate2Address({ create2Deployer, salt: wrapperSalt, initCode: wrapperInitCode })

      const gaugeArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
        shareOftAddress,
        owner,
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
        shareOftSaltOverride: shareOftSaltOverrideUsed ?? null,
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
  const expectedShareOftSaltOverride = expectedQuery.data?.shareOftSaltOverride ?? null
  const expectedGauge = expected?.gaugeController ?? null
  const expectedBurnStream = expected?.burnStream ?? null
  const expectedPayoutRouter = expected?.payoutRouter ?? null
  const expectedCreatorCoinPolicyController = expected?.creatorCoinPolicyController ?? null

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

  const payoutMismatch =
    !!expectedPayoutRouter &&
    !!currentPayoutRecipient &&
    !sameAddress(expectedPayoutRouter, currentPayoutRecipient)

  const serializeSessionCalls = useCallback(
    (calls: Array<{ target: Address; value: bigint; data: Hex }>): DeploySessionCall[] =>
      calls.map((c) => ({ to: c.target, value: String(c.value ?? 0n), data: c.data })),
    [],
  )

  const submit = async (opts?: { planOnly?: boolean }): Promise<DeployPlanExport | null> => {
    const planOnly = opts?.planOnly === true
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
      setPhase('idle')
      setPhaseTxs({})
      lastPolledStepRef.current = ''
    }

    try {
      const runtimeConfig = await fetchDeployRuntimeConfig().catch(() => null)
      await ensurePaymasterSession()
      if (!batcherAddress) throw new Error('Deployment batcher is not configured. Set VITE_CREATOR_VAULT_BATCHER.')
      const runtimeBatcher = runtimeConfig?.creatorVaultBatcher ? getAddress(runtimeConfig.creatorVaultBatcher) : null
      if (runtimeBatcher && !sameAddress(runtimeBatcher, batcherAddress)) {
        if (
          tryAutoRecoverStaleDeployConfig({
            reason: 'batcher',
            clientValue: batcherAddress,
            runtimeValue: runtimeBatcher,
          })
        ) {
          setError('Local dry-run config changed after restart. Reloading deploy page...')
          return null
        }
        throw new Error(
          `Deploy page is stale after a local restart. Client batcher ${batcherAddress} does not match server batcher ${runtimeBatcher}. Hard refresh the page and confirm you are on the dry-run origin (http://localhost:5174).`,
        )
      }
      const hasDeploymentVersionOverride =
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deploymentVersion')?.trim()
      const runtimeDeploymentVersion = runtimeConfig?.deploymentVersion?.trim() ?? ''
      if (!hasDeploymentVersionOverride && runtimeDeploymentVersion && runtimeDeploymentVersion !== deploymentVersion) {
        if (
          tryAutoRecoverStaleDeployConfig({
            reason: 'deploymentVersion',
            clientValue: deploymentVersion,
            runtimeValue: runtimeDeploymentVersion,
          })
        ) {
          setError('Local dry-run deployment version changed after restart. Reloading deploy page...')
          return null
        }
        throw new Error(
          `Deploy page is stale after a local restart. Client deployment version ${deploymentVersion} does not match server deployment version ${runtimeDeploymentVersion}. Hard refresh the page and confirm you are on the dry-run origin (http://localhost:5174).`,
        )
      }
      const payoutRouterKeeperAddress = normalizeAddressLike(runtimeConfig?.payoutRouterKeeperAddress)
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
      // Compatibility-only placeholder. CCA strategy now derives launch floor onchain from oracle data.
      const floorPriceQ96ForBatcher =
        floorPriceQ96Aligned && floorPriceQ96Aligned > 0n ? floorPriceQ96Aligned : 1n
      if (strictNoEoaEnforced) {
        logger.info('[DeployVault] deploy_mode=no_eoa_strict', {
          deploy_mode: 'no_eoa_strict',
          useServerContinue,
          batcher: batcherAddress,
        })
        if (useServerContinue) {
          throw new Error('No-EOA strict mode requires client-side phase execution (server continue disabled).')
        }
        if (!canonicalSmartWallet || !privySmartWalletIsCanonicalOwner || !privySmartWalletCanSign) {
          logger.warn('[DeployVault] eligibility_blocked', {
            deploy_mode: 'no_eoa_strict',
            canonicalSmartWallet,
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

      const payoutRouterDesiredSwapPaths: Array<{ tokenIn: Address; path: Hex; label: 'WETH' | 'ZORA' }> = []
      if (!sameAddress(weth, creatorToken)) {
        payoutRouterDesiredSwapPaths.push({
          tokenIn: weth,
          path: encodeUniswapV3Path([weth, creatorToken], [payoutRouterWethCreatorFee]),
          label: 'WETH',
        })
      }
      if (payoutRouterZoraToken) {
        if (!sameAddress(payoutRouterZoraToken, creatorToken) && !sameAddress(payoutRouterZoraToken, weth)) {
          payoutRouterDesiredSwapPaths.push({
            tokenIn: payoutRouterZoraToken,
            path: encodeUniswapV3Path(
              [payoutRouterZoraToken, weth, creatorToken],
              [payoutRouterZoraWethFee, payoutRouterWethCreatorFee],
            ),
            label: 'ZORA',
          })
        }
      } else {
        logger.warn('[DeployVault] Missing runtime ZORA token address; skipping payout router ZORA swap-path auto-config')
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

      const senderCanAdminPayoutRouter = sameAddress(owner, expectedProtocolTreasury)

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

      const payoutRouterSetSwapPathCalls = senderCanAdminPayoutRouter
        ? (payoutRouterDesiredSwapPaths
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
            })) as const)
        : ([] as const)

      if (!payoutRouterKeeperAddress) {
        logger.warn('[DeployVault] Missing payoutRouter keeper runtime config; skipping setKeeper auto-config')
      }
      if (!senderCanAdminPayoutRouter && (payoutRouterKeeperAddress || payoutRouterDesiredSwapPaths.length > 0)) {
        logger.warn(
          '[DeployVault] PayoutRouter owner is protocol treasury; skipping creator-side setKeeper/setSwapPath auto-config',
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
        throw new Error('Failed to resolve CreatorCoin owner.')
      }
      const coinOwnershipNeedsTransfer = !sameAddress(currentCoinOwner, expectedCreatorCoinPolicyController)
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
        if (!sameAddress(currentCoinOwner, owner)) return false
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
      const supportsSplitPhase1 = (() => {
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_SELECTOR)
        )
      })()
      const supportsLegacyPhase1WithSalt = (() => {
        if (!expectedShareOftSaltOverride) return true
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return batcherBytecodeLower.includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
      })()
      const supportsSplitPhase1WithSalt = (() => {
        if (!expectedShareOftSaltOverride) return true
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return (
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
        )
      })()
      if (strictNoEoaEnforced) {
        const hasAllSplitSelectors =
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_CORE_WITH_SALT_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_SELECTOR) &&
          batcherBytecodeLower.includes(BATCHER_PHASE1_FINALIZE_WITH_SALT_SELECTOR)
        if (!hasAllSplitSelectors) {
          logger.warn('[DeployVault] legacy_batcher_blocked', {
            deploy_mode: 'no_eoa_strict',
            batcher: batcherAddress,
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
          version: deploymentVersion,
        } as const
        const asBatcherCall = (data: Hex) =>
          ({
            target: batcherAddress,
            value: 0n,
            data,
          }) as const

        if (!supportsSplitPhase1) {
          if (expectedShareOftSaltOverride && !supportsLegacyPhase1WithSalt) {
            logger.warn('[DeployVault] Batcher lacks legacy phase1 vanity salt support; continuing without override', {
              batcher: batcherAddress,
            })
          }
          if (phase1Any && !phase1All) {
            throw new Error(
              `Phase 1 is partially deployed for this creator + deployment version (${deploymentVersion}). ` +
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
              `Phase 1 split state is invalid for deployment version (${deploymentVersion}). ` +
                'ShareOFT is deployed while vault/wrapper are missing. Bump VITE_DEPLOYMENT_VERSION or contact support.',
            )
          }
          if (vaultDeployed !== wrapperDeployed) {
            throw new Error(
              `Phase 1 split state is invalid for deployment version (${deploymentVersion}). ` +
                'Vault/wrapper deployment is inconsistent. Bump VITE_DEPLOYMENT_VERSION or contact support.',
            )
          }
          const coreDone = vaultDeployed && wrapperDeployed
          const saltEnabled = supportsSplitPhase1WithSalt
          const shareOftSaltOverride: Hex = (expectedShareOftSaltOverride ?? ZERO_BYTES32) as Hex
          if (expectedShareOftSaltOverride && !saltEnabled) {
            logger.warn('[DeployVault] Batcher lacks split phase1 vanity salt support; continuing without override', {
              batcher: batcherAddress,
            })
          }
          if (phase1All) {
            phase1CallsPrepared = []
          } else if (!coreDone) {
            const coreCallData = saltEnabled
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
            const finalizeCallData = saltEnabled
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
            const finalizeCallData = saltEnabled
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
          version: deploymentVersion,
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
          version: deploymentVersion,
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
            deploymentVersion,
          })
        }

        const phase3Params = {
          creatorToken,
          owner,
          vault: expected.vault,
          version: deploymentVersion,
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
        } as const

        // ============================================================
        // Deploy path: smart wallet signer (Privy or wallet_sendCalls)
        // ============================================================
        if (!publicClient) throw new Error('Public client not ready.')

        // Hard guard: require at least one executable signer path.
        // For server-continue mode, a verified owner EOA is also valid because it can install
        // the temporary session owner on the canonical CSW in one user-approved tx.
        const hasOwnerEoaServerContinuePath = useServerContinue && !strictNoEoaEnforced && connectedEoaOwnerReady
        if (!planOnly && !canUsePrivySmartWallet && !canUseWalletSendCalls && !hasOwnerEoaServerContinuePath) {
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
        if (!planOnly && smartWalletBalance < depositAmount) {
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
            throw new Error(
              `Cannot transfer CreatorCoin ownership to policy controller ${shortAddress(expectedCreatorCoinPolicyController)} ` +
                `from current owner ${shortAddress(currentCoinOwner)}.`,
            )
          }
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: coinTransferOwnershipCallData,
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
                  version: deploymentVersion,
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
          version: deploymentVersion,
        }
        const deployPlanExport: DeployPlanExport = {
          generatedAt: new Date().toISOString(),
          chainId: base.id,
          useServerContinue,
          batcher: batcherAddress,
          create2Deployer: expectedCreate2Deployer,
          creatorToken,
          owner,
          deploymentVersion,
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
          deploymentVersion,
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
            deploymentVersion,
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

        const isUserRejectedError = (error: unknown): boolean => {
          const msg = error instanceof Error ? error.message : String(error ?? '')
          const lc = msg.toLowerCase()
          return (
            lc.includes('user rejected') ||
            lc.includes('user denied') ||
            lc.includes('user cancelled') ||
            lc.includes('action_rejected')
          )
        }

        const isLikelyPaymasterOrSponsorshipFailure = (error: unknown): boolean => {
          const msg = error instanceof Error ? error.message : String(error ?? '')
          const lc = msg.toLowerCase()
          const isPaymasterPolicyDenial =
            lc.includes('request denied -') ||
            lc.includes('paymaster rejected this request') ||
            lc.includes('requested resource not available') ||
            lc.includes('resource not available') ||
            lc.includes('sponsored userop exceeds paymaster total gas cap') ||
            (lc.includes('total gas used by the user operation') && lc.includes('allowed limit')) ||
            (lc.includes('total gas used') && lc.includes('allowed limit'))
          return (
            isPaymasterPolicyDenial ||
            lc.includes('paymaster unavailable') ||
            lc.includes('sponsorship') ||
            lc.includes('stake/unstake delay') ||
            lc.includes('banned opcode')
          )
        }

        const isPaymasterPolicyDenial = (error: unknown): boolean => {
          const msg = error instanceof Error ? error.message : String(error ?? '')
          const lc = msg.toLowerCase()
          return (
            lc.includes('request denied -') ||
            lc.includes('paymaster rejected this request') ||
            lc.includes('requested resource not available') ||
            lc.includes('resource not available') ||
            lc.includes('sponsored userop exceeds paymaster total gas cap') ||
            (lc.includes('total gas used by the user operation') && lc.includes('allowed limit')) ||
            (lc.includes('total gas used') && lc.includes('allowed limit'))
          )
        }

        const tryOwnerDirectExecuteBatchFallback = async (
          calls: Array<{ target: Address; value: bigint; data: Hex }>,
          phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4',
          logPhaseLabel: string,
          reason: unknown,
        ): Promise<boolean> => {
          if (strictNoEoaEnforced) return false
          if (isUserRejectedError(reason)) return false
          if (isPaymasterPolicyDenial(reason)) return false
          if (!isLikelyPaymasterOrSponsorshipFailure(reason)) return false
          if (!canonicalSmartWallet || !connectedAddress || !wagmiWalletClient || !publicClient) return false
          if (connectedAddress.toLowerCase() === canonicalSmartWallet.toLowerCase()) return false

          const eoaIsOwner = await isCoinbaseSmartWalletOwner({
            smartWallet: canonicalSmartWallet,
            ownerAddress: connectedAddress as Address,
          })
          if (!eoaIsOwner) return false

          await ensureBaseChain('owner EOA wallet')

          const executeBatchData = encodeFunctionData({
            abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI as any,
            functionName: 'executeBatch',
            args: [
              calls.map((c) => ({
                target: c.target,
                value: c.value ?? 0n,
                data: c.data ?? '0x',
              })),
            ],
          })

          const walletAny: any = wagmiWalletClient as any
          let txHashRaw: unknown = null
          if (typeof walletAny?.sendTransaction === 'function') {
            txHashRaw = await walletAny.sendTransaction({
              account: connectedAddress as Address,
              chain: base as any,
              to: canonicalSmartWallet,
              value: 0n,
              data: executeBatchData,
            })
          } else if (typeof walletAny?.request === 'function') {
            txHashRaw = await walletAny.request({
              method: 'eth_sendTransaction',
              params: [
                {
                  from: connectedAddress,
                  to: canonicalSmartWallet,
                  data:
                    appendBuilderSuffixToHex(executeBatchData, {
                      chainId: base.id,
                    }) ?? executeBatchData,
                  value: '0x0',
                },
              ],
            })
          } else {
            throw new Error('Connected owner wallet cannot send transactions for direct fallback.')
          }

          if (typeof txHashRaw !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHashRaw)) {
            throw new Error('Owner direct fallback returned an invalid transaction hash.')
          }

          const txHash = txHashRaw as Hex
          await (publicClient as any).waitForTransactionReceipt({ hash: txHash })
          persistUserOpResult(
            phaseLabel,
            logPhaseLabel,
            { userOpHash: txHash, transactionHash: txHash },
            'Direct owner executeBatch fallback',
          )
          logger.warn('[DeployVault] Direct owner executeBatch fallback succeeded', {
            phaseLabel: logPhaseLabel,
            canonicalSmartWallet,
            ownerAddress: connectedAddress,
            txHash,
          })
          return true
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
                  version: deploymentVersion,
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

          // PATH 1: Direct Coinbase Wallet connection
          // Only use this when embedded signer path is not available.
          if (
            !strictNoEoaEnforced &&
            isCoinbaseWalletDirect &&
            connectedAddress &&
            wagmiWalletClient &&
            publicClient &&
            canonicalSmartWallet
          ) {
            logger.info(`[DeployVault] Using Coinbase Wallet direct for ${logPhaseLabel}`)

            await ensureBaseChain('Coinbase Wallet')

            try {
              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: wagmiWalletClient as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: connectedAddress as Address,
                calls: toCalls(calls),
                version: '1',
              })

              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'Coinbase Wallet')
              return null
            } catch (coinbaseDirectErr) {
              const usedDirectFallback = await tryOwnerDirectExecuteBatchFallback(
                calls,
                phaseLabel,
                logPhaseLabel,
                coinbaseDirectErr,
              )
              if (usedDirectFallback) return null
              throw coinbaseDirectErr
            }
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
                    'Use Coinbase Wallet (Base Account) or connect an owner EOA.',
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
                    'Use Coinbase Wallet (Base Account) or connect an owner EOA.',
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
                if (strictNoEoaEnforced) {
                  logger.warn('[DeployVault] fallback_blocked', {
                    deploy_mode: 'no_eoa_strict',
                    phaseLabel: logPhaseLabel,
                    failureClass,
                  })
                  throw new Error(
                    `ERC-4337 signing failed (${failureClass}). Owner-EOA fallback is disabled in no-EOA mode.`,
                  )
                }
                // Fallback path: retry the same canonical CSW UserOp with an owner EOA signer.
                if (!connectedAddress || !wagmiWalletClient || !canonicalSmartWallet || !publicClient) {
                  throw new Error(
                    'Privy smart wallet signer failed and owner-EOA fallback is unavailable. ' +
                      'Connect an owner EOA wallet (Coinbase Wallet recommended) and retry.',
                  )
                }
                if (connectedAddress.toLowerCase() === canonicalSmartWallet.toLowerCase()) {
                  throw new Error(
                    'Privy smart wallet signer failed and fallback requires an owner EOA signer. ' +
                      'Connect an owner EOA wallet (Coinbase Wallet recommended) and retry.',
                  )
                }

                const eoaIsOwner = await isCoinbaseSmartWalletOwner({
                  smartWallet: canonicalSmartWallet,
                  ownerAddress: connectedAddress as Address,
                })
                if (!eoaIsOwner) {
                  throw new Error(
                    'Privy smart wallet signer failed, and the connected wallet is not an owner of the canonical smart wallet. ' +
                      'Connect an owner EOA wallet and retry.',
                  )
                }

                await ensureBaseChain('owner EOA wallet')
                logger.info('[DeployVault] Retrying with owner EOA fallback for phase', {
                  phaseLabel: logPhaseLabel,
                  ownerAddress: connectedAddress,
                  canonicalSmartWallet,
                  failureClass,
                })
                try {
                  const fallbackResult = await sendCoinbaseSmartWalletUserOperation({
                    publicClient: publicClient as any,
                    walletClient: wagmiWalletClient as any,
                    bundlerUrl,
                    smartWallet: canonicalSmartWallet,
                    ownerAddress: connectedAddress as Address,
                    calls: toCalls(calls),
                    version: '1',
                  })
                  persistUserOpResult(phaseLabel, logPhaseLabel, fallbackResult, 'ERC-4337 (owner EOA fallback)')
                  logger.info('[DeployVault] Owner EOA fallback succeeded for phase', {
                    phaseLabel: logPhaseLabel,
                    ownerAddress: connectedAddress,
                    canonicalSmartWallet,
                  })
                  return
                } catch (fallbackError) {
                  const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError ?? '')
                  const fallbackIsPaymasterPolicyFailure = isPaymasterPolicyDenial(fallbackError)
                  if (!fallbackIsPaymasterPolicyFailure) {
                    const usedDirectFallback = await tryOwnerDirectExecuteBatchFallback(
                      calls,
                      phaseLabel,
                      logPhaseLabel,
                      fallbackError,
                    )
                    if (usedDirectFallback) return
                  }
                  logger.error('[DeployVault] Owner EOA fallback failed', {
                    phaseLabel: logPhaseLabel,
                    ownerAddress: connectedAddress,
                    canonicalSmartWallet,
                    failureClass,
                    error: fallbackMsg,
                  })
                  const shortFallback = fallbackMsg.replace(/\s+/g, ' ').trim().slice(0, 220)
                  throw new Error(
                    `Privy smart wallet signer failed (${failureClass}) and owner-EOA fallback also failed. ` +
                      `Connect Coinbase Wallet (owner EOA) and retry. Last fallback error: ${shortFallback}`,
                  )
                }
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
                url: '/api/deploy/session/cancel',
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
                url: '/api/deploy/session/status',
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
              url: '/api/deploy/session/create',
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

            // Install the deploy-session signer via a one-time owner EOA transaction if needed.
            await ensureDeploySessionSignerInstalled(sessionOwner)

            // Kick off server continuation; status polling will advance remaining phases.
            await postDeploySessionJson({
              url: '/api/deploy/session/continue',
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
            version: deploymentVersion,
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
      const plan = await submit({ planOnly: true })
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
        url: '/api/deploy/session/dry-run',
        body: plan.sessionCreateRequest,
        label: 'deploy session dry-run',
      })
      if (!json.data) throw new Error('Dry-run failed')
      setDryRunResult(json.data)
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

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-zinc-500 leading-relaxed">
        {useServerContinue ? (
          <>
            One click will ask you to approve <span className="text-zinc-200">one</span> setup transaction. After that, the server
            submits Phases 1–4 via your smart wallet and cleans up the temporary owner. Progress is tracked below.
          </>
        ) : (
          <>
            One click will submit <span className="text-zinc-200">up to 4</span> onchain operations (Phases 1–4) via your smart wallet.
            Progress is tracked below.
          </>
        )}
      </div>
      {authIsStale ? (
        <div className="text-[11px] text-amber-300/70">
          You’re signed in from an earlier session. Clicking deploy will submit transactions immediately.
        </div>
      ) : null}

      <div className="vault-surface-muted rounded-lg p-4 space-y-2">
        <div className="text-[10px] font-medium text-zinc-500">Progress</div>
        <div className="grid grid-cols-1 gap-2 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <div className={phase === 'phase1' ? 'text-zinc-100' : phase === 'idle' ? 'text-zinc-500' : 'text-zinc-300'}>
              Phase 1: deploy core contracts
            </div>
            {href1 ? (
              <a className="font-mono text-zinc-300 hover:text-white" href={href1} target="_blank" rel="noreferrer">
                tx
              </a>
            ) : (
              <div className="text-zinc-700">{phase === 'phase1' ? 'pending…' : phase === 'idle' ? '—' : 'done'}</div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className={phase === 'phase2' ? 'text-zinc-100' : phase === 'idle' ? 'text-zinc-500' : 'text-zinc-300'}>
              Phase 2: configure + reserve auction
            </div>
            {href2 ? (
              <a className="font-mono text-zinc-300 hover:text-white" href={href2} target="_blank" rel="noreferrer">
                tx
              </a>
            ) : (
              <div className="text-zinc-700">
                {phase === 'phase2'
                  ? 'pending…'
                  : phase === 'idle' || phase === 'phase1'
                    ? '—'
                    : 'done'}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className={phase === 'phase3' ? 'text-zinc-100' : phase === 'idle' ? 'text-zinc-500' : 'text-zinc-300'}>
              Phase 3: strategies
            </div>
            {href3 ? (
              <a className="font-mono text-zinc-300 hover:text-white" href={href3} target="_blank" rel="noreferrer">
                tx
              </a>
            ) : (
              <div className="text-zinc-700">
                {phase === 'phase3'
                  ? 'pending…'
                  : phase === 'idle' || phase === 'phase1' || phase === 'phase2'
                    ? '—'
                    : 'done'}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className={phase === 'phase4' ? 'text-zinc-100' : phase === 'idle' ? 'text-zinc-500' : 'text-zinc-300'}>
              Phase 4: launch auction
            </div>
            {href4 ? (
              <a className="font-mono text-zinc-300 hover:text-white" href={href4} target="_blank" rel="noreferrer">
                tx
              </a>
            ) : (
              <div className="text-zinc-700">
                {phase === 'phase4'
                  ? 'pending…'
                  : phase === 'idle' || phase === 'phase1' || phase === 'phase2' || phase === 'phase3'
                    ? '—'
                    : phase === 'done'
                      ? 'done'
                      : '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {payoutMismatch ? (
        <div className="text-[11px] text-amber-300/80">
          External revenue recipient will update to{' '}
          <span className="font-mono text-amber-200">{shortAddress(expectedGauge!)}</span> during deploy. Continue only if this is
          intended.
        </div>
      ) : null}

      <details className="vault-surface-muted group rounded-lg">
        <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-zinc-500">Deployment plan</div>
            <div className="text-[12px] text-zinc-200 truncate">Phases 1–4 · deterministic addresses</div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-1">
          <div className="text-[11px] text-zinc-600 mb-3">
            Addresses are deterministic on Base. Click to view on BaseScan.
          </div>
          <div className="rounded-md border border-white/10 bg-white/4 px-3 py-2 mb-3 space-y-1 backdrop-blur-sm">
            <AddressRow label="Active batcher" address={batcherAddress} />
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <div className="text-zinc-500">Deploy mode</div>
              <div className="font-mono text-zinc-200/90">{strictNoEoaEnforced ? 'no_eoa_strict' : 'default'}</div>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-white/4 divide-y divide-white/8 backdrop-blur-sm">
            <div className="py-3">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 1</div>
              <div className="space-y-2">
                <AddressRow label="Vault" address={expected?.vault} />
                <AddressRow label="Wrapper" address={expected?.wrapper} />
                <AddressRow label="Share token" address={expected?.shareOFT} />
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 2</div>
              <div className="space-y-2">
                <AddressRow label="Gauge controller" address={expected?.gaugeController} />
                <AddressRow label="CCA strategy" address={expected?.ccaStrategy} />
                <AddressRow label="Burn stream" address={expected?.burnStream} />
                <AddressRow label="Payout router" address={expected?.payoutRouter} />
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <div className="text-zinc-500">Initial deposit</div>
                  <div className="font-mono text-zinc-200/90">
                    {formatDeposit(minFirstDeposit)} {depositSymbol}
                  </div>
                </div>
                {marketFloorText ? (
                  <div className="flex items-center justify-between gap-4 text-[11px]">
                    <div className="text-zinc-500">CCA floor (reference)</div>
                    <div className="text-zinc-200/90">{marketFloorText}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] font-medium text-zinc-500 mb-2">Phase 3</div>
              <div className="text-[11px] text-zinc-600">
                Strategy deployments + registrations (Charm CREATOR/USDC + Ajna).
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
                  <span className="font-mono text-zinc-300">pnpm -C frontend dev:deploy-dry-run</span>.
                </div>
              )}
            </div>
            {exportStatus ? <div className="text-[11px] text-zinc-500">{exportStatus}</div> : null}
          </div>
          {dryRunError ? <div className="mt-2 text-[11px] text-amber-300/80">{dryRunError}</div> : null}
          {dryRunResult ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/4 p-3 space-y-2 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-medium text-zinc-500">Dry run</div>
                <div className={dryRunResult.ok ? 'text-[11px] text-green-400/80' : 'text-[11px] text-amber-300/80'}>
                  {dryRunResult.ok ? `Pass on ${dryRunResult.forkMode} fork` : `Fail on ${dryRunResult.forkMode} fork`}
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                {dryRunResult.phases.map((phaseEntry) => (
                  <div key={phaseEntry.name} className="flex items-center justify-between gap-3">
                    <div className="text-zinc-400">{phaseEntry.name}</div>
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

      <div className="vault-surface-muted rounded-lg p-4 space-y-2">
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

      {/* Show deploy button only if we have a valid ERC-4337 path */}
      {hasDeploySignerPath ? (
        <div className="space-y-2">
          <div className="text-[10px] text-green-400/80 flex items-center gap-1">
            <span>✓</span>{' '}
            {strictNoEoaEnforced
              ? hasPrivyEmbeddedOwnerSigner
                ? 'Gas-free ERC-4337 via preconfigured Privy embedded owner'
                : 'Gas-free ERC-4337 via preconfigured app smart wallet owner'
              : `Gas-free ERC-4337 ${
                  isCoinbaseWalletDirect
                    ? 'via Coinbase Wallet'
                    : connectedEoaOwnerReady
                      ? 'via connected owner wallet'
                      : hasPrivyEmbeddedOwnerSigner
                        ? 'via Privy embedded owner'
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

      {marketFloorText ? (
        <div className="text-[11px] text-zinc-500">
          Market floor (reference): {marketFloorText}. Final auction floor is enforced onchain from oracle data.
        </div>
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
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const siwe = useSiweAuth()
  // State for adding Privy app smart wallet as owner (EIP-1271 signer)
  const [addPrivySmartWalletOwnerBusy, setAddPrivySmartWalletOwnerBusy] = useState(false)
  const [addPrivySmartWalletOwnerTxHash, setAddPrivySmartWalletOwnerTxHash] = useState<string | null>(null)
  const [addPrivySmartWalletOwnerError, setAddPrivySmartWalletOwnerError] = useState<string | null>(null)
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
    // DeploymentBatcher enforces an exact 50M creator-token first deposit onchain.
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
      logger.warn('[DeployVault] ignoring minFirstDepositTokens override; enforcing 50M policy', {
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
  const [solanaMintOverrideInput, setSolanaMintOverrideInput] = useState<string>(() => {
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
  const [solanaDecimalsOverrideInput, setSolanaDecimalsOverrideInput] = useState<string>(() => {
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = solanaMintOverrideInput.trim()
      if (v.length > 0) {
        window.localStorage.setItem('cv:deploy:solanaMintOverride', v)
      } else {
        window.localStorage.removeItem('cv:deploy:solanaMintOverride')
      }
    } catch {
      // ignore
    }
  }, [solanaMintOverrideInput])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = solanaDecimalsOverrideInput.trim()
      if (v.length > 0) {
        window.localStorage.setItem('cv:deploy:solanaDecimalsOverride', v)
      } else {
        window.localStorage.removeItem('cv:deploy:solanaDecimalsOverride')
      }
    } catch {
      // ignore
    }
  }, [solanaDecimalsOverrideInput])

  const switchAuthCta = useMemo(() => {
    if (!privyReady) return undefined
    const run = async () => {
      // If we're already authenticated, `login()` can no-op in some Privy configurations.
      // Force a re-auth flow so the user can switch to a wallet session if needed.
      try {
        if (privyAuthenticated && typeof logout === 'function') {
          await logout()
        }
      } catch {
        // ignore
      }
      try {
        await login({ loginMethods: ['email', 'wallet'] })
      } catch {
        // ignore
      }
    }
    return {
      label: privyAuthenticated ? 'Switch account connection' : 'Restore account connection',
      onClick: () => void run(),
    }
  }, [login, logout, privyAuthenticated, privyReady])

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
    prefillToken: string
    debugEnabledFromQuery: boolean
  } | null>(null)

  if (!initialQueryRef.current) {
    initialQueryRef.current = {
      prefillToken: searchParams.get('token') ?? '',
      debugEnabledFromQuery: (searchParams.get('debug') ?? '').trim() === '1',
    }
  }

  const prefillToken = initialQueryRef.current.prefillToken
  const debugEnabledFromQuery = initialQueryRef.current.debugEnabledFromQuery

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of ['shareOftSaltOverride', 'debug']) {
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

  useEffect(() => {
    if (!prefillToken) return
    if (creatorToken.length > 0) return
    setCreatorToken(prefillToken)
  }, [prefillToken, creatorToken.length])


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
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoin) return
    if (autofillRef.current.tokenFor === addressLc) return

    setCreatorToken(detectedCreatorCoin)
    autofillRef.current.tokenFor = addressLc
  }, [isConnected, addressLc, prefillToken, creatorToken, detectedCreatorCoin])

  // Privy-first: auto-fill creator coin from Privy smart wallet's Zora profile
  useEffect(() => {
    if (!privyAuthenticated || !privySmartWalletAddress) return
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoinFromPrivy) return
    const key = `privy:${privySmartWalletAddress.toLowerCase()}`
    if (autofillRef.current.tokenFor === key) return
    setCreatorToken(detectedCreatorCoinFromPrivy)
    autofillRef.current.tokenFor = key
  }, [privyAuthenticated, privySmartWalletAddress, prefillToken, creatorToken, detectedCreatorCoinFromPrivy])

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

      if (!connectedWalletAddress || !walletClient || !publicClient) {
        throw new Error('Wallet not connected. Please connect a wallet that is an owner of your canonical Coinbase Smart Wallet.')
      }
      if (connectedWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()) {
        throw new Error(
          'Add-owner setup requires an owner EOA signer. Connect an owner EOA wallet (for example Coinbase Wallet) and retry.',
        )
      }

      await ensureBaseChain('your wallet')

      const isOwner = await isCoinbaseSmartWalletOwner({
        smartWallet: canonicalIdentityAddress as Address,
        ownerAddress: connectedWalletAddress as Address,
      })

      if (!isOwner) {
        throw new Error(
          'Your connected wallet is not an owner of your canonical Coinbase Smart Wallet.\n\n' +
            'Connect with a wallet that controls your Zora identity.'
        )
      }

      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      const usingPaymasterProxy = isPaymasterProxyUrl(bundlerUrl)
      if (!usingPaymasterProxy) {
        try {
          logger.info('[DeployVault] Trying ERC-4337 to add app smart wallet as owner (gas-free)', {
            connector: connector?.id,
            owner: connectedWalletAddress,
            smartWallet: privySmartWalletAddress,
          })

          const result = await sendCoinbaseSmartWalletUserOperation({
            publicClient: publicClient as any,
            walletClient: walletClient as any,
            bundlerUrl,
            smartWallet: canonicalIdentityAddress as Address,
            ownerAddress: connectedWalletAddress as Address,
            calls: [{
              to: canonicalIdentityAddress as Address,
              value: 0n,
              data: addOwnerData,
            }],
            version: '1',
          })

          setAddPrivySmartWalletOwnerTxHash(result.transactionHash)
          logger.info('[DeployVault] App smart wallet added as owner via ERC-4337 (gas-free)', {
            userOpHash: result.userOpHash,
            txHash: result.transactionHash,
            smartWallet: privySmartWalletAddress,
            connector: connector?.id,
          })

          await privySmartWalletIsCanonicalOwnerQuery.refetch()
          return true
        } catch (erc4337Error: any) {
          // Adding owners is frequently *not* sponsorable via a self-call UserOp depending on
          // the smart wallet's internal access rules. When it fails, fall back to a normal tx
          // from the connected EOA (requires gas, but is the most reliable path).
          logger.warn('[DeployVault] ERC-4337 failed, falling back to direct tx', {
            error: erc4337Error?.message,
            connector: connector?.id,
          })
        }
      } else {
        logger.info('[DeployVault] Skipping ERC-4337 add-owner sponsorship via paymaster proxy; using direct tx', {
          connector: connector?.id,
          owner: connectedWalletAddress,
          smartWallet: privySmartWalletAddress,
        })
      }

      logger.info('[DeployVault] Using direct tx fallback to add app smart wallet as owner (requires gas)')

      const txHash = await walletClient.sendTransaction({
        to: canonicalIdentityAddress as Address,
        data: addOwnerData,
        value: 0n,
        chain: base,
      })

      setAddPrivySmartWalletOwnerTxHash(txHash)
      logger.info('[DeployVault] App smart wallet added as owner via direct tx', {
        txHash,
        canonical: canonicalIdentityAddress,
        smartWallet: privySmartWalletAddress,
      })

      await publicClient.waitForTransactionReceipt({ hash: txHash })
      await privySmartWalletIsCanonicalOwnerQuery.refetch()
      return true
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


  // Allow injected EOAs (Rabby/MetaMask/etc) to operate a Coinbase Smart Wallet canonical identity
  // when the EOA is an onchain owner of that smart wallet.
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


  // NOTE: We previously supported an optional “fund owner wallet” helper flow, but it’s not wired into
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

      const batcherCode = await publicClient!.getBytecode({ address: batcher })
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
        bytecodeStore = (await publicClient!.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'bytecodeStore',
        })) as Address
      } catch (err: unknown) {
        getterErrors.push(err)
      }
      try {
        create2Deployer = (await publicClient!.readContract({
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
        deployerStore = (await publicClient!.readContract({
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
        await publicClient!.readContract({
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

      const pointerResults = await publicClient!.multicall({
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
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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
  const strictNoEoaEnforced = strictNoEoaMode && !connectedEoaOwnerReady
  const strictNoEoaEligibility = Boolean(
    canonicalIdentityIsContract &&
      canonicalIdentityAddress &&
      (privyEmbeddedOwnerReady || privySmartWalletOwnerReady),
  )
  // Smart wallet is ready only if it matches canonical OR an authorized owner signer is available.
  // In strict no-EOA mode we only allow preconfigured Privy owner flow unless a verified
  // connected owner EOA path is already available in-session.
  const smartWalletCapabilityReady = strictNoEoaEnforced
    ? strictNoEoaEligibility
    : isCoinbaseWalletDirect ||
      connectedEoaOwnerReady ||
      (privySmartWalletReady &&
        (smartWalletMatchesCanonical || privySmartWalletOwnerReady || privyEmbeddedOwnerReady))
  const oneTimePrivyOwnerApprovalNeeded = Boolean(
    !strictNoEoaEnforced &&
      canonicalIdentityIsContract &&
      canonicalIdentityAddress &&
      privySmartWalletAddress &&
      !isCoinbaseWalletDirect &&
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
            ? 'Checking creator access…'
            : creatorAllowlistQuery.isError
              ? 'Creator access check failed.'
              : allowlistEnforced && !isAllowlistedCreator
                ? 'Creator access required.'
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
                          ? 'One-time owner approval required before deploy. Approve your app Privy wallet as an owner of your canonical Coinbase Smart Wallet.'
                          : 'One-time owner approval required. Connect an owner wallet, approve once, then deploy.'
                      : !smartWalletCapabilityReady
                        ? hasDetectedZoraCrossAppWallet
                          ? 'Detected your Zora wallet, but this session is read-only for deploy signing. Connect Coinbase Wallet (owner EOA) to sign ERC-4337 UserOps, then retry.'
                          : 'Smart wallet required. Sign in to 4626 to restore your canonical Coinbase Smart Wallet session, connect an owner EOA, or use Coinbase Wallet (Base Account).'
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
      <PageMeta title={META.deploy.title} description={META.deploy.description} canonicalPath="/deploy" />
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
                {privyReady && privyAuthenticated && !smartWalletCapabilityReady ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: baseEase }}
                    className="mt-3 rounded-xl border border-amber-500/25 bg-linear-to-b from-amber-500/18 to-amber-500/8 px-4 py-3 text-[12px] text-amber-200/90 backdrop-blur-sm"
                  >
                    <div className="font-medium text-amber-200">Account mismatch?</div>
                    <div className="mt-1 text-amber-200/80">
                      You’re signed into Privy, but we can’t see your Zora global wallet / Coinbase Smart Wallet on this session.
                      Re-auth with wallet sign-in to sync the expected wallet linkage.
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          void (async () => {
                            try {
                              if (typeof logout === 'function') await logout()
                            } catch {
                              // ignore
                            }
                            await login({ loginMethods: ['wallet'] })
                          })()
                        }}
                      >
                        Re-auth with wallet
                      </button>
                    </div>
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
                  This is a one-time setup per canonical wallet.
                </div>
                <div className="text-[11px] text-zinc-300/90">
                  Canonical wallet: <span className="font-mono">{shortAddress(canonicalIdentityAddress as Address)}</span>
                  {' · '}
                  App Privy wallet: <span className="font-mono">{shortAddress(privySmartWalletAddress as Address)}</span>
                </div>
                {!connectedWalletAddress ? (
                  <div className="space-y-2">
                    <div className="text-[11px] text-amber-200/85">
                      Connect an owner wallet (Rabby/Coinbase/etc) to submit this one-time approval.
                    </div>
                    <button
                      type="button"
                      className="btn-secondary w-full sm:w-auto"
                      onClick={() => void login({ loginMethods: ['wallet'] })}
                    >
                      Connect Owner Wallet
                    </button>
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
                  disabled={addPrivySmartWalletOwnerBusy || !connectedWalletAddress}
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

            {/* Review */}
          {!alreadyDeployed && tokenIsValid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                {symbolLoading || zoraLoading ? (
                  <div className="text-sm text-zinc-600">Loading coin details…</div>
                ) : !zoraCoin ? (
                  <div className="text-sm text-red-400/80">
                    This token does not appear to be a Zora Coin. Creator Vaults can only be created for Zora{' '}
                    <span className="text-zinc-200">Creator Coins</span>.
                  </div>
                ) : baseSymbol ? (
                  <div className="vault-surface vault-hover-lift p-8 space-y-6">
                    {/* Token card */}
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
                            {baseSymbol ? (
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

                    {/* Key rows */}
                    <div className="space-y-0">
                      {payoutRecipient && (
                        <div className="data-row">
                          <div className="label">External revenue recipient</div>
                          <div className="text-xs text-zinc-300 font-mono">{shortAddress(payoutRecipient)}</div>
                        </div>
                      )}

                      <div className="data-row">
                        <div className="label">Chain</div>
                        <div className="text-xs text-zinc-300 inline-flex items-center gap-2">
                          <img
                            src="/protocols/base.png"
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="w-3.5 h-3.5 opacity-90"
                          />
                          Base
                        </div>
                      </div>
                    </div>

                    {String(zoraCoin?.coinType ?? '').toUpperCase() === 'CONTENT' && (
                      <div className="text-xs text-amber-300/90 pt-4 border-t border-zinc-900/50">
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
            )}

          {!alreadyDeployed && (
            <>
          {/* Essentials */}
            <div className="vault-surface vault-hover-lift p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Launch</div>
                  <div className="text-xs text-zinc-600">Minimal launch details for your Creator Coin.</div>
                </div>
              </div>

              {/* Creator Coin */}
            <div className="space-y-2">
                <label className="label">Creator Coin</label>

                {!hasWallet ? (
                  tokenIsValid ? (
                    <input
                      value={creatorToken}
                      disabled
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                    />
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Sign in to detect your creator coin"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Sign in to continue.</div>
                    </>
                  )
                ) : (
                  <>
                    <input
                      value={creatorToken}
                      onChange={(e) => setCreatorToken(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                    <div className="text-xs text-zinc-600">
                      {tokenIsValid ? (
                        <>
                          {detectedCreatorCoin && creatorToken.toLowerCase() === detectedCreatorCoin.toLowerCase()
                            ? 'Prefilled for this wallet.'
                            : prefillToken
                              ? 'Set from a link.'
                              : 'Set manually.'}{' '}
                          Edit to deploy a different coin.
                        </>
                      ) : myProfileQuery.isLoading || myProfileQuery.isFetching ? (
                        'Detecting your creator coin…'
                      ) : detectedCreatorCoin ? (
                        'Detected a creator coin for this wallet. You can use it or paste another address.'
                      ) : (
                        'Paste a Creator Coin address to deploy.'
                      )}
                    </div>
                    {hasWallet && detectedCreatorCoin ? (
                      <button
                        type="button"
                        onClick={() => setCreatorToken(detectedCreatorCoin)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                      >
                        Use my coin
                      </button>
                    ) : null}
                  </>
                )}
            </div>

              <div className="space-y-2">
                <label className="label">Solana Mint (Optional)</label>
                <input
                  value={solanaMintOverrideInput}
                  onChange={(e) => setSolanaMintOverrideInput(e.target.value)}
                  placeholder="0x<32-byte solana mint pubkey>"
                  className={`w-full bg-black border rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono ${
                    solanaMintOverrideInvalid ? 'border-red-500/50 focus:border-red-400/70' : 'border-zinc-800 focus:border-cyan-500/50'
                  }`}
                />
                <input
                  value={solanaDecimalsOverrideInput}
                  onChange={(e) => setSolanaDecimalsOverrideInput(e.target.value)}
                  placeholder="Decimals (default 9)"
                  inputMode="numeric"
                  className={`w-full bg-black border rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono ${
                    solanaDecimalsOverrideInvalid ? 'border-red-500/50 focus:border-red-400/70' : 'border-zinc-800 focus:border-cyan-500/50'
                  }`}
                />
                <div className="text-xs text-zinc-600">
                  Used for automatic ShareOFT registration on the Solana adapter when bridging is enabled. If empty, server defaults are used.
                </div>
                {solanaMintOverrideInvalid ? (
                  <div className="text-[11px] text-red-400/90">
                    Mint must be a bytes32 hex value (`0x` + 64 hex chars).
                  </div>
                ) : null}
                {solanaDecimalsOverrideInvalid ? (
                  <div className="text-[11px] text-red-400/90">
                    Decimals must be an integer between 0 and 255.
                  </div>
                ) : null}
              </div>
          </div>

            {/* Deploy */}
            <div className="vault-surface vault-hover-lift p-8 space-y-4">
              <div className="label">Deploy</div>
              {/* Auth flow */}
              {!privyReady ? (
                <div className="text-sm text-zinc-500 text-center py-4">Loading…</div>
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
                  Checking creator access…
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
                  Loading…
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
                  Checking creator access…
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
                  {privySmartWalletIsCanonicalOwner ? (
                    <div className="flex items-center gap-2 text-[11px] text-green-400 mb-2">
                      <span>✓</span>
                      <span>Smart wallet signer ready</span>
                    </div>
                  ) : null}

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
                    floorPriceQ96Aligned={marketFloorQuery.data?.floorPriceQ96Aligned ?? null}
                    marketFloorTwapDurationSec={marketFloorQuery.data?.creatorZora.durationSec ?? null}
                    marketFloorDiscountBps={marketFloorQuery.data?.zoraEth.discountBps ?? null}
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
            </>
          )}

          </div>
        </div>
      </section>
    </div>
  )
}
