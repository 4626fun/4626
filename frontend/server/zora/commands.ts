import type { Address } from 'viem'
import { isAddress, getAddress, parseEther, formatEther, formatUnits, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'

import { logger } from '../_lib/infra/logger.js'
import { BASE_CAIP2, walletRpc } from '../_lib/wallet/privyWalletApi.js'
import {
  buildInsufficientFundsRefusal,
  checkWalletBalancePreflight,
  getBasePreflightPublicClient,
  isInsufficientFundsError,
} from '../_lib/wallet/walletBalancePreflight.js'
import type { KeeprVaultRow } from '../_lib/keepr/keeprRegistry.js'
import type { KeeprRole, KeeprCommandResult } from '../commands/types.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_CHAIN_ID = 8453

/**
 * Platform referrer address for Zora revenue.
 *
 * — On coin creation (`platformReferrer`): earns 0.2% of ALL future trades
 *   on that coin, FOREVER. This is the primary revenue stream.
 * — On trades (`referrer`): earns 0.04% per trade executed through Keepr.
 *
 * Set via ZORA_PLATFORM_REFERRER_ADDRESS env var.
 * Falls back to the CSW address (XMTP_AGENT_CSW_ADDRESS) if not set.
 */
function getPlatformReferrerAddress(): Address | undefined {
  const explicit = (process.env.ZORA_PLATFORM_REFERRER_ADDRESS ?? '').trim()
  if (explicit && isAddress(explicit)) return getAddress(explicit) as Address

  // Fallback: use the canonical CSW address
  const csw = (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim()
  if (csw && isAddress(csw)) return getAddress(csw) as Address

  return undefined
}

const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
])

// Rate limiting – one coin command per group per 60 s
const coinCooldowns = new Map<string, number>()
const COIN_COOLDOWN_MS = 60_000

function canExecute(groupId: string): boolean {
  const last = coinCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= COIN_COOLDOWN_MS
}

