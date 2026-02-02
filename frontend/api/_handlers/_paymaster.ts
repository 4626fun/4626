import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  concatHex,
  decodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'

import { getApiContracts } from '../../server/_lib/contracts.js'
import { logger } from '../../server/_lib/logger.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../../server/_lib/postgres.js'
import { ensureCreatorWalletsSchema } from '../../server/_lib/creatorWallets.js'
import { resolveCoinParties } from '../../server/_lib/coinParties.js'
import { getActiveDeploySessionForSender, getDeploySessionByTokenHash, hashDeployToken, signDeployToken } from '../../server/_lib/deploySessions.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../server/_lib/supabaseAdmin.js'
import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../server/auth/_shared.js'
import { ensureWaitlistSchema } from '../../server/_lib/waitlistSchema.js'

declare const process: { env: Record<string, string | undefined> }

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: unknown; params?: unknown }

type UserOperation = { sender?: unknown; callData?: unknown; initCode?: unknown; factory?: unknown; factoryData?: unknown }

const ALLOWED_METHODS = new Set<string>([
  // Paymaster
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  // Bundler
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationReceipt',
  'eth_supportedEntryPoints',
  'eth_getUserOperationByHash',
])

const METHODS_REQUIRING_USEROP = new Set<string>([
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
])

const ENTRYPOINT_V06 = getAddress(`0x${'5ff137d4b0fdcd49dca30c7cf57e578a026d2789'}`)
const BASE_CHAIN_ID = 8453

// Coinbase Smart Wallet callData
const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
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

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'isOwner', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_FACTORY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'createAccount',
    outputs: [{ name: 'account', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Minimal CreatorVaultBatcher ABI for decoding the two-step (phase1/2/3) functions.
// These functions take a tuple as the first argument, so we MUST decode via ABI (not by word offset).
const CREATOR_VAULT_BATCHER_PHASE_ABI = [
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
    outputs: [],
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
    outputs: [],
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
    outputs: [],
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
    outputs: [],
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
    outputs: [],
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
    outputs: [],
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
    outputs: [],
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

// Coinbase Smart Wallet factories (see viem's `toCoinbaseSmartAccount` implementation).
const COINBASE_SMART_WALLET_FACTORIES = new Set<Address>([
  getAddress(`0x${'0ba5ed0c6aa8c49038f819e587e2633c4a9f428a'}`), // v1
  getAddress(`0x${'ba5ed110efdba3d005bfc882d75358acbbb85842'}`), // v1.1
])

// Allowed inner call selectors
const SELECTOR_ERC20_APPROVE = '0x095ea7b3'
const SELECTOR_COIN_SET_PAYOUT_RECIPIENT = '0x46bb5954'
const SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM = '0x30f28b7a'

// Coinbase Smart Wallet owner management (used for deploy sessions)
const SELECTOR_CSW_ADD_OWNER_ADDRESS = '0x0f0f3f24' // addOwnerAddress(address)
const SELECTOR_CSW_REMOVE_OWNER_AT_INDEX = '0x89625b57' // removeOwnerAtIndex(uint256,bytes)

// Two-step batcher selectors (Base)
const SELECTOR_BATCHER_DEPLOY_PHASE1 = '0x3c51ca4e'
const SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT = '0x297cb1e6'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH = '0x669fb9e2'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT = '0xd76fbd95'
const SELECTOR_BATCHER_DEPLOY_PHASE2_CORE = '0xf9344d88'
const SELECTOR_BATCHER_FINALIZE_PHASE2 = '0x036a3142'
const SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES = '0x6e3f91b0'
const SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION = '0x37421852'

const SELECTOR_ACTIVATION_BATCH_ACTIVATE = '0xc5c1e920'
const SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR = '0xdc5de72c'

const SELECTOR_CREATE2_DEPLOY_FROM_STORE = '0xd76fad23' // deploy(bytes32,bytes32,bytes)

const SELECTOR_VAULT_SET_BURN_STREAM = '0xf3a1c8b6' // setBurnStream(address)
const SELECTOR_VAULT_SET_WHITELIST = '0x53d6fd59' // setWhitelist(address,bool)

const ALLOWED_BATCHER_SELECTORS = new Set<string>([
  SELECTOR_BATCHER_DEPLOY_PHASE1,
  SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT,
  SELECTOR_BATCHER_DEPLOY_PHASE2_CORE,
  SELECTOR_BATCHER_FINALIZE_PHASE2,
  SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES,
  SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION,
])

const ALLOWED_ACTIVATION_SELECTORS = new Set<string>([
  SELECTOR_ACTIVATION_BATCH_ACTIVATE,
  SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR,
])

const ALLOWED_TOKEN_SELECTORS = new Set<string>([SELECTOR_ERC20_APPROVE, SELECTOR_COIN_SET_PAYOUT_RECIPIENT])
const ALLOWED_PERMIT2_SELECTORS = new Set<string>([SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM])
const ALLOWED_SELF_SELECTORS = new Set<string>([SELECTOR_CSW_ADD_OWNER_ADDRESS, SELECTOR_CSW_REMOVE_OWNER_AT_INDEX])

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
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
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

function readDeploySessionHeaders(req: VercelRequest): { token: string; signature: string } | null {
  const rawToken = (req.headers?.['x-cv-deploy-session'] ?? '') as any
  const rawSig = (req.headers?.['x-cv-deploy-session-signature'] ?? '') as any
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  const signature = typeof rawSig === 'string' ? rawSig.trim() : ''
  if (!token || !signature) return null
  return { token, signature }
}

// Payout routing (Base mainnet)
const PAYOUT_ROUTER_CODE_ID = `0x${'ec3a19f83778a374ef791c3df99ec79478b68b0319515a6a7898b3c5d614a107'}` as const
const VAULT_SHARE_BURN_STREAM_CODE_ID = `0x${'9b5e26f68c206df4fb41253da53c3c1d377334db21d566adbf41ac43fc711a21'}` as const

const BYTECODE_STORE_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ name: 'creationCode', type: 'bytes' }],
  },
] as const

