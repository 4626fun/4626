#!/usr/bin/env node
/**
 * Architecture B Phase 2 — Privy owner wallet-id resolver (operator-only).
 *
 * Resolves the Privy server wallet id for a given user's embedded EOA. That id
 * is what admin provisioning writes into
 * `command_issuer_execution_context.privy_owner_wallet_id`, and it's what
 * `sendPrivyCoinbaseSmartWalletUserOperation` later passes to `walletRpc` as
 * `walletId` to sign UserOperations on behalf of the owner EOA at index 0 of
 * a user-owned Coinbase Smart Wallet.
 *
 * This is **local/operator tooling only** (matches the `zora-cli`-style pattern
 * from the 4626-integrations skill). It is read-only against Privy, does not
 * mutate the DB, and never runs on the hot path. Server-held Privy credentials
 * are required.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/arch-b-find-privy-owner-wallet-id.ts \
 *     --privy-user-id <did> \
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

function normalizeAddress(value: string): string | null {
  const out = String(value || '').trim().toLowerCase()
  return /^0x[0-9a-f]{40}$/.test(out) ? out : null
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    process.exit(0)
  }

  const did = getArg('--privy-user-id')
  const ownerEoaArg = getArg('--owner-eoa')
  if (!did || !did.startsWith('did:privy:')) {
    console.error('[arch-b/resolve] --privy-user-id is required (must look like did:privy:...)')
    usage()
    process.exit(3)
  }
  const ownerEoa = normalizeAddress(ownerEoaArg)
  if (!ownerEoa) {
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
    console.error('[arch-b/resolve] getUserById failed', error instanceof Error ? error.message : String(error))
    process.exit(3)
  }

  const accounts = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const walletAccounts = accounts.filter(
    (a: any) => a && a.type === 'wallet' && typeof a.address === 'string',
  )

  const matches = walletAccounts.filter(
    (a: any) => normalizeAddress(String(a.address)) === ownerEoa,
  )

  if (matches.length === 0) {
    console.error(
      `[arch-b/resolve] no wallet linked_account matches ownerEoa ${ownerEoa} under ${did}`,
    )
    console.error('[arch-b/resolve] linked wallet addresses:')
    for (const a of walletAccounts) {
      console.error(
        `  - address=${a.address} chainType=${a.chainType} walletClientType=${a.walletClientType} delegated=${a.delegated} hdWalletIndex=${a.hdWalletIndex} id=${(a as any).id ?? 'null'}`,
      )
    }
    process.exit(2)
  }

  // Prefer a Privy-embedded delegated wallet (has an `id`). Non-embedded
  // or non-delegated matches cannot be used as the owner signer for
  // Architecture B — surface them explicitly.
  const matchWithId = matches.find((a: any) => typeof a.id === 'string' && a.id)
  if (!matchWithId) {
    console.error('[arch-b/resolve] matched wallet exists but has no server wallet id')
    console.error(
      '[arch-b/resolve] this EOA must be a Privy embedded wallet that is delegated or on the unified wallets stack before provisioning',
    )
    for (const a of matches) {
      console.error(
        `  - address=${a.address} chainType=${a.chainType} walletClientType=${a.walletClientType} delegated=${a.delegated} hdWalletIndex=${a.hdWalletIndex}`,
      )
    }
    process.exit(1)
  }

  const out = {
    privyUserId: did,
    ownerEoa,
    privyOwnerWalletId: (matchWithId as any).id,
    chainType: (matchWithId as any).chainType,
    walletClientType: (matchWithId as any).walletClientType ?? null,
    hdWalletIndex: (matchWithId as any).hdWalletIndex ?? null,
    delegated: (matchWithId as any).delegated ?? null,
  }
  // JSON to stdout; diagnostics go to stderr above.
  console.log(JSON.stringify(out, null, 2))
}

main().catch((error) => {
  console.error('[arch-b/resolve] fatal', error instanceof Error ? error.stack || error.message : String(error))
  process.exit(3)
})
