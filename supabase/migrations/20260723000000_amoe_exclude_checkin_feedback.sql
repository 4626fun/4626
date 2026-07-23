-- Keep waitlist-facing AMOE check-in awards out of the spendable AMOE
-- lottery-credit balance. Only the underlying verified daily action earns
-- lottery credit; otherwise the mirrored waitlist award creates a feedback
-- loop into additional entries.
CREATE OR REPLACE VIEW public.points_amoe_eligible_balance
WITH (security_invoker = true) AS
SELECT
  signup_id,
  COALESCE(
    ROUND(
      SUM(
        CASE
          WHEN source = 'amoe_entry_spend'    THEN amount
          WHEN source = 'amoe_entry_refund'   THEN amount
          WHEN source = 'amoe_twitter_daily'  THEN amount * 1.00
          WHEN source = 'amoe_xmtp_daily'     THEN amount * 1.00
          WHEN source = 'waitlist_signup'     THEN amount * 1.00
          WHEN source = 'csw_link'            THEN amount * 1.00
          WHEN source = 'resolve_csw'          THEN amount * 0.60
          WHEN source LIKE 'social_%'          THEN amount * 0.50
          WHEN source LIKE 'bonus_%'           THEN amount * 0.30
          WHEN source = 'task'                 THEN amount * 0.30
          WHEN source IN (
            'agent_feedback',
            'agent_reputation',
            'lens_identity',
            'grove_proof'
          )                                    THEN amount * 0.40
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
          ELSE 0
        END
      )
    ),
    0
  )::bigint AS credits
FROM public.points
GROUP BY signup_id;

COMMENT ON VIEW public.points_amoe_eligible_balance IS
  'Strict AMOE lottery-credit allowlist. amoe_checkin is waitlist-only and intentionally excluded.';
