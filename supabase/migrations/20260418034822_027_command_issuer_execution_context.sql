-- Architecture B Phase 2: canonical resolution for agent write execution.

CREATE TABLE IF NOT EXISTS public.command_issuer_execution_context (
  profile_id              BIGINT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  smart_wallet_address    TEXT NOT NULL,
  privy_owner_wallet_id   TEXT NOT NULL,
  owner_eoa_address       TEXT NOT NULL,
  owner_index             INTEGER NOT NULL DEFAULT 0,
  paymaster_policy        TEXT NOT NULL DEFAULT 'cdp_default',
  caps_version            INTEGER NOT NULL DEFAULT 1,
  per_tx_cap_wei          NUMERIC(78, 0) NOT NULL,
  daily_cap_wei           NUMERIC(78, 0) NOT NULL,
  provisioned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  provisioned_by          TEXT NULL,
  revoked_at              TIMESTAMPTZ NULL,
  revoked_reason          TEXT NULL,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_command_issuer_addresses_lowercase CHECK (
    smart_wallet_address = LOWER(smart_wallet_address)
    AND owner_eoa_address = LOWER(owner_eoa_address)
  ),
  CONSTRAINT ck_command_issuer_owner_index_nonneg CHECK (owner_index >= 0),
  CONSTRAINT ck_command_issuer_caps_positive CHECK (
    per_tx_cap_wei > 0 AND daily_cap_wei > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_command_issuer_exec_ctx_smart_wallet
  ON public.command_issuer_execution_context(smart_wallet_address);

CREATE INDEX IF NOT EXISTS idx_command_issuer_exec_ctx_active
  ON public.command_issuer_execution_context(profile_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.command_issuer_daily_spend (
  profile_id   BIGINT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ymd          DATE NOT NULL,
  spent_wei    NUMERIC(78, 0) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, ymd),
  CONSTRAINT ck_command_issuer_daily_spend_nonneg CHECK (spent_wei >= 0)
);

ALTER TABLE public.command_issuer_execution_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_issuer_daily_spend       ENABLE ROW LEVEL SECURITY;
