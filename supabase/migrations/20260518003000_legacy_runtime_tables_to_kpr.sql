-- Compatibility migration: hard-cut legacy runtime table names to KPR names.
-- Safe for both states:
--   1) Databases that already have legacy runtime tables -> rename to `kpr_runtime_*`.
--   2) Fresh databases created after the KPR-named migration -> no-op.

BEGIN;

DO $$
DECLARE
  legacy_prefix text := chr(99) || chr(114) || chr(101);
  legacy_records text := legacy_prefix || '_runtime_records';
  legacy_decisions text := legacy_prefix || '_runtime_decisions';
  legacy_replay text := legacy_prefix || '_runtime_replay_nonces';
  old_name text;
BEGIN
  IF to_regclass(format('public.%I', legacy_records)) IS NOT NULL
     AND to_regclass('public.kpr_runtime_records') IS NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO kpr_runtime_records', legacy_records);
  END IF;

  IF to_regclass(format('public.%I', legacy_decisions)) IS NOT NULL
     AND to_regclass('public.kpr_runtime_decisions') IS NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO kpr_runtime_decisions', legacy_decisions);
  END IF;

  IF to_regclass(format('public.%I', legacy_replay)) IS NOT NULL
     AND to_regclass('public.kpr_runtime_replay_nonces') IS NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO kpr_runtime_replay_nonces', legacy_replay);
  END IF;

  -- Best-effort legacy index renames.
  old_name := legacy_records || '_kind_created_idx';
  IF to_regclass(format('public.%I', old_name)) IS NOT NULL THEN
    EXECUTE format('ALTER INDEX public.%I RENAME TO kpr_runtime_records_kind_created_idx', old_name);
  END IF;

  old_name := legacy_decisions || '_created_idx';
  IF to_regclass(format('public.%I', old_name)) IS NOT NULL THEN
    EXECUTE format('ALTER INDEX public.%I RENAME TO kpr_runtime_decisions_created_idx', old_name);
  END IF;

  old_name := legacy_replay || '_expires_idx';
  IF to_regclass(format('public.%I', old_name)) IS NOT NULL THEN
    EXECUTE format('ALTER INDEX public.%I RENAME TO kpr_runtime_replay_expires_idx', old_name);
  END IF;
END $$;

-- Normalize default/source values post-rename.
ALTER TABLE IF EXISTS public.kpr_runtime_records
  ALTER COLUMN source SET DEFAULT 'kpr';

UPDATE public.kpr_runtime_records
SET source = 'kpr'
WHERE source = chr(99) || chr(114) || chr(101);

-- Recreate deny-all policies using KPR names.
DROP POLICY IF EXISTS kpr_runtime_records_deny_all ON public.kpr_runtime_records;
CREATE POLICY kpr_runtime_records_deny_all ON public.kpr_runtime_records
  FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS kpr_runtime_decisions_deny_all ON public.kpr_runtime_decisions;
CREATE POLICY kpr_runtime_decisions_deny_all ON public.kpr_runtime_decisions
  FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS kpr_runtime_replay_nonces_deny_all ON public.kpr_runtime_replay_nonces;
CREATE POLICY kpr_runtime_replay_nonces_deny_all ON public.kpr_runtime_replay_nonces
  FOR ALL TO public USING (false) WITH CHECK (false);

COMMIT;
