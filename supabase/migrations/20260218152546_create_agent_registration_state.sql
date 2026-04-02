create table if not exists public.agent_registration_state (
  agent_key text primary key,
  payload_hash text not null,
  lens_uri text not null,
  gateway_url text,
  updated_at timestamptz not null default now()
);

create index if not exists agent_registration_state_updated_idx
  on public.agent_registration_state (updated_at desc);;
