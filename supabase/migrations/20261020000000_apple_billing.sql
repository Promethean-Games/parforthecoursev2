-- Apple non-consumable billing records. Apply only after review and approval.
-- Google Play identifiers and purchase-token ownership are unchanged.

create or replace function public.billing_apple_grant_for_product(p_product_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_product_id
    when 'com.parforthecourse.app.edition.classic'    then 'classic'
    when 'com.parforthecourse.app.edition.reracked'   then 'reracked'
    when 'com.parforthecourse.app.edition.sequential' then 'sequential'
    when 'com.parforthecourse.app.edition.tournament' then 'tournament'
    when 'com.parforthecourse.app.edition.teedoff'    then 'teed-off'
    when 'com.parforthecourse.app.edition.bundle'     then 'all'
    else null
  end
$$;

create table if not exists public.billing_apple_transactions (
  environment            text        not null
                                   check (environment in ('Sandbox', 'Production')),
  original_transaction_id text       not null
                                   check (char_length(original_transaction_id) between 1 and 128),
  transaction_id         text        not null
                                   check (char_length(transaction_id) between 1 and 128),
  product_id             text        not null
                                   check (public.billing_apple_grant_for_product(product_id) is not null),
  bundle_id              text        not null
                                   check (bundle_id = 'com.parforthecourse.app'),
  purchase_date          timestamptz not null,
  revocation_date        timestamptz,
  revocation_reason      integer,
  signed_date            timestamptz not null,
  signed_transaction     jsonb       not null,
  first_verified_at      timestamptz not null default now(),
  last_verified_at       timestamptz not null default now(),
  primary key (environment, original_transaction_id),
  unique (environment, transaction_id)
);

create table if not exists public.billing_apple_device_claims (
  device_id               text        not null
                                    check (char_length(device_id) between 1 and 200)
                                    references public.billing_entitlements (device_id) on delete cascade,
  environment             text        not null,
  original_transaction_id text        not null,
  claimed_at              timestamptz not null default now(),
  primary key (device_id, environment, original_transaction_id),
  foreign key (environment, original_transaction_id)
    references public.billing_apple_transactions (environment, original_transaction_id) on delete cascade
);

create index if not exists billing_apple_claims_transaction_idx
  on public.billing_apple_device_claims (environment, original_transaction_id);

alter table public.billing_apple_transactions enable row level security;
alter table public.billing_apple_device_claims enable row level security;
revoke all on table public.billing_apple_transactions from public, anon, authenticated, service_role;
revoke all on table public.billing_apple_device_claims from public, anon, authenticated, service_role;

-- SECURITY DEFINER owners need explicit table privileges because service_role has none.
grant select, insert, update, delete on table
  public.billing_entitlements,
  public.billing_purchase_tokens,
  public.billing_apple_transactions,
  public.billing_apple_device_claims
to postgres;

-- Keep the Google calculation identical: only active token rows count, and a Google bundle
-- controls unlock_all_digital/is_purchased. Apple grants are additive and scoped to claims.
create or replace function public.billing_recompute_entitlements(p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_google_all boolean;
  v_apple_all boolean;
  v_google_map jsonb;
  v_apple_map jsonb;
begin
  select coalesce(bool_or(grant_target = 'all'), false)
    into v_google_all
    from public.billing_purchase_tokens
   where device_id = p_device_id and purchase_state = 0;

  select jsonb_build_object(
    'classic',    v_google_all or coalesce(bool_or(grant_target = 'classic'), false),
    'reracked',   v_google_all or coalesce(bool_or(grant_target = 'reracked'), false),
    'sequential', v_google_all or coalesce(bool_or(grant_target = 'sequential'), false),
    'teed-off',   v_google_all or coalesce(bool_or(grant_target = 'teed-off'), false),
    'tournament', v_google_all or coalesce(bool_or(grant_target = 'tournament'), false)
  )
    into v_google_map
    from public.billing_purchase_tokens
   where device_id = p_device_id and purchase_state = 0;

  select coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) = 'all'), false),
         jsonb_build_object(
           'classic',    coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) in ('all', 'classic')), false),
           'reracked',   coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) in ('all', 'reracked')), false),
           'sequential', coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) in ('all', 'sequential')), false),
           'teed-off',   coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) in ('all', 'teed-off')), false),
           'tournament', coalesce(bool_or(public.billing_apple_grant_for_product(t.product_id) in ('all', 'tournament')), false)
         )
    into v_apple_all, v_apple_map
    from public.billing_apple_device_claims c
    join public.billing_apple_transactions t
      on t.environment = c.environment
     and t.original_transaction_id = c.original_transaction_id
   where c.device_id = p_device_id
     and t.revocation_date is null;

  update public.billing_entitlements
     set unlock_all_digital   = v_google_all or v_apple_all,
         is_purchased         = v_google_all or v_apple_all,
         edition_entitlements = jsonb_build_object(
           'classic',    (v_google_map ->> 'classic')::boolean or (v_apple_map ->> 'classic')::boolean,
           'reracked',   (v_google_map ->> 'reracked')::boolean or (v_apple_map ->> 'reracked')::boolean,
           'sequential', (v_google_map ->> 'sequential')::boolean or (v_apple_map ->> 'sequential')::boolean,
           'teed-off',   (v_google_map ->> 'teed-off')::boolean or (v_apple_map ->> 'teed-off')::boolean,
           'tournament', (v_google_map ->> 'tournament')::boolean or (v_apple_map ->> 'tournament')::boolean
         ),
         updated_at = now()
   where device_id = p_device_id;
