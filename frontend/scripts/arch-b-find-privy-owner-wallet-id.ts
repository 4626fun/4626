#!/usr/bin/env node
/**
 * Architecture B Phase 2 — Privy owner wallet-id resolver (operator-only).
 *
 * Resolves the Privy server wallet id for a given user's embedded owner EOA.
 * That id is what admin provisioning writes into
 * `command_issuer_execution_context.privy_owner_wallet_id`, and it's what
 * `sendPrivyCoinbaseSmartWalletUserOperation` later passes to `walletRpc` as
 * `walletId` to sign UserOperations on behalf of the owner EOA at index 0 of
 * a user-owned Coinbase Smart Wallet.
 *
 * This is **local/operator tooling only** (matches the `zora-cli`-style
 * pattern from the 4626-integrations skill). It is read-only against Privy,
 * does not mutate the DB, and never runs on the hot path. Server-held Privy
 * credentials are required.
 *
 * Surface coverage is handled by
 * `server/_lib/wallet/privyOwnerWalletIdResolver.ts`, which walks
 * `user.wallet`, `user.wallets`, `user.linkedAccounts`,
 * `user.linked_accounts`, and nested
 * `smartWallets`/`smart_wallets`/`embeddedWallets`/`embedded_wallets`
 * arrays, accepting both camelCase and snake_case field names. That helper
 * is also covered by unit tests under the same directory.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/arch-b-find-privy-owner-wallet-id.ts \
 *     --privy-user-id <did:privy:...> \
 *     --owner-eoa <0x...>
 *
 * Environment:
 *   PRIVY_APP_ID, PRIVY_APP_SECRET   (required — server-side only)
 *
 * Exit codes:
 *   0  matched wallet with server id (prints JSON to stdout)
 *   1  matched wallet exists but has no server id (not delegated / not on
 *      unified wallets stack — action needed in Privy before provisioning)
 *   2  no matching wallet for that EOA under that DID
 *   3  usage/env error
 */

import { PrivyClient } from '@privy-io/server-auth'

import { resolveOwnerWalletId } from '../server/_lib/wallet/privyOwnerWalletIdResolver.ts'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

function usage(): void {
  console.log(`Usage:
  pnpm -C frontend exec tsx scripts/arch-b-find-privy-owner-wallet-id.ts \\
    --privy-user-id <did:privy:...> \\
    --owner-eoa <0x...>

Environment:
  PRIVY_APP_ID       required
  PRIVY_APP_SECRET   required
`)
}

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return ''
  return String(next).trim()
}

function requireEnv(key: string): string {
  const v = (process.env[key] ?? '').trim()
  if (!v) {
    console.error(`[arch-b/resolve] ${key} missing`)
    process.exit(3)
  }
  return v
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    process.exit(0)
  }

  const did = getArg('--privy-user-id')
  const ownerEoa = getArg('--owner-eoa')
  if (!did || !did.startsWith('did:privy:')) {
    console.error('[arch-b/resolve] --privy-user-id is required (must look like did:privy:...)')
    usage()
    process.exit(3)
  }
  if (!ownerEoa || !/^0x[a-fA-F0-9]{40}$/i.test(ownerEoa.trim())) {
    console.error('[arch-b/resolve] --owner-eoa is required and must be a 0x address')
    usage()
    process.exit(3)
  }

  const appId = requireEnv('PRIVY_APP_ID')
  const appSecret = requireEnv('PRIVY_APP_SECRET')

  const client = new PrivyClient(appId, appSecret)

  let user
  try {
    user = await client.getUserById(did)
  } catch (error) {
    console.error(
      '[arch-b/resolve] getUserById failed',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(3)
  }

  const outcome = resolveOwnerWalletId(user, ownerEoa)

  if (outcome.status === 'no_match') {
    console.error(
      `[arch-b/resolve] no wallet surface matches ownerEoa ${ownerEoa.toLowerCase()} under ${did}`,
    )
    console.error('[arch-b/resolve] inspected wallet surfaces:')
    for (const w of outcome.inspected) {
      console.error(
        `  - address=${w.address} chainType=${w.chainType} walletClientType=${w.walletClientType} rawType=${w.rawType} delegated=${w.delegated} hdWalletIndex=${w.hdWalletIndex} id=${w.id ?? 'null'}`,
      )
    }
    process.exit(2)
  }

  if (outcome.status === 'no_server_id') {
    console.error('[arch-b/resolve] matched wallet exists but has no server wallet id')
    console.error(
      '[arch-b/resolve] this EOA must be a Privy embedded wallet that is delegated or on the unified wallets stack before provisioning',
    )
    for (const w of outcome.matches) {
      console.error(
        `  - address=${w.address} chainType=${w.chainType} walletClientType=${w.walletClientType} rawType=${w.rawType} delegated=${w.delegated} hdWalletIndex=${w.hdWalletIndex}`,
      )
    }
    process.exit(1)
  }

  const { candidate } = outcome
  const out = {
    privyUserId: did,
    ownerEoa: candidate.address,
    privyOwnerWalletId: candidate.id,
    chainType: candidate.chainType,
    walletClientType: candidate.walletClientType,
    hdWalletIndex: candidate.hdWalletIndex,
    delegated: candidate.delegated,
  }
  // JSON to stdout; diagnostics go to stderr above.
  console.log(JSON.stringify(out, null, 2))
}

// Only run as CLI when invoked directly. The importable helpers live in
// `server/_lib/wallet/privyOwnerWalletIdResolver.ts` and are covered by
// unit tests there.
const invokedPath = (process.argv[1] ?? '').replace(/\\/g, '/')
if (
  invokedPath.endsWith('/arch-b-find-privy-owner-wallet-id.ts') ||
  invokedPath.endsWith('/arch-b-find-privy-owner-wallet-id.js') ||
  invokedPath.endsWith('/arch-b-find-privy-owner-wallet-id.mjs')
) {
  main().catch((error) => {
    console.error(
      '[arch-b/resolve] fatal',
      error instanceof Error ? error.stack || error.message : String(error),
    )
    process.exit(3)
  })
}
