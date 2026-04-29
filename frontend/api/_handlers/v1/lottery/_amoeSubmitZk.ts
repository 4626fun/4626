// SPDX-License-Identifier: MIT
//
// AMOE ZK submit handler — `POST /api/v1/lottery/amoe/submit-zk`.
//
// Replaces the off-chain ECDSA-attestation eligibility artifact (see
// `_amoeSubmit.ts`) with a server-built PLONK proof. The wallet
// signature on the canonical EIP-191 message is still required as the
// off-chain auth + replay artifact (verified via
// `verifyAmoeWalletSignature`); the on-chain artifact is the proof
// + 8 public inputs consumed by `LotteryAmoeRouter.submitAmoeEntryZK`.
//
// Behind a feature flag (`AMOE_ZK_SUBMIT_ENABLED=1`) until PR 5 lands
// the publisher and we cut over.
//
// Trust model + flow chart:
//   docs/security/amoe-pr3-handler-swap-plan.md §4

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
  AMOE_MIN_POINTS_PER_SUBMISSION,
  AMOE_MAX_POINTS_PER_SUBMISSION,
  consumeAmoeCreditsForEntry,
  getAmoeCreditSnapshot,
  parseAmoeEntryMessage,
  verifyAmoeWalletSignature,
} from '../../../../server/_lib/lottery/lotteryAmoe.js'
import {
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeInsufficientCreditsError,
  classifyAmoeError,
} from '../../../../server/_lib/lottery/lotteryAmoeErrors.js'
import { resolveAmoeWallet } from '../../../../server/_lib/lottery/amoeWalletResolver.js'
import { consumeAmoeNonceForSubmit } from '../../../../server/_lib/lottery/amoeNonceStore.js'
import {
  defaultAmoeZkAssetPaths,
  isAmoeZkSubmitEnabled,
  orchestrateAmoeSubmitZk,
  readLotteryAmoeRouterAddress,
} from '../../../../server/_lib/lottery/amoeSubmitZk.js'

declare const process: { env: Record<string, string | undefined> }

