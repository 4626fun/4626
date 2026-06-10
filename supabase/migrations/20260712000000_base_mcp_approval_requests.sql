-- Base MCP human-approval requests (durable store for the approval flow).
-- Previously created at runtime via raw CREATE TABLE in
-- frontend/server/_lib/agents/base-mcp/approvalFlow.ts (audit finding H-5);
-- DDL now lives here and runtime bootstrap delegates through schemaBootstrap.

CREATE TABLE IF NOT EXISTS public.base_mcp_approval_requests (
  request_id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL,
  approval_url TEXT NOT NULL,
  user_id TEXT NOT NULL,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('canonical', 'eoa')),
  sender TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS base_mcp_approval_requests_status_expires_idx
  ON public.base_mcp_approval_requests (status, expires_at);

-- Server-only table: enable RLS and deny all PostgREST access.
ALTER TABLE public.base_mcp_approval_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'base_mcp_approval_requests'
      AND policyname = 'deny_public_rest'
  ) THEN
    CREATE POLICY "deny_public_rest" ON public.base_mcp_approval_requests
      AS RESTRICTIVE FOR ALL TO public
      USING (false) WITH CHECK (false);
  END IF;
END $$;
