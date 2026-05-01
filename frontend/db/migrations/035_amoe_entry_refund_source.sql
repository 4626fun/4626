-- Migration: Add `amoe_entry_refund` source to the AMOE-eligibility view.
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
-- The compensation row only restores the user's eligible balance if the
-- AMOE-eligibility view's CASE statement actually counts it. Today the
-- view (introduced by `20260427180000_amoe_eligible_points_view.sql`)
-- only matches `amoe_entry_spend` for AMOE-internal sources, so a new
-- `amoe_entry_refund` row would fall through the `ELSE 0` arm and have
-- no effect on the eligible-balance calculation. This migration adds
-- the missing CASE arm.
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
