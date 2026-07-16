-- Canonical waitlist point totals (PERF-3).
-- Matches frontend/server/_lib/onboarding/waitlistScoring.ts WAITLIST_POINTS_WEIGHT_CASE_SQL.
-- Leaderboard / position / Airtable sync join this view instead of repeating the CASE CTE.

CREATE OR REPLACE VIEW public.waitlist_point_totals AS
SELECT
  signup_id,
  COALESCE(
    ROUND(
      SUM(
        CASE
          WHEN source IN ('amoe_entry_spend', 'amoe_twitter_daily', 'amoe_xmtp_daily', 'amoe_entry_refund') THEN 0
          WHEN source IN ('waitlist_signup', 'referral_passthrough', 'csw_link', 'amoe_checkin') THEN amount * 1.00
          WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
          WHEN source LIKE 'social_%' OR source LIKE 'x_engagement_%' THEN amount * 0.50
          WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
          WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
          WHEN source IN (
            'link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram',
            'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin'
          ) THEN amount * 0.60
          ELSE 0
        END
      )
    ),
    0
  )::int AS points_total
FROM public.points
GROUP BY signup_id;

ALTER VIEW public.waitlist_point_totals SET (security_invoker = true);

REVOKE ALL ON TABLE public.waitlist_point_totals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.waitlist_point_totals TO service_role;