const ERC20_METADATA_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const ERC4626_ASSET_ABI = [
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const SHARE_OFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const CREATOR_VAULT_BATCHER_PHASE1_EVENT = [
  {
    type: 'event',
    name: 'Phase1Deployed',
    inputs: [
      { indexed: true, name: 'creatorToken', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'oftBootstrapRegistry', type: 'address' },
      { indexed: false, name: 'vault', type: 'address' },
      { indexed: false, name: 'wrapper', type: 'address' },
      { indexed: false, name: 'shareOFT', type: 'address' },
    ],
  },
] as const

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const

const BASE_WETH = getAddress(`0x${'4200000000000000000000000000000000000006'}`)
const BASE_SWAP_ROUTER = getAddress(`0x${'2626664c2603336E57B271c5C0b26F421741e481'}`)
const PAYOUT_ROUTER_SALT_TAG = 'CreatorVault:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = 'CreatorVault:VaultShareBurnStream' as const

type InnerCall = { target: Address; value: bigint; data: Hex }

type RateLimitBucket = { count: number; resetAtMs: number }
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 50
const rateLimitBuckets: Map<string, RateLimitBucket> = new Map()

let _baseClient: any | null = null
async function getBaseClient() {
  if (_baseClient) return _baseClient
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')

  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  _baseClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })
  return _baseClient
}

type AllowlistMode = 'disabled' | 'enforced'

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    if (!isAddress(p)) continue
    out.add(p.toLowerCase())
  }
  return out
}

function normalizeAddresses(input: Array<Address | string | null | undefined>): Address[] {
  const out = new Set<string>()
  for (const a of input) {
    if (!a || typeof a !== 'string') continue
    if (!isAddress(a)) continue
    out.add(getAddress(a).toLowerCase())
  }
  return Array.from(out).map((a) => getAddress(a as Address))
}

function buildSupabaseOrFilters(fields: string[], addresses: string[]): string {
  return addresses.flatMap((addr) => fields.map((f) => `${f}.ilike.${addr}`)).join(',')
}

async function resolveAllowlistAddresses(params: { sessionAddress: Address; creatorToken?: Address | null }): Promise<Address[]> {
  const base = normalizeAddresses([params.sessionAddress])
  const token = params.creatorToken && isAddress(params.creatorToken) ? getAddress(params.creatorToken) : null
  if (!token) return base
  const parties = await resolveCoinParties(token as `0x${string}`)
  const combined = normalizeAddresses([params.sessionAddress, parties.creator, parties.payoutRecipient])
  return combined.length > 0 ? combined : base
}

async function checkCswOwnership(sessionAddress: Address, cswAddress: Address): Promise<boolean> {
  try {
    const client = await getBaseClient()
    const isOwner = await client.readContract({
      address: cswAddress,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [sessionAddress],
    })
    return Boolean(isOwner)
  } catch {
    return false
  }
}

