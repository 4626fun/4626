import type { Address, Hex } from 'viem'
import { encodeAbiParameters, http } from 'viem'
import { toAccount } from 'viem/accounts'
import {
  createBundlerClient,
  createPaymasterClient,
  sendUserOperation,
  toCoinbaseSmartAccount,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction'

// NOTE: Avoid tight coupling to a specific `viem` client instance/type.
// wagmi and other libs can surface structurally-compatible clients that TypeScript may treat as distinct.
export type PublicClientLike = {
  chain: { id: number }
  readContract: (args: any) => Promise<any>
} & Record<string, any>

export type WalletClientLike = {
  request: (args: any) => Promise<any>
  signMessage: (args: any) => Promise<any>
  signTypedData: (args: any) => Promise<any>
  signTransaction?: (args: any) => Promise<any>
} & Record<string, any>

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

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
      // Coinbase Smart Wallet UserOps are signed over the 32-byte UserOp hash.
      // The signature must be over the raw hash (no EIP-191 prefix for eth_sign,
      // but Coinbase SW also supports EIP-191 via SignatureCheckerLib).
      
      const tryEthSign = async (): Promise<Hex> => {
        try {
          const sig = await (walletClient as any).request({ 
            method: 'eth_sign', 
            params: [address, hash] 
          })
          if (!sig || typeof sig !== 'string' || !sig.startsWith('0x')) {
            throw new Error('Invalid signature returned from eth_sign')
          }
          return sig as Hex
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
          const sig = await walletClient.signMessage({
            account: address,
            // `raw` signs the 32-byte payload (EIP-191 prefixed at JSON-RPC layer).
            // Coinbase Smart Wallet accepts this via SignatureCheckerLib.
            message: { raw: hash },
          })
          if (!sig || typeof sig !== 'string' || !sig.startsWith('0x')) {
            throw new Error('Invalid signature returned from signMessage')
          }
          return sig as Hex
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
      const sig = await walletClient.signMessage({ account: address, message })
      return sig as Hex
    },
    signTypedData: async (typedData: any) => {
      const sig = await walletClient.signTypedData({ account: address, ...(typedData as any) })
      return sig as Hex
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
      return signature as Hex
    },
    signMessage: async ({ message }) => {
      const msgStr = typeof message === 'string' 
        ? message 
        : typeof message === 'object' && 'raw' in message
          ? (message.raw as Hex)
          : String(message)
      return (await crossAppSignMessage(msgStr, { address: ownerAddress })) as Hex
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
  const transport = http(bundlerUrl, {
    fetchOptions: {
      credentials: 'include',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
    },
  })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport,
  })

  // Send the UserOperation - this will:
  // 1. Build the UserOp
  // 2. Call owner.sign() which opens the Zora popup
  // 3. Submit to bundler with paymaster
  const userOpHash = await sendUserOperation(bundlerClient, {
    account,
    calls,
    paymaster: {
      getPaymasterData: paymasterClient.getPaymasterData,
      getPaymasterStubData: paymasterClient.getPaymasterStubData,
    },
  })

  // Wait for on-chain confirmation
  const receipt = await waitForUserOperationReceipt(bundlerClient, { 
    hash: userOpHash, 
    timeout: 120_000 
  })
  
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
}

export async function sendCoinbaseSmartWalletUserOperation(params: {
  publicClient: PublicClientLike
  walletClient: WalletClientLike
  bundlerUrl: string
  smartWallet: Address
  ownerAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  version?: '1' | '1.1'
  userOpSignMode?: UserOpSignMode
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const { publicClient, walletClient, bundlerUrl, smartWallet, ownerAddress, calls, version = '1', userOpSignMode = 'auto' } = params
  
  // Input validation
  if (!bundlerUrl) throw new Error('Missing bundler URL')
  if (!smartWallet) throw new Error('Missing smart wallet address')
  if (!ownerAddress) throw new Error('Missing owner address')
  if (!publicClient) throw new Error('Missing public client')
  if (!walletClient) throw new Error('Missing wallet client')
  if (!calls || calls.length === 0) throw new Error('No calls provided')

  // Find owner index
  const { ownerIndex } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet,
    ownerAddress,
  })
  
  if (ownerIndex === null) {
    throw new Error(
      `Connected wallet (${ownerAddress}) is not an onchain owner of the smart wallet (${smartWallet}). ` +
      'Add this wallet as an owner first, or connect with a wallet that is already an owner.'
    )
  }

  // Create the owner account for signing
  const owner = createWalletBackedLocalAccount({ 
    walletClient, 
    address: ownerAddress, 
    userOpSignMode 
  })
  
  // Create the Coinbase Smart Account
  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex,
    version,
  })

  // CDP uses a single endpoint for bundler + paymaster JSON-RPC methods.
  // If `bundlerUrl` is our same-origin proxy (`/api/paymaster`), we MUST include cookies
  // so the backend can validate the SIWE session (`cv_auth_session`).
  const sessionToken = typeof window !== 'undefined' ? getStoredSessionToken() : null
  const transport = http(bundlerUrl, {
    fetchOptions: {
      credentials: 'include',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
    },
  })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport,
  })

  // Send the UserOperation via EntryPoint v0.6 with CDP paymaster
  let userOpHash: Hex
  try {
    userOpHash = await sendUserOperation(bundlerClient, {
      account,
      calls,
      paymaster: {
        getPaymasterData: paymasterClient.getPaymasterData,
        getPaymasterStubData: paymasterClient.getPaymasterStubData,
      },
    })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    const lc = errMsg.toLowerCase()
    
    // Provide helpful error messages for common failures
    if (lc.includes('insufficient funds') || lc.includes('insufficient balance')) {
      throw new Error('Paymaster rejected: insufficient sponsorship funds. Contact support.')
    }
    if (lc.includes('invalid signature') || lc.includes('signature check failed')) {
      throw new Error(
        'UserOp signature verification failed. This usually means the signer is not a valid owner. ' +
        'Try reconnecting your wallet or adding it as an owner of the smart wallet.'
      )
    }
    if (lc.includes('aa21') || lc.includes('didn\'t pay prefund')) {
      throw new Error('Paymaster did not sponsor this operation. Check paymaster configuration.')
    }
    if (lc.includes('aa25') || lc.includes('invalid account nonce')) {
      throw new Error('Account nonce mismatch. A pending transaction may exist. Wait and retry.')
    }
    if (lc.includes('aa10') || lc.includes('sender already constructed')) {
      throw new Error('Smart wallet already exists at this address.')
    }
    
    throw new Error(`UserOperation failed: ${errMsg}`)
  }

  // Wait for on-chain confirmation with extended timeout
  const receipt = await waitForUserOperationReceipt(bundlerClient, { 
    hash: userOpHash, 
    timeout: 180_000 // 3 minutes for complex operations
  })
  
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
}
