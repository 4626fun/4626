import type { Address, Hex } from 'viem'

declare const process: { env: Record<string, string | undefined> }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function readBaseRpcUrl(): string {
  const firstConfigured = (process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map((raw) => raw.trim())
    .find((raw) => raw.length > 0)
  return firstConfigured ?? 'https://mainnet.base.org'
}

function readAmoeRelayPrivateKey(): `0x${string}` | null {
  const value = String(process.env.LOTTERY_AMOE_RELAY_PRIVATE_KEY ?? '').trim()
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value as `0x${string}`
  return null
}

function readAmoeRelayOwnerPrivateKey(): `0x${string}` | null {
  const value = String(process.env.LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY ?? '').trim()
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value as `0x${string}`
  return null
}

function readAmoeRelaySmartWallet(): `0x${string}` | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_SMART_WALLET,
    process.env.CRE_ERC4337_SMART_WALLET,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (isAddressLike(value)) return value.toLowerCase() as `0x${string}`
  }
  return null
}

function readAmoeRelayBundlerUrl(): string | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_BUNDLER_URL,
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
    process.env.CRE_ERC4337_BUNDLER_URL,
    process.env.PAYMASTER_URL,
    process.env.BUNDLER_URL,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  return null
}

function readAmoeRelayPrivyWalletId(): string | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_PRIVY_WALLET_ID,
    process.env.CRE_ERC4337_PRIVY_WALLET_ID,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) return value
  }
  return null
}

function readAmoeRelayOwnerAddress(): `0x${string}` | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_OWNER,
    process.env.CRE_ERC4337_OWNER,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (isAddressLike(value)) return value.toLowerCase() as `0x${string}`
  }
  return null
}

export type AmoeRelayRequest = {
  to: `0x${string}`
  callData: `0x${string}`
}

export type AmoeRelayFn = (params: AmoeRelayRequest) => Promise<`0x${string}`>

export function hasAmoeRelayConfig(): boolean {
  if (readAmoeRelaySmartWallet() && readAmoeRelayBundlerUrl()) return true
  return readAmoeRelayPrivateKey() !== null || readAmoeRelayOwnerPrivateKey() !== null
}

export function createAmoeRelay(): AmoeRelayFn | null {
  if (!hasAmoeRelayConfig()) return null
  return relayAmoeTransaction
}

async function relayAmoeTransaction(params: AmoeRelayRequest): Promise<`0x${string}`> {
  const [{ createPublicClient, createWalletClient, getAddress, http }, { base }, { privateKeyToAccount }] = await Promise.all([
    import('viem'),
    import('viem/chains'),
    import('viem/accounts'),
  ])
  const publicClient = createPublicClient({
    chain: base,
    transport: http(readBaseRpcUrl(), { timeout: 30_000 }),
  })

  const smartWallet = readAmoeRelaySmartWallet()
  const bundlerUrl = readAmoeRelayBundlerUrl()
  if (smartWallet && bundlerUrl) {
    const {
      findCoinbaseSmartWalletOwnerIndex,
      resolvePrivyCoinbaseSmartWalletOwnerContext,
      sendCoinbaseSmartWalletUserOperation,
      sendPrivyCoinbaseSmartWalletUserOperation,
    } = await import('../wallet/privyCoinbaseSmartWallet.js')
    const calls = [{ to: params.to, value: 0n, data: params.callData }]

    const privyWalletId = readAmoeRelayPrivyWalletId()
    const expectedOwnerAddress = readAmoeRelayOwnerAddress()
    if (privyWalletId && expectedOwnerAddress) {
      const ownerContext = await resolvePrivyCoinbaseSmartWalletOwnerContext({
        publicClient,
        walletId: privyWalletId,
        smartWallet,
        expectedOwnerAddress,
        maxScan: 512,
      })
      const viaPrivyUserOp = await sendPrivyCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl,
        walletId: privyWalletId,
        smartWallet,
        ownerAddress: ownerContext.ownerAddress,
        ownerIndex: ownerContext.ownerIndex,
        calls,
        simulate: false,
      })
      return viaPrivyUserOp.txHash
    }

    const ownerPk = readAmoeRelayOwnerPrivateKey()
    if (ownerPk) {
      const ownerAccount = privateKeyToAccount(ownerPk)
      const ownerAddress = getAddress(ownerAccount.address)
      const ownerIndex = await findCoinbaseSmartWalletOwnerIndex({
        publicClient,
        smartWallet,
        ownerAddress,
        maxScan: 512,
      })
      if (ownerIndex === null) {
        throw new Error('amoe_relay_owner_not_csw_owner')
      }
      const viaUserOp = await sendCoinbaseSmartWalletUserOperation({
        publicClient,
        bundlerUrl,
        smartWallet,
        ownerAccount,
        ownerIndex,
        calls,
        simulate: false,
      })
      return viaUserOp.txHash
    }
  }

  const relayPk = readAmoeRelayPrivateKey() ?? readAmoeRelayOwnerPrivateKey()
  if (!relayPk) {
    throw new Error('amoe_relay_unavailable')
  }
  const wallet = createWalletClient({
    account: privateKeyToAccount(relayPk),
    chain: base,
    transport: http(readBaseRpcUrl(), { timeout: 30_000 }),
  })
  const hash = await wallet.sendTransaction({
    chain: base,
    to: params.to as Address,
    data: params.callData as Hex,
    value: 0n,
  })
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 120_000,
  })
  if (receipt.status !== 'success') throw new Error('amoe_relay_tx_failed')
  return hash
}
