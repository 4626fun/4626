import type { Address } from 'viem'
import { isAddress, getAddress, parseEther, parseUnits, hashTypedData, formatEther, formatUnits, createPublicClient, http, parseAbi } from 'viem'
import { base } from 'viem/chains'

import { logger } from '../_lib/infra/logger.js'
import { BASE_CAIP2, walletRpc, secp256k1SignHash } from '../_lib/wallet/privyWalletApi.js'
import {
  buildInsufficientFundsRefusal,
  checkWalletBalancePreflight,
  getBasePreflightPublicClient,
  isInsufficientFundsError,
} from '../_lib/wallet/walletBalancePreflight.js'
import {
  // Canonical import — implementation lives in @4626/server-core
  resolveCommandIssuerContextByAddress,
  isExecutionReady,
} from '@4626/server-core'
import {
  isArchBCoinBuyViaUserOpEnabled,
  isArchBCoinSellViaUserOpEnabled,
  isArchBTrendReserveViaUserOpEnabled,
  submitUserOpOrRefuse,
} from '../_lib/wallet/userOperationSubmitter.js'
import { checkRouterTarget } from './routerAllowlist.js'
import type { CoinbaseSmartWalletCall } from '../_lib/wallet/privyCoinbaseSmartWallet.js'
import { assertTeeAttestationOrThrow } from '../_lib/agent/teeAttestationGate.js'
import { readCswReplaySafeHash, wrapCswOwnerSignature } from '../_lib/wallet/cswOwnerSignature.js'
import type { KeeprVaultRow } from '../_lib/keepr/keeprRegistry.js'
import type { KeeprRole, KeeprCommandResult } from '../commands/types.js'
import { readCanonicalCswAddressEnv } from '../_lib/wallet/canonicalCswEnv.js'

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
 * Falls back to `CANONICAL_CSW_ADDRESS` if not set.
 */
