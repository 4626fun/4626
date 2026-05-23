#!/usr/bin/env node
/** Find wallets owned by a specific Privy key quorum. */

const TARGET_OWNER = process.argv[2]?.trim() || 'iugbyquej8u2oe80w6ox9kfv'

async function main() {
  const appId = process.env.PRIVY_APP_ID?.trim()
  const secret = process.env.PRIVY_APP_SECRET?.trim()
  if (!appId || !secret) throw new Error('missing privy creds')

  const auth = `Basic ${Buffer.from(`${appId}:${secret}`, 'utf8').toString('base64')}`
  const headers = { 'privy-app-id': appId, Authorization: auth }

  let cursor: string | null = null
  const hits: unknown[] = []
  for (let page = 0; page < 30; page += 1) {
    const path = cursor ? `/v1/wallets?limit=100&cursor=${encodeURIComponent(cursor)}` : '/v1/wallets?limit=100'
    const res = await fetch(`https://api.privy.io${path}`, { headers })
    const body = (await res.json()) as { data?: any[]; next_cursor?: string | null }
    if (!res.ok) throw new Error(`privy ${res.status}`)

    for (const wallet of body.data ?? []) {
      if (wallet.owner_id === TARGET_OWNER) hits.push(wallet)
    }

    cursor = body.next_cursor ?? null
    if (!cursor) break
  }

  console.log(JSON.stringify({ ownerId: TARGET_OWNER, count: hits.length, wallets: hits }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
