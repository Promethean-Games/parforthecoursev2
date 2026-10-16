-- Google Play billing entitlements (ported from server/db.ts initializeDatabase()).
-- REVIEW ONLY: not applied. Only the billing Edge Function (service_role) may touch these objects.
-- Functions use an empty search_path, so every object is schema-qualified.

-- ---------------------------------------------------------------------------
-- Product allowlist and product -> entitlement mapping (single source of truth in SQL;
-- the Edge Function carries the same six IDs and a test keeps them aligned).
-- ---------------------------------------------------------------------------
create or replace function public.billing_grant_for_product(p_product_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_product_id
    when 'google_play_product_classic'    then 'classic'
    when 'google_play_product_reracked'   then 'reracked'
    when 'google_play_product_sequential' then 'sequential'
    when 'google_play_product_tournament' then 'tournament'
    when 'google_play_product_teedoff'    then 'teed-off'
    when 'google_play_product_bundle'     then 'all'
    else null
  end
$$;

-- ---------------------------------------------------------------------------
-- Entitlements (one row per device; same columns and trial semantics as before)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_entitlements (
  device_id            text primary key
                       constraint billing_entitlements_device_id_len
                       check (char_length(device_id) between 1 and 200),
  platform             text        not null default 'google',
  trial_started_at     timestamptz not null default now(),
  trial_ends_at        timestamptz not null,
  is_purchased         boolean     not null default false,
  unlock_all_digital   boolean     not null default false,
  edition_entitlements jsonb       not null default '{}'::jsonb,
  purchase_token       text,
  product_id           text,
  package_name         text,
  purchase_state       integer,
  play_payload         jsonb       not null default '{}'::jsonb,
  apple_transaction_id text,
  apple_bundle_id      text,
  apple_payload        jsonb       not null default '{}'::jsonb,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Purchase-token ownership: a token is bound to exactly one device at a time.
-- This is the authority for what a device has bought; entitlements are derived from it.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_purchase_tokens (
  purchase_token text primary key
                 constraint billing_purchase_tokens_token_len
                 check (char_length(purchase_token) between 1 and 4096),
  device_id      text        not null
                 references public.billing_entitlements (device_id) on delete cascade,
  package_name   text        not null,
  product_id     text        not null
                 constraint billing_purchase_tokens_product_allowlist
                 check (public.billing_grant_for_product(product_id) is not null),
  grant_target   text        not null,
  purchase_state integer     not null,
  play_payload   jsonb       not null default '{}'::jsonb,
  rebind_count   integer     not null default 0,
  first_bound_at timestamptz not null default now(),
  bound_at       timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists billing_purchase_tokens_device_idx
  on public.billing_purchase_tokens (device_id);

-- RLS on with no policies: anon/authenticated can never read or write rows.
alter table public.billing_entitlements enable row level security;
alter table public.billing_purchase_tokens enable row level security;
revoke all on table public.billing_entitlements from anon, authenticated;
revoke all on table public.billing_purchase_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mirrors getOrCreateEntitlement(): starts the free trial on first sight of a device.
-- ---------------------------------------------------------------------------
create or replace function public.billing_get_or_create_entitlement(
  p_device_id  text,
  p_trial_days integer default 30
) returns public.billing_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.billing_entitlements;
begin
  select * into r from public.billing_entitlements where device_id = p_device_id limit 1;
  if found then
    return r;
  end if;

  insert into public.billing_entitlements
    (device_id, trial_started_at, trial_ends_at, is_purchased, updated_at)
  values
    (p_device_id, now(), now() + make_interval(days => p_trial_days), false, now())
  on conflict (device_id) do update
    set updated_at = excluded.updated_at
  returning * into r;

  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Derives a device's entitlements from the active (purchase_state = 0) tokens it owns.
-- Internal helper; called only from billing_record_play_verification.
-- ---------------------------------------------------------------------------
create or replace function public.billing_recompute_entitlements(p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_all boolean;
  v_map jsonb;
begin
  select coalesce(bool_or(grant_target = 'all'), false)
    into v_all
    from public.billing_purchase_tokens
   where device_id = p_device_id and purchase_state = 0;

  select jsonb_build_object(
    'classic',    v_all or coalesce(bool_or(grant_target = 'classic'), false),
    'reracked',   v_all or coalesce(bool_or(grant_target = 'reracked'), false),
    'sequential', v_all or coalesce(bool_or(grant_target = 'sequential'), false),
    'teed-off',   v_all or coalesce(bool_or(grant_target = 'teed-off'), false),
    'tournament', v_all or coalesce(bool_or(grant_target = 'tournament'), false)
  )
    into v_map
    from public.billing_purchase_tokens
   where device_id = p_device_id and purchase_state = 0;

  update public.billing_entitlements
     set unlock_all_digital   = v_all,
         is_purchased         = v_all,
         edition_entitlements = v_map,
         updated_at           = now()
   where device_id = p_device_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Records a Google-verified purchase. Replaces the upsert in POST /google-play/verify.
--  * Only allowlisted products are accepted (the bundle maps to unlock-all).
--  * A token is bound to one device. A purchased token presented by a different device is
--    moved to it (restore after reinstall / new device id) and the previous device loses
--    that grant. A non-purchased token never steals ownership.
--  * Verifications are serialized so entitlement recomputation cannot race.
-- ---------------------------------------------------------------------------
create or replace function public.billing_record_play_verification(
  p_device_id      text,
  p_purchase_token text,
  p_product_id     text,
  p_package_name   text,
  p_purchase_state integer,
  p_play_payload   jsonb,
  p_trial_days     integer default 30
) returns public.billing_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant    text;
  v_existing public.billing_purchase_tokens;
  r          public.billing_entitlements;
begin
  v_grant := public.billing_grant_for_product(p_product_id);
  if v_grant is null then
    raise exception 'unsupported product' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('billing_record_play_verification'));

  perform public.billing_get_or_create_entitlement(p_device_id, p_trial_days);

  select * into v_existing
    from public.billing_purchase_tokens
   where purchase_token = p_purchase_token;

  if not found then
    insert into public.billing_purchase_tokens
      (purchase_token, device_id, package_name, product_id, grant_target,
       purchase_state, play_payload)
    values
      (p_purchase_token, p_device_id, p_package_name, p_product_id, v_grant,
       p_purchase_state, coalesce(p_play_payload, '{}'::jsonb));
  elsif v_existing.device_id = p_device_id then
    update public.billing_purchase_tokens
       set package_name   = p_package_name,
           product_id     = p_product_id,
           grant_target   = v_grant,
           purchase_state = p_purchase_state,
           play_payload   = coalesce(p_play_payload, '{}'::jsonb),
           updated_at     = now()
     where purchase_token = p_purchase_token;
  elsif p_purchase_state = 0 then
    update public.billing_purchase_tokens
       set device_id      = p_device_id,
           package_name   = p_package_name,
           product_id     = p_product_id,
           grant_target   = v_grant,
           purchase_state = p_purchase_state,
           play_payload   = coalesce(p_play_payload, '{}'::jsonb),
           rebind_count   = rebind_count + 1,
           bound_at       = now(),
           updated_at     = now()
     where purchase_token = p_purchase_token;
    perform public.billing_recompute_entitlements(v_existing.device_id);
  end if;

  perform public.billing_recompute_entitlements(p_device_id);

  select * into r from public.billing_entitlements where device_id = p_device_id;
  return r;
end;
$$;

revoke all on function public.billing_grant_for_product(text) from public;
revoke all on function public.billing_get_or_create_entitlement(text, integer) from public, anon, authenticated;
revoke all on function public.billing_recompute_entitlements(text) from public, anon, authenticated;
revoke all on function public.billing_record_play_verification(text, text, text, text, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.billing_grant_for_product(text) to service_role;
grant execute on function public.billing_get_or_create_entitlement(text, integer) to service_role;
grant execute on function public.billing_record_play_verification(text, text, text, text, integer, jsonb, integer) to service_role;
