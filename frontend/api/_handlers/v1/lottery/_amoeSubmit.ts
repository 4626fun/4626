import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getApiContracts,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'



import { checkDurableRateLimit } from '../../../../server/_lib/infra/durableRateLimit.js'

import {
  AMOE_CREDITS_PER_ENTRY,
  consumeAmoeCreditsForEntry,
  createAmoeAttestation,
  verifyAmoeEntryProof,
} from '../../../../server/_lib/lottery/lotteryAmoe.js'
import {
  AmoeAuthorityError,
  classifyAmoeError,
} from '../../../../server/_lib/lottery/lotteryAmoeErrors.js'
import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'

type SubmitBody = {
  creatorCoin?: string
  message?: string
  signature?: string
  relay?: boolean
}

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseRelayFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

function readBaseRpcUrl(): string {
  const firstConfigured = (process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map((raw) => raw.trim())
    .find((raw) => raw.length > 0)
  return firstConfigured ?? 'https://mainnet.base.org'
}

// AMOE relay key isolation — see audit/security note in `docs/security/amoe-relay-key-scope.md`.
//
// Previously these readers fell through to `KEEPR_PRIVATE_KEY` and even the
// generic `PRIVATE_KEY` env var. That coupling is dangerous: any deployment
// that provisions a single global `PRIVATE_KEY` (which is the template called
// out as a leak risk in `docs/operations/red-ci-tracking.md`) would silently
// promote that key into the AMOE-relay role, giving the AMOE submit path
// authority that was never explicitly granted to it. AMOE-relay must be its
// own scoped key — fail closed if the dedicated env vars are not set.
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

async function relayAmoeEntryTransaction(params: {
  to: `0x${string}`
  callData: `0x${string}`
}): Promise<`0x${string}`> {
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
    } = await import('../../../../server/_lib/wallet/privyCoinbaseSmartWallet.js')
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
  const hash = await wallet.sendTransaction({ chain: base, to: params.to, data: params.callData, value: 0n })
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 })
  if (receipt.status !== 'success') throw new Error('amoe_relay_tx_failed')
  return hash
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/submit', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-submit', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const creatorCoinRaw = typeof body.creatorCoin === 'string' ? body.creatorCoin.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const signatureRaw = typeof body.signature === 'string' ? body.signature.trim() : ''
  const relayRequested = parseRelayFlag(body.relay)

  if (!isAddressLike(creatorCoinRaw) || !message || !signatureRaw.startsWith('0x')) {
    return res.status(400).json({ success: false, error: 'Missing or invalid creatorCoin/message/signature' })
  }

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!isAddressLike(String(lotteryManager ?? ''))) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'submit', ip, creatorCoinRaw.toLowerCase()), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    const proof = await verifyAmoeEntryProof({
      creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
      message,
      signature: signatureRaw as `0x${string}`,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    // Re-verify wallet authority against the auth context.
    //
    // The signature inside `verifyAmoeEntryProof` cryptographically binds
    // the proof to a wallet, but for EIP-1271 / smart-wallet signatures
    // the wallet's owner set can change between sessions: a wallet whose
    // owner key was rotated yesterday still produces a valid `isValidSignature`
    // today. The nonce / credits handlers always re-resolve through
    // `resolveAmoeWallet` so the auth identity must currently authorise the
    // wallet; previously, submit skipped that check and trusted the on-chain
    // signature alone. We now mirror nonce / credits / twitter-checkin
    // semantics so a stale auth session cannot piggy-back a freshly
    // re-owned wallet.
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: proof.wallet,
      authAddress: g.auth?.address ?? null,
    })
    if (!walletAuthority.ok) {
      throw new AmoeAuthorityError(walletAuthority.error)
    }

    const attested = await createAmoeAttestation({
      wallet: proof.wallet,
      creatorCoin: proof.creatorCoin,
      nonce: proof.nonce,
      expiresAt: proof.expiresAt,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    // Lottery entries intentionally do NOT award waitlist points — users
    // grow their waitlist score via the daily social share (check-in),
    // which is the base action that later unlocks lottery entries. The
    // credit-ledger writes below stay the source of truth for entry
    // economics; waitlist score is decoupled.

    if (relayRequested) {
      // Relay first, debit second. Previously credits were consumed BEFORE
      // the on-chain submission, which meant any contract-side revert
      // (e.g. the new `DeadlineTooSoon` floor from audit §4.2) silently
      // burned user credits. Issuer mirrors the 60s floor so we shouldn't
      // hit that revert in practice, but ordering is the durable fix.
      const txHash = await relayAmoeEntryTransaction({
        to: attested.to,
        callData: attested.callData,
      })
      const creditSpend = await consumeAmoeCreditsForEntry({
        wallet: proof.wallet,
        requiredCredits: AMOE_CREDITS_PER_ENTRY,
        refId: `${proof.creatorCoin}:${proof.nonce}`,
      })

      return res.status(200).json({
        success: true,
        data: {
          txHash,
          relayMode: 'server',
          creditsConsumed: creditSpend.consumed,
          creditsRemaining: creditSpend.creditsRemaining,
          creditsPerEntry: creditSpend.creditsPerEntry,
          entriesAvailable: creditSpend.entriesAvailable,
        },
      })
    }

    const creditSpend = await consumeAmoeCreditsForEntry({
      wallet: proof.wallet,
      requiredCredits: AMOE_CREDITS_PER_ENTRY,
      refId: `${proof.creatorCoin}:${proof.nonce}`,
    })

    return res.status(200).json({
      success: true,
      data: {
        ...attested,
        relayMode: 'client',
        creditsConsumed: creditSpend.consumed,
        creditsRemaining: creditSpend.creditsRemaining,
        creditsPerEntry: creditSpend.creditsPerEntry,
        entriesAvailable: creditSpend.entriesAvailable,
      },
    })
  } catch (error: unknown) {
    // Pivots on `instanceof Amoe*Error` first; falls back to legacy substring
    // classification for any not-yet-migrated thrower. See
    // `frontend/server/_lib/lottery/lotteryAmoeErrors.ts`.
    const { status, message } = classifyAmoeError(error)
    return res.status(status).json({
      success: false,
      error: message,
    })
  }
}
