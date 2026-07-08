#!/usr/bin/env node
/** Read-only audit: Hermit CSW owner addresses vs local Privy app wallets. */

const TARGETS = [
  '0x8719fa7be10533fd69885b124a8c84f9c51071af',
  '0x56a0e77e10ae1c9b79b25d0c7f656b5a6bb2884a',
  '0xcc2aa42239a4f58b0e1a344c8d4e3b409c619169',
  '0x5b224bd03a4c6f2607cb4709a703a24795123162',
  '0x5744e8dbf8815f4ba4d1a87984da849289c4e75b',
  '0x858c01556ec5a8531fa4118d595430ac7fd0baf0',
] as const

const USER_SHELL_OWNER = 'iugbyquej8u2oe80w6ox9kfv'
const USER_SHELL_WALLET_ID = 'l6zzzn135ig2w0y44r1ycq19'

async function privyFetch(path: string, appId: string, secret: string) {
  const auth = `Basic ${Buffer.from(`${appId}:${secret}`, 'utf8').toString('base64')}`
  const res = await fetch(`https://api.privy.io${path}`, {
    headers: { 'privy-app-id': appId, Authorization: auth },
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // keep raw text
  }
  return { status: res.status, body }
}

async function listOwnerQuorumWallets(appId: string, secret: string, ownerId: string) {
  const hits: Array<{ id: string; address: string; policy_ids: string[] }> = []
  const addressHits: Record<string, Array<{ id: string; owner_id: string | null; policy_ids: string[] }>> = {}
  let cursor: string | null = null
  let pages = 0
  let listError: { status: number; body: unknown; page: number } | null = null

  for (pages = 0; pages < 50; pages += 1) {
    const path = cursor
      ? `/v1/wallets?limit=100&cursor=${encodeURIComponent(cursor)}`
      : '/v1/wallets?limit=100'
    const res = await privyFetch(path, appId, secret)
    if (res.status !== 200) {
      listError = { status: res.status, body: res.body, page: pages }
      break
    }
    const data = (res.body as { data?: any[]; next_cursor?: string | null })?.data ?? []
    for (const wallet of data) {
      const address = String(wallet?.address ?? '').toLowerCase()
      if (wallet?.owner_id === ownerId) {
        hits.push({
          id: String(wallet.id),
          address,
          policy_ids: Array.isArray(wallet.policy_ids) ? wallet.policy_ids : [],
        })
      }
      if (TARGETS.includes(address as (typeof TARGETS)[number])) {
        ;(addressHits[address] ||= []).push({
          id: String(wallet.id),
          owner_id: wallet.owner_id ?? null,
          policy_ids: Array.isArray(wallet.policy_ids) ? wallet.policy_ids : [],
        })
      }
    }
    cursor = (res.body as { next_cursor?: string | null })?.next_cursor ?? null
    if (!cursor) break
  }

  return { hits, addressHits, pages, listError }
}

async function main(): Promise<void> {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const secret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  const envOwnerId = String(process.env.PRIVY_WALLET_OWNER_ID ?? '').trim()
  const canonicalId = String(process.env.CANONICAL_CSW_PRIVY_WALLET_ID ?? '').trim()

  if (!appId || !secret) {
    console.error('PRIVY_APP_ID and PRIVY_APP_SECRET required')
    process.exit(2)
  }

  const report: Record<string, unknown> = {
    env: {
      privy_app_id_prefix: `${appId.slice(0, 10)}…`,
      privy_wallet_owner_id_in_env: envOwnerId,
      canonical_csw_privy_wallet_id_in_env: canonicalId,
      canonical_matches_user_shell_l6zz: canonicalId === USER_SHELL_WALLET_ID,
      env_owner_matches_user_shell_iug: envOwnerId === USER_SHELL_OWNER,
    },
  }

  if (canonicalId) {
    report.canonical_wallet_by_env_id = await privyFetch(
      `/v1/wallets/${encodeURIComponent(canonicalId)}`,
      appId,
      secret,
    )
  }

  report.owner_quorum_from_env = await listOwnerQuorumWallets(appId, secret, envOwnerId)
  if (envOwnerId !== USER_SHELL_OWNER) {
    report.owner_quorum_from_user_shell = await listOwnerQuorumWallets(
      appId,
      secret,
      USER_SHELL_OWNER,
    )
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
