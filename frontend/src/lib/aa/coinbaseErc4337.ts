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
      //
      // - Prefer `eth_sign` when available (no EIP-191 prefix).
      // - Many wallets (notably Rabby and some injected providers) block `eth_sign` entirely.
      //   In those cases, `personal_sign` / EIP-191 is NOT a reliable fallback for UserOp hashes; the account will
      //   typically reject it during simulation. Sign in with wallet to use the Privy smart wallet client, or use Coinbase Wallet (Base Account).
      const tryEthSign = async () => {
        const sig = await (walletClient as any).request({ method: 'eth_sign', params: [address, hash] })
        return sig as Hex
      }
      const tryPersonalSign = async () => {
        return (await walletClient.signMessage({
          account: address,
          // `raw` signs the 32-byte payload (still EIP-191 prefixed at the JSON-RPC layer).
          message: { raw: hash },
        })) as Hex
      }

      if (userOpSignMode === 'eth_sign') return await tryEthSign()
      if (userOpSignMode === 'signMessage') return await tryPersonalSign()

      try {
        return await tryEthSign()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e ?? '')
        const lc = msg.toLowerCase()
        const code = (e as any)?.code
        const looksBlocked =
          lc.includes('eth_sign') ||
          code === -32601 ||
          lc.includes('-32601') ||
          (lc.includes('method not found') && lc.includes('sign')) ||
          lc.includes('unsupported method') ||
          lc.includes('not supported')
        if (looksBlocked) {
          // Many wallets block `eth_sign`, but *can* still produce a valid signature for smart accounts via
          // `personal_sign` / `signMessage` (EIP-191). Try it as a fallback in auto mode.
          try {
            return await tryPersonalSign()
          } catch {
            throw new Error(
              "Your signer blocked the raw signature method (`eth_sign`) and couldn’t sign via `personal_sign`. Sign in with wallet to use the Privy smart wallet client, or use Coinbase Wallet (Base Account).",
            )
          }
        }
        throw e
      }
    },
    signMessage: async ({ message }) => {
      return (await walletClient.signMessage({ account: address, message })) as Hex
    },
    signTypedData: async (typedData: any) => {
      return (await walletClient.signTypedData({ account: address, ...(typedData as any) })) as Hex
    },
    signTransaction: async (tx, options) => {
      const wc: any = walletClient as any
      if (typeof wc.signTransaction !== 'function') throw new Error('Wallet does not support signTransaction')
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
  if (!bundlerUrl) throw new Error('Missing bundler URL')

  const { ownerIndex } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet,
    ownerAddress,
  })
  const resolvedOwnerIndex = ownerIndex ?? null
  if (resolvedOwnerIndex === null) {
    throw new Error('Connected wallet is not an onchain owner of this Coinbase Smart Wallet.')
  }

  const owner = createWalletBackedLocalAccount({ walletClient, address: ownerAddress, userOpSignMode })
  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex: resolvedOwnerIndex,
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

  const userOpHash = await sendUserOperation(bundlerClient, {
    account,
    calls,
    paymaster: {
      getPaymasterData: paymasterClient.getPaymasterData,
      getPaymasterStubData: paymasterClient.getPaymasterStubData,
    },
  })

  const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: userOpHash, timeout: 120_000 })
  return { userOpHash, transactionHash: receipt.receipt.transactionHash as Hex }
}
