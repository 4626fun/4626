import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readJsonBody,
  guardAgentApiRequest,
  getApiContracts,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'



import { checkDurableRateLimit } from '../../../../server/_lib/durableRateLimit.js'

import {
  AMOE_CREDITS_PER_ENTRY,
  consumeAmoeCreditsForEntry,
  createAmoeAttestation,
  verifyAmoeEntryProof,
} from '../../../../server/_lib/lotteryAmoe.js'

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

function readAmoeRelayPrivateKey(): `0x${string}` | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_PRIVATE_KEY,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value as `0x${string}`
  }
  return null
}

function readAmoeRelayOwnerPrivateKey(): `0x${string}` | null {
  const candidates = [
    process.env.LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY,
    process.env.CRE_ERC4337_OWNER_PRIVATE_KEY,
    process.env.KEEPR_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value as `0x${string}`
  }
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
    } = await import('../../../../server/_lib/privyCoinbaseSmartWallet.js')
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
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const body = (await readJsonBody(req, { maxBytes: 16_384 })) ?? {}
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

    const attested = await createAmoeAttestation({
      wallet: proof.wallet,
      creatorCoin: proof.creatorCoin,
      nonce: proof.nonce,
      expiresAt: proof.expiresAt,
      lotteryManager: String(lotteryManager).toLowerCase() as `0x${string}`,
    })

    if (relayRequested) {
      const creditSpend = await consumeAmoeCreditsForEntry({
        wallet: proof.wallet,
        requiredCredits: AMOE_CREDITS_PER_ENTRY,
        refId: `${proof.creatorCoin}:${proof.nonce}`,
      })
      const txHash = await relayAmoeEntryTransaction({
        to: attested.to,
        callData: attested.callData,
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
    const messageText = error instanceof Error ? error.message : 'amoe_submit_failed'
    const status = messageText.includes('insufficient')
      ? 402
      : messageText.includes('invalid') || messageText.includes('mismatch') || messageText.includes('expired')
        ? 400
        : 500
    return res.status(status).json({
      success: false,
      error: messageText,
    })
  }
}
