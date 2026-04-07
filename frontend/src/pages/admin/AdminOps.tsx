import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { useAccount, useBlockNumber, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import {
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  hexToString,
  isAddress,
  parseAbiItem,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { ConnectButton } from '@/components/account/ConnectButton'
import { CONTRACTS } from '@/config/contracts'
import { appendBuilderSuffixToHex } from '@/lib/baseBuilderCodes'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { AgentPublishStatus, type AgentPublishData } from './AgentPublishStatus'
import {
  buildAgentUriPolicy,
  STRICT_IMMUTABLE_AGENT_URI_SUMMARY,
  toRegistrationDataUri,
} from '@/lib/erc8004AgentUriPolicy'
import { logger } from '@/lib/logger'
const CANONICAL_SMART_WALLET = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
// NOTE:
// On-chain `agentURI` should be validator-compatible. Some validators do not
// support lens:// directly, so prefer gateway https URLs, ipfs://, ar://, or data:.
const ERC8004_AGENT_URI_DEFAULT = ''
const ERC8004_AGENT_URI_PLACEHOLDER = 'https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,...'

function isStrictContentAddressedAgentUri(uri: string): boolean {
  const u = uri.trim().toLowerCase()
  return u.startsWith('ipfs://') || u.startsWith('data:') || u.startsWith('ar://')
}

function normalizeAllowlistedHost(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/\.+$/g, '')
  if (!normalized) return ''
  if (normalized.startsWith('*.')) return `.${normalized.slice(2)}`
  return normalized
}

const AGENT_URI_HTTPS_ALLOWLIST = new Set(
  String(import.meta.env.VITE_AGENT_URI_HTTPS_ALLOWLIST ?? '')
    .split(/[\s,]+/g)
    .map((entry) => normalizeAllowlistedHost(entry))
    .filter(Boolean),
)

function isAllowlistedHttpsAgentUri(uri: string): boolean {
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

function isContentAddressedAgentUri(uri: string): boolean {
  return isStrictContentAddressedAgentUri(uri) || isAllowlistedHttpsAgentUri(uri)
}

function agentUriValidationMessage(): string {
  if (AGENT_URI_HTTPS_ALLOWLIST.size > 0) {
    return 'Agent URI must be ipfs://, ar://, data:, or an https:// URL on the VITE_AGENT_URI_HTTPS_ALLOWLIST.'
  }
  return 'Agent URI must be strict content-addressed (ipfs://, ar://, or data:). HTTPS/http and lens:// are blocked for on-chain writes.'
}

type LegacyVaultHint = {
  id: string
  label: string
  vault?: string
  wrapper?: string
  shareOft?: string
  vesting?: string
  vaultHint?: string
}

type LegacyVaultResolved = {
  id: string
  label: string
  vault: string
  wrapper: string
  shareOft: string
  vesting: string
  vaultHint?: string
  resolvedFrom: 'static' | 'registry' | 'unknown'
}

const LEGACY_STATIC_VAULT_HINTS: LegacyVaultHint[] = [
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

const LEGACY_DYNAMIC_SLOT_COUNT = 8

const LEGACY_DYNAMIC_VAULT_HINTS: LegacyVaultHint[] = Array.from({ length: LEGACY_DYNAMIC_SLOT_COUNT }, (_, index) => ({
  id: `legacy-auto-${index + 1}`,
  label: `Recovered deployment slot #${index + 1}`,
}))

const LEGACY_DYNAMIC_HINT_IDS = LEGACY_DYNAMIC_VAULT_HINTS.map((hint) => hint.id)

const LEGACY_VAULT_HINTS: LegacyVaultHint[] = [...LEGACY_STATIC_VAULT_HINTS, ...LEGACY_DYNAMIC_VAULT_HINTS]

function parseVaultHint(hint?: string): { prefix: string; suffix: string } | null {
  if (!hint) return null
  const raw = hint.trim()
  if (!raw) return null
  if (isAddress(raw)) return { prefix: raw.toLowerCase(), suffix: '' }
  const parts = raw.split('...')
  if (parts.length !== 2) return null
  const prefix = parts[0].trim().toLowerCase()
  const suffix = parts[1].trim().toLowerCase()
  if (!prefix || !suffix) return null
  return { prefix, suffix }
}

function matchVaultHint(hint: string | undefined, vaults: string[]): string | null {
  const parsed = parseVaultHint(hint)
  if (!parsed) return null
  if (parsed.suffix === '' && isAddress(parsed.prefix)) return parsed.prefix
  const matches = vaults.filter((vault) => vault.startsWith(parsed.prefix) && vault.endsWith(parsed.suffix))
  return matches.length === 1 ? matches[0] : null
}

function getLegacyVestingStartBlock(): bigint {
  const raw = import.meta.env.VITE_BASE_VESTING_START_BLOCK as string | undefined
  if (!raw) return 15_000_000n
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 15_000_000n
  return BigInt(Math.floor(n))
}

const CREATOR_REGISTRY_ABI = [
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

const CREATOR_SHARE_VESTING_EVENT = parseAbiItem(
  'event CreatorShareVestingDeployed(address indexed shareOFT, address indexed beneficiary, address vesting, uint256 amount, uint64 startTimestamp, uint64 durationSeconds)',
)
const PHASE1_DEPLOYED_EVENT = parseAbiItem(
  'event Phase1Deployed(address indexed creatorToken, address indexed owner, address oftBootstrapRegistry, address vault, address wrapper, address shareOFT)',
)

async function fetchLegacyVesting(
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
    const vesting = (log?.args as any)?.vesting as Address | undefined
    return vesting && isAddress(vesting) ? vesting : null
  } catch {
    return null
  }
}

async function fetchLegacyPhase1Map(
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
      const args = (log as any)?.args ?? {}
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

async function resolveShareOftFromVault(publicClient: any, vaultAddress: Address): Promise<Address | null> {
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
      const info = res.result as any
      const vault = info?.vault as Address | undefined
      const shareOft = (info?.shareOFT ?? info?.shareOft) as Address | undefined
      if (!vault || !shareOft) continue
      if (!isAddress(vault) || !isAddress(shareOft)) continue
      if (String(vault).toLowerCase() === target) return getAddress(shareOft)
    }
  }

  return null
}

const VESTING_ABI = [
  { name: 'releasable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'release', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'beneficiary', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const ERC8004_IDENTITY_REGISTRY_ABI = [
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

const ERC8004_REGISTERED_EVENT = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
)

const SHARE_OFT_METADATA_ABI = [
  { name: 'contractURI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'setContractURI', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'uri', type: 'string' }], outputs: [] },
] as const

const WRAPPER_ABI = [
  { name: 'unwrap', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

const VAULT_ABI = [
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

const VAULT_EMERGENCY_ABI = [
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

const QUEUED_WITHDRAWAL_ABI = [
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

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
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

type TxState = {
  status: 'idle' | 'pending' | 'success' | 'error'
  hash?: `0x${string}`
  error?: string
}

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatToken(value: bigint | undefined): string {
  if (value === undefined) return '—'
  const raw = formatUnits(value, 18)
  return raw.replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1')
}

function parseAmount(input: string): bigint | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const amount = parseUnits(raw, 18)
    return amount > 0n ? amount : null
  } catch {
    return null
  }
}

function buildTxHref(hash?: string): string | null {
  if (!hash) return null
  return `https://basescan.org/tx/${hash}`
}

function shouldFallbackToOwnerDirectExecute(error: unknown): boolean {
  const msg = String((error as any)?.shortMessage || (error as any)?.message || error || '').toLowerCase()
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
    msg.includes('didn\'t pay prefund') ||
    msg.includes('request denied -') ||
    msg.includes('paymaster unavailable') ||
    msg.includes('sponsorship')
  )
}

function extractMetaMessages(error: unknown): string | null {
  const seen = new Set<unknown>()
  const queue: unknown[] = [error]
  const out: string[] = []

  while (queue.length > 0 && out.length < 6) {
    const item = queue.shift()
    if (!item || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)

    const anyItem = item as any
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

function summarizeErrorReason(error: unknown): string {
  const err = error as any
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

function toFriendlyTxError(error: unknown): string {
  const msg = summarizeErrorReason(error)
  const lower = msg.toLowerCase()
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

async function sendEmbeddedOwnerSmartWalletCall(params: {
  publicClient: any
  embeddedProvider: { request: (args: { method: string; params?: any[] }) => Promise<unknown> }
  bundlerUrl: string
  smartWallet: Address
  ownerAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
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
                chainId: (publicClient as any)?.chain?.id ?? base.id,
              }) ?? executeBatchData,
          },
        ],
      })
    } catch (fallbackError: unknown) {
      logger.error('[AdminOps][ERC-4337] Direct owner executeBatch failed to submit', {
        smartWallet,
        ownerAddress,
        callCount: calls.length,
        reason: fallbackReason,
        error: summarizeErrorReason(fallbackError),
      })
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

function TxMeta({ state }: { state?: TxState }) {
  if (!state || state.status === 'idle') return null
  return (
    <div className="text-xs text-zinc-500 space-y-1">
      {state.hash ? (
        <a className="inline-flex items-center gap-2 text-brand-accent hover:text-brand-primary" href={buildTxHref(state.hash) ?? undefined} target="_blank" rel="noreferrer">
          View transaction
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : null}
      {state.status === 'pending' ? <div className="text-amber-300/80">Transaction pending…</div> : null}
      {state.status === 'success' ? <div className="text-emerald-300/90">Confirmed.</div> : null}
      {state.status === 'error' ? <div className="text-red-400">{state.error ?? 'Transaction failed'}</div> : null}
    </div>
  )
}

function usePaymasterSessionGuard() {
  const siwe = useSiweAuth()
  const privyAny = usePrivy() as any
  const privyReady = Boolean(privyAny?.ready)
  const privyAuthenticated = Boolean(privyAny?.authenticated)
  const getPrivyAccessToken: (() => Promise<string | null>) | null =
    typeof privyAny?.getAccessToken === 'function' ? privyAny.getAccessToken.bind(privyAny) : null

  const ensurePaymasterSession = async (): Promise<boolean> => {
    if (siwe.isSignedIn) return true
    if (privyReady && privyAuthenticated && getPrivyAccessToken) {
      try {
        const token = await getPrivyAccessToken()
        if (token) {
          const addr = await siwe.signInWithPrivyToken(token)
          if (addr) return true
        }
      } catch {
        // ignore
      }
    }
    return false
  }

  return { ensurePaymasterSession }
}

function AgentRegistration() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { client: smartWalletClient } = useSmartWallets()
  const publicClient = usePublicClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()
  const { ensurePaymasterSession } = usePaymasterSessionGuard()
  const [embeddedPrivyEoaAddress, setEmbeddedPrivyEoaAddress] = useState<string | null>(null)
  const [agentUri, setAgentUri] = useState(ERC8004_AGENT_URI_DEFAULT)
  const [agentUriState, setAgentUriState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    error?: string
  }>({ status: 'idle' })
  const [lensPublishState, setLensPublishState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    error?: string
  }>({ status: 'idle' })
  const [lensPublishResult, setLensPublishResult] = useState<AgentPublishData | null>(null)
  const [registerTxState, setRegisterTxState] = useState<TxState>({ status: 'idle' })
  const [updateTxState, setUpdateTxState] = useState<TxState>({ status: 'idle' })
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null)
  const [agentIdInput, setAgentIdInput] = useState<string>('')
  const [resolveState, setResolveState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>({
    status: 'idle',
  })
  const [walletBindTxState, setWalletBindTxState] = useState<TxState>({ status: 'idle' })
  const [walletMetadataTxState, setWalletMetadataTxState] = useState<TxState>({ status: 'idle' })
  const [onChainAgentWallet, setOnChainAgentWallet] = useState<string | null>(null)

  const connectedAddress = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address)
  }, [address])

  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])

  const canonicalCswAddress = useMemo(() => getAddress(CANONICAL_SMART_WALLET), [])
  const expectedAgentWalletCaip = useMemo(() => `eip155:${base.id}:${canonicalCswAddress.toLowerCase()}`, [canonicalCswAddress])
  const isCanonical = connectedAddress?.toLowerCase() === CANONICAL_SMART_WALLET.toLowerCase()
  const privySmartWalletAddress = useMemo(() => {
    try {
      const addr = smartWalletClient?.account?.address
      return addr && isAddress(addr) ? getAddress(addr) : null
    } catch {
      return null
    }
  }, [smartWalletClient])
  const privySmartWalletIsCanonical = useMemo(() => {
    if (!privySmartWalletAddress) return false
    return privySmartWalletAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, privySmartWalletAddress])
  const agentWalletAlreadyCanonical = useMemo(() => {
    if (!onChainAgentWallet) return false
    return onChainAgentWallet.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, onChainAgentWallet])
  const usingStrictAgentUri = useMemo(() => isStrictContentAddressedAgentUri(agentUri), [agentUri])

  const canonicalOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [connectedAddress ?? ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!connectedAddress },
  })
  const connectedIsCanonicalOwner = canonicalOwnerQuery.data === true

  const embeddedOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [embeddedPrivyEoaAddress ? (embeddedPrivyEoaAddress as Address) : ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!embeddedPrivyEoaAddress },
  })
  const embeddedIsCanonicalOwner = embeddedOwnerQuery.data === true

  const registryBalanceQuery = useReadContract({
    address: ERC8004_IDENTITY_REGISTRY as Address,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'balanceOf',
    args: [canonicalCswAddress],
    chainId: base.id,
    query: { enabled: !!publicClient },
  })
  const registryBalance = typeof registryBalanceQuery.data === 'bigint' ? registryBalanceQuery.data : null

  useEffect(() => {
    let cancelled = false
    if (!embeddedPrivyWallet) {
      setEmbeddedPrivyEoaAddress(null)
      return () => {}
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedPrivyEoaAddress(addr)
      } catch {
        if (!cancelled) setEmbeddedPrivyEoaAddress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet])

  const isBase = chainId === base.id
  const canSubmitViaOwner = (connectedIsCanonicalOwner || embeddedIsCanonicalOwner) && !isCanonical

  const updateRegisterTx = (patch: Partial<TxState>) => {
    setRegisterTxState((prev) => {
      const nextStatus = patch.status ?? prev.status ?? 'idle'
      return { ...prev, ...patch, status: nextStatus } as TxState
    })
  }

  const updateUpdateTx = (patch: Partial<TxState>) => {
    setUpdateTxState((prev) => {
      const nextStatus = patch.status ?? prev.status ?? 'idle'
      return { ...prev, ...patch, status: nextStatus } as TxState
    })
  }

  const updateResolveState = (patch: Partial<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>) => {
    setResolveState((prev) => ({
      status: patch.status ?? prev.status,
      error: patch.error ?? (patch.status === 'error' ? prev.error : undefined),
    }))
  }

  const buildContentAddressedUri = async () => {
    setAgentUriState({ status: 'loading' })
    try {
      const res = await fetch('/.well-known/agent-registration.json', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`Failed to load registration file (${res.status}).`)
      }
      const json = await res.json()
      const dataUri = toRegistrationDataUri(json)
      setAgentUri(dataUri)
      setAgentUriState({ status: 'success' })
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to build data URI.')
      setAgentUriState({ status: 'error', error: msg })
    }
  }

  const publishAgentRegistrationToLens = useCallback(async () => {
    setLensPublishState({ status: 'loading' })
    setLensPublishResult(null)
    try {
      const res = await fetch('/api/lens/agent-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: true }),
      })
      const payload = (await res.json().catch(() => null)) as any
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `Request failed (${res.status}).`)
      }
      const publishData = payload?.data as AgentPublishData | null
      if (!publishData?.uriPolicy?.preferredOnchainUri) {
        throw new Error('Lens response did not include a canonical immutable URI.')
      }
      // Keep strict content-addressed URI as default; gateway is opt-in.
      setLensPublishResult(publishData)
      setAgentUri(String(publishData.uriPolicy.preferredOnchainUri))
      setLensPublishState({ status: 'success' })
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to publish registration.')
      setLensPublishState({ status: 'error', error: msg })
    }
  }, [])

  const autoPublishedAgentUri = useRef(false)

  useEffect(() => {
    if (autoPublishedAgentUri.current) return
    const trimmed = agentUri.trim()
    if (trimmed) {
      autoPublishedAgentUri.current = true
      return
    }
    autoPublishedAgentUri.current = true
    // Immediately generate a data: URI (fast, no external deps), then try Lens Grove.
    // We prefer the Grove HTTPS gateway URL for validator compatibility.
    void buildContentAddressedUri()
    void publishAgentRegistrationToLens()
  }, [agentUri, publishAgentRegistrationToLens])

  const extractAgentId = (receipt: { logs?: Array<{ address: string; data: Hex; topics: Hex[] }> }) => {
    const logs = receipt.logs ?? []
    const registryLower = ERC8004_IDENTITY_REGISTRY.toLowerCase()
    for (const log of logs) {
      if (String(log.address || '').toLowerCase() !== registryLower) continue
      try {
        const parsed = decodeEventLog({
          abi: [ERC8004_REGISTERED_EVENT],
          data: log.data,
          topics: log.topics as unknown as [Hex, ...Hex[]] | [],
        })
        if (parsed.eventName === 'Registered') {
          const args = parsed.args as { agentId?: bigint }
          if (args?.agentId !== undefined) return String(args.agentId)
        }
      } catch {
        continue
      }
    }
    return null
  }

  const applyRegisteredAgentId = (agentId: string | null): boolean => {
    if (!agentId) return false
    setRegisteredAgentId(agentId)
    setAgentIdInput(agentId)
    updateResolveState({ status: 'success' })
    return true
  }

  const handleRegistrationReceipt = async (receipt: { logs?: Array<{ address: string; data: Hex; topics: Hex[] }> }) => {
    const agentId = extractAgentId(receipt)
    if (applyRegisteredAgentId(agentId)) return
    await resolveAgentIdFromChain({ skipBalanceCheck: true })
  }

  async function registerAgent() {
    if (!publicClient) return
    updateRegisterTx({ status: 'pending', error: undefined, hash: undefined })
    setRegisteredAgentId(null)
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      const trimmedUri = agentUri.trim()
      if (!trimmedUri) throw new Error('Agent URI is required.')
      if (!isContentAddressedAgentUri(trimmedUri)) {
        throw new Error(agentUriValidationMessage())
      }

      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [trimmedUri],
        })
        updateRegisterTx({ status: 'pending', hash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'register' as any,
          args: [trimmedUri],
        })
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
        })
        updateRegisterTx({ status: 'pending', hash: result.transactionHash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'register' as any,
          args: [trimmedUri],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        updateRegisterTx({ status: 'pending', hash: result.transactionHash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      updateRegisterTx({ status: 'error', error: toFriendlyTxError(e) })
    }
  }

  async function updateAgentUri() {
    if (!publicClient) return
    updateUpdateTx({ status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      const trimmedUri = agentUri.trim()
      if (!trimmedUri) throw new Error('Agent URI is required.')
      if (!isContentAddressedAgentUri(trimmedUri)) {
        throw new Error(agentUriValidationMessage())
      }
      const rawId = agentIdInput.trim()
      if (!/^\d+$/.test(rawId)) throw new Error('Agent ID must be a non-negative integer.')
      const agentId = BigInt(rawId)

      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'setAgentURI',
          args: [agentId, trimmedUri],
        })
        updateUpdateTx({ status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        updateUpdateTx({ status: 'success' })
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setAgentURI' as any,
          args: [agentId, trimmedUri],
        })
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
        })
        updateUpdateTx({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateUpdateTx({ status: 'success' })
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setAgentURI' as any,
          args: [agentId, trimmedUri],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        updateUpdateTx({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateUpdateTx({ status: 'success' })
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      updateUpdateTx({ status: 'error', error: toFriendlyTxError(e) })
    }
  }

  async function resolveAgentIdFromChain(opts?: { skipBalanceCheck?: boolean }) {
    if (!publicClient) return
    updateResolveState({ status: 'loading', error: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!opts?.skipBalanceCheck && registryBalance === 0n) {
        throw new Error('No agents registered for the canonical CSW yet.')
      }

      const latest = await publicClient.getBlockNumber()
      const window = 2_000_000n
      const fromBlock = latest > window ? latest - window : 0n
      let logs = (await publicClient.getLogs({
        address: ERC8004_IDENTITY_REGISTRY as Address,
        event: ERC8004_REGISTERED_EVENT,
        args: { owner: canonicalCswAddress },
        fromBlock,
        toBlock: 'latest',
      })) as Array<{ args?: { agentId?: bigint } }>

      if (!logs.length && fromBlock !== 0n) {
        logs = (await publicClient.getLogs({
          address: ERC8004_IDENTITY_REGISTRY as Address,
          event: ERC8004_REGISTERED_EVENT,
          args: { owner: canonicalCswAddress },
          fromBlock: 0n,
          toBlock: 'latest',
        })) as Array<{ args?: { agentId?: bigint } }>
      }

      const last = logs[logs.length - 1]
      const agentId = last?.args?.agentId
      if (agentId === undefined) {
        throw new Error('No registration log found for the canonical CSW.')
      }
      setAgentIdInput(String(agentId))
      updateResolveState({ status: 'success' })
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Failed to resolve agent ID')
      updateResolveState({ status: 'error', error: msg })
    }
  }

  // ── Read on-chain agentWallet ──────────────────────────────────────────
  const agentWalletQuery = useReadContract({
    address: ERC8004_IDENTITY_REGISTRY as Address,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'getAgentWallet',
    args: [agentIdInput.trim() ? BigInt(agentIdInput.trim()) : 0n],
    chainId: base.id,
    query: { enabled: !!publicClient && /^\d+$/.test(agentIdInput.trim()) },
  })

  const agentWalletMetadataQuery = useReadContract({
    address: ERC8004_IDENTITY_REGISTRY as Address,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'getMetadata',
    args: [agentIdInput.trim() ? BigInt(agentIdInput.trim()) : 0n, 'agentWallet'],
    chainId: base.id,
    query: { enabled: !!publicClient && /^\d+$/.test(agentIdInput.trim()) },
  })

  const decodedAgentWalletMetadata = useMemo(() => {
    const raw = agentWalletMetadataQuery.data
    if (typeof raw !== 'string') {
      return { kind: 'unknown' as const, rawHex: null, value: null }
    }
    const rawHex = raw as Hex
    if (rawHex === '0x') return { kind: 'empty' as const, rawHex, value: '' }

    if (/^0x[a-fA-F0-9]{40}$/.test(rawHex) && isAddress(rawHex)) {
      return { kind: 'address' as const, rawHex, value: getAddress(rawHex) }
    }

    try {
      const decoded = hexToString(rawHex)
      const cleaned = decoded.replace(/\u0000+$/g, '').trim()
      if (cleaned) {
        if (/^eip155:\d+:0x[a-fA-F0-9]{40}$/.test(cleaned)) {
          return { kind: 'caip10' as const, rawHex, value: cleaned.toLowerCase() }
        }
        return { kind: 'text' as const, rawHex, value: cleaned }
      }
    } catch {
      // Fall through to hex representation.
    }

    return { kind: 'hex' as const, rawHex, value: rawHex }
  }, [agentWalletMetadataQuery.data])

  const agentWalletMetadataMatchesExpected = useMemo(() => {
    if (decodedAgentWalletMetadata.kind !== 'caip10') return false
    return decodedAgentWalletMetadata.value === expectedAgentWalletCaip
  }, [decodedAgentWalletMetadata, expectedAgentWalletCaip])

  useEffect(() => {
    const raw = agentWalletQuery.data
    if (typeof raw === 'string' && isAddress(raw) && raw !== ZERO_ADDRESS) {
      setOnChainAgentWallet(getAddress(raw))
    } else {
      setOnChainAgentWallet(null)
    }
  }, [agentWalletQuery.data])

  // ── setAgentWallet (EIP-712 + ERC-1271 flow) ──────────────────────────
  async function bindAgentWallet() {
    if (!publicClient || !walletClient) return
    setWalletBindTxState({ status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) throw new Error('Please switch to Base network.')
      const rawId = agentIdInput.trim()
      if (!/^\d+$/.test(rawId)) throw new Error('Agent ID must be a non-negative integer.')
      const agentId = BigInt(rawId)
      const newWallet = getAddress(CANONICAL_SMART_WALLET)
      if (agentWalletAlreadyCanonical) {
        setWalletBindTxState({ status: 'success', error: undefined, hash: undefined })
        return
      }

      // 1. Build EIP-712 typed data
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 240) // 4 min
      const domain = {
        name: 'ERC8004IdentityRegistry',
        version: '1',
        chainId: base.id,
        verifyingContract: ERC8004_IDENTITY_REGISTRY as Address,
      } as const
      const types = {
        AgentWalletSet: [
          { name: 'agentId', type: 'uint256' },
          { name: 'newWallet', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
      } as const
      const message = {
        agentId,
        newWallet,
        owner: canonicalCswAddress,
        deadline,
      }

      // 2. Sign with the CSW (ERC-1271) — the CSW IS the newWallet
      let signature: Hex
      if (isCanonical) {
        signature = await (walletClient as any).signTypedData({
          account: (walletClient as any).account,
          domain,
          types,
          primaryType: 'AgentWalletSet',
          message,
        })
      } else if (privySmartWalletIsCanonical && smartWalletClient) {
        const swc: any = smartWalletClient as any
        if (typeof swc.account?.signTypedData === 'function') {
          signature = await swc.account.signTypedData({ domain, types, primaryType: 'AgentWalletSet', message })
        } else if (typeof swc.signTypedData === 'function') {
          signature = await swc.signTypedData({
            account: canonicalCswAddress as Address,
            domain,
            types,
            primaryType: 'AgentWalletSet',
            message,
          })
        } else {
          throw new Error('Privy smart wallet signer is not ready. Re-auth and retry.')
        }
      } else {
        throw new Error(
          `Bind requires a canonical CSW signature. ` +
            `connected=${connectedAddress ?? 'none'}; ` +
            `canonical=${canonicalCswAddress}; ` +
            `privySmartWallet=${privySmartWalletAddress ?? 'none'}; ` +
            `privySmartWalletIsCanonical=${String(privySmartWalletIsCanonical)}. ` +
            `Connect canonical CSW or sign in with Privy smart wallet (4626.fun).`,
        )
      }

      // 3. Encode and submit the setAgentWallet tx
      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address
      const data = encodeFunctionData({
        abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
        functionName: 'setAgentWallet' as any,
        args: [agentId, newWallet, deadline, signature],
      })

      if (isCanonical) {
        const hash = await (walletClient as any).sendTransaction({
          account: (walletClient as any).account,
          chain: base as any,
          to: registryAddress,
          data,
        })
        setWalletBindTxState({ status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        setWalletBindTxState({ status: 'success', hash })
        void agentWalletQuery.refetch()
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) throw new Error('Privy embedded wallet provider not available')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) throw new Error('Sign in required for gas sponsorship.')
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
        })
        setWalletBindTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setWalletBindTxState({ status: 'success', hash: result.transactionHash })
        void agentWalletQuery.refetch()
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) throw new Error('Sign in required for gas sponsorship.')
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        setWalletBindTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setWalletBindTxState({ status: 'success', hash: result.transactionHash })
        void agentWalletQuery.refetch()
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      setWalletBindTxState({ status: 'error', error: toFriendlyTxError(e) })
    }
  }

  async function syncAgentWalletMetadataCaip() {
    if (!publicClient) return
    setWalletMetadataTxState({ status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) throw new Error('Please switch to Base network.')
      const rawId = agentIdInput.trim()
      if (!/^\d+$/.test(rawId)) throw new Error('Agent ID must be a non-negative integer.')
      const agentId = BigInt(rawId)
      const metadataValue = stringToHex(expectedAgentWalletCaip) as Hex
      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'setMetadata',
          args: [agentId, 'agentWallet', metadataValue],
        })
        setWalletMetadataTxState({ status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        setWalletMetadataTxState({ status: 'success', hash })
        void agentWalletMetadataQuery.refetch()
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) throw new Error('Privy embedded wallet provider not available')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) throw new Error('Sign in required for gas sponsorship.')
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setMetadata' as any,
          args: [agentId, 'agentWallet', metadataValue],
        })
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
        })
        setWalletMetadataTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setWalletMetadataTxState({ status: 'success', hash: result.transactionHash })
        void agentWalletMetadataQuery.refetch()
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) throw new Error('Sign in required for gas sponsorship.')
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setMetadata' as any,
          args: [agentId, 'agentWallet', metadataValue],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        setWalletMetadataTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setWalletMetadataTxState({ status: 'success', hash: result.transactionHash })
        void agentWalletMetadataQuery.refetch()
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      setWalletMetadataTxState({ status: 'error', error: toFriendlyTxError(e) })
    }
  }

  return (
    <section id="agent-registration" className="cinematic-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
            <div className="space-y-2">
              <div className="label">Agent registry</div>
              <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Register ERC-8004 agent</div>
              <div className="text-sm text-zinc-600 max-w-prose">
                Registers the canonical CSW in the ERC-8004 Identity Registry on Base.
              </div>
            </div>

            {!isConnected ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="label">Connect</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm">
                <div className="text-zinc-400">Connected wallet</div>
                <div className="font-mono text-zinc-200">{connectedAddress}</div>
                <div className="text-xs text-zinc-500">
                  Canonical CSW: <span className="font-mono text-zinc-300">{shortAddress(canonicalCswAddress)}</span>
                </div>
                {canSubmitViaOwner ? (
                  <div className="text-emerald-300/90">Owner detected. Transactions will be submitted via the canonical smart wallet.</div>
                ) : null}
                {!isCanonical && !canSubmitViaOwner ? (
                  <div className="text-amber-300/80">
                    Connected wallet is not the canonical smart wallet. Registering is disabled.
                  </div>
                ) : null}
                {!isBase ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!switchChainAsync) return
                      await switchChainAsync({ chainId: base.id })
                    }}
                    disabled={switchPending}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="text-sm text-zinc-300">Agent registration URI</div>
              <input
                value={agentUri}
                onChange={(e) => setAgentUri(e.target.value)}
                placeholder={ERC8004_AGENT_URI_PLACEHOLDER}
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
                <span>
                  {STRICT_IMMUTABLE_AGENT_URI_SUMMARY}
                </span>
                <button
                  type="button"
                  onClick={() => void buildContentAddressedUri()}
                  className="text-zinc-300 hover:text-white transition-colors"
                >
                  Build strict data URI
                </button>
              </div>
              {agentUri.trim() && !usingStrictAgentUri && isContentAddressedAgentUri(agentUri) ? (
                <div className="text-xs text-amber-300/90">
                  Current URI uses an allowlisted HTTPS gateway (mutable). Strict content-addressed URIs are safer for long-term integrity.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void publishAgentRegistrationToLens()}
                disabled={lensPublishState.status === 'loading'}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lensPublishState.status === 'loading' ? 'Publishing…' : 'Publish to Lens Grove'}
              </button>
              {lensPublishState.status === 'error' ? (
                <div className="text-xs text-red-400">{lensPublishState.error}</div>
              ) : lensPublishState.status === 'success' ? (
                <div className="text-xs text-emerald-300/90">Refreshed the canonical immutable URI and updated publish status.</div>
              ) : null}
              {lensPublishResult ? (
                <AgentPublishStatus
                  publish={lensPublishResult}
                  onUseGatewayUrl={(gatewayUrl) => setAgentUri(gatewayUrl)}
                  className="space-y-1"
                />
              ) : null}
              <Link className="text-xs text-brand-accent hover:text-brand-primary" to="/agents/uri-service">
                Agent URI service docs
              </Link>
              {agentUriState.status === 'loading' ? (
                <div className="text-xs text-zinc-500">Building content-addressed URI…</div>
              ) : agentUriState.status === 'error' ? (
                <div className="text-xs text-red-400">{agentUriState.error}</div>
              ) : agentUriState.status === 'success' ? (
                <div className="text-xs text-emerald-300/90">Content-addressed URI ready.</div>
              ) : null}
              <div className="text-xs text-zinc-600">
                Registry: <span className="font-mono text-zinc-400">{shortAddress(ERC8004_IDENTITY_REGISTRY)}</span> · Chain: Base
              </div>
              {registryBalance !== null ? (
                <div className="text-xs text-zinc-500">
                  Agents registered for canonical CSW: <span className="text-zinc-300">{registryBalance.toString()}</span>
                </div>
              ) : null}
              {registeredAgentId ? (
                <div className="text-xs text-emerald-300/90">
                  Registered agentId: <span className="font-mono">{registeredAgentId}</span>
                </div>
              ) : null}
              <div className="text-xs text-zinc-600">Agent ID (for updates)</div>
              <input
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <button
                type="button"
                onClick={() => void resolveAgentIdFromChain()}
                disabled={resolveState.status === 'loading' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolveState.status === 'loading' ? 'Resolving…' : 'Resolve agent ID from chain'}
              </button>
              {resolveState.status === 'error' ? (
                <div className="text-xs text-red-400">{resolveState.error}</div>
              ) : resolveState.status === 'success' ? (
                <div className="text-xs text-emerald-300/90">Agent ID resolved.</div>
              ) : null}
              <button
                type="button"
                onClick={() => void updateAgentUri()}
                disabled={updateTxState.status === 'pending' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateTxState.status === 'pending' ? 'Updating…' : 'Update agent URI'}
              </button>
              <TxMeta state={updateTxState} />
              <button
                type="button"
                onClick={() => void registerAgent()}
                disabled={registerTxState.status === 'pending' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registerTxState.status === 'pending' ? 'Registering…' : 'Register agent'}
              </button>
              <TxMeta state={registerTxState} />
            </div>

            {/* ── Agent Wallet Binding (setAgentWallet) ─────────────── */}
            <div className="border-t border-white/5 pt-6 space-y-3">
              <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                On-chain Agent Wallet (EIP-712 / ERC-1271)
              </h4>
              <p className="text-xs text-zinc-500">
                Cryptographically bind the canonical CSW as the verified <code className="text-zinc-400">agentWallet</code> for this agent on the Identity Registry.
                Other agents and verifiers can call <code className="text-zinc-400">getAgentWallet(agentId)</code> to confirm wallet ownership.
              </p>
              {onChainAgentWallet ? (
                <div className="text-xs text-emerald-300/90">
                  On-chain agentWallet: <span className="font-mono">{onChainAgentWallet}</span>
                  {agentWalletAlreadyCanonical && (
                    <span className="ml-2 text-emerald-400">(matches canonical CSW)</span>
                  )}
                </div>
              ) : agentWalletQuery.isFetched ? (
                <div className="text-xs text-amber-400/80">No agentWallet set on-chain for this agent.</div>
              ) : null}
              {agentWalletAlreadyCanonical ? (
                <div className="text-xs text-emerald-400/90">Already bound on-chain. No additional signature required.</div>
              ) : null}
              <button
                type="button"
                onClick={() => void bindAgentWallet()}
                disabled={
                  walletBindTxState.status === 'pending' ||
                  agentWalletAlreadyCanonical ||
                  !isConnected ||
                  (!isCanonical && !canSubmitViaOwner) ||
                  !/^\d+$/.test(agentIdInput.trim())
                }
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {walletBindTxState.status === 'pending'
                  ? 'Binding wallet…'
                  : agentWalletAlreadyCanonical
                    ? 'Already bound'
                    : 'Bind CSW as agentWallet'}
              </button>
              <TxMeta state={walletBindTxState} />
            </div>

            <div className="border-t border-white/5 pt-6 space-y-3">
              <h4 className="text-sm font-medium text-zinc-300">Agent Wallet Metadata (legacy CAIP sync)</h4>
              <p className="text-xs text-zinc-500">
                Reads <code className="text-zinc-400">getMetadata(agentId, "agentWallet")</code> and optionally attempts a
                CAIP-10 write via <code className="text-zinc-400">setMetadata</code>. Modern ERC-8004 registries may reserve
                this key and reject writes.
              </p>
              <div className="text-xs text-zinc-500">
                Expected CAIP-10: <span className="font-mono text-zinc-300">{expectedAgentWalletCaip}</span>
              </div>
              {agentWalletMetadataQuery.isFetched ? (
                <div className="text-xs text-zinc-500 space-y-1">
                  <div>
                    On-chain metadata (hex):{' '}
                    <span className="font-mono text-zinc-300">
                      {decodedAgentWalletMetadata.rawHex ?? '0x'}
                    </span>
                  </div>
                  <div>
                    Decoded:{' '}
                    <span className="font-mono text-zinc-300">
                      {decodedAgentWalletMetadata.value || '(empty)'}
                    </span>{' '}
                    <span className="text-zinc-400">[{decodedAgentWalletMetadata.kind}]</span>
                  </div>
                  {agentWalletMetadataMatchesExpected ? (
                    <div className="text-emerald-400/90">Metadata already matches expected CAIP-10 value.</div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void syncAgentWalletMetadataCaip()}
                disabled={
                  walletMetadataTxState.status === 'pending' ||
                  !isConnected ||
                  (!isCanonical && !canSubmitViaOwner) ||
                  !/^\d+$/.test(agentIdInput.trim())
                }
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {walletMetadataTxState.status === 'pending'
                  ? 'Syncing metadata…'
                  : 'Sync agentWallet metadata to CAIP-10'}
              </button>
              <TxMeta state={walletMetadataTxState} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// ERC-8004 Reputation / Feedback
// ---------------------------------------------------------------------------

const ERC8004_REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63'

const ERC8004_REPUTATION_REGISTRY_ABI = [
  { name: 'giveFeedback', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'value', type: 'int128' }, { name: 'valueDecimals', type: 'uint8' }, { name: 'tag1', type: 'string' }, { name: 'tag2', type: 'string' }, { name: 'endpoint', type: 'string' }, { name: 'feedbackURI', type: 'string' }, { name: 'feedbackHash', type: 'bytes32' }], outputs: [] },
  { name: 'revokeFeedback', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'feedbackIndex', type: 'uint64' }], outputs: [] },
  { name: 'appendResponse', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'clientAddress', type: 'address' }, { name: 'feedbackIndex', type: 'uint64' }, { name: 'responseURI', type: 'string' }, { name: 'responseHash', type: 'bytes32' }], outputs: [] },
  { name: 'getSummary', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'clientAddresses', type: 'address[]' }, { name: 'tag1', type: 'string' }, { name: 'tag2', type: 'string' }], outputs: [{ name: 'count', type: 'uint64' }, { name: 'summaryValue', type: 'int128' }, { name: 'summaryValueDecimals', type: 'uint8' }] },
  { name: 'getClients', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'address[]' }] },
  { name: 'readAllFeedback', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'clientAddresses', type: 'address[]' }, { name: 'tag1', type: 'string' }, { name: 'tag2', type: 'string' }, { name: 'includeRevoked', type: 'bool' }], outputs: [{ name: 'clients', type: 'address[]' }, { name: 'feedbackIndexes', type: 'uint64[]' }, { name: 'values', type: 'int128[]' }, { name: 'valueDecimals', type: 'uint8[]' }, { name: 'tag1s', type: 'string[]' }, { name: 'tag2s', type: 'string[]' }, { name: 'revokedStatuses', type: 'bool[]' }] },
] as const

