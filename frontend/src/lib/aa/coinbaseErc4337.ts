import type { Address, Hex } from 'viem'
import { decodeAbiParameters, encodeAbiParameters, getAddress, http, isAddress } from 'viem'
import { toAccount } from 'viem/accounts'
import {
  createBundlerClient,
  createPaymasterClient,
  entryPoint06Address,
  sendUserOperation,
  toCoinbaseSmartAccount,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction'
import { logger } from '@/lib/logger'

// ============================================================================
// ENTRYPOINT v0.6 ENFORCEMENT
// ============================================================================
// This module ONLY supports ERC-4337 EntryPoint v0.6. This is enforced at:
// 1. Build time: We import entryPoint06Address from viem/account-abstraction
// 2. Runtime: We verify the bundler supports v0.6 before sending UserOps
// 3. Server: The /api/paymaster endpoint rejects non-v0.6 requests
// ============================================================================

const ENTRYPOINT_V06 = getAddress(entryPoint06Address)
const ENTRYPOINT_V06_EXPECTED = getAddress('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')

// Sanity check at module load time
if (ENTRYPOINT_V06 !== ENTRYPOINT_V06_EXPECTED) {
  throw new Error(
    `EntryPoint v0.6 address mismatch! Expected ${ENTRYPOINT_V06_EXPECTED}, got ${ENTRYPOINT_V06}. ` +
    'This could indicate a viem version mismatch or incorrect import.'
  )
}

/**
 * Verify the bundler supports EntryPoint v0.6.
 * Throws if the bundler doesn't support v0.6.
 */
async function verifyBundlerSupportsV06(
  bundlerUrl: string,
  options?: { includeCredentials?: boolean },
): Promise<void> {
  const credentials = options?.includeCredentials ? 'include' : 'omit'
  try {
    const response = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: [],
      }),
    })
    
    if (!response.ok) {
      // Don't fail on network errors - let the actual UserOp fail with a better message
      console.warn('[ERC-4337] Could not verify bundler EntryPoint support:', response.status)
      return
    }
    
    const data = await response.json()
    const supportedEntryPoints: string[] = data?.result ?? []
    
    const supportsV06 = supportedEntryPoints.some(
      (ep: string) => getAddress(ep) === ENTRYPOINT_V06
    )
    
    if (!supportsV06) {
      throw new Error(
        `Bundler does not support EntryPoint v0.6 (${ENTRYPOINT_V06}). ` +
        `Supported: ${supportedEntryPoints.join(', ') || 'none'}. ` +
        'This deployment requires EntryPoint v0.6 for gas sponsorship.'
      )
    }
  } catch (e: unknown) {
    // If it's our own error, rethrow
    if (e instanceof Error && e.message.includes('EntryPoint v0.6')) {
      throw e
    }
    // Network errors - warn but don't block (let the UserOp fail with better context)
    console.warn('[ERC-4337] Could not verify bundler EntryPoint support:', e)
  }
}

// NOTE: Avoid tight coupling to a specific `viem` client instance/type.
// wagmi and other libs can surface structurally-compatible clients that TypeScript may treat as distinct.
export type PublicClientLike = {
  chain: { id: number }
  readContract: (args: any) => Promise<any>
} & Record<string, any>

export type WalletClientLike = {
  request: (args: any) => Promise<any>
  signMessage?: (args: any) => Promise<any>
  signTypedData?: (args: any) => Promise<any>
  signTransaction?: (args: any) => Promise<any>
} & Record<string, any>

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

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

function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return v
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(v, base) : new URL(v)
    return u.toString()
  } catch {
    return v
  }
}

function isSameOriginUrl(value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(value, window.location.origin)
    return u.origin === window.location.origin
  } catch {
    return false
  }
}

function isPaymasterProxyUrl(value: string): boolean {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(value, base) : new URL(value)
    return u.pathname === '/api/paymaster'
  } catch {
    return false
  }
}

function resolveBundlerUrlForNonPaymaster(bundlerUrl: string): string {
  const envBundler = (import.meta.env as Record<string, string | undefined>)['VITE_CDP_BUNDLER_URL']
  if (!envBundler?.trim()) return bundlerUrl
  if (!isPaymasterProxyUrl(bundlerUrl)) return bundlerUrl
  return normalizeUrl(envBundler)
}

const HEX_STRING_RE = /^0x[0-9a-fA-F]+$/

function formatGasValue(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Math.trunc(value).toString()
  if (typeof value === 'string') return value
  return null
}

function formatGasEstimate(estimate: any) {
  return {
    preVerificationGas: formatGasValue(estimate?.preVerificationGas),
    verificationGasLimit: formatGasValue(estimate?.verificationGasLimit),
    callGasLimit: formatGasValue(estimate?.callGasLimit),
    paymasterVerificationGasLimit: formatGasValue(estimate?.paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: formatGasValue(estimate?.paymasterPostOpGasLimit),
  }
}

// Known error selectors for decoding revert reasons
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  '0x08c379a0': 'Error(string)',
  '0x4e487b71': 'Panic(uint256)',
  // Coinbase Smart Wallet errors
  '0x82b42900': 'Unauthorized()',
  // CreatorVaultDeployer errors
  '0x30cd7471': 'NotOwner()',
  '0xd92e233d': 'ZeroAddress()',
  '0xb92e9c7a': 'InvalidPercent()',
  '0x1375159e': 'InvalidCodeId()',
  '0x02058db0': 'Phase1Missing()',
  '0x585b9263': 'InvalidWeight()',
  '0xe10fdfee': 'V3PoolMissing()',
  '0x24c0a9e0': 'MissingInitialSqrtPriceX96()',
  '0x18b789e6': 'AuctionAlreadyPending()',
  '0x0fd83a8b': 'NoPendingAuction()',
  '0x56a694d2': 'AuctionShareOFTMismatch()',
  '0x8284e8bf': 'AuctionAmountMismatch()',
  '0xf79c143b': 'Phase2Missing()',
}

