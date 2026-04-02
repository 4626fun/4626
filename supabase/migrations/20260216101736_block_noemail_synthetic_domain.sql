alter table public.profiles
  add constraint profiles_email_not_noemail_domain_chk
  check (
    email is null
    or lower(email) !~ '@noemail\.4626\.fun$'
  );;
