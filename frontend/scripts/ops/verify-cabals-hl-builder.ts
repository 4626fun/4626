#!/usr/bin/env tsx
/**
 * Read-only check: InverseAKITA HL wallet Cabals builder approval + membership.
 *
 * Usage:
 *   pnpm -C frontend ops:cabals:builder-status
 *
 * Exit codes:
 *   0 — builder approved at/above configured fee and Cabals member present
 *   1 — approval or membership gap
 *   2 — configuration error
 */

declare const process: {
  env: Record<string, string | undefined>
  exit: (code: number) => void
}

const CABALS_BUILDER_DEFAULT = '0x6D4D5e0bFF83a0f2C1278b94e141809d5597D356'
const AGENT_WALLET_DEFAULT = '0x74ab91cd845ff0d2006404440af49c3bc8c1df96'
const CABAL_ID_DEFAULT = '267f37a4-9d45-4229-b362-6834581ac7f7'
const FEE_TENTHS_BPS_DEFAULT = 50

async function main(): Promise<void> {
  const user = (
    process.env.ARENA_AGENT_WALLET_ADDRESS ??
    process.env.HL_MASTER_ADDRESS ??
    AGENT_WALLET_DEFAULT
  )
    .trim()
    .toLowerCase()
  const builder = (
    process.env.ARENA_CABALS_BUILDER_ADDRESS ?? CABALS_BUILDER_DEFAULT
  )
    .trim()
    .toLowerCase()
  const cabalId = (process.env.CABALS_CABAL_ID ?? CABAL_ID_DEFAULT).trim()
  const minFee = Number(
    process.env.ARENA_CABALS_BUILDER_FEE_TENTHS_BPS ?? FEE_TENTHS_BPS_DEFAULT,
  )
  if (!/^0x[a-f0-9]{40}$/.test(user) || !/^0x[a-f0-9]{40}$/.test(builder)) {
    console.error('invalid_wallet_or_builder_address')
    process.exit(2)
  }
  if (!Number.isInteger(minFee) || minFee < 0) {
    console.error('invalid_fee_tenths_bps')
    process.exit(2)
  }

  const hlRes = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'maxBuilderFee', user, builder }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!hlRes.ok) {
    console.error(`hyperliquid_http_${hlRes.status}`)
    process.exit(1)
  }
  const maxBuilderFee = (await hlRes.json()) as unknown
  const approvedTenths =
    typeof maxBuilderFee === 'number' ? maxBuilderFee : Number(maxBuilderFee)

  const membersRes = await fetch(
    `https://cabals.com/api/cabals/${encodeURIComponent(cabalId)}/members`,
    {
      headers: { accept: 'application/json', 'user-agent': '4626-cabals-builder-status' },
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!membersRes.ok) {
    console.error(`cabals_members_http_${membersRes.status}`)
    process.exit(1)
  }
  const membersJson = (await membersRes.json()) as {
    members?: Array<{
      username?: string
      user_id?: string
      stats?: { current?: { builder_volume?: string } }
    }>
  }
  const inverse = (membersJson.members ?? []).find(
    (m) => String(m.username ?? '').toLowerCase() === 'inverseakita',
  )

  const report = {
    user,
    builder,
    cabalId,
    minFeeTenthsOfBps: minFee,
    maxBuilderFeeTenthsOfBps: approvedTenths,
    builderApproved: Number.isFinite(approvedTenths) && approvedTenths >= minFee,
    cabalsMember: inverse
      ? {
          username: inverse.username,
          userId: inverse.user_id,
          builderVolume: inverse.stats?.current?.builder_volume ?? null,
        }
      : null,
  }
  console.log(JSON.stringify(report, null, 2))

  if (!report.builderApproved || !report.cabalsMember) {
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
