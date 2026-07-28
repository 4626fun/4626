-- Enable room 1659 creator-coin access policy for read-only coin holders.
-- Enter/exit thresholds use the live Sudoswap buy quote (100% enter / 90% exit).
-- Write remains FriendKey-only in application code.

BEGIN;

INSERT INTO alfaclub.room_access_policies (
  room_id,
  token_id,
  creator_coin_address,
  pool_address,
  key_amount_raw,
  enter_threshold_bps,
  exit_threshold_bps,
  grace_hours,
  enabled,
  updated_at
) VALUES (
  '1659',
  '1659',
  '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  '0x4a1bd15948a6a61dbe5dfd1e57d5982fd1285766',
  1,
  10000,
  9000,
  24,
  TRUE,
  NOW()
)
ON CONFLICT (room_id) DO UPDATE SET
  token_id = EXCLUDED.token_id,
  creator_coin_address = EXCLUDED.creator_coin_address,
  pool_address = EXCLUDED.pool_address,
  key_amount_raw = EXCLUDED.key_amount_raw,
  enter_threshold_bps = EXCLUDED.enter_threshold_bps,
  exit_threshold_bps = EXCLUDED.exit_threshold_bps,
  grace_hours = EXCLUDED.grace_hours,
  enabled = TRUE,
  updated_at = NOW();

COMMENT ON TABLE alfaclub.room_access_policies IS
  'Creator-coin buy-quote thresholds for room chat read access. Write stays FriendKey-only in app code; XMTP sync is FriendKey-gated.';

COMMIT;
