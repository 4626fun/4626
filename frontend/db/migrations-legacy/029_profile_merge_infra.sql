-- Profile merge infrastructure. Introduces a many-to-one Privy-user → profile
-- mapping so that multiple Privy user ids can resolve to a single canonical
-- `profiles` row. Required because Privy mints a new user per auth method
-- (email OTP, wallet login, social) without auto-linking them, producing split
-- identities for the same human.
--
-- AGENTS.md invariant: verified email is the canonical identity; non-email
-- Privy users that belong to the same human must be folded in rather than
-- treated as separate accounts.
--
-- Additive and backwards-compatible:
-- - `privy_user_aliases` becomes the authoritative Privy→profile map.
-- - Existing `profiles.privy_user_id` rows are seeded into the alias table
--   so resolver reads stay consistent for users that existed pre-migration.
-- - `profiles.merged_into_profile_id` tombstones a merged-away profile
--   without deleting it, preserving audit trail.
--
-- After a merge (performed by `executeProfileMerge` in profileMerge.ts):
-- - The "from" profile keeps `merged_into_profile_id = to.id` and its
--   `privy_user_id` is nulled (freeing the unique constraint for future
--   re-merges / seed-data corrections).
-- - The "from" profile's Privy user id lives in `privy_user_aliases` with
--   `profile_id = to.id`, so the existing Privy session on the merged-away
--   user continues to resolve to the canonical profile via the alias
--   cascade in `listProfileIdsForPrivyUser`.
--
-- Resolver contract: every profile lookup by privy_user_id or wallet MUST
-- chase `merged_into_profile_id`. See AGENTS.md for the tombstone-chasing
-- CTE pattern required in all new profile-lookup code.

CREATE TABLE IF NOT EXISTS public.privy_user_aliases (
  privy_user_id TEXT PRIMARY KEY,
  profile_id    BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source        TEXT NOT NULL DEFAULT 'signup',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privy_user_aliases_profile_idx
  ON public.privy_user_aliases (profile_id);

-- Seed the alias table from existing `profiles.privy_user_id` rows so the
-- resolver's fast path works for users that existed before this migration.
-- `ON CONFLICT DO NOTHING` makes this idempotent under re-apply.
INSERT INTO public.privy_user_aliases (privy_user_id, profile_id, source)
SELECT privy_user_id, id, 'signup'
FROM public.profiles
WHERE privy_user_id IS NOT NULL AND privy_user_id <> ''
ON CONFLICT (privy_user_id) DO NOTHING;

-- Tombstone column. Rather than deleting merged-away rows, point them at
-- their canonical target so forensic queries (diagnose-identity.ts,
-- diagnose-splits.ts) stay intact.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS merged_into_profile_id BIGINT NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_merged_into_idx
  ON public.profiles (merged_into_profile_id)
  WHERE merged_into_profile_id IS NOT NULL;

-- RLS: server connects as `postgres` via the Supabase pooler and bypasses
-- RLS; `anon` / `authenticated` default-deny with no permissive policies.
-- An explicit restrictive deny-all policy is added in migration 031.
ALTER TABLE public.privy_user_aliases ENABLE ROW LEVEL SECURITY;
