-- Profile merge infrastructure.
--
-- Introduces a many-to-one Privy-user → profile mapping so that multiple
-- Privy user ids can resolve to a single canonical `profiles` row. Required
-- because Privy mints a new user per auth method (email OTP, wallet login,
-- social) without auto-linking them, which produces split identities for
-- the same human (see `AGENTS.md` → "Account and auth invariants": verified
-- email is the canonical identity; non-email Privy users that belong to
-- the same human must be folded in rather than treated as separate accounts).
--
-- Additive and backwards-compatible:
--   1. `privy_user_aliases` becomes the authoritative Privy→profile map.
--   2. Existing `profiles.privy_user_id` rows are seeded into the alias
--      table on migration so resolver reads stay consistent.
--   3. `profiles.merged_into_profile_id` tombstones a profile without
--      deleting it, preserving audit trail for the merge.
--
-- After a merge:
--   - The "from" profile keeps `merged_into_profile_id = to.id` and its
--     `privy_user_id` is nulled (freeing the unique constraint).
--   - The "from" profile's Privy user id lives in `privy_user_aliases` with
--     `profile_id = to.id`, so the existing Privy session on the merged
--     user continues to resolve to the canonical profile.

CREATE TABLE IF NOT EXISTS public.privy_user_aliases (
  privy_user_id TEXT PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'signup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS privy_user_aliases_profile_idx
  ON public.privy_user_aliases (profile_id);

-- Seed the alias table from existing `profiles.privy_user_id` rows so
-- behavior for non-merged users is unchanged. ON CONFLICT handles reruns.
INSERT INTO public.privy_user_aliases (privy_user_id, profile_id, source)
SELECT privy_user_id, id, 'signup'
FROM public.profiles
WHERE privy_user_id IS NOT NULL AND privy_user_id <> ''
ON CONFLICT (privy_user_id) DO NOTHING;

-- Tombstone column. Rather than deleting merged-away rows, point them at
-- their canonical target so forensic queries stay intact.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS merged_into_profile_id BIGINT NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_merged_into_idx
  ON public.profiles (merged_into_profile_id)
  WHERE merged_into_profile_id IS NOT NULL;
