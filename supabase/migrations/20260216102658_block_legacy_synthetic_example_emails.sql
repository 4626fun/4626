alter table public.profiles
  add constraint profiles_email_not_legacy_synthetic_chk
  check (
    email is null
    or lower(email) !~ '^(solinfer-|wallet-|anon-|0x[0-9a-f]+).*@example\.com$'
  );;
