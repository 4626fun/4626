alter table if exists public.agent_registration_state
  add column if not exists storage_key text;;
