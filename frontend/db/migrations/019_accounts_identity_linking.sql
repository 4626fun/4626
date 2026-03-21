-- Phase 9: thin waitlist + dedicated /accounts identity storage.
-- Canonical internal account key is Privy user id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.accounts (
  privy_user_id TEXT PRIMARY KEY,
  email TEXT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_linked_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT NOT NULL REFERENCES public.accounts(privy_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (privy_user_id, type, value)
);

CREATE INDEX IF NOT EXISTS account_linked_methods_type_value_idx
  ON public.account_linked_methods (type, value);

CREATE TABLE IF NOT EXISTS public.account_zora_signals (
  privy_user_id TEXT PRIMARY KEY REFERENCES public.accounts(privy_user_id) ON DELETE CASCADE,
  zora_linked BOOLEAN NOT NULL DEFAULT false,
  zora_handle TEXT NULL,
  canonical_csw_address TEXT NULL,
  creator_coin_address TEXT NULL,
  last_resolved_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_points (
  privy_user_id TEXT PRIMARY KEY REFERENCES public.accounts(privy_user_id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  tier INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT NOT NULL REFERENCES public.accounts(privy_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (privy_user_id, event_key)
);

CREATE INDEX IF NOT EXISTS account_point_events_privy_created_idx
  ON public.account_point_events (privy_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_privy_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'privy_user_id'), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')
  );
$$;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_linked_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_zora_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_point_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_select_own'
  ) THEN
    CREATE POLICY accounts_select_own
      ON public.accounts FOR SELECT TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_insert_own'
  ) THEN
    CREATE POLICY accounts_insert_own
      ON public.accounts FOR INSERT TO public
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_update_own'
  ) THEN
    CREATE POLICY accounts_update_own
      ON public.accounts FOR UPDATE TO public
      USING (privy_user_id = public.current_privy_user_id())
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_delete_own'
  ) THEN
    CREATE POLICY accounts_delete_own
      ON public.accounts FOR DELETE TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_linked_methods' AND policyname = 'account_linked_methods_select_own'
  ) THEN
    CREATE POLICY account_linked_methods_select_own
      ON public.account_linked_methods FOR SELECT TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_linked_methods' AND policyname = 'account_linked_methods_insert_own'
  ) THEN
    CREATE POLICY account_linked_methods_insert_own
      ON public.account_linked_methods FOR INSERT TO public
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_linked_methods' AND policyname = 'account_linked_methods_update_own'
  ) THEN
    CREATE POLICY account_linked_methods_update_own
      ON public.account_linked_methods FOR UPDATE TO public
      USING (privy_user_id = public.current_privy_user_id())
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_linked_methods' AND policyname = 'account_linked_methods_delete_own'
  ) THEN
    CREATE POLICY account_linked_methods_delete_own
      ON public.account_linked_methods FOR DELETE TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_zora_signals' AND policyname = 'account_zora_signals_select_own'
  ) THEN
    CREATE POLICY account_zora_signals_select_own
      ON public.account_zora_signals FOR SELECT TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_zora_signals' AND policyname = 'account_zora_signals_insert_own'
  ) THEN
    CREATE POLICY account_zora_signals_insert_own
      ON public.account_zora_signals FOR INSERT TO public
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_zora_signals' AND policyname = 'account_zora_signals_update_own'
  ) THEN
    CREATE POLICY account_zora_signals_update_own
      ON public.account_zora_signals FOR UPDATE TO public
      USING (privy_user_id = public.current_privy_user_id())
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_zora_signals' AND policyname = 'account_zora_signals_delete_own'
  ) THEN
    CREATE POLICY account_zora_signals_delete_own
      ON public.account_zora_signals FOR DELETE TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_points' AND policyname = 'account_points_select_own'
  ) THEN
    CREATE POLICY account_points_select_own
      ON public.account_points FOR SELECT TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_points' AND policyname = 'account_points_insert_own'
  ) THEN
    CREATE POLICY account_points_insert_own
      ON public.account_points FOR INSERT TO public
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_points' AND policyname = 'account_points_update_own'
  ) THEN
    CREATE POLICY account_points_update_own
      ON public.account_points FOR UPDATE TO public
      USING (privy_user_id = public.current_privy_user_id())
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_points' AND policyname = 'account_points_delete_own'
  ) THEN
    CREATE POLICY account_points_delete_own
      ON public.account_points FOR DELETE TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_point_events' AND policyname = 'account_point_events_select_own'
  ) THEN
    CREATE POLICY account_point_events_select_own
      ON public.account_point_events FOR SELECT TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_point_events' AND policyname = 'account_point_events_insert_own'
  ) THEN
    CREATE POLICY account_point_events_insert_own
      ON public.account_point_events FOR INSERT TO public
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_point_events' AND policyname = 'account_point_events_update_own'
  ) THEN
    CREATE POLICY account_point_events_update_own
      ON public.account_point_events FOR UPDATE TO public
      USING (privy_user_id = public.current_privy_user_id())
      WITH CHECK (privy_user_id = public.current_privy_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_point_events' AND policyname = 'account_point_events_delete_own'
  ) THEN
    CREATE POLICY account_point_events_delete_own
      ON public.account_point_events FOR DELETE TO public
      USING (privy_user_id = public.current_privy_user_id());
  END IF;
END
$$;
