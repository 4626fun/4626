ALTER TABLE public.lottery_amoe_daily_xmtp_checkins
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS recipient_address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS lottery_amoe_daily_xmtp_message_id_unique
  ON public.lottery_amoe_daily_xmtp_checkins (message_id)
  WHERE message_id IS NOT NULL;
