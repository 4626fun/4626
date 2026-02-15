/**
 * waitlistPreprovision.ts
 *
 * Background pre-provisioning for waitlist signups.
 * When a creator joins the waitlist (and has a CSW / primary wallet),
 * we resolve their identities and provision a Privy server wallet
 * so that when they're approved, the only remaining step is a single
 * onchain `addOwnerAddress` transaction.
 */

import { getDb, isDbConfigured } from './postgres.js'
import { getOrCreateCreatorAgentWallet } from './creatorAgentWallets.js'
import { logger } from './logger.js'
import { resolveFarcasterProfile } from './farcasterProvider.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

// ---------------------------------------------------------------------------
// Helpers (duplicated from quickstart to avoid circular deps)
// ---------------------------------------------------------------------------

async function resolveZoraProfile(address: string): Promise<{
  handle: string | null
  coins: Array<{ address: string; name: string; symbol: string }>
} | null> {
  try {
    const key = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
    if (!key) return null

    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const profileRes = await sdk.getProfile({ identifier: address })
    const profile = (profileRes as any)?.data?.profile ?? null

    const coinsRes = await sdk.getProfileCoins({
      identifier: address,
      count: 10,
      chainIds: [8453],
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
      handle: profile?.username ?? null,
      coins,
    }
  } catch {
    return null
  }
}

async function resolveFarcaster(address: string): Promise<{
  username: string | null
  pfpUrl: string | null
} | null> {
  try {
    const { profile, source } = await resolveFarcasterProfile({ address })
    if (source !== 'none') {
      logger.info('[preprovision] Farcaster profile source', { source, address: address.slice(0, 10) })
    }
    if (!profile) return null
    return {
      username: profile.username,
      pfpUrl: profile.avatar,
    }
  } catch {
    return null
  }
}

async function findCreatorCoin(
  address: string,
  zoraCoins: Array<{ address: string; name: string; symbol: string }>,
): Promise<{ address: string; symbol: string } | null> {
  try {
    const { resolveCoinParties } = await import('./coinParties.js')
    for (const coin of zoraCoins) {
      try {
        const parties = await resolveCoinParties(coin.address as `0x${string}`)
        if (
          parties.creator?.toLowerCase() === address.toLowerCase() ||
          parties.payoutRecipient?.toLowerCase() === address.toLowerCase()
        ) {
          return { address: coin.address, symbol: coin.symbol }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // coinParties module missing — skip
  }
  return null
}

// ---------------------------------------------------------------------------
// Main pre-provisioning function
// ---------------------------------------------------------------------------

export type PreprovisionResult = {
  serverWalletId: string | null
  serverWalletAddress: string | null
  coinAddress: string | null
  coinSymbol: string | null
  farcasterUsername: string | null
  farcasterPfp: string | null
  zoraHandle: string | null
}

/**
 * Pre-provision a waitlist user. This resolves identities and provisions
 * a Privy server wallet, then stores the results on the `profiles` row.
 *
 * This function is safe to call multiple times (idempotent).
 * It should be called in a fire-and-forget fashion after waitlist signup.
 *
 * @param signupId  - The `profiles.id` of the waitlist entry
 * @param walletAddress - The user's primary EVM wallet (CSW or EOA)
 */
export async function preprovisionWaitlistUser(
  signupId: number,
  walletAddress: string,
): Promise<PreprovisionResult | null> {
  if (!walletAddress || !isDbConfigured()) return null

  const db = (await getDb()) as unknown as Db | null
  if (!db) return null

  const addr = walletAddress.toLowerCase()

  // Check if already pre-provisioned (skip if so)
  try {
    const existing = await db.sql`
      SELECT preprovisioned_at, preprov_server_wallet_id
      FROM profiles
      WHERE id = ${signupId}
      LIMIT 1;
    `
    const row = existing.rows?.[0]
    if (row?.preprovisioned_at && row?.preprov_server_wallet_id) {
      logger.info('[preprovision] Already provisioned, skipping', { signupId })
      return null
    }
  } catch {
    // table may not have column yet — proceed anyway
  }

  logger.info('[preprovision] Starting for signup', { signupId, wallet: addr.slice(0, 10) })

  // 1. Resolve identities in parallel
  const [zoraProfile, farcaster] = await Promise.all([
    resolveZoraProfile(addr),
    resolveFarcaster(addr),
  ])

  // 2. Find creator coin
  let coinAddress: string | null = null
  let coinSymbol: string | null = null
  if (zoraProfile?.coins && zoraProfile.coins.length > 0) {
    const coin = await findCreatorCoin(addr, zoraProfile.coins)
    if (coin) {
      coinAddress = coin.address
      coinSymbol = coin.symbol
    }
  }

  // 3. Provision Privy server wallet
  let serverWalletId: string | null = null
  let serverWalletAddress: string | null = null
  try {
    // Use the wallet address itself as the "creatorToken" key for the server wallet
    const wallet = await getOrCreateCreatorAgentWallet({
      creatorToken: addr as `0x${string}`,
    })
    serverWalletId = wallet.walletId
    serverWalletAddress = wallet.address
  } catch (err) {
    logger.warn('[preprovision] Server wallet provisioning failed', err)
    // Continue — we still store the identity data
  }

  // 4. Persist results
  const result: PreprovisionResult = {
    serverWalletId,
    serverWalletAddress,
    coinAddress,
    coinSymbol,
    farcasterUsername: farcaster?.username ?? null,
    farcasterPfp: farcaster?.pfpUrl ?? null,
    zoraHandle: zoraProfile?.handle ?? null,
  }

  try {
    await db.sql`
      UPDATE profiles
      SET preprovisioned_at = NOW(),
          preprov_server_wallet_id = ${serverWalletId},
          preprov_server_wallet_address = ${serverWalletAddress},
          preprov_coin_address = ${coinAddress},
          preprov_coin_symbol = ${coinSymbol},
          preprov_farcaster_username = ${farcaster?.username ?? null},
          preprov_farcaster_pfp = ${farcaster?.pfpUrl ?? null},
          preprov_zora_handle = ${zoraProfile?.handle ?? null},
          updated_at = NOW()
      WHERE id = ${signupId};
    `
    logger.info('[preprovision] Stored results', {
      signupId,
      serverWallet: serverWalletAddress?.slice(0, 10) ?? 'none',
      coin: coinAddress?.slice(0, 10) ?? 'none',
      fc: farcaster?.username ?? 'none',
      zora: zoraProfile?.handle ?? 'none',
    })
  } catch (err) {
    logger.warn('[preprovision] Failed to store results', err)
  }

  return result
}
