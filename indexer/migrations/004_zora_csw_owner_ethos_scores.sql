-- Cache Ethos scores for per-owner Zora CSW outreach profiles.

alter table public.zora_csw_owner_class
  add column if not exists ethos_userkey text,
  add column if not exists ethos_score numeric,
  add column if not exists ethos_level text,
  add column if not exists ethos_score_updated_at timestamptz;

create index if not exists idx_zora_csw_owner_class_ethos_score
  on public.zora_csw_owner_class (ethos_score desc nulls last, last_updated_at desc);

create index if not exists idx_zora_csw_owner_class_ethos_stale
  on public.zora_csw_owner_class (ethos_score_updated_at asc nulls first)
  where ethos_userkey is not null;

comment on column public.zora_csw_owner_class.ethos_userkey is
  'Ethos userkey used for the cached score, typically address:<lowercase_eoa>.';

comment on column public.zora_csw_owner_class.ethos_score is
  'Cached Ethos credibility score for this owner EOA. Null means unchecked or no score.';

comment on column public.zora_csw_owner_class.ethos_level is
  'Cached Ethos credibility level label returned by Ethos.';

comment on column public.zora_csw_owner_class.ethos_score_updated_at is
  'When the cached Ethos score/level was last refreshed.';