function getPlatformReferrerAddress(): Address | undefined {
  const explicit = (process.env.ZORA_PLATFORM_REFERRER_ADDRESS ?? '').trim()
  if (explicit && isAddress(explicit)) return getAddress(explicit) as Address

  // Fallback: use the canonical CSW address
  const csw = readCanonicalCswAddressEnv()
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
// /coin buy
// ---------------------------------------------------------------------------

async function handleBuy(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  if (isArchBCoinBuyViaUserOpEnabled()) {
    return handleBuyViaArchB(params)
  }

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
// /coin buy — Architecture B path (ARCH_B_COIN_BUY_VIA_USEROP)
// ---------------------------------------------------------------------------

/**
 * Route `/coin buy` through the command issuer's Coinbase Smart Wallet using
 * the same UserOperation + paymaster choke point (submitUserOpOrRefuse) that
 * Phase 2 built for /keepr send.
 *
 * Key differences from the legacy agent-wallet path:
 * - `sender` in getTradeQuoteWithReferrer is the CSW (not an agent EOA).
 *   Minted coins flow to the CSW.
 * - No preflightAgentWalletOrRefuse — submitUserOpOrRefuse handles CSW
 *   balance preflight internally.
 * - No idempotency key — UserOp nonce on the CSW prevents double-execution.
 * - Router target validated via checkRouterTarget before building calls.
 */
async function handleBuyViaArchB(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // 1. Parse + validate (same as handleBuy).
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

  // 2. Resolve execution context. Hard-fail if not ready.
  //    No silent fallback to the legacy agent-wallet path.
  const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
  if (!isExecutionReady(resolution)) {
    logger.warn('[coin/buy/arch-b] issuer not execution-ready; refusing', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      status: resolution.status,
    })
    if (resolution.status === 'db_unavailable') {
      return {
        ok: false,
        response:
          "This trade can't be executed right now — account readiness storage is temporarily unavailable. Please try again shortly.",
      }
    }
    if (resolution.status === 'revoked') {
      return {
        ok: false,
        response:
          "This trade can't be executed — your execution context has been revoked. Contact setup to restore access.",
      }
    }
    return {
      ok: false,
      response:
        "This trade can't be executed — your account isn't provisioned for onchain execution yet. Contact setup to finish provisioning.",
    }
  }
  const issuer = resolution.context

  // 3. TEE attestation gate. Distinct action name from /keepr send.
  try {
    await assertTeeAttestationOrThrow({
      action: 'zora.coin.buy',
      actorAddress: params.senderWallet,
      metadata: {
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        coinAddress,
        archBPhase: 3,
      },
    })
  } catch (err) {
    logger.warn('[coin/buy/arch-b] TEE attestation gate denied buy', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response:
        'Coin buy denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  // 4. Get Zora quote with sender = issuer.smartWallet (the CSW itself).
  //    This is the key semantic change: Zora sees the CSW as the buyer,
  //    so minted coins flow to the CSW, not an agent wallet.
  const amountIn = parseEther(ethAmount)
  const quote = await getTradeQuoteWithReferrer({
    tokenIn: { type: 'eth' },
    tokenOut: { type: 'erc20', address: getAddress(coinAddress) },
    amountIn: amountIn.toString(),
    slippage: 0.03, // 3% slippage
    sender: issuer.smartWallet, // CSW — coins flow here, not to an agent wallet
    referrer: getPlatformReferrerAddress(),
  })

  const call = quote?.call
  if (!call?.target || !call?.data) {
    return { ok: false, response: 'Failed to get trade quote. The coin may not have liquidity.' }
  }

  // 5. Validate the router target before building the UserOp.
  //    Zora Quote API is non-authoritative external data — a compromised
  //    response could direct the CSW to call any contract.
  const routerCheck = checkRouterTarget(call.target as Address)
  if (!routerCheck.allowed) {
    logger.warn('[coin/buy/arch-b] router target blocked by allowlist', {
      groupId: params.groupId,
      target: call.target,
      reason: routerCheck.reason,
    })
    return {
      ok: false,
      response:
        "Coin buy blocked: the trade router address returned by the quote service isn't on the approved list. Please try again or contact support.",
    }
  }

  // 6. Validate quote.call.value against the user-parsed amountIn.
  //    Zora's quote is non-authoritative external data. For an ETH-in buy,
  //    call.value is the exact ETH the CSW forwards to the router — it MUST
  //    equal the user-typed amount. A mismatch means a compromised or
  //    malformed quote is trying to make us spend more (or less) than the
  //    user requested. Refuse before submitting the UserOp.
  const nativeValueWei = call.value ? BigInt(call.value) : 0n
  if (nativeValueWei !== amountIn) {
    logger.warn('[coin/buy/arch-b] quote value mismatch', {
      groupId: params.groupId,
      userAmountWei: amountIn.toString(),
      quoteValueWei: nativeValueWei.toString(),
      target: call.target,
    })
    return {
      ok: false,
      response:
        "Coin buy blocked: the trade quote's ETH amount doesn't match the amount you requested. Please try again.",
    }
  }

  // 7. Build a single-item calls array for the UserOp.
  const calls: CoinbaseSmartWalletCall[] = [
    { to: call.target as Address, value: nativeValueWei, data: call.data as `0x${string}` },
  ]

  // 8. Submit via the shared choke point.
  //    Caps + preflight + daily ledger all handled inside submitUserOpOrRefuse
  //    exactly as /keepr send. UserOp nonce handles idempotency.
  const submission = await submitUserOpOrRefuse({
    issuer,
    calls,
    valueWei: nativeValueWei,
    correlationId: `coin/buy/arch-b:${params.groupId}`,
  })
  if (!submission.ok) return { ok: false, response: submission.response }

  logger.info('[coin/buy/arch-b] coin purchased via UserOp', {
    groupId: params.groupId,
    profileId: issuer.profileId,
    coinAddress,
    ethAmount,
    smartWallet: submission.smartWallet,
    txHash: submission.txHash,
    userOpHash: submission.userOpHash,
  })

  recordExecution(params.groupId)
  return {
    ok: true,
    response: [
      'Coin purchased',
      '',
      `- Coin: ${coinAddress}`,
      `- Spent: ${ethAmount} ETH`,
      `- Slippage: 3%`,
      `- Tx: https://basescan.org/tx/${submission.txHash}`,
      `- Buyer: ${submission.smartWallet} (your smart wallet)`,
    ].join('\n'),
    action: {
      action: 'zora.coin.bought',
      coinAddress,
      ethAmount,
      txHash: submission.txHash,
      userOpHash: submission.userOpHash,
      buyer: submission.smartWallet,
      groupId: params.groupId,
      routing: 'arch-b-userop',
    },
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
// /coin sell — Architecture B path (ARCH_B_COIN_SELL_VIA_USEROP)
// ---------------------------------------------------------------------------

/**
 * Route `/coin sell` through the command issuer's Coinbase Smart Wallet using
 * the same UserOperation + paymaster choke point (submitUserOpOrRefuse) that
 * Phase 2 built for /keepr send.
 *
 * Key differences from the legacy agent-wallet path:
 * - `sender` in getTradeQuoteWithReferrer is the CSW (not an agent EOA).
 *   ETH from the sell flows to the CSW.
 * - Permit2 typed-data is signed by the CSW's owner EOA via Privy
 *   `secp256k1_sign`, then wrapped with wrapCswOwnerSignature into the
 *   ERC-1271 contract-signature envelope that Permit2 accepts.
 * - No preflightAgentWalletOrRefuse — submitUserOpOrRefuse handles preflight
 *   internally.
 * - Router target validated via checkRouterTarget before building calls
 *   (both on the initial quote and on the re-quote after permits are
 *   signed). Also asserts the target does not change across the two calls.
 */
async function handleSellViaArchB(params: {
  groupId: string
  senderWallet: Address
  args: string[]
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // 1. Parse + validate (same as handleSell).
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

  // Validate shape only here. Numeric parsing happens below once we know
  // the token decimals — we use parseUnits (exact integer arithmetic) instead
  // of Number math to avoid IEEE-754 precision loss on 18-decimal tokens or
  // values above 2^53.
  const amountStr = String(amount).trim()
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountStr) || amountStr === '0' || amountStr === '0.0') {
    return { ok: false, response: 'Invalid amount. Must be a positive number.' }
  }

  // 2. Resolve execution context. Hard-fail if not ready.
  //    No silent fallback to the legacy agent-wallet path.
  const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
  if (!isExecutionReady(resolution)) {
    logger.warn('[coin/sell/arch-b] issuer not execution-ready; refusing', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      status: resolution.status,
    })
    if (resolution.status === 'db_unavailable') {
      return {
        ok: false,
        response:
          "This trade can't be executed right now — account readiness storage is temporarily unavailable. Please try again shortly.",
      }
    }
    if (resolution.status === 'revoked') {
      return {
        ok: false,
        response:
          "This trade can't be executed — your execution context has been revoked. Contact setup to restore access.",
      }
    }
    return {
      ok: false,
      response:
        "This trade can't be executed — your account isn't provisioned for onchain execution yet. Contact setup to finish provisioning.",
    }
  }
  const issuer = resolution.context

  // 3. TEE attestation gate. Distinct action name from /keepr send and /coin buy.
  try {
    await assertTeeAttestationOrThrow({
      action: 'zora.coin.sell',
      actorAddress: params.senderWallet,
      metadata: {
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        coinAddress,
        archBPhase: 3,
      },
    })
  } catch (err) {
    logger.warn('[coin/sell/arch-b] TEE attestation gate denied sell', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response:
        'Coin sell denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  // 4. Read coin decimals to parse the sell amount correctly.
  const client = getPublicClient()
  let decimals = 18
  try {
    decimals = await client.readContract({
      address: getAddress(coinAddress) as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: 'decimals',
    })
  } catch {
    // Default to 18 if decimals() call fails.
  }

  // Parse with exact arithmetic (Codex #297 P1). Enforce fractional precision
  // ourselves before parseUnits so behavior stays strict across viem versions.
  const fractionalPart = amountStr.split('.')[1]
  if (fractionalPart && fractionalPart.length > decimals) {
    return {
      ok: false,
      response: `Invalid amount. ${amountStr} has too many decimal places for this token (max ${decimals}).`,
    }
  }

  // parseUnits returns a bigint in base units with no precision loss for
  // inputs that fit the token's decimal precision.
  let amountIn: bigint
  try {
    amountIn = parseUnits(amountStr as `${number}`, decimals)
  } catch (err) {
    return {
      ok: false,
      response: `Invalid amount. ${amountStr} has too many decimal places for this token (max ${decimals}).`,
    }
  }
  if (amountIn <= 0n) {
    return { ok: false, response: 'Invalid amount. Must be a positive number.' }
  }

  // Sanity cap in bigint space: reject absurdly large token amounts.
  // 1e12 tokens * 10^decimals is the upper bound in base units.
  const maxBaseUnits = 10n ** 12n * 10n ** BigInt(decimals)
  if (amountIn > maxBaseUnits) {
    return { ok: false, response: 'Invalid amount. Token amount exceeds the maximum allowed (1e12).' }
  }

  const tradeReferrer = getPlatformReferrerAddress()

  // 5. Trade flow. Wrapped in try/catch (Codex #297 P2) so that upstream
  //    failures (Zora quote/re-quote network errors, Privy signing errors)
  //    return an explicit sell-specific typed refusal instead of bubbling to
  //    the global executor as a generic upstream error.
  let quote: any
  try {
    quote = await getTradeQuoteWithReferrer({
      tokenIn: { type: 'erc20', address: getAddress(coinAddress) },
      tokenOut: { type: 'eth' },
      amountIn: amountIn.toString(),
      slippage: 0.03,
      sender: issuer.smartWallet, // CSW — ETH flows here, not to an agent wallet
      referrer: tradeReferrer,
    })
  } catch (err) {
    logger.warn('[coin/sell/arch-b] Zora quote call threw', {
      groupId: params.groupId,
      coinAddress,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response:
        'Sell failed: unable to fetch a quote for this coin right now. The coin may lack liquidity or the quote service is degraded. Please try again shortly.',
    }
  }

  const initialCall = quote?.call
  if (!initialCall?.target || !initialCall?.data) {
    return { ok: false, response: 'Failed to get sell quote. The coin may not have liquidity.' }
  }

  // 5b. Validate the router target on the INITIAL quote before we commit to
  //     signing any Permit2 authorization for it. Zora's Quote API is
  //     non-authoritative external data — a compromised or malformed quote
  //     could direct the CSW to call any contract. For a sell, the permit
  //     we're about to sign authorizes Permit2 to move the user's tokens;
  //     we must know the router it ends up calling is on our allowlist
  //     BEFORE we produce that signature.
  const initialRouterCheck = checkRouterTarget(initialCall.target as Address)
  if (!initialRouterCheck.allowed) {
    logger.warn('[coin/sell/arch-b] initial-quote router target blocked by allowlist', {
      groupId: params.groupId,
      target: initialCall.target,
      reason: initialRouterCheck.reason,
    })
    return {
      ok: false,
      response:
        "Coin sell blocked: the trade router address returned by the quote service isn't on the approved list. Please try again or contact support.",
    }
  }

  // 6. Handle Permit2 permits if the quote includes unsigned ones.
  //    The CSW cannot produce a standard ECDSA signature; instead, the CSW's
  //    owner EOA signs the Permit2 typed-data digest via Privy secp256k1_sign,
  //    and we wrap it in the ERC-1271 SignatureWrapper format.
  const permits = quote?.permits as any[] | undefined
  let finalCall = initialCall

  if (permits && permits.length > 0) {
    const signedPermits: any[] = []
    for (let i = 0; i < permits.length; i++) {
      const permit = permits[i]
      if (!permit.signature || permit.signature === '0x') {
        // Compute the Permit2 typed-data digest off-chain using the same
        // domain/types as the legacy handleSell path.
        const typedDataDigest = hashTypedData({
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
          message: permit.permit as any,
        })

        // CSW isValidSignature applies replaySafeHash(permitDigest) before ecrecover.
        let replaySafeDigest: `0x${string}`
        try {
          replaySafeDigest = await readCswReplaySafeHash({
            publicClient: client,
            smartWallet: issuer.smartWallet,
            innerHash: typedDataDigest,
          })
        } catch (err) {
          logger.warn('[coin/sell/arch-b] replaySafeHash read failed', {
            groupId: params.groupId,
            error: err instanceof Error ? err.message : String(err),
          })
          return {
            ok: false,
            response:
              'Sell failed: could not prepare Permit2 signing for the smart wallet. Please try again shortly.',
          }
        }

        let ownerSig: `0x${string}`
        try {
          ownerSig = await secp256k1SignHash({
            walletId: issuer.privyOwnerWalletId,
            hash: replaySafeDigest,
            idempotencyKey: `coin-sell-permit:${params.groupId}:${Date.now()}:${i}`,
          })
        } catch (err) {
          logger.warn('[coin/sell/arch-b] Privy secp256k1_sign threw', {
            groupId: params.groupId,
            coinAddress,
            permitIndex: i,
            error: err instanceof Error ? err.message : String(err),
          })
          return {
            ok: false,
            response:
              'Sell failed: could not sign the Permit2 authorization via the delegated signer. Please try again shortly.',
          }
        }

        // Wrap into ERC-1271 SignatureWrapper so Permit2's isValidSignature
        // call on the CSW will accept it.
        const wrappedSig = wrapCswOwnerSignature(ownerSig, issuer.ownerIndex)
        signedPermits.push({ signature: wrappedSig, permit: permit.permit })
      } else {
        signedPermits.push(permit)
      }
    }

    // 7. Re-quote with signed permits to get calldata that includes the authorization.
    try {
      const reQuote = await getTradeQuoteWithReferrer({
        tokenIn: { type: 'erc20', address: getAddress(coinAddress) },
        tokenOut: { type: 'eth' },
        amountIn: amountIn.toString(),
        slippage: 0.03,
        sender: issuer.smartWallet,
        referrer: tradeReferrer,
        signatures: signedPermits,
      })
      if (!reQuote?.call?.target || !reQuote?.call?.data) {
        return {
          ok: false,
          response: 'Sell failed: re-quote returned no executable calldata. Please try again.',
        }
      }

      // 7a. Validate the re-quote's router target against the allowlist,
      //     and assert it is the SAME target as the initial quote. Signing
      //     the Permit2 authorization for router A and then executing
      //     against router B would let a compromised re-quote redirect the
      //     user's approved token movement to an unapproved contract.
      const reQuoteRouterCheck = checkRouterTarget(reQuote.call.target as Address)
      if (!reQuoteRouterCheck.allowed) {
        logger.warn('[coin/sell/arch-b] re-quote router target blocked by allowlist', {
          groupId: params.groupId,
          target: reQuote.call.target,
          reason: reQuoteRouterCheck.reason,
        })
        return {
          ok: false,
          response:
            "Coin sell blocked: the trade router address returned after signing the permit isn't on the approved list. Please try again or contact support.",
        }
      }
      const initialTargetLower = String(initialCall.target).toLowerCase()
      const reQuoteTargetLower = String(reQuote.call.target).toLowerCase()
      if (initialTargetLower !== reQuoteTargetLower) {
        logger.warn('[coin/sell/arch-b] router target changed between initial quote and re-quote', {
          groupId: params.groupId,
          initialTarget: initialCall.target,
          reQuoteTarget: reQuote.call.target,
        })
        return {
          ok: false,
          response:
            'Coin sell blocked: the trade router address changed after signing the permit. Please try again.',
        }
      }

      finalCall = reQuote.call
    } catch (err) {
      logger.warn('[coin/sell/arch-b] Zora re-quote call threw', {
        groupId: params.groupId,
        coinAddress,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        ok: false,
        response:
          'Sell failed: unable to finalize the quote after signing the permit. Please try again shortly.',
      }
    }
  }

  // 8. Build a single-item calls array for the UserOp.
  //    Sells typically have value=0 (ETH flows out from the router to the
  //    CSW via the quote calldata, not as a native value parameter).
  const nativeValueWei = finalCall.value ? BigInt(finalCall.value) : 0n
  const calls: CoinbaseSmartWalletCall[] = [
    { to: finalCall.target as Address, value: nativeValueWei, data: finalCall.data as `0x${string}` },
  ]

  // 9. Submit via the shared choke point.
  //    Caps + preflight + daily ledger all handled inside submitUserOpOrRefuse.
  const submission = await submitUserOpOrRefuse({
    issuer,
    calls,
    valueWei: nativeValueWei,
    correlationId: `coin/sell/arch-b:${params.groupId}`,
  })
  if (!submission.ok) return { ok: false, response: submission.response }

  logger.info('[coin/sell/arch-b] coin sold via UserOp', {
    groupId: params.groupId,
    profileId: issuer.profileId,
    coinAddress,
    amount,
    smartWallet: submission.smartWallet,
    txHash: submission.txHash,
    userOpHash: submission.userOpHash,
    hadPermits: (permits?.length ?? 0) > 0,
  })

  recordExecution(params.groupId)
  return {
    ok: true,
    response: [
      'Coin sold',
      '',
      `- Coin: ${coinAddress}`,
      `- Amount: ${amount} tokens`,
      `- Slippage: 3%`,
      `- Tx: https://basescan.org/tx/${submission.txHash}`,
      `- Seller: ${submission.smartWallet} (your smart wallet)`,
    ].join('\n'),
    action: {
      action: 'zora.coin.sold',
      coinAddress,
      amount,
      txHash: submission.txHash,
      userOpHash: submission.userOpHash,
      seller: submission.smartWallet,
      groupId: params.groupId,
      routing: 'arch-b-userop',
    },
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
    const { preflightTrendTicker, reserveTrendTicker, reserveTrendTickerViaUserOp } = await import('./trends.js')
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

      // Arch B Phase 4: route the TrendCoin deploy through the command
      // issuer's CSW via submitUserOpOrRefuse. Hard-fail if the issuer is
      // not execution-ready — no silent fallback to the legacy agent-EOA
      // path.
      if (isArchBTrendReserveViaUserOpEnabled()) {
        const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
        if (!isExecutionReady(resolution)) {
          logger.warn('[coin/trend/reserve/arch-b] issuer not execution-ready; refusing', {
            groupId: params.groupId,
            senderWallet: params.senderWallet,
            status: resolution.status,
          })
          await markTrendOpFailed({
            tickerHash: preflight.tickerHash,
            lastError: `issuer_not_execution_ready:${resolution.status}`,
          })
          if (resolution.status === 'db_unavailable') {
            return {
              ok: false,
              response:
                "This trend reserve can't be executed right now — account readiness storage is temporarily unavailable. Please try again shortly.",
            }
          }
          if (resolution.status === 'revoked') {
            return {
              ok: false,
              response:
                "This trend reserve can't be executed — your execution context has been revoked. Contact setup to restore access.",
            }
          }
          return {
            ok: false,
            response:
              "This trend reserve can't be executed — your account isn't provisioned for onchain execution yet. Contact setup to finish provisioning.",
          }
        }
        const issuer = resolution.context

        let reservation: Awaited<ReturnType<typeof reserveTrendTickerViaUserOp>>
        try {
          reservation = await reserveTrendTickerViaUserOp({
            ticker: preflight.ticker,
            issuer,
            groupId: params.groupId,
            waitForReceipt: true,
          })
        } catch (error: any) {
          await markTrendOpFailed({
            tickerHash: preflight.tickerHash,
            lastError: String(error?.message ?? 'reserve_failed'),
          })
          throw error
        }

        if (!reservation.ok) {
          await markTrendOpFailed({
            tickerHash: preflight.tickerHash,
            lastError: `arch_b_${reservation.code}`,
          })
          return { ok: false, response: reservation.response }
        }

        if (reservation.status === 'deployed' || reservation.status === 'already_deployed') {
          await markTrendOpDeployed({
            tickerHash: preflight.tickerHash,
            deployedCoinAddress: reservation.deployedAddress,
            txHash: reservation.txHash ?? undefined,
            actorWallet: reservation.walletAddress ?? undefined,
          })
        } else {
          await markTrendOpDeploying({
            tickerHash: preflight.tickerHash,
            txHash: reservation.txHash ?? undefined,
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
            `- Deployer: ${reservation.smartWallet} (CSW)`,
            `- UserOp: ${reservation.userOpHash}`,
          ].join('\n'),
          action: {
            action: 'zora.trend.reserve',
            ticker: reservation.ticker,
            tickerHash: reservation.tickerHash,
            coinAddress: reservation.deployedAddress,
            txHash: reservation.txHash,
            status: reservation.status,
            groupId: params.groupId,
            routing: 'arch-b-userop',
            smartWallet: reservation.smartWallet,
            userOpHash: reservation.userOpHash,
          },
        }
      }

      // Legacy path: Privy-managed agent EOA.
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

    case 'buy':
      return handleBuy({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        args,
        vault: params.vault,
      })

    case 'sell':
      if (isArchBCoinSellViaUserOpEnabled()) {
        return handleSellViaArchB({ groupId: params.groupId, senderWallet: params.senderWallet, args, vault: params.vault })
      }
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
