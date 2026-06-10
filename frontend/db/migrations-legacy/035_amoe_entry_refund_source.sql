-- Migration: Add `amoe_entry_refund` source + `amoe_burn_credits_intents`
-- table to support the orphan-burn refund cron (PR 6c).
--
-- Two changes are bundled because they're co-dependent: the refund cron
-- only emits a refund when an intent row exists, and the intent row is
-- only written by the burn-credits endpoint that PR 6b introduced.
--
-- 1. Adds an `amoe_entry_refund` arm to `points_amoe_eligible_balance`
--    so a compensating row actually restores the user's eligible balance.
-- 2. Adds a new `amoe_burn_credits_intents` table that the burn-credits
--    handler writes a row into immediately after the points debit. The
--    refund cron requires an intent row to exist before it will emit a
--    refund, which scopes the cron strictly to phase-A burns from the
--    new burn-credits endpoint and excludes legacy debits from the
--    older `/api/v1/lottery/amoe/submit` handler that share the same
--    `source='amoe_entry_spend'`.
--
-- Motivation
-- ----------
-- PR 6b split the AMOE submit flow into phase A (`burn-credits`) and
-- phase B (`submit-zk`). When phase A succeeds but the user never
-- completes phase B (closed browser, lost connection, gave up), the
-- debit row in `points` (`source='amoe_entry_spend'`, negative amount)
-- remains and the user's AMOE balance is permanently reduced — even
-- though no lottery entry was ever submitted on chain.
--
-- PR 6c introduces a refund cron (`_amoeBurnRefundCron.ts`) that walks
-- such orphan burns past a TTL (`REFUND_AGE_EPOCHS`) and writes a
-- compensating positive row into `points` with `source='amoe_entry_refund'`,
-- using the same `source_id` (= original `spend_ref_id`) so the existing
-- `points_unique_source_full` UNIQUE index makes the refund
-- INSERT idempotent.
--
-- Why scope by intent (not just `source='amoe_entry_spend'`)
-- ----------------------------------------------------------
-- The legacy `/api/v1/lottery/amoe/submit` endpoint also writes
-- `amoe_entry_spend` debit rows via `consumeAmoeCreditsForEntry`, but
-- those are tied to a successful relay — the entry already happened
-- on chain, no refund is owed. Legacy submits never write
-- `amoe_zk_submissions` rows, so we cannot disambiguate by the
-- presence of a settled submission. We need an explicit forward
-- marker that says "this burn came from the burn-credits endpoint
-- and is therefore eligible for orphan-refund". `amoe_burn_credits_intents`
-- is that marker.
--
-- L1-projector interaction
-- ------------------------
-- The publisher's L0 → L1 projector
-- (`server/_lib/lottery/amoeLedgerProjector.ts:316-317`) filters
-- `amount < 0` when building Merkle leaves for the on-chain ledger
-- root. Refund rows have `amount > 0` and therefore CANNOT enter the
-- L1 ledger, the L2 snapshot, or the on-chain root — by construction
-- the refund cannot retroactively forge a ledger leaf. The refund only
-- affects the off-chain `points_amoe_eligible_balance` view used to
-- gate phase A.
--
-- Idempotency
-- -----------
-- The `points` table already has two unique indexes covering
-- `(signup_id, source, source_id)` (`points_unique_source_full` and the
-- partial `points_unique_source` for `source_id IS NOT NULL`). The
-- refund cron uses `INSERT ... ON CONFLICT DO NOTHING` against those
-- existing indexes — no new index needed.
--
-- This migration is byte-for-byte identical to its sibling:
--   `supabase/migrations/20260430190000_amoe_entry_refund_source.sql`.
-- Keep them in lockstep.

-- ---------------------------------------------------------------------------
-- 1. Eligibility view — add `amoe_entry_refund` arm
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.points_amoe_eligible_balance AS
SELECT
  signup_id,
  COALESCE(
    ROUND(
      SUM(
        CASE
          -- AMOE-internal sources (debit ledger + free-action awards
          -- + compensating refunds for orphan phase-A burns).
          WHEN source = 'amoe_entry_spend'    THEN amount
          WHEN source = 'amoe_entry_refund'   THEN amount
          WHEN source = 'amoe_twitter_daily'  THEN amount * 1.00
          WHEN source = 'amoe_checkin'        THEN amount * 1.00

          -- Free identity / signup actions.
          WHEN source = 'waitlist_signup'     THEN amount * 1.00
          WHEN source = 'csw_link'            THEN amount * 1.00
          WHEN source = 'resolve_csw'         THEN amount * 0.60

          -- Free social / engagement actions.
          WHEN source LIKE 'social_%'         THEN amount * 0.50
          WHEN source LIKE 'bonus_%'          THEN amount * 0.30
          WHEN source = 'task'                THEN amount * 0.30

          -- Free agent / proof-of-personhood actions.
          WHEN source IN (
            'agent_feedback',
            'agent_reputation',
            'lens_identity',
            'grove_proof'
          )                                    THEN amount * 0.40

          -- Free identity-link actions. The wallets / accounts being linked
          -- may themselves hold tokens, but the link event is a free
          -- identity proof, not a value proof. See audit doc rationale.
          WHEN source IN (
            'link_email',
            'link_google',
            'link_apple',
            'link_telegram',
            'link_tiktok',
            'link_twitter',
            'link_external_eoa',
            'link_zora'
          )                                    THEN amount * 0.60

          -- DELIBERATELY EXCLUDED — fall-through to zero contribution:
          --   * has_creator_coin (paid action: requires capital to hold
          --     a creator coin)
          --   * referral_passthrough (mirrors arbitrary upstream
          --     source including paid actions)
          --   * referral_signup / referral_csw_link / referral_qualified
          --     (deprecated; same taint risk)
          --
          -- Any source not listed above contributes 0 — fail-closed default
          -- so adding a new earning action forces an explicit AMOE-
          -- eligibility decision.
          ELSE 0
        END
      )
    ),
    0
  )::bigint AS credits
FROM public.points
GROUP BY signup_id;

COMMENT ON VIEW public.points_amoe_eligible_balance IS
  'Per-signup sum of points-ledger rows whose source is on the AMOE free-action allowlist. Used by consumeAmoeCreditsForEntry to gate free lottery entries. Excludes paid-action sources (has_creator_coin) and tainted sources (referral_passthrough, deprecated referral_*). The amoe_entry_refund source is the compensating credit written by the PR 6c refund cron for orphan phase-A burns. See docs/security/amoe-points-source-audit.md and docs/security/amoe-burn-then-submit-design.md §5.1.';

-- ---------------------------------------------------------------------------
-- 2. Burn-credits intents — forward marker for orphan-refund eligibility
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.amoe_burn_credits_intents (
  signup_id     BIGINT      NOT NULL,
  spend_ref_id  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (signup_id, spend_ref_id)
);

COMMENT ON TABLE public.amoe_burn_credits_intents IS
  'Forward marker written by the burn-credits handler (PR 6b) one row per (signup_id, spend_ref_id) immediately after the points debit. The refund cron (PR 6c) requires a matching intent row before emitting a refund. This scopes the cron strictly to phase-A burns from the new burn-credits endpoint and excludes legacy debits from /api/v1/lottery/amoe/submit that share the same points source. See docs/security/amoe-burn-then-submit-design.md §5.1.';
