-- Drop legacy miniapp notifications table.
-- This table is no longer referenced by runtime code paths.

DO $$
BEGIN
  IF to_regclass('public.miniapp_notifications') IS NULL THEN
    RETURN;
  END IF;

  DROP TABLE public.miniapp_notifications;
END
$$;