end;
$$;

-- Called only after the Edge Function verifies Apple's signed transaction data.
-- Claims are idempotent and intentionally have no device-count limit.
create or replace function public.billing_record_apple_verification(
  p_device_id               text,
  p_environment             text,
  p_original_transaction_id text,
  p_transaction_id          text,
  p_product_id              text,
  p_bundle_id               text,
  p_purchase_date           timestamptz,
  p_revocation_date         timestamptz,
  p_revocation_reason       integer,
  p_signed_date             timestamptz,
  p_signed_transaction      jsonb
) returns public.billing_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant text;
  v_claimed_device text;
  v_existing_product text;
  v_existing_bundle text;
  r public.billing_entitlements;
begin
  if p_device_id is null or char_length(p_device_id) not between 1 and 200 then
    raise exception 'invalid device id' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('Sandbox', 'Production') then
    raise exception 'invalid Apple environment' using errcode = '22023';
  end if;

  v_grant := public.billing_apple_grant_for_product(p_product_id);
  if v_grant is null then
    raise exception 'unsupported Apple product' using errcode = '22023';
  end if;
  if p_bundle_id is distinct from 'com.parforthecourse.app' then
    raise exception 'unsupported Apple bundle id' using errcode = '22023';
  end if;
  if p_original_transaction_id is null or char_length(p_original_transaction_id) not between 1 and 128
     or p_transaction_id is null or char_length(p_transaction_id) not between 1 and 128
     or p_purchase_date is null or p_signed_date is null or p_signed_transaction is null then
    raise exception 'invalid Apple transaction data' using errcode = '22023';
  end if;

  -- Match billing_record_play_verification's transaction-scoped lock. This serializes
  -- recomputations across both stores; the Google RPC cannot be changed in this migration.
  perform pg_advisory_xact_lock(hashtext('billing_record_play_verification'));
  perform public.billing_get_or_create_entitlement(p_device_id, 30);
  update public.billing_entitlements
     set platform = 'apple'
   where device_id = p_device_id;

  select t.product_id, t.bundle_id
    into v_existing_product, v_existing_bundle
    from public.billing_apple_transactions t
   where t.environment = p_environment
     and t.original_transaction_id = p_original_transaction_id
   for update;
  if found and (v_existing_product <> p_product_id or v_existing_bundle <> p_bundle_id) then
    raise exception 'Apple transaction product or bundle mismatch' using errcode = '22023';
  end if;

  insert into public.billing_apple_transactions
    (environment, original_transaction_id, transaction_id, product_id, bundle_id,
     purchase_date, revocation_date, revocation_reason, signed_date, signed_transaction)
  values
    (p_environment, p_original_transaction_id, p_transaction_id, p_product_id, p_bundle_id,
     p_purchase_date, p_revocation_date, p_revocation_reason, p_signed_date, p_signed_transaction)
  on conflict (environment, original_transaction_id) do update
     set transaction_id = excluded.transaction_id,
         purchase_date = excluded.purchase_date,
         revocation_date = coalesce(public.billing_apple_transactions.revocation_date, excluded.revocation_date),
         revocation_reason = coalesce(public.billing_apple_transactions.revocation_reason, excluded.revocation_reason),
         signed_date = excluded.signed_date,
         signed_transaction = excluded.signed_transaction,
         last_verified_at = now()
   where public.billing_apple_transactions.signed_date <= excluded.signed_date;

  insert into public.billing_apple_device_claims (device_id, environment, original_transaction_id)
  values (p_device_id, p_environment, p_original_transaction_id)
  on conflict (device_id, environment, original_transaction_id) do nothing;

  if p_revocation_date is not null then
    for v_claimed_device in
      select c.device_id
        from public.billing_apple_device_claims c
       where c.environment = p_environment
         and c.original_transaction_id = p_original_transaction_id
    loop
      perform public.billing_recompute_entitlements(v_claimed_device);
    end loop;
  else
    perform public.billing_recompute_entitlements(p_device_id);
  end if;

  select * into r
    from public.billing_entitlements
   where device_id = p_device_id;
  return r;
