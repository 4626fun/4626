// Pure helpers, types, ABIs, and on-chain read helpers extracted from
// AdminOps.tsx. Nothing here renders React. Side effects are limited to
// RPC reads through the injected publicClient and structured logging.

import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseAbiItem,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'wagmi/chains'

import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { appendBuilderSuffixToHex } from '@/lib/base/baseBuilderCodes'
import { CONTRACTS } from '@/config/contracts'
import { logger } from '@/lib/observability/logger'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Canonical smart wallet — alias of CANONICAL_CSW_ADDRESS from canonicalWalletPolicy.
export { CANONICAL_CSW_ADDRESS as CANONICAL_SMART_WALLET } from '@/wallet/canonicalWalletPolicy'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
// NOTE:
// On-chain `agentURI` should be validator-compatible. Some validators do not
// support lens:// directly, so prefer gateway https URLs, ipfs://, ar://, or data:.
export const ERC8004_AGENT_URI_DEFAULT = ''
export const ERC8004_AGENT_URI_PLACEHOLDER =
  'https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,...'

// ---------------------------------------------------------------------------
// Agent URI validation
// ---------------------------------------------------------------------------

export function isStrictContentAddressedAgentUri(uri: string): boolean {
  const u = uri.trim().toLowerCase()
  return u.startsWith('ipfs://') || u.startsWith('data:') || u.startsWith('ar://')
}

export function normalizeAllowlistedHost(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/\.+$/g, '')
  if (!normalized) return ''
  if (normalized.startsWith('*.')) return `.${normalized.slice(2)}`
  return normalized
}

export const AGENT_URI_HTTPS_ALLOWLIST = new Set(
  String(import.meta.env.VITE_AGENT_URI_HTTPS_ALLOWLIST ?? '')
    .split(/[\s,]+/g)
    .map((entry) => normalizeAllowlistedHost(entry))
    .filter(Boolean),
)

