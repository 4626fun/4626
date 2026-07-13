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

function readAuthorizationPrivateKey(): string | undefined {
  const raw = String(process.env.PRIVY_WALLET_AUTHORIZATION_KEY ?? '').trim()
  return raw || undefined
}

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

function userWithSyntheticEmbeddedWallet(user: any, address: string): any {
  const linkedAccounts = Array.isArray(user?.linkedAccounts)
    ? [...user.linkedAccounts]
    : Array.isArray(user?.linked_accounts)
      ? [...user.linked_accounts]
      : []
  const already = linkedAccounts.some(
    (account) => normalizeEvmAddress((account as { address?: unknown })?.address) === address,
  )
  if (!already) {
    linkedAccounts.push({
      type: 'wallet',
      address,
      walletClientType: 'privy',
      chainType: 'ethereum',
    })
  }
  return {
    ...user,
    linkedAccounts,
  }
}

export function createPrivyServerClientFromEnv(): PrivyClient {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth is not configured.')
  }
  const authorizationPrivateKey = readAuthorizationPrivateKey()
  return new PrivyClient(appId, appSecret, {
    ...(authorizationPrivateKey
      ? {
          walletApi: {
            authorizationPrivateKey,
          },
        }
      : {}),
  })
}

async function reloadPrivyUserAfterWalletCreate(
  client: PrivyClient,
  userId: string,
  initial: ProvisionResult,
): Promise<ProvisionResult> {
  let latest = initial
  for (let attempt = 1; attempt <= PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS; attempt += 1) {
    const reloadedUser = await client.getUserById(userId)
    const reloadedClassified = classifyLinkedAccounts(reloadedUser as any)
    latest = { user: reloadedUser, classified: reloadedClassified }
    if (reloadedClassified.embeddedEoa) return latest
    if (attempt < PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, PRIVY_USER_WALLET_LINK_RETRY_DELAY_MS))
    }
  }
  return latest
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

  // Prefer the documented user-wallet create shape. The `wallets: [...]` form
  // can succeed in mocks while failing against live Privy for brand-new email
  // users; `createEthereumWallet: true` is the supported path.
  try {
    const created = await client.createWallets({
      userId,
      createEthereumWallet: true,
      createSolanaWallet: false,
      createEthereumSmartWallet: false,
      numberOfEthereumWalletsToCreate: 1,
    })
    const nextClassified = classifyLinkedAccounts(created as any)
    logProvision({
      path: 'createWallets.createEthereumWallet',
      embeddedEoa: nextClassified.embeddedEoa?.address ?? null,
      walletCount: nextClassified.allWallets.length,
    })
    if (nextClassified.embeddedEoa) {
      return { user: created, classified: nextClassified }
    }
    user = created
    classified = nextClassified
    try {
      const reloaded = await reloadPrivyUserAfterWalletCreate(client, userId, { user, classified })
      user = reloaded.user
      classified = reloaded.classified
      if (classified.embeddedEoa) return reloaded
    } catch (error) {
      // A successful create followed by an inconclusive read must not trigger
      // another mutation and risk provisioning a duplicate wallet.
      logProvision({
        path: 'createWallets.createEthereumWallet.reload',
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
      return { user, classified }
    }
  } catch (error) {
    logProvision({
      path: 'createWallets.createEthereumWallet',
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
  }

  if (!classified.embeddedEoa) {
    try {
      const created = await client.createWallets({
        userId,
        wallets: [{ chainType: 'ethereum', policyIds: [] }],
      })
      const nextClassified = classifyLinkedAccounts(created as any)
      logProvision({
        path: 'createWallets.walletsArray',
        embeddedEoa: nextClassified.embeddedEoa?.address ?? null,
        walletCount: nextClassified.allWallets.length,
      })
      if (nextClassified.embeddedEoa) {
        return { user: created, classified: nextClassified }
      }
      user = created
      classified = nextClassified
      try {
        const reloaded = await reloadPrivyUserAfterWalletCreate(client, userId, { user, classified })
        user = reloaded.user
        classified = reloaded.classified
        if (classified.embeddedEoa) return reloaded
      } catch (error) {
        logProvision({
          path: 'createWallets.walletsArray.reload',
          error: error instanceof Error ? error.message : String(error ?? ''),
        })
        return { user, classified }
      }
    } catch (error) {
      logProvision({
        path: 'createWallets.walletsArray',
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    }
  }

  if (!classified.embeddedEoa) {
    try {
      const wallet = await client.walletApi.create({
        chainType: 'ethereum',
        owner: { userId },
      })
      const address = normalizeEvmAddress(wallet?.address)
      logProvision({
        path: 'walletApi.create',
        address,
        walletId: typeof wallet?.id === 'string' ? wallet.id : null,
      })
      if (address) {
        // walletApi.create can return before getUserById reflects the link.
        // Synthesize the linked account so session minting can proceed from the
        // just-created user-owned address.
        user = userWithSyntheticEmbeddedWallet(user, address)
        classified = classifyLinkedAccounts(user as any)
        if (classified.embeddedEoa) {
          return { user, classified }
        }
      }
    } catch (error) {
      logProvision({
        path: 'walletApi.create',
        error: error instanceof Error ? error.message : String(error ?? ''),
      })
    }
  }

  const reloaded = await reloadPrivyUserAfterWalletCreate(client, userId, { user, classified })
  user = reloaded.user
  classified = reloaded.classified
  if (classified.embeddedEoa) return reloaded

  logProvision({
    path: 'gave-up',
    embeddedEoa: null,
    walletCount: classified.allWallets.length,
  })
  return { user, classified }
}
