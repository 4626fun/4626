CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.waitlist_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('creator', 'builder', 'depositor', 'partner', 'other')),
  x_handle TEXT NULL,
  utm_source TEXT NULL,
  utm_medium TEXT NULL,
  utm_campaign TEXT NULL,
  utm_content TEXT NULL,
  utm_term TEXT NULL,
  referrer TEXT NULL,
  first_touch JSONB NOT NULL DEFAULT '{}'::jsonb,
  visitor_id TEXT NULL,
  session_id TEXT NULL,
  ip_country TEXT NULL,
  ip_hash TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  confirmed_at TIMESTAMPTZ NULL,
  CONSTRAINT waitlist_leads_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS waitlist_leads_created_at_idx
  ON public.waitlist_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS waitlist_leads_campaign_idx
  ON public.waitlist_leads (utm_source, utm_medium, utm_campaign, created_at DESC);

ALTER TABLE public.waitlist_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_leads_public_insert
  ON public.waitlist_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND role IN ('creator', 'builder', 'depositor', 'partner', 'other')
  );

CREATE TABLE IF NOT EXISTS public.website_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_name TEXT NOT NULL,
  session_id TEXT NULL,
  visitor_id TEXT NULL,
  path TEXT NOT NULL,
  referrer TEXT NULL,
  utm_source TEXT NULL,
  utm_medium TEXT NULL,
  utm_campaign TEXT NULL,
  utm_content TEXT NULL,
  utm_term TEXT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS website_events_created_at_idx
  ON public.website_events (created_at DESC);

CREATE INDEX IF NOT EXISTS website_events_name_created_at_idx
  ON public.website_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS website_events_campaign_idx
  ON public.website_events (utm_source, utm_medium, utm_campaign, created_at DESC);

ALTER TABLE public.website_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY website_events_public_insert
  ON public.website_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_name IS NOT NULL
    AND path IS NOT NULL
  );