function AgentFeedback() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: base.id })
  const { ensurePaymasterSession } = usePaymasterSessionGuard()

  const isBase = chainId === base.id
  const connectedAddress = address ? getAddress(address) : null

  // ── State ──────────────────────────────────────────────────────────────
  const [agentIdInput, setAgentIdInput] = useState('0')
  const [feedbackValue, setFeedbackValue] = useState('5')
  const [feedbackTag1, setFeedbackTag1] = useState('')
  const [feedbackTag2, setFeedbackTag2] = useState('')
  const [feedbackReasoning, setFeedbackReasoning] = useState('')
  const [feedbackEndpoint, setFeedbackEndpoint] = useState('')
  const [feedbackURI, setFeedbackURI] = useState('')

  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string; txHash?: string }>({ status: 'idle' })

  // ── Summary query ──────────────────────────────────────────────────────
  const agentIdBigInt = (() => {
    try { return BigInt(agentIdInput.trim() || '0') } catch { return 0n }
  })()

  const clientsQuery = useReadContract({
    address: ERC8004_REPUTATION_REGISTRY as Address,
    abi: ERC8004_REPUTATION_REGISTRY_ABI,
    functionName: 'getClients',
    args: [agentIdBigInt],
    chainId: base.id,
  })

  const clientAddresses = useMemo(() => {
    if (!clientsQuery.data || !Array.isArray(clientsQuery.data)) return [] as Address[]
    return clientsQuery.data as Address[]
  }, [clientsQuery.data])

  const summaryQuery = useReadContract({
    address: ERC8004_REPUTATION_REGISTRY as Address,
    abi: ERC8004_REPUTATION_REGISTRY_ABI,
    functionName: 'getSummary',
    args: [agentIdBigInt, clientAddresses.length > 0 ? clientAddresses : ([] as Address[]), '', ''],
    chainId: base.id,
    query: { enabled: clientAddresses.length > 0 },
  })

  const summaryData = useMemo(() => {
    if (!summaryQuery.data) return null
    const [count, summaryValue, summaryValueDecimals] = summaryQuery.data as [bigint, bigint, number]
    const divisor = summaryValueDecimals > 0 ? 10 ** summaryValueDecimals : 1
    const displayValue = summaryValueDecimals === 0 ? String(Number(summaryValue)) : (Number(summaryValue) / divisor).toFixed(summaryValueDecimals)
    return { count: Number(count), displayValue, summaryValueDecimals }
  }, [summaryQuery.data])

  // ── All feedback query ─────────────────────────────────────────────────
  const [showAllFeedback, setShowAllFeedback] = useState(false)
  const allFeedbackQuery = useReadContract({
    address: ERC8004_REPUTATION_REGISTRY as Address,
    abi: ERC8004_REPUTATION_REGISTRY_ABI,
    functionName: 'readAllFeedback',
    args: [agentIdBigInt, clientAddresses.length > 0 ? clientAddresses : ([] as Address[]), '', '', true],
    chainId: base.id,
    query: { enabled: showAllFeedback && clientAddresses.length > 0 },
  })

  const allFeedback = useMemo(() => {
    if (!allFeedbackQuery.data) return []
    const [clients, indexes, values, decimals, tag1s, tag2s, revoked] = allFeedbackQuery.data as [
      Address[], bigint[], bigint[], number[], string[], string[], boolean[],
    ]
    return clients.map((c, i) => ({
      client: c,
      index: Number(indexes[i]),
      value: Number(values[i]),
      decimals: decimals[i],
      tag1: tag1s[i],
      tag2: tag2s[i],
      isRevoked: revoked[i],
    }))
  }, [allFeedbackQuery.data])

  // ── Submit feedback ────────────────────────────────────────────────────
  const submitFeedback = useCallback(async () => {
    if (!walletClient || !connectedAddress) return
    setSubmitState({ status: 'loading' })
    try {
      const agentId = BigInt(agentIdInput.trim() || '0')
      const value = BigInt(feedbackValue.trim() || '0')
      const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      const txHash = await walletClient.writeContract({
        account: (walletClient as any).account,
        chain: base as any,
        address: ERC8004_REPUTATION_REGISTRY as Address,
        abi: ERC8004_REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [agentId, value, 0, feedbackTag1, feedbackTag2, feedbackEndpoint, feedbackURI, zeroBytes32],
      })

      setSubmitState({ status: 'success', txHash })
      // Refresh queries
      void clientsQuery.refetch()
      void summaryQuery.refetch()
      if (showAllFeedback) void allFeedbackQuery.refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setSubmitState({ status: 'error', error: msg })
    }
  }, [walletClient, connectedAddress, agentIdInput, feedbackValue, feedbackTag1, feedbackTag2, feedbackEndpoint, feedbackURI, clientsQuery, summaryQuery, allFeedbackQuery, showAllFeedback])

  // ── Submit via paymaster (ERC-4337) ────────────────────────────────────
  const submitFeedbackViaPaymaster = useCallback(async () => {
    if (!connectedAddress || !walletClient || !publicClient) return
    setSubmitState({ status: 'loading' })
    try {
      // Ensure the paymaster has a valid app session before attempting sponsorship.
      await ensurePaymasterSession()
      const agentId = BigInt(agentIdInput.trim() || '0')
      const value = BigInt(feedbackValue.trim() || '0')
      const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

      const data = encodeFunctionData({
        abi: ERC8004_REPUTATION_REGISTRY_ABI as any,
        functionName: 'giveFeedback' as any,
        args: [agentId, value, 0, feedbackTag1, feedbackTag2, feedbackEndpoint, feedbackURI, zeroBytes32],
      })

      const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
      const paymasterUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
      const bundlerUrl = paymasterUrl

      const result = await sendCoinbaseSmartWalletUserOperation({
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        bundlerUrl,
        paymasterUrl,
        smartWallet: CANONICAL_SMART_WALLET as Address,
        ownerAddress: connectedAddress as Address,
        calls: [{ to: ERC8004_REPUTATION_REGISTRY as Address, value: 0n, data }],
      })

      setSubmitState({ status: 'success', txHash: typeof result === 'string' ? result : (result as any)?.hash ?? '' })
      void clientsQuery.refetch()
      void summaryQuery.refetch()
      if (showAllFeedback) void allFeedbackQuery.refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UserOp failed'
      setSubmitState({ status: 'error', error: msg })
    }
  }, [
    connectedAddress,
    agentIdInput,
    feedbackValue,
    feedbackTag1,
    feedbackTag2,
    feedbackEndpoint,
    feedbackURI,
    ensurePaymasterSession,
    publicClient,
    walletClient,
    clientsQuery,
    summaryQuery,
    allFeedbackQuery,
    showAllFeedback,
  ])

  // ── Star rating helper ─────────────────────────────────────────────────
  const stars = [1, 2, 3, 4, 5]
  const currentStars = Number(feedbackValue) || 0

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
        <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
          <div className="space-y-2">
            <div className="label">Reputation</div>
            <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">ERC-8004 Agent Feedback</div>
            <div className="text-sm text-zinc-600 max-w-prose">
              Submit and view feedback on the on-chain Reputation Registry (v2.0). Feedback uses the 5-star scale with optional tags and evidence.
            </div>
          </div>

          {/* Agent ID input */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
            <div className="text-sm text-zinc-300">Agent ID</div>
            <input
              value={agentIdInput}
              onChange={(e) => setAgentIdInput(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
            />
            <div className="text-xs text-zinc-600">
              Registry: <span className="font-mono text-zinc-400">{shortAddress(ERC8004_REPUTATION_REGISTRY)}</span> · Chain: Base
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
            <div className="text-sm text-zinc-300">Reputation summary</div>
            {clientsQuery.isLoading || summaryQuery.isLoading ? (
              <div className="text-xs text-zinc-500">Loading…</div>
            ) : summaryData && summaryData.count > 0 ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-zinc-100">{summaryData.displayValue}</span>
                  <span className="text-sm text-zinc-500">/ 5</span>
                  <span className="text-xs text-zinc-600">({summaryData.count} review{summaryData.count !== 1 ? 's' : ''})</span>
                </div>
                <div className="flex gap-1">
                  {stars.map((s) => (
                    <span key={s} className={Number(summaryData.displayValue) >= s ? 'text-amber-400' : 'text-zinc-700'}>★</span>
                  ))}
                </div>
                <div className="text-xs text-zinc-600">
                  {clientAddresses.length} unique reviewer{clientAddresses.length !== 1 ? 's' : ''}
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">No feedback yet for agent #{agentIdInput}.</div>
            )}
            <button
              type="button"
              onClick={() => { void clientsQuery.refetch(); void summaryQuery.refetch() }}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* All feedback */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-300">All feedback</div>
              <button
                type="button"
                onClick={() => { setShowAllFeedback(!showAllFeedback); if (!showAllFeedback) void allFeedbackQuery.refetch() }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                {showAllFeedback ? 'Hide' : 'Show'}
              </button>
            </div>
            {showAllFeedback && allFeedbackQuery.isLoading ? (
              <div className="text-xs text-zinc-500">Loading…</div>
            ) : showAllFeedback && allFeedback.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allFeedback.map((fb) => (
                  <div key={`${fb.client}-${fb.index}`} className="rounded-lg border border-white/5 bg-white/2 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-zinc-400">{shortAddress(fb.client)}</span>
                      <span className="text-zinc-600">#{fb.index}</span>
                      {fb.isRevoked && <span className="text-red-400/80">revoked</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {stars.map((s) => (
                          <span key={s} className={`text-xs ${fb.value >= s ? 'text-amber-400' : 'text-zinc-700'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-sm text-zinc-200">{fb.decimals === 0 ? fb.value : (fb.value / 10 ** fb.decimals).toFixed(fb.decimals)}</span>
                    </div>
                    {(fb.tag1 || fb.tag2) && (
                      <div className="flex gap-1.5 text-[10px]">
                        {fb.tag1 && <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{fb.tag1}</span>}
                        {fb.tag2 && <span className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{fb.tag2}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : showAllFeedback ? (
              <div className="text-xs text-zinc-500">No feedback found.</div>
            ) : null}
          </div>

          {/* Submit feedback */}
          {isConnected ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-4">
              <div className="text-sm text-zinc-300">Submit feedback</div>

              {/* Star selector */}
              <div className="space-y-1">
                <div className="text-xs text-zinc-500">Rating</div>
                <div className="flex gap-2">
                  {stars.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFeedbackValue(String(s))}
                      className={`text-2xl transition-colors ${currentStars >= s ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-sm text-zinc-500 self-center ml-2">{currentStars}/5</span>
                </div>
              </div>

              {/* Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Tag 1</div>
                  <input
                    value={feedbackTag1}
                    onChange={(e) => setFeedbackTag1(e.target.value)}
                    placeholder="e.g. fast, accurate"
                    className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">Tag 2</div>
                  <input
                    value={feedbackTag2}
                    onChange={(e) => setFeedbackTag2(e.target.value)}
                    placeholder="e.g. good-value"
                    className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>

              {/* Endpoint */}
              <div className="space-y-1">
                <div className="text-xs text-zinc-500">Endpoint tested (optional)</div>
                <input
                  value={feedbackEndpoint}
                  onChange={(e) => setFeedbackEndpoint(e.target.value)}
                  placeholder="https://4626.fun/api/v1/..."
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
                />
              </div>

              {/* Feedback URI (evidence) */}
              <div className="space-y-1">
                <div className="text-xs text-zinc-500">Evidence URI (optional, IPFS/HTTPS)</div>
                <input
                  value={feedbackURI}
                  onChange={(e) => setFeedbackURI(e.target.value)}
                  placeholder="ipfs://bafkrei... or https://..."
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
                />
              </div>

              {/* Reasoning */}
              <div className="space-y-1">
                <div className="text-xs text-zinc-500">Reasoning (for your records, not stored on-chain)</div>
                <textarea
                  value={feedbackReasoning}
                  onChange={(e) => setFeedbackReasoning(e.target.value)}
                  placeholder="Describe your experience…"
                  rows={3}
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 resize-none"
                />
              </div>

              {!isBase ? (
                <button
                  type="button"
                  onClick={async () => { if (switchChainAsync) await switchChainAsync({ chainId: base.id }) }}
                  disabled={switchPending}
                  className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {switchPending ? 'Switching…' : 'Switch to Base'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void submitFeedback()}
                    disabled={submitState.status === 'loading' || !walletClient}
                    className="btn-accent flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitState.status === 'loading' ? 'Submitting…' : 'Submit (direct)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitFeedbackViaPaymaster()}
                    disabled={submitState.status === 'loading'}
                    className="btn-ghost flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitState.status === 'loading' ? 'Submitting…' : 'Submit (sponsored)'}
                  </button>
                </div>
              )}

              {submitState.status === 'success' && submitState.txHash ? (
                <div className="text-xs text-emerald-300/90 space-y-1">
                  <div>Feedback submitted!</div>
                  <a
                    href={`https://basescan.org/tx/${submitState.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    {shortAddress(submitState.txHash)} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : null}
              {submitState.status === 'error' ? (
                <div className="text-xs text-red-400/80">{submitState.error}</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="label">Connect to submit feedback</div>
              <ConnectButton />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ShareTokenMetadata() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()
  const { ensurePaymasterSession } = usePaymasterSessionGuard()
  const [embeddedPrivyEoaAddress, setEmbeddedPrivyEoaAddress] = useState<string | null>(null)
  const [shareOftInput, setShareOftInput] = useState('')
  const [vaultInput, setVaultInput] = useState('')
  const [contractUri, setContractUri] = useState('')
  const [metadataState, setMetadataState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>({
    status: 'idle',
  })
  const [resolveState, setResolveState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>({
    status: 'idle',
  })
  const [txState, setTxState] = useState<TxState>({ status: 'idle' })
  const [metadataPreview, setMetadataPreview] = useState<{ lensUri?: string; gatewayUrl?: string } | null>(null)

  const connectedAddress = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address)
  }, [address])

  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])

  useEffect(() => {
    let cancelled = false
    if (!embeddedPrivyWallet) {
      setEmbeddedPrivyEoaAddress(null)
      return () => {}
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedPrivyEoaAddress(addr)
      } catch {
        if (!cancelled) setEmbeddedPrivyEoaAddress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet])

  const isBase = chainId === base.id
  const canonicalCswAddress = useMemo(() => getAddress(CANONICAL_SMART_WALLET), [])
  const isCanonical = connectedAddress?.toLowerCase() === canonicalCswAddress.toLowerCase()

  const canonicalOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [connectedAddress ?? ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!connectedAddress },
  })
  const connectedIsCanonicalOwner = canonicalOwnerQuery.data === true

  const embeddedOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [embeddedPrivyEoaAddress ? (embeddedPrivyEoaAddress as Address) : ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!embeddedPrivyEoaAddress },
  })
  const embeddedIsCanonicalOwner = embeddedOwnerQuery.data === true

  const shareOftAddress = useMemo(() => {
    const raw = shareOftInput.trim()
    return raw && isAddress(raw) ? (getAddress(raw) as Address) : null
  }, [shareOftInput])

  const vaultAddress = useMemo(() => {
    const raw = vaultInput.trim()
    return raw && isAddress(raw) ? (getAddress(raw) as Address) : null
  }, [vaultInput])

  const contractUriQuery = useReadContract({
    address: (shareOftAddress ?? ZERO_ADDRESS) as Address,
    abi: SHARE_OFT_METADATA_ABI,
    functionName: 'contractURI',
    chainId: base.id,
    query: { enabled: !!shareOftAddress },
  })
  const currentContractUri = typeof contractUriQuery.data === 'string' ? contractUriQuery.data : null

  async function generateGroveMetadata() {
    if (!shareOftAddress) {
      setMetadataState({ status: 'error', error: 'ShareOFT address is required.' })
      return
    }
    setMetadataState({ status: 'loading' })
    setMetadataPreview(null)
    try {
      const qs = new URLSearchParams({ address: shareOftAddress, chain: String(base.id), store: 'true' })
      const res = await fetch(`/api/lens/share-token-metadata?${qs.toString()}`)
      const payload = (await res.json().catch(() => null)) as any
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `Request failed (${res.status}).`)
      }
      const data = payload?.data ?? {}
      const lensUri = data?.contractUri || data?.grove?.lensUri
      const gatewayUrl = data?.grove?.gatewayUrl
      if (lensUri) setContractUri(String(lensUri))
      setMetadataPreview({ lensUri, gatewayUrl })
      setMetadataState({ status: 'success' })
    } catch (e: any) {
      setMetadataState({ status: 'error', error: String(e?.message || 'Failed to generate metadata') })
    }
  }

  async function resolveShareOft() {
    if (!publicClient) return
    setResolveState({ status: 'loading' })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!vaultAddress) {
        throw new Error('Vault address is required.')
      }
      const shareOft = await resolveShareOftFromVault(publicClient as any, vaultAddress)
      if (!shareOft) {
        throw new Error('No ShareOFT found for this vault.')
      }
      setShareOftInput(shareOft)
      setResolveState({ status: 'success' })
    } catch (e: any) {
      setResolveState({ status: 'error', error: String(e?.message || 'Failed to resolve ShareOFT') })
    }
  }

  async function setShareTokenContractUri() {
    if (!publicClient) return
    setTxState({ status: 'pending' })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!shareOftAddress) {
        throw new Error('ShareOFT address is required.')
      }
      const trimmedUri = contractUri.trim()
      if (!trimmedUri) throw new Error('Contract URI is required.')

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: shareOftAddress,
          abi: SHARE_OFT_METADATA_ABI,
          functionName: 'setContractURI',
          args: [trimmedUri],
        })
        setTxState({ status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        setTxState({ status: 'success', hash })
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: SHARE_OFT_METADATA_ABI as any,
          functionName: 'setContractURI' as any,
          args: [trimmedUri],
        })
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: shareOftAddress, data }],
        })
        setTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setTxState({ status: 'success', hash: result.transactionHash })
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: SHARE_OFT_METADATA_ABI as any,
          functionName: 'setContractURI' as any,
          args: [trimmedUri],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: shareOftAddress, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        setTxState({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        setTxState({ status: 'success', hash: result.transactionHash })
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      setTxState({ status: 'error', error: toFriendlyTxError(e) })
    }
  }

  return (
    <section id="share-token-metadata" className="cinematic-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
            <div className="space-y-2">
              <div className="label">Admin Ops</div>
              <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Share token metadata</div>
              <div className="text-sm text-zinc-600 max-w-prose">
                Generate contract metadata, pin it to Lens Grove, then set the ShareOFT <span className="font-mono text-zinc-400">contractURI</span>.
              </div>
            </div>

            {!isConnected ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="label">Connect</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm">
                <div className="text-zinc-400">Connected wallet</div>
                <div className="font-mono text-zinc-200">{connectedAddress}</div>
                <div className="text-xs text-zinc-500">
                  Canonical CSW: <span className="font-mono text-zinc-300">{shortAddress(canonicalCswAddress)}</span>
                </div>
                {!isBase ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!switchChainAsync) return
                      await switchChainAsync({ chainId: base.id })
                    }}
                    disabled={switchPending}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="text-sm text-zinc-300">Vault address (optional)</div>
              <input
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="0x..."
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <button
                type="button"
                onClick={() => void resolveShareOft()}
                disabled={resolveState.status === 'loading' || !vaultAddress}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolveState.status === 'loading' ? 'Resolving…' : 'Resolve ShareOFT from vault'}
              </button>
              {resolveState.status === 'error' ? <div className="text-xs text-red-400">{resolveState.error}</div> : null}

              <div className="text-sm text-zinc-300">ShareOFT address</div>
              <input
                value={shareOftInput}
                onChange={(e) => setShareOftInput(e.target.value)}
                placeholder="0x..."
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <div className="text-xs text-zinc-600">
                Current contractURI:{' '}
                <span className="font-mono text-zinc-400">{currentContractUri ? shortAddress(currentContractUri) : '—'}</span>
              </div>

              <button
                type="button"
                onClick={() => void generateGroveMetadata()}
                disabled={metadataState.status === 'loading' || !shareOftAddress}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {metadataState.status === 'loading' ? 'Generating…' : 'Generate Grove metadata'}
              </button>
              {metadataState.status === 'error' ? <div className="text-xs text-red-400">{metadataState.error}</div> : null}

              {metadataPreview?.lensUri ? (
                <div className="text-xs text-zinc-500">
                  Grove URI: <span className="font-mono text-zinc-300">{metadataPreview.lensUri}</span>
                </div>
              ) : null}
              {metadataPreview?.gatewayUrl ? (
                <a
                  className="text-xs text-brand-accent hover:text-brand-primary"
                  href={metadataPreview.gatewayUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Grove gateway
                </a>
              ) : null}

              <div className="text-xs text-zinc-600">Contract URI</div>
              <input
                value={contractUri}
                onChange={(e) => setContractUri(e.target.value)}
                placeholder="lens://..."
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <button
                type="button"
                onClick={() => void setShareTokenContractUri()}
                disabled={txState.status === 'pending' || !shareOftAddress || !contractUri.trim()}
                className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {txState.status === 'pending' ? 'Setting…' : 'Set contractURI on ShareOFT'}
              </button>
              <TxMeta state={txState} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

type LegacyVaultWithdrawalCardProps = {
  legacy: LegacyVaultResolved
  legacyResolveStatus: 'idle' | 'loading' | 'done' | 'error'
  amountInput: string
  setAmountInput: (next: string) => void
  receiver: string
  receiverValid: boolean
  canonicalCswAddress: Address
  connectedAddress: Address | null
  canUseSmartWallet: boolean
  isConnected: boolean
  isBase: boolean
  blockNumber: bigint | undefined
  walletClient: unknown
  txStates: Record<string, TxState>
  sendTx: (
    key: string,
    config: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] },
  ) => Promise<void>
  sendBatchTx: (key: string, calls: Array<{ to: Address; data: Hex }>) => Promise<void>
}

function LegacyVaultWithdrawalCard({
  legacy,
  legacyResolveStatus,
  amountInput,
  setAmountInput,
  receiver,
  receiverValid,
  canonicalCswAddress,
  connectedAddress,
  canUseSmartWallet,
  isConnected,
  isBase,
  blockNumber,
  walletClient,
  txStates,
  sendTx,
  sendBatchTx,
}: LegacyVaultWithdrawalCardProps) {
  const parsedAmount = parseAmount(amountInput)
  const sharesToQueue = parsedAmount ? parsedAmount * 1000n : null
  const hasShareOft = isAddress(legacy.shareOft)
  const hasWrapper = isAddress(legacy.wrapper)
  const hasVault = isAddress(legacy.vault)
  const hasVesting = isAddress(legacy.vesting)
  const isEmptyAutoSlot =
    legacy.id.startsWith('legacy-auto-') && !hasShareOft && !hasWrapper && !hasVault && !hasVesting
  const hasResolvedContracts = hasShareOft && hasWrapper && hasVault
  const balanceAccount = canUseSmartWallet ? canonicalCswAddress : (connectedAddress ?? (ZERO_ADDRESS as Address))
  const balanceLabel = canUseSmartWallet ? 'CSW balance' : 'Connected balance'

  const shareOftAddress = (hasShareOft ? legacy.shareOft : ZERO_ADDRESS) as Address
  const wrapperAddress = (hasWrapper ? legacy.wrapper : ZERO_ADDRESS) as Address
  const vaultAddress = (hasVault ? legacy.vault : ZERO_ADDRESS) as Address
  const vestingAddress = (hasVesting ? legacy.vesting : ZERO_ADDRESS) as Address

  const balanceQuery = useReadContract({
    address: shareOftAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [balanceAccount as Address],
    query: { enabled: hasShareOft && canUseSmartWallet },
  })
  const releasableQuery = useReadContract({
    address: vestingAddress,
    abi: VESTING_ABI,
    functionName: 'releasable',
    query: { enabled: hasVesting },
  })
  const queuedQuery = useReadContract({
    address: vaultAddress,
    abi: QUEUED_WITHDRAWAL_ABI,
    functionName: 'queuedWithdrawals',
    args: [canonicalCswAddress],
    chainId: base.id,
    query: { enabled: canUseSmartWallet && isBase && hasVault },
  })
  const thresholdQuery = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'largeWithdrawalThreshold',
    chainId: base.id,
    query: { enabled: isBase && hasVault },
  })
  const vaultAssetQuery = useReadContract({
    address: vaultAddress,
    abi: VAULT_EMERGENCY_ABI,
    functionName: 'asset',
    chainId: base.id,
    query: { enabled: isBase && hasVault },
  })
  const vaultAssetRaw = vaultAssetQuery.data as Address | undefined
  const vaultAsset = vaultAssetRaw && isAddress(vaultAssetRaw) ? getAddress(vaultAssetRaw) : null
  const vaultShutdownQuery = useReadContract({
    address: vaultAddress,
    abi: VAULT_EMERGENCY_ABI,
    functionName: 'isShutdown',
    chainId: base.id,
    query: { enabled: isBase && hasVault },
  })
  const vaultAssetBalanceQuery = useReadContract({
    address: ((vaultAsset ?? ZERO_ADDRESS) as Address),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [vaultAddress],
    chainId: base.id,
    query: { enabled: isBase && hasVault && !!vaultAsset },
  })
  const previewRedeemQuery = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'previewRedeem',
    args: [sharesToQueue ?? 0n],
    chainId: base.id,
    query: { enabled: isBase && hasVault && !!sharesToQueue },
  })

  const releaseKey = `release-${legacy.id}`
  const unwrapKey = `unwrap-${legacy.id}`
  const queueKey = `queue-${legacy.id}`
  const claimKey = `claim-${legacy.id}`
  const oneClickKey = `oneclick-${legacy.id}`
  const shutdownKey = `shutdown-${legacy.id}`
  const emergencyPullKey = `emergency-pull-${legacy.id}`
  const emergencyDrainKey = `emergency-drain-${legacy.id}`

  const balance = balanceQuery.data as bigint | undefined
  const releasable = releasableQuery.data as bigint | undefined
  const largeWithdrawalThreshold = thresholdQuery.data as bigint | undefined
  const vaultIsShutdown = vaultShutdownQuery.data === true
  const vaultAssetBalance = vaultAssetBalanceQuery.data as bigint | undefined
  const previewRedeem = previewRedeemQuery.data as bigint | undefined
  const hasReleasable = typeof releasable === 'bigint' && releasable > 0n
  const isBalanceZero = typeof balance === 'bigint' && balance === 0n
  const queued = queuedQuery.data as
    | readonly [bigint, bigint, Address]
    | { shares: bigint; unlockBlock: bigint; receiver: Address }
    | undefined
  const isQueuedObject = (value: typeof queued): value is { shares: bigint; unlockBlock: bigint; receiver: Address } => {
    return Boolean(value) && !Array.isArray(value)
  }
  const queuedTuple = Array.isArray(queued)
    ? queued
    : isQueuedObject(queued)
      ? ([queued.shares, queued.unlockBlock, queued.receiver] as const)
      : null
  const queuedShares = queuedTuple ? queuedTuple[0] : undefined
  const queuedUnlockBlock = queuedTuple ? queuedTuple[1] : undefined
  const hasQueued = typeof queuedShares === 'bigint' && queuedShares > 0n
  const currentBlock = typeof blockNumber === 'bigint' ? blockNumber : null
  const isUnlocked =
    hasQueued && typeof queuedUnlockBlock === 'bigint' && currentBlock !== null ? currentBlock >= queuedUnlockBlock : false
  const blocksRemaining =
    hasQueued && typeof queuedUnlockBlock === 'bigint' && currentBlock !== null && queuedUnlockBlock > currentBlock
      ? queuedUnlockBlock - currentBlock
      : null
  const maxAvailable = (typeof balance === 'bigint' ? balance : 0n) + (hasReleasable ? (releasable ?? 0n) : 0n)
  const oneClickAmount = parsedAmount ?? (maxAvailable > 0n ? maxAvailable : null)
  const oneClickShares = typeof oneClickAmount === 'bigint' ? oneClickAmount * 1000n : null
  const exceedsAvailable =
    typeof oneClickAmount === 'bigint' && typeof maxAvailable === 'bigint' ? oneClickAmount > maxAvailable : false

  const previewRedeemOneClickQuery = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'previewRedeem',
    args: [oneClickShares ?? 0n],
    chainId: base.id,
    query: { enabled: isBase && hasVault && !!oneClickShares },
  })
  const previewRedeemOneClick = previewRedeemOneClickQuery.data as bigint | undefined
  const shouldQueue =
    typeof previewRedeem === 'bigint' && typeof largeWithdrawalThreshold === 'bigint' ? previewRedeem >= largeWithdrawalThreshold : true
  const shouldQueueOneClick =
    typeof previewRedeemOneClick === 'bigint' && typeof largeWithdrawalThreshold === 'bigint'
      ? previewRedeemOneClick >= largeWithdrawalThreshold
      : true

  const canUnwrap = isConnected && isBase && canUseSmartWallet && hasResolvedContracts && !!parsedAmount
  const canQueue = isConnected && isBase && canUseSmartWallet && hasVault && !!parsedAmount && receiverValid && shouldQueue
  const canRedeem =
    isConnected && isBase && canUseSmartWallet && hasVault && !!parsedAmount && receiverValid && !shouldQueue
  const canClaim = isConnected && isBase && canUseSmartWallet && hasVault && hasQueued && isUnlocked
  const canOneClick =
    isConnected &&
    isBase &&
    canUseSmartWallet &&
    hasResolvedContracts &&
    receiverValid &&
    typeof oneClickAmount === 'bigint' &&
    oneClickAmount > 0n &&
    !exceedsAvailable
  const canEmergencyShutdown = isConnected && isBase && canUseSmartWallet && hasVault && !vaultIsShutdown
  const canEmergencyPull = isConnected && isBase && canUseSmartWallet && hasVault && vaultIsShutdown
  const canEmergencyDrain =
    isConnected &&
    isBase &&
    canUseSmartWallet &&
    hasVault &&
    vaultIsShutdown &&
    receiverValid &&
    typeof vaultAssetBalance === 'bigint' &&
    vaultAssetBalance > 0n

  const queueConfig = {
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'queueWithdrawal',
    args: [sharesToQueue ?? 0n, receiver as Address],
  }
  const redeemConfig = {
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'redeem',
    args: [sharesToQueue ?? 0n, receiver as Address, canonicalCswAddress as Address],
  }
  const emergencyShutdownConfig = {
    address: vaultAddress,
    abi: VAULT_EMERGENCY_ABI,
    functionName: 'shutdownVault',
  }
  const emergencyPullConfig = {
    address: vaultAddress,
    abi: VAULT_EMERGENCY_ABI,
    functionName: 'emergencyWithdrawFromStrategies',
  }
  const emergencyDrainConfig = {
    address: vaultAddress,
    abi: VAULT_EMERGENCY_ABI,
    functionName: 'emergencyWithdraw',
    args: [vaultAssetBalance ?? 0n, receiver as Address],
  }

  const oneClickCalls: Array<{ to: Address; data: Hex }> = []
  if (hasVesting && hasReleasable) {
    oneClickCalls.push({
      to: vestingAddress,
      data: encodeFunctionData({ abi: VESTING_ABI as any, functionName: 'release' }),
    })
  }
  if (typeof oneClickAmount === 'bigint' && oneClickAmount > 0n) {
    oneClickCalls.push({
      to: wrapperAddress,
      data: encodeFunctionData({
        abi: WRAPPER_ABI as any,
        functionName: 'unwrap',
        args: [oneClickAmount],
      }),
    })
    if (receiverValid) {
      if (shouldQueueOneClick) {
        oneClickCalls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_ABI as any,
            functionName: 'queueWithdrawal',
            args: [oneClickShares ?? 0n, receiver as Address],
          }),
        })
      } else {
        oneClickCalls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_ABI as any,
            functionName: 'redeem',
            args: [oneClickShares ?? 0n, receiver as Address, canonicalCswAddress as Address],
          }),
        })
      }
    }
  }

  if (isEmptyAutoSlot) return null

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-300">{legacy.label}</div>
          <div className="text-xs text-zinc-600 font-mono">ShareOFT {hasShareOft ? legacy.shareOft : '—'}</div>
          <div className="text-xs text-zinc-600 font-mono">Wrapper {hasWrapper ? legacy.wrapper : '—'}</div>
          <div className="text-xs text-zinc-600 font-mono">Vault {hasVault ? legacy.vault : '—'}</div>
          <div className="text-xs text-zinc-600 font-mono">Vesting {hasVesting ? legacy.vesting : '—'}</div>
          {!hasResolvedContracts ? (
            <div className="text-xs text-amber-300/80">
              {legacyResolveStatus === 'loading'
                ? 'Resolving wrapper/shareOFT/vault from registry…'
                : 'Registry match not found for this vault.'}
            </div>
          ) : null}
          {!hasVesting ? (
            <div className="text-xs text-amber-300/80">Vesting contract not found for the canonical CSW.</div>
          ) : null}
        </div>
        <div className="text-xs text-zinc-500">
          {balanceLabel}: <span className="text-zinc-200">{formatToken(balance)}</span>
        </div>
        {hasReleasable && isBalanceZero ? (
          <div className="text-xs text-amber-300/80">
            Release from vesting to move ShareOFT into the canonical smart wallet.
          </div>
        ) : null}
        {exceedsAvailable ? (
          <div className="text-xs text-amber-300/80">One-click amount exceeds available ShareOFT.</div>
        ) : null}
      </div>

      <div className="rounded-lg border border-white/10 p-4 space-y-2">
        <div className="text-sm text-zinc-300">One-click withdraw</div>
        <div className="text-xs text-zinc-500">
          {shouldQueueOneClick
            ? 'Release + unwrap + queue in a single transaction.'
            : 'Release + unwrap + withdraw now in a single transaction.'}
        </div>
        <button
          type="button"
          onClick={() => sendBatchTx(oneClickKey, oneClickCalls)}
          disabled={!canOneClick}
          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          One-click withdraw
        </button>
        <TxMeta state={txStates[oneClickKey]} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 p-4 space-y-2">
          <div className="text-sm text-zinc-300">Step 1 · Release vested ShareOFT</div>
          <div className="text-xs text-zinc-500">
            Releasable now: <span className="text-zinc-200">{formatToken(releasable)}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              sendTx(releaseKey, {
                address: vestingAddress,
                abi: VESTING_ABI,
                functionName: 'release',
              })
            }
            disabled={!isBase || !walletClient || !canUseSmartWallet || !hasVesting}
            className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Release from vesting
          </button>
          <TxMeta state={txStates[releaseKey]} />
        </div>

        <div className="rounded-lg border border-white/10 p-4 space-y-2">
          <div className="text-sm text-zinc-300">Step 2 · Unwrap ShareOFT → Vault shares</div>
          <div className="text-xs text-zinc-500">Amount to unwrap</div>
          <div className="flex gap-2">
            <input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (typeof balance === 'bigint') setAmountInput(formatToken(balance))
              }}
              className="px-3 py-2 rounded-lg border border-white/10 text-xs text-zinc-300 hover:border-white/20"
            >
              Max
            </button>
          </div>
          <div className="text-xs text-zinc-600">
            Vault shares to queue: <span className="text-zinc-200">{sharesToQueue ? formatToken(sharesToQueue) : '—'}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              sendTx(unwrapKey, {
                address: wrapperAddress,
                abi: WRAPPER_ABI,
                functionName: 'unwrap',
                args: [parsedAmount ?? 0n],
              })
            }
            disabled={!canUnwrap}
            className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unwrap ShareOFT
          </button>
          <TxMeta state={txStates[unwrapKey]} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 p-4 space-y-2">
          <div className="text-sm text-zinc-300">{shouldQueue ? 'Step 3 · Queue withdrawal' : 'Step 3 · Withdraw now'}</div>
          <div className="text-xs text-zinc-500">
            {shouldQueue
              ? 'Large withdrawals require queueing. Wait 10 blocks, then claim.'
              : 'Small withdrawals redeem immediately (no queue).'}
          </div>
          <button
            type="button"
            onClick={() => sendTx(queueKey, shouldQueue ? queueConfig : redeemConfig)}
            disabled={shouldQueue ? !canQueue : !canRedeem}
            className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {shouldQueue ? 'Queue withdrawal' : 'Withdraw now'}
          </button>
          <TxMeta state={txStates[queueKey]} />
        </div>

        <div className="rounded-lg border border-white/10 p-4 space-y-2">
          <div className="text-sm text-zinc-300">Step 4 · Claim queued withdrawal</div>
          <div className="text-xs text-zinc-500">Use after 10 blocks have passed.</div>
          {hasQueued ? (
            <div className="text-xs text-zinc-500">
              {isUnlocked
                ? 'Queued withdrawal is ready to claim.'
                : blocksRemaining !== null
                  ? `Unlocks in ~${blocksRemaining.toString()} blocks.`
                  : 'Queued withdrawal pending.'}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">No queued withdrawal found.</div>
          )}
          <button
            type="button"
            onClick={() =>
              sendTx(claimKey, {
                address: vaultAddress,
                abi: VAULT_ABI,
                functionName: 'claimQueuedWithdrawal',
              })
            }
            disabled={!canClaim}
            className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Claim withdrawal
          </button>
          <TxMeta state={txStates[claimKey]} />
        </div>
      </div>

      <div className="rounded-lg border border-red-500/25 bg-red-500/4 p-4 space-y-3">
        <div className="text-sm text-red-200">Emergency recovery (advanced)</div>
        <div className="text-xs text-red-200/80">
          Use only when normal withdraw flow is blocked. Sequence: shutdown vault, pull from strategies, then drain vault
          asset to receiver.
        </div>
        <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
          <div>
            Vault shutdown:{' '}
            <span className={vaultIsShutdown ? 'text-emerald-300' : 'text-zinc-300'}>{vaultIsShutdown ? 'Yes' : 'No'}</span>
          </div>
          <div>
            Vault asset:{' '}
            <span className="font-mono text-zinc-300">{vaultAsset ? shortAddress(vaultAsset) : 'Unknown'}</span>
          </div>
          <div className="sm:col-span-2">
            Idle vault asset balance: <span className="text-zinc-200">{formatToken(vaultAssetBalance)}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => sendTx(shutdownKey, emergencyShutdownConfig)}
              disabled={!canEmergencyShutdown}
              className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Shutdown vault
            </button>
            <TxMeta state={txStates[shutdownKey]} />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => sendTx(emergencyPullKey, emergencyPullConfig)}
              disabled={!canEmergencyPull}
              className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pull from strategies
            </button>
            <TxMeta state={txStates[emergencyPullKey]} />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => sendTx(emergencyDrainKey, emergencyDrainConfig)}
              disabled={!canEmergencyDrain}
              className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Drain vault asset
            </button>
            <TxMeta state={txStates[emergencyDrainKey]} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LegacyWithdrawals() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()
  const { ensurePaymasterSession } = usePaymasterSessionGuard()
  const { client: smartWalletClient } = useSmartWallets()
  const { data: blockNumber } = useBlockNumber({ chainId: base.id, watch: true })
  const [embeddedPrivyEoaAddress, setEmbeddedPrivyEoaAddress] = useState<string | null>(null)

  const connectedAddress = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address)
  }, [address])

  const privySmartWalletAddress = useMemo(() => {
    try {
      const addr = smartWalletClient?.account?.address
      return addr && isAddress(addr) ? getAddress(addr) : null
    } catch {
      return null
    }
  }, [smartWalletClient])

  const privyWalletCswAddress = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    const csw = ws.find((w) => {
      const t = normalizeType(w)
      return t.includes('coinbase_smart_wallet') || t.includes('coinbase-smart-wallet')
    })
    const raw = typeof (csw as any)?.address === 'string' ? String((csw as any).address) : ''
    return isAddress(raw) ? getAddress(raw) : null
  }, [privyWallets])
  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])
  const canonicalCswAddress = useMemo(() => getAddress(CANONICAL_SMART_WALLET), [])
  const privyCswAddress = privySmartWalletAddress ?? privyWalletCswAddress
  const privyCswIsCanonical = useMemo(() => {
    if (!privyCswAddress) return false
    return privyCswAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, privyCswAddress])

  const canonicalOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [connectedAddress ?? '0x0000000000000000000000000000000000000000'],
    chainId: base.id,
    query: { enabled: !!connectedAddress },
  })
  const connectedIsCanonicalOwner = canonicalOwnerQuery.data === true
  const embeddedOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [embeddedPrivyEoaAddress ? (embeddedPrivyEoaAddress as Address) : ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!embeddedPrivyEoaAddress },
  })
  const embeddedIsCanonicalOwner = embeddedOwnerQuery.data === true

  const [receiver, setReceiver] = useState<string>('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [txStates, setTxStates] = useState<Record<string, TxState>>({})
  const [legacyOverrides, setLegacyOverrides] = useState<Record<string, Partial<LegacyVaultResolved>>>({})
  const [legacyResolveStatus, setLegacyResolveStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [legacyResolveError, setLegacyResolveError] = useState<string | null>(null)

  const legacyVaults = useMemo<LegacyVaultResolved[]>(() => {
    return LEGACY_VAULT_HINTS.map((hint) => {
      const override = legacyOverrides[hint.id] ?? {}
      return {
        id: hint.id,
        label: override.label ?? hint.label,
        vaultHint: hint.vaultHint,
        vault: override.vault ?? hint.vault ?? ZERO_ADDRESS,
        wrapper: override.wrapper ?? hint.wrapper ?? ZERO_ADDRESS,
        shareOft: override.shareOft ?? hint.shareOft ?? ZERO_ADDRESS,
        vesting: override.vesting ?? hint.vesting ?? ZERO_ADDRESS,
        resolvedFrom: override.resolvedFrom ?? (hint.vault ? 'static' : 'unknown'),
      }
    })
  }, [legacyOverrides])

  const unresolvedHintIds = useMemo(() => {
    return LEGACY_STATIC_VAULT_HINTS.filter((hint) => hint.vaultHint && !legacyOverrides[hint.id]?.vault)
      .map((hint) => hint.id)
      .join(',')
  }, [legacyOverrides])

  useEffect(() => {
    if (connectedAddress && !receiver) setReceiver(connectedAddress)
  }, [connectedAddress, receiver])
  useEffect(() => {
    let cancelled = false
    if (!embeddedPrivyWallet) {
      setEmbeddedPrivyEoaAddress(null)
      return () => {}
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedPrivyEoaAddress(addr)
      } catch {
        if (!cancelled) setEmbeddedPrivyEoaAddress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet])

  const isBase = chainId === base.id
  const isCanonical = connectedAddress?.toLowerCase() === CANONICAL_SMART_WALLET.toLowerCase()
  const hasEmbeddedSigner = Boolean(embeddedPrivyEoaAddress && embeddedPrivyWallet)
  const canSubmitViaOwner = (connectedIsCanonicalOwner || embeddedIsCanonicalOwner) && !isCanonical
  const canUseSmartWallet = Boolean(
    publicClient &&
      ((isCanonical && walletClient) ||
        (embeddedIsCanonicalOwner && hasEmbeddedSigner) ||
        (connectedIsCanonicalOwner && walletClient)),
  )
  const detectedCsw = useMemo(() => {
    if (isCanonical) return { address: canonicalCswAddress, source: 'connected' as const }
    if (connectedIsCanonicalOwner) return { address: canonicalCswAddress, source: 'owner' as const }
    if (privyCswIsCanonical) return { address: canonicalCswAddress, source: 'privy' as const }
    if (privyCswAddress) return { address: privyCswAddress, source: 'privy-noncanonical' as const }
    return { address: null, source: null }
  }, [canonicalCswAddress, connectedIsCanonicalOwner, isCanonical, privyCswAddress, privyCswIsCanonical])
  const detectedCswLabel = useMemo(() => {
    switch (detectedCsw.source) {
      case 'privy':
        return 'Privy smart wallet'
      case 'privy-noncanonical':
        return 'Privy smart wallet (non-canonical)'
      case 'connected':
        return 'Connected wallet'
      case 'owner':
        return 'Owner check'
      default:
        return null
    }
  }, [detectedCsw.source])
  const detectedCswMismatch = useMemo(() => {
    if (!detectedCsw.address) return false
    return detectedCsw.address.toLowerCase() !== canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, detectedCsw.address])

  useEffect(() => {
    let cancelled = false
    if (!publicClient) return () => {}

    const registryAddress = CONTRACTS.registry
    if (!registryAddress || !isAddress(registryAddress)) return () => {}

    setLegacyResolveStatus('loading')
    setLegacyResolveError(null)

    ;(async () => {
      try {
        const tokens = (await publicClient.readContract({
          address: registryAddress as Address,
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'getAllCreatorCoins',
        })) as Address[]

        const vaultMap = new Map<string, { vault: Address; wrapper: Address; shareOft: Address }>()
        if (Array.isArray(tokens) && tokens.length > 0) {
          const calls = tokens.map((token) => ({
            address: registryAddress as Address,
            abi: CREATOR_REGISTRY_ABI,
            functionName: 'getCreatorCoin',
            args: [token],
          }))

          const results: any[] = []
          const chunkSize = 120
          for (let i = 0; i < calls.length; i += chunkSize) {
            const chunk = calls.slice(i, i + chunkSize)
            const chunkResults = await publicClient.multicall({ contracts: chunk, allowFailure: true })
            results.push(...chunkResults)
          }

          results.forEach((res) => {
            if (res.status !== 'success') return
            const info = res.result as any
            const vault = info?.vault as Address | undefined
            const wrapper = info?.wrapper as Address | undefined
            const shareOft = (info?.shareOFT ?? info?.shareOft) as Address | undefined
            if (!vault || !wrapper || !shareOft) return
            if (!isAddress(vault) || !isAddress(wrapper) || !isAddress(shareOft)) return
            vaultMap.set(String(vault).toLowerCase(), {
              vault: getAddress(vault),
              wrapper: getAddress(wrapper),
              shareOft: getAddress(shareOft),
            })
          })
        }

        const phase1Map = await fetchLegacyPhase1Map(publicClient, canonicalCswAddress as Address)
        for (const [vaultKey, record] of phase1Map.entries()) {
          if (!vaultMap.has(vaultKey)) vaultMap.set(vaultKey, record)
        }

        const vaultKeys = Array.from(vaultMap.keys())
        const updates: Record<string, Partial<LegacyVaultResolved>> = {}

        for (const hint of LEGACY_STATIC_VAULT_HINTS) {
          const hintVault = hint.vault && isAddress(hint.vault) ? getAddress(hint.vault) : null
          const hintVaultKey = hintVault ? hintVault.toLowerCase() : null
          const match =
            hintVaultKey && vaultMap.has(hintVaultKey)
              ? hintVaultKey
              : hint.vaultHint
                ? matchVaultHint(hint.vaultHint, vaultKeys)
                : null
          if (!match) continue
          const record = vaultMap.get(match)
          if (!record) continue
          updates[hint.id] = {
            vault: record.vault,
            wrapper: record.wrapper,
            shareOft: record.shareOft,
            resolvedFrom: 'registry',
          }
        }

        const assignedVaultKeys = new Set(
          Object.values(updates)
            .map((update) => (update.vault && isAddress(update.vault) ? update.vault.toLowerCase() : null))
            .filter((v): v is string => Boolean(v)),
        )
        LEGACY_STATIC_VAULT_HINTS.forEach((hint) => {
          if (hint.vault && isAddress(hint.vault)) assignedVaultKeys.add(hint.vault.toLowerCase())
        })

        const discoveredRecords = Array.from(phase1Map.entries())
          .filter(([vaultKey]) => !assignedVaultKeys.has(vaultKey))
          .map(([, record]) => record)
          .sort((a, b) => a.vault.localeCompare(b.vault))

        LEGACY_DYNAMIC_HINT_IDS.forEach((id, index) => {
          const record = discoveredRecords[index]
          if (!record) {
            updates[id] = {
              label: `Recovered deployment slot #${index + 1}`,
              vault: ZERO_ADDRESS,
              wrapper: ZERO_ADDRESS,
              shareOft: ZERO_ADDRESS,
              vesting: ZERO_ADDRESS,
              resolvedFrom: 'unknown',
            }
            return
          }
          updates[id] = {
            label: `Recovered deployment (${shortAddress(record.shareOft)})`,
            vault: record.vault,
            wrapper: record.wrapper,
            shareOft: record.shareOft,
            vesting: ZERO_ADDRESS,
            resolvedFrom: 'registry',
          }
        })

        for (const [id, update] of Object.entries(updates)) {
          if (!update.shareOft || !isAddress(update.shareOft)) continue
          const vesting = await fetchLegacyVesting(publicClient, update.shareOft as Address, canonicalCswAddress as Address)
          if (vesting) {
            updates[id] = { ...update, vesting: getAddress(vesting) }
          }
        }

        if (!cancelled && Object.keys(updates).length > 0) {
          setLegacyOverrides((prev) => ({ ...prev, ...updates }))
        }
        if (!cancelled) setLegacyResolveStatus('done')
      } catch (e) {
        if (!cancelled) {
          setLegacyResolveStatus('error')
          setLegacyResolveError('Failed to resolve legacy deployments from the registry.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [publicClient, canonicalCswAddress, unresolvedHintIds])

  const updateTx = (key: string, patch: Partial<TxState>) => {
    setTxStates((prev) => {
      const current = prev[key]
      const nextStatus = patch.status ?? current?.status ?? 'idle'
      return {
        ...prev,
        [key]: { ...current, ...patch, status: nextStatus } as TxState,
      }
    })
  }

  async function sendTx(
    key: string,
    config: {
      address: Address
      abi: readonly unknown[]
      functionName: string
      args?: readonly unknown[]
    },
  ) {
    if (!publicClient) return
    updateTx(key, { status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: config.address,
          abi: config.abi,
          functionName: config.functionName,
          args: config.args ?? [],
        })
        updateTx(key, { status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        updateTx(key, { status: 'success' })
        return
      }
      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: config.abi as any,
          functionName: config.functionName as any,
          args: config.args ?? [],
        })
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: config.address, data }],
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: config.abi as any,
          functionName: config.functionName as any,
          args: config.args ?? [],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: config.address, data }],
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      updateTx(key, { status: 'error', error: toFriendlyTxError(e) })
    }
  }

  async function sendBatchTx(key: string, calls: Array<{ to: Address; data: Hex }>) {
    if (!publicClient) return
    updateTx(key, { status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!calls.length) {
        throw new Error('No actions to submit.')
      }
      if (isCanonical) {
        throw new Error('Connect an owner wallet to submit 1-click withdrawals.')
      }
      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const result = await sendEmbeddedOwnerSmartWalletCall({
          publicClient: publicClient as any,
          embeddedProvider,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls,
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: false,
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      updateTx(key, { status: 'error', error: toFriendlyTxError(e) })
    }
  }

  const receiverValid = isAddress(receiver)

  return (
    <section id="legacy-withdrawals" className="cinematic-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
            <div className="space-y-2">
              <div className="label">Legacy withdraw</div>
              <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Withdraw old ShareOFT balances</div>
              <div className="text-sm text-zinc-600 max-w-prose">
                This panel submits the onchain steps to withdraw legacy ShareOFT via wrappers + vaults. Connect the canonical
                smart wallet <span className="font-mono text-zinc-300">{shortAddress(CANONICAL_SMART_WALLET)}</span>.
              </div>
            </div>

            {!isConnected ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="label">Connect</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm">
                <div className="text-zinc-400">Connected wallet</div>
                <div className="font-mono text-zinc-200">{connectedAddress}</div>
                <div className="text-xs text-zinc-500">
                  Canonical CSW: <span className="font-mono text-zinc-300">{shortAddress(canonicalCswAddress)}</span>
                </div>
                {detectedCsw.address ? (
                  <div className="text-xs text-zinc-500">
                    Detected CSW{detectedCswLabel ? ` (${detectedCswLabel})` : ''}:{' '}
                    <span className="font-mono text-zinc-300">{shortAddress(detectedCsw.address)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-300/80">
                    CSW not detected yet. Restore your admin connection or connect the CSW directly.
                  </div>
                )}
                {detectedCswMismatch ? (
                  <div className="text-xs text-amber-300/80">
                    Detected smart wallet does not match the canonical CSW. Switch to the canonical CSW to proceed.
                  </div>
                ) : null}
                {canSubmitViaOwner ? (
                  <div className="text-emerald-300/90">
                    Owner detected. Transactions will be submitted via the canonical smart wallet.
                  </div>
                ) : null}
                {embeddedPrivyEoaAddress && !embeddedIsCanonicalOwner ? (
                  <div className="text-xs text-amber-300/80">
                    Privy embedded wallet is not linked to the canonical CSW.{' '}
                    <a className="underline hover:text-amber-200" href="/deploy#gasfree">
                      Enable gas-free deploys
                    </a>{' '}
                    to use it for signing.
                  </div>
                ) : embeddedIsCanonicalOwner ? (
                  <div className="text-xs text-emerald-300/80">
                    Privy embedded wallet linked. Signatures use Privy by default.
                  </div>
                ) : null}
                {connectedIsCanonicalOwner && !isCanonical ? (
                  <div className="text-xs text-zinc-500">
                    Optional: switch to the canonical CSW for direct signing.
                  </div>
                ) : null}
                {!isCanonical && !canSubmitViaOwner ? (
                  <div className="text-amber-300/80">
                    Connected wallet is not the canonical smart wallet. Unwrap/queue actions are disabled.
                  </div>
                ) : null}
                {!isBase ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!switchChainAsync) return
                      await switchChainAsync({ chainId: base.id })
                    }}
                    disabled={switchPending}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="text-sm text-zinc-300">Withdrawal receiver</div>
              <input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="0x..."
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              {!receiverValid ? <div className="text-xs text-red-400">Receiver address is invalid.</div> : null}
              <div className="text-xs text-zinc-600">Queue withdrawals will send Creator Coin to this address.</div>
            </div>

            {legacyResolveStatus === 'loading' ? (
              <div className="text-xs text-zinc-500">Resolving legacy deployments from registry…</div>
            ) : null}
            {legacyResolveError ? <div className="text-xs text-amber-300/80">{legacyResolveError}</div> : null}

            <div className="grid gap-6">
              {legacyVaults.map((legacy) => {
                const amountInput = amounts[legacy.id] ?? ''
                const setAmountInput = (next: string) => setAmounts((prev) => ({ ...prev, [legacy.id]: next }))
                return (
                  <LegacyVaultWithdrawalCard
                    key={legacy.id}
                    legacy={legacy}
                    legacyResolveStatus={legacyResolveStatus}
                    amountInput={amountInput}
                    setAmountInput={setAmountInput}
                    receiver={receiver}
                    receiverValid={receiverValid}
                    canonicalCswAddress={canonicalCswAddress}
                    connectedAddress={connectedAddress}
                    canUseSmartWallet={canUseSmartWallet}
                    isConnected={isConnected}
                    isBase={isBase}
                    blockNumber={blockNumber}
                    walletClient={walletClient}
                    txStates={txStates}
                    sendTx={sendTx}
                    sendBatchTx={sendBatchTx}
                  />
                )
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-xs text-zinc-500">
              Note: the deferred auction allocation held by the batcher is not withdrawable here. This panel focuses on
              vesting + wrapper withdrawals.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AdminOps() {
  const dashboardItems = useMemo(
    () => [
      {
        id: 'waitlist',
        label: 'Approve users',
        description: 'Review waitlist signups and access status.',
        to: '/admin/waitlist',
        kind: 'route' as const,
      },
      {
        id: 'creator-access',
        label: 'Vault allowlist',
        description: 'Review vault launch requests and deploy allowlist entries.',
        to: '/admin/creator-access',
        kind: 'route' as const,
      },
      {
        id: 'deploy-strategies',
        label: 'Deploy strategies',
        description: 'Charm + Ajna strategy deployments.',
        to: '/admin/deploy-strategies',
        kind: 'route' as const,
      },
      {
        id: 'deployment-status',
        label: 'Manage deployments',
        description: 'Protocol + vault status checks.',
        to: '/status',
        kind: 'route' as const,
      },
      {
        id: 'agent-registry',
        label: 'Agent registry',
        description: 'Register/update ERC-8004 agent.',
        to: '#agent-registration',
        kind: 'anchor' as const,
      },
      {
        id: 'legacy-withdrawals',
        label: 'Withdraw legacy assets',
        description: 'Withdraw old ShareOFT balances.',
        to: '#legacy-withdrawals',
        kind: 'anchor' as const,
      },
      {
        id: 'share-token-metadata',
        label: 'Share token metadata',
        description: 'Pin ShareOFT metadata to Lens Grove.',
        to: '#share-token-metadata',
        kind: 'anchor' as const,
      },
    ],
    [],
  )

  return (
    <div className="relative pb-24 md:pb-0">
      <section id="admin-dashboard" className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
              <div className="space-y-2">
                <div className="label">Admin Ops</div>
                <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Dashboard</div>
                <div className="text-sm text-zinc-600 max-w-prose">
                  Jump to the admin tools you use most often.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {dashboardItems.map((item) =>
                  item.kind === 'route' ? (
                    <Link
                      key={item.id}
                      to={item.to}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-left hover:border-white/20 transition-colors"
                    >
                      <div className="text-sm text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.description}</div>
                    </Link>
                  ) : (
                    <a
                      key={item.id}
                      href={item.to}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-left hover:border-white/20 transition-colors"
                    >
                      <div className="text-sm text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.description}</div>
                    </a>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <AgentRegistration />
      <AgentFeedback />
      <ShareTokenMetadata />
      <LegacyWithdrawals />
    </div>
  )
}
