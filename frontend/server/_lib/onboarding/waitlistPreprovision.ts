/**
 * waitlistPreprovision.ts
 *
 * Background pre-provisioning for waitlist signups.
 * When a creator joins the waitlist (and has a CSW / primary wallet),
 * we resolve their identities and provision a Privy server wallet
 * so that when they're approved, the only remaining step is a single
 * onchain `addOwnerAddress` transaction.
 */

import { getDb, isDbConfigured } from '../db/postgres.js'
import { getOrCreateCreatorAgentWallet } from '../wallet/creatorAgentWallets.js'
import { logger } from '../infra/logger.js'
import { fetchZoraProfileForAccount } from '../zora/zoraProfileIdentifier.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

// ---------------------------------------------------------------------------
// Helpers (duplicated from quickstart to avoid circular deps)
// ---------------------------------------------------------------------------

async function resolveZoraProfileForSignup(params: {
  signupId: number
  walletAddress: string
  db: Db
}): Promise<{
  handle: string | null
  coins: Array<{ address: string; name: string; symbol: string }>
  profileSeed: string | null
} | null> {
  const addr = params.walletAddress.toLowerCase()

  let cswAddress: string | null = null
  let embeddedEoa: string | null = null
  let preprovZoraHandle: string | null = null
  try {
    const row = await params.db.sql`
      SELECT csw_address, primary_embedded_eoa, preprov_zora_handle
      FROM profiles
      WHERE id = ${params.signupId}
      LIMIT 1;
    `
    const profile = row.rows?.[0]
    cswAddress =
      typeof profile?.csw_address === 'string' && profile.csw_address.trim()
        ? profile.csw_address.trim().toLowerCase()
        : null
    embeddedEoa =
      typeof profile?.primary_embedded_eoa === 'string' && profile.primary_embedded_eoa.trim()
        ? profile.primary_embedded_eoa.trim().toLowerCase()
        : null
    preprovZoraHandle =
      typeof profile?.preprov_zora_handle === 'string' && profile.preprov_zora_handle.trim()
        ? profile.preprov_zora_handle.trim()
        : null
  } catch {
    // proceed with walletAddress-only seeds
  }

  const { profile, seed: profileSeed } = await fetchZoraProfileForAccount({
    preprovZoraHandle,
    canonicalCswAddress: cswAddress ?? (addr !== embeddedEoa ? addr : null),
    embeddedEoaAddress: embeddedEoa ?? (addr === embeddedEoa ? addr : null),
    primaryWalletAddress: addr !== cswAddress && addr !== embeddedEoa ? addr : null,
  })

  if (!profile || !profileSeed) return null

  try {
    const key = (process.env.ZORA_SERVER_API_KEY ?? '').trim()
    if (!key) {
      return {
        handle: profile?.username ?? profile?.handle ?? null,
        coins: [],
        profileSeed,
      }
    }

    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const coinsRes = await sdk.getProfileCoins({
      identifier: profileSeed,
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
      handle: profile?.username ?? profile?.handle ?? null,
      coins,
      profileSeed,
    }
  } catch {
    return {
      handle: profile?.username ?? profile?.handle ?? null,
      coins: [],
      profileSeed,
    }
  }
}

async function findCreatorCoin(
  address: string,
  zoraCoins: Array<{ address: string; name: string; symbol: string }>,
): Promise<{ address: string; symbol: string } | null> {
  try {
    const { resolveCoinParties } = await import('../onchain/coinParties.js')
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

  // 1. Resolve identities (CSW before embedded EOA when both are known)
  const zoraProfile = await resolveZoraProfileForSignup({ signupId, walletAddress: addr, db })

  // 2. Find creator coin
  let coinAddress: string | null = null
  let coinSymbol: string | null = null
  if (zoraProfile?.coins && zoraProfile.coins.length > 0) {
    const coin = await findCreatorCoin(zoraProfile.profileSeed ?? addr, zoraProfile.coins)
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
    logger.warn('[preprovision] Server wallet provisioning failed', {
      signupId,
      wallet: addr.slice(0, 10),
      error: err,
    })
    // Continue — we still store the identity data
  }

  // 4. Persist results
  const result: PreprovisionResult = {
    serverWalletId,
    serverWalletAddress,
    coinAddress,
    coinSymbol,
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
          preprov_zora_handle = ${zoraProfile?.handle ?? null},
          updated_at = NOW()
      WHERE id = ${signupId};
    `
    logger.info('[preprovision] Stored results', {
      signupId,
      serverWallet: serverWalletAddress?.slice(0, 10) ?? 'none',
      coin: coinAddress?.slice(0, 10) ?? 'none',
      zora: zoraProfile?.handle ?? 'none',
    })
  } catch (err) {
    logger.warn('[preprovision] Failed to store results', {
      signupId,
      wallet: addr.slice(0, 10),
      error: err,
    })
  }

  return result
}
