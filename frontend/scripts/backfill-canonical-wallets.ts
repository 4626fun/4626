import { getDb } from '../server/_lib/postgres.ts'
import { ensureWaitlistSchema } from '../server/_lib/waitlistSchema.ts'

type ProfileRow = {
  id: number
  privy_user_id: string | null
  csw_address: string | null
  embedded_wallet: string | null
  primary_smart_wallet: string | null
  primary_embedded_eoa: string | null
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function hasArg(args: string[], flag: string): boolean {
  return args.includes(flag)
}

async function main() {
  const args = process.argv.slice(2)
  const apply = hasArg(args, '--apply')
  const dryRun = hasArg(args, '--dry-run') || !apply

  const db = await getDb()
  if (!db) {
    console.error('DB is not configured')
    process.exit(1)
  }

  await ensureWaitlistSchema(db as any)

  const duplicatePrivy = await db.sql`
    SELECT privy_user_id
    FROM profiles
    WHERE privy_user_id IS NOT NULL
    GROUP BY privy_user_id
    HAVING COUNT(*) > 1;
  `
  const duplicateCount = Array.isArray(duplicatePrivy.rows) ? duplicatePrivy.rows.length : 0
  if (duplicateCount > 0) {
    console.error(`Found duplicate privy_user_id rows: ${duplicateCount}`)
    if (apply) process.exit(1)
  }

  const rowsResult = await db.sql`
    SELECT
      id,
      privy_user_id,
      csw_address,
      embedded_wallet,
      primary_smart_wallet,
      primary_embedded_eoa
    FROM profiles
    ORDER BY id ASC;
  `
  const rows = (Array.isArray(rowsResult.rows) ? rowsResult.rows : []) as ProfileRow[]

  let profilesTouched = 0
  let walletsInserted = 0
  let linksUpserted = 0
  let smartBackfills = 0
  let embeddedBackfills = 0

  for (const row of rows) {
    const smart = normalizeAddress(row.primary_smart_wallet) ?? normalizeAddress(row.csw_address)
    const embedded = normalizeAddress(row.primary_embedded_eoa) ?? normalizeAddress(row.embedded_wallet)
    if (!smart && !embedded) continue

    profilesTouched += 1
    const primary = smart ?? embedded
    if (!dryRun) {
      await db.sql`
        UPDATE profile_wallets
        SET
          is_primary = false,
          is_canonical_smart_wallet = false,
          is_embedded_eoa = false,
          updated_at = NOW()
        WHERE profile_id = ${row.id};
      `
    }

    if (smart) {
      smartBackfills += 1
      if (!dryRun) {
        await db.sql`
          INSERT INTO wallets (address, chain, wallet_type, provider)
          VALUES (${smart}, ${'evm'}, ${'smart_wallet'}, ${'unknown'})
          ON CONFLICT (address) DO NOTHING;
        `
        walletsInserted += 1
        await db.sql`
          INSERT INTO profile_wallets (
            profile_id,
            address,
            is_primary,
            is_canonical_smart_wallet,
            is_embedded_eoa,
            verified_at,
            metadata,
            updated_at
          )
          VALUES (
            ${row.id},
            ${smart},
            ${Boolean(primary === smart)},
            ${true},
            ${false},
            NOW(),
            ${{ backfilled: true, from: 'csw_address' }},
            NOW()
          )
          ON CONFLICT (profile_id, address) DO UPDATE
          SET
            is_primary = EXCLUDED.is_primary,
            is_canonical_smart_wallet = EXCLUDED.is_canonical_smart_wallet,
            is_embedded_eoa = EXCLUDED.is_embedded_eoa,
            verified_at = NOW(),
            metadata = EXCLUDED.metadata,
            updated_at = NOW();
        `
        linksUpserted += 1
      }
    }

    if (embedded) {
      embeddedBackfills += 1
      if (!dryRun) {
        await db.sql`
          INSERT INTO wallets (address, chain, wallet_type, provider)
          VALUES (${embedded}, ${'evm'}, ${'embedded_eoa'}, ${'unknown'})
          ON CONFLICT (address) DO NOTHING;
        `
        walletsInserted += 1
        await db.sql`
          INSERT INTO profile_wallets (
            profile_id,
            address,
            is_primary,
            is_canonical_smart_wallet,
            is_embedded_eoa,
            verified_at,
            metadata,
            updated_at
          )
          VALUES (
            ${row.id},
            ${embedded},
            ${Boolean(primary === embedded)},
            ${false},
            ${true},
            NOW(),
            ${{ backfilled: true, from: 'embedded_wallet' }},
            NOW()
          )
          ON CONFLICT (profile_id, address) DO UPDATE
          SET
            is_primary = EXCLUDED.is_primary,
            is_canonical_smart_wallet = EXCLUDED.is_canonical_smart_wallet,
            is_embedded_eoa = EXCLUDED.is_embedded_eoa,
            verified_at = NOW(),
            metadata = EXCLUDED.metadata,
            updated_at = NOW();
        `
        linksUpserted += 1
      }
    }

    if (!dryRun) {
      await db.sql`
        UPDATE profiles
        SET
          primary_smart_wallet = COALESCE(primary_smart_wallet, ${smart}),
          primary_embedded_eoa = COALESCE(primary_embedded_eoa, ${embedded}),
          updated_at = NOW()
        WHERE id = ${row.id};
      `
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        profilesScanned: rows.length,
        profilesTouched,
        smartBackfills,
        embeddedBackfills,
        walletsInserted: dryRun ? 'n/a' : walletsInserted,
        linksUpserted: dryRun ? 'n/a' : linksUpserted,
        duplicatePrivyUserIds: duplicateCount,
      },
      null,
      2,
    ),
  )
}

void main()