type SubmitZkBody = {
  creatorCoin?: string
  message?: string
  signature?: string
  pointsBurned?: number | string
  nonce?: string
  twitterHandle?: string
  spendRefId?: string
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

function isBytes32Like(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function parsePointsBurned(value: unknown): number | null {
  let n: number
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string' && value.trim().length > 0) {
    n = Number(value.trim())
  } else {
    return null
  }
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

function readBaseRpcUrl(): string {
  const firstConfigured = (process.env.BASE_RPC_URL ?? '')
    .split(/[\s,]+/g)
    .map((raw) => raw.trim())
    .find((raw) => raw.length > 0)
  return firstConfigured ?? 'https://mainnet.base.org'
}

// AMOE-relay key isolation — same scope rules as `_amoeSubmit.ts`. See
// `docs/security/amoe-relay-key-scope.md`. We deliberately duplicate
// the readers here (rather than export them from `_amoeSubmit.ts`)
// because mixing handler-local helpers with cross-handler imports has
// historically led to subtle env-fallback regressions.
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

/**
 * Send the relayer transaction to `LotteryAmoeRouter.submitAmoeEntryZK`.
 *
 * Same dual-mode design as the legacy handler: prefer ERC-4337 user-op
 * via Coinbase Smart Wallet when configured; otherwise fall back to a
 * raw EOA signed tx. Lifted in-place rather than extracted to a shared
 * helper because (a) it's identical code-shape but different `to` and
 * (b) the legacy module is on its own deprecation timeline; sharing
 * would couple them.
 */
async function relayAmoeEntryZkTransaction(params: {
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

/**
 * Test seam — handler accepts an injectable orchestration + relay so
 * vitest can run the full pipeline without real snarkjs / RPC.
 *
 * Production callers leave this empty; the handler resolves the
 * defaults. Exported for use by the integration test harness.
 */
export interface AmoeSubmitZkHandlerHooks {
  orchestrate?: typeof orchestrateAmoeSubmitZk
  relay?: typeof relayAmoeEntryZkTransaction
}

let __testHooks: AmoeSubmitZkHandlerHooks = {}

/**
 * Override the handler's orchestrate / relay impls. Vitest only — call
 * `__resetAmoeSubmitZkHandlerHooks()` between tests.
 */
export function __setAmoeSubmitZkHandlerHooksForTest(hooks: AmoeSubmitZkHandlerHooks): void {
  __testHooks = { ...hooks }
}

export function __resetAmoeSubmitZkHandlerHooksForTest(): void {
  __testHooks = {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Feature flag — fail closed. Returns 503 (not 404) so deployment
  // automation can detect "endpoint exists but disabled".
  if (!isAmoeZkSubmitEnabled()) {
    return res.status(503).json({ success: false, error: 'zk_path_disabled' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/amoe/submit-zk', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-amoe-submit-zk', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
  const b = body as SubmitZkBody
  const creatorCoinRaw = typeof b.creatorCoin === 'string' ? b.creatorCoin.trim() : ''
  const message = typeof b.message === 'string' ? b.message : ''
  const signatureRaw = typeof b.signature === 'string' ? b.signature.trim() : ''
  const nonceRaw = typeof b.nonce === 'string' ? b.nonce.trim() : ''
  const twitterHandle = typeof b.twitterHandle === 'string' ? b.twitterHandle.trim() : ''
  const spendRefId = typeof b.spendRefId === 'string' ? b.spendRefId.trim() : ''
  const pointsBurned = parsePointsBurned(b.pointsBurned)

  if (
    !isAddressLike(creatorCoinRaw) ||
    !message ||
    !signatureRaw.startsWith('0x') ||
    !isBytes32Like(nonceRaw)
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid creatorCoin/message/signature/nonce' })
  }
  if (twitterHandle.length === 0 || spendRefId.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing or invalid twitterHandle/spendRefId' })
  }

  if (
    pointsBurned === null ||
    pointsBurned < AMOE_MIN_POINTS_PER_SUBMISSION ||
    pointsBurned > AMOE_MAX_POINTS_PER_SUBMISSION
  ) {
    return res.status(400).json({
      success: false,
      error: `pointsBurned must be an integer in [${AMOE_MIN_POINTS_PER_SUBMISSION}, ${AMOE_MAX_POINTS_PER_SUBMISSION}]`,
    })
  }

  const lotteryAmoeRouter = readLotteryAmoeRouterAddress()
  if (!lotteryAmoeRouter) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  const ip = getClientIp(req as any)
  const rl = await checkDurableRateLimit(rateLimitKey('amoe', 'submit-zk', ip, creatorCoinRaw.toLowerCase()), {
    windowMs: 60_000,
    maxRequests: 6,
  })
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining))
  res.setHeader('X-RateLimit-Reset', String(rl.resetAt))
  if (!rl.allowed) {
    return res.status(429).json({ success: false, error: 'Rate limited' })
  }

  try {
    // ----------------------------------------------------------------
    // 1. Wallet authority — resolve canonical wallet + profileId.
    // ----------------------------------------------------------------
    const walletAuthority = await resolveAmoeWallet({
      requestedWallet: null, // ZK path takes wallet from auth context, not body
      authAddress: g.auth?.address ?? null,
    })
    if (!walletAuthority.ok) {
      throw new AmoeAuthorityError(walletAuthority.error)
    }
    const wallet = walletAuthority.value.wallet
    const profileId = walletAuthority.value.profileId
    if (
      typeof profileId !== 'number' ||
      !Number.isFinite(profileId) ||
      !Number.isSafeInteger(profileId) ||
      profileId <= 0
    ) {
      // No profile resolvable for this auth → can't bind signupIdHash.
      // 403 is more honest than 401: the auth was valid, the profile
      // wasn't.
      //
      // Safe-integer guard: `profiles.id` is a Postgres bigint, but the
      // resolver currently round-trips through JS `number` (see
      // `canonicalWalletResolver.readProfileWalletAuthorityRow` —
      // `Number(row.id)`). For values above 2^53-1 that conversion
      // silently aliases distinct profile rows to the same JS number,
      // which would alias their `signupIdHash` and corrupt nullifier /
      // replay identity. Until the resolver is migrated to bigint /
      // string end-to-end (tracked alongside PR 5's `ApiContracts`
      // hardening), reject unsafe values explicitly here rather than
      // hashing them.
      throw new AmoeAuthorityError('amoe_profile_unresolved')
    }

    // ----------------------------------------------------------------
    // 2. Parse + bind the canonical EIP-191 message BEFORE verifying
    //    the signature.
    //
    //    Codex review (#439) flagged the original "opaque message"
    //    behavior: a leaked/old wallet signature over any string from
    //    the same wallet could be replayed with fresh nonces because
    //    the signature layer didn't bind to (creatorCoin, nonce,
    //    chain, expiry, lotteryManager). We mirror the legacy
    //    `verifyAmoeEntryProof` checks here so the ZK path enforces
    //    the same per-request replay + expiry guarantees as the
    //    ECDSA-attestation path.
    //
    //    The message is bound to the `CreatorLotteryManager` contract
    //    address (NOT `LotteryAmoeRouter`) because clients receive the
    //    message from `_amoeNonce.ts`, which uses
    //    `getApiContracts().lotteryManager`. Cutover to a router-bound
    //    message lives in PR 5 (`ApiContracts` consolidation).
    // ----------------------------------------------------------------
    const parsedMessage = parseAmoeEntryMessage(message)
    if (!parsedMessage) {
      throw new AmoeBadRequestError('invalid_message')
    }
    if (parsedMessage.wallet !== wallet.toLowerCase()) {
      throw new AmoeBadRequestError('wallet_mismatch')
    }
    if (parsedMessage.creatorCoin !== creatorCoinRaw.toLowerCase()) {
      throw new AmoeBadRequestError('creator_mismatch')
    }
    if (parsedMessage.nonce !== nonceRaw.toLowerCase()) {
      throw new AmoeBadRequestError('nonce_mismatch')
    }
    if (parsedMessage.chainId !== 8453) {
      throw new AmoeBadRequestError('invalid_chain')
    }
    const messageLotteryManager = String(
      getApiContracts().lotteryManager ?? '',
    ).toLowerCase()
    if (
      !isAddressLike(messageLotteryManager) ||
      parsedMessage.lotteryManager !== messageLotteryManager
    ) {
      throw new AmoeBadRequestError('lottery_manager_mismatch')
    }
    if (Date.parse(parsedMessage.expiresAt) <= Date.now()) {
      throw new AmoeBadRequestError('message_expired')
    }

    // ----------------------------------------------------------------
    // 3. Verify wallet signature over the canonical EIP-191 message.
    //    Now safe — the message is fully bound above.
    // ----------------------------------------------------------------
    const sigOk = await verifyAmoeWalletSignature({
      wallet,
      message,
      signature: signatureRaw as `0x${string}`,
    })
    if (!sigOk) {
      throw new AmoeBadRequestError('signature_invalid')
    }

    // ----------------------------------------------------------------
    // 4. Consume the nonce atomically. After this point, the same
    //    (wallet, creatorCoin, nonce) tuple cannot reach the witness
    //    layer twice.
    // ----------------------------------------------------------------
    await consumeAmoeNonceForSubmit({
      wallet,
      creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
      nonce: nonceRaw as `0x${string}`,
    })

    // ----------------------------------------------------------------
    // 5. Pre-flight balance gate (matches legacy handler — we relay
    //    first, debit second, but reject under-collateralized entries
    //    BEFORE doing the expensive prove + on-chain work).
    // ----------------------------------------------------------------
    const snapshot = await getAmoeCreditSnapshot({ wallet })
    if (snapshot.credits < pointsBurned) {
      throw new AmoeInsufficientCreditsError()
    }

    // ----------------------------------------------------------------
    // 6. Orchestration — derive nullifiers, build witness, prove,
    //    build calldata.
    // ----------------------------------------------------------------
    const orchestrate = __testHooks.orchestrate ?? orchestrateAmoeSubmitZk
    const relay = __testHooks.relay ?? relayAmoeEntryZkTransaction

    const { wasmPath, zkeyPath } = defaultAmoeZkAssetPaths()

    const result = await orchestrate(
      {
        wallet,
        creatorCoin: creatorCoinRaw.toLowerCase() as `0x${string}`,
        pointsBurned,
        nonce: nonceRaw as `0x${string}`,
        twitterHandle,
        spendRefId,
        profileId: BigInt(profileId),
        lotteryAmoeRouter,
      },
      { wasmPath, zkeyPath },
    )

    // ----------------------------------------------------------------
    // 7. Relay first, debit credits second (same ordering invariant
    //    as the legacy path — see audit §4.2 / `_amoeSubmit.ts:367`).
    // ----------------------------------------------------------------
    const txHash = await relay({
      to: result.call.to,
      callData: result.call.callData,
    })

    // refId binds the credit debit to the proof's nullifier so the
    // ledger can dedupe. PR 4 will tighten this against the replay
    // store; for now the nullifier alone is sufficient.
    const refId = `zk:${nonceRaw}`

    const creditSpend = await consumeAmoeCreditsForEntry({
      wallet,
      requiredCredits: pointsBurned,
      refId,
    })

    return res.status(200).json({
      success: true,
      data: {
        txHash,
        relayMode: 'server',
        pointsBurned,
        pointsBurnedAsUSD: result.pointsBurnedAsUSD.toString(),
        estimatedWinChancePPM: result.call.estimatedWinChancePPM,
        creditsConsumed: creditSpend.consumed,
        creditsRemaining: creditSpend.creditsRemaining,
        creditsPerEntry: creditSpend.creditsPerEntry,
        entriesAvailable: creditSpend.entriesAvailable,
        proofMode: 'plonk',
        epoch: result.epoch.toString(),
      },
    })
  } catch (error: unknown) {
    const { status, message: errMessage } = classifyAmoeError(error)
    // `AmoeProofGenerationError` isn't in the existing classifier — it
    // throws with `code: 'plonk_witness_input_invalid'` /
    // `'plonk_proof_generation_failed'` etc. Map them to 422 here.
    if (
      error instanceof Error &&
      error.name === 'AmoeProofGenerationError' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      return res.status(422).json({
        success: false,
        error: (error as { code: string }).code,
      })
    }
    return res.status(status).json({
      success: false,
      error: errMessage,
    })
  }
}
