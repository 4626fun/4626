-- Migration: AMOE-eligibility view for the points ledger.
--
-- Bifurcates the `points` ledger into two semantic halves:
--
--   1. The existing weighted-balance computation
--      (`readUnifiedPointsForSignup` in `frontend/server/_lib/lottery/lotteryAmoe.ts`)
--      keeps powering the leaderboard, tier progression, and any UI surface
--      that shows the user "your points" — UNCHANGED by this migration.
--
--   2. A new view `points_amoe_eligible_balance` exposes a STRICT-allowlist
--      sum of only those rows that originate from no-purchase-necessary
--      actions. `consumeAmoeCreditsForEntry` reads from this view to
--      determine how many free lottery entries the user can buy.
--
-- Why this exists
-- ---------------
--
-- The 4626 lottery has a paid path (swap → on-chain VRF roll) and a free
-- path (AMOE — alternative method of entry). US sweepstakes law (federal +
-- state) requires the free path to be funded ONLY by no-purchase actions,
-- otherwise the "free" entry is just a coupon for a paid action and the
-- entire contest collapses into an illegal lottery.
--
-- Pre-this-migration the AMOE balance computation summed the entire
-- `points` table for a signup, including rows from sources that are paid-
-- action equivalents — most notably `has_creator_coin` (awarded for owning
-- a Zora creator coin, which requires capital allocation) and
-- `referral_passthrough` (mirrors 50% of any referee award, including
-- paid-action awards, into the referrer's ledger). That broke Option B's
-- compliance posture.
--
-- This view enforces the wall at the database level so no future code path
-- can accidentally credit an AMOE submission against paid-action points.
--
-- Design notes
-- ------------
--
-- * Plain VIEW, not MATERIALIZED — AMOE submission is a rare per-user
--   operation; live computation is fine and avoids refresh-cron complexity.
--
-- * The allowlist is positive, not negative. Adding a new
--   `WaitlistPointSource` going forward will produce ZERO contribution to
--   AMOE balance until the source is explicitly added here. This
--   fail-closed default is intentional: it forces a deliberate compliance
--   review for every new earning action.
--
-- * Excluded sources for explicit audit-trail reasons:
--     - `has_creator_coin`         — paid action (capital required)
--     - `referral_passthrough`     — tainted by upstream source
--     - `referral_signup`          — deprecated + same taint risk
--     - `referral_csw_link`        — deprecated + same taint risk
--     - `referral_qualified`       — deprecated + same taint risk
--
-- * Kept under a deliberate "borderline" exception, treated as identity
--   proofs not value proofs (rationale logged in
--   `docs/security/amoe-points-source-audit.md`):
--     - `link_zora`
--     - `link_external_eoa`
--
-- * Weights match `readUnifiedPointsForSignup` for sources that are kept,
--   so a user comparing the two numbers sees parity on the eligible
--   subset. The two views diverge ONLY on excluded sources.

CREATE OR REPLACE VIEW public.points_amoe_eligible_balance AS
SELECT
  signup_id,
  COALESCE(
    ROUND(
      SUM(
        CASE
          -- AMOE-internal sources (debit ledger + free-action awards).
          WHEN source = 'amoe_entry_spend'    THEN amount
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
  'Per-signup sum of points-ledger rows whose source is on the AMOE free-action allowlist. Used by consumeAmoeCreditsForEntry to gate free lottery entries. Excludes paid-action sources (has_creator_coin) and tainted sources (referral_passthrough, deprecated referral_*). See docs/security/amoe-points-source-audit.md.';