export function isAllowlistedHttpsAgentUri(uri: string): boolean {
  if (AGENT_URI_HTTPS_ALLOWLIST.size === 0) return false
  let parsed: URL
  try {
    parsed = new URL(uri.trim())
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const hostname = normalizeAllowlistedHost(parsed.hostname)
  if (!hostname) return false
  for (const allowedHost of AGENT_URI_HTTPS_ALLOWLIST) {
    if (allowedHost.startsWith('.')) {
      const suffix = allowedHost.slice(1)
      if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return true
      continue
    }
    if (hostname === allowedHost) return true
  }
  return false
}

export function isContentAddressedAgentUri(uri: string): boolean {
  return isStrictContentAddressedAgentUri(uri) || isAllowlistedHttpsAgentUri(uri)
}

export function agentUriValidationMessage(): string {
  if (AGENT_URI_HTTPS_ALLOWLIST.size > 0) {
    return 'Agent URI must be ipfs://, ar://, data:, or an https:// URL on the VITE_AGENT_URI_HTTPS_ALLOWLIST.'
  }
  return 'Agent URI must be strict content-addressed (ipfs://, ar://, or data:). HTTPS/http and lens:// are blocked for on-chain writes.'
}

// ---------------------------------------------------------------------------
// Legacy vault registry
// ---------------------------------------------------------------------------

export type LegacyVaultHint = {
  id: string
  label: string
  vault?: string
  wrapper?: string
  shareOft?: string
  vesting?: string
  vaultHint?: string
}

export type LegacyVaultResolved = {
  id: string
  label: string
  vault: string
  wrapper: string
  shareOft: string
  vesting: string
  vaultHint?: string
  resolvedFrom: 'static' | 'registry' | 'unknown'
}

export const LEGACY_STATIC_VAULT_HINTS: LegacyVaultHint[] = [
  {
    id: 'legacy-1',
    label: 'Legacy ShareOFT (0x5f65…)',
    shareOft: '0x5F65ADef2F587AA228a1F37e9FAD0370defe4626',
    wrapper: '0x349fFADbF1ea15f72608cF9EC6a776D985fD7DeC',
    vault: '0x51E8Eaa4366C83b012F19Df44e6Fa3A8ac5d699e',
    vesting: '0xf98a12a31c677788025a7a141ee050c2e3f861c6',
  },
  {
    id: 'legacy-2',
    label: 'Legacy ShareOFT (0x25f6…)',
    shareOft: '0x25f61d3F2CAaF96974e7ea5A8b499b0617b94626',
    wrapper: '0xcd66e39a575495164680a3583ffc5cfa81cb971e',
    vault: '0x62f30a8815C1EBF8639d554f17E4200832F0Ba77',
    vesting: '0x35f40efa13748560715af00af8abc221bab2fe07',
  },
  {
    id: 'legacy-3',
    label: 'Legacy vault (0x2648…2D75)',
    vault: '0x264855c322db4224ddb3aa84f1d64392d7537cb6',
    wrapper: '0x772f102B8747C70aFDd1A616bBa22a6C8286A026',
    shareOft: '0xbbBA5b9c70D2edEf732f1DeA19Cca0e36789e69d',
    vaultHint: '0x264855c3...2D7537CB6',
  },
  {
    id: 'legacy-4',
    label: 'Legacy vault (0xcF30…91d0)',
    vault: '0xcf30b1e8c682a2adcede2b22601b75f54ed91d0c',
    wrapper: '0xE7675FA61c4431194481F3Fb31d1e4a73177eE6C',
    shareOft: '0x7DDe0A769Aeda835fC441f66B271678661dD4626',
    vesting: '0xE40c781BaCE1282D1B721FBa2Ff86B6F8fe94Ad9',
    vaultHint: '0xcF30B1e8...54ED91d0C',
  },
  {
    id: 'legacy-5',
    label: 'Legacy vault (0xc8A5…0EBD)',
    vault: '0xc8A5093d7613E9c0998d2070dF94904d4Ff0EBD4',
    wrapper: '0x9BEA3CA394d8E10E7151426757CED860E9f9917D',
    shareOft: '0xF7202bd063C3BBBB8cEf106511bD2DD2ec204626',
    vesting: '0x7A9980F8bdc840Eba8bF6Dc6081A8df7e78A46aB',
    vaultHint: '0xc8A5093d...d4Ff0EBD4',
  },
]

export const LEGACY_DYNAMIC_SLOT_COUNT = 8

export const LEGACY_DYNAMIC_VAULT_HINTS: LegacyVaultHint[] = Array.from(
  { length: LEGACY_DYNAMIC_SLOT_COUNT },
  (_, index) => ({
    id: `legacy-auto-${index + 1}`,
    label: `Recovered deployment slot #${index + 1}`,
  }),
)

export const LEGACY_DYNAMIC_HINT_IDS = LEGACY_DYNAMIC_VAULT_HINTS.map((hint) => hint.id)

export const LEGACY_VAULT_HINTS: LegacyVaultHint[] = [
  ...LEGACY_STATIC_VAULT_HINTS,
  ...LEGACY_DYNAMIC_VAULT_HINTS,
]

export function parseVaultHint(hint?: string): { prefix: string; suffix: string } | null {
  if (!hint) return null
  const raw = hint.trim()
  if (!raw) return null
  if (isAddress(raw)) return { prefix: raw.toLowerCase(), suffix: '' }
  const parts = raw.split('...')
  if (parts.length !== 2) return null
  const prefix = parts[0]!.trim().toLowerCase()
  const suffix = parts[1]!.trim().toLowerCase()
  if (!prefix || !suffix) return null
  return { prefix, suffix }
}

export function matchVaultHint(hint: string | undefined, vaults: string[]): string | null {
  const parsed = parseVaultHint(hint)
  if (!parsed) return null
  if (parsed.suffix === '' && isAddress(parsed.prefix)) return parsed.prefix
  const matches = vaults.filter((vault) => vault.startsWith(parsed.prefix) && vault.endsWith(parsed.suffix))
  return matches.length === 1 ? matches[0] ?? null : null
}

export function getLegacyVestingStartBlock(): bigint {
  const raw = import.meta.env.VITE_BASE_VESTING_START_BLOCK as string | undefined
  if (!raw) return 15_000_000n
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 15_000_000n
  return BigInt(Math.floor(n))
}

// ---------------------------------------------------------------------------
// ABIs + events
// ---------------------------------------------------------------------------

export const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getAllCreatorCoins',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getCreatorCoin',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'vault', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'gaugeController', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'pool', type: 'address' },
      { name: 'poolFee', type: 'uint24' },
      { name: 'primaryChainId', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
  },
] as const