end;
$$;

-- Supabase migrations are expected to run as postgres (or an admin able to transfer
-- ownership). Fix owners so SECURITY DEFINER code has a known, privileged context.
alter function public.billing_grant_for_product(text) owner to postgres;
alter function public.billing_get_or_create_entitlement(text, integer) owner to postgres;
alter function public.billing_recompute_entitlements(text) owner to postgres;
alter function public.billing_record_play_verification(text, text, text, text, integer, jsonb, integer) owner to postgres;
alter function public.billing_apple_grant_for_product(text) owner to postgres;
alter function public.billing_record_apple_verification(text, text, text, text, text, text, timestamptz, timestamptz, integer, timestamptz, jsonb) owner to postgres;

revoke all on function public.billing_grant_for_product(text) from public, anon, authenticated;
revoke all on function public.billing_get_or_create_entitlement(text, integer) from public, anon, authenticated;
revoke all on function public.billing_recompute_entitlements(text) from public, anon, authenticated, service_role;
revoke all on function public.billing_record_play_verification(text, text, text, text, integer, jsonb, integer) from public, anon, authenticated;
revoke all on function public.billing_apple_grant_for_product(text) from public, anon, authenticated, service_role;
revoke all on function public.billing_record_apple_verification(text, text, text, text, text, text, timestamptz, timestamptz, integer, timestamptz, jsonb) from public, anon, authenticated;

-- Preserve the existing Google RPC entry points and make definer-to-definer calls explicit.
grant execute on function public.billing_grant_for_product(text) to postgres, service_role;
grant execute on function public.billing_get_or_create_entitlement(text, integer) to postgres, service_role;
grant execute on function public.billing_recompute_entitlements(text) to postgres;
grant execute on function public.billing_record_play_verification(text, text, text, text, integer, jsonb, integer) to postgres, service_role;

-- Apple mapping is internal; only the postgres-owned definer RPCs can call it.
grant execute on function public.billing_apple_grant_for_product(text) to postgres;
grant execute on function public.billing_record_apple_verification(text, text, text, text, text, text, timestamptz, timestamptz, integer, timestamptz, jsonb) to postgres, service_role;