function recordExecution(groupId: string) {
  coinCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPublicClient() {
  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  return createPublicClient({ chain: base, transport: http(rpcUrl) })
}

/**
 * Preflight the agent-wallet balance before submitting an eth_sendTransaction.
 * Returns a KeeprCommandResult refusal when the wallet can't cover value+gas;
 * returns null when the transaction should proceed. Logs and proceeds on
 * balance-lookup failure (fail-open).
 *
 * This is a defensive UX unblock while Architecture B migration is planned —
 * see docs/architecture-b-design.md.
 */
async function preflightAgentWalletOrRefuse(params: {
  agentWallet: Address
  valueWei: bigint
  context: string
}): Promise<KeeprCommandResult | null> {
  const preflight = await checkWalletBalancePreflight({
    publicClient: getBasePreflightPublicClient(),
    wallet: params.agentWallet,
    valueWei: params.valueWei,
  })
  if (preflight.sufficient === false) {
    logger.warn(`[${params.context}] insufficient_funds preflight`, {
      wallet: params.agentWallet,
      balanceWei: preflight.balanceWei.toString(),
      requiredWei: preflight.requiredWei.toString(),
    })
    return { ok: false, response: buildInsufficientFundsRefusal(preflight) }
  }
  if (preflight.sufficient === null) {
    logger.warn(`[${params.context}] balance preflight skipped`, {
      wallet: params.agentWallet,
      reason: preflight.reason,
    })
  }
  return null
}

/**
 * Call the Zora Quote API directly so we can include the `referrer` field
 * for trade referral revenue (0.04% per trade). The SDK's `createTradeCall`
 * doesn't expose this parameter.
 */
async function getTradeQuoteWithReferrer(params: {
  tokenIn: { type: 'eth' } | { type: 'erc20'; address: string }
  tokenOut: { type: 'eth' } | { type: 'erc20'; address: string }
  amountIn: string
  slippage?: number
  sender: string
  referrer?: string
  signatures?: any[]
}): Promise<{ call: { target: string; data: string; value: string }; permits?: any[] }> {
  const apiKey = (process.env.ZORA_SERVER_API_KEY ?? '').trim()

  const body: Record<string, unknown> = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    slippage: params.slippage,
    chainId: BASE_CHAIN_ID,
    sender: params.sender,
    recipient: params.sender,
  }

  if (params.referrer) body.referrer = params.referrer
  if (params.signatures) body.signatures = params.signatures

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  const res = await fetch('https://api-sdk.zora.engineering/quote', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Zora quote API ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as any
  if (!data.call?.target) {
    throw new Error('Invalid quote response — missing call data')
  }

  return data
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function formatCoinHelp(): string {
  const referrer = getPlatformReferrerAddress()
  return [
    'Zora Coin commands',
    '',
    '- /coin help — Show this help',
    '- /coin balance — Check agent wallet balances',
    '- /coin create <name> <symbol> <metadataUri> [currency] — Create a Content Coin',
    '  currencies: CREATOR_COIN (default), ETH, ZORA',
    '- /coin buy <coin-address> <eth-amount> — Buy a coin with ETH',
    '- /coin sell <coin-address> <amount> — Sell a coin for ETH',
    '- /coin info <coin-address> — Look up coin details',
    '- /coin trend help — Trend ops help',
    '- /coin trend check <ticker> — preflight ticker/address status',
    '- /coin trend reserve <ticker> — deploy TrendCoin for this creator',
    '- /coin trend status <ticker> — show persisted + onchain trend state',
    '- /coin trend funnel <ticker> [eth-amount] — run guarded funnel action',
    '',
    'Revenue:',
    `- Platform referrer: ${referrer ?? '(not set)'}`,
    '- Coin creation: earns 0.2% of ALL future trades (forever)',
    '- Each trade: earns 0.04% per trade through Keepr',
    '',
    'Note: The agent wallet must be funded with ETH for gas + purchases.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// /coin balance
// ---------------------------------------------------------------------------

async function handleBalance(params: {
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  let agentWalletAddress: string

  try {
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/wallet/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[coin/balance] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available. Contact the vault creator.' }
  }

  try {
    const client = getPublicClient()
    const ethBalance = await client.getBalance({ address: agentWalletAddress as Address })

    return {
      ok: true,
      response: [
        'Agent Wallet Balance',
        '',
        `- Wallet: ${agentWalletAddress}`,
        `- ETH: ${formatEther(ethBalance)}`,
        '',
        `Fund this wallet to enable coin creation and trading.`,
      ].join('\n'),
    }
  } catch (err: any) {
    logger.error('[coin/balance] Balance check failed', err)
    return { ok: false, response: `Balance check failed: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

// ---------------------------------------------------------------------------
// /coin info
// ---------------------------------------------------------------------------

async function handleInfo(coinAddress: string): Promise<KeeprCommandResult> {
  if (!coinAddress || !isAddress(coinAddress)) {
    return { ok: false, response: 'Usage: /coin info <coin-address>' }
  }

  try {
    const { getCoin } = await import('@zoralabs/coins-sdk')
    const result = await getCoin({ address: coinAddress, chain: BASE_CHAIN_ID })
    const coin = (result as any)?.data?.zora?.coin

    if (!coin) {
      return { ok: true, response: `Coin not found: ${coinAddress}` }
    }

    return {
      ok: true,
      response: [
        `Coin Info: ${coin.name ?? 'Unknown'}`,
        '',
        `- Symbol: ${coin.symbol ?? '?'}`,
        `- Address: ${coinAddress}`,
        `- Creator: ${coin.creatorAddress ?? 'n/a'}`,
        `- Total Supply: ${coin.totalSupply ?? 'n/a'}`,
        `- Market Cap: ${coin.marketCap ?? 'n/a'}`,
        `- Volume 24h: ${coin.volume24h ?? 'n/a'}`,
        `- Chain: Base (8453)`,
      ].join('\n'),
    }
  } catch (err: any) {
    logger.error('[coin/info] Lookup failed', err)
    return { ok: false, response: `Coin lookup failed: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

// ---------------------------------------------------------------------------
// /coin create
// ---------------------------------------------------------------------------

async function handleCreate(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // /coin create <name> <symbol> <metadataUri> [currency]
  const [name, symbol, metadataUri, currencyArg] = params.args

  if (!name || !symbol || !metadataUri) {
    return {
      ok: false,
      response: [
        'Usage: /coin create <name> <symbol> <metadataUri> [currency]',
        '',
        'Example: /coin create "My Content" MYC ipfs://Qm... CREATOR_COIN',
        '',
        'Currencies: CREATOR_COIN (default), ETH, ZORA, CONTENT_COIN (alias for CREATOR_COIN)',
      ].join('\n'),
    }
  }

  const validCurrencies = ['CREATOR_COIN', 'ETH', 'ZORA', 'CREATOR_COIN_OR_ZORA'] as const
  const validCurrencyInputs = [...validCurrencies, 'CONTENT_COIN'] as const
  type Currency = (typeof validCurrencies)[number]
  const currencyToken = (currencyArg ?? 'CREATOR_COIN').toUpperCase() as (typeof validCurrencyInputs)[number]
  const currency: Currency =
    currencyToken === 'CONTENT_COIN'
      ? 'CREATOR_COIN'
      : validCurrencies.includes(currencyToken as Currency)
        ? (currencyToken as Currency)
        : 'CREATOR_COIN'

  // Get agent wallet
  let agentWalletId: string
  let agentWalletAddress: string
  try {
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/wallet/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletId = wallet.walletId
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[coin/create] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available.' }
  }

  try {
    const { createCoinCall } = await import('@zoralabs/coins-sdk')

    // Platform referrer earns 0.2% of ALL future trades on this coin, forever
    const platformReferrer = getPlatformReferrerAddress()

    const callResult = await createCoinCall({
      creator: agentWalletAddress,
      name: name.replace(/^"|"$/g, ''), // strip quotes
      symbol: symbol.replace(/^"|"$/g, ''),
      metadata: { type: 'RAW_URI', uri: metadataUri },
      currency,
      chainId: BASE_CHAIN_ID,
      platformReferrer: platformReferrer ?? agentWalletAddress,
      payoutRecipientOverride: agentWalletAddress as Address,
      skipMetadataValidation: true,
    })

    if (!callResult.calls || callResult.calls.length === 0) {
      return { ok: false, response: 'Failed to build coin creation calldata.' }
    }

    // Execute each call in sequence (usually one call)
    const txHashes: string[] = []
    for (const call of callResult.calls) {
      const refusal = await preflightAgentWalletOrRefuse({
        agentWallet: agentWalletAddress as Address,
        valueWei: BigInt(call.value ?? 0n),
        context: 'coin/create',
      })
      if (refusal) return refusal
      const result = await walletRpc<any>({
        walletId: agentWalletId,
        method: 'eth_sendTransaction',
        caip2: BASE_CAIP2,
        rpcParams: {
          transaction: {
            to: call.to,
            data: call.data,
            value: `0x${call.value.toString(16)}`,
            chain_id: BASE_CHAIN_ID,
          },
        },
        idempotencyKey: `coin-create:${params.groupId}:${Date.now()}`,
      })
      txHashes.push(String(result?.data?.hash ?? result?.hash ?? 'pending'))
    }

    recordExecution(params.groupId)

    return {
      ok: true,
      response: [
        'Content Coin created!',
        '',
        `- Name: ${name}`,
        `- Symbol: ${symbol}`,
        `- Currency: ${currency}`,
        `- Predicted address: ${callResult.predictedCoinAddress}`,
        `- Platform referrer: ${platformReferrer ?? agentWalletAddress}`,
        `- Revenue: 0.2% of all future trades on this coin`,
        `- Tx: https://basescan.org/tx/${txHashes[0]}`,
        `- Creator: ${agentWalletAddress}`,
      ].join('\n'),
      action: {
        action: 'zora.coin.created',
        name,
        symbol,
        currency,
        predictedAddress: callResult.predictedCoinAddress,
        platformReferrer: platformReferrer ?? agentWalletAddress,
        txHash: txHashes[0],
        creator: agentWalletAddress,
        groupId: params.groupId,
      },
    }
  } catch (err: any) {
    logger.error('[coin/create] Creation failed', err)
    if (isInsufficientFundsError(err)) {
      return { ok: false, response: buildInsufficientFundsRefusal({ balanceWei: 0n, requiredWei: 0n }) }
    }
    return { ok: false, response: `Coin creation failed: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

// ---------------------------------------------------------------------------
// /coin buy
// ---------------------------------------------------------------------------

async function handleBuy(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  const [coinAddress, ethAmount] = params.args

  if (!coinAddress || !isAddress(coinAddress) || !ethAmount) {
    return {
      ok: false,
      response: [
        'Usage: /coin buy <coin-address> <eth-amount>',
        '',
        'Example: /coin buy 0xabc...def 0.01',
      ].join('\n'),
    }
  }

  const amountNum = Number(ethAmount)
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 10) {
    return { ok: false, response: 'Invalid amount. Must be between 0 and 10 ETH.' }
  }

  // Get agent wallet
  let agentWalletId: string
  let agentWalletAddress: string
  try {
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/wallet/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletId = wallet.walletId
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[coin/buy] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available.' }
  }

  try {
    const amountIn = parseEther(ethAmount)

    // Trade referrer earns 0.04% per trade
    const tradeReferrer = getPlatformReferrerAddress()

    // Get the trade quote with referrer — buying with ETH requires no permits
    const quote = await getTradeQuoteWithReferrer({
      tokenIn: { type: 'eth' },
      tokenOut: { type: 'erc20', address: getAddress(coinAddress) },
      amountIn: amountIn.toString(),
      slippage: 0.03, // 3% slippage
      sender: agentWalletAddress,
      referrer: tradeReferrer,
    })

    const call = quote?.call
    if (!call?.target || !call?.data) {
      return { ok: false, response: 'Failed to get trade quote. The coin may not have liquidity.' }
    }

    // Execute the trade
    const buyRefusal = await preflightAgentWalletOrRefuse({
      agentWallet: agentWalletAddress as Address,
      valueWei: call.value ? BigInt(call.value) : 0n,
      context: 'coin/buy',
    })
    if (buyRefusal) return buyRefusal
    const result = await walletRpc<any>({
      walletId: agentWalletId,
      method: 'eth_sendTransaction',
      caip2: BASE_CAIP2,
      rpcParams: {
        transaction: {
          to: call.target,
          data: call.data,
          value: call.value ? `0x${BigInt(call.value).toString(16)}` : '0x0',
          chain_id: BASE_CHAIN_ID,
        },
      },
      idempotencyKey: `coin-buy:${params.groupId}:${Date.now()}`,
    })

    const txHash = String(result?.data?.hash ?? result?.hash ?? 'pending')
    recordExecution(params.groupId)

    return {
      ok: true,
      response: [
        'Coin purchased!',
        '',
        `- Coin: ${coinAddress}`,
        `- Spent: ${ethAmount} ETH`,
        `- Slippage: 3%`,
        `- Tx: https://basescan.org/tx/${txHash}`,
        `- Buyer: ${agentWalletAddress}`,
      ].join('\n'),
      action: {
        action: 'zora.coin.bought',
        coinAddress,
        ethAmount,
        txHash,
        buyer: agentWalletAddress,
        groupId: params.groupId,
      },
    }
  } catch (err: any) {
    logger.error('[coin/buy] Buy failed', err)
    if (isInsufficientFundsError(err)) {
      return { ok: false, response: buildInsufficientFundsRefusal({ balanceWei: 0n, requiredWei: 0n }) }
    }
    return { ok: false, response: `Buy failed: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

// ---------------------------------------------------------------------------
// /coin sell
// ---------------------------------------------------------------------------

async function handleSell(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  const [coinAddress, amount] = params.args

  if (!coinAddress || !isAddress(coinAddress) || !amount) {
    return {
      ok: false,
      response: [
        'Usage: /coin sell <coin-address> <amount>',
        '',
        'Example: /coin sell 0xabc...def 1000',
        '(amount is in token units)',
      ].join('\n'),
    }
  }

  const amountNum = Number(amount)
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { ok: false, response: 'Invalid amount. Must be a positive number.' }
  }

  // Get agent wallet
  let agentWalletId: string
  let agentWalletAddress: string
  try {
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/wallet/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletId = wallet.walletId
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[coin/sell] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available.' }
  }

  try {
    // Read coin decimals to parse the amount correctly
    const client = getPublicClient()
    let decimals = 18
    try {
      decimals = await client.readContract({
        address: getAddress(coinAddress) as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'decimals',
      })
    } catch {
      // Default to 18 if we can't read decimals
    }

    const amountIn = BigInt(Math.floor(amountNum * 10 ** decimals))

    // Trade referrer earns 0.04% per trade
    const tradeReferrer = getPlatformReferrerAddress()

    // Get the trade quote with referrer — selling ERC-20 may need Permit2
    const quote = await getTradeQuoteWithReferrer({
      tokenIn: { type: 'erc20', address: getAddress(coinAddress) },
      tokenOut: { type: 'eth' },
      amountIn: amountIn.toString(),
      slippage: 0.03,
      sender: agentWalletAddress,
      referrer: tradeReferrer,
    })

    const call = quote?.call
    if (!call?.target || !call?.data) {
      return { ok: false, response: 'Failed to get sell quote. The coin may not have liquidity.' }
    }

    // If permits are needed, sign them via Privy then re-quote with signatures
    const permits = quote?.permits as any[] | undefined
    let finalCall = call
    if (permits && permits.length > 0) {
      const signedPermits: any[] = []
      for (const permit of permits) {
        if (!permit.signature || permit.signature === '0x') {
          // Need to sign Permit2 typed data via the agent wallet
          const typedData = {
            types: {
              PermitSingle: [
                { name: 'details', type: 'PermitDetails' },
                { name: 'spender', type: 'address' },
                { name: 'sigDeadline', type: 'uint256' },
              ],
              PermitDetails: [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint160' },
                { name: 'expiration', type: 'uint48' },
                { name: 'nonce', type: 'uint48' },
              ],
            },
            primaryType: 'PermitSingle',
            domain: {
              name: 'Permit2',
              chainId: BASE_CHAIN_ID,
              verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
            },
            message: permit.permit,
          }

          const sigResult = await walletRpc<any>({
            walletId: agentWalletId,
            method: 'eth_signTypedData_v4',
            rpcParams: { typedData },
            idempotencyKey: `coin-sell-permit:${params.groupId}:${Date.now()}`,
          })

          signedPermits.push({
            signature: String(sigResult?.data?.signature ?? sigResult?.signature ?? ''),
            permit: permit.permit,
          })
        } else {
          signedPermits.push(permit)
        }
      }

      // Re-quote with signed permits to get calldata that includes the authorization
      const reQuote = await getTradeQuoteWithReferrer({
        tokenIn: { type: 'erc20', address: getAddress(coinAddress) },
        tokenOut: { type: 'eth' },
        amountIn: amountIn.toString(),
        slippage: 0.03,
        sender: agentWalletAddress,
        referrer: tradeReferrer,
        signatures: signedPermits,
      })
      finalCall = reQuote.call
    }

    // Execute the trade (sells typically have value=0, but gas still required)
    const sellRefusal = await preflightAgentWalletOrRefuse({
      agentWallet: agentWalletAddress as Address,
      valueWei: finalCall.value ? BigInt(finalCall.value) : 0n,
      context: 'coin/sell',
    })
    if (sellRefusal) return sellRefusal
    const result = await walletRpc<any>({
      walletId: agentWalletId,
      method: 'eth_sendTransaction',
      caip2: BASE_CAIP2,
      rpcParams: {
        transaction: {
          to: finalCall.target,
          data: finalCall.data,
          value: finalCall.value ? `0x${BigInt(finalCall.value).toString(16)}` : '0x0',
          chain_id: BASE_CHAIN_ID,
        },
      },
      idempotencyKey: `coin-sell:${params.groupId}:${Date.now()}`,
    })

    const txHash = String(result?.data?.hash ?? result?.hash ?? 'pending')
    recordExecution(params.groupId)

    return {
      ok: true,
      response: [
        'Coin sold!',
        '',
        `- Coin: ${coinAddress}`,
        `- Amount: ${amount} tokens`,
        `- Slippage: 3%`,
        `- Tx: https://basescan.org/tx/${txHash}`,
        `- Seller: ${agentWalletAddress}`,
      ].join('\n'),
      action: {
        action: 'zora.coin.sold',
        coinAddress,
        amount,
        txHash,
        seller: agentWalletAddress,
        groupId: params.groupId,
      },
    }
  } catch (err: any) {
    logger.error('[coin/sell] Sell failed', err)
    if (isInsufficientFundsError(err)) {
      return { ok: false, response: buildInsufficientFundsRefusal({ balanceWei: 0n, requiredWei: 0n }) }
    }
    return { ok: false, response: `Sell failed: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

// ---------------------------------------------------------------------------
// /coin trend
// ---------------------------------------------------------------------------

function formatTrendHelp(): string {
  return [
    'Trend command usage',
    '',
    '- /coin trend check <ticker>',
    '- /coin trend reserve <ticker>',
    '- /coin trend status <ticker>',
    '- /coin trend funnel <ticker> [eth-amount]',
    '',
    'Examples:',
    '- /coin trend check "BASE AI"',
    '- /coin trend reserve BASEAI',
    '- /coin trend funnel BASEAI 0.005',
  ].join('\n')
}

function parseOptionalEthToWei(raw: string | undefined): bigint | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  try {
    const wei = parseEther(value)
    if (wei <= 0n) return null
    return wei
  } catch {
    return null
  }
}

async function handleTrend(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  const sub = String(params.args[0] ?? 'help').trim().toLowerCase()
  const ticker = String(params.args[1] ?? '').trim()

  if (sub === 'help') {
    return { ok: true, response: formatTrendHelp() }
  }
  if (!ticker) {
    return { ok: false, response: `Missing ticker.\n\n${formatTrendHelp()}` }
  }

  try {
    const { preflightTrendTicker, reserveTrendTicker } = await import('./trends.js')
    const {
      getTrendOpByTickerHash,
      markTrendOpDeployed,
      markTrendOpDeploying,
      markTrendOpFailed,
      upsertTrendPrediction,
    } = await import('../_lib/zora/zoraTrendOpsStore.js')

    if (sub === 'check') {
      const preflight = await preflightTrendTicker({ ticker })
      return {
        ok: true,
        response: [
          'Trend preflight',
          '',
          `- Ticker: ${preflight.ticker}`,
          `- Ticker hash: ${preflight.tickerHash}`,
          `- Predicted coin: ${preflight.predictedAddress}`,
          `- Deployed: ${preflight.deployed ? 'yes' : 'no'}`,
        ].join('\n'),
      }
    }

    if (sub === 'status') {
      const preflight = await preflightTrendTicker({ ticker })
      let stored: any = null
      try {
        stored = await getTrendOpByTickerHash(preflight.tickerHash)
      } catch {
        stored = null
      }
      return {
        ok: true,
        response: [
          'Trend status',
          '',
          `- Ticker: ${preflight.ticker}`,
          `- Ticker hash: ${preflight.tickerHash}`,
          `- Predicted coin: ${preflight.predictedAddress}`,
          `- Onchain deployed: ${preflight.deployed ? 'yes' : 'no'}`,
          `- Stored status: ${stored?.status ?? 'n/a'}`,
          `- Stored tx: ${stored?.txHash ?? 'n/a'}`,
          `- Last error: ${stored?.lastError ?? 'n/a'}`,
          `- Updated: ${stored?.updatedAt ?? 'n/a'}`,
        ].join('\n'),
      }
    }

    if (sub === 'reserve') {
      const preflight = await preflightTrendTicker({ ticker })
      await upsertTrendPrediction({
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        predictedCoinAddress: preflight.predictedAddress,
        actorWallet: params.senderWallet,
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        funnelMetadata: {
          source: 'xmtp_coin_command',
          command: 'reserve',
        },
      })

      if (preflight.deployed) {
        await markTrendOpDeployed({
          tickerHash: preflight.tickerHash,
          deployedCoinAddress: preflight.predictedAddress,
        })
        return {
          ok: true,
          response: [
            'Trend already deployed',
            '',
            `- Ticker: ${preflight.ticker}`,
            `- Coin: ${preflight.predictedAddress}`,
          ].join('\n'),
        }
      }

      await markTrendOpDeploying({ tickerHash: preflight.tickerHash })

      try {
        const reservation = await reserveTrendTicker({
          ticker: preflight.ticker,
          creatorToken: params.vault.creatorCoinAddress,
          groupId: params.groupId,
          waitForReceipt: true,
        })

        if (reservation.status === 'deployed' || reservation.status === 'already_deployed') {
          await markTrendOpDeployed({
            tickerHash: preflight.tickerHash,
            deployedCoinAddress: reservation.deployedAddress,
            txHash: reservation.txHash,
            actorWallet: reservation.walletAddress ?? undefined,
          })
        } else {
          await markTrendOpDeploying({
            tickerHash: preflight.tickerHash,
            txHash: reservation.txHash,
            actorWallet: reservation.walletAddress ?? undefined,
          })
        }

        recordExecution(params.groupId)
        return {
          ok: true,
          response: [
            reservation.status === 'deployed' ? 'Trend reserved + deployed' : 'Trend reserve submitted',
            '',
            `- Ticker: ${reservation.ticker}`,
            `- Ticker hash: ${reservation.tickerHash}`,
            `- Coin: ${reservation.deployedAddress}`,
            `- Deployed: ${reservation.deployed ? 'yes' : 'pending'}`,
            `- Tx: ${reservation.txHash ? `https://basescan.org/tx/${reservation.txHash}` : 'n/a'}`,
          ].join('\n'),
          action: {
            action: 'zora.trend.reserve',
            ticker: reservation.ticker,
            tickerHash: reservation.tickerHash,
            coinAddress: reservation.deployedAddress,
            txHash: reservation.txHash,
            status: reservation.status,
            groupId: params.groupId,
          },
        }
      } catch (error: any) {
        await markTrendOpFailed({
          tickerHash: preflight.tickerHash,
          lastError: String(error?.message ?? 'reserve_failed'),
        })
        throw error
      }
    }

    if (sub === 'funnel') {
      const notionalWei = parseOptionalEthToWei(params.args[2])
      if (params.args[2] && !notionalWei) {
        return { ok: false, response: 'Invalid optional ETH amount. Example: `/coin trend funnel BASEAI 0.005`' }
      }

      const preflight = await preflightTrendTicker({ ticker })
      await upsertTrendPrediction({
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        predictedCoinAddress: preflight.predictedAddress,
        actorWallet: params.senderWallet,
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        funnelMetadata: {
          source: 'xmtp_coin_command',
          command: 'funnel',
        },
      })

      const { runTrendFunnel } = await import('./trendFunnel.js')
      const run = await runTrendFunnel({
        ticker: preflight.ticker,
        tickerHash: preflight.tickerHash,
        trendCoinAddress: preflight.predictedAddress,
        creatorToken: params.vault.creatorCoinAddress,
        groupId: params.groupId,
        notionalWei: notionalWei ?? undefined,
      })

      recordExecution(params.groupId)
      return {
        ok: run.status === 'executed',
        response: [
          `Trend funnel: ${run.status}`,
          '',
          `- Ticker: ${preflight.ticker}`,
          `- Trend coin: ${preflight.predictedAddress}`,
          `- Routeability passed: ${run.routeability.passed ? 'yes' : 'no'}`,
          `- Action executed: ${run.action.executed ? 'yes' : 'no'}`,
          `- Target token: ${run.action.targetToken ?? 'n/a'}`,
          `- Amount in: ${run.action.amountInWei ?? 'n/a'} wei`,
          `- Tx: ${run.action.txHash ? `https://basescan.org/tx/${run.action.txHash}` : 'n/a'}`,
          run.reason ? `- Reason: ${run.reason}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        action: {
          action: 'zora.trend.funnel',
          ticker: preflight.ticker,
          tickerHash: preflight.tickerHash,
          status: run.status,
          txHash: run.action.txHash,
          groupId: params.groupId,
          reason: run.reason,
        },
      }
    }

    return { ok: false, response: `Unknown trend subcommand: ${sub}. Try \`/coin trend help\`.` }
  } catch (err: any) {
    // Map insufficient-funds failures (either the typed error from trends.ts
    // or a raw Privy 400 that slipped past preflight) to a friendly refusal
    // instead of leaking raw gas-accounting errors to end users.
    if (err?.code === 'insufficient_funds' || isInsufficientFundsError(err)) {
      logger.warn('[coin/trend] insufficient funds refusal', { sub, message: err?.message })
      return {
        ok: false,
        response:
          "This trade can't be executed right now — the agent wallet needs funding before it can cover gas. " +
          'Contact setup or try again after it is topped up.',
      }
    }
    logger.error('[coin/trend] command failed', { sub, err })
    return { ok: false, response: `Trend command failed: ${(err?.message ?? '').slice(0, 220)}` }
  }
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export async function handleCoinCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: KeeprRole
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // Permission check — coin commands require ADMIN or OWNER
  if (params.role === 'MEMBER') {
    return { ok: false, response: 'Denied: /coin commands are ADMIN or OWNER only.' }
  }

  // Rate limit
  if (!canExecute(params.groupId)) {
    return { ok: false, response: 'Rate limited. Wait 1 minute between coin commands.' }
  }

  const raw = (params.text ?? '').trim()
  // Parse: /coin <subcommand> <args...>
  // Handle quoted arguments for names with spaces
  const tokenized: string[] = []
  const regex = /"([^"]+)"|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    tokenized.push(match[1] ?? match[2])
  }

  // Remove the /coin or coin prefix
  const prefix = tokenized[0]?.toLowerCase()
  const startIdx = prefix === '/coin' || prefix === 'coin' ? 1 : 0
  const cmd = tokenized[startIdx]?.toLowerCase() ?? 'help'
  const args = tokenized.slice(startIdx + 1)

  logger.info('[coin/command]', { groupId: params.groupId, cmd, role: params.role })

  switch (cmd) {
    case 'help':
      return { ok: true, response: formatCoinHelp() }

    case 'balance':
      return handleBalance({ vault: params.vault })

    case 'info':
      return handleInfo(args[0] ?? '')

    case 'create':
      return handleCreate({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        args,
        vault: params.vault,
      })

    case 'buy':
      return handleBuy({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        args,
        vault: params.vault,
      })

    case 'sell':
      return handleSell({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        args,
        vault: params.vault,
      })

    case 'trend':
      return handleTrend({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        args,
        vault: params.vault,
      })

    default:
      return { ok: false, response: `Unknown coin command: ${cmd}. Try \`/coin help\`.` }
  }
}