export const CREATOR_SHARE_VESTING_EVENT = parseAbiItem(
  'event CreatorShareVestingDeployed(address indexed shareOFT, address indexed beneficiary, address vesting, uint256 amount, uint64 startTimestamp, uint64 durationSeconds)',
)
export const PHASE1_DEPLOYED_EVENT = parseAbiItem(
  'event Phase1Deployed(address indexed creatorToken, address indexed owner, address oftBootstrapRegistry, address vault, address wrapper, address shareOFT)',
)

export const VESTING_ABI = [
  { name: 'releasable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'release', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'beneficiary', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

export const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { name: 'setAgentURI', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newURI', type: 'string' }], outputs: [] },
  { name: 'setAgentWallet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newWallet', type: 'address' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { name: 'unsetAgentWallet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [] },
  { name: 'setMetadata', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'metadataKey', type: 'string' }, { name: 'metadataValue', type: 'bytes' }], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getAgentWallet', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getMetadata', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'metadataKey', type: 'string' }], outputs: [{ type: 'bytes' }] },
] as const

export const ERC8004_REGISTERED_EVENT = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
)

export const SHARE_OFT_METADATA_ABI = [
  { name: 'contractURI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'setContractURI', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'uri', type: 'string' }], outputs: [] },
] as const

export const WRAPPER_ABI = [
  { name: 'unwrap', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

export const VAULT_ABI = [
  {
    name: 'queueWithdrawal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  { name: 'claimQueuedWithdrawal', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  { name: 'previewRedeem', type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'largeWithdrawalThreshold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export const VAULT_EMERGENCY_ABI = [
  { name: 'asset', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'isShutdown', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'shutdownVault', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'emergencyWithdrawFromStrategies', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'emergencyWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
] as const

export const QUEUED_WITHDRAWAL_ABI = [
  {
    name: 'queuedWithdrawals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'unlockBlock', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
  },
] as const

export const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
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

// ---------------------------------------------------------------------------
// Tx formatting + error diagnostics
// ---------------------------------------------------------------------------

export type TxState = {
  status: 'idle' | 'pending' | 'success' | 'error'
  hash?: `0x${string}` | null
  error?: string
}

export function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatToken(value: bigint | undefined): string {
  if (value === undefined) return '—'
  const raw = formatUnits(value, 18)
  return raw.replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1')
}

export function parseAmount(input: string): bigint | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const amount = parseUnits(raw, 18)
    return amount > 0n ? amount : null
  } catch {
    return null
  }
}

export function buildTxHref(hash?: string): string | null {
  if (!hash) return null
  return `https://basescan.org/tx/${hash}`
}

export function shouldFallbackToOwnerDirectExecute(error: unknown): boolean {
  const msg = String((error as { shortMessage?: unknown; message?: unknown } | null)?.shortMessage || (error as { message?: unknown } | null)?.message || error || '').toLowerCase()
  const userRejected =
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('user cancelled') ||
    msg.includes('action_rejected')
  if (userRejected) return false
  // Direct executeBatch cannot recover owner-link/signature-authority failures.
  if (msg.includes('invalid wallet sig') || msg.includes('not an onchain owner')) return false
  return (
    (msg.includes('method not supported') && msg.includes('eth_sign')) ||
    msg.includes('eth_sign is required for this wallet owner') ||
    msg.includes('verificationgaslimit') ||
    msg.includes('aa40') ||
    msg.includes("didn't pay prefund") ||
    msg.includes('request denied -') ||
    msg.includes('request exceeds defined limit') ||
    msg.includes('rate limit exceeded') ||
    msg.includes('paymaster unavailable') ||
    msg.includes('sponsorship')
  )
}

export function extractMetaMessages(error: unknown): string | null {
  const seen = new Set<unknown>()
  const queue: unknown[] = [error]
  const out: string[] = []

  while (queue.length > 0 && out.length < 6) {
    const item = queue.shift()
    if (!item || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)

    const anyItem = item as { metaMessages?: unknown; cause?: unknown }
    const meta = anyItem?.metaMessages
    if (Array.isArray(meta)) {
      for (const m of meta) {
        const text = typeof m === 'string' ? m : JSON.stringify(m)
        const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
        if (normalized) out.push(normalized)
        if (out.length >= 6) break
      }
    }

    if (anyItem?.cause) queue.push(anyItem.cause)
  }

  if (out.length === 0) return null
  const limited = out.slice(0, 3)
  return `${limited.join(' | ')}${out.length > limited.length ? ' | ...' : ''}`
}

export function summarizeErrorReason(error: unknown): string {
  const err = error as {
    shortMessage?: unknown
    details?: unknown
    message?: unknown
    cause?: { shortMessage?: unknown; message?: unknown }
  } | null
  const candidate =
    err?.shortMessage ||
    err?.details ||
    err?.message ||
    err?.cause?.shortMessage ||
    err?.cause?.message ||
    String(error ?? 'Unknown error')
  const base = String(candidate || 'Unknown error').replace(/\s+/g, ' ').trim()
  const meta = extractMetaMessages(error)
  const text = meta ? `${base} (CDP: ${meta})` : base
  return text.length > 560 ? `${text.slice(0, 557)}...` : text
}

export function toFriendlyTxError(error: unknown): string {
  const msg = summarizeErrorReason(error)
  const lower = msg.toLowerCase()
  if (
    lower.includes('gas required exceeds allowance (0)') ||
    lower.includes("didn't pay prefund") ||
    lower.includes('sender balance and deposit together') ||
    lower.includes('insufficient funds for gas')
  ) {
    return (
      'Gas sponsorship failed, and the owner wallet has no usable Base ETH for direct fallback. ' +
      'Refresh authentication to restore sponsorship, or fund the owner wallet before retrying.'
    )
  }
  if (lower.includes('reserved key')) {
    return (
      'Identity Registry reserves the `agentWallet` metadata key. ' +
      'Use `setAgentWallet()` for authoritative wallet binding and keep the off-chain registration `agentWallet` service in CAIP-10 format.'
    )
  }
  if (lower.includes('bind requires a canonical csw signature')) {
    return (
      'Bind requires a canonical CSW signature, but no canonical CSW signer is available in this session. ' +
      'Connect the canonical CSW directly, or sign in with Privy smart wallet (4626.fun). ' +
      'If Privy wallet init is failing, clear site storage (FILE_ERROR_NO_SPACE) and re-auth.'
    )
  }
  if (lower.includes('invalid wallet sig')) {
    return 'Invalid wallet signature. setAgentWallet must be signed by the canonical CSW (ERC-1271), not only the owner EOA.'
  }
  if (lower.includes('requested resource not available') || lower.includes('resource not available')) {
    return 'Bundler endpoint does not support ERC-4337 methods. Set `VITE_CDP_BUNDLER_URL` and retry.'
  }
  return msg
}

// ---------------------------------------------------------------------------
// Legacy vault on-chain helpers
// ---------------------------------------------------------------------------

export async function fetchLegacyVesting(
  publicClient: any,
  shareOft: Address,
  beneficiary: Address,
): Promise<Address | null> {
  const batcher = CONTRACTS.creatorVaultBatcher
  if (!batcher || !isAddress(batcher)) return null
  try {
    const logs = await publicClient.getLogs({
      address: batcher as Address,
      event: CREATOR_SHARE_VESTING_EVENT,
      args: { shareOFT: shareOft, beneficiary },
      fromBlock: getLegacyVestingStartBlock(),
      toBlock: 'latest',
    })
    const log = logs[logs.length - 1]
    const vesting = (log?.args as { vesting?: unknown } | undefined)?.vesting as Address | undefined
    return vesting && isAddress(vesting) ? vesting : null
  } catch {
    return null
  }
}

export async function fetchLegacyPhase1Map(
  publicClient: any,
  owner?: Address,
): Promise<Map<string, { vault: Address; wrapper: Address; shareOft: Address }>> {
  const batcher = CONTRACTS.creatorVaultBatcher
  if (!batcher || !isAddress(batcher)) return new Map()
  try {
    const filterArgs = owner && isAddress(owner) ? { owner } : undefined
    const logs = await publicClient.getLogs({
      address: batcher as Address,
      event: PHASE1_DEPLOYED_EVENT,
      args: filterArgs as any,
      fromBlock: getLegacyVestingStartBlock(),
      toBlock: 'latest',
    })
    const map = new Map<string, { vault: Address; wrapper: Address; shareOft: Address }>()
    for (const log of logs ?? []) {
      const args = (log as { args?: Record<string, unknown> } | undefined)?.args ?? {}
      const vault = args.vault as Address | undefined
      const wrapper = args.wrapper as Address | undefined
      const shareOft = args.shareOFT as Address | undefined
      if (!vault || !wrapper || !shareOft) continue
      if (!isAddress(vault) || !isAddress(wrapper) || !isAddress(shareOft)) continue
      map.set(String(vault).toLowerCase(), {
        vault: getAddress(vault),
        wrapper: getAddress(wrapper),
        shareOft: getAddress(shareOft),
      })
    }
    return map
  } catch {
    return new Map()
  }
}

export async function resolveShareOftFromVault(
  publicClient: any,
  vaultAddress: Address,
): Promise<Address | null> {
  const registryAddress = CONTRACTS.registry
  if (!registryAddress || !isAddress(registryAddress)) return null

  const tokens = (await publicClient.readContract({
    address: registryAddress as Address,
    abi: CREATOR_REGISTRY_ABI,
    functionName: 'getAllCreatorCoins',
  })) as Address[]

  if (!tokens || tokens.length === 0) return null

  const target = vaultAddress.toLowerCase()
  const calls = tokens.map((token) => ({
    address: registryAddress as Address,
    abi: CREATOR_REGISTRY_ABI,
    functionName: 'getCreatorCoin',
    args: [token],
  }))

  const chunkSize = 120
  for (let i = 0; i < calls.length; i += chunkSize) {
    const chunk = calls.slice(i, i + chunkSize)
    const results = await publicClient.multicall({ contracts: chunk, allowFailure: true })
    for (const res of results) {
      if (res.status !== 'success') continue
      const info = res.result as { vault?: unknown; shareOFT?: unknown; shareOft?: unknown }
      const vault = info?.vault as Address | undefined
      const shareOft = (info?.shareOFT ?? info?.shareOft) as Address | undefined
      if (!vault || !shareOft) continue
      if (!isAddress(vault) || !isAddress(shareOft)) continue
      if (String(vault).toLowerCase() === target) return getAddress(shareOft)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Embedded-owner ERC-4337 helper (with direct executeBatch fallback)
// ---------------------------------------------------------------------------

export async function sendEmbeddedOwnerSmartWalletCall(params: {
  publicClient: any
  embeddedProvider: { request: (args: { method: string; params?: any[] }) => Promise<unknown> }
  bundlerUrl: string
  smartWallet: Address
  ownerAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
}): Promise<{ userOpHash: Hex; transactionHash: Hex | null }> {
  const { publicClient, embeddedProvider, bundlerUrl, smartWallet, ownerAddress, calls } = params
  const embeddedWalletClient = {
    request: async (args: { method: string; params?: any[] }) => embeddedProvider.request(args),
  }

  try {
    return await sendCoinbaseSmartWalletUserOperation({
      publicClient: publicClient as any,
      walletClient: embeddedWalletClient as any,
      bundlerUrl,
      smartWallet,
      ownerAddress,
      calls,
      version: '1',
      // Embedded providers commonly block eth_sign; prefer auto with fallback.
      userOpSignMode: 'auto',
      allowEoaSignMessageFallback: true,
      skipPaymaster: false,
      // Avoid recursive signature-mode retries for deterministic embedded behavior.
      retryOnInvalidSignature: false,
    })
  } catch (error: unknown) {
    if (!shouldFallbackToOwnerDirectExecute(error)) throw error
    const fallbackReason = summarizeErrorReason(error)

    let ownerBalance: bigint | null = null
    try {
      ownerBalance = await publicClient.getBalance({ address: ownerAddress })
    } catch {
      ownerBalance = null
    }
    if (ownerBalance === 0n) {
      logger.warn('[AdminOps][ERC-4337] Direct owner executeBatch fallback unavailable: owner has zero Base ETH', {
        smartWallet,
        ownerAddress,
        callCount: calls.length,
        reason: fallbackReason,
      })
      throw new Error(
        'Gas sponsorship failed, and direct owner fallback is unavailable because the owner wallet has 0 ETH on Base.',
      )
    }
    logger.warn('[AdminOps][ERC-4337] Falling back to direct owner executeBatch', {
      smartWallet,
      ownerAddress,
      callCount: calls.length,
      reason: fallbackReason,
    })

    const executeBatchData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI as any,
      functionName: 'executeBatch' as any,
      args: [
        calls.map((call) => ({
          target: call.to,
          value: call.value ?? 0n,
          data: call.data ?? '0x',
        })),
      ],
    })
    let txHashRaw: unknown
    try {
      txHashRaw = await embeddedProvider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: ownerAddress,
            to: smartWallet,
            data:
              appendBuilderSuffixToHex(executeBatchData, {
                chainId: (publicClient as { chain?: { id?: number } } | null)?.chain?.id ?? base.id,
              }) ?? executeBatchData,
          },
        ],
      })
    } catch (fallbackError: unknown) {
      const fallbackErrorReason = summarizeErrorReason(fallbackError)
      logger.error('[AdminOps][ERC-4337] Direct owner executeBatch failed to submit', {
        smartWallet,
        ownerAddress,
        callCount: calls.length,
        reason: fallbackReason,
        error: fallbackErrorReason,
      })
      if (fallbackErrorReason.toLowerCase().includes('gas required exceeds allowance (0)')) {
        throw new Error(
          'Gas sponsorship failed, and direct owner fallback could not estimate gas because the owner wallet has no spendable Base ETH.',
        )
      }
      throw fallbackError
    }
    logger.warn('[AdminOps][ERC-4337] Direct owner executeBatch submitted', {
      smartWallet,
      ownerAddress,
      callCount: calls.length,
      reason: fallbackReason,
      txHash: txHashRaw,
    })
    if (typeof txHashRaw !== 'string' || !txHashRaw.startsWith('0x')) {
      logger.error('[AdminOps][ERC-4337] Direct owner fallback returned invalid tx hash', {
        smartWallet,
        ownerAddress,
        callCount: calls.length,
        reason: fallbackReason,
        txHash: txHashRaw,
      })
      throw new Error('Direct owner transaction fallback did not return a valid transaction hash.')
    }
    return { userOpHash: txHashRaw as Hex, transactionHash: txHashRaw as Hex }
  }
}
