/**
 * POST /api/v1/creators/quickstart
 *
 * One-shot creator onboarding endpoint. Given an authenticated session:
 *
 * 1. Resolves the user's Zora profile + creator coin
 * 2. Verifies pre-approved vault allowlist access (admin-managed allowlist only)
 * 3. Provisions a Privy server wallet (for CSW agent signing)
 * 4. Registers a CSW-based XMTP agent
 * 5. Creates a default Keepr vault config (if coin found)
 *
 * Returns everything the frontend needs to show a confirmation modal
 * with a single remaining action: the addOwnerAddress UserOp.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
  logger,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  enableCswAgent,
  getOrCreateCreatorXmtpAgent,
} from '../../../../packages/server-core/src/index.js'


import { resolvePersistedWalletIdentity } from '../../../../server/_lib/wallet/canonicalWalletResolver.js'

import { getOrCreateCreatorAgentWallet } from '../../../../server/_lib/wallet/creatorAgentWallets.js'
import { resolveCoinParties, isAddressLike } from '../../../../server/_lib/onchain/coinParties.js'


declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuickstartResult = {
  // Identity
  creatorAddress: string
  zoraProfile: { displayName: string | null; handle: string | null } | null

  // Creator coin (auto-detected)
  coinAddress: string | null
  coinName: string | null
  coinSymbol: string | null

  // Agent
  agentType: 'csw' | 'eoa'
  agentAddress: string
  serverSignerAddress: string | null
  serverSignerWalletId: string | null
  ownerAdded: boolean // Whether the signer is already an owner of the CSW

  // Vault config
  vaultConfigCreated: boolean

  // Access
  allowlisted: boolean

  // Canonical Ajna automation
  canonicalAjnaAutomation: {
    available: boolean
    cswAddress: string | null
    embeddedEoaAddress: string | null
  }

  // What the user still needs to do
  pendingActions: string[]
}

type QuickstartRequestBody = {
  enableAutomation?: boolean
}

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveZoraProfile(address: string): Promise<{
  displayName: string | null
  handle: string | null
  coins: Array<{ address: string; name: string; symbol: string }>
} | null> {
  try {
    const key = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
    if (!key) return null

    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    // Fetch profile
    const profileRes = await sdk.getProfile({ identifier: address })
    const profile = (profileRes as any)?.data?.profile ?? null

    // Fetch coins created by this address
    const coinsRes = await sdk.getProfileCoins({
      identifier: address,
      count: 10,
      chainIds: [8453], // Base only
    })

    const coinsData = (coinsRes as any)?.data?.profile?.coinBalances?.edges ?? []
    const coins: Array<{ address: string; name: string; symbol: string }> = []

    for (const edge of coinsData) {
      const node = edge?.node?.coin
      if (!node?.address) continue
      coins.push({
        address: String(node.address).toLowerCase(),
        name: node.name ?? '',
        symbol: node.symbol ?? '',
      })
    }

    return {
      displayName: profile?.displayName ?? profile?.username ?? null,
      handle: profile?.username ?? null,
      coins,
    }
  } catch (err) {
    logger.warn('[quickstart] Zora profile fetch failed', err)
    return null
  }
}

async function checkIsOwner(cswAddress: string, signerAddress: string): Promise<boolean> {
  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })

    const result = await client.readContract({
      address: cswAddress as `0x${string}`,
      abi: [
        {
          type: 'function',
          name: 'isOwnerAddress',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'bool' }],
        },
      ] as const,
      functionName: 'isOwnerAddress',
      args: [signerAddress as `0x${string}`],
    })
    return Boolean(result)
  } catch {
    return false
  }
}

async function hasApprovedCreatorAccess(db: any, creatorAddress: string): Promise<boolean> {
  try {
    const addr = creatorAddress.toLowerCase()
    // Quickstart is strictly read-only for vault allowlist access.
    // Approval writes are admin-only via /api/admin/creator-access/approve.
    const existing = await db.sql`
      SELECT address
      FROM allowlist
      WHERE (lower(address) = ${addr} OR lower(csw_address) = ${addr})
        AND revoked_at IS NULL
        AND approved_at IS NOT NULL
      LIMIT 1;
    `
    return (existing.rows?.length ?? 0) > 0
  } catch (err) {
    logger.warn('[quickstart] Creator access check failed', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) ?? {}
  const enableAutomation = body.enableAutomation === true

  // Require authenticated session or SIWA
  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress || !isAddressLike(principalAddress)) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required (session or SIWA receipt)',
    } satisfies ApiEnvelope<never>)
  }

  const quickstartRate = checkRateLimit(
    rateLimitKey('v1-creators-quickstart', principalAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!quickstartRate.allowed) {
    setRetryAfterHeader(res, quickstartRate.resetAt)
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
    } satisfies ApiEnvelope<never>)
  }

  const principal = await resolveAuthorizedRequestPrincipal(req)
  if (!principal?.canonicalSmartWalletAddress || !isAddressLike(principal.canonicalSmartWalletAddress)) {
    return res.status(403).json({
      success: false,
      error: 'Current session is not authorized for a canonical creator smart wallet',
    } satisfies ApiEnvelope<never>)
  }
  const creatorAddress = principal.canonicalSmartWalletAddress

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database connection failed' } satisfies ApiEnvelope<never>)
  }

  const pendingActions: string[] = []

  try {
    // ------------------------------------------------------------------
    // 1. Resolve identities in parallel
    // ------------------------------------------------------------------
    const persistedWalletIdentityPromise = resolvePersistedWalletIdentity(creatorAddress).catch((error) => {
      logger.warn('[quickstart] Persisted wallet identity lookup failed', {
        creatorAddress,
        error,
      })
      return null
    })

    const [zoraProfile, persistedWalletIdentity] = await Promise.all([
      resolveZoraProfile(creatorAddress),
      persistedWalletIdentityPromise,
    ])

    const canonicalAjnaAutomation = {
      available: Boolean(persistedWalletIdentity?.canonicalSmartWallet && persistedWalletIdentity?.embeddedEoa),
      cswAddress: persistedWalletIdentity?.canonicalSmartWallet ?? null,
      embeddedEoaAddress: persistedWalletIdentity?.embeddedEoa ?? null,
    }

    // ------------------------------------------------------------------
    // 2. Auto-detect creator coin
    // ------------------------------------------------------------------
    let coinAddress: string | null = null
    let coinName: string | null = null
    let coinSymbol: string | null = null

    // First check Zora profile coins
    if (zoraProfile?.coins && zoraProfile.coins.length > 0) {
      // Find a coin where this address is the creator or CreatorCoin payoutRecipient.
      for (const coin of zoraProfile.coins) {
        try {
          const parties = await resolveCoinParties(coin.address as `0x${string}`)
          if (
            parties.creator?.toLowerCase() === creatorAddress ||
            parties.payoutRecipient?.toLowerCase() === creatorAddress
          ) {
            coinAddress = coin.address
            coinName = coin.name
            coinSymbol = coin.symbol
            break
          }
        } catch {
          // Skip coins that fail resolution
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. Enforce creator allowlist approval
    // ------------------------------------------------------------------
    const allowlisted = await hasApprovedCreatorAccess(db, creatorAddress)
    if (!allowlisted) {
      return res.status(403).json({
        success: false,
        error: 'Vault allowlist is pending approval',
      } satisfies ApiEnvelope<never>)
    }

    // ------------------------------------------------------------------
    // 4. Provision server signer wallet (explicit opt-in only)
    // ------------------------------------------------------------------
    let serverSignerAddress: string | null = null
    let serverSignerWalletId: string | null = null
    let ownerAdded = false

    if (enableAutomation) {
      try {
        const wallet = await getOrCreateCreatorAgentWallet({
          creatorToken: creatorAddress as `0x${string}`,
        })
        serverSignerAddress = wallet.address
        serverSignerWalletId = wallet.walletId

        // Check if signer is already an owner of the CSW
        ownerAdded = await checkIsOwner(creatorAddress, wallet.address)
        if (!ownerAdded) {
          pendingActions.push('add_owner')
        }
      } catch (err) {
        logger.warn('[quickstart] Server wallet provisioning failed', {
          creatorAddress,
          error: err,
        })
        pendingActions.push('provision_wallet')
      }
    }

    // ------------------------------------------------------------------
    // 5. Enable XMTP agent (explicit opt-in only)
    // ------------------------------------------------------------------
    let agentType: 'csw' | 'eoa' = 'eoa'
    let agentAddress = creatorAddress

    if (enableAutomation) {
      try {
        if (serverSignerWalletId && ownerAdded) {
          // Signer is already an owner — fully activate CSW agent
          const agentRow = await enableCswAgent({
            creatorAddress: creatorAddress as `0x${string}`,
            cswAddress: creatorAddress as `0x${string}`,
            privyWalletId: serverSignerWalletId,
            listedPublicly: true,
          })
          agentAddress = agentRow.xmtpAgentAddress
          agentType = 'csw'
        } else if (serverSignerWalletId) {
          // Signer provisioned but not yet an owner — pre-register as CSW
          // (will be fully activated after addOwnerAddress tx)
          const agentRow = await enableCswAgent({
            creatorAddress: creatorAddress as `0x${string}`,
            cswAddress: creatorAddress as `0x${string}`,
            privyWalletId: serverSignerWalletId,
            listedPublicly: true,
          })
          agentAddress = agentRow.xmtpAgentAddress
          agentType = 'csw'
        } else {
          // Fallback: generate EOA agent
          const agentRow = await getOrCreateCreatorXmtpAgent({
            creatorAddress: creatorAddress as `0x${string}`,
            listedPublicly: true,
          })
          agentAddress = agentRow.xmtpAgentAddress
          agentType = 'eoa'
        }
      } catch (err) {
        logger.warn('[quickstart] Agent creation failed', err)
        pendingActions.push('enable_agent')
      }
    } else if (canonicalAjnaAutomation.available) {
      pendingActions.push('canonical_ajna_automation_opt_in_available')
    }

    // ------------------------------------------------------------------
    // 6. Create default vault config (if coin detected)
    // ------------------------------------------------------------------
    let vaultConfigCreated = false

    if (coinAddress) {
      try {
        const { upsertKeeprVault } = await import('../../../../server/_lib/keepr/keeprRegistry.js')

        // Generate a placeholder group ID — the user can update this later
        // or it gets overwritten when they create an actual XMTP group
        const defaultGroupId = `quickstart:${creatorAddress}:${Date.now()}`

        await upsertKeeprVault({
          config: {
            version: 1,
            chainId: 8453,
            vault: {
              vaultAddress: creatorAddress as `0x${string}`, // Placeholder — updated in admin
              creatorCoinAddress: coinAddress as `0x${string}`,
              canonicalOwnerAddress: creatorAddress as `0x${string}`,
            },
            xmtp: {
              groupId: defaultGroupId,
              agentInboxId: agentAddress,
            },
            gating: {
              enabled: true,
              joinLocked: false,
              mode: 'shares',
              thresholds: { minShares: '1' },
              failClosed: true,
            },
            roles: {
              owner: creatorAddress as `0x${string}`,
            },
          },
          actorWallet: creatorAddress,
        })
        vaultConfigCreated = true
      } catch (err) {
        logger.warn('[quickstart] Vault config creation failed', err)
        // Non-fatal — they can configure later
      }
    }

    // ------------------------------------------------------------------
    // 7. Build response
    // ------------------------------------------------------------------
    const result: QuickstartResult = {
      creatorAddress,
      zoraProfile: zoraProfile
        ? { displayName: zoraProfile.displayName, handle: zoraProfile.handle }
        : null,
      coinAddress,
      coinName,
      coinSymbol,
      agentType,
      agentAddress,
      serverSignerAddress,
      serverSignerWalletId,
      ownerAdded,
      vaultConfigCreated,
      allowlisted,
      canonicalAjnaAutomation,
      pendingActions,
    }

    logger.info('[quickstart] Creator onboarded', {
      creator: creatorAddress.slice(0, 10),
      coin: coinAddress?.slice(0, 10) ?? 'none',
      agentType,
      ownerAdded,
      pendingActions,
    })

    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<QuickstartResult>)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Quickstart failed'
    logger.error('[quickstart] Fatal error', { error: message })
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
