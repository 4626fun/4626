// Seeds projector context for burn-then-submit phase A burns.
//
// The ledger projector's default lookup joins `amoe_zk_submissions` for
// `(wallet_address, twitter_credit_nullifier_hex)`. Phase B only writes
// that row at `markProven` time — after the ledger snapshot must already
// be confirmed — so phase A must seed a stub row with the nullifier the
// witness will later prove.

import { getDb } from '../db/postgres.js'
import { ensureAmoeSchema } from '../db/schemaBootstrap.js'
import { deriveTwitterCreditNullifier, readAmoeSignupSalt } from './amoeIdentifiers.js'
import { AmoeServerError } from './lotteryAmoeErrors.js'

function fieldToHex32(value: bigint): `0x${string}` {
  if (value < 0n) {
    throw new AmoeServerError('amoe_field_negative')
  }
  return `0x${value.toString(16).padStart(64, '0')}` as `0x${string}`
}

export async function seedBurnProjectionContext(params: {
  signupId: number | bigint
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  burnEpoch: bigint | string | number
  spendRefId: string
  pointsBurned: number
  twitterHandle: string
}): Promise<void> {
  const db = await getDb()
  if (!db) return

  const signupId = BigInt(params.signupId)
  if (signupId <= 0n) {
    throw new AmoeServerError('amoe_signup_id_invalid')
  }
  const spendRefId = String(params.spendRefId ?? '').trim()
  if (spendRefId.length === 0) {
    throw new AmoeServerError('amoe_spend_ref_empty')
  }
  const burnEpoch = BigInt(params.burnEpoch)
  if (burnEpoch <= 0n) {
    throw new AmoeServerError('amoe_epoch_invalid')
  }

  const salt = readAmoeSignupSalt()
  const twitterCreditNullifier = deriveTwitterCreditNullifier({
    twitterHandle: params.twitterHandle,
    salt,
  })
  const twitterCreditNullifierHex = fieldToHex32(twitterCreditNullifier)

  await ensureAmoeSchema(db)
  await db.sql`
    INSERT INTO amoe_zk_submissions (
      signup_id,
      wallet_address,
      creator_coin,
      epoch,
      spend_ref_id,
      points_burned,
      twitter_credit_nullifier_hex,
      state
    )
    SELECT
      ${signupId.toString()}::bigint,
      ${params.wallet.toLowerCase()},
      ${params.creatorCoin.toLowerCase()},
      ${burnEpoch.toString()}::bigint,
      ${spendRefId},
      ${params.pointsBurned},
      ${twitterCreditNullifierHex},
      'pending'
    WHERE NOT EXISTS (
      SELECT 1
      FROM amoe_zk_submissions AS s
      WHERE s.signup_id = ${signupId.toString()}::bigint
        AND s.spend_ref_id = ${spendRefId}
        AND s.twitter_credit_nullifier_hex IS NOT NULL
    );
  `
}
