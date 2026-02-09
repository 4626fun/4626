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
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { CONTRACTS } from '@/config/contracts'
import { useCreatorAllowlist, useFarcasterAuth, useMiniAppContext, useDeploymentTracker } from '@/hooks'
import { DeploymentSuccess, AlreadyDeployedBanner } from '@/components/DeploymentSuccess'
import type { DeploymentRecord } from '@/hooks/useDeploymentTracker'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { logger } from '@/lib/logger'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { getFarcasterUserByFid } from '@/lib/neynar-api'
import { resolveCreatorIdentity } from '@/lib/identity/creatorIdentity'
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
import { 
  sendCoinbaseSmartWalletUserOperation, 
  simulateSmartWalletCalls,
  ERC4337_ENTRYPOINT_V06,
  assertEntryPointV06,
} from '@/lib/aa/coinbaseErc4337'

const MIN_FIRST_DEPOSIT = 5_000_000n * 10n ** 18n
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')
const BASE_SWAP_ROUTER = addr('2626664c2603336E57B271c5C0b26F421741e481')
const BASE_WETH = addr('4200000000000000000000000000000000000006')
const BASE_USDC = addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const BASE_CHAINLINK_ETH_USD = addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const PAYOUT_ROUTER_SALT_TAG = 'CreatorVault:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = 'CreatorVault:VaultShareBurnStream' as const

// Uniswap CCA uses Q96 fixed-point prices + a compact step schedule.
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
const DEFAULT_AUCTION_PERCENT = 50
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)
const DEFAULT_SHARE_OFT_VANITY_SUFFIX = '4626'
const DEFAULT_SHARE_OFT_VANITY_MAX_TRIES = 1_000_000
const BATCHER_PHASE1_WITH_SALT_SELECTOR = '297cb1e6'