function extractRevertInfo(e: unknown): { error: string; revertData?: Hex; errorName?: string } {
  const errAny = e as any
  const msg = e instanceof Error ? e.message : String(e ?? '')
  const result: { error: string; revertData?: Hex; errorName?: string } = { error: msg }
  
  // Extract revert data from various error structures
  const revertData = errAny?.cause?.cause?.data ?? errAny?.cause?.data ?? errAny?.data
  if (revertData && typeof revertData === 'string' && revertData.startsWith('0x')) {
    result.revertData = revertData as Hex
    const selector = revertData.slice(0, 10).toLowerCase()
    if (KNOWN_ERROR_SELECTORS[selector]) {
      result.errorName = KNOWN_ERROR_SELECTORS[selector]
    }
  }
  
  // Extract error reason from viem's parsed errors
  if (errAny?.cause?.reason) result.error = errAny.cause.reason
  if (errAny?.shortMessage) result.error = errAny.shortMessage
  
  return result
}

async function logUserOpEstimate(params: {
  bundlerClient: any
  account: any
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  verificationGasLimit: bigint
  paymasterClient?: { getPaymasterData: any; getPaymasterStubData: any }
}) {
  if (!AA_DEBUG) return
  const { bundlerClient, account, calls, verificationGasLimit, paymasterClient } = params
  const client: any = bundlerClient as any
  if (typeof client?.prepareUserOperation !== 'function') {
    logger.debug('[ERC-4337] estimateUserOperationGas unavailable', { reason: 'prepareUserOperation not supported' })
    return
  }
  const originalAccount = client.account
  if (!originalAccount) {
    client.account = account
  }
  try {
    const paymaster =
      paymasterClient && paymasterClient.getPaymasterData && paymasterClient.getPaymasterStubData
        ? {
            getPaymasterData: paymasterClient.getPaymasterData,
            getPaymasterStubData: paymasterClient.getPaymasterStubData,
          }
        : undefined
    const prepared = await client.prepareUserOperation({
      account,
      calls,
      verificationGasLimit,
      ...(paymaster ? { paymaster } : {}),
    })
    const userOperation = prepared?.userOperation ?? prepared
    let estimate: any = null
    if (typeof client?.estimateUserOperationGas === 'function') {
      estimate = await client.estimateUserOperationGas({ userOperation, entryPoint: ENTRYPOINT_V06 })
    } else if (typeof client?.request === 'function') {
      estimate = await client.request({
        method: 'eth_estimateUserOperationGas',
        params: [userOperation, ENTRYPOINT_V06],
      })
    }
    if (estimate) {
      logger.debug('[ERC-4337] estimateUserOperationGas', formatGasEstimate(estimate))
    }
  } catch (e: unknown) {
    const revertInfo = extractRevertInfo(e)
    const errDetails: Record<string, unknown> = { 
      error: revertInfo.error,
      revertData: revertInfo.revertData,
      errorName: revertInfo.errorName,
    }
    // Also include metaMessages if available (viem often includes helpful context)
    const errAny = e as any
    if (errAny?.metaMessages) errDetails.metaMessages = errAny.metaMessages
    logger.debug('[ERC-4337] estimateUserOperationGas failed', errDetails)
  } finally {
    if (!originalAccount) {
      delete client.account
    } else {
      client.account = originalAccount
    }
  }
}

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_STRING_RE.test(value)
}

function getHexByteLength(hex: string): number | null {
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  return body.length / 2
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

function isPaymasterStakeError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  return (
    lc.includes('banned opcode') ||
    lc.includes('stake/unstake delay') ||
    lc.includes('entity stake') ||
    lc.includes('unstake delay too low')
  )
}

function isPaymasterUnavailableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  return (
    lc.includes('resource not available') ||
    lc.includes('requested resource not available') ||
    lc.includes('request denied') ||
    lc.includes('not authenticated') ||
    lc.includes('cdp paymaster endpoint is not configured') ||
    lc.includes('method not allowed')
  )
}

