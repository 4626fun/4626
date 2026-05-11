-- Migration: hard-normalize legacy point sources to AMOE-eligible model.
--
-- Purpose
-- -------
-- We now use AMOE-eligible credits as the canonical user-visible points total
-- across waitlist + swap surfaces. Historical `points` rows from excluded /
-- tainted sources can still leak into any legacy query that sums `points`
-- directly. This migration permanently removes those rows from the live ledger
-- so legacy read paths cannot drift from AMOE totals.
--
-- Sources removed from live `points`:
--   - has_creator_coin        (paid-action source)
--   - referral_passthrough    (tainted by upstream source mix)
--   - referral_signup         (legacy referral milestone)
--   - referral_csw_link       (legacy referral milestone)
--   - referral_qualified      (legacy referral milestone)
--
-- Safety
-- ------
-- Rows are copied into `points_normalization_archive` before deletion.
-- The archive is idempotent via PK/UNIQUE inherited from `points` and
-- `ON CONFLICT DO NOTHING`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.points_normalization_archive
(LIKE public.points INCLUDING ALL);

ALTER TABLE public.points_normalization_archive
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archive_reason TEXT NOT NULL DEFAULT 'amoe_hard_normalization_v1';

INSERT INTO public.points_normalization_archive
SELECT
  p.*,
  NOW() AS archived_at,
  'amoe_hard_normalization_v1'::text AS archive_reason
FROM public.points p
WHERE p.source IN (
  'has_creator_coin',
  'referral_passthrough',
  'referral_signup',
  'referral_csw_link',
  'referral_qualified'
)
ON CONFLICT DO NOTHING;

DELETE FROM public.points
WHERE source IN (
  'has_creator_coin',
  'referral_passthrough',
  'referral_signup',
  'referral_csw_link',
  'referral_qualified'
);

COMMIT;
