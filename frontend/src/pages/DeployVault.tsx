import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
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
  toBytes,
} from 'viem'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { BarChart3, ChevronDown, Layers, Lock, Rocket, ShieldCheck } from 'lucide-react'
import { useLinkAccount, useLogin, usePrivy, useWallets, useCrossAppAccounts } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { DerivedTokenIcon } from '@/components/DerivedTokenIcon'
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { CONTRACTS } from '@/config/contracts'
import { useCreatorAllowlist, useFarcasterAuth, useMiniAppContext } from '@/hooks'
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
import { sendCoinbaseSmartWalletUserOperation, sendCrossAppUserOperation, type CrossAppSignMessage } from '@/lib/aa/coinbaseErc4337'

const MIN_FIRST_DEPOSIT = 5_000_000n * 10n ** 18n
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')
const BASE_SWAP_ROUTER = addr('2626664c2603336E57B271c5C0b26F421741e481')
const BASE_WETH = addr('4200000000000000000000000000000000000006')
const BASE_USDC = addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const BASE_CHAINLINK_ETH_USD = addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const PAYOUT_ROUTER_SALT_TAG = 'CreatorVault:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = 'CreatorVault:VaultShareBurnStream' as const

// Zora's Privy App ID for cross-app wallet integration
const ZORA_PRIVY_APP_ID = 'clpgf04wn04hnkw0fv1m11mnb'

// Uniswap CCA uses Q96 fixed-point prices + a compact step schedule.
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
const DEFAULT_AUCTION_PERCENT = 50
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)

// Minimum age for a Creator Coin before allowing vault deployment.
// Rationale: reduce launch-manipulation surface area on brand new coins with thin/no trading history.
const DEFAULT_MIN_COIN_AGE_DAYS = 30
const MIN_COIN_AGE_LOCALSTORAGE_KEY = 'cv:deploy:minCoinAgeDays'

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