// Minimum age for a Creator Coin before allowing vault deployment.
// Rationale: reduce launch-manipulation surface area on brand new coins with thin/no trading history.
const DEFAULT_MIN_COIN_AGE_DAYS = 7
const MIN_COIN_AGE_LOCALSTORAGE_KEY = 'cv:deploy:minCoinAgeDays'
const BASE_CHAIN_ID_HEX = `0x${base.id.toString(16)}`
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`
const MAX_UINT256 = (1n << 256n) - 1n

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

function isEthSignUnsupported(error: unknown): boolean {
  const code = (error as any)?.code
  if (code === -32601) return true // Method not found
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  return (
    lc.includes('not supported') ||
    lc.includes('unsupported') ||
    lc.includes('method not found') ||
    lc.includes('does not support')
  )
}

function isUserOpHashLike(value: unknown): boolean {
  return isHexString(value) && value.length === 66
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

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type AdminAuthResponse = { address: string; isAdmin: boolean } | null
type ServerDeployResponse = {
  userOpHash: string
  addresses: {
    vault: Address
    wrapper: Address
    shareOFT: Address
    gaugeController: Address
    ccaStrategy: Address
    oracle: Address
  }
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
      `CreatorVault:deploy:${version}`,
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
        <div className="min-h-screen bg-black text-white">
          <section className="max-w-3xl mx-auto px-6 py-16">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">Deploy</div>
            <div className="card rounded-xl p-8 space-y-4">
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
      <div className="min-h-screen bg-black text-white">
        <section className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">Deploy</div>
          <div className="card rounded-xl p-8 space-y-3">
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

function deriveShareOftSalt(params: { owner: Address; shareSymbol: string; version: string }): Hex {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function predictCreate2Address(params: { create2Deployer: Address; salt: Hex; initCode: Hex }): Address {
  const bytecodeHash = keccak256(params.initCode)
  return getCreate2Address({ from: params.create2Deployer, salt: params.salt, bytecodeHash })
}

async function fetchAdminAuth(): Promise<AdminAuthResponse> {
  const { apiFetch } = await import('@/lib/apiBase')
  const res = await apiFetch('/api/auth/admin', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminAuthResponse> | null
  if (!res.ok || !json) return null
  if (!json.success) return null
  return (json.data ?? null) as AdminAuthResponse
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

const CREATOR_VAULT_ADMIN_ABI = [
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
          { name: 'auctionPercent', type: 'uint8' },
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
          { name: 'auctionPercent', type: 'uint8' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
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
          { name: 'auctionPercent', type: 'uint8' },
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
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'enableAutoAllocate', type: 'bool' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaStrategy', type: 'bytes32' },
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
          { name: 'ajnaStrategy', type: 'address' },
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
  embeddedEoaIsCanonicalOwner,
  embeddedPrivyWallet,
  embeddedPrivyEoaAddress,
  connectorId,
  wagmiWalletClient,
  connectedIsCanonicalOwner,
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
  // Whether the Privy embedded EOA is an owner of the canonical smart wallet (enables gas-free ERC-4337)
  embeddedEoaIsCanonicalOwner: boolean
  // The Privy embedded wallet object (for signing)
  embeddedPrivyWallet: any
  // The Privy embedded EOA address
  embeddedPrivyEoaAddress: Address | null
  // For direct Coinbase Wallet connection (supports eth_sign)
  connectorId: string | undefined
  wagmiWalletClient: any
  // Whether the connected EOA is an owner of the canonical smart wallet
  connectedIsCanonicalOwner: boolean
}) {
  const { address: connectedAddress } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: base.id })
  const preferEmbeddedEoaRef = useRef(false)
  
  // Detect Coinbase Wallet direct connection (not via Privy)
  const isCoinbaseWalletDirect = connectorId === 'coinbaseWalletSDK' || connectorId === 'com.coinbase.wallet'

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

  const ensureProviderOnBase = useCallback(
    async (provider: any, label: string, opts?: { allowSwitch?: boolean }) => {
    if (!provider?.request) return
    const current = await provider.request({ method: 'eth_chainId' }).catch(() => null)
    if (typeof current === 'string' && current.toLowerCase() !== BASE_CHAIN_ID_HEX) {
      if (opts?.allowSwitch === false) {
        throw new Error(`Please switch ${label} to Base network to continue.`)
      }
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        })
      } catch {
        throw new Error(`Please switch ${label} to Base network to continue.`)
      }
    }
    },
    [],
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
  // Coinbase Wallet and Zora Wallet (via cross-app-connect) support this
  const canUseWalletSendCalls = useMemo(() => {
    if (!connectorId) return false
    const supportedConnectors = ['coinbaseWalletSDK', 'zora-global-wallet']
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
  const expectedRef = useRef<ServerDeployResponse['addresses'] | null>(null)
  const useServerContinue = useMemo(() => {
    const v = String((import.meta as any)?.env?.VITE_DEPLOY_USE_SERVER_CONTINUE ?? '').trim().toLowerCase()
    return v === '1' || v === 'true' || v === 'yes'
  }, [])
  const deploySessionStorageKey = useMemo(() => {
    const ct = String(creatorToken ?? '').toLowerCase()
    const ow = String(owner ?? '').toLowerCase()
    return `cv:deploy:session:${ct}:${ow}`
  }, [creatorToken, owner])
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
            createdAt: new Date().toISOString(),
          }),
        )
      } catch {
        // ignore storage errors
      }
    },
    [creatorToken, deploySessionStorageKey, owner],
  )
  const clearDeploySession = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(deploySessionStorageKey)
    } catch {
      // ignore
    }
  }, [deploySessionStorageKey])
  const loadDeploySession = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(deploySessionStorageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const sessionId = typeof parsed?.sessionId === 'string' ? parsed.sessionId.trim() : ''
      return sessionId.length > 0 ? sessionId : null
    } catch {
      return null
    }
  }, [deploySessionStorageKey])
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
        'Sign in with wallet to use the Privy smart wallet client, or use Coinbase Wallet (Base Account), then retry.'
      )
    }
    if (lower.includes('method not supported') && lower.includes('eth_sign')) {
      return (
        "Your signer doesn’t support `eth_sign`, which is required to sign smart wallet UserOp hashes. " +
        'Sign in with wallet to use the Privy smart wallet client, or use Coinbase Wallet (Base Account), then retry.'
      )
    }
    if (
      lower.includes('smart wallet client required') ||
      lower.includes('privy smart wallet client required') ||
      lower.includes('smart wallet required')
    ) {
      return 'Smart wallet required. Sign in with wallet to access your Zora smart wallet, or use Coinbase Wallet (Base Account), then retry.'
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
      return 'MetaMask failed to initialize because another wallet extension already controls window.ethereum. Disable one extension (MetaMask/Coinbase/Rabby), or use WalletConnect/Privy sign-in.'
    }
    // Paymaster/bundler errors: be specific (don’t mask real server-side errors).
    if (lower.includes('cdp paymaster endpoint is not configured')) {
      return 'Paymaster proxy is missing a server-side CDP endpoint. Keep `VITE_CDP_PAYMASTER_URL=/api/paymaster`, and set `CDP_PAYMASTER_URL` (server env) to `https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY_ID>`.'
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
      return `Gas sponsorship requires a session. Click “${switchAuthLabel ?? 'Sign in with wallet'}” and retry.`
    }
    if (lower.includes('session address must match owner or smart wallet')) {
      return (
        'Your current auth session does not match the deploy sender expected by the server. ' +
        `Click “${switchAuthLabel ?? 'Sign in with wallet'}” to re-auth, or disable server-continue (` +
        'set `VITE_DEPLOY_USE_SERVER_CONTINUE=false`) and retry.'
      )
    }
    if (lower.includes('deploy ownership mismatch')) {
      return (
        'Deploy session ownership validation failed. Re-auth to refresh wallet linkage, then retry. ' +
        'If needed, disable server-continue (`VITE_DEPLOY_USE_SERVER_CONTINUE=false`) and run phases client-side.'
      )
    }
    if (lower.includes('signature check failed') || lower.includes('invalid userop signature')) {
      return (
        "UserOp signature failed. This usually means the signer isn’t an onchain owner or didn’t sign the raw UserOp hash with `eth_sign`. " +
        'Sign in with wallet to use the Privy smart wallet client, or use Coinbase Wallet (Base Account), then retry. If you just added a new owner, refresh and retry.'
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
    if (lower.includes('creatorvaultbatcher is not configured')) {
      return 'Deployment is not configured: missing `VITE_CREATOR_VAULT_BATCHER` / `CONTRACTS.creatorVaultBatcher`.'
    }
    return msg
  }, [switchAuthLabel])

  const pollServerDeploySession = useCallback(async (sessionId: string) => {
    let delayMs = 2000
    let backoff = false
    const started = Date.now()
    while (true) {
      const sres = await fetch('/api/deploy/session/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const sjson = (await sres.json().catch(() => null)) as ApiEnvelope<any> | null
      if (!sres.ok || !sjson?.success) throw new Error(sjson?.error || 'Failed to fetch deploy status')
      const step = String(sjson.data?.step ?? '')
      if (step === 'completed') {
        const lastTxHash = (sjson.data?.lastTxHash ?? null) as Hex | null
        if (lastTxHash) setTxId(lastTxHash)
        setPhase('done')
        clearDeploySession()
        if (expectedRef.current) {
          logger.warn('[DeployVault] deploy_success (server-continued)', { creatorToken, owner, deploymentVersion, sessionId })
          onSuccess(expectedRef.current)
        }
        return
      }
      if (step === 'failed' || step === 'cancelled') {
        clearDeploySession()
        throw new Error(String(sjson.data?.lastError ?? 'Server deploy failed'))
      }
      if (Date.now() - started > 10 * 60 * 1000) {
        throw new Error('Server deploy did not complete in time. Check status and retry continue.')
      }
      if (step === 'phase2_sent' || step === 'phase3_sent' || step === 'cleanup_sent') {
        backoff = true
      }
      if (backoff) delayMs = Math.min(delayMs * 2, 8000)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }, [clearDeploySession, creatorToken, deploymentVersion, onSuccess, owner])

  useEffect(() => {
    if (!useServerContinue) return
    if (busy) return
    const sessionId = loadDeploySession()
    if (!sessionId) return

    let cancelled = false
    ;(async () => {
      setBusy(true)
      setError(null)
      setPhase('phase2')
      try {
        await ensurePaymasterSession()
        const statusRes = await fetch('/api/deploy/session/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const statusJson = (await statusRes.json().catch(() => null)) as ApiEnvelope<any> | null
        if (!statusRes.ok || !statusJson?.success) throw new Error(statusJson?.error || 'Failed to fetch deploy status')
        const step = String(statusJson.data?.step ?? '')
        if (step === 'created') {
          const continueRes = await fetch('/api/deploy/session/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          const continueJson = (await continueRes.json().catch(() => null)) as ApiEnvelope<any> | null
          if (!continueRes.ok || !continueJson?.success) {
            throw new Error(continueJson?.error || 'Failed to continue deploy')
          }
        }
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
  }, [busy, ensurePaymasterSession, formatDeployError, loadDeploySession, pollServerDeploySession, useServerContinue])

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

  const strategyCodeIds = useMemo(() => {
    return {
      charmAlphaVaultDeploy: keccak256(DEPLOY_BYTECODE.CharmAlphaVaultDeploy as Hex),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaStrategy: keccak256(DEPLOY_BYTECODE.AjnaStrategy as Hex),
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
        return batcherBytecode.toLowerCase().includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
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

      // IMPORTANT: The onchain `CreatorVaultBatcher` uses *lowercase* symbols for salts + oracle wiring,
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

      // IMPORTANT: burnStream + payoutRouter are deployed via UniversalCreate2DeployerFromStore in Phase 2.
      // The paymaster computes expected addresses using `bytecodeStore.get(codeId)` + CREATE2.
      // To avoid mismatches, compute these expected addresses the same way (fall back to local bytecode if needed).
      let burnStreamAddress = predictCreate2Address({ create2Deployer, salt: burnStreamSalt, initCode: burnStreamInitCode })
      let payoutRouterAddress = (() => {
        const args = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
          creatorToken,
          vaultAddress,
          burnStreamAddress,
          owner,
          getAddress(BASE_SWAP_ROUTER as Address),
          weth,
        ])
        const init = concatHex([DEPLOY_BYTECODE.PayoutRouter as Hex, args])
        return predictCreate2Address({ create2Deployer, salt: payoutRouterSalt, initCode: init })
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
          const [burnCreation, routerCreation] = (await Promise.all([
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
          ])) as [Hex, Hex]

          const burnInitHash = keccak256(concatHex([burnCreation as Hex, burnStreamArgs]))
          burnStreamAddress = getCreate2Address({ from: create2Deployer, salt: burnStreamSalt, bytecodeHash: burnInitHash })

          const routerArgsFixed = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
            creatorToken,
            vaultAddress,
            burnStreamAddress,
            owner,
            getAddress(BASE_SWAP_ROUTER as Address),
            weth,
          ])
          const routerInitHash = keccak256(concatHex([routerCreation as Hex, routerArgsFixed]))
          payoutRouterAddress = getCreate2Address({ from: create2Deployer, salt: payoutRouterSalt, bytecodeHash: routerInitHash })
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
        },
      }
    },
  })

  const expected = expectedQuery.data?.expected ?? null
  const expectedCreate2Deployer = expectedQuery.data?.create2Deployer ?? null
  const expectedShareOftSaltOverride = expectedQuery.data?.shareOftSaltOverride ?? null
  const expectedGauge = expected?.gaugeController ?? null
  const expectedBurnStream = expected?.burnStream ?? null
  const expectedPayoutRouter = expected?.payoutRouter ?? null

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
    expectedPayoutRouter.toLowerCase() !== currentPayoutRecipient.toLowerCase()

  const submit = async () => {
    if (busy) return

    // Simple rate limit: avoid accidental double-submits after a quick reload/click.
    if (typeof window !== 'undefined') {
      try {
        const now = Date.now()
        const last = Number(localStorage.getItem('cv:deploy:lastAttemptAt') ?? '0')
        const retryWindowMs = 2000
        if (Number.isFinite(last) && last > 0 && now - last < retryWindowMs) {
          const remainingMs = retryWindowMs - (now - last)
          const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000))
          setError(`Please wait ${remainingSec}s before retrying deploy.`)
          window.setTimeout(() => setError(null), retryWindowMs)
          return
        }
        localStorage.setItem('cv:deploy:lastAttemptAt', String(now))
      } catch {
        // ignore
      }
    }

    setBusy(true)
    setError(null)
    setTxId(null)
    setPhase('idle')
    setPhaseTxs({})

    try {
      await ensurePaymasterSession()
      if (!batcherAddress) throw new Error('CreatorVaultBatcher is not configured. Set VITE_CREATOR_VAULT_BATCHER.')
      if (!publicClient) throw new Error('Network client not ready')
      if (!expected || !expectedGauge || !expectedBurnStream || !expectedPayoutRouter || !expectedCreate2Deployer)
        throw new Error('Failed to compute expected deployment addresses')
      if (!floorPriceQ96Aligned || floorPriceQ96Aligned <= 0n) {
        throw new Error('Market floor price not available. Wait for pricing to load.')
      }

      const depositAmount = minFirstDeposit
      const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
      // Safety: `CreatorVaultBatcher` tries to call `CreatorCoin.setPayoutRecipient(payoutRecipient)` when non-zero.
      // Zora Creator Coins restrict `setPayoutRecipient` to the coin owner, so that internal call reverts (msg.sender=batcher).
      // We always pass `address(0)` to the batcher and, when needed, set payoutRecipient from the identity wallet separately.
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
        owner,
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

      const vaultSetBurnStreamCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setBurnStream',
          args: [expectedBurnStream],
        }),
      } as const

      const vaultWhitelistRouterCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setWhitelist',
          args: [expectedPayoutRouter, true],
        }),
      } as const

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
      const supportsPhase1WithSalt = (() => {
        if (!expectedShareOftSaltOverride) return true
        if (!batcherBytecode || batcherBytecode === '0x') return false
        return batcherBytecode.toLowerCase().includes(BATCHER_PHASE1_WITH_SALT_SELECTOR)
      })()

      if (isTwoStepBatcher) {
        if (!supportsPhase1WithSalt) {
          logger.warn('[DeployVault] Batcher lacks vanity salt support; continuing without override', {
            batcher: batcherAddress,
          })
        }
        const phase1State = await (async () => {
          try {
            const addrs = [expected!.vault, expected!.wrapper, expected!.shareOFT] as const
            const codes = await Promise.all(addrs.map((a) => publicClient!.getBytecode({ address: a })))
            const deployed = codes.map((c) => !!c && c !== '0x')
            return { anyDeployed: deployed.some(Boolean), allDeployed: deployed.every(Boolean) } as const
          } catch {
            return {
              anyDeployed: phase1ExistsQuery.data?.anyDeployed ?? false,
              allDeployed: phase1ExistsQuery.data?.allDeployed ?? false,
            } as const
          }
        })()
        const phase1Any = phase1State.anyDeployed
        const phase1All = phase1State.allDeployed
        if (phase1Any && !phase1All) {
          throw new Error(
            `Phase 1 is partially deployed for this creator + deployment version (${deploymentVersion}). ` +
              'Bump VITE_DEPLOYMENT_VERSION to start a fresh slate, or contact support to reconcile the partial deploy.',
          )
        }

        const phase1Params = {
          creatorToken,
          owner,
          vaultName,
          vaultSymbol,
          shareName,
          shareSymbol,
          version: deploymentVersion,
        } as const
        const phase1CallData = expectedShareOftSaltOverride
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
        const phase1Call = {
          target: batcherAddress,
          value: 0n,
          data: phase1CallData,
        } as const

        const phase2CoreParams = {
          creatorToken,
          owner,
          creatorTreasury: owner,
          payoutRecipient: payoutForDeploy,
          vault: expected.vault,
          wrapper: expected.wrapper,
          shareOFT: expected.shareOFT,
          shareSymbol,
          version: deploymentVersion,
          floorPriceQ96: floorPriceQ96Aligned,
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
          auctionPercent: DEFAULT_AUCTION_PERCENT,
          requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
          floorPriceQ96: floorPriceQ96Aligned,
          auctionSteps,
        } as const

        // Phase 3 (strategies): Charm CREATOR/USDC + Ajna lending
        const charmWeightBps = 6900n
        const ajnaWeightBps = 2139n
        if (charmWeightBps <= 0n) throw new Error('Charm strategy is required')
        if (ajnaWeightBps <= 0n) throw new Error('Ajna strategy is required')
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

        const fallbackV3InitialSqrtPriceX96 = null

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
          throw new Error('Market-derived V3 price unavailable. Retry once pricing is available.')
        }

        const phase3Params = {
          creatorToken,
          owner,
          vault: expected.vault,
          version: deploymentVersion,
          initialSqrtPriceX96: marketV3InitialSqrtPriceX96 ?? fallbackV3InitialSqrtPriceX96,
          charmVaultName: charmLabel ? `CreatorVault: ${charmLabel}/USDC` : 'CreatorVault: CREATOR/USDC',
          charmVaultSymbol: charmLabel ? `CV-${charmLabel}-USDC` : 'CV-CREATOR-USDC',
          charmWeightBps,
          ajnaWeightBps,
          enableAutoAllocate: false,
        } as const

        // ============================================================
        // Deploy path: smart wallet signer (Privy or wallet_sendCalls)
        // ============================================================
        if (!publicClient) throw new Error('Public client not ready.')

        // Hard guard: require a smart wallet signer (Privy or wallet_sendCalls).
        if (!canUsePrivySmartWallet && !canUseWalletSendCalls) {
          throw new Error(
            'Smart wallet required. Sign in with wallet to access your Zora smart wallet, or use Coinbase Wallet (Base Account), then retry.',
          )
        }

        // Enforce custody: the smart wallet sender must already hold the initial deposit.
        const smartWalletBalance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        })) as bigint
        if (smartWalletBalance < depositAmount) {
          throw new Error(
            `Creator smart wallet needs ${formatDeposit(depositAmount)} ${depositSymbol} (has ${formatDeposit(smartWalletBalance)}). Transfer funds to ${shortAddress(owner)} and retry.`,
          )
        }

        const phase1Calls: Array<{ target: Address; value: bigint; data: Hex }> = phase1All ? [] : [phase1Call]

        const phase2Calls: Array<{ target: Address; value: bigint; data: Hex }> = []
        const phase2ApproveCalls: Array<{ target: Address; value: bigint; data: Hex }> = []
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

        const phase2CoreCall = {
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase2Core',
            args: [phase2CoreParams, codeIds],
          }),
        } as const

        const phase2FinalizeCall = {
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'finalizePhase2',
            args: [phase2FinalizeParams],
          }),
        } as const

        phase2Calls.push(...phase2ApproveCalls, phase2CoreCall, phase2FinalizeCall)

        if (!burnStreamAlreadyDeployed) phase2Calls.push(burnStreamDeployCall)
        if (!payoutRouterAlreadyDeployed) phase2Calls.push(payoutRouterDeployCall)
        phase2Calls.push(vaultSetBurnStreamCall)
        phase2Calls.push(vaultWhitelistRouterCall)
        if (payoutMismatch) {
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: COIN_PAYOUT_RECIPIENT_ABI,
              functionName: 'setPayoutRecipient',
              args: [expectedPayoutRouter],
            }),
          })
        }

        const phase3Calls: Array<{ target: Address; value: bigint; data: Hex }> = [
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
                  floorPriceQ96: floorPriceQ96Aligned,
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
        assertSafe(phase3Calls)
        assertSafe(phase4Calls)

        logger.warn('[DeployVault] deploy_start', {
          creatorToken,
          owner,
          deploymentVersion,
          batcher: batcherAddress,
          phases: { phase1: phase1Calls.length, phase2: phase2Calls.length, phase3: phase3Calls.length, phase4: phase4Calls.length },
        })

        // Debug helper: expose phase1 call data on window for console testing
        if (typeof window !== 'undefined' && phase1Calls.length > 0) {
          const debugInfo = {
            phase1Call: phase1Calls[0],
            owner,
            batcherAddress,
            creatorToken,
            deploymentVersion,
            testDirectCall: async () => {
              if (!publicClient) throw new Error('No publicClient')
              const call = phase1Calls[0]
              console.log('[DEBUG] Testing direct eth_call to batcher...', {
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
                console.log('[DEBUG] Direct call SUCCESS', result)
                return { success: true, result }
              } catch (e: any) {
                console.error('[DEBUG] Direct call FAILED', {
                  error: e?.message,
                  shortMessage: e?.shortMessage,
                  cause: e?.cause,
                  data: e?.cause?.data ?? e?.data,
                })
                return { success: false, error: e }
              }
            },
          }
          ;(window as any).__cvDeployDebug = debugInfo
          console.log('[DeployVault] Debug helper available: window.__cvDeployDebug.testDirectCall()')
        }

        // Helper to convert calls format
        const toCalls = (calls: Array<{ target: Address; value: bigint; data: Hex }>) =>
          calls.map((c) => ({ to: c.target, value: c.value, data: c.data }))
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        let embeddedOwnerVerifiedForKey: string | null = null
        let embeddedProviderCache: any | null = null
        let embeddedProviderAddressCache: string | null = null
        let embeddedEthSignUnsupported = false
        let embeddedWalletClientAdapterCache: any | null = null
        let connectedOwnerIsContractCache: boolean | null = null

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
          logger.warn(`[DeployVault] ${logPhaseLabel}_confirmed via ${context}`, {
            userOpHash: result.userOpHash,
            txHash: result.transactionHash,
          })
        }

        const getEmbeddedOwnerCacheKey = () => {
          if (!canonicalSmartWallet || !embeddedPrivyEoaAddress) return null
          return `${canonicalSmartWallet.toLowerCase()}:${embeddedPrivyEoaAddress.toLowerCase()}`
        }

        const ensureEmbeddedOwnerVerifiedForRun = async () => {
          if (!canonicalSmartWallet || !embeddedPrivyEoaAddress) {
            throw new Error('Embedded EOA signer is not available')
          }
          const cacheKey = getEmbeddedOwnerCacheKey()
          if (cacheKey && embeddedOwnerVerifiedForKey === cacheKey) return
          const verifyOwner = await isCoinbaseSmartWalletOwner({
            smartWallet: canonicalSmartWallet,
            ownerAddress: embeddedPrivyEoaAddress,
          })
          if (!verifyOwner) {
            logger.error('[DeployVault] Embedded EOA is NOT an owner on-chain!', {
              canonicalSmartWallet,
              embeddedPrivyEoaAddress,
            })
            throw new Error(
              `Your Privy embedded wallet (${embeddedPrivyEoaAddress}) is not an owner of your Zora wallet. ` +
                'Click "Enable Gas-Free Deploys" first.',
            )
          }
          embeddedOwnerVerifiedForKey = cacheKey
        }

        const getEmbeddedProviderForRun = async () => {
          if (!embeddedPrivyWallet || !embeddedPrivyEoaAddress) {
            throw new Error('Embedded wallet provider not available')
          }
          if (embeddedProviderCache) return embeddedProviderCache

          const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider()
          if (!embeddedProvider?.request) {
            throw new Error('Embedded wallet provider not available')
          }

          await ensureProviderOnBase(embeddedProvider, 'Privy embedded wallet', { allowSwitch: false })
          const accounts = (await embeddedProvider.request({ method: 'eth_accounts' })) as string[]
          const providerAddress = accounts[0]?.toLowerCase()
          if (providerAddress !== embeddedPrivyEoaAddress.toLowerCase()) {
            logger.error('[DeployVault] Provider address mismatch!', {
              expected: embeddedPrivyEoaAddress,
              got: providerAddress,
            })
            throw new Error('Embedded wallet address mismatch. Please refresh and try again.')
          }

          embeddedProviderCache = embeddedProvider
          embeddedProviderAddressCache = providerAddress ?? null
          return embeddedProviderCache
        }

        const signUserOpHashWithEmbeddedProvider = async (params: { provider: any; signerAddr: Address; hashToSign: Hex }) => {
          const { provider, signerAddr, hashToSign } = params
          const trySecp256k1Sign = async () => {
            if (AA_DEBUG) {
              logger.debug('[DeployVault] Trying secp256k1_sign fallback for embedded EOA')
            }
            const rawResult = await withTimeout(
              provider.request({
                method: 'secp256k1_sign',
                params: [hashToSign],
              }),
              30_000,
              'secp256k1_sign',
            )
            const sig = ensureSignatureHex(rawResult, 'secp256k1_sign')
            debugSignatureReady('secp256k1_sign', sig, { signer: signerAddr })
            return sig
          }

          if (embeddedEthSignUnsupported) {
            if (AA_DEBUG) {
              logger.debug('[DeployVault] Skipping eth_sign (unsupported earlier in this deploy run)')
            }
            return await trySecp256k1Sign()
          }

          try {
            const rawResult = await withTimeout(
              provider.request({
                method: 'eth_sign',
                params: [signerAddr, hashToSign],
              }),
              30_000,
              'eth_sign',
            )
            const sig = ensureSignatureHex(rawResult, 'eth_sign')
            debugSignatureReady('eth_sign', sig, { signer: signerAddr })
            return sig
          } catch (ethSignError: any) {
            const msg = ethSignError?.message ? String(ethSignError.message) : 'eth_sign failed'
            logger.warn('[DeployVault] eth_sign failed for embedded EOA', { error: msg })
            if (isEthSignUnsupported(ethSignError)) {
              embeddedEthSignUnsupported = true
              try {
                return await trySecp256k1Sign()
              } catch (fallbackError: any) {
                const fallbackMsg = fallbackError?.message ? String(fallbackError.message) : 'secp256k1_sign failed'
                logger.warn('[DeployVault] secp256k1_sign failed for embedded EOA', { error: fallbackMsg })
              }
            }
            throw new Error(
              'Embedded wallet does not support eth_sign or secp256k1_sign. ' +
                'UserOp signing for Coinbase Smart Wallet requires raw signing. ' +
                'Use Coinbase Wallet (Base Account) or connect an owner EOA.',
            )
          }
        }

        const getEmbeddedWalletClientAdapterForRun = async () => {
          if (embeddedWalletClientAdapterCache) return embeddedWalletClientAdapterCache
          const provider = await getEmbeddedProviderForRun()
          embeddedWalletClientAdapterCache = {
            request: async (args: { method: string; params?: any[] }) => {
              logger.info('[DeployVault] Embedded provider request', { method: args.method })
              if (args.method === 'eth_sign') {
                const [signerAddrRaw, hashToSignRaw] = Array.isArray(args.params) ? args.params : []
                const signerAddrCandidate =
                  typeof signerAddrRaw === 'string' && isAddress(signerAddrRaw)
                    ? signerAddrRaw
                    : embeddedPrivyEoaAddress
                if (!signerAddrCandidate || !isAddress(signerAddrCandidate)) {
                  throw new Error('Embedded wallet signer address is unavailable')
                }
                const signerAddr = getAddress(signerAddrCandidate) as Address
                const hashToSign = String(hashToSignRaw ?? '') as Hex
                if (AA_DEBUG) {
                  logger.debug('[DeployVault] eth_sign called', {
                    signer: signerAddr,
                    hashLength: typeof hashToSign === 'string' ? hashToSign.length : null,
                    hashLooksValid: isUserOpHashLike(hashToSign),
                    providerAddress: embeddedProviderAddressCache,
                  })
                }
                return await signUserOpHashWithEmbeddedProvider({ provider, signerAddr, hashToSign })
              }

              try {
                const result = await provider.request(args)
                logger.info('[DeployVault] Embedded provider response', { method: args.method })
                return result
              } catch (e: any) {
                logger.error('[DeployVault] Embedded provider error', { method: args.method, error: e?.message })
                throw e
              }
            },
            signMessage: async (args: { account: Address; message: any }) => {
              const msg = typeof args.message === 'object' && 'raw' in args.message ? args.message.raw : args.message
              const msgHex = typeof msg === 'string' && msg.startsWith('0x') ? msg : `0x${Buffer.from(String(msg)).toString('hex')}`

              if (AA_DEBUG) {
                logger.debug('[DeployVault] signMessage', { account: args.account, msgLength: msgHex?.length })
              }

              const rawResult = await withTimeout(
                provider.request({
                  method: 'personal_sign',
                  params: [msgHex, args.account],
                }),
                30_000,
                'personal_sign',
              )
              const sig = ensureSignatureHex(rawResult, 'personal_sign')
              debugSignatureReady('personal_sign', sig, { signer: args.account })
              return sig
            },
            signTypedData: async (args: any) => {
              if (AA_DEBUG) {
                logger.debug('[DeployVault] signTypedData', { primaryType: args.primaryType })
              }
              const rawResult = await withTimeout(
                provider.request({
                  method: 'eth_signTypedData_v4',
                  params: [embeddedPrivyEoaAddress, JSON.stringify(args)],
                }),
                30_000,
                'eth_signTypedData_v4',
              )
              const sig = ensureSignatureHex(rawResult, 'eth_signTypedData_v4')
              debugSignatureReady('eth_signTypedData_v4', sig, { signer: embeddedPrivyEoaAddress })
              return sig
            },
          }
          return embeddedWalletClientAdapterCache
        }

        const detectConnectedOwnerIsContractForRun = async (): Promise<boolean> => {
          if (typeof connectedOwnerIsContractCache === 'boolean') return connectedOwnerIsContractCache
          if (!connectedAddress || !publicClient) {
            connectedOwnerIsContractCache = false
            return false
          }
          try {
            let bytecode: string | null = null
            if (typeof (publicClient as any)?.getBytecode === 'function') {
              bytecode = await (publicClient as any).getBytecode({ address: connectedAddress as Address })
            } else if (typeof (publicClient as any)?.getCode === 'function') {
              bytecode = await (publicClient as any).getCode({ address: connectedAddress as Address })
            }
            connectedOwnerIsContractCache = typeof bytecode === 'string' && bytecode !== '0x'
          } catch {
            connectedOwnerIsContractCache = false
          }
          if (connectedOwnerIsContractCache && AA_DEBUG) {
            logger.debug('[DeployVault] Connected owner detected as contract signer (EIP-1271 path)', {
              connectedAddress,
            })
          }
          return connectedOwnerIsContractCache
        }

        const sendPhaseCalls = async (
          calls: Array<{ target: Address; value: bigint; data: Hex }>,
          phaseLabel: 'phase1' | 'phase2' | 'phase3' | 'phase4',
          opts?: { noSplit?: boolean; segment?: string },
        ) => {
          const logPhaseLabel = opts?.segment ? `${phaseLabel}.${opts.segment}` : phaseLabel
          const hasEmbeddedEoaSigner = embeddedEoaIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress
          const connectedOwnerReady = connectedIsCanonicalOwner && connectedAddress && wagmiWalletClient
          const connectedOwnerIsContract = connectedOwnerReady
            ? await detectConnectedOwnerIsContractForRun()
            : false
          const preferEmbeddedEoaSigner = hasEmbeddedEoaSigner || preferEmbeddedEoaRef.current
          if (preferEmbeddedEoaSigner && !preferEmbeddedEoaRef.current) {
            logger.info('[DeployVault] Preferring embedded EOA signer for this phase', {
              canonicalSmartWallet,
              embeddedPrivyEoaAddress,
              connectedIsCanonicalOwner,
              connectedOwnerReady,
              connectedOwnerIsContract,
            })
          }
          const batcherAddressLc = getAddress(batcherAddress).toLowerCase()
          const batcherCallCount = calls.reduce((acc, c) => {
            return getAddress(c.target).toLowerCase() === batcherAddressLc ? acc + 1 : acc
          }, 0)
          const hasBatcherCall = batcherCallCount > 0

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
                    'Phase1Missing()': 'Phase 1 contracts must be deployed before Phase 2. Deploy Phase 1 first.',
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
                      'Phase1Missing()': 'Phase 1 contracts must be deployed first.',
                      'Phase2Missing()': 'Phase 2 contracts must be deployed first.',
                    }
                    const helpText = errorMessages[simResult.directCallResult.errorName] ?? `Contract reverted with: ${simResult.directCallResult.errorName}`
                    throw new Error(`${logPhaseLabel} would revert: ${helpText}`)
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
            isCoinbaseWalletDirect &&
            connectedAddress &&
            wagmiWalletClient &&
            publicClient &&
            canonicalSmartWallet &&
            !hasEmbeddedEoaSigner
          ) {
            logger.info(`[DeployVault] Using Coinbase Wallet direct for ${logPhaseLabel}`)

            await ensureBaseChain('Coinbase Wallet')
            
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
            return
          }
          
          // PATH 2: Privy app smart wallet is an owner (EIP-1271 signer)
          // Original deploy pattern: avoid this path when the embedded EOA owner flow is available.
          if (
            canonicalSmartWallet &&
            !embeddedEoaIsCanonicalOwner &&
            privySmartWalletIsCanonicalOwner &&
            privySmartWalletCanSign &&
            smartWalletClient &&
            privySmartWalletAddress &&
            publicClient &&
            !preferEmbeddedEoaRef.current
          ) {
            logger.info(`[DeployVault] Using ERC-4337 via Privy smart wallet owner for ${logPhaseLabel}`, {
              canonicalSmartWallet,
              privySmartWalletAddress,
            })

            await ensureProviderOnBase(smartWalletClient, 'Privy smart wallet')

            const smartWalletClientAdapter = {
              request: async (args: { method: string; params: any[] }) => {
                const client: any = smartWalletClient as any
                const account: any = client?.account
                if (args.method === 'eth_sign') {
                  const [, hashToSign] = args.params ?? []
                  if (AA_DEBUG) {
                    logger.debug('[DeployVault] Privy smart wallet eth_sign', {
                      hasAccountSign: typeof account?.sign === 'function',
                      hasAccountSignMessage: typeof account?.signMessage === 'function',
                      hasClientSignMessage: typeof client?.signMessage === 'function',
                    })
                  }
                  let rawResult: unknown
                  if (typeof account?.sign === 'function') {
                    rawResult = await account.sign({ hash: hashToSign })
                  } else if (typeof account?.signMessage === 'function') {
                    rawResult = await account.signMessage({ message: { raw: hashToSign } })
                  } else if (typeof client?.signMessage === 'function') {
                    rawResult = await client.signMessage({ account: privySmartWalletAddress, message: { raw: hashToSign } })
                  } else {
                    throw new Error('Privy smart wallet does not support raw signing')
                  }
                  const sig = ensureSignatureHex(rawResult, 'privySmartWallet.eth_sign')
                  logNonEoaSignature(sig, 'privySmartWallet.eth_sign')
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
                  const rawResult = await withTimeout(
                    hasAccountSignMessage
                      ? account.signMessage({ message: msg })
                      : client.signMessage({ account: privySmartWalletAddress, message: msg }),
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
              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: smartWalletClientAdapter as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: privySmartWalletAddress,
                calls: toCalls(calls),
                version: '1',
                userOpSignMode: 'eth_sign',
                ownerIsContract: true,
              })

              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'ERC-4337 (privy smart wallet owner)')
              return
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e ?? '')
              const lc = msg.toLowerCase()
              const shouldFallback =
                lc.includes('invalid signature') ||
                lc.includes('signature check failed') ||
                lc.includes('signature verification used more gas') ||
                lc.includes('verificationgaslimit') ||
                lc.includes('aa40') ||
                lc.includes('banned opcode') ||
                lc.includes('stake/unstake delay') ||
                lc.includes('unstake delay too low') ||
                lc.includes('total gas used by the user operation') ||
                (lc.includes('total gas used') && lc.includes('allowed limit')) ||
                lc.includes('invalid fields')
              if (shouldFallback) {
                preferEmbeddedEoaRef.current = true
                logger.warn('[DeployVault] Privy smart wallet signer failed; continuing without it', {
                  phaseLabel: logPhaseLabel,
                  privySmartWalletAddress,
                  error: msg,
                })
              } else {
                throw e
              }
            }
          }
          
          const tryConnectedEoaSigner = async (): Promise<boolean> => {
            // PATH 3: Connected EOA is owner of canonical smart wallet
            // Use ERC-4337 with the EOA signing UserOps for the canonical wallet
            if (!canonicalSmartWallet || !connectedIsCanonicalOwner || !connectedAddress || !wagmiWalletClient || !publicClient) {
              return false
            }

            logger.info(`[DeployVault] Using ERC-4337 via connected EOA for ${logPhaseLabel}`)

            await ensureBaseChain('your wallet')

            logger.info('[DeployVault] Sending ERC-4337 UserOp via connected EOA', {
              canonicalSmartWallet,
              connectedEOA: connectedAddress,
              callCount: calls.length,
              connectedOwnerIsContract,
            })

            try {
              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: wagmiWalletClient as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: connectedAddress as Address,
                calls: toCalls(calls),
                version: '1',
                ownerIsContract: connectedOwnerIsContract,
              })

              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'ERC-4337 (connected EOA signer)')
              return true
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e ?? '')
              const lc = msg.toLowerCase()
              const shouldFallbackToEmbedded =
                Boolean(hasEmbeddedEoaSigner) &&
                (
                  connectedOwnerIsContract ||
                  lc.includes('signature verification used more gas') ||
                  lc.includes('verificationgaslimit') ||
                  lc.includes('aa40') ||
                  lc.includes('total gas used by the user operation') ||
                  (lc.includes('total gas used') && lc.includes('allowed limit')) ||
                  lc.includes('invalid fields') ||
                  lc.includes('invalid signature') ||
                  lc.includes('signature check failed')
                )
              if (shouldFallbackToEmbedded) {
                preferEmbeddedEoaRef.current = true
                logger.warn('[DeployVault] Connected owner signer failed; retrying with embedded EOA', {
                  phaseLabel: logPhaseLabel,
                  connectedEOA: connectedAddress,
                  connectedOwnerIsContract,
                  error: msg,
                })
                return false
              }
              throw e
            }
          }

          const tryEmbeddedEoaSigner = async (): Promise<boolean> => {
            // PATH 2: Privy embedded EOA is owner of canonical smart wallet
            // Use ERC-4337 with the embedded EOA signing directly (simple ecrecover, no EIP-1271)
            if (!canonicalSmartWallet || !embeddedEoaIsCanonicalOwner || !embeddedPrivyWallet || !embeddedPrivyEoaAddress) {
              return false
            }
            try {
              logger.info(`[DeployVault] Using ERC-4337 via Privy embedded EOA for ${logPhaseLabel}`, {
                canonicalSmartWallet,
                embeddedPrivyEoaAddress,
                embeddedEoaIsCanonicalOwner,
              })

              await ensureEmbeddedOwnerVerifiedForRun()
              const embeddedWalletClientAdapter = await getEmbeddedWalletClientAdapterForRun()

              logger.info('[DeployVault] Sending ERC-4337 UserOp via embedded EOA', {
                canonicalSmartWallet,
                embeddedEoa: embeddedPrivyEoaAddress,
                callCount: calls.length,
              })

              const result = await sendCoinbaseSmartWalletUserOperation({
                publicClient: publicClient as any,
                walletClient: embeddedWalletClientAdapter as any,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                ownerAddress: embeddedPrivyEoaAddress,
                calls: toCalls(calls),
                version: '1',
                userOpSignMode: 'eth_sign',
              })

              persistUserOpResult(phaseLabel, logPhaseLabel, result, 'ERC-4337 (embedded EOA signer)')
              preferEmbeddedEoaRef.current = true
              return true
            } catch (e: any) {
              const msg = e instanceof Error ? e.message : String(e ?? '')
              const lc = msg.toLowerCase()
              const shouldFallback =
                isEthSignUnsupported(e) ||
                lc.includes('eth_sign') ||
                lc.includes('secp256k1_sign') ||
                lc.includes('raw signing') ||
                lc.includes('does not support')
              if (shouldFallback) {
                logger.warn('[DeployVault] Embedded EOA signer unavailable; falling back to connected owner', {
                  error: msg,
                })
                return false
              }
              throw e
            }
          }

          // PATH 2/3: prefer a connected EOA when available unless we explicitly prefer embedded EOA.
          if (!preferEmbeddedEoaSigner) {
            const connectedOk = await tryConnectedEoaSigner()
            if (connectedOk) return
          }

          const embeddedOk = await tryEmbeddedEoaSigner()
          if (embeddedOk) return

          if (preferEmbeddedEoaSigner) {
            const connectedOk = await tryConnectedEoaSigner()
            if (connectedOk) return
          }
          
          // No valid ERC-4337 path available
          throw new Error(
            'ERC-4337 deployment requires one of:\n' +
            '1. Connect with Coinbase Wallet (recommended)\n' +
            '2. Add your app smart wallet as an owner of your Zora wallet (EIP-1271)\n' +
            '3. Connect with an EOA that is an owner of your Zora smart wallet',
          )
        }

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

        const phase2PostCalls = phase2Calls.filter(
          (c) => c !== phase2CoreCall && c !== phase2FinalizeCall && !phase2ApproveCalls.includes(c),
        )
        // IMPORTANT: Keep a batcher call in the same sponsored UserOp.
        // The paymaster requires a "primary" call to `creatorVaultBatcher` / `vaultActivationBatcher`,
        // so we bundle finalize + post into one executeBatch to avoid `missing_primary_call`.
        const phase2FinalizeAndPostCalls = (() => {
          if (phase2PostCalls.length === 0) return [phase2FinalizeCall]

          // Ordering matters for simulation:
          // - Deploy burnStream + payoutRouter first (CREATE2 from store)
          // - Then run `finalizePhase2`
          // - Then apply vault admin wiring + any remaining post calls
          const create2Calls = phase2PostCalls.filter(
            (c) => String(c.target).toLowerCase() === String(expectedCreate2Deployer).toLowerCase(),
          )
          const vaultAdminCalls = phase2PostCalls.filter(
            (c) => String(c.target).toLowerCase() === String(expected.vault).toLowerCase(),
          )
          const rest = phase2PostCalls.filter((c) => !create2Calls.includes(c) && !vaultAdminCalls.includes(c))

          return [...create2Calls, phase2FinalizeCall, ...vaultAdminCalls, ...rest]
        })()

        if (useServerContinue) {
          let shouldUseServerContinueForRun = true
          let serverContinueStartedOnchain = false
          let sessionId: string | null = null
          const cancelSession = async () => {
            if (!sessionId) return
            try {
              await fetch('/api/deploy/session/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              })
            } catch {
              // ignore cleanup failures
            }
          }

          try {
            // Pre-flight: ensure we know which app session address the server will see.
            // This makes ownership mismatches obvious before session creation.
            try {
              const authRes = await fetch('/api/auth/me', {
                method: 'GET',
                headers: { Accept: 'application/json' },
              })
              const authJson = (await authRes.json().catch(() => null)) as ApiEnvelope<{ address: string } | null> | null
              const rawAuthAddress = typeof authJson?.data?.address === 'string' ? authJson.data.address : null
              const authAddress = rawAuthAddress && isAddress(rawAuthAddress) ? getAddress(rawAuthAddress) : null
              const expectedSessionSender = getAddress(owner)
              const matchesExpectedSender = !!authAddress && authAddress.toLowerCase() === expectedSessionSender.toLowerCase()
              logger.info('[DeployVault] deploy session auth pre-flight', {
                authResOk: authRes.ok,
                authAddress,
                expectedSessionSender,
                matchesExpectedSender,
                useServerContinue,
              })
              if (!matchesExpectedSender) {
                logger.warn('[DeployVault] Auth session sender differs from expected deploy sender', {
                  authAddress,
                  expectedSessionSender,
                })
                shouldUseServerContinueForRun = false
              }
            } catch (authError) {
              logger.warn('[DeployVault] Failed to preflight auth session before deploy session creation', {
                error: authError instanceof Error ? authError.message : String(authError),
              })
              // If we cannot confirm auth session identity, avoid server-continue and
              // proceed with client-side continuation for this run.
              shouldUseServerContinueForRun = false
            }

            if (!shouldUseServerContinueForRun) {
              logger.warn('[DeployVault] Skipping server-continue for this run; using client-side continuation')
              // Continue with client-side phase execution below.
            } else {
              // Create a deploy session BEFORE we install the temporary owner.
              // The paymaster uses the recorded deploy session to allow self-calls to owner mgmt.
              const createRes = await fetch('/api/deploy/session/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  smartWallet: owner,
                  creatorToken,
                  ownerAddress: owner,
                  // Server runs finalize+post (must include batcher call for paymaster primary-call requirement)
                  phase2Calls: phase2FinalizeAndPostCalls.map((c) => ({ to: c.target, value: String(c.value ?? 0n), data: c.data })),
                  // Server also runs strategies + deferred auction (optional)
                  phase3Calls: [...phase3Calls, ...phase4Calls].map((c) => ({ to: c.target, value: String(c.value ?? 0n), data: c.data })),
                  version: deploymentVersion,
                }),
              })
              const createJson = (await createRes.json().catch(() => null)) as ApiEnvelope<any> | null
              if (!createRes.ok || !createJson?.success) {
                throw new Error(createJson?.error || 'Failed to create deploy session')
              }
              sessionId = String(createJson.data?.sessionId ?? '').trim()
              const sessionOwner = String(createJson.data?.sessionOwner ?? '').trim()
              if (!sessionId || !isAddress(sessionOwner)) throw new Error('Invalid deploy session response')
              persistDeploySession(sessionId)

              // Install the temporary owner (agent wallet) during the Phase2 core UserOp.
              const addOwnerData = encodeFunctionData({
                abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
                functionName: 'addOwnerAddress',
                args: [getAddress(sessionOwner as Address)],
              })
              await sendPhaseCalls(
                [
                  { target: owner, value: 0n, data: addOwnerData },
                  phase2CoreCall,
                ],
                'phase2',
                { noSplit: true, segment: 'core' },
              )
              serverContinueStartedOnchain = true
              await waitForContractsDeployed({
                publicClient: publicClient as any,
                addresses: [expected.gaugeController, expected.ccaStrategy, expected.oracle],
                label: 'Phase 2 core',
              })

              // Ask the server to continue (finalize_post + phase3/4 + cleanup).
              const continueRes = await fetch('/api/deploy/session/continue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              })
              const continueJson = (await continueRes.json().catch(() => null)) as ApiEnvelope<any> | null
              if (!continueRes.ok || !continueJson?.success) {
                throw new Error(continueJson?.error || 'Failed to continue deploy')
              }

              await pollServerDeploySession(sessionId)
              return
            }
          } catch (err) {
            await cancelSession()
            if (!serverContinueStartedOnchain) {
              logger.warn('[DeployVault] Server-continue unavailable; falling back to client-side continuation', {
                error: err instanceof Error ? err.message : String(err),
              })
              // Continue with client-side phase execution below.
            } else {
              throw err
            }
          }
        }

        await sendPhaseCalls([phase2CoreCall], 'phase2', { noSplit: true, segment: 'core' })
        await waitForContractsDeployed({
          publicClient: publicClient as any,
          addresses: [expected.gaugeController, expected.ccaStrategy, expected.oracle],
          label: 'Phase 2 core',
        })
        await sendPhaseCalls(phase2FinalizeAndPostCalls, 'phase2', {
          noSplit: true,
          segment: phase2PostCalls.length > 0 ? 'finalize_post' : 'finalize',
        })

        // Phase 3: Strategies (optional)
        if (phase3Calls.length > 0) {
          setPhase('phase3')
          await sendPhaseCalls(phase3Calls, 'phase3')
        }
        if (phase4Calls.length > 0) {
          setPhase('phase4')
          await sendPhaseCalls(phase4Calls, 'phase4')
        }

        setPhase('done')
        logger.warn('[DeployVault] deploy_success', { creatorToken, owner, deploymentVersion })
        onSuccess(expected)
        return
      }
    } catch (e: any) {
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
            // Show success message - user should refresh to see vault
            setPhase('done')
            logger.warn('[DeployVault] deploy_success (recovered from estimation error)', { txHash })
            if (expected) onSuccess(expected)
            return
          }
        } catch (receiptError) {
          logger.warn('[DeployVault] Failed to get receipt for submitted tx', { txHash, error: receiptError })
        }
      }
      
      let pretty = formatDeployError(e)
      logger.warn('[DeployVault] deploy_failed', { error: pretty })
      setError(pretty)
    } finally {
      setBusy(false)
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

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-zinc-500 leading-relaxed">
        One click will submit <span className="text-zinc-200">up to 4</span> onchain operations (Phases 1–4) via your smart wallet.
        Progress is tracked below.
      </div>
      {authIsStale ? (
        <div className="text-[11px] text-amber-300/70">
          You’re signed in from an earlier session. Clicking deploy will submit transactions immediately.
        </div>
      ) : null}

      <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Progress</div>
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
          Payout recipient will update to{' '}
          <span className="font-mono text-amber-200">{shortAddress(expectedGauge!)}</span> during deploy. Continue only if this is
          intended.
        </div>
      ) : null}

      <details className="group rounded-lg border border-white/5 bg-black/20">
        <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Deployment plan</div>
            <div className="text-[12px] text-zinc-200 truncate">Phases 1–4 · deterministic addresses</div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-1">
          <div className="text-[11px] text-zinc-600 mb-3">
            Addresses are deterministic on Base. Click to view on BaseScan.
          </div>

          <div className="rounded-md border border-white/5 bg-black/30 divide-y divide-white/5">
            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 1</div>
              <div className="space-y-2">
                <AddressRow label="Vault" address={expected?.vault} />
                <AddressRow label="Wrapper" address={expected?.wrapper} />
                <AddressRow label="Share token" address={expected?.shareOFT} />
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 2</div>
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
                    <div className="text-zinc-500">CCA floor</div>
                    <div className="text-zinc-200/90">{marketFloorText}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 3</div>
              <div className="text-[11px] text-zinc-600">
                Strategy deployments + registrations (Charm CREATOR/USDC + Ajna).
              </div>
            </div>
          </div>
        </div>
      </details>

      <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
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
      {isCoinbaseWalletDirect || embeddedEoaIsCanonicalOwner || connectedIsCanonicalOwner ? (
        <div className="space-y-2">
          <div className="text-[10px] text-green-400/80 flex items-center gap-1">
            <span>✓</span> Gas-free ERC-4337 {
              isCoinbaseWalletDirect ? 'via Coinbase Wallet' :
              embeddedEoaIsCanonicalOwner ? 'via Privy embedded wallet' :
              'via connected wallet (owner)'
            }
          </div>
          <button type="button" onClick={() => void submit()} disabled={disabled} className="btn-accent w-full rounded-lg">
            {busy ? 'Deploying…' : '1‑Click Deploy (Gas-Free)'}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <div className="text-sm font-medium text-amber-200">ERC-4337 Setup Required</div>
          <div className="text-[11px] text-amber-200/70 leading-relaxed">
            All deployments use gas-sponsored ERC-4337 UserOperations.
          </div>
          <div className="text-[11px] text-zinc-400 space-y-1">
            <div>Option 1: Connect with <strong className="text-amber-200">Coinbase Wallet</strong> (instant)</div>
            <div>Option 2: Add your app smart wallet as owner (EIP-1271 setup below)</div>
            <div>Option 3: Connect with an EOA that is an owner of your Zora smart wallet</div>
          </div>
        </div>
      )}

      {disabledReason && !busy ? (
        <div className="text-[11px] text-amber-300/80">{disabledReason}</div>
      ) : null}

      {marketFloorText ? <div className="text-[11px] text-zinc-500">Market floor: {marketFloorText}</div> : null}

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
  const { ready: privyReady, authenticated: privyAuthenticated, logout, getAccessToken } = usePrivy() as any
  const { login } = useLogin()
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const siwe = useSiweAuth()
  // State for adding Privy embedded EOA as owner (legacy gas-free ERC-4337)
  const [addPrivySwOwnerBusy, setAddPrivySwOwnerBusy] = useState(false)
  const [addPrivySwOwnerTxHash, setAddPrivySwOwnerTxHash] = useState<string | null>(null)
  const [addPrivySwOwnerError, setAddPrivySwOwnerError] = useState<string | null>(null)
  // State for adding Privy app smart wallet as owner (EIP-1271 signer)
  const [addPrivySmartWalletOwnerBusy, setAddPrivySmartWalletOwnerBusy] = useState(false)
  const [addPrivySmartWalletOwnerTxHash, setAddPrivySmartWalletOwnerTxHash] = useState<string | null>(null)
  const [addPrivySmartWalletOwnerError, setAddPrivySmartWalletOwnerError] = useState<string | null>(null)
  const autoLoginAttemptRef = useRef(false)
  const autoBridgeAttemptRef = useRef(false)
  const [handoffState, setHandoffState] = useState<'idle' | 'signingIn' | 'bridging' | 'ready' | 'error'>('idle')
  const [handoffError, setHandoffError] = useState<string | null>(null)
  
  // Get smart wallet address - simplified approach
  // The connected wallet (from wagmi) is the EOA, the canonical identity might be a smart wallet
  // We'll check ownership separately
  const privySmartWalletAddress = useMemo(() => {
    try {
      const addr = smartWalletClient?.account?.address
      return addr && isAddress(addr) ? getAddress(addr) as Address : null
    } catch {
      return null
    }
  }, [smartWalletClient])

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
    return isConnected || !!privySmartWalletAddress || !!privyLinkedEoaAddress
  }, [isConnected, privyLinkedEoaAddress, privySmartWalletAddress])
  
  // Effective wallet address for display - prefer Privy smart wallet (set during waitlist), fallback to wagmi
  const effectiveWalletAddress = useMemo(() => {
    return privySmartWalletAddress ?? connectedWalletAddress ?? privyLinkedEoaAddress
  }, [connectedWalletAddress, privyLinkedEoaAddress, privySmartWalletAddress])
  const deploymentVersion = useMemo(() => {
    const raw = (import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined) ?? 'v1.1.10'
    const v = String(raw).trim()
    return v.length > 0 ? v : 'v1.1.10'
  }, [])
  const shareOftSaltOverride = useMemo(() => {
    const env = normalizeBytes32(import.meta.env.VITE_SHARE_OFT_SALT_OVERRIDE as string | undefined)
    if (typeof window === 'undefined') return env
    const params = new URLSearchParams(window.location.search)
    const query = normalizeBytes32(params.get('shareOftSaltOverride'))
    return query ?? env
  }, [])

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
      await login({ loginMethods: ['wallet'] })
    }
    return {
      label: privyAuthenticated ? 'Switch to wallet sign-in' : 'Sign in with wallet',
      onClick: () => void run(),
    }
  }, [login, logout, privyAuthenticated, privyReady])

  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(wallets) ? (wallets as any[]) : []
    return (
      ws.find((w) => {
        const t = String(
          (w as any)?.wallet_client_type ??
            (w as any)?.walletClientType ??
            (w as any)?.connector_type ??
            (w as any)?.connectorType ??
            '',
        ).toLowerCase()
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [wallets])

  // Privy embedded wallet objects are not consistent about what `wallet.address` means
  // (it can be the Privy app smart wallet, not the embedded EOA).
  // The ONLY reliable source of the embedded EOA is the embedded provider’s `eth_accounts`.
  const [embeddedPrivyEoaFromProvider, setEmbeddedPrivyEoaFromProvider] = useState<Address | null>(null)

  const embeddedPrivyEoaAddress = useMemo(() => {
    try {
      if (embeddedPrivyEoaFromProvider) return embeddedPrivyEoaFromProvider
      const w: any = embeddedPrivyWallet as any
      const raw = typeof w?.address === 'string' ? String(w.address) : ''
      return raw && isAddress(raw) ? (getAddress(raw) as Address) : null
    } catch {
      return null
    }
  }, [embeddedPrivyEoaFromProvider, embeddedPrivyWallet])

  useEffect(() => {
    if (!privyAuthenticated || !embeddedPrivyWallet) return
    let mounted = true
    const run = async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request || !mounted) return
        // Capture the embedded EOA from the provider (preferred).
        try {
          const accounts = (await provider.request({ method: 'eth_accounts' })) as unknown
          const first = Array.isArray(accounts) ? String(accounts[0] ?? '') : ''
          const normalized = first && isAddress(first) ? (getAddress(first) as Address) : null
          if (mounted) setEmbeddedPrivyEoaFromProvider(normalized)
        } catch {
          // ignore
        }
        const current = await provider.request({ method: 'eth_chainId' }).catch(() => null)
        if (typeof current === 'string' && current.toLowerCase() !== BASE_CHAIN_ID_HEX) {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          })
        }
      } catch {
        // ignore - user may reject or provider may not support switching
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [embeddedPrivyWallet, privyAuthenticated])

  useEffect(() => {
    if (!privyAuthenticated || !smartWalletClient) return
    let mounted = true
    const run = async () => {
      try {
        const client: any = smartWalletClient as any
        if (typeof client.request !== 'function' || !mounted) return
        const current = await client.request({ method: 'eth_chainId' }).catch(() => null)
        if (typeof current === 'string' && current.toLowerCase() !== BASE_CHAIN_ID_HEX) {
          await client.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_CHAIN_ID_HEX }],
          })
        }
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
    autoLogin: boolean
    authHint: 'email' | 'wallet' | null
    fromWaitlist: boolean
    debugEnabledFromQuery: boolean
  } | null>(null)

  if (!initialQueryRef.current) {
    const autoLoginRaw = (searchParams.get('autologin') ?? '').trim().toLowerCase()
    const authRaw = (searchParams.get('auth') ?? '').trim().toLowerCase()
    const fromRaw = (searchParams.get('from') ?? '').trim().toLowerCase()
    initialQueryRef.current = {
      prefillToken: searchParams.get('token') ?? '',
      autoLogin: autoLoginRaw === '1' || autoLoginRaw === 'true' || autoLoginRaw === 'yes',
      authHint: authRaw === 'email' || authRaw === 'wallet' ? (authRaw as 'email' | 'wallet') : null,
      fromWaitlist: fromRaw === 'waitlist',
      debugEnabledFromQuery: (searchParams.get('debug') ?? '').trim() === '1',
    }
  }

  const prefillToken = initialQueryRef.current.prefillToken
  const autoLogin = initialQueryRef.current.autoLogin
  const authHint = initialQueryRef.current.authHint
  const fromWaitlist = initialQueryRef.current.fromWaitlist
  const debugEnabledFromQuery = initialQueryRef.current.debugEnabledFromQuery

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of ['autologin', 'auth', 'from', 'shareOftSaltOverride', 'debug']) {
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

  // Smooth waitlist → deploy:
  // If we arrived with `autologin=1`, prompt Privy login on the app host and bridge into a CreatorVault session.
  useEffect(() => {
    if (!autoLogin) return
    if (!privyReady) return
    if (handoffState === 'idle') setHandoffState('signingIn')

    if (!privyAuthenticated) {
      if (autoLoginAttemptRef.current) return
      autoLoginAttemptRef.current = true
      void (async () => {
        try {
          setHandoffError(null)
          setHandoffState('signingIn')
          const loginMethods = authHint ? [authHint] : (['wallet', 'email'] as const)
          await login({ loginMethods: loginMethods as any })
        } catch {
          setHandoffState('error')
          setHandoffError('Sign-in cancelled. Click “Sign in with Privy” to continue.')
        }
      })()
      return
    }

    if (autoBridgeAttemptRef.current) return
    autoBridgeAttemptRef.current = true

    if (typeof getAccessToken !== 'function') return
    void (async () => {
      try {
        setHandoffError(null)
        setHandoffState('bridging')
        const token = await getAccessToken()
        if (token) {
          const addr = await siwe.signInWithPrivyToken(token)
          if (!addr) {
            setHandoffState('error')
            setHandoffError('Could not establish a session. Click “Sign in with Privy” and retry.')
          }
        }
      } catch {
        setHandoffState('error')
        setHandoffError('Could not establish a session. Click “Sign in with Privy” and retry.')
      }
    })()
  }, [authHint, autoLogin, getAccessToken, handoffState, login, privyAuthenticated, privyReady, siwe])

  // Mark handoff ready once we have an app session.
  useEffect(() => {
    if (!autoLogin || !fromWaitlist) return
    if (handoffState === 'ready') return
    if (typeof siwe.authAddress === 'string' && siwe.authAddress.length > 0) {
      setHandoffState('ready')
      setHandoffError(null)
    }
  }, [autoLogin, fromWaitlist, handoffState, siwe.authAddress])

  // Safety timeout so users aren't stuck without feedback.
  useEffect(() => {
    if (!autoLogin || !fromWaitlist) return
    if (handoffState !== 'signingIn' && handoffState !== 'bridging') return
    const t = window.setTimeout(() => {
      setHandoffState('error')
      setHandoffError('This is taking longer than expected. Click “Sign in with Privy” to continue.')
    }, 25_000)
    return () => window.clearTimeout(t)
  }, [autoLogin, fromWaitlist, handoffState])

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
  const miniApp = useMiniAppContext()
  const farcasterAuth = useFarcasterAuth()
  // `sdk.context.*` is untrusted. Prefer verified Farcaster auth (Quick Auth / SIWF) when available.
  const farcasterFidForLookup = useMemo(() => {
    if (typeof farcasterAuth.fid === 'number' && farcasterAuth.fid > 0) return farcasterAuth.fid
    if (typeof miniApp.fid === 'number' && miniApp.fid > 0) return miniApp.fid
    return null
  }, [farcasterAuth.fid, miniApp.fid])

  const farcasterIdentityQuery = useQuery({
    queryKey: ['farcasterIdentity', farcasterFidForLookup ?? 'none'],
    enabled: typeof farcasterFidForLookup === 'number' && farcasterFidForLookup > 0,
    queryFn: async () => {
      return await getFarcasterUserByFid(farcasterFidForLookup as number)
    },
    staleTime: 60_000,
    retry: 0,
  })

  const verifiedFarcasterUsername = useMemo(() => {
    if (typeof farcasterAuth.fid !== 'number' || farcasterAuth.fid <= 0) return null
    const u = farcasterIdentityQuery.data?.username
    if (typeof u !== 'string') return null
    const trimmed = u.trim()
    return trimmed.length > 0 ? trimmed : null
  }, [farcasterAuth.fid, farcasterIdentityQuery.data?.username])

  const farcasterUsernameForZoraLookup = useMemo(() => {
    // Prefer verified username (derived from verified fid); otherwise use untrusted context for suggestion-only.
    const ctx = typeof miniApp.username === 'string' ? miniApp.username.trim() : ''
    const fallback = typeof farcasterIdentityQuery.data?.username === 'string' ? farcasterIdentityQuery.data.username.trim() : ''
    const out = verifiedFarcasterUsername || ctx || fallback
    return out && out.length > 0 ? out : null
  }, [verifiedFarcasterUsername, miniApp.username, farcasterIdentityQuery.data?.username])

  const farcasterProfileQuery = useZoraProfile(farcasterUsernameForZoraLookup ?? undefined)

  const farcasterCustodyAddress = useMemo(() => {
    const v = farcasterIdentityQuery.data?.custodyAddress ? String(farcasterIdentityQuery.data.custodyAddress) : ''
    return isAddress(v) ? (v as Address) : null
  }, [farcasterIdentityQuery.data?.custodyAddress])

  const farcasterVerifiedEthAddresses = useMemo(() => {
    const raw = farcasterIdentityQuery.data?.verifiedEthAddresses ?? []
    const out: Address[] = []
    for (const a of raw) {
      const v = typeof a === 'string' ? a : ''
      if (!isAddress(v)) continue
      out.push(v as Address)
    }
    return out
  }, [farcasterIdentityQuery.data?.verifiedEthAddresses])

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

  const detectedCreatorCoinFromFarcaster = useMemo(() => {
    const v = farcasterProfileQuery.data?.creatorCoin?.address ? String(farcasterProfileQuery.data.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [farcasterProfileQuery.data?.creatorCoin?.address])

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

  // Mini App fallback (verified): only prefill from Farcaster-derived data once we have a verified session.
  // `sdk.context.*` is suggestion-only and should not trigger irreversible defaults.
  useEffect(() => {
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!verifiedFarcasterUsername) return
    if (!detectedCreatorCoinFromFarcaster) return
    const key = `miniapp:${verifiedFarcasterUsername.toLowerCase()}`
    if (autofillRef.current.tokenFor === key) return
    setCreatorToken(detectedCreatorCoinFromFarcaster)
    autofillRef.current.tokenFor = key
  }, [prefillToken, creatorToken, verifiedFarcasterUsername, detectedCreatorCoinFromFarcaster])

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

  // Onchain read of payoutRecipient (immediate after tx, no indexer delay).
  const { data: onchainPayoutRecipient } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: coinABI,
    functionName: 'payoutRecipient',
    query: { enabled: tokenIsValid },
  })

  const payoutRecipient = useMemo(() => {
    // Prefer onchain value (instant). Fall back to Zora indexed value.
    const onchain = typeof onchainPayoutRecipient === 'string' ? onchainPayoutRecipient : ''
    if (isAddress(onchain)) return onchain as Address
    const r = zoraCoin?.payoutRecipientAddress ? String(zoraCoin.payoutRecipientAddress) : ''
    return isAddress(r) ? (r as Address) : null
  }, [onchainPayoutRecipient, zoraCoin?.payoutRecipientAddress])

  // Canonical identity enforcement (prevents irreversible fragmentation).
  // Privy smart wallet is the primary identity source.
  // For existing creator coins, we verify Privy wallet matches the coin's creator/payout recipient.
  const identity = useMemo(() => {
    return resolveCreatorIdentity({
      connectedWallet: connectedWalletAddress,
      privySmartWallet: privySmartWalletAddress,
      zoraCoin: zoraCoin ?? null,
      farcasterZoraProfile: farcasterProfileQuery.data ?? null,
      farcasterCustodyAddress,
    })
  }, [connectedWalletAddress, privySmartWalletAddress, farcasterCustodyAddress, farcasterProfileQuery.data, zoraCoin])

  const canonicalIdentityAddress = identity.canonicalIdentity.address
  const deploySender = (canonicalIdentityAddress as Address | null) ?? null

  // Deployment tracking: 1 deployment per owner per version
  const deploymentTracker = useDeploymentTracker(deploySender, deploymentVersion)
  const [justCompletedDeployment, setJustCompletedDeployment] = useState<DeploymentRecord | null>(null)
  const alreadyDeployed = !!(justCompletedDeployment || deploymentTracker.hasDeployed)

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

  const embeddedEoaIsCanonicalOwnerQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwner', 'embedded', canonicalIdentityAddress, embeddedPrivyEoaAddress],
    enabled: !!canonicalIdentityIsContract && !!canonicalIdentityAddress && !!embeddedPrivyEoaAddress,
    staleTime: 0, // Always refetch - ownership can change externally (e.g. via Basescan)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      const canonical = canonicalIdentityAddress as Address
      const embedded = embeddedPrivyEoaAddress as Address
      return await isCoinbaseSmartWalletOwner({ smartWallet: canonical, ownerAddress: embedded })
    },
  })
  const embeddedEoaIsCanonicalOwner = embeddedEoaIsCanonicalOwnerQuery.data === true

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

  // NOTE: Embedded EOA signing requires eth_sign support.
  // App smart wallet signing uses EIP-1271 and costs more verification gas.

  // Add Privy embedded EOA as owner of canonical - enables gas-free ERC-4337 deployments
  // Uses embedded EOA (not smart wallet) to avoid nested EIP-1271 signature complexity
  const handleAddPrivySmartWalletAsOwner = useCallback(async () => {
    if (addPrivySwOwnerBusy) return
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress) {
      setAddPrivySwOwnerError('Missing canonical smart wallet address.')
      return
    }
    // Use embedded EOA instead of smart wallet for simpler signature verification
    if (!embeddedPrivyEoaAddress) {
      setAddPrivySwOwnerError('Privy embedded wallet not ready. Please wait and retry.')
      return
    }

    setAddPrivySwOwnerBusy(true)
    setAddPrivySwOwnerError(null)
    setAddPrivySwOwnerTxHash(null)

    try {
      // Encode the addOwnerAddress call - add embedded EOA as owner
      const addOwnerData = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [embeddedPrivyEoaAddress],
      })

      if (!connectedWalletAddress || !walletClient || !publicClient) {
        throw new Error('Wallet not connected. Please connect a wallet that is an owner of your Zora smart wallet.')
      }

    await ensureBaseChain('your wallet')
      
      // Verify connected wallet is an owner
      const isOwner = await isCoinbaseSmartWalletOwner({
        smartWallet: canonicalIdentityAddress as Address,
        ownerAddress: connectedWalletAddress as Address,
      })
      
      if (!isOwner) {
        throw new Error(
          'Your connected wallet is not an owner of your Zora smart wallet.\n\n' +
          'Connect with a wallet that controls your Zora identity.'
        )
      }

      // Try ERC-4337 first for ALL wallets (gas-free via paymaster)
      // Any owner can sign UserOps for a Coinbase Smart Wallet
      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      
      try {
        logger.info('[DeployVault] Trying ERC-4337 to add Privy SW as owner (gas-free)', {
          connector: connector?.id,
          owner: connectedWalletAddress,
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
        
        setAddPrivySwOwnerTxHash(result.transactionHash)
        logger.info('[DeployVault] Embedded EOA added as owner via ERC-4337 (gas-free)', {
          userOpHash: result.userOpHash,
          txHash: result.transactionHash,
          embeddedEoa: embeddedPrivyEoaAddress,
          connector: connector?.id,
        })
        
        await embeddedEoaIsCanonicalOwnerQuery.refetch()
        return
      } catch (erc4337Error: any) {
        const errMsg = erc4337Error?.message?.toLowerCase() || ''
        
        // If wallet doesn't support eth_sign, fall back to direct transaction
        if (errMsg.includes('eth_sign') || errMsg.includes('method not supported') || errMsg.includes('user rejected')) {
          logger.warn('[DeployVault] ERC-4337 failed, falling back to direct tx', { 
            error: erc4337Error?.message,
            connector: connector?.id,
          })
          
          // Fall through to direct transaction
        } else {
          // Other errors - rethrow
          throw erc4337Error
        }
      }
      
      // Fallback: Direct transaction (requires gas)
      // Only reached if ERC-4337 fails due to signing issues
      logger.info('[DeployVault] Using direct tx fallback to add embedded EOA as owner (requires gas)')
      
      const txHash = await walletClient.sendTransaction({
        to: canonicalIdentityAddress as Address,
        data: addOwnerData,
        value: 0n,
        chain: base,
      })
      
      setAddPrivySwOwnerTxHash(txHash)
      logger.info('[DeployVault] Embedded EOA added as owner via direct tx', {
        txHash,
        canonical: canonicalIdentityAddress,
        embeddedEoa: embeddedPrivyEoaAddress,
      })
      
      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      await embeddedEoaIsCanonicalOwnerQuery.refetch()
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to add embedded wallet as owner'
      setAddPrivySwOwnerError(msg)
      logger.error('[DeployVault] Failed to add embedded EOA as owner', { error: e })
    } finally {
      setAddPrivySwOwnerBusy(false)
    }
  }, [
    addPrivySwOwnerBusy,
    canonicalIdentityAddress,
    canonicalIdentityIsContract,
    connectedWalletAddress,
    connector?.id,
    embeddedPrivyEoaAddress,
    embeddedEoaIsCanonicalOwnerQuery,
    ensureBaseChain,
    publicClient,
    walletClient,
  ])

  // Add Privy app smart wallet as owner (EIP-1271 signer for canonical wallet)
  const handleAddPrivyAppSmartWalletOwner = useCallback(async () => {
    if (addPrivySmartWalletOwnerBusy) return
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress) {
      setAddPrivySmartWalletOwnerError('Missing canonical smart wallet address.')
      return
    }
    if (!privySmartWalletAddress) {
      setAddPrivySmartWalletOwnerError('Privy smart wallet not ready. Please wait and retry.')
      return
    }
    if (privySmartWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()) {
      setAddPrivySmartWalletOwnerError('Your Privy smart wallet already matches the canonical wallet.')
      return
    }
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will add your app smart wallet as an owner of your canonical Zora smart wallet. ' +
          'The canonical wallet will remain the sender. Proceed?'
      )
      if (!ok) return
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
        throw new Error('Wallet not connected. Please connect a wallet that is an owner of your Zora smart wallet.')
      }

      await ensureBaseChain('your wallet')

      const isOwner = await isCoinbaseSmartWalletOwner({
        smartWallet: canonicalIdentityAddress as Address,
        ownerAddress: connectedWalletAddress as Address,
      })

      if (!isOwner) {
        throw new Error(
          'Your connected wallet is not an owner of your Zora smart wallet.\n\n' +
            'Connect with a wallet that controls your Zora identity.'
        )
      }

      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'

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
        return
      } catch (erc4337Error: any) {
        const errMsg = erc4337Error?.message?.toLowerCase() || ''
        if (errMsg.includes('eth_sign') || errMsg.includes('method not supported') || errMsg.includes('user rejected')) {
          logger.warn('[DeployVault] ERC-4337 failed, falling back to direct tx', {
            error: erc4337Error?.message,
            connector: connector?.id,
          })
        } else {
          throw erc4337Error
        }
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
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to add app smart wallet as owner'
      setAddPrivySmartWalletOwnerError(msg)
      logger.error('[DeployVault] Failed to add app smart wallet as owner', { error: e })
    } finally {
      setAddPrivySmartWalletOwnerBusy(false)
    }
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


  // Allow injected EOAs (Rabby/MetaMask/etc) to operate a Coinbase Smart Wallet canonical identity
  // when the EOA is an onchain owner of that smart wallet.
  // Uses server-side API to avoid client-side RPC rate limits.
  // Also used for ERC-4337 PATH 3 (EOA signs UserOps for canonical smart wallet).
  const executionCanOperateCanonicalQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwner', canonicalIdentityAddress, connectedWalletAddress],
    // Run when: identity blocking reason OR canonical is a contract (for ERC-4337 PATH 3)
    enabled: !!canonicalIdentityAddress && !!connectedWalletAddress && (!!identity.blockingReason || canonicalIdentityIsContract),
    staleTime: 0, // Always refetch - ownership can change externally
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    queryFn: async () => {
      const canonical = canonicalIdentityAddress as Address
      const execution = connectedWalletAddress as Address
      if (canonical.toLowerCase() === execution.toLowerCase()) return true

      // Use server-side API to check ownership (avoids client RPC rate limits)
      return await isCoinbaseSmartWalletOwner({
        smartWallet: canonical,
        ownerAddress: execution,
      })
    },
  })

  const executionCanOperateCanonical = executionCanOperateCanonicalQuery.data === true
  const connectedIsCanonicalOwner = executionCanOperateCanonical
  const executionCanOperateCanonicalPending = (!!identity.blockingReason || canonicalIdentityIsContract) && executionCanOperateCanonicalQuery.isFetching

  // Check if connected EOA is an owner of the Creator Coin itself (via ownerAt)
  const creatorCoinOwnersQuery = useQuery({
    queryKey: ['creatorCoinOwners', creatorToken],
    enabled: !!publicClient && tokenIsValid && !!connectedWalletAddress && !!identity.blockingReason,
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
    if (!connectedWalletAddress || !creatorCoinOwnersQuery.data) return false
    return creatorCoinOwnersQuery.data.some(
      (owner) => owner.toLowerCase() === connectedWalletAddress.toLowerCase()
    )
  }, [connectedWalletAddress, creatorCoinOwnersQuery.data])

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

  const marketFloorOk = Boolean(
    marketFloorQuery.isSuccess &&
      marketFloorQuery.data &&
      typeof marketFloorQuery.data.floorPriceQ96Aligned === 'bigint' &&
      marketFloorQuery.data.floorPriceQ96Aligned > 0n,
  )

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
      charmAlphaVaultDeploy: keccak256(DEPLOY_BYTECODE.CharmAlphaVaultDeploy as Hex),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaStrategy: keccak256(DEPLOY_BYTECODE.AjnaStrategy as Hex),
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
      deployCodeIds.charmAlphaVaultDeploy,
      deployCodeIds.creatorCharmStrategy,
      deployCodeIds.ajnaStrategy,
    ],
    enabled: Boolean(publicClient && creatorVaultBatcherAddress),
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const batcher = creatorVaultBatcherAddress as Address

      const [bytecodeStore, create2Deployer] = (await Promise.all([
        publicClient!.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'bytecodeStore',
        }),
        publicClient!.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'create2Deployer',
        }),
      ])) as [Address, Address]

      const deployerStore = (await publicClient!.readContract({
        address: create2Deployer,
        abi: CREATE2_DEPLOYER_STORE_ABI,
        functionName: 'store',
      })) as Address

      if (bytecodeStore.toLowerCase() !== deployerStore.toLowerCase()) {
        throw new Error(
          `Misconfigured infra: batcher.bytecodeStore=${bytecodeStore} but create2Deployer.store=${deployerStore}`,
        )
      }

      // v2 store detection: v1 stores won't have `chunkCount(bytes32)`.
      let storeSupportsChunking = false
      try {
        await publicClient!.readContract({
          address: bytecodeStore,
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
        { key: 'charmAlphaVaultDeploy', label: 'CharmAlphaVaultDeploy', codeId: deployCodeIds.charmAlphaVaultDeploy },
        { key: 'creatorCharmStrategy', label: 'CreatorCharmStrategy', codeId: deployCodeIds.creatorCharmStrategy },
        { key: 'ajnaStrategy', label: 'AjnaStrategy', codeId: deployCodeIds.ajnaStrategy },
      ] as const

      const pointerResults = await publicClient!.multicall({
        allowFailure: true,
        contracts: codeEntries.map((c) => ({
          address: bytecodeStore,
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
        bytecodeStore,
        create2Deployer,
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
      return 'Deployment infra uses a v1 bytecode store (no chunking). Deploy the v2 bytecode store + v2 deployer + new CreatorVaultBatcher.'
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
      return 5_000_000n * 10n ** BigInt(resolvedTokenDecimals)
    }
    return MIN_FIRST_DEPOSIT
  }, [resolvedTokenDecimals])

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
  
  // Check if Privy smart wallet matches the canonical identity (Zora smart wallet)
  // If they don't match, user can add the app smart wallet as an owner (EIP-1271)
  const smartWalletMatchesCanonical = useMemo(() => {
    if (!privySmartWalletAddress || !canonicalIdentityAddress) return false
    return privySmartWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
  }, [privySmartWalletAddress, canonicalIdentityAddress])
  
  // Smart wallet is ready only if it matches canonical OR an authorized owner signer is available
  const smartWalletCapabilityReady =
    (privySmartWalletReady &&
      (smartWalletMatchesCanonical || (privySmartWalletIsCanonicalOwner && privySmartWalletCanSign))) ||
    embeddedEoaIsCanonicalOwner ||
    connectedIsCanonicalOwner

  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    coinAgeOk &&
    marketFloorOk &&
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
    !identityBlockingReason &&
    smartWalletCapabilityReady

  const vrfConsumerAddress = (CONTRACTS.vrfConsumer ?? null) as Address | null
  const vrfConsumerConfigured = isAddress(String(vrfConsumerAddress ?? ''))
  const allowlistReady = allowlistMode === 'disabled' ? true : isAllowlistedCreator
  const creatorCoinReady = tokenIsValid && !!zoraCoin && isCreatorCoin
  const coinAgeReady = creatorCoinReady && coinAgeOk
  const fundingReady = fundingGateOk
  const authReady = isAuthorizedDeployerOrOperator

  const firstLaunchChecklist = [
    {
      label: 'CreatorVaultBatcher configured',
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
          : `needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'}`
        : 'not authorized',
    },
    {
      label: 'Market floor price',
      ok: marketFloorOk,
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
          : tokenIsValid && zoraCoin && isCreatorCoin && !coinAgeOk
            ? `Creator Coin must be at least ${minCoinAgeDays} days old to deploy.`
          : creatorAllowlistQuery.isLoading
            ? 'Checking creator access…'
            : creatorAllowlistQuery.isError
              ? 'Creator access check failed.'
              : allowlistEnforced && !isAllowlistedCreator
                ? 'Creator access required.'
                : !creatorVaultBatcherConfigured
                  ? 'Deployment not configured (missing CreatorVaultBatcher).'
                  : !isAuthorizedDeployerOrOperator
                    ? 'Connect the creator or payout recipient wallet.'
                    : !fundingGateOk
                      ? `Needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy.`
                      : identityBlockingReason
                        ? identityBlockingReason
                      : !smartWalletCapabilityReady
                        ? 'Smart wallet required. Sign in with wallet to access your Zora smart wallet, or use Coinbase Wallet (Base Account).'
                    : bytecodeInfraQuery.isFetching
                      ? 'Checking deployment bytecode store…'
                      : bytecodeInfraQuery.isError
                        ? (bytecodeInfraQuery.error as any)?.message || 'Deployment bytecode check failed.'
                        : !bytecodeInfraOk
                          ? bytecodeInfraBlocker || 'Deployment infra is not ready.'
                        : marketFloorQuery.isFetching
                          ? 'Computing market floor price…'
                          : marketFloorQuery.isError
                            ? (marketFloorQuery.error as any)?.message || 'Could not compute market floor price.'
                            : !marketFloorOk
                              ? 'Market floor price is required to deploy.'
                              : null

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <span className="label">Deploy</span>
                <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
                <p className="text-zinc-600 text-sm font-light">
                  Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy.
                </p>
                {fromWaitlist ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: baseEase }}
                    className="mt-3 rounded-xl border border-zinc-900/70 bg-black/30 px-4 py-3 text-[12px] text-zinc-400"
                  >
                    <div className="text-zinc-200">From the waitlist</div>
                    <div className="mt-1">
                      {!autoLogin
                        ? 'If you get blocked by wallet signing, use “Sign in with Privy”.'
                        : handoffState === 'signingIn'
                          ? 'Signing you in…'
                          : handoffState === 'bridging'
                            ? 'Finalizing session…'
                            : handoffState === 'ready'
                              ? 'Signed in. You can deploy when ready.'
                              : handoffState === 'error'
                                ? handoffError || 'Sign-in failed. Click “Sign in with Privy” to continue.'
                                : 'We’ll prompt sign-in, then continue.'}
                    </div>
                    {autoLogin && handoffState === 'error' && switchAuthCta ? (
                      <div className="mt-3">
                        <button type="button" className="btn-primary" onClick={switchAuthCta.onClick}>
                          {switchAuthCta.label}
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                ) : null}

                {fromWaitlist && privyReady && privyAuthenticated && !smartWalletCapabilityReady ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: baseEase }}
                    className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200/90"
                  >
                    <div className="font-medium text-amber-200">Account mismatch?</div>
                    <div className="mt-1 text-amber-200/80">
                      You’re signed into Privy, but we can’t see your Zora global wallet / Coinbase Smart Wallet on this session.
                      Sign in using the same method you used on Zora (email or wallet).
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
                            await login({ loginMethods: ['email'] })
                          })()
                        }}
                      >
                        Try email sign-in
                      </button>
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
                        Try wallet sign-in
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-900/70 bg-black/40 px-3 py-1 text-[10px] text-zinc-400">
                <img src="/protocols/base.png" alt="" aria-hidden="true" loading="lazy" className="w-3.5 h-3.5 opacity-90" />
                Base
              </div>
            </div>

          {/* Deployment Status */}
          {justCompletedDeployment ? (
            <DeploymentSuccess
              deployment={justCompletedDeployment}
              tokenSymbol={underlyingSymbolUpper || undefined}
              shareSymbol={derivedShareSymbol || undefined}
            />
          ) : deploymentTracker.hasDeployed && deploymentTracker.existingDeployment ? (
            <AlreadyDeployedBanner
              deployment={deploymentTracker.existingDeployment}
              tokenSymbol={underlyingSymbolUpper || undefined}
            />
          ) : null}

          {!alreadyDeployed && isAdmin ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
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
                  <div className="card rounded-xl p-8 space-y-6">
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
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center text-sm font-medium text-brand-accent">
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
                          <div className="label">Payout recipient</div>
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
            <div className="card rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Launch</div>
                  <div className="text-xs text-zinc-600">Minimal launch details for your Creator Coin.</div>
                </div>
              </div>

              {/* Creator Coin */}
              <div className="space-y-2">
                <label className="label">Creator Coin</label>

                {miniApp.isMiniApp && farcasterAuth.status !== 'verified' && farcasterAuth.canSiwf !== false ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-600">
                      Verify your profile to enable Mini App autofill.
                    </div>
                    <button
                      type="button"
                      onClick={() => void farcasterAuth.signIn()}
                      disabled={farcasterAuth.status === 'loading'}
                      className="text-[10px] text-zinc-600 hover:text-zinc-200 transition-colors disabled:opacity-60"
                      title="Requests an in-app sign-in credential (no transaction)"
                    >
                      {farcasterAuth.status === 'loading' ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                ) : null}
                {miniApp.isMiniApp && farcasterAuth.status === 'error' && farcasterAuth.error ? (
                  <div className="text-[11px] text-red-400/80">{farcasterAuth.error}</div>
                ) : null}

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
          </div>

            {/* Deploy */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="label">Deploy</div>
              {/* Auth flow */}
              {!privyReady ? (
                <div className="text-sm text-zinc-500 text-center py-4">Loading…</div>
              ) : !privyAuthenticated ? (
                <button
                  type="button"
                  className="btn-accent w-full"
                  onClick={() => void login({ loginMethods: ['wallet', 'email'] })}
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
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Identity mismatch</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">{identityBlockingReason}</div>
                  {farcasterVerifiedEthAddresses.length > 0 ? (
                    <div className="text-[11px] text-amber-300/70">
                      Verified wallets (suggestion-only):{' '}
                      <span className="font-mono text-amber-200">
                        {farcasterVerifiedEthAddresses.map((a) => shortAddress(a)).join(', ')}
                      </span>
                    </div>
                  ) : null}
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
                  Deployment is not configured (missing CreatorVaultBatcher address)
                </button>
              ) : tokenIsValid && zoraCoin && !walletHasMinDeposit ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {`Creator smart wallet needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`}
                </button>
              ) : canDeploy ? (
                <>
                  {tokenIsValid && zoraCoin && identity.warnings.includes('CUSTODY_MISMATCH') && farcasterCustodyAddress ? (
                    <div className="text-[11px] text-amber-300/80">
                      Custody wallet{' '}
                      <span className="font-mono text-amber-200">{shortAddress(farcasterCustodyAddress)}</span> does not match the coin’s
                      canonical identity{' '}
                      <span className="font-mono text-amber-200">
                        {shortAddress(identity.canonicalIdentity.address as Address)}
                      </span>
                      . This does not block deploy, but double-check you’re using the intended identity.
                    </div>
                  ) : null}

                  {/* App smart wallet signer (explicit opt-in) */}
                  {privySmartWalletAddress && !privySmartWalletIsCanonicalOwner ? (
                    <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/10 space-y-3">
                      <div className="text-sm font-medium text-purple-200">Use app smart wallet as signer (optional)</div>
                      <div className="text-[11px] text-purple-200/70">
                        Adds your app smart wallet as an owner of the canonical Zora smart wallet (EIP-1271).
                        The canonical wallet remains the sender. Higher verification gas, but no eth_sign required.
                      </div>
                      {!privySmartWalletCanSign ? (
                        <div className="text-[11px] text-amber-200/80">
                          Smart wallet signing is not supported in this environment. Use Coinbase Wallet or an owner EOA.
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={addPrivySmartWalletOwnerBusy || !privySmartWalletCanSign}
                        onClick={() => void handleAddPrivyAppSmartWalletOwner()}
                      >
                        {addPrivySmartWalletOwnerBusy ? 'Confirming…' : 'Enable Smart Wallet Signer'}
                      </button>
                      {addPrivySmartWalletOwnerTxHash && (
                        <div className="text-[11px] text-green-400">
                          ✓ Success!{' '}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => void privySmartWalletIsCanonicalOwnerQuery.refetch()}
                          >
                            Refresh
                          </button>
                        </div>
                      )}
                      {addPrivySmartWalletOwnerError && (
                        <div className="text-[11px] text-red-400">{addPrivySmartWalletOwnerError}</div>
                      )}
                    </div>
                  ) : privySmartWalletIsCanonicalOwner ? (
                    <div className="flex items-center gap-2 text-[11px] text-green-400 mb-2">
                      <span>✓</span>
                      <span>Smart wallet signer ready</span>
                    </div>
                  ) : null}

                  {/* Gas-free setup or status */}
                  {embeddedPrivyEoaAddress && !embeddedEoaIsCanonicalOwner ? (
                    <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/10 space-y-3">
                      <div className="text-sm font-medium text-blue-200">One-time setup</div>
                      <div className="text-[11px] text-blue-200/70">
                        Enable gas-free deployments. This is completely free.
                      </div>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={addPrivySwOwnerBusy}
                        onClick={() => void handleAddPrivySmartWalletAsOwner()}
                      >
                        {addPrivySwOwnerBusy ? 'Confirming…' : 'Enable Gas-Free Deploys'}
                      </button>
                      {addPrivySwOwnerTxHash && (
                        <div className="text-[11px] text-green-400">
                          ✓ Success! <button type="button" className="underline" onClick={() => void embeddedEoaIsCanonicalOwnerQuery.refetch()}>Refresh</button>
                        </div>
                      )}
                      {addPrivySwOwnerError && (
                        <div className="text-[11px] text-red-400">{addPrivySwOwnerError}</div>
                      )}
                    </div>
                  ) : embeddedEoaIsCanonicalOwner ? (
                    <div className="flex items-center gap-2 text-[11px] text-green-400 mb-2">
                      <span>✓</span>
                      <span>Gas-free deployment ready</span>
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
                    embeddedEoaIsCanonicalOwner={embeddedEoaIsCanonicalOwner}
                    embeddedPrivyWallet={embeddedPrivyWallet}
                    embeddedPrivyEoaAddress={embeddedPrivyEoaAddress}
                    connectorId={connector?.id}
                    wagmiWalletClient={walletClient}
                    connectedIsCanonicalOwner={executionCanOperateCanonical}
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
                  {!privySmartWalletReady && switchAuthCta ? (
                    <button type="button" className="btn-primary w-full" onClick={switchAuthCta.onClick}>
                      {switchAuthCta.label}
                    </button>
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
                Requires a 5,000,000 {underlyingSymbolUpper || 'TOKENS'} deposit. Some wallets may prompt multiple confirmations.
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
