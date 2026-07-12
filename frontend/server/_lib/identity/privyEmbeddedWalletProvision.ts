import { PrivyClient } from '@privy-io/server-auth'

import {
  classifyLinkedAccounts,
  type ClassifiedLinkedAccounts,
} from '../wallet/walletMapping.js'

declare const process: { env: Record<string, string | undefined> }

const PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS = 4
const PRIVY_USER_WALLET_LINK_RETRY_DELAY_MS = 200

type ProvisionResult = {
  user: any
  classified: ClassifiedLinkedAccounts
}

function logProvision(detail: Record<string, unknown>): void {
  console.info('[privy] ensure-user-embedded-wallet', detail)
}

export function createPrivyServerClientFromEnv(): PrivyClient {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth is not configured.')
  }
  return new PrivyClient(appId, appSecret)
}

/**
 * Idempotently ensure the verified Privy user has a user-owned Ethereum EOA.
 * This is the shared path for whitelabel OTP surfaces, where createOnLogin does
 * not run. Privy smart wallets and external wallets do not satisfy this signer
 * invariant.
 */
export async function ensurePrivyUserEmbeddedWallet(
  client: PrivyClient,
  userId: string,
  initialUser?: any,
): Promise<ProvisionResult> {
  let user = initialUser ?? (await client.getUserById(userId))
  let classified = classifyLinkedAccounts(user as any)
  if (classified.embeddedEoa) return { user, classified }

  try {
    const created = await client.createWallets({
      userId,
      wallets: [{ chainType: 'ethereum', policyIds: [] }],
    })
    const nextClassified = classifyLinkedAccounts(created as any)
    logProvision({
      path: 'createWallets',
      embeddedEoa: nextClassified.embeddedEoa?.address ?? null,
    })
    if (nextClassified.embeddedEoa) {
      return { user: created, classified: nextClassified }
    }
    if (nextClassified.allWallets.length > 0) {
      user = created
      classified = nextClassified
    }
  } catch (error) {
    logProvision({
      path: 'createWallets',
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
  }

  if (!classified.embeddedEoa) {
    try {
      const wallet = await client.walletApi.create({
        chainType: 'ethereum',
        owner: { userId },
      })
      logProvision({
        path: 'walletApi.create',
        address: typeof wallet?.address === 'string' ? wallet.address : null,
        walletId: typeof wallet?.id === 'string' ? wallet.id : null,
      })
    } catch (error) {
      logProvision({
        path: 'walletApi.create',
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    }
  }

  const best = { user, classified }
  for (let attempt = 1; attempt <= PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS; attempt += 1) {
    const reloadedUser = await client.getUserById(userId)
    const reloadedClassified = classifyLinkedAccounts(reloadedUser as any)
    if (reloadedClassified.embeddedEoa) {
      return { user: reloadedUser, classified: reloadedClassified }
    }
    if (attempt < PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, PRIVY_USER_WALLET_LINK_RETRY_DELAY_MS))
    }
  }

  return best
}