function identitySourceLabel(source: string): string {
  switch (source) {
    case 'zoraCoinCreatorAddress':
      return 'Zora coin creator'
    case 'farcasterCustody':
      return 'Farcaster custody'
    case 'zoraProfilePublicWallet':
      return 'Zora profile public wallet'
    case 'connectedWallet':
      return 'Connected wallet'
    default:
      return source || 'unknown'
  }
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

const COINBASE_ENTRYPOINT_V06 = addr('5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')

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

function ExplainerRow({
  icon,
  label,
  title,
  contractName,
  note,
  metaLine,
}: {
  icon: ReactNode
  label: string
  title: ReactNode
  contractName: string
  note: string
  metaLine?: ReactNode
}) {
  return (
    <div className="px-4 py-4 grid grid-cols-[56px_minmax(0,1fr)_auto] gap-x-4 items-start hover:bg-white/[0.02] transition-colors">
      <div className="w-14 shrink-0 pt-0.5 flex justify-center">{icon}</div>

      <div className="min-w-0">
        <div className="text-[15px] leading-5 text-zinc-100 font-medium truncate min-w-0">{title}</div>

        <div className="text-[11px] text-zinc-500 mt-1 leading-5">
          <span className="inline-flex align-middle items-center rounded-md border border-white/5 bg-black/20 px-2 py-0.5 font-mono text-[10px] leading-4 text-zinc-300">
            {contractName}
          </span>
          {metaLine ? (
            <>
              <span className="text-zinc-800">{' · '}</span>
              <span className="align-middle">{metaLine}</span>
            </>
          ) : null}
        </div>

        <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">{note}</div>
      </div>

      <div className="shrink-0 pt-[3px] text-[10px] leading-4 uppercase tracking-[0.34em] text-zinc-500/90 font-medium whitespace-nowrap text-right">
        {label}
      </div>
    </div>
  )
}

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
  currentPayoutRecipient,
  floorPriceQ96Aligned,
  marketFloorTwapDurationSec,
  marketFloorDiscountBps,
  onSuccess,
  switchAuthCta,
  smartWalletClient,
  canonicalSmartWallet,
  embeddedWallet,
  embeddedEoaAddress,
  zoraEmbeddedWalletAddress,
  zoraEmbeddedHasGas,
  zoraEmbeddedBalance: _zoraEmbeddedBalance,
  sendCrossAppTransaction,
  crossAppSignMessage,
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
  currentPayoutRecipient: Address | null
  floorPriceQ96Aligned: bigint | null
  marketFloorTwapDurationSec: number | null
  marketFloorDiscountBps: number | null
  onSuccess: (addresses: ServerDeployResponse['addresses']) => void
  switchAuthCta?: { label: string; onClick: () => void }
  smartWalletClient: any
  canonicalSmartWallet: Address | null
  embeddedWallet: any
  embeddedEoaAddress: Address | null
  zoraEmbeddedWalletAddress: Address | null
  zoraEmbeddedHasGas: boolean
  zoraEmbeddedBalance: bigint
  // Privy's cross-app sendTransaction - takes tx request and { address } of the cross-app wallet
  sendCrossAppTransaction: ((tx: { to: Address; data: Hex; value: bigint; chainId: number }, options: { address: string }) => Promise<string>) | null
  // Privy's cross-app signMessage - for ERC-4337 UserOp signing (no gas needed!)
  crossAppSignMessage: CrossAppSignMessage | null
  // For direct Coinbase Wallet connection (supports eth_sign)
  connectorId: string | undefined
  wagmiWalletClient: any
}) {
  void _zoraEmbeddedBalance // Used for display in parent component
  void zoraEmbeddedHasGas // Used by handleAddOwnerToZoraWallet in parent
  void sendCrossAppTransaction // Legacy - replaced by crossAppSignMessage + ERC-4337
  const { address: connectedAddress } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  
  // Detect Coinbase Wallet direct connection (not via Privy)
  const isCoinbaseWalletDirect = connectorId === 'coinbaseWalletSDK' || connectorId === 'com.coinbase.wallet'

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
  const [phase, setPhase] = useState<'idle' | 'phase1' | 'phase2' | 'phase3' | 'done'>('idle')
  const [phaseTxs, setPhaseTxs] = useState<{
    userOp1?: Hex
    userOp2?: Hex
    userOp3?: Hex
    tx1?: Hex
    tx2?: Hex
    tx3?: Hex
  }>({})
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

  const formatDeployError = (e: unknown): string => {
    const raw = e instanceof Error ? e.message : String(e ?? '')
    const msg = String(raw || 'Deployment failed')
    const lower = msg.toLowerCase()

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
      return 'Bundler / paymaster is not configured. Set `VITE_CDP_API_KEY` (recommended) or `VITE_CDP_PAYMASTER_URL=/api/paymaster` (and configure `CDP_PAYMASTER_URL` server-side) and retry.'
    }
    if (lower.includes('no_session') || lower.includes('not authenticated') || lower.includes('request denied - no_session')) {
      return `Gas sponsorship requires a session. Click “${switchAuthLabel ?? 'Sign in with wallet'}” and retry.`
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
    if (lower.includes('market floor price not available')) {
      return 'Market floor price is still loading. Wait a moment and try again.'
    }
    if (lower.includes('creatorvaultbatcher is not configured')) {
      return 'Deployment is not configured: missing `VITE_CREATOR_VAULT_BATCHER` / `CONTRACTS.creatorVaultBatcher`.'
    }
    return msg
  }

  const isTxHash = (h?: string | null) => typeof h === 'string' && /^0x[a-fA-F0-9]{64}$/.test(h)
  const hrefForTx = (h?: string | null) => (isTxHash(h) ? `https://basescan.org/tx/${h}` : null)
  const href1 = hrefForTx(phaseTxs.tx1 ?? null)
  const href2 = hrefForTx(phaseTxs.tx2 ?? null)
  const href3 = hrefForTx(phaseTxs.tx3 ?? null)

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
    queryKey: ['creatorVaultBatcher', 'expected', batcherAddress, creatorToken, owner, shareSymbol, shareName, vaultName, vaultSymbol, deploymentVersion],
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

      const tempOwner = batcherAddress as Address

      const baseSalt = deriveBaseSalt({ creatorToken, owner, chainId: base.id, version: deploymentVersion })
      const vaultSalt = saltFor(baseSalt, 'vault')
      const wrapperSalt = saltFor(baseSalt, 'wrapper')
      const gaugeSalt = saltFor(baseSalt, 'gauge')
      const ccaSalt = saltFor(baseSalt, 'cca')
      const oracleSalt = saltFor(baseSalt, 'oracle')

      const oftBootstrapSalt = deriveOftBootstrapSalt()
      const shareOftSalt = deriveShareOftSalt({ owner, shareSymbol, version: deploymentVersion })

      const oftBootstrapRegistry = predictCreate2Address({
        create2Deployer,
        salt: oftBootstrapSalt,
        initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
      })

      // IMPORTANT: The onchain `CreatorVaultBatcher` normalizes `shareSymbol` to lowercase
      // when constructing the ShareOFT + Oracle init code (for deterministic addresses).
      // We must mirror that here, otherwise `expected.*` (especially `expectedGauge`) will be wrong
      // and we’ll set the coin payoutRecipient to an address that will never be deployed.
      const shareSymbolDeploy = shareSymbol.toLowerCase()

      const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
        shareName,
        shareSymbolDeploy,
        oftBootstrapRegistry,
        tempOwner,
      ])
      const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
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
      const burnStreamAddress = predictCreate2Address({ create2Deployer, salt: burnStreamSalt, initCode: burnStreamInitCode })

      const payoutRouterSalt = derivePayoutRouterSalt({ creatorToken, owner })
      const payoutRouterArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
        creatorToken,
        vaultAddress,
        burnStreamAddress,
        owner,
        getAddress(BASE_SWAP_ROUTER as Address),
        weth,
      ])
      const payoutRouterInitCode = concatHex([DEPLOY_BYTECODE.PayoutRouter as Hex, payoutRouterArgs])
      const payoutRouterAddress = predictCreate2Address({ create2Deployer, salt: payoutRouterSalt, initCode: payoutRouterInitCode })

      // NOTE: Oracle address depends on batcher immutables (registry/chainlink feed). We don't need it for gating.
      // Still return placeholders for UI consistency.
      const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, '0x' as Hex])
      void oracleSalt
      void oracleInitCode

      return {
        create2Deployer,
        protocolTreasury,
        expected: {
          vault: vaultAddress,
          wrapper: wrapperAddress,
          shareOFT: shareOftAddress,
          gaugeController: gaugeAddress,
          ccaStrategy: ccaAddress,
          oracle: ZERO_ADDRESS as Address,
          burnStream: burnStreamAddress,
          payoutRouter: payoutRouterAddress,
        },
      }
    },
  })

  const expected = expectedQuery.data?.expected ?? null
  const expectedCreate2Deployer = expectedQuery.data?.create2Deployer ?? null
  const expectedGauge = expected?.gaugeController ?? null
  const expectedBurnStream = expected?.burnStream ?? null
  const expectedPayoutRouter = expected?.payoutRouter ?? null

  const phase1ExistsQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'phase1Exists',
      deploymentVersion,
      expected?.vault,
      expected?.wrapper,
      expected?.shareOFT,
      expected?.gaugeController,
      expected?.ccaStrategy,
      expected?.oracle,
    ],
    enabled: !!publicClient && !!expected,
    staleTime: 15_000,
    retry: 0,
    queryFn: async () => {
      const addrs = [expected!.vault, expected!.wrapper, expected!.shareOFT, expected!.gaugeController, expected!.ccaStrategy] as const
      const codes = await Promise.all(addrs.map((a) => publicClient!.getBytecode({ address: a })))
      const deployed = codes.map((c) => !!c && c !== '0x')
      return { anyDeployed: deployed.some(Boolean) } as const
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
      const isTwoStepBatcher = await (async () => {
        const bc = await publicClient.getBytecode({ address: batcherAddress })
        if (!bc || bc === '0x') return false
        const phase1Topic = keccak256(
          toBytes('Phase1Deployed(address,address,address,address,address,address)'),
        ).slice(2).toLowerCase()
        return bc.toLowerCase().includes(phase1Topic)
      })()

      if (isTwoStepBatcher) {
        // “All-or-none” guard: if Phase 1 artifacts already exist for this creator+version,
        // don't try to run a new 1-click deploy (the batcher will often revert on duplicate Phase 1).
        if (phase1ExistsQuery.data?.anyDeployed) {
          throw new Error(
            `Phase 1 already exists for this creator + deployment version (${deploymentVersion}). Use the existing deployment, or bump VITE_DEPLOYMENT_VERSION to start a fresh slate.`,
          )
        }

        const phase1Call = {
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase1',
            args: [
              { creatorToken, owner, vaultName, vaultSymbol, shareName, shareSymbol, version: deploymentVersion },
              codeIds,
            ],
          }),
        } as const

        const phase2Params = {
          creatorToken,
          owner,
          creatorTreasury: owner,
          payoutRecipient: payoutForDeploy,
          vault: expected.vault,
          wrapper: expected.wrapper,
          shareOFT: expected.shareOFT,
          shareSymbol,
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

        const phase1Calls: Array<{ target: Address; value: bigint; data: Hex }> = [phase1Call]

        const phase2Calls: Array<{ target: Address; value: bigint; data: Hex }> = []
        const swAllowanceToBatcher = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, batcherAddress],
        })) as bigint

        if (swAllowanceToBatcher < depositAmount) {
          if (swAllowanceToBatcher !== 0n) {
            phase2Calls.push({
              target: creatorToken,
              value: 0n,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [batcherAddress, 0n],
              }),
            })
          }
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [batcherAddress, depositAmount],
            }),
          })
        }

        phase2Calls.push({
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase2AndLaunch',
            args: [phase2Params, codeIds],
          }),
        })

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

        logger.warn('[DeployVault] deploy_start', {
          creatorToken,
          owner,
          deploymentVersion,
          batcher: batcherAddress,
          phases: { phase3: phase3Calls.length > 0 },
        })

        // Helper to convert calls format
        const toCalls = (calls: Array<{ target: Address; value: bigint; data: Hex }>) =>
          calls.map((c) => ({ to: c.target, value: c.value, data: c.data }))

        const sendPhaseCalls = async (
          calls: Array<{ target: Address; value: bigint; data: Hex }>,
          phaseLabel: 'phase1' | 'phase2' | 'phase3',
        ) => {
          // OPTION 1: Direct Coinbase Wallet connection (best - supports eth_sign for ERC-4337)
          // When connected via Coinbase Wallet SDK, the connected address IS the smart wallet
          // and we can use proper ERC-4337 UserOperations with single approval
          if (isCoinbaseWalletDirect && connectedAddress && wagmiWalletClient && publicClient) {
            logger.info(`[DeployVault] Using Coinbase Wallet direct for ${phaseLabel}`, {
              smartWallet: connectedAddress,
              callCount: calls.length,
            })
            
            // Use the CDP paymaster URL
            const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
            const apiKeyEnv = import.meta.env.VITE_CDP_API_KEY as string | undefined
            let bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv, apiKeyEnv)
            if (!bundlerUrl) bundlerUrl = '/api/paymaster'
            
            // The connected address is both the smart wallet AND the signer for Coinbase Wallet
            const result = await sendCoinbaseSmartWalletUserOperation({
              publicClient: publicClient as any,
              walletClient: wagmiWalletClient as any,
              bundlerUrl,
              smartWallet: connectedAddress as Address,
              ownerAddress: connectedAddress as Address, // For CB Wallet, the wallet signs for itself
              calls: toCalls(calls),
              version: '1',
            })
            
            setTxId(result.transactionHash)
            setPhaseTxs((s) => ({
              ...s,
              [phaseLabel === 'phase1' ? 'userOp1' : phaseLabel === 'phase2' ? 'userOp2' : 'userOp3']: result.userOpHash,
              [phaseLabel === 'phase1' ? 'tx1' : phaseLabel === 'phase2' ? 'tx2' : 'tx3']: result.transactionHash,
            }))
            logger.warn(`[DeployVault] ${phaseLabel}_confirmed via Coinbase Wallet`, {
              userOpHash: result.userOpHash,
              txHash: result.transactionHash,
            })
            return
          }
          
          // OPTION 2: Use embedded wallet to call executeBatch on the canonical smart wallet
          // The embedded wallet is an owner of the smart wallet, so it can call execute/executeBatch directly
          // Privy handles gas sponsorship for embedded wallet transactions
          logger.info(`[DeployVault] Checking embedded wallet batch path`, {
            canonicalSmartWallet,
            hasEmbeddedWallet: !!embeddedWallet,
            embeddedEoaAddress,
          })
          if (canonicalSmartWallet && embeddedWallet && embeddedEoaAddress) {
            logger.info(`[DeployVault] Using embedded wallet executeBatch for ${phaseLabel}`, {
              canonicalSmartWallet,
              embeddedEoaAddress,
              callCount: calls.length,
            })
            
            // Coinbase Smart Wallet's executeBatch ABI
            const executeBatchAbi = [{
              type: 'function',
              name: 'executeBatch',
              stateMutability: 'payable',
              inputs: [{
                name: 'calls',
                type: 'tuple[]',
                components: [
                  { name: 'target', type: 'address' },
                  { name: 'value', type: 'uint256' },
                  { name: 'data', type: 'bytes' },
                ],
              }],
              outputs: [],
            }] as const
            
            // Encode the batch call
            const batchData = encodeFunctionData({
              abi: executeBatchAbi,
              functionName: 'executeBatch',
              args: [calls.map(c => ({ target: c.target, value: c.value, data: c.data }))],
            })
            
            // Get the embedded wallet's provider
            const provider = await embeddedWallet.getEthereumProvider()
            if (!provider) {
              throw new Error('Could not get embedded wallet provider')
            }
            
            // The embedded wallet needs ETH for gas since Privy doesn't auto-sponsor for raw txs
            // Check if we can send via the provider with sponsored gas
            // Try using eth_sendTransaction - if embedded wallet has no ETH, this will fail
            // In that case, user needs to fund the embedded wallet with a tiny amount of ETH
            logger.info('[DeployVault] Sending executeBatch from embedded wallet', {
              from: embeddedEoaAddress,
              to: canonicalSmartWallet,
            })
            
            const txHash = await provider.request({
              method: 'eth_sendTransaction',
              params: [{
                from: embeddedEoaAddress,
                to: canonicalSmartWallet,
                data: batchData,
                value: '0x0',
              }],
            })
            
            setTxId(txHash)
            setPhaseTxs((s) => ({
              ...s,
              [phaseLabel === 'phase1' ? 'tx1' : phaseLabel === 'phase2' ? 'tx2' : 'tx3']: txHash as Hex,
            }))
            logger.warn(`[DeployVault] ${phaseLabel}_confirmed via embedded wallet batch`, { txHash })
            return
          }
          
          // OPTION 3: Cross-app ERC-4337 UserOperation (uses paymaster for gas - no ETH needed in EOA!)
          // This flow:
          // 1. Builds a UserOperation with the calls
          // 2. Opens Zora popup for user to sign the UserOp hash (no gas!)
          // 3. Submits to bundler with CDP paymaster (paymaster pays gas)
          console.log(`[DeployVault] Cross-app ERC-4337 check for ${phaseLabel}:`, {
            canonicalSmartWallet,
            zoraEmbeddedWalletAddress,
            crossAppSignMessage: typeof crossAppSignMessage,
            publicClient: !!publicClient,
          })
          logger.info(`[DeployVault] Cross-app ERC-4337 check for ${phaseLabel}:`, {
            canonicalSmartWallet: !!canonicalSmartWallet,
            zoraEmbeddedWalletAddress: !!zoraEmbeddedWalletAddress,
            crossAppSignMessage: !!crossAppSignMessage,
          })
          if (canonicalSmartWallet && zoraEmbeddedWalletAddress && crossAppSignMessage && publicClient) {
            logger.info(`[DeployVault] Using cross-app ERC-4337 UserOp for ${phaseLabel}`, {
              canonicalSmartWallet,
              zoraEmbeddedWalletAddress,
              callCount: calls.length,
            })
            
            try {
              // Get the bundler/paymaster URL (CDP handles gas sponsorship)
              const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
              const apiKeyEnv = import.meta.env.VITE_CDP_API_KEY as string | undefined
              let bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv, apiKeyEnv)
              if (!bundlerUrl) bundlerUrl = '/api/paymaster'
              
              // Send UserOperation via ERC-4337 with cross-app signing
              // The user will see a popup on Zora's domain to sign the UserOp hash
              const { transactionHash } = await sendCrossAppUserOperation({
                publicClient,
                crossAppSignMessage: crossAppSignMessage as CrossAppSignMessage,
                bundlerUrl,
                smartWallet: canonicalSmartWallet,
                zoraEmbeddedWalletAddress,
                calls: calls.map(c => ({ to: c.target, value: c.value, data: c.data })),
              })
              
              setTxId(transactionHash)
              setPhaseTxs((s) => ({
                ...s,
                [phaseLabel === 'phase1' ? 'tx1' : phaseLabel === 'phase2' ? 'tx2' : 'tx3']: transactionHash,
              }))
              logger.warn(`[DeployVault] ${phaseLabel}_confirmed via cross-app ERC-4337`, { transactionHash })
              return
            } catch (err: unknown) {
              // Log but continue to fallback path
              const errMsg = err instanceof Error ? err.message : String(err)
              logger.error(`[DeployVault] Cross-app ERC-4337 failed for ${phaseLabel}:`, errMsg)
              // If user rejected the signature popup, don't continue to fallback
              if (errMsg.toLowerCase().includes('reject') || errMsg.toLowerCase().includes('cancel') || errMsg.toLowerCase().includes('denied')) {
                throw err
              }
              // Otherwise, continue to try other paths
            }
          }
          
          // Fallback: use Privy smart wallet client (will use Privy's derived smart wallet)
          if (!canUsePrivySmartWallet || !smartWalletClient) {
            throw new Error(
              'Smart wallet required. Sign in via Privy to access your Zora smart wallet, then retry.',
            )
          }
          logger.warn(`[DeployVault] Fallback to Privy smartWalletClient for ${phaseLabel}`)
          const hash = await smartWalletClient.sendTransaction({ calls: toCalls(calls) })
          setTxId(hash)
          setPhaseTxs((s) => ({ ...s, [phaseLabel === 'phase1' ? 'tx1' : phaseLabel === 'phase2' ? 'tx2' : 'tx3']: hash }))
          logger.warn(`[DeployVault] ${phaseLabel}_confirmed`, { txHash: hash })
        }

        // Phase 1: Deploy core contracts
        setPhase('phase1')
        await sendPhaseCalls(phase1Calls, 'phase1')

        // Phase 2: Launch + configure
        setPhase('phase2')
        await sendPhaseCalls(phase2Calls, 'phase2')

        // Phase 3: Strategies (optional)
        if (phase3Calls.length > 0) {
          setPhase('phase3')
          await sendPhaseCalls(phase3Calls, 'phase3')
        }

        setPhase('done')
        logger.warn('[DeployVault] deploy_success', { creatorToken, owner, deploymentVersion })
        onSuccess(expected)
        return
      }
    } catch (e: any) {
      let pretty = formatDeployError(e)
      logger.warn('[DeployVault] deploy_failed', { error: pretty })
      setError(pretty)
    } finally {
      setBusy(false)
    }
  }

  const canAutoUpdatePayoutRecipient = !payoutMismatch || canUsePrivySmartWallet || canUseWalletSendCalls
  void canAutoUpdatePayoutRecipient

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
        One click will submit <span className="text-zinc-200">up to 3</span> onchain operations (Phases 1–3) via your smart wallet.
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
              Phase 2: launch + configure
            </div>
            {href2 ? (
              <a className="font-mono text-zinc-300 hover:text-white" href={href2} target="_blank" rel="noreferrer">
                tx
              </a>
            ) : (
              <div className="text-zinc-700">
                {phase === 'phase2' ? 'pending…' : phase === 'idle' || phase === 'phase1' ? '—' : phase === 'done' ? 'done' : '…'}
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
            <div className="text-[12px] text-zinc-200 truncate">Phases 1–3 · deterministic addresses</div>
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

      <button type="button" onClick={() => void submit()} disabled={disabled} className="btn-accent w-full rounded-lg">
        {busy ? 'Deploying…' : '1‑Click Deploy (ERC‑4337)'}
      </button>

      {disabledReason && !busy ? (
        <div className="text-[11px] text-amber-300/80">{disabledReason}</div>
      ) : null}

      {marketFloorText ? <div className="text-[11px] text-zinc-500">Market floor: {marketFloorText}</div> : null}

      {error ? (
        <div className="space-y-2">
          <div className="text-[11px] text-red-400/90">{error}</div>
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
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { ready: privyReady, authenticated: privyAuthenticated, logout, getAccessToken } = usePrivy() as any
  const { login } = useLogin()
  const { wallets } = useWallets()
  const { client: smartWalletClient } = useSmartWallets()
  const { linkCrossAppAccount, sendTransaction: sendCrossAppTransaction, signMessage: crossAppSignMessage } = useCrossAppAccounts()
  const { user } = usePrivy() as any
  const siwe = useSiweAuth()
  const [linkZoraWalletBusy, setLinkZoraWalletBusy] = useState(false)
  const [linkZoraWalletError, setLinkZoraWalletError] = useState<string | null>(null)
  const [addOwnerBusy, setAddOwnerBusy] = useState(false)
  const [addOwnerError, setAddOwnerError] = useState<string | null>(null)
  const [addOwnerTxHash, setAddOwnerTxHash] = useState<string | null>(null)
  const [linkWalletBusy, setLinkWalletBusy] = useState(false)
  const [linkWalletError, setLinkWalletError] = useState<string | null>(null)
  const [installOwnerBusy, setInstallOwnerBusy] = useState(false)
  const [installOwnerTxHash, setInstallOwnerTxHash] = useState<string | null>(null)
  const [installOwnerError, setInstallOwnerError] = useState<string | null>(null)
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  
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
    const raw = (import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined) ?? 'v3'
    const v = String(raw).trim()
    return v.length > 0 ? v : 'v3'
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

  const embeddedPrivyEoaAddress = useMemo(() => {
    try {
      const w: any = embeddedPrivyWallet as any
      const raw = typeof w?.address === 'string' ? String(w.address) : ''
      return raw && isAddress(raw) ? (getAddress(raw) as Address) : null
    } catch {
      return null
    }
  }, [embeddedPrivyWallet])

  const { linkWallet } = useLinkAccount({
    onSuccess: () => {
      setLinkWalletBusy(false)
      setLinkWalletError(null)
    },
    onError: (err) => {
      setLinkWalletBusy(false)
      setLinkWalletError(typeof err === 'string' ? err : 'Failed to link wallet')
    },
  })

  const handleLinkZoraWallet = useCallback(async () => {
    if (!privyAuthenticated) return
    setLinkZoraWalletBusy(true)
    setLinkZoraWalletError(null)
    try {
      await linkCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
      // On success, user will be redirected back and the Zora wallet will be linked
    } catch (err: any) {
      setLinkZoraWalletError(err?.message || 'Failed to link Zora wallet')
    } finally {
      setLinkZoraWalletBusy(false)
    }
  }, [privyAuthenticated, linkCrossAppAccount])

  // Get the cross-app (Zora) wallet from user's linked accounts
  const crossAppAccount = useMemo(() => {
    if (!user?.linkedAccounts) return null
    return user.linkedAccounts.find((acc: any) => acc.type === 'cross_app') ?? null
  }, [user])

  const zoraEmbeddedWalletAddress = useMemo(() => {
    if (!crossAppAccount?.embeddedWallets?.[0]?.address) return null
    const addr = crossAppAccount.embeddedWallets[0].address
    return isAddress(addr) ? getAddress(addr) as Address : null
  }, [crossAppAccount])

  // Check if Zora exposes their smart wallet address via cross-app
  // If available, this is the Coinbase Smart Wallet that holds the user's assets
  const zoraSmartWalletFromCrossApp = useMemo(() => {
    const smartWallets = (crossAppAccount as any)?.smartWallets
    if (!smartWallets?.[0]?.address) return null
    const addr = smartWallets[0].address
    return isAddress(addr) ? getAddress(addr) as Address : null
  }, [crossAppAccount])

  // Debug: log cross-app account structure
  useEffect(() => {
    if (crossAppAccount) {
      logger.info('[DeployVault] Cross-app account structure:', {
        type: (crossAppAccount as any)?.type,
        embeddedWallets: (crossAppAccount as any)?.embeddedWallets,
        smartWallets: (crossAppAccount as any)?.smartWallets,
        providerApp: (crossAppAccount as any)?.providerApp,
      })
    }
  }, [crossAppAccount])

  // Check Zora embedded wallet ETH balance (needed for gas)
  const publicClientForBalance = usePublicClient({ chainId: base.id })
  const zoraEmbeddedBalanceQuery = useQuery({
    queryKey: ['zoraEmbeddedBalance', zoraEmbeddedWalletAddress],
    queryFn: async () => {
      if (!zoraEmbeddedWalletAddress || !publicClientForBalance) return 0n
      return publicClientForBalance.getBalance({ address: zoraEmbeddedWalletAddress })
    },
    enabled: !!zoraEmbeddedWalletAddress && !!publicClientForBalance,
    refetchInterval: 30000, // Refresh every 30s
  })
  
  const zoraEmbeddedHasGas = useMemo(() => {
    // Need at least ~0.0001 ETH for gas (very conservative)
    const minGas = 100_000_000_000_000n // 0.0001 ETH
    return (zoraEmbeddedBalanceQuery.data ?? 0n) >= minGas
  }, [zoraEmbeddedBalanceQuery.data])

  // The Zora smart wallet is derived from the Zora embedded wallet
  // For Coinbase Smart Wallet, we need to check if our local embedded wallet is an owner
  const _zoraSmartWalletAddress = useMemo(() => {
    // The user's Zora smart wallet - this should match the creator coin's creator address
    // We'll get this from the zoraCoin data later
    return null as Address | null
  }, [])
  void _zoraSmartWalletAddress // Reserved for future use

  // Add owner to Zora smart wallet using cross-app transaction
  const handleAddOwnerToZoraWallet = useCallback(async (zoraSmartWallet: Address) => {
    if (!zoraEmbeddedWalletAddress || !embeddedPrivyEoaAddress) {
      setAddOwnerError('Missing wallet addresses')
      return
    }
    
    // Check if Zora embedded wallet has gas
    if (!zoraEmbeddedHasGas) {
      setAddOwnerError('Zora embedded wallet needs ETH for gas. Fund it first.')
      return
    }
    
    if (!sendCrossAppTransaction) {
      setAddOwnerError('Cross-app transaction not available')
      return
    }
    
    setAddOwnerBusy(true)
    setAddOwnerError(null)
    setAddOwnerTxHash(null)
    
    try {
      // Encode addOwnerAddress(address) call
      const addOwnerData = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [embeddedPrivyEoaAddress],
      })
      
      // Send transaction from cross-app wallet (Zora embedded wallet)
      const txHash = await sendCrossAppTransaction(
        {
          to: zoraSmartWallet,
          data: addOwnerData,
          value: 0n,
          chainId: base.id,
        },
        { address: zoraEmbeddedWalletAddress }
      )
      
      setAddOwnerTxHash(txHash)
      logger.info('[DeployVault] Added owner to Zora smart wallet', { txHash, zoraSmartWallet, newOwner: embeddedPrivyEoaAddress })
    } catch (err: any) {
      logger.error('[DeployVault] Failed to add owner', err)
      setAddOwnerError(err?.message || 'Failed to add owner to Zora wallet')
    } finally {
      setAddOwnerBusy(false)
    }
  }, [zoraEmbeddedWalletAddress, embeddedPrivyEoaAddress, sendCrossAppTransaction, zoraEmbeddedHasGas])

  const handleCopyEmbedded = useCallback(async () => {
    if (!embeddedPrivyEoaAddress) return
    try {
      await navigator.clipboard.writeText(embeddedPrivyEoaAddress)
    } catch {
      // ignore
    }
  }, [embeddedPrivyEoaAddress])

  const [searchParams] = useSearchParams()
  const prefillToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])
  const autoLogin = useMemo(() => {
    const raw = (searchParams.get('autologin') ?? '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes'
  }, [searchParams])
  const authHint = useMemo(() => {
    const raw = (searchParams.get('auth') ?? '').trim().toLowerCase()
    return raw === 'email' || raw === 'wallet' ? (raw as 'email' | 'wallet') : null
  }, [searchParams])
  const fromWaitlist = useMemo(() => {
    const raw = (searchParams.get('from') ?? '').trim().toLowerCase()
    return raw === 'waitlist'
  }, [searchParams])
  const baseEase = useMemo(() => [0.4, 0, 0.2, 1] as const, [])
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const cdpPaymasterUrl = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
  const paymasterStatus = useMemo(() => {
    const paymasterUrl = resolveCdpPaymasterUrl(cdpPaymasterUrl ?? null, cdpApiKey)
    if (!paymasterUrl || typeof paymasterUrl !== 'string') {
      return { ok: false, hint: 'missing' }
    }
    try {
      const url = new URL(paymasterUrl)
      return { ok: true, hint: url.host }
    } catch {
      return { ok: true, hint: 'configured' }
    }
  }, [cdpApiKey, cdpPaymasterUrl])

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
    enabled: hasWallet && showAdvanced,
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

  function formatToken18(raw?: bigint): string {
    if (raw === undefined) return '—'
    const decimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
    const s = formatUnits(raw, decimals)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

  const creatorAddress = zoraCoin?.creatorAddress ? String(zoraCoin.creatorAddress) : null
  const isOriginalCreator =
    !!address && !!creatorAddress && address.toLowerCase() === creatorAddress.toLowerCase()
  void isOriginalCreator // reserved for future UX

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

  // Prefer onchain truth over indexer graphs:
  // If the coin's payoutRecipient is a deployed contract, treat it as the canonical smart wallet.
  // This matches how many creators deploy their Zora coin (Smart Wallet payout recipient).
  const payoutRecipientBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'payoutRecipient', creatorToken, payoutRecipient],
    enabled: !!publicClient && !!payoutRecipient,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: payoutRecipient as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const payoutRecipientContract = useMemo(() => {
    if (!payoutRecipient) return null
    const code = payoutRecipientBytecodeQuery.data
    if (!code || code === '0x') return null
    return payoutRecipient
  }, [payoutRecipient, payoutRecipientBytecodeQuery.data])

  const { data: payoutRecipientTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((payoutRecipient ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!payoutRecipient },
  })

  void payoutRecipientTokenBalance // reserved for future UX

  const isPayoutRecipient =
    !!address && !!payoutRecipient && address.toLowerCase() === payoutRecipient.toLowerCase()
  void isPayoutRecipient // reserved for future UX

  // Privy provides the user's smart wallet directly via Zora global wallet integration.
  // Use this as the source of truth instead of detecting from Zora profile.
  const coinSmartWallet = useMemo(() => {
    // Privy smart wallet is the source of truth
    if (privySmartWalletAddress) return privySmartWalletAddress
    // Fallback: the coin's payout recipient if it's a contract
    if (payoutRecipientContract) return payoutRecipientContract
    return null
  }, [privySmartWalletAddress, payoutRecipientContract])
  void coinSmartWallet // reserved for future UX

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

  const canonicalIdentityBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'canonicalIdentity', canonicalIdentityAddress],
    enabled: !!publicClient && !!canonicalIdentityAddress,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: canonicalIdentityAddress as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })
  void canonicalIdentityBytecodeQuery // reserved for future UX

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
  const refreshEmbeddedOwnerStatus = useCallback(() => {
    void embeddedEoaIsCanonicalOwnerQuery.refetch()
  }, [embeddedEoaIsCanonicalOwnerQuery])

  const handleInstallEmbeddedAsOwner = useCallback(async () => {
    if (installOwnerBusy) return
    if (!canonicalIdentityIsContract || !canonicalIdentityAddress) {
      setInstallOwnerError('Missing Coinbase Smart Wallet address.')
      return
    }
    if (!embeddedPrivyEoaAddress) {
      setInstallOwnerError('No Privy embedded wallet found. Sign in with email to create one, then retry.')
      return
    }
    if (!isConnected || !connectedWalletAddress) {
      setInstallOwnerError('Connect the wallet that currently owns your Coinbase Smart Wallet, then retry.')
      return
    }

    setInstallOwnerBusy(true)
    setInstallOwnerError(null)
    setInstallOwnerTxHash(null)

    try {
      const ok = await isCoinbaseSmartWalletOwner({
        smartWallet: canonicalIdentityAddress as Address,
        ownerAddress: connectedWalletAddress as Address,
      })
      if (!ok) {
        throw new Error('Connected wallet is not an onchain owner of this Coinbase Smart Wallet.')
      }

      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [embeddedPrivyEoaAddress],
      })

      let txHash: string | null = null
      try {
        const wc: any = walletClient as any
        if (wc?.writeContract) {
          txHash = await wc.writeContract({
            address: canonicalIdentityAddress as Address,
            abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
            functionName: 'addOwnerAddress',
            args: [embeddedPrivyEoaAddress],
          })
        }
      } catch {
        txHash = null
      }

      if (!txHash) {
        const provider =
          connector && typeof (connector as any).getProvider === 'function' ? await (connector as any).getProvider() : null
        const request =
          provider?.request
            ? provider.request.bind(provider)
            : typeof window !== 'undefined' && (window as any)?.ethereum?.request
              ? (window as any).ethereum.request.bind((window as any).ethereum)
              : null
        if (!request) throw new Error('No wallet provider available.')
        txHash = await request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: connectedWalletAddress as Address,
              to: canonicalIdentityAddress as Address,
              data,
              value: '0x0',
            },
          ],
        })
      }

      setInstallOwnerTxHash(String(txHash))

      if (publicClient && typeof (publicClient as any).waitForTransactionReceipt === 'function') {
        await (publicClient as any).waitForTransactionReceipt({ hash: txHash })
      }
      await embeddedEoaIsCanonicalOwnerQuery.refetch()
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Failed to add owner'
      setInstallOwnerError(msg)
    } finally {
      setInstallOwnerBusy(false)
    }
  }, [
    canonicalIdentityAddress,
    canonicalIdentityIsContract,
    connectedWalletAddress,
    connector,
    embeddedEoaIsCanonicalOwnerQuery,
    embeddedPrivyEoaAddress,
    installOwnerBusy,
    isConnected,
    publicClient,
    walletClient,
  ])

  // Allow injected EOAs (Rabby/MetaMask/etc) to operate a Coinbase Smart Wallet canonical identity
  // when the EOA is an onchain owner of that smart wallet.
  // Uses server-side API to avoid client-side RPC rate limits.
  const executionCanOperateCanonicalQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwner', canonicalIdentityAddress, connectedWalletAddress],
    enabled: !!canonicalIdentityAddress && !!connectedWalletAddress && !!identity.blockingReason,
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
  const executionCanOperateCanonicalPending = !!identity.blockingReason && executionCanOperateCanonicalQuery.isFetching

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

  const privySmartWalletReady = Boolean(privySmartWalletAddress && smartWalletClient)
  
  // Check if Privy smart wallet matches the canonical identity (Zora smart wallet)
  // If they don't match, user needs to add the local embedded wallet as an owner
  const smartWalletMatchesCanonical = useMemo(() => {
    if (!privySmartWalletAddress || !canonicalIdentityAddress) return false
    return privySmartWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
  }, [privySmartWalletAddress, canonicalIdentityAddress])
  
  // Smart wallet is ready only if it matches canonical OR embedded wallet is an owner
  const smartWalletCapabilityReady = privySmartWalletReady && (smartWalletMatchesCanonical || embeddedEoaIsCanonicalOwner)

  // Debug: Log wallet matching state
  useEffect(() => {
    console.log('[DeployVault] Wallet state debug:', {
      privySmartWalletAddress,
      canonicalIdentityAddress,
      smartWalletMatchesCanonical,
      embeddedEoaIsCanonicalOwner,
      embeddedPrivyEoaAddress,
      privySmartWalletReady,
      smartWalletCapabilityReady,
      embeddedEoaIsCanonicalOwnerQueryStatus: embeddedEoaIsCanonicalOwnerQuery.status,
      embeddedEoaIsCanonicalOwnerQueryData: embeddedEoaIsCanonicalOwnerQuery.data,
    })
  }, [privySmartWalletAddress, canonicalIdentityAddress, smartWalletMatchesCanonical, embeddedEoaIsCanonicalOwner, embeddedPrivyEoaAddress, privySmartWalletReady, smartWalletCapabilityReady, embeddedEoaIsCanonicalOwnerQuery.status, embeddedEoaIsCanonicalOwnerQuery.data])

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

  const deployPathLabel = privySmartWalletReady
    ? 'Privy smart wallet (ERC-4337)'
    : 'Sign in via Privy required'

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

            {isAdmin ? (
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
            {tokenIsValid && (
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

            {/* Essentials */}
            <div className="card rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Launch</div>
                  <div className="text-xs text-zinc-600">Minimal launch details for your Creator Coin.</div>
                </div>
                {hasWallet ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {showAdvanced ? 'Hide details' : 'Details'}
                  </button>
                ) : null}
              </div>

              {/* Creator Coin */}
              <div className="space-y-2">
                <label className="label">Creator Coin</label>

                {miniApp.isMiniApp && farcasterAuth.status !== 'verified' && farcasterAuth.canSiwf !== false ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-600">
                      Verify Farcaster to enable Mini App autofill.
                    </div>
                    <button
                      type="button"
                      onClick={() => void farcasterAuth.signIn()}
                      disabled={farcasterAuth.status === 'loading'}
                      className="text-[10px] text-zinc-600 hover:text-zinc-200 transition-colors disabled:opacity-60"
                      title="Requests a Sign in With Farcaster credential (no transaction)"
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
                ) : !showAdvanced ? (
                  tokenIsValid ? (
                    <>
                      <input
                        value={creatorToken}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">
                        {detectedCreatorCoin &&
                        creatorToken.toLowerCase() === detectedCreatorCoin.toLowerCase()
                          ? 'Prefilled for this wallet.'
                          : prefillToken
                            ? 'Set from a link.'
                            : 'Set manually.'}
                      </div>
                    </>
                  ) : detectedCreatorCoin ? (
                    <>
                      <input
                        value={detectedCreatorCoin}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Prefilled for this wallet.</div>
                    </>
                  ) : myProfileQuery.isLoading || myProfileQuery.isFetching ? (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Detecting your creator coin…"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">If you don’t have a Creator Coin yet, you won’t be able to deploy a vault.</div>
                    </>
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="No creator coin detected for this wallet"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Open Details if you need to paste a coin address.</div>
                    </>
                  )
                ) : (
                  <>
                    <div className="text-xs text-zinc-600">
                      Paste a Creator Coin address if you want to deploy a different coin.
                    </div>
                    <input
                      value={creatorToken}
                      onChange={(e) => setCreatorToken(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
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

              {/* Details */}
              {hasWallet && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-4">
                  <div className="space-y-2">
                    <div className="label">Deployment</div>
                    <div className="text-[10px] text-zinc-700">
                      Deterministic version: <span className="font-mono text-zinc-400">{deploymentVersion}</span>
                    </div>
                    <div className="text-xs text-zinc-600">
                      This is a global “slate” knob. Change <span className="font-mono">VITE_DEPLOYMENT_VERSION</span> to start a fresh deterministic
                      namespace for everyone.
                    </div>
                  </div>

                  <div className="text-xs text-zinc-600">
                    Allowlist:{' '}
                    <span className="text-zinc-300">
                      {allowlistMode === 'disabled' ? 'disabled' : isAllowlistedCreator ? 'allowed' : 'blocked'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Smart Wallet Requirement */}
              {hasWallet && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-4">
                  <div>
                    <div className="label mb-2">Your Smart Wallet</div>

                    <div className="text-xs text-zinc-600 space-y-3">
                      <div>
                        Deploy runs from your <span className="text-white">smart wallet</span> on Base. It must hold the first{' '}
                        <span className="text-white font-medium">5,000,000 {underlyingSymbolUpper || 'TOKENS'}</span> deposit.
                      </div>

                      {tokenIsValid ? (
                        <div className="flex items-center justify-between text-sm p-3 bg-black/40 border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500">Creator smart wallet balance:</span>
                          <span className={walletHasMinDeposit ? 'text-emerald-400 font-medium' : 'text-amber-300/90 font-medium'}>
                            {formatToken18(typeof deploySenderTokenBalance === 'bigint' ? deploySenderTokenBalance : undefined)}{' '}
                            {underlyingSymbolUpper || 'TOKENS'}
                          </span>
                        </div>
                      ) : null}

                      <div className="text-[11px] text-zinc-700">
                        After deployment: the Vault is owned by your canonical identity wallet; protocol-owned components handle shared ops (hooks, auction wiring, fee routing).
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

            {/* Deploy */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="label">Deploy</div>

              {showAdvanced && hasWallet && tokenIsValid && zoraCoin && canonicalIdentityAddress && effectiveWalletAddress ? (
                <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Canonical identity</div>
                    <div className="text-[11px] font-mono text-zinc-200">{shortAddress(String(canonicalIdentityAddress))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Identity source</div>
                    <div className="text-[11px] text-zinc-400">{identitySourceLabel(String(identity.canonicalIdentity.source))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Execution wallet</div>
                    <div className="text-[11px] font-mono text-zinc-200">{shortAddress(String(connectedWalletAddress))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Deploy path</div>
                    <div className="text-[11px] text-zinc-300">
                      {deployPathLabel}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-700">
                    Vault ownership will be set to the canonical identity. Your connected wallet only executes the transaction.
                  </div>
                </div>
              ) : null}


              {/* Debug: Wallet state - temporarily always visible for diagnosis */}
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 text-[10px] font-mono space-y-1 mb-3">
                <div className="text-zinc-500 font-semibold">Debug: Wallet State</div>
                <div>connector: <span className={connector?.id === 'coinbaseWalletSDK' ? 'text-green-400' : 'text-zinc-300'}>{connector?.id || 'none'}</span></div>
                <div>connectedAddress: <span className="text-zinc-300">{address || 'null'}</span></div>
                <div>privySmartWallet: <span className="text-zinc-300">{privySmartWalletAddress || 'null'}</span></div>
                <div>canonicalIdentity: <span className="text-zinc-300">{canonicalIdentityAddress || 'null'}</span></div>
                <div>canonicalIsContract: <span className={canonicalIdentityIsContract ? 'text-green-400' : 'text-red-400'}>{String(canonicalIdentityIsContract)}</span></div>
                <div>zoraEmbeddedWallet: <span className={zoraEmbeddedWalletAddress ? 'text-green-400' : 'text-red-400'}>{zoraEmbeddedWalletAddress || 'NOT LINKED'}</span></div>
                <div>smartWalletMatchesCanonical: <span className={smartWalletMatchesCanonical ? 'text-green-400' : 'text-red-400'}>{String(smartWalletMatchesCanonical)}</span></div>
                <div>embeddedEoaIsCanonicalOwner: <span className={embeddedEoaIsCanonicalOwner ? 'text-green-400' : 'text-red-400'}>{String(embeddedEoaIsCanonicalOwner)}</span></div>
                <div>privySmartWalletReady: <span className={privySmartWalletReady ? 'text-green-400' : 'text-red-400'}>{String(privySmartWalletReady)}</span></div>
                <div>smartWalletCapabilityReady: <span className={smartWalletCapabilityReady ? 'text-green-400' : 'text-red-400'}>{String(smartWalletCapabilityReady)}</span></div>
                <div>embeddedPrivyEoa: <span className="text-zinc-300">{embeddedPrivyEoaAddress || 'null'}</span></div>
                <div>canDeploy: <span className={canDeploy ? 'text-green-400' : 'text-red-400'}>{String(canDeploy)}</span></div>
                {connector?.id === 'coinbaseWalletSDK' && (
                  <div className="text-green-400 font-semibold mt-1">✓ Coinbase Wallet Direct - ERC-4337 ready!</div>
                )}
                
                {/* Fund embedded wallet for gas */}
                {embeddedPrivyEoaAddress && canonicalIdentityIsContract && (
                  <div className="mt-2 pt-2 border-t border-zinc-700">
                    <div className="text-amber-400 mb-2">⚠ Embedded wallet needs ETH for gas</div>
                    <div className="text-[9px] text-zinc-500 mb-2">
                      Send ~0.001 ETH to enable deploy via executeBatch
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-[9px] bg-black/30 px-2 py-1 rounded flex-1 truncate">{embeddedPrivyEoaAddress}</code>
                      <button
                        type="button"
                        className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-[9px] rounded"
                        onClick={() => void navigator.clipboard.writeText(embeddedPrivyEoaAddress)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Simplified auth flow: Privy only */}
              {!privyReady ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Loading…
                </button>
              ) : !privyAuthenticated ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="btn-accent w-full"
                    onClick={() => void login({ loginMethods: ['wallet', 'email'] })}
                  >
                    Sign in to Deploy
                  </button>
                  <div className="text-[11px] text-zinc-600">
                    Sign in with the same account you used on Zora to access your Creator Coin wallet.
                  </div>
                </div>
              ) : !privySmartWalletAddress && !privyLinkedEoaAddress && !isConnected ? (
                <div className="space-y-3">
                  <button
                    disabled
                    className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                  >
                    No wallet linked
                  </button>
                  <div className="text-[11px] text-zinc-600">
                    Email sign-in does not automatically import your Zora wallet into this app.
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={linkZoraWalletBusy}
                    onClick={handleLinkZoraWallet}
                  >
                    {linkZoraWalletBusy ? 'Connecting to Zora…' : 'Link Zora Wallet'}
                  </button>
                  {linkZoraWalletError && (
                    <div className="text-[11px] text-red-400">{linkZoraWalletError}</div>
                  )}
                  <div className="text-[11px] text-zinc-700 text-center">or</div>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={linkWalletBusy}
                    onClick={() => {
                      if (linkWalletBusy) return
                      setLinkWalletBusy(true)
                      setLinkWalletError(null)
                      try {
                        linkWallet()
                      } catch (e: any) {
                        setLinkWalletBusy(false)
                        setLinkWalletError(e?.message ? String(e.message) : 'Failed to link wallet')
                      }
                    }}
                  >
                    {linkWalletBusy ? 'Opening…' : 'Link a different wallet'}
                  </button>
                  {linkWalletError ? <div className="text-[11px] text-red-400">{linkWalletError}</div> : null}
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={() => void login({ loginMethods: ['wallet', 'email'] })}
                  >
                    Try different sign-in
                  </button>
                </div>
              ) : tokenIsValid &&
                zoraCoin &&
                canonicalIdentityAddress &&
                canonicalIdentityIsContract &&
                embeddedPrivyEoaAddress &&
                embeddedEoaIsCanonicalOwnerQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking Smart Wallet owners…
                </button>
              ) : tokenIsValid &&
                zoraCoin &&
                canonicalIdentityAddress &&
                canonicalIdentityIsContract &&
                embeddedPrivyEoaAddress &&
                !embeddedEoaIsCanonicalOwner ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10">
                    <div className="text-sm font-medium text-amber-200">One-time setup required</div>
                    <div className="mt-1 text-xs text-amber-200/80 leading-relaxed">
                      To enable ERC-4337 batched transactions, add your CreatorVault embedded wallet as an owner of your Zora Smart Wallet.
                      This is a one-time setup.
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">CreatorVault embedded wallet</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-200 truncate">{embeddedPrivyEoaAddress}</div>
                      </div>
                      <button type="button" className="btn-secondary shrink-0" onClick={() => void handleCopyEmbedded()}>
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Option 1: Use cross-app wallet (Zora) to add owner - preferred */}
                  {zoraEmbeddedWalletAddress ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={addOwnerBusy}
                        onClick={() => void handleAddOwnerToZoraWallet(canonicalIdentityAddress as Address)}
                      >
                        {addOwnerBusy ? 'Confirm in Zora popup…' : 'Add owner via Zora (Recommended)'}
                      </button>
                      {addOwnerTxHash ? (
                        <div className="text-[11px] text-green-400">
                          Success! Tx: <span className="font-mono">{shortAddress(addOwnerTxHash)}</span>
                          <button
                            type="button"
                            className="ml-2 text-zinc-400 underline"
                            onClick={() => void refreshEmbeddedOwnerStatus()}
                          >
                            Refresh status
                          </button>
                        </div>
                      ) : null}
                      {addOwnerError ? <div className="text-[11px] text-red-400">{addOwnerError}</div> : null}
                      <div className="text-[11px] text-zinc-600">
                        This will open a popup to Zora for you to approve the transaction.
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={linkZoraWalletBusy}
                        onClick={handleLinkZoraWallet}
                      >
                        {linkZoraWalletBusy ? 'Connecting…' : 'Link Zora Wallet first'}
                      </button>
                      {linkZoraWalletError && (
                        <div className="text-[11px] text-red-400">{linkZoraWalletError}</div>
                      )}
                      <div className="text-[11px] text-zinc-600">
                        Link your Zora wallet to add the owner via cross-app transaction.
                      </div>
                    </>
                  )}

                  <div className="text-[11px] text-zinc-700 text-center">— or —</div>

                  {/* Option 2: Connect wallet manually */}
                  <button type="button" className="btn-secondary w-full" disabled={installOwnerBusy} onClick={() => void handleInstallEmbeddedAsOwner()}>
                    {installOwnerBusy ? 'Confirming…' : 'Add owner via connected wallet'}
                  </button>
                  {installOwnerTxHash ? (
                    <div className="text-[11px] text-zinc-500">
                      Submitted: <span className="font-mono text-zinc-400">{shortAddress(installOwnerTxHash)}</span>
                    </div>
                  ) : null}
                  {installOwnerError ? <div className="text-[11px] text-red-400">{installOwnerError}</div> : null}
                  <div className="text-[11px] text-zinc-600">
                    Connect the wallet that currently owns your Smart Wallet to approve.
                  </div>
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
                      Verified wallets (Farcaster, suggestion-only):{' '}
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
              ) : tokenIsValid && zoraCoin && privySmartWalletReady && !smartWalletMatchesCanonical && !embeddedEoaIsCanonicalOwner ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10">
                    <div className="text-sm font-medium text-amber-200">Wallet setup required</div>
                    <div className="mt-2 text-xs text-amber-200/80 leading-relaxed">
                      Your Privy smart wallet (<span className="font-mono">{privySmartWalletAddress ? shortAddress(privySmartWalletAddress) : '—'}</span>) 
                      doesn't match your Zora smart wallet (<span className="font-mono">{canonicalIdentityAddress ? shortAddress(canonicalIdentityAddress) : '—'}</span>).
                    </div>
                    <div className="mt-2 text-xs text-amber-200/80 leading-relaxed">
                      Add your CreatorVault embedded wallet as an owner of your Zora wallet to enable deployment.
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">CreatorVault embedded wallet</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-200 truncate">{embeddedPrivyEoaAddress || '—'}</div>
                      </div>
                      <button type="button" className="btn-secondary shrink-0" onClick={() => void handleCopyEmbedded()}>
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Option 1: Link Zora and add owner via cross-app */}
                  {zoraEmbeddedWalletAddress ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={addOwnerBusy}
                        onClick={() => canonicalIdentityAddress && void handleAddOwnerToZoraWallet(canonicalIdentityAddress as Address)}
                      >
                        {addOwnerBusy ? 'Confirm in Zora popup…' : 'Add owner via Zora (Recommended)'}
                      </button>
                      {addOwnerTxHash && (
                        <div className="text-[11px] text-green-400">
                          Success! Tx: <span className="font-mono">{shortAddress(addOwnerTxHash)}</span>
                          <button type="button" className="ml-2 text-zinc-400 underline" onClick={() => void refreshEmbeddedOwnerStatus()}>
                            Refresh status
                          </button>
                        </div>
                      )}
                      {addOwnerError && <div className="text-[11px] text-red-400">{addOwnerError}</div>}
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-primary w-full" disabled={linkZoraWalletBusy} onClick={handleLinkZoraWallet}>
                        {linkZoraWalletBusy ? 'Connecting…' : 'Link Zora Wallet'}
                      </button>
                      {linkZoraWalletError && <div className="text-[11px] text-red-400">{linkZoraWalletError}</div>}
                      <div className="text-[11px] text-zinc-600">
                        Link your Zora wallet to add the owner via cross-app transaction.
                      </div>
                    </>
                  )}

                  <div className="text-[11px] text-zinc-700 text-center">— or add manually on Basescan —</div>
                  <a
                    href={`https://basescan.org/address/${canonicalIdentityAddress}#writeContract`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full text-center block"
                  >
                    Open on Basescan
                  </a>
                  <div className="text-[11px] text-zinc-600">
                    Call <code className="bg-black/30 px-1 rounded">addOwnerAddress</code> with <code className="bg-black/30 px-1 rounded">{embeddedPrivyEoaAddress ? shortAddress(embeddedPrivyEoaAddress) : '—'}</code>
                  </div>
                </div>
              ) : canDeploy ? (
                <>
                  {tokenIsValid && zoraCoin && identity.warnings.includes('CUSTODY_MISMATCH') && farcasterCustodyAddress ? (
                    <div className="text-[11px] text-amber-300/80">
                      Farcaster custody wallet{' '}
                      <span className="font-mono text-amber-200">{shortAddress(farcasterCustodyAddress)}</span> does not match the coin’s
                      canonical identity{' '}
                      <span className="font-mono text-amber-200">
                        {shortAddress(identity.canonicalIdentity.address as Address)}
                      </span>
                      . This does not block deploy, but double-check you’re using the intended identity.
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
                    currentPayoutRecipient={payoutRecipient}
                    floorPriceQ96Aligned={marketFloorQuery.data?.floorPriceQ96Aligned ?? null}
                    marketFloorTwapDurationSec={marketFloorQuery.data?.creatorZora.durationSec ?? null}
                    marketFloorDiscountBps={marketFloorQuery.data?.zoraEth.discountBps ?? null}
                    onSuccess={() => {}}
                    switchAuthCta={switchAuthCta}
                    smartWalletClient={smartWalletClient}
                    canonicalSmartWallet={canonicalIdentityIsContract ? (canonicalIdentityAddress as Address) : null}
                    embeddedWallet={embeddedPrivyWallet}
                    embeddedEoaAddress={embeddedPrivyEoaAddress}
                    zoraEmbeddedWalletAddress={zoraEmbeddedWalletAddress}
                    zoraEmbeddedHasGas={zoraEmbeddedHasGas}
                    zoraEmbeddedBalance={zoraEmbeddedBalanceQuery.data ?? 0n}
                    sendCrossAppTransaction={sendCrossAppTransaction}
                    crossAppSignMessage={crossAppSignMessage ?? null}
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

              {/* Debug: Show Zora cross-app wallet info */}
              {zoraEmbeddedWalletAddress && (
                <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2 text-[10px]">
                  <div className="text-zinc-400 font-medium">Zora Cross-App Wallets</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Embedded (EOA):</span>
                      <code className="text-zinc-300 font-mono">{zoraEmbeddedWalletAddress.slice(0,10)}...{zoraEmbeddedWalletAddress.slice(-8)}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Smart Wallet:</span>
                      <code className="text-zinc-300 font-mono">
                        {zoraSmartWalletFromCrossApp 
                          ? `${zoraSmartWalletFromCrossApp.slice(0,10)}...${zoraSmartWalletFromCrossApp.slice(-8)}`
                          : 'Not exposed'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">EOA Balance:</span>
                      <span className={zoraEmbeddedHasGas ? 'text-green-400' : 'text-amber-400'}>
                        {formatUnits(zoraEmbeddedBalanceQuery.data ?? 0n, 18)} ETH
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning: Zora wallet linked but needs gas */}
              {zoraEmbeddedWalletAddress && !zoraEmbeddedHasGas && (
                <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-700/30 space-y-2">
                  <div className="text-xs text-amber-300/90 font-medium">⚠ Zora wallet needs ETH for gas</div>
                  <div className="text-[11px] text-zinc-400">
                    Your Zora embedded wallet has no ETH for transaction fees. Send ~0.001 ETH to enable cross-app deploys.
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[9px] bg-black/30 px-2 py-1 rounded flex-1 truncate font-mono">{zoraEmbeddedWalletAddress}</code>
                    <button
                      type="button"
                      className="text-[9px] px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                      onClick={() => navigator.clipboard.writeText(zoraEmbeddedWalletAddress)}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Balance: {formatUnits(zoraEmbeddedBalanceQuery.data ?? 0n, 18)} ETH
                  </div>
                </div>
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

              <div className="text-xs text-zinc-600">
                Requires a 5,000,000 {underlyingSymbolUpper || 'TOKENS'} deposit. Some wallets may prompt multiple confirmations.
              </div>
            </div>

            {/* Contracts (details) */}
            {showAdvanced ? (
              <details className="card rounded-xl p-8">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                  <div className="label">Contracts</div>
                  <div className="text-[10px] text-zinc-600">View</div>
                </summary>

              <div className="mt-6 rounded-2xl border border-white/5 bg-[#080808]/60 backdrop-blur-2xl overflow-hidden divide-y divide-white/5">
                <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                  Core stack
                </div>

                <ExplainerRow
                  icon={
                    <div className="w-14 h-14 rounded-full bg-black/30 border border-white/5 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] flex items-center justify-center text-zinc-500">
                      <Lock className="w-5 h-5" />
                    </div>
                  }
                  label="Vault token"
                  title={`${derivedVaultName || '—'} (${derivedVaultSymbol || '—'})`}
                  contractName="CreatorOVault"
                  note="Core vault that holds creator coin deposits and mints shares."
                  metaLine={
                    <>
                      <span className="font-mono text-zinc-400">ERC-4626</span>
                      {' · '}
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/layerzero.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        LayerZero
                      </span>
                      {' · '}
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/yearn.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Yearn v3
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    tokenIsValid ? (
                      <DerivedTokenIcon
                        tokenAddress={creatorToken as `0x${string}`}
                        symbol={underlyingSymbolUpper || 'TOKEN'}
                        variant="share"
                        size="lg"
                      />
                    ) : null
                  }
                  label="Share token"
                  title={`${derivedShareName || '—'} (${derivedShareSymbol || '—'})`}
                  contractName="CreatorShareOFT"
                  note="Wrapped vault shares token (■TOKEN) used for routing fees."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/layerzero.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        LayerZero OFT
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <Layers className="w-4 h-4" />
                    </div>
                  }
                  label="Wrapper"
                  title="Vault Wrapper"
                  contractName="CreatorOVaultWrapper"
                  note="Wraps/unlocks vault shares into ■TOKEN."
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  }
                  label="Gauge controller"
                  title="Fees & incentives"
                  contractName="CreatorGaugeController"
                  note="Routes fees (burn / lottery / voters) and manages gauges."
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <Rocket className="w-4 h-4" />
                    </div>
                  }
                  label="Launch strategy"
                  title={
                    <a
                      href="https://cca.uniswap.org"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block max-w-full hover:text-white transition-colors underline underline-offset-4 decoration-white/15 hover:decoration-white/30"
                      title="Open cca.uniswap.org"
                    >
                      Uniswap Continuous Clearing Auction
                    </a>
                  }
                  contractName="CCALaunchStrategy"
                  note="Runs Uniswap’s Continuous Clearing Auction (CCA) for fair price discovery."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/uniswap.png"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Uniswap
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  }
                  label="Oracle"
                  title="Price oracle"
                  contractName="CreatorOracle"
                  note="Price oracle used by the auction and strategies."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/chainlink.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Chainlink
                      </span>
                    </>
                  }
                />

                <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                  Yield strategies (post-auction)
                </div>
                <div className="px-4 py-3 text-[12px] text-zinc-500">
                  Yield strategies are deployed after launch (post-auction) to keep the initial deployment deterministic and compatible with wallet
                  simulation.
                </div>
              </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}