async function isCreatorAllowlisted(params: {
  sessionAddress: Address
  creatorToken?: Address | null
}): Promise<{ mode: AllowlistMode; allowed: boolean }> {
  const addr = params.sessionAddress.toLowerCase()
  const addressesToCheck = await resolveAllowlistAddresses({ sessionAddress: params.sessionAddress, creatorToken: params.creatorToken })
  const addressFilters = addressesToCheck.map((a) => a.toLowerCase())

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    try {
      // Check allowlist first (direct address or CSW match)
      const allowlistedRes = await supabase
        .from('allowlist')
        .select('address')
        .or(buildSupabaseOrFilters(['address', 'csw_address'], addressFilters))
        .is('revoked_at', null)
        .limit(1)
      if (!allowlistedRes.error && Array.isArray(allowlistedRes.data) && allowlistedRes.data.length > 0) {
        return { mode: 'enforced', allowed: true }
      }

      // Check if session is owner of any allowlisted CSW (on-chain check)
      const cswRes = await supabase
        .from('allowlist')
        .select('csw_address')
        .not('csw_address', 'is', null)
        .is('revoked_at', null)
        .limit(50)
      if (!cswRes.error && Array.isArray(cswRes.data) && cswRes.data.length > 0) {
        for (const row of cswRes.data) {
          const csw = row.csw_address as string
          if (csw && isAddress(csw)) {
            const isOwner = await checkCswOwnership(params.sessionAddress, getAddress(csw))
            if (isOwner) return { mode: 'enforced', allowed: true }
          }
        }
      }

      // Check creator_wallets (linked wallets)
      const linkedRes = await supabase
        .from('creator_wallets')
        .select('wallet_address')
        .or(buildSupabaseOrFilters(['wallet_address'], addressFilters))
        .limit(1)
      if (!linkedRes.error && Array.isArray(linkedRes.data) && linkedRes.data.length > 0) {
        return { mode: 'enforced', allowed: true }
      }

      // Check profiles with approved app_access_status
      const waitlistedRes = await supabase
        .from('profiles')
        .select('id')
        .or(buildSupabaseOrFilters(['primary_wallet', 'embedded_wallet', 'csw_address'], addressFilters))
        .eq('app_access_status', 'approved')
        .limit(1)
      if (!waitlistedRes.error && Array.isArray(waitlistedRes.data) && waitlistedRes.data.length > 0) {
        return { mode: 'enforced', allowed: true }
      }

      // If all checks passed without errors but no match, user is not allowed
      return { mode: 'enforced', allowed: false }
    } catch {
      throw new Error('allowlist_check_failed')
    }
  }

  if (isDbConfigured()) {
    const db = await getDb()
    if (!db) throw new Error('allowlist_check_failed')
    await ensureCreatorAccessSchema()
    if (!db.query || typeof (db as any).sql !== 'function') throw new Error('allowlist_check_failed')
    // Mirror `/api/creator-allowlist`: allow allowlisted OR linked OR waitlisted creators.
    // This keeps paymaster/bundler gating consistent with the UI's creator-access decision.
    try {
      await ensureCreatorWalletsSchema(db as any)
      await ensureWaitlistSchema(db as any)
    } catch {
      // Don't block everything if optional tables are unavailable; fall back to allowlist-only.
    }

    // Check direct address match
    const allowlistedQ = await db.query(
      `SELECT address FROM allowlist
       WHERE (LOWER(address) = ANY($1) OR LOWER(csw_address) = ANY($1))
         AND revoked_at IS NULL
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(allowlistedQ.rows) && allowlistedQ.rows.length > 0) {
      return { mode: 'enforced', allowed: true }
    }

    // Check CSW ownership (session is owner of an allowlisted CSW)
    const cswQ = await db.query(
      `SELECT csw_address FROM allowlist WHERE csw_address IS NOT NULL AND revoked_at IS NULL LIMIT 50;`,
      [],
    )
    if (Array.isArray(cswQ.rows)) {
      for (const row of cswQ.rows) {
        const csw = row.csw_address as string
        if (csw && isAddress(csw)) {
          const isOwner = await checkCswOwnership(params.sessionAddress, getAddress(csw))
          if (isOwner) return { mode: 'enforced', allowed: true }
        }
      }
    }

    // Check linked wallets
    const linkedQ = await db.query(
      `SELECT wallet_address FROM creator_wallets WHERE LOWER(wallet_address) = ANY($1) LIMIT 1;`,
      [addressFilters],
    ).catch(() => ({ rows: [] }))
    if (Array.isArray(linkedQ.rows) && linkedQ.rows.length > 0) {
      return { mode: 'enforced', allowed: true }
    }

    // Check waitlist signups
    const waitlistedQ = await db.query(
      `SELECT id FROM profiles
       WHERE (LOWER(primary_wallet) = ANY($1) OR LOWER(embedded_wallet) = ANY($1) OR LOWER(csw_address) = ANY($1))
         AND COALESCE(app_access_status, 'pending') = 'approved'
       LIMIT 1;`,
      [addressFilters],
    ).catch(() => ({ rows: [] }))
    if (Array.isArray(waitlistedQ.rows) && waitlistedQ.rows.length > 0) {
      return { mode: 'enforced', allowed: true }
    }

    return { mode: 'enforced', allowed: false }
  }

  // Fallback (no DB): env allowlist (legacy/simple).
  const allowlist = parseAllowlist(process.env.CREATOR_ALLOWLIST)
  const mode: AllowlistMode = allowlist.size > 0 ? 'enforced' : 'disabled'
  const allowed = mode === 'disabled' ? true : allowlist.has(addr)
  return { mode, allowed }
}

async function assertCreatorAllowlisted(params: { sessionAddress: Address; creatorToken?: Address | null }): Promise<void> {
  const { mode, allowed } = await isCreatorAllowlisted(params)
  if (mode === 'enforced' && !allowed) throw new Error('not_allowlisted')
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function getCdpEndpoint(): string | null {
  const v =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    // Back-compat with repo root .env.example naming
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  return v.length > 0 ? v : null
}

function isRequestArray(body: unknown): body is JsonRpcRequest[] {
  return Array.isArray(body)
}

function isRequestObject(body: unknown): body is JsonRpcRequest {
  return !!body && typeof body === 'object' && !Array.isArray(body)
}

function isHexString(v: unknown): v is Hex {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)
}

function getSelector(data: Hex): string {
  return data.length >= 10 ? data.slice(0, 10).toLowerCase() : ''
}

function decodeAddressArgFromCalldata(data: Hex, argIndex: number): Address | null {
  // abi.encodeWithSelector packs selector (4) + each arg in 32 byte slots
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  const addr = `0x${word.slice(24)}` // last 20 bytes
  if (!isAddress(addr)) return null
  return getAddress(addr)
}

function decodeAddressArgFromAbiEncodedBytes(data: Hex, argIndex: number): Address | null {
  // abi.encode packs each arg in 32 byte slots (no selector).
  const start = 2 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  const addr = `0x${word.slice(24)}` // last 20 bytes
  if (!isAddress(addr)) return null
  return getAddress(addr)
}

function expectedPayoutRouterSalt(params: { creatorToken: Address; sender: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [PAYOUT_ROUTER_SALT_TAG, params.creatorToken, params.sender]),
  )
}

function expectedBurnStreamSalt(params: { creatorToken: Address; sender: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [BURN_STREAM_SALT_TAG, params.creatorToken, params.sender]),
  )
}

function decodeBoolArgFromCalldata(data: Hex, argIndex: number): boolean | null {
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  try {
    const v = BigInt(`0x${word}`)
    if (v === 0n) return false
    if (v === 1n) return true
    // Non-canonical bool encoding; treat as invalid.
    return null
  } catch {
    return null
  }
}

function abiEncodeAddresses(addrs: Address[]): Hex {
  // abi.encode(address...) (static types only)
  // Each address is left-padded to 32 bytes.
  let out = '0x'
  for (const a of addrs) {
    const hex = a.toLowerCase().replace(/^0x/, '')
    out += '0'.repeat(24 * 2) + hex
  }
  return out as Hex
}

const BYTECODE_STORE_GET_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ name: 'creationCode', type: 'bytes' }],
  },
] as const

const _creationCodeCache: Map<string, Hex> = new Map()

async function getCreationCodeFromStore(params: { store: Address; codeId: Hex }): Promise<Hex> {
  const key = `${params.store.toLowerCase()}:${params.codeId.toLowerCase()}`
  const cached = _creationCodeCache.get(key)
  if (cached) return cached
  const client = await getBaseClient()
  const code = (await client.readContract({
    address: params.store,
    abi: BYTECODE_STORE_GET_ABI,
    functionName: 'get',
    args: [params.codeId],
  })) as Hex
  _creationCodeCache.set(key, code)
  return code
}

async function computeCreate2AddressFromStore(params: {
  store: Address
  deployer: Address
  salt: Hex
  codeId: Hex
  constructorArgs: Hex
}): Promise<Address> {
  const creationCode = await getCreationCodeFromStore({ store: params.store, codeId: params.codeId })
  const initCodeHash = keccak256(concatHex([creationCode, params.constructorArgs]))
  return getCreate2Address({ from: params.deployer, salt: params.salt, bytecodeHash: initCodeHash })
}

function enforceRateLimit(key: string) {
  const now = Date.now()
  const cur = rateLimitBuckets.get(key)
  if (!cur || now >= cur.resetAtMs) {
    rateLimitBuckets.set(key, { count: 1, resetAtMs: now + RATE_LIMIT_WINDOW_MS })
    return
  }
  cur.count += 1
  if (cur.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('rate_limited')
  }
}

function parseChainId(chainIdRaw: unknown): number | null {
  if (typeof chainIdRaw === 'number' && Number.isFinite(chainIdRaw)) return chainIdRaw
  if (typeof chainIdRaw === 'string') {
    const s = chainIdRaw.trim().toLowerCase()
    if (s.startsWith('0x')) {
      try {
        return Number(BigInt(s))
      } catch {
        return null
      }
    }
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return null
}

function extractUserOpAndEntryPoint(method: string, params: unknown): { userOp: UserOperation; entryPoint: Address; chainId: number | null } | null {
  if (!Array.isArray(params) || params.length < 2) return null
  const userOp = (params[0] ?? {}) as UserOperation
  const entryPointRaw = params[1]
  const chainIdRaw = method === 'pm_getPaymasterStubData' || method === 'pm_getPaymasterData' ? params[2] : null
  const chainId = parseChainId(chainIdRaw)
  if (typeof entryPointRaw !== 'string' || !isAddress(entryPointRaw)) return null
  return { userOp, entryPoint: getAddress(entryPointRaw), chainId }
}

async function assertSessionOwnsSender(params: { sender: Address; sessionAddress: Address; initCode: Hex | null; factory?: Address | null; factoryData?: Hex | null }) {
  const client = await getBaseClient()

  // Deployed accounts: verify onchain ownership.
  const code = await client.getBytecode({ address: params.sender })
  if (code && code !== '0x') {
    const isOwner = await client.readContract({
      address: params.sender,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [params.sessionAddress],
    })
    if (!isOwner) throw new Error('not_owner')
    return
  }

  // Counterfactual accounts: validate initCode against known Coinbase factory + owners.
  const initCode = params.initCode
  if (!initCode || initCode === '0x') throw new Error('sender_not_deployed')
  if (!isHexString(initCode) || initCode.length < 42) throw new Error('invalid_init_code')

  const factoryRaw = initCode.slice(0, 42)
  if (!isAddress(factoryRaw)) throw new Error('invalid_factory')
  const factory = getAddress(factoryRaw)
  if (!COINBASE_SMART_WALLET_FACTORIES.has(factory)) throw new Error('factory_not_allowed')

  const factoryData = (`0x${initCode.slice(42)}` || '0x') as Hex
  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_FACTORY_ABI, data: factoryData })
  if (decoded.functionName !== 'createAccount') throw new Error('factory_calldata_not_allowed')

  const owners = decoded.args[0] as readonly Hex[]
  const nonce = decoded.args[1] as bigint
  const sessionLc = params.sessionAddress.toLowerCase().slice(2)
  const hasOwner = owners.some((o) => typeof o === 'string' && o.toLowerCase().startsWith('0x') && o.toLowerCase().slice(-40) === sessionLc)
  if (!hasOwner) throw new Error('not_owner')

  const expected = await client.readContract({
    address: factory,
    abi: COINBASE_SMART_WALLET_FACTORY_ABI,
    functionName: 'getAddress',
    args: [owners as any, nonce],
  })
  if (getAddress(expected as Address) !== params.sender) throw new Error('sender_address_mismatch')
}

async function validateInnerCalls(params: {
  sender: Address
  sessionAddress: Address
  callData: Hex
  deploySessionOwner?: Address | null
}): Promise<{ expectedCreatorToken: Address }> {
  const contracts = getApiContracts()
  if (!contracts.creatorVaultBatcher) throw new Error('creator_vault_batcher_not_configured')
  const creatorVaultBatcher = getAddress(contracts.creatorVaultBatcher)
  const vaultActivationBatcher = getAddress(contracts.vaultActivationBatcher)
  const permit2 = getAddress(contracts.permit2)
  const create2DeployerFromStoreRaw = contracts.universalCreate2DeployerFromStore
  if (!create2DeployerFromStoreRaw) throw new Error('create2_deployer_from_store_not_configured')
  const create2DeployerFromStore = getAddress(create2DeployerFromStoreRaw)

  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: params.callData })
  const innerCalls: InnerCall[] =
    decoded.functionName === 'execute'
      ? [
          {
            target: getAddress(decoded.args[0] as Address),
            value: decoded.args[1] as bigint,
            data: decoded.args[2] as Hex,
          },
        ]
      : decoded.functionName === 'executeBatch'
        ? (decoded.args[0] as any[]).map((c: any) => ({
            target: getAddress(c.target as Address),
            value: BigInt(c.value),
            data: c.data as Hex,
          }))
        : []

  if (innerCalls.length === 0) throw new Error('no_inner_calls')
  for (const c of innerCalls) {
    if (c.value !== 0n) throw new Error('value_transfer_not_allowed')
  }

  // Pass 1: detect the "primary" token from the deploy/activate call.
  let mode: 'deploy_phase1' | 'deploy_phase2' | 'deploy_phase3' | 'launch_auction' | 'deploy' | 'activate' | 'approve_only' | null = null
  let expectedCreatorToken: Address | null = null
  let expectedVault: Address | null = null
  let expectedWrapper: Address | null = null
  let expectedShareOFT: Address | null = null
  let expectedCodeIds: { vault: Hex } | null = null
  let expectedVersion: string | null = null

  for (const c of innerCalls) {
    const selector = getSelector(c.data)
    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      let creatorToken: Address | null = null
      let owner: Address | null = null

      // Phase-based functions encode params as a tuple (with strings/bytes), so decode via ABI.
      if (
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1 ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_CORE ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2 ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES ||
        selector === SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION
      ) {
        let decodedBatcher: any
        try {
          decodedBatcher = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE_ABI as any, data: c.data })
        } catch {
          throw new Error('batcher_decode_failed')
        }

        const p = decodedBatcher?.args?.[0]
        const codeIds = decodedBatcher?.args?.[1]
        creatorToken = p && isAddress(p.creatorToken) ? getAddress(p.creatorToken) : null
        owner = p && isAddress(p.owner) ? getAddress(p.owner) : null
        if (!creatorToken || !owner) throw new Error('batcher_decode_failed')
        if (owner !== params.sender) throw new Error('batcher_owner_mismatch')

        if (selector === SELECTOR_BATCHER_DEPLOY_PHASE1 || selector === SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT) {
          mode = 'deploy_phase1'
        } else if (
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_CORE ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE2
        ) {
          mode = 'deploy_phase2'
          expectedVault = p && isAddress(p.vault) ? getAddress(p.vault) : null
          expectedWrapper = p && isAddress(p.wrapper) ? getAddress(p.wrapper) : null
          expectedShareOFT = p && isAddress(p.shareOFT) ? getAddress(p.shareOFT) : null
          if (!expectedVault) throw new Error('batcher_vault_decode_failed')
          expectedCodeIds =
            codeIds && typeof codeIds === 'object' && isHexString(codeIds.vault)
              ? { vault: codeIds.vault as Hex }
              : null
          expectedVersion = typeof p?.version === 'string' ? p.version : null
        } else if (selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES) {
          mode = 'deploy_phase3'
          expectedVault = p && isAddress(p.vault) ? getAddress(p.vault) : null
          if (!expectedVault) throw new Error('batcher_vault_decode_failed')
        } else if (selector === SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION) {
          mode = 'launch_auction'
        }
      } else {
        // Legacy one-call deploy functions have owner/creatorToken as the first two static args.
        creatorToken = decodeAddressArgFromCalldata(c.data, 0)
        owner = decodeAddressArgFromCalldata(c.data, 1)
        if (!creatorToken || !owner) throw new Error('batcher_decode_failed')
        if (owner !== params.sender) throw new Error('batcher_owner_mismatch')
        mode = 'deploy'
      }

      expectedCreatorToken = creatorToken
      break
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      const creatorToken =
        selector === SELECTOR_ACTIVATION_BATCH_ACTIVATE
          ? decodeAddressArgFromCalldata(c.data, 0)
          : decodeAddressArgFromCalldata(c.data, 1) // batchActivateWithPermit2For(identity, creatorToken, ...)
      if (!creatorToken) throw new Error('activation_decode_failed')
      mode = 'activate'
      expectedCreatorToken = creatorToken
      break
    }
  }

  if (!mode || !expectedCreatorToken) {
    const approveOnlyToken = (() => {
      if (innerCalls.length === 0) return null
      const firstTarget = innerCalls[0].target
      const allowedSpenders = new Set<Address>([creatorVaultBatcher, vaultActivationBatcher, permit2])
      const ok = innerCalls.every((c) => {
        if (c.target !== firstTarget) return false
        if (getSelector(c.data) !== SELECTOR_ERC20_APPROVE) return false
        const spender = decodeAddressArgFromCalldata(c.data, 0)
        return !!spender && allowedSpenders.has(spender)
      })
      return ok ? getAddress(firstTarget) : null
    })()

    if (approveOnlyToken) {
      mode = 'approve_only'
      expectedCreatorToken = approveOnlyToken
    } else {
      const sample = innerCalls
        .slice(0, 3)
        .map((c) => `${c.target}:${getSelector(c.data)}`)
        .join(',')
      throw new Error(
        `missing_primary_call(expectedBatcher=${creatorVaultBatcher},expectedActivation=${vaultActivationBatcher},seen=${sample})`,
      )
    }
  }

  const bytecodeStoreRaw = contracts.universalBytecodeStore
  if (!bytecodeStoreRaw) throw new Error('bytecode_store_not_configured')
  const bytecodeStore = getAddress(bytecodeStoreRaw)

  // In Phase 2, validate the vault address via CREATE2 inputs (salt + codeId + constructor args).
  // If codeIds are missing, fall back to the Phase1Deployed event for this creator/owner.
  let expectedBurnStream: Address | null = null
  let expectedPayoutRouter: Address | null = null
  if (mode === 'deploy_phase2') {
    if (!expectedVault) throw new Error('missing_vault')
    const client = await getBaseClient()
    const vaultCode = (await client.getBytecode({ address: expectedVault })) as Hex | undefined
    if (!vaultCode || vaultCode === '0x') throw new Error('vault_not_deployed')
    const asset = (await client.readContract({
      address: expectedVault,
      abi: ERC4626_ASSET_ABI,
      functionName: 'asset',
    }).catch(() => null)) as Address | null
    if (asset && getAddress(asset) !== getAddress(expectedCreatorToken as Address)) {
      throw new Error('vault_asset_mismatch')
    }
    const [vaultName, vaultSymbol] = (await Promise.all([
      client.readContract({ address: expectedVault, abi: ERC20_METADATA_ABI, functionName: 'name' }),
      client.readContract({ address: expectedVault, abi: ERC20_METADATA_ABI, functionName: 'symbol' }),
    ])) as [string, string]
    let vaultValidated = false
    const canValidateViaCreate2 =
      !!expectedCodeIds?.vault && expectedCodeIds.vault !== ZERO_BYTES32 && typeof expectedVersion === 'string'
    if (canValidateViaCreate2) {
      const vaultCodeId = expectedCodeIds?.vault
      const version = expectedVersion as string
      if (!vaultCodeId) throw new Error('missing_code_ids')
      const creationCode = (await client.readContract({
        address: bytecodeStore,
        abi: BYTECODE_STORE_ABI,
        functionName: 'get',
        args: [vaultCodeId],
      })) as Hex
      const constructorArgs = encodeAbiParameters(
        [
          { type: 'address', name: 'creatorToken' },
          { type: 'address', name: 'owner' },
          { type: 'string', name: 'name' },
          { type: 'string', name: 'symbol' },
        ],
        [getAddress(expectedCreatorToken as Address), getAddress(creatorVaultBatcher), vaultName, vaultSymbol],
      )
      const initCodeHash = keccak256(concatHex([creationCode, constructorArgs]))
      const baseSalt = keccak256(
        encodePacked(
          ['address', 'address', 'uint256', 'string', 'string'],
          [getAddress(expectedCreatorToken as Address), params.sender, BigInt(BASE_CHAIN_ID), 'CreatorVault:deploy:', version],
        ),
      )
      const vaultSalt = keccak256(encodePacked(['bytes32', 'string'], [baseSalt, 'vault']))
      const expectedVaultFromCreate2 = getCreate2Address({
        from: create2DeployerFromStore,
        salt: vaultSalt,
        bytecodeHash: initCodeHash,
      })
      vaultValidated = expectedVaultFromCreate2.toLowerCase() === expectedVault.toLowerCase()
      if (!vaultValidated) {
        logger.warn('[Paymaster] vault_address_mismatch', {
          expected: expectedVaultFromCreate2,
          actual: expectedVault,
          creatorToken: expectedCreatorToken,
          sender: params.sender,
        })
      }
    }

    if (!vaultValidated) {
      if (expectedWrapper && expectedShareOFT) {
        const [wrapperCreator, wrapperVault, wrapperShareOFT, wrapperOwner, shareOftVault, shareOftOwner] =
          (await Promise.all([
            client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'creatorCoin' }),
            client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'vault' }),
            client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' }),
            client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'owner' }),
            client.readContract({ address: expectedShareOFT, abi: SHARE_OFT_VIEW_ABI, functionName: 'vault' }),
            client.readContract({ address: expectedShareOFT, abi: SHARE_OFT_VIEW_ABI, functionName: 'owner' }),
          ]).catch(() => [])) as [Address, Address, Address, Address, Address, Address]
        const wrapperOk =
          wrapperCreator &&
          wrapperVault &&
          wrapperShareOFT &&
          wrapperOwner &&
          getAddress(wrapperCreator) === getAddress(expectedCreatorToken as Address) &&
          getAddress(wrapperVault) === getAddress(expectedVault) &&
          getAddress(wrapperShareOFT) === getAddress(expectedShareOFT) &&
          getAddress(wrapperOwner) === getAddress(creatorVaultBatcher)
        const shareOftOk =
          shareOftVault &&
          shareOftOwner &&
          getAddress(shareOftVault) === getAddress(expectedVault) &&
          getAddress(shareOftOwner) === getAddress(creatorVaultBatcher)
        if (wrapperOk && shareOftOk) {
          vaultValidated = true
        }
      }
    }

    if (!vaultValidated) {
      const phase1Logs = await client
        .getLogs({
          address: creatorVaultBatcher,
          event: CREATOR_VAULT_BATCHER_PHASE1_EVENT[0],
          args: { creatorToken: expectedCreatorToken as Address, owner: params.sender },
          fromBlock: 0n,
          toBlock: 'latest',
        })
        .catch(() => [])
      const matchedPhase1 = phase1Logs.some((log: any) => {
        const vault = log.args?.vault
        return vault && getAddress(vault) === expectedVault
      })
      if (!matchedPhase1) {
        throw new Error('vault_address_mismatch(phase1_event_miss)')
      }
    }

    const burnSalt = expectedBurnStreamSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
    expectedBurnStream = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: burnSalt,
      codeId: VAULT_SHARE_BURN_STREAM_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([expectedVault]),
    })

    const routerSalt = expectedPayoutRouterSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
    expectedPayoutRouter = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: routerSalt,
      codeId: PAYOUT_ROUTER_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([
        expectedCreatorToken,
        expectedVault,
        expectedBurnStream,
        params.sender,
        BASE_SWAP_ROUTER,
        BASE_WETH,
      ]),
    })
  }

  // Pass 2: validate each inner call fits the expected patterns.
  for (const c of innerCalls) {
    const selector = getSelector(c.data)

    // Self-calls (Coinbase Smart Wallet owner mgmt) for deploy-session automation.
    if (c.target === params.sender && ALLOWED_SELF_SELECTORS.has(selector)) {
      const decodedSelf = decodeFunctionData({ abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI, data: c.data })
      const allowInactiveForCleanup = decodedSelf.functionName === 'removeOwnerAtIndex'

      // Find the deploy session so we can bind the session owner address.
      const ds =
        params.deploySessionOwner && isAddress(params.deploySessionOwner)
          ? ({ sessionOwner: params.deploySessionOwner } as any)
          : await getActiveDeploySessionForSender({
              sessionAddress: params.sessionAddress,
              smartWallet: params.sender,
              includeExpired: allowInactiveForCleanup,
              includeFailed: allowInactiveForCleanup,
            })
      if (!ds?.sessionOwner || !isAddress(ds.sessionOwner)) throw new Error('deploy_session_missing')

      if (decodedSelf.functionName === 'addOwnerAddress') {
        const ownerArg = getAddress(decodedSelf.args[0] as Address)
        if (ownerArg !== getAddress(ds.sessionOwner as Address)) throw new Error('deploy_session_owner_mismatch')
        continue
      }
      if (decodedSelf.functionName === 'removeOwnerAtIndex') {
        const ownerBytes = decodedSelf.args[1] as Hex
        const expected = asOwnerBytes(getAddress(ds.sessionOwner as Address))
        if (String(ownerBytes).toLowerCase() !== String(expected).toLowerCase()) throw new Error('deploy_session_owner_mismatch')
        continue
      }

      throw new Error('selfcall_not_allowed')
    }

    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      continue
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      continue
    }

    if (c.target === permit2) {
      if (!ALLOWED_PERMIT2_SELECTORS.has(selector)) throw new Error('permit2_selector_not_allowed')
      const permit2Abi = [
        {
          type: 'function',
          name: 'permitTransferFrom',
          stateMutability: 'nonpayable',
          inputs: [
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
            {
              name: 'transferDetails',
              type: 'tuple',
              components: [
                { name: 'to', type: 'address' },
                { name: 'requestedAmount', type: 'uint256' },
              ],
            },
            { name: 'owner', type: 'address' },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const

      const decodedPermit2 = decodeFunctionData({ abi: permit2Abi, data: c.data })
      const permit = decodedPermit2.args[0] as any
      const details = decodedPermit2.args[1] as any
      const ownerArg = decodedPermit2.args[2] as Address
      if (getAddress(permit.permitted.token) !== expectedCreatorToken) throw new Error('permit2_token_mismatch')
      if (getAddress(details.to) !== params.sender) throw new Error('permit2_to_mismatch')
      if (getAddress(ownerArg) !== params.sessionAddress) throw new Error('permit2_owner_mismatch')
      continue
    }

    // Deterministic CREATE2 deploy via UniversalCreate2DeployerFromStore (used for burn stream + payout router).
    if (c.target === create2DeployerFromStore) {
      if (mode !== 'deploy_phase2') throw new Error('create2_deploy_not_allowed')
      if (!expectedVault || !expectedBurnStream || !expectedPayoutRouter) throw new Error('missing_expected_addresses')
      if (selector !== SELECTOR_CREATE2_DEPLOY_FROM_STORE) throw new Error('create2_selector_not_allowed')

      const create2Abi = [
        {
          type: 'function',
          name: 'deploy',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'salt', type: 'bytes32' },
            { name: 'codeId', type: 'bytes32' },
            { name: 'constructorArgs', type: 'bytes' },
          ],
          outputs: [{ name: 'addr', type: 'address' }],
        },
      ] as const

      const decodedDeploy = decodeFunctionData({ abi: create2Abi, data: c.data })
      if (decodedDeploy.functionName !== 'deploy') throw new Error('create2_decode_failed')

      const salt = decodedDeploy.args[0] as Hex
      const codeId = decodedDeploy.args[1] as Hex
      const ctorArgs = decodedDeploy.args[2] as Hex

      const codeIdLc = String(codeId).toLowerCase()
      if (codeIdLc === String(VAULT_SHARE_BURN_STREAM_CODE_ID).toLowerCase()) {
        const expectedSalt = expectedBurnStreamSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
        if (String(salt).toLowerCase() !== String(expectedSalt).toLowerCase()) throw new Error('create2_salt_not_allowed')
        const vaultArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 0)
        if (!vaultArg || vaultArg !== expectedVault) throw new Error('burn_stream_vault_mismatch')
      } else if (codeIdLc === String(PAYOUT_ROUTER_CODE_ID).toLowerCase()) {
        const expectedSalt = expectedPayoutRouterSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
        if (String(salt).toLowerCase() !== String(expectedSalt).toLowerCase()) throw new Error('create2_salt_not_allowed')

        // PayoutRouter constructor args:
        // constructor(address creatorCoin, address vault, address burnStream, address owner, address swapRouter, address weth)
        const creatorCoinArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 0)
        const vaultArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 1)
        const burnStreamArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 2)
        const ownerArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 3)
        const swapRouterArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 4)
        const wethArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 5)

        if (!creatorCoinArg || creatorCoinArg !== expectedCreatorToken) throw new Error('payout_router_creator_mismatch')
        if (!vaultArg || vaultArg !== expectedVault) throw new Error('payout_router_vault_mismatch')
        if (!burnStreamArg || burnStreamArg !== expectedBurnStream) throw new Error('payout_router_burn_stream_mismatch')
        if (!ownerArg || ownerArg !== params.sender) throw new Error('payout_router_owner_mismatch')
        if (!swapRouterArg || swapRouterArg !== BASE_SWAP_ROUTER) throw new Error('payout_router_swap_router_mismatch')
        if (!wethArg || wethArg !== BASE_WETH) throw new Error('payout_router_weth_mismatch')
      } else {
        throw new Error('create2_codeid_not_allowed')
      }

      continue
    }

    // Vault admin calls (phase2 only)
    if (mode === 'deploy_phase2' && expectedVault && expectedBurnStream && expectedPayoutRouter && c.target === expectedVault) {
      if (selector !== SELECTOR_VAULT_SET_BURN_STREAM && selector !== SELECTOR_VAULT_SET_WHITELIST) {
        throw new Error('vault_selector_not_allowed')
      }
      if (selector === SELECTOR_VAULT_SET_BURN_STREAM) {
        const burnStreamArg = decodeAddressArgFromCalldata(c.data, 0)
        if (!burnStreamArg || burnStreamArg !== expectedBurnStream) throw new Error('vault_burn_stream_mismatch')
      } else {
        const accountArg = decodeAddressArgFromCalldata(c.data, 0)
        const statusArg = decodeBoolArgFromCalldata(c.data, 1)
        if (!accountArg || accountArg !== expectedPayoutRouter) throw new Error('vault_whitelist_account_mismatch')
        if (statusArg !== true) throw new Error('vault_whitelist_status_mismatch')
      }
      continue
    }

    // Dynamic token calls: only allow calls to the same creatorToken used in the primary call.
    if (c.target !== expectedCreatorToken) throw new Error('called_address_not_allowed')
    if (!ALLOWED_TOKEN_SELECTORS.has(selector)) throw new Error('token_selector_not_allowed')

    if (selector === SELECTOR_ERC20_APPROVE) {
      const spender = decodeAddressArgFromCalldata(c.data, 0)
      if (!spender) throw new Error('approve_decode_failed')
      const allowedSpenders = new Set<Address>([creatorVaultBatcher, vaultActivationBatcher, permit2])
      if (!allowedSpenders.has(spender)) throw new Error('approve_spender_not_allowed')
      continue
    }

    if (selector === SELECTOR_COIN_SET_PAYOUT_RECIPIENT) {
      if (mode !== 'deploy_phase2' || !expectedPayoutRouter) throw new Error('payout_recipient_not_allowed')
      const recipient = decodeAddressArgFromCalldata(c.data, 0)
      if (!recipient || recipient !== expectedPayoutRouter) throw new Error('payout_recipient_mismatch')
      continue
    }
  }

  return { expectedCreatorToken }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    // Keep JSON-RPC clients happy (avoid transport-level failure masking).
    return res.status(200).json(jsonRpcError(null, -32600, 'Method not allowed'))
  }

  const cdpEndpoint = getCdpEndpoint()
  if (!cdpEndpoint) {
    return res.status(200).json(jsonRpcError(null, -32000, 'CDP paymaster endpoint is not configured'))
  }

  // In production serverless, SIWE sessions MUST be signed with a stable secret.
  // If this is unset, /api/auth/verify and /api/paymaster may run on different instances and
  // the paymaster will always see "not authenticated".
  const sessionSecret = (process.env.AUTH_SESSION_SECRET ?? '').trim()
  const isVercel = Boolean((process.env.VERCEL ?? '').trim())
  if (isVercel && sessionSecret.length < 16) {
    return res.status(200).json(jsonRpcError(null, -32000, 'Server misconfigured: AUTH_SESSION_SECRET is not set'))
  }

  const body = await readJsonBody<unknown>(req)
  if (!body) {
    return res.status(200).json(jsonRpcError(null, -32600, 'Invalid JSON body'))
  }

  const requests: JsonRpcRequest[] = isRequestArray(body) ? body : isRequestObject(body) ? [body] : []
  if (requests.length === 0) {
    return res.status(200).json(jsonRpcError(null, -32600, 'Invalid JSON-RPC payload'))
  }

  for (const r of requests) {
    const method = typeof r?.method === 'string' ? r.method : ''
    if (!method) {
      return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32600, 'Missing method'))
    }
    if (!ALLOWED_METHODS.has(method)) {
      return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32601, `Method not allowed: ${method}`))
    }
  }

  // Require an active session for any sponsorship-related method.
  // - Primary: SIWE session (cookie or Authorization bearer token).
  // - Secondary: deploy-session token (server-driven completion after one user signature).
  const session = readSessionFromRequest(req)

  try {
    // Validate sponsorship requests (UserOperations only).
    for (const r of requests) {
      const method = r.method as string
      if (!METHODS_REQUIRING_USEROP.has(method)) continue
      const extracted = extractUserOpAndEntryPoint(method, r.params)
      if (!extracted) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid params'))
      }

      if (extracted.entryPoint !== ENTRYPOINT_V06) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported entryPoint'))
      }
      if (typeof extracted.chainId === 'number' && extracted.chainId !== BASE_CHAIN_ID) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported chainId'))
      }

      const senderRaw = extracted.userOp?.sender
      const callDataRaw = extracted.userOp?.callData
      const initCodeRaw = extracted.userOp?.initCode
      if (typeof senderRaw !== 'string' || !isAddress(senderRaw)) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.sender'))
      }
      if (!isHexString(callDataRaw) || callDataRaw === '0x') {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.callData'))
      }

      const sender = getAddress(senderRaw)

      let sessionAddress: Address | null = null
      let deploySessionOwner: Address | null = null
      let allowCleanupOnlyForInactiveDeploySession = false

      if (session?.address) {
        sessionAddress = getAddress(session.address)
      } else {
        const hdr = readDeploySessionHeaders(req)
        if (!hdr) throw new Error('no_session')
        // Ensure header signature matches (prevents leaked DB token from being used externally).
        if (signDeployToken(hdr.token) !== hdr.signature) throw new Error('invalid_deploy_session_signature')
        const ds = await getDeploySessionByTokenHash(hashDeployToken(hdr.token))
        if (!ds) throw new Error('no_session')
        const expired = Date.parse(ds.expiresAt) <= Date.now()
        const failed = ds.step === 'failed'
        const completed = ds.step === 'completed'
        if (completed) throw new Error('deploy_session_inactive')
        // Allow cleanup-only requests even if the deploy session is expired/failed.
        allowCleanupOnlyForInactiveDeploySession = expired || failed
        sessionAddress = getAddress(ds.sessionAddress)
        deploySessionOwner = getAddress(ds.sessionOwner)
      }

      if (!sessionAddress) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - not authenticated'))
      }

      // Basic rate limit: per session address.
      enforceRateLimit(sessionAddress)
      const initCode = isHexString(initCodeRaw) ? (initCodeRaw as Hex) : null

      // If this is a server-driven deploy session request, also ensure the session owner is installed.
      if (deploySessionOwner) {
        const client = await getBaseClient()
        const ok = await client.readContract({
          address: sender,
          abi: COINBASE_SMART_WALLET_OWNER_ABI,
          functionName: 'isOwnerAddress',
          args: [deploySessionOwner],
        })
        if (!ok) throw new Error('deploy_session_owner_not_installed')
      }

      // Ensure this session is an onchain owner of the Coinbase Smart Wallet sender.
      await assertSessionOwnsSender({ sender, sessionAddress, initCode })

      // Validate inner calls match CreatorVault patterns.
      let expectedCreatorToken: Address | null = null
      if (allowCleanupOnlyForInactiveDeploySession && deploySessionOwner) {
        // Special-case: allow only `removeOwnerAtIndex` self-call for the recorded deploy session owner.
        const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: callDataRaw })
        const innerCalls: InnerCall[] =
          decoded.functionName === 'execute'
            ? [
                {
                  target: getAddress(decoded.args[0] as Address),
                  value: decoded.args[1] as bigint,
                  data: decoded.args[2] as Hex,
                },
              ]
            : decoded.functionName === 'executeBatch'
              ? (decoded.args[0] as any[]).map((c: any) => ({
                  target: getAddress(c.target as Address),
                  value: BigInt(c.value),
                  data: c.data as Hex,
                }))
              : []
        if (innerCalls.length === 0) throw new Error('no_inner_calls')
        for (const c of innerCalls) {
          if (c.value !== 0n) throw new Error('value_transfer_not_allowed')
          if (c.target !== sender) throw new Error('cleanup_only_violation')
          if (getSelector(c.data) !== SELECTOR_CSW_REMOVE_OWNER_AT_INDEX) throw new Error('cleanup_only_violation')
          const decodedSelf = decodeFunctionData({ abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI, data: c.data })
          if (decodedSelf.functionName !== 'removeOwnerAtIndex') throw new Error('cleanup_only_violation')
          const ownerBytes = decodedSelf.args[1] as Hex
          const expected = asOwnerBytes(getAddress(deploySessionOwner))
          if (String(ownerBytes).toLowerCase() !== String(expected).toLowerCase()) throw new Error('deploy_session_owner_mismatch')
        }
      } else {
        const validated = await validateInnerCalls({ sender, sessionAddress, callData: callDataRaw, deploySessionOwner })
        expectedCreatorToken = validated.expectedCreatorToken
      }

      // Only sponsor approved creators (Supabase/Postgres allowlist).
      await assertCreatorAllowlisted({ sessionAddress, creatorToken: expectedCreatorToken })
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - rate limited'))
    }
    if (err instanceof Error && err.message === 'not_allowlisted') {
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - creator not approved'))
    }
    if (err instanceof Error && err.message === 'allowlist_check_failed') {
      logger.error('[paymaster-proxy] allowlist check failed')
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - allowlist unavailable'))
    }
    const msg = err instanceof Error ? err.message : 'request denied'
    logger.warn('[paymaster-proxy] validation denied', { msg })
    return res.status(200).json(jsonRpcError(null, -32002, `request denied - ${msg}`))
  }

  // Forward to CDP if validation passed.
  try {
    const upstream = await fetch(cdpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()

    // CDP returns JSON-RPC responses. Some clients (viem) treat non-2xx HTTP as transport failures
    // and mask the JSON-RPC error. Prefer returning HTTP 200 with the JSON-RPC payload when possible.
    res.setHeader('Content-Type', 'application/json')
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        return res.status(200).send(JSON.stringify(parsed))
      }
    } catch {
      // Non-JSON response; fall back to upstream status.
    }
    res.status(upstream.status)
    return res.send(text)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upstream request failed'
    logger.error('[paymaster-proxy] upstream error', { msg })
    return res.status(502).json(jsonRpcError(null, -32000, msg))
  }
}