function formatMetaMessages(error: unknown): string | null {
  const meta = (error as any)?.metaMessages
  if (!Array.isArray(meta) || meta.length === 0) return null
  const messages = meta
    .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    .map((m) => String(m).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (messages.length === 0) return null
  const limited = messages.slice(0, 3)
  return limited.join(' | ') + (messages.length > limited.length ? ' | ...' : '')
}

function debugSignature(context: string, signature: Hex, source?: string | null) {
  if (!AA_DEBUG) return
  logger.debug(`[ERC-4337] ${context} signature`, {
    source: source ?? 'unknown',
    ...signatureMeta(signature),
  })
}

function debugSignatureReady(context: string, signature: Hex, details?: Record<string, unknown>) {
  if (!AA_DEBUG) return
  logger.debug('[ERC-4337] UserOp signature ready', {
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

const SIGN_TIMEOUT_MS = 30_000

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
  debugSignature(context, signature, source)
  return signature
}

export function runSignatureExtractionHarness() {
  const sig65 = `0x${'11'.repeat(65)}`
  const sig64 = `0x${'22'.repeat(64)}`
  const cases = [
    { name: 'raw string', input: sig65 },
    { name: 'object signature', input: { signature: sig65, encoding: 'hex' } },
    { name: 'nested data signature', input: { data: { signature: sig65 } } },
    { name: 'nested result signature (64-byte)', input: { result: { signature: sig64 } } },
  ]
  return cases.map((t) => {
    const { signature, source } = extractSignatureHex(t.input)
    const meta = signature ? signatureMeta(signature) : null
    return {
      name: t.name,
      ok: Boolean(signature),
      source,
      signatureLength: meta?.signatureLength ?? null,
      byteLength: meta?.byteLength ?? null,
    }
  })
}

if (AA_DEBUG && typeof window !== 'undefined') {
  const w = window as any
  if (typeof w.__cvSignatureHarness !== 'function') {
    w.__cvSignatureHarness = runSignatureExtractionHarness
    logger.debug('[ERC-4337] Signature harness attached to window.__cvSignatureHarness')
  }
}

function getStoredSessionToken(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

/**
 * The canonical EntryPoint v0.6 address used by this module.
 * This is the ONLY EntryPoint version supported.
 */
export const ERC4337_ENTRYPOINT_V06 = ENTRYPOINT_V06

/**
 * Assert that a given address matches EntryPoint v0.6.
 * Use this to verify configuration matches expectations.
 */
export function assertEntryPointV06(address: Address): void {
  const normalized = getAddress(address)
  if (normalized !== ENTRYPOINT_V06) {
    throw new Error(
      `Expected EntryPoint v0.6 (${ENTRYPOINT_V06}), got ${normalized}. ` +
      'This module only supports ERC-4337 EntryPoint v0.6.'
    )
  }
}

export async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<{ ownerIndex: number | null; ownerCount: number }> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 256 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return { ownerIndex: null, ownerCount: 0 }

  // Use nextOwnerIndex when available to avoid missing owners after removals.
  let upperBound = count
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    const b = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex
    if (String(b).toLowerCase() === expected) return { ownerIndex: i, ownerCount: count }
  }
  return { ownerIndex: null, ownerCount: count }
}

export async function fetchCoinbaseSmartWalletOwners(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  maxOwners?: number
}): Promise<Address[]> {
  const { publicClient, smartWallet, maxOwners = 32 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return []

  let upperBound = count
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const limit = Math.min(upperBound, Math.max(1, maxOwners))
  const owners: Address[] = []
  for (let i = 0; i < limit; i += 1) {
    try {
      const raw = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as `0x${string}`
      const decoded = decodeAbiParameters([{ type: 'address' }], raw)[0] as string
      if (!isAddress(decoded)) continue
      const addr = getAddress(decoded)
      if (addr === getAddress('0x0000000000000000000000000000000000000000')) continue
      if (!owners.includes(addr)) owners.push(addr)
    } catch {
      continue
    }
  }
  return owners
}

type UserOpSignMode = 'eth_sign' | 'signMessage' | 'auto'

// Patterns that indicate eth_sign is blocked/unsupported
const ETH_SIGN_BLOCKED_PATTERNS = [
  'eth_sign',
  'method not found',
  'method not supported',
  'unsupported method',
  'not supported',
  'method does not exist',
  'unknown method',
  'invalid method',
  'dangerous',
  'disabled',
  'blocked',
  'prohibited',
  'security',
] as const

// Error codes that indicate method not supported
const METHOD_NOT_SUPPORTED_CODES = [-32601, -32600, -32602, 4200] as const

// Patterns that indicate user rejection (should not retry or fallback)
const USER_REJECTION_PATTERNS = [
  'user rejected',
  'user denied',
  'user cancelled',
  'rejected by user',
  'denied by user',
  'cancelled by user',
  'request rejected',
  'transaction rejected',
  'action_rejected',
  'user refused',
] as const

function isUserRejection(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  
  // Common user rejection error codes
  if (code === 4001 || code === 'ACTION_REJECTED') return true
  
  return USER_REJECTION_PATTERNS.some(p => lc.includes(p))
}

function isEthSignBlocked(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  
  // Check error codes first
  if (typeof code === 'number' && METHOD_NOT_SUPPORTED_CODES.includes(code as any)) return true
  
  // Check message patterns
  return ETH_SIGN_BLOCKED_PATTERNS.some(p => lc.includes(p))
}

function createWalletBackedLocalAccount(params: {
  walletClient: WalletClientLike
  address: Address
  userOpSignMode?: UserOpSignMode
}) {
  const { walletClient, address, userOpSignMode = 'auto' } = params

  return toAccount({
    address,
    // Required for Coinbase Smart Wallet userOp signatures (sign raw digest).
    sign: async ({ hash }) => {
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] sign called', {
          address,
          hashLength: typeof hash === 'string' ? hash.length : null,
          hashLooksValid: isUserOpHashLike(hash),
        })
      }
      
      const tryEthSign = async (): Promise<Hex> => {
        try {
          const rawSig = await withTimeout(
            (walletClient as any).request({
              method: 'eth_sign',
              params: [address, hash],
            }),
            SIGN_TIMEOUT_MS,
            'eth_sign',
          )
          const sig = ensureSignatureHex(rawSig, 'eth_sign')
          debugSignatureReady('eth_sign', sig, { address })
          return sig
        } catch (e) {
          // Rethrow with context
          if (isUserRejection(e)) {
            throw new Error('User rejected the signature request.')
          }
          throw e
        }
      }
      
      const tryPersonalSign = async (): Promise<Hex> => {
        try {
          let rawSig: unknown
          if (typeof walletClient.signMessage === 'function') {
            rawSig = await withTimeout(
              walletClient.signMessage({
                account: address,
                // `raw` signs the 32-byte payload (EIP-191 prefixed at JSON-RPC layer).
                // Coinbase Smart Wallet accepts this via SignatureCheckerLib.
                message: { raw: hash },
              }),
              SIGN_TIMEOUT_MS,
              'signMessage',
            )
          } else if (typeof walletClient.request === 'function') {
            rawSig = await withTimeout(
              walletClient.request({
                method: 'personal_sign',
                params: [hash, address],
              }),
              SIGN_TIMEOUT_MS,
              'personal_sign',
            )
          } else {
            throw new Error('Wallet does not support signMessage or personal_sign')
          }
          const sig = ensureSignatureHex(rawSig, 'signMessage')
          debugSignatureReady('signMessage', sig, { address })
          return sig
        } catch (e) {
          if (isUserRejection(e)) {
            throw new Error('User rejected the signature request.')
          }
          throw e
        }
      }

      // Force specific mode if requested
      if (userOpSignMode === 'eth_sign') return await tryEthSign()
      if (userOpSignMode === 'signMessage') return await tryPersonalSign()

      // Auto mode: try eth_sign first, fall back to signMessage
      // This order is preferred because eth_sign produces a raw signature,
      // but most wallets block it for security reasons.
      try {
        return await tryEthSign()
      } catch (ethSignError: unknown) {
        // If user rejected, don't try fallback
        if (isUserRejection(ethSignError)) {
          throw ethSignError
        }
        
        // If eth_sign is blocked/unsupported, try signMessage fallback
        if (isEthSignBlocked(ethSignError)) {
          try {
            return await tryPersonalSign()
          } catch (personalSignError: unknown) {
            // If user rejected the fallback, report that
            if (isUserRejection(personalSignError)) {
              throw personalSignError
            }
            // Both methods failed
            throw new Error(
              'Could not sign the UserOperation. Your wallet blocked eth_sign and signMessage also failed. ' +
              'Try using Coinbase Wallet or adding your Privy smart wallet as an owner.'
            )
          }
        }
        
        // Unknown error, rethrow with context
        const errMsg = ethSignError instanceof Error ? ethSignError.message : String(ethSignError)
        throw new Error(`Failed to sign UserOperation: ${errMsg}`)
      }
    },
    signMessage: async ({ message }) => {
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] signMessage called', {
          address,
          messageType: typeof message,
          isRaw: typeof message === 'object' && message !== null && 'raw' in message,
        })
      }
      let rawSig: unknown
      if (typeof walletClient.signMessage === 'function') {
        rawSig = await withTimeout(
          walletClient.signMessage({ account: address, message }),
          SIGN_TIMEOUT_MS,
          'signMessage',
        )
      } else if (typeof walletClient.request === 'function') {
        const msg =
          typeof message === 'object' && message !== null && 'raw' in message
            ? (message.raw as Hex)
            : typeof message === 'string'
              ? message
              : `0x${Buffer.from(String(message)).toString('hex')}`
        rawSig = await withTimeout(
          walletClient.request({
            method: 'personal_sign',
            params: [msg, address],
          }),
          SIGN_TIMEOUT_MS,
          'personal_sign',
        )
      } else {
        throw new Error('Wallet does not support signMessage or personal_sign')
      }
      return ensureSignatureHex(rawSig, 'signMessage')
    },
    signTypedData: async (typedData: any) => {
      let rawSig: unknown
      if (typeof walletClient.signTypedData === 'function') {
        rawSig = await withTimeout(
          walletClient.signTypedData({ account: address, ...(typedData as any) }),
          SIGN_TIMEOUT_MS,
          'signTypedData',
        )
      } else if (typeof walletClient.request === 'function') {
        rawSig = await withTimeout(
          walletClient.request({
            method: 'eth_signTypedData_v4',
            params: [address, JSON.stringify(typedData)],
          }),
          SIGN_TIMEOUT_MS,
          'eth_signTypedData_v4',
        )
      } else {
        throw new Error('Wallet does not support signTypedData')
      }
      return ensureSignatureHex(rawSig, 'signTypedData')
    },
    signTransaction: async (tx, options) => {
      const wc: any = walletClient as any
      if (typeof wc.signTransaction !== 'function') {
        throw new Error('Wallet does not support signTransaction')
      }
      return (await wc.signTransaction({ ...tx, ...options, account: address })) as Hex
    },
  })
}

/**
 * Cross-app signing function type from Privy's useCrossAppAccounts
 */
export type CrossAppSignMessage = (
  message: string,
  options: { address: string }
) => Promise<string>

/**
 * Create a local account that uses Privy cross-app signing.
 * This allows signing UserOperations via Zora's popup flow without needing gas.
 */
function createCrossAppSigningAccount(params: {
  crossAppSignMessage: CrossAppSignMessage
  ownerAddress: Address
}) {
  const { crossAppSignMessage, ownerAddress } = params

  return toAccount({
    address: ownerAddress,
    // Sign the UserOp hash via cross-app popup (no gas required!)
    sign: async ({ hash }) => {
      // Cross-app signMessage uses personal_sign which adds EIP-191 prefix.
      // Coinbase Smart Wallet supports this via SignatureCheckerLib.
      // We pass the raw hash as a hex string - Privy will handle the signing.
      const signature = await crossAppSignMessage(hash, { address: ownerAddress })
      const sig = ensureSignatureHex(signature, 'crossAppSignMessage')
      debugSignatureReady('crossAppSignMessage', sig, { address: ownerAddress })
      return sig
    },
    signMessage: async ({ message }) => {
      const msgStr = typeof message === 'string' 
        ? message 
        : typeof message === 'object' && 'raw' in message
          ? (message.raw as Hex)
          : String(message)
      const signature = await crossAppSignMessage(msgStr, { address: ownerAddress })
      return ensureSignatureHex(signature, 'crossAppSignMessage')
    },
    signTypedData: async () => {
      throw new Error('signTypedData not supported for cross-app accounts')
    },
    signTransaction: async () => {
      throw new Error('signTransaction not supported for cross-app accounts')
    },
  })
}

/**
 * Send a UserOperation via ERC-4337 using cross-app signing.
 * 
 * This flow:
 * 1. Builds the UserOperation for the smart wallet
 * 2. Computes the UserOp hash
 * 3. Opens a popup to Zora for the user to sign (no gas needed!)
 * 4. Submits to bundler with paymaster (paymaster pays gas)
 * 5. Waits for on-chain confirmation
 * 
 * @param params.crossAppSignMessage - signMessage from useCrossAppAccounts
 * @param params.zoraEmbeddedWalletAddress - The Zora EOA that will sign
 * @param params.smartWallet - The Coinbase Smart Wallet address
 */
export async function sendCrossAppUserOperation(params: {
  publicClient: PublicClientLike
  crossAppSignMessage: CrossAppSignMessage
  bundlerUrl: string
  smartWallet: Address
  zoraEmbeddedWalletAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  version?: '1' | '1.1'
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const { 
    publicClient, 
    crossAppSignMessage, 
    bundlerUrl, 
    smartWallet, 
    zoraEmbeddedWalletAddress, 
    calls, 
    version = '1' 
  } = params
  
  if (!bundlerUrl) throw new Error('Missing bundler URL')

  // Verify the Zora EOA is an owner of the smart wallet
  const { ownerIndex } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet,
    ownerAddress: zoraEmbeddedWalletAddress,
  })
  
  if (ownerIndex === null) {
    throw new Error(
      `Zora embedded wallet (${zoraEmbeddedWalletAddress}) is not an owner of the smart wallet (${smartWallet}). ` +
      'The user may need to add this wallet as an owner first.'
    )
  }

  // Create an account that uses cross-app signing
  const owner = createCrossAppSigningAccount({
    crossAppSignMessage,
    ownerAddress: zoraEmbeddedWalletAddress,
  })

  // Create the Coinbase Smart Account
  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex,
    version,
  })

  // Set up bundler + paymaster (uses CDP for gas sponsorship)
  const sessionToken = typeof window !== 'undefined' ? getStoredSessionToken() : null
  const transportHeaders = {
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...(AA_DEBUG ? { 'X-CV-Paymaster-Debug': '1' } : {}),
  } as Record<string, string>
  const transport = http(bundlerUrl, {
    fetchOptions: {
      credentials: 'include',
      headers: Object.keys(transportHeaders).length > 0 ? transportHeaders : undefined,
    },
  })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport,
  })

  // ENFORCE: Verify bundler supports EntryPoint v0.6 before sending
  await verifyBundlerSupportsV06(bundlerUrl)

  // Send the UserOperation - this will:
  // 1. Build the UserOp
  // 2. Call owner.sign() which opens the Zora popup
  // 3. Submit to bundler with paymaster (EntryPoint v0.6)
  //
  // Cross-app signing uses an EOA (Zora embedded wallet) so verification gas is lower,
  // but we use a safe buffer for EIP-1271 in case the account structure changes.
  await logUserOpEstimate({
    bundlerClient,
    account,
    calls,
    verificationGasLimit: 200_000n,
    paymasterClient,
  })

  let userOpHash: Hex
  try {
    userOpHash = await sendUserOperation(bundlerClient, {
      account,
      calls,
      verificationGasLimit: 200_000n,
      paymaster: {
        getPaymasterData: paymasterClient.getPaymasterData,
        getPaymasterStubData: paymasterClient.getPaymasterStubData,
      },
    })
  } catch (e: unknown) {
    if (!isPaymasterStakeError(e)) throw e
    logger.warn('[ERC-4337] Paymaster stake too low; retrying without sponsorship')
    await logUserOpEstimate({
      bundlerClient,
      account,
      calls,
      verificationGasLimit: 200_000n,
    })
    userOpHash = await sendUserOperation(bundlerClient, {
      account,
      calls,
      verificationGasLimit: 200_000n,
    })
  }

  // Wait for on-chain confirmation
  const receipt = await waitForUserOperationReceipt(bundlerClient, { 
    hash: userOpHash, 
    timeout: 120_000 
  })
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] UserOp receipt', {
      actualGasUsed: formatGasValue((receipt as any)?.actualGasUsed),
      actualGasCost: formatGasValue((receipt as any)?.actualGasCost),
      txHash: (receipt as any)?.receipt?.transactionHash,
    })
  }
  
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
}

/**
 * Pre-flight simulation: test if the calls would succeed when executed from the smart wallet.
 * This helps diagnose whether a UserOp failure is due to:
 * 1. ERC-4337 / signature issues (simulation passes but UserOp fails)
 * 2. Underlying call issues (simulation fails, meaning the contract call itself would revert)
 * 
 * Returns both the smart wallet execute simulation result AND a direct target call simulation.
 * The direct simulation helps identify if the target contract would revert even with correct msg.sender.
 */
export async function simulateSmartWalletCalls(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
}): Promise<{ 
  success: boolean
  error?: string
  revertData?: Hex
  errorName?: string
  directCallResult?: { success: boolean; error?: string; revertData?: Hex; errorName?: string }
}> {
  const { publicClient, smartWallet, calls } = params
  const client = publicClient as any
  
  if (typeof client?.simulateContract !== 'function' && typeof client?.call !== 'function') {
    return { success: true } // Can't simulate, assume OK
  }
  
  // First, try to simulate the direct target call (as if smart wallet is msg.sender)
  // This bypasses the smart wallet's authorization checks and tests just the target contract
  let directCallResult: { success: boolean; error?: string; revertData?: Hex; errorName?: string } | undefined
  if (calls.length === 1 && calls[0].data && typeof client?.call === 'function') {
    const call = calls[0]
    try {
      await client.call({
        to: call.to,
        data: call.data,
        value: call.value ?? 0n,
        account: smartWallet, // Simulate as if smart wallet is the caller
      })
      directCallResult = { success: true }
    } catch (e: unknown) {
      directCallResult = { success: false, ...extractRevertInfo(e) }
    }
  }
  
  // Now try the full execute() simulation
  // This might fail with "Unauthorized" because we're calling execute() without going through EntryPoint
  const EXECUTE_ABI = [
    {
      type: 'function',
      name: 'execute',
      stateMutability: 'payable',
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
  
  try {
    if (typeof client?.simulateContract !== 'function') {
      // If we can't simulate the full execute, return the direct call result
      if (directCallResult) {
        const { success, error, revertData, errorName } = directCallResult
        return { success, error, revertData, errorName, directCallResult }
      }
      return { success: true }
    }
    
    if (calls.length === 1) {
      const call = calls[0]
      await client.simulateContract({
        address: smartWallet,
        abi: EXECUTE_ABI,
        functionName: 'execute',
        args: [call.to, call.value ?? 0n, call.data ?? '0x'],
        account: smartWallet, // Note: This may fail with Unauthorized since smartWallet isn't an owner of itself
      })
    } else {
      const batchCalls = calls.map((c) => ({
        target: c.to,
        value: c.value ?? 0n,
        data: c.data ?? '0x' as Hex,
      }))
      await client.simulateContract({
        address: smartWallet,
        abi: EXECUTE_ABI,
        functionName: 'executeBatch',
        args: [batchCalls],
        account: smartWallet,
      })
    }
    
    return { success: true, directCallResult }
  } catch (e: unknown) {
    const revertInfo = extractRevertInfo(e)
    
    // If the execute() simulation failed with Unauthorized but direct call succeeded,
    // that's expected - the direct call result is more relevant
    if (revertInfo.errorName === 'Unauthorized()' && directCallResult?.success) {
      return { 
        success: true, 
        directCallResult,
        // Note: execute() failed but that's expected for simulation
      }
    }
    
    return { 
      success: false, 
      ...revertInfo,
      directCallResult,
    }
  }
}

export async function sendCoinbaseSmartWalletUserOperation(params: {
  publicClient: PublicClientLike
  walletClient: WalletClientLike
  bundlerUrl: string
  paymasterUrl?: string
  smartWallet: Address
  ownerAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  version?: '1' | '1.1'
  userOpSignMode?: UserOpSignMode
  ownerIsContract?: boolean
  skipPreflightSimulation?: boolean
  skipPaymaster?: boolean
  retryOnInvalidSignature?: boolean
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const {
    publicClient,
    walletClient,
    bundlerUrl: bundlerUrlInput,
    paymasterUrl: paymasterUrlInput,
    smartWallet,
    ownerAddress,
    calls,
    version = '1',
    userOpSignMode = 'auto',
    ownerIsContract: ownerIsContractOverride,
    skipPreflightSimulation,
    skipPaymaster = false,
    retryOnInvalidSignature = true,
  } = params
  
  // Input validation
  if (!bundlerUrlInput) throw new Error('Missing bundler URL')
  if (!smartWallet) throw new Error('Missing smart wallet address')
  if (!ownerAddress) throw new Error('Missing owner address')
  if (!publicClient) throw new Error('Missing public client')
  if (!walletClient) throw new Error('Missing wallet client')
  if (!calls || calls.length === 0) throw new Error('No calls provided')

  const normalizedBundlerUrl = normalizeUrl(bundlerUrlInput)
  const paymasterUrl = normalizeUrl(paymasterUrlInput ?? bundlerUrlInput)
  const bundlerUrlForBundler = resolveBundlerUrlForNonPaymaster(normalizedBundlerUrl)
  const shouldSendSessionToBundler = isPaymasterProxyUrl(bundlerUrlForBundler)
  const shouldSendSessionToPaymaster = isSameOriginUrl(paymasterUrl)

  // Pre-flight simulation: check if the underlying call would succeed
  // This helps diagnose contract-level reverts vs ERC-4337 issues
  if (!skipPreflightSimulation && AA_DEBUG) {
    const simResult = await simulateSmartWalletCalls({ publicClient, smartWallet, calls })
    if (!simResult.success) {
      logger.warn('[ERC-4337] Pre-flight simulation FAILED - underlying call would revert', {
        smartWallet,
        callCount: calls.length,
        error: simResult.error,
        revertData: simResult.revertData,
        errorName: simResult.errorName,
        firstCallTo: calls[0]?.to,
        firstCallData: calls[0]?.data?.slice(0, 10), // Just selector
      })
      // Don't throw here - let the actual UserOp attempt fail with full context
      // This is just diagnostic logging
    } else {
      logger.debug('[ERC-4337] Pre-flight simulation passed', {
        smartWallet,
        callCount: calls.length,
      })
    }
  }

  // Find owner index
  const { ownerIndex, ownerCount } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet,
    ownerAddress,
  })
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] Owner index lookup', {
      smartWallet,
      ownerAddress,
      ownerIndex,
      ownerCount,
    })
  }
  
  if (ownerIndex === null) {
    throw new Error(
      `Connected wallet (${ownerAddress}) is not an onchain owner of the smart wallet (${smartWallet}). ` +
      'Add this wallet as an owner first, or connect with a wallet that is already an owner.'
    )
  }

  // Detect smart wallet owners (EIP-1271) to tune gas + sign mode.
  let ownerIsContract = typeof ownerIsContractOverride === 'boolean' ? ownerIsContractOverride : false
  if (typeof ownerIsContractOverride !== 'boolean') {
    try {
      if (typeof (publicClient as any)?.getBytecode === 'function') {
        const bytecode = await (publicClient as any).getBytecode({ address: ownerAddress })
        ownerIsContract = typeof bytecode === 'string' && bytecode !== '0x'
      }
    } catch {
      // ignore; fallback to ownerCount probe
    }
    if (!ownerIsContract) {
      try {
        const ownerBytecode = await publicClient.readContract({
          address: ownerAddress,
          abi: [{ type: 'function', name: 'ownerCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
          functionName: 'ownerCount',
        }).catch(() => null)
        // If we can call ownerCount, it's likely a Coinbase Smart Wallet
        ownerIsContract = ownerBytecode !== null
      } catch {
        // Ignore - assume EOA if we can't determine
      }
    }
  }

  const effectiveUserOpSignMode =
    ownerIsContract && userOpSignMode === 'auto' ? 'signMessage' : userOpSignMode
  const usedSignMessageFallback = userOpSignMode === 'auto' && effectiveUserOpSignMode === 'signMessage'

  // Create the owner account for signing
  const owner = createWalletBackedLocalAccount({ 
    walletClient, 
    address: ownerAddress, 
    userOpSignMode: effectiveUserOpSignMode,
  })
  
  // Create the Coinbase Smart Account
  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex,
    version,
  })

  // CDP can use separate endpoints for bundler + paymaster JSON-RPC methods.
  // If `bundlerUrl` is our same-origin proxy (`/api/paymaster`), we MUST include cookies
  // so the backend can validate the SIWE session (`cv_auth_session`).
  const sessionToken = typeof window !== 'undefined' ? getStoredSessionToken() : null
  const buildTransport = (
    url: string,
    options: { includeSession: boolean; includeDebug?: boolean },
  ) => {
    const sameOrigin = isSameOriginUrl(url)
    const sendSession = options.includeSession && sameOrigin
    const headers: Record<string, string> = {
      ...(sendSession && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(sendSession && options.includeDebug && AA_DEBUG ? { 'X-CV-Paymaster-Debug': '1' } : {}),
    }
    return http(url, {
      fetchOptions: {
        credentials: sendSession ? 'include' : 'omit',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      },
    })
  }
  const paymasterTransport = buildTransport(paymasterUrl, { includeSession: shouldSendSessionToPaymaster, includeDebug: true })
  const bundlerTransport = buildTransport(bundlerUrlForBundler, { includeSession: shouldSendSessionToBundler })
  const paymasterClient = createPaymasterClient({ transport: paymasterTransport })
  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport: bundlerTransport,
  })

  // ENFORCE: Verify bundler supports EntryPoint v0.6 before sending
  await verifyBundlerSupportsV06(bundlerUrlForBundler, { includeCredentials: shouldSendSessionToBundler })

  // Send the UserOperation via EntryPoint v0.6 with CDP paymaster
  // toCoinbaseSmartAccount uses entryPoint06Address by default
  // 
  // Gas limits:
  // - verificationGasLimit: Higher for smart wallet signers (EIP-1271 can exceed 2M)
  // - paymaster validation can also push EOA flows above 150k in larger batches
  // - callGasLimit: Auto-estimated, but we don't override since batcher calls vary
  const verificationGasLimits = ownerIsContract
    ? [1_500_000n, 3_000_000n, 5_000_000n, 8_000_000n, 12_000_000n]
    : [400_000n, 800_000n, 1_500_000n, 3_000_000n, 5_000_000n, 8_000_000n, 12_000_000n]
  const uniqueVerificationGasLimits = Array.from(new Set(verificationGasLimits))
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] verificationGasLimit', {
      ownerIsContract,
      verificationGasLimit: String(uniqueVerificationGasLimits[0] ?? 0n),
    })
  }

  let userOpHash: Hex | null = null
  let lastError: unknown = null
  let attemptedWithoutPaymaster = false
  const allowPaymasterFallback = import.meta.env.VITE_ALLOW_PAYMASTER_FALLBACK === 'true'
  let smartWalletBalance: bigint | null = null
  try {
    if (typeof (publicClient as any)?.getBalance === 'function') {
      smartWalletBalance = await (publicClient as any).getBalance({ address: smartWallet })
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] smart wallet balance', {
          smartWallet,
          balance: formatGasValue(smartWalletBalance),
        })
      }
    }
  } catch (e: unknown) {
    if (AA_DEBUG) {
      const msg = e instanceof Error ? e.message : String(e ?? '')
      logger.debug('[ERC-4337] Failed to read smart wallet balance', { smartWallet, error: msg })
    }
  }
  const sendWithVerificationGasLimit = async (verificationGasLimit: bigint, usePaymaster: boolean) => {
    await logUserOpEstimate({
      bundlerClient,
      account,
      calls,
      verificationGasLimit,
      paymasterClient: usePaymaster ? paymasterClient : undefined,
    })
    return await sendUserOperation(bundlerClient, {
      account,
      calls,
      verificationGasLimit,
      ...(usePaymaster
        ? {
            paymaster: {
              getPaymasterData: paymasterClient.getPaymasterData,
              getPaymasterStubData: paymasterClient.getPaymasterStubData,
            },
          }
        : {}),
    })
  }

  const shouldRetryVerificationGas = (error: unknown): boolean => {
    const errMsg = error instanceof Error ? error.message : String(error ?? '')
    const lc = errMsg.toLowerCase()
    return lc.includes('aa40') || lc.includes('verificationgaslimit')
  }

  const attemptSend = async (usePaymaster: boolean) => {
    for (let i = 0; i < uniqueVerificationGasLimits.length; i++) {
      const limit = uniqueVerificationGasLimits[i]
      try {
        userOpHash = await sendWithVerificationGasLimit(limit, usePaymaster)
        lastError = null
        return
      } catch (e: unknown) {
        lastError = e
        const hasNext = i + 1 < uniqueVerificationGasLimits.length
        if (!hasNext || !shouldRetryVerificationGas(e)) break
        if (AA_DEBUG) {
          logger.debug('[ERC-4337] retrying with higher verificationGasLimit', {
            base: String(limit),
            retry: String(uniqueVerificationGasLimits[i + 1]),
          })
        }
      }
    }
  }

  const usePaymaster = !skipPaymaster
  if (usePaymaster) {
    await attemptSend(true)
  } else {
    await attemptSend(false)
  }

  const shouldFallbackWithoutPaymaster = (error: unknown): boolean => {
    const hasPrefundBalance = typeof smartWalletBalance === 'bigint' && smartWalletBalance > 0n
    // If the paymaster rejects (policy/availability), allow a non-sponsored fallback.
    // This is required for non-deploy flows (e.g. legacy withdrawals) that the paymaster denies.
    if (isPaymasterUnavailableError(error) && hasPrefundBalance) return true
    if (isPaymasterStakeError(error) || isPaymasterUnavailableError(error)) return true
    if (!ownerIsContract && shouldRetryVerificationGas(error)) return true
    return false
  }

  if (usePaymaster && lastError && shouldFallbackWithoutPaymaster(lastError)) {
    attemptedWithoutPaymaster = true
    const hasPrefundBalance = typeof smartWalletBalance === 'bigint' && smartWalletBalance > 0n
    if (isPaymasterUnavailableError(lastError) && !allowPaymasterFallback && hasPrefundBalance) {
      logger.warn('[ERC-4337] Paymaster unavailable; retrying with smart wallet balance', {
        smartWallet,
        balance: formatGasValue(smartWalletBalance),
      })
    } else {
      logger.warn('[ERC-4337] Retrying without sponsorship')
    }
    await attemptSend(false)
  }

  if (lastError) {
    const errMsg = lastError instanceof Error ? lastError.message : String(lastError)
    const lc = errMsg.toLowerCase()
    const metaDetail = formatMetaMessages(lastError)
    const metaSuffix = metaDetail ? ` (CDP: ${metaDetail})` : ''

    if (
      retryOnInvalidSignature &&
      userOpSignMode === 'auto' &&
      !usedSignMessageFallback &&
      (lc.includes('invalid signature') || lc.includes('signature check failed'))
    ) {
      return await sendCoinbaseSmartWalletUserOperation({
        publicClient,
        walletClient,
        bundlerUrl: bundlerUrlInput,
        paymasterUrl: paymasterUrlInput,
        smartWallet,
        ownerAddress,
        calls,
        version,
        userOpSignMode: 'signMessage',
        ownerIsContract: ownerIsContractOverride,
        skipPreflightSimulation,
        skipPaymaster,
        retryOnInvalidSignature: false,
      })
    }

    // Provide helpful error messages for common failures
    if (lc.includes('insufficient funds') || lc.includes('insufficient balance')) {
      throw new Error('Paymaster rejected: insufficient sponsorship funds. Contact support.')
    }
    if (lc.includes('max sponsorship cost') || lc.includes('sponsorship cost per user op exceeded')) {
      // Extract the cost and limit from the error if possible
      const costMatch = errMsg.match(/(\d+\.?\d*)\s*USD.*limit:\s*(\d+\.?\d*)\s*USD/i)
      if (costMatch) {
        throw new Error(
          `Gas sponsorship limit exceeded: this operation costs $${costMatch[1]} but the limit is $${costMatch[2]}. ` +
          'Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).'
        )
      }
      throw new Error(
        'Gas sponsorship limit exceeded. Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).'
      )
    }
    if (lc.includes('invalid signature') || lc.includes('signature check failed')) {
      throw new Error(
        'UserOp signature verification failed. This usually means the signer is not a valid owner. ' +
        'Try reconnecting your wallet or adding it as an owner of the smart wallet.'
      )
    }
    if (lc.includes('aa21') || lc.includes('didn\'t pay prefund')) {
      if (attemptedWithoutPaymaster) {
        throw new Error(
          'Smart wallet could not pay gas (no prefund). Add ETH to the smart wallet or re-enable gas sponsorship.'
        )
      }
      throw new Error(`Paymaster did not sponsor this operation. Check paymaster configuration.${metaSuffix}`)
    }
    if (lc.includes('aa25') || lc.includes('invalid account nonce')) {
      throw new Error('Account nonce mismatch. A pending transaction may exist. Wait and retry.')
    }
    if (lc.includes('aa10') || lc.includes('sender already constructed')) {
      throw new Error('Smart wallet already exists at this address.')
    }
    if (lc.includes('request denied -')) {
      const reason = errMsg.replace(/^.*request denied -\s*/i, '').trim()
      if (reason.includes('not authenticated')) {
        throw new Error(`Session expired or missing. Reconnect your wallet and try again.${metaSuffix}`)
      }
      if (reason.includes('creator not approved')) {
        throw new Error(
          `Creator not approved for gas sponsorship. Request access or join the allowlist, then retry.${metaSuffix}`,
        )
      }
      if (reason.includes('allowlist unavailable')) {
        throw new Error(`Paymaster allowlist is unavailable. Please retry shortly.${metaSuffix}`)
      }
      if (reason.includes('unsupported chainid')) {
        throw new Error(`Paymaster rejected this chain. Switch to Base mainnet and retry.${metaSuffix}`)
      }
      if (reason.includes('unsupported entrypoint')) {
        throw new Error(`Paymaster rejected the EntryPoint version. Please retry.${metaSuffix}`)
      }
      throw new Error(`Paymaster rejected this request: ${reason}.${metaSuffix}`)
    }
    if (isPaymasterUnavailableError(lastError)) {
      if (typeof smartWalletBalance === 'bigint' && smartWalletBalance <= 0n) {
        throw new Error(
          'Paymaster unavailable and smart wallet has no ETH for fallback. ' +
            'Add ETH to the smart wallet or fix the paymaster configuration.'
        )
      }
      throw new Error(
        `Paymaster unavailable. Check CDP paymaster configuration, sponsorship limits, and allowlist, then retry.${metaSuffix}`
      )
    }
    if (lc.includes('aa40') || lc.includes('verificationgaslimit')) {
      throw new Error(
        'Signature verification used more gas than estimated. ' +
        'This can happen with smart wallet signers (EIP-1271). Please try again.'
      )
    }
    if (lc.includes('aa41') || lc.includes('over paymasterverificationgaslimit')) {
      throw new Error('Paymaster verification gas limit exceeded. Please try again.')
    }
    if (lc.includes('banned opcode') || lc.includes('stake/unstake delay') || lc.includes('unstake delay too low')) {
      throw new Error(
        'Bundler rejected sponsored UserOp: paymaster stake/unstake delay too low. ' +
          'Retry with a funded smart wallet or contact support to fix paymaster stake.'
      )
    }
    
    throw new Error(`UserOperation failed: ${errMsg}`)
  }

  // Wait for on-chain confirmation with extended timeout
  if (!userOpHash) {
    throw new Error('UserOperation did not return a hash.')
  }

  const receipt = await waitForUserOperationReceipt(bundlerClient, { 
    hash: userOpHash, 
    timeout: 180_000 // 3 minutes for complex operations
  })
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] UserOp receipt', {
      actualGasUsed: formatGasValue((receipt as any)?.actualGasUsed),
      actualGasCost: formatGasValue((receipt as any)?.actualGasCost),
      txHash: (receipt as any)?.receipt?.transactionHash,
    })
  }
  
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
}
