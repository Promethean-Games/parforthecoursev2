-- Standalone PostgreSQL regression script; not a pgTAP test.
-- Safe local setup from the repository root:
--   1. supabase start
--   2. supabase db reset
--   3. psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/apple_billing.test.sql
-- Never run db reset against a linked/production project. The script uses test-prefixed
-- device IDs and rolls all fixture data back. Connect as local postgres/table owner.
begin;

do $$
declare
  v_row public.billing_entitlements;
  v_device text;
  v_count integer;
  v_applied boolean;
  v_purchase_date timestamptz := now() - interval '1 day';
  v_refund_signed_date timestamptz := now() + interval '2 minutes';
  v_reversal_signed_date timestamptz := now() + interval '3 minutes';
  v_function regprocedure;
  v_google_rpc_definition text;
  v_apple_rpc_definition text;
  v_apple_revocation_rpc_definition text;
begin
  -- Function owners, lock identity and access boundary are part of the migration contract.
  foreach v_function in array array[
    'public.billing_grant_for_product(text)'::regprocedure,
    'public.billing_get_or_create_entitlement(text,integer)'::regprocedure,
    'public.billing_recompute_entitlements(text)'::regprocedure,
    'public.billing_record_play_verification(text,text,text,text,integer,jsonb,integer)'::regprocedure,
    'public.billing_apple_grant_for_product(text)'::regprocedure,
    'public.billing_record_apple_verification(text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,timestamp with time zone,jsonb)'::regprocedure,
    'public.billing_record_apple_revocation(text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,timestamp with time zone,jsonb)'::regprocedure
  ]
  loop
    if (select pg_get_userbyid(p.proowner) from pg_proc p where p.oid = v_function) <> 'postgres' then
      raise exception 'Billing function % must be owned by postgres', v_function;
    end if;
  end loop;

  select pg_get_functiondef('public.billing_record_play_verification(text,text,text,text,integer,jsonb,integer)'::regprocedure)
    into v_google_rpc_definition;
  select pg_get_functiondef('public.billing_record_apple_verification(text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,timestamp with time zone,jsonb)'::regprocedure)
    into v_apple_rpc_definition;
  select pg_get_functiondef('public.billing_record_apple_revocation(text,text,text,text,text,text,timestamp with time zone,timestamp with time zone,integer,timestamp with time zone,jsonb)'::regprocedure)
    into v_apple_revocation_rpc_definition;
  if position('hashtext(''billing_record_play_verification'')' in v_google_rpc_definition) = 0
     or position('hashtext(''billing_record_play_verification'')' in v_apple_rpc_definition) = 0
     or position('hashtext(''billing_record_play_verification'')' in v_apple_revocation_rpc_definition) = 0 then
    raise exception 'Google and Apple RPCs must use the same transaction advisory lock';
  end if;
  if has_function_privilege('anon', 'public.billing_record_apple_verification(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.billing_record_apple_verification(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.billing_record_play_verification(text,text,text,text,integer,jsonb,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.billing_record_play_verification(text,text,text,text,integer,jsonb,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.billing_get_or_create_entitlement(text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.billing_get_or_create_entitlement(text,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.billing_record_apple_verification(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.billing_record_apple_revocation(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.billing_record_apple_revocation(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.billing_record_apple_revocation(text,text,text,text,text,text,timestamptz,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.billing_record_apple_revocation(text,text,text,text,text,text,timestamptz,integer,timestamptz,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.billing_recompute_entitlements(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.billing_apple_grant_for_product(text)', 'EXECUTE')
     or has_table_privilege('service_role', 'public.billing_apple_transactions', 'SELECT')
     or has_table_privilege('service_role', 'public.billing_apple_device_claims', 'INSERT') then
    raise exception 'Unexpected Apple function or table permissions';
  end if;

  -- Existing Google individual grant remains device-specific.
  perform public.billing_get_or_create_entitlement('stage1-google-classic-a', 30);
  perform public.billing_get_or_create_entitlement('stage1-google-classic-b', 30);
  insert into public.billing_purchase_tokens
    (purchase_token, device_id, package_name, product_id, grant_target, purchase_state)
  values
    ('stage1-google-classic-token', 'stage1-google-classic-a', 'test.package',
     'google_play_product_classic', 'classic', 0);
  perform public.billing_recompute_entitlements('stage1-google-classic-a');
  perform public.billing_recompute_entitlements('stage1-google-classic-b');
  select * into v_row from public.billing_entitlements where device_id = 'stage1-google-classic-a';
  if v_row.edition_entitlements <> '{"classic":true,"reracked":false,"sequential":false,"teed-off":false,"tournament":false}'::jsonb
     or v_row.unlock_all_digital or v_row.is_purchased then
    raise exception 'Google individual grant behavior changed';
  end if;
  select * into v_row from public.billing_entitlements where device_id = 'stage1-google-classic-b';
  if v_row.edition_entitlements <> '{"classic":false,"reracked":false,"sequential":false,"teed-off":false,"tournament":false}'::jsonb then
    raise exception 'Google individual grant leaked to another device';
  end if;

  -- Existing Google bundle remains an all-editions unlock.
  perform public.billing_get_or_create_entitlement('stage1-google-bundle', 30);
  insert into public.billing_purchase_tokens
    (purchase_token, device_id, package_name, product_id, grant_target, purchase_state)
  values
    ('stage1-google-bundle-token', 'stage1-google-bundle', 'test.package',
     'google_play_product_bundle', 'all', 0);
  perform public.billing_recompute_entitlements('stage1-google-bundle');
  select * into v_row from public.billing_entitlements where device_id = 'stage1-google-bundle';
  if not v_row.unlock_all_digital or not v_row.is_purchased
     or v_row.edition_entitlements <> '{"classic":true,"reracked":true,"sequential":true,"teed-off":true,"tournament":true}'::jsonb then
    raise exception 'Google bundle behavior changed';
  end if;

  -- A non-active Google token contributes no entitlement after revocation/cancellation.
  update public.billing_purchase_tokens set purchase_state = 1
   where purchase_token = 'stage1-google-classic-token';
  perform public.billing_recompute_entitlements('stage1-google-classic-a');
  select * into v_row from public.billing_entitlements where device_id = 'stage1-google-classic-a';
  if v_row.edition_entitlements ->> 'classic' <> 'false' then
    raise exception 'Inactive Google purchase still grants an edition';
  end if;

  -- A verified Apple transaction can be claimed by multiple devices; duplicate claims are idempotent.
  perform public.billing_record_apple_verification(
    'stage1-apple-device-a', 'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app',
    v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  perform public.billing_record_apple_verification(
    'stage1-apple-device-a', 'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app',
    v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  perform public.billing_record_apple_verification(
    'stage1-apple-device-b', 'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app',
    v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  select count(*) into v_count from public.billing_apple_device_claims
   where environment = 'Sandbox' and original_transaction_id = 'stage1-apple-original-1';
  if v_count <> 2 then
    raise exception 'Apple restore claims are not idempotent and multi-device';
  end if;
  for v_device in select unnest(array['stage1-apple-device-a', 'stage1-apple-device-b'])
  loop
    select * into v_row from public.billing_entitlements where device_id = v_device;
    if v_row.platform <> 'apple' or v_row.edition_entitlements ->> 'classic' <> 'true' then
      raise exception 'Apple restore failed for device %', v_device;
    end if;
  end loop;

  -- Cross-platform sequential RPC operations share one database serialization lock.
  -- Google state must survive Apple recomputation, and Apple state must survive Google recomputation.
  perform public.billing_record_play_verification(
    'stage1-cross-platform-a', 'stage1-cross-google-token-a',
    'google_play_product_classic', 'test.package', 0, '{}'::jsonb, 30
  );
  perform public.billing_record_apple_verification(
    'stage1-cross-platform-a', 'Sandbox', 'stage1-cross-apple-original-a',
    'stage1-cross-apple-transaction-a', 'com.parforthecourse.app.edition.sequential',
    'com.parforthecourse.app', v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  select * into v_row from public.billing_entitlements where device_id = 'stage1-cross-platform-a';
  if v_row.edition_entitlements ->> 'classic' <> 'true'
     or v_row.edition_entitlements ->> 'sequential' <> 'true' then
    raise exception 'Apple recomputation dropped an existing Google grant';
  end if;

  perform public.billing_record_apple_verification(
    'stage1-cross-platform-b', 'Sandbox', 'stage1-cross-apple-original-b',
    'stage1-cross-apple-transaction-b', 'com.parforthecourse.app.edition.reracked',
    'com.parforthecourse.app', v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  perform public.billing_record_play_verification(
    'stage1-cross-platform-b', 'stage1-cross-google-token-b',
    'google_play_product_tournament', 'test.package', 0, '{}'::jsonb, 30
  );
  perform public.billing_recompute_entitlements('stage1-cross-platform-b');
  perform public.billing_recompute_entitlements('stage1-cross-platform-b');
  select * into v_row from public.billing_entitlements where device_id = 'stage1-cross-platform-b';
  if v_row.edition_entitlements ->> 'reracked' <> 'true'
     or v_row.edition_entitlements ->> 'tournament' <> 'true' then
    raise exception 'Google recomputation dropped an existing Apple grant or is not repeatable';
  end if;

  -- The Apple bundle is an all-editions unlock too.
  perform public.billing_record_apple_verification(
    'stage1-apple-bundle', 'Production', 'stage1-apple-original-bundle',
    'stage1-apple-transaction-bundle', 'com.parforthecourse.app.edition.bundle',
    'com.parforthecourse.app', v_purchase_date, null, null, now(), '{"test":true}'::jsonb
  );
  select * into v_row from public.billing_entitlements where device_id = 'stage1-apple-bundle';
  if not v_row.unlock_all_digital or not v_row.is_purchased
     or v_row.edition_entitlements <> '{"classic":true,"reracked":true,"sequential":true,"teed-off":true,"tournament":true}'::jsonb then
    raise exception 'Apple bundle did not unlock every edition';
  end if;

  -- Revocation on a later signed record removes this purchase from every claiming device.
  perform public.billing_record_play_verification(
    'stage1-apple-device-b', 'stage1-apple-device-b-google-token',
    'google_play_product_tournament', 'test.package', 0, '{}'::jsonb, 30
  );
  perform public.billing_record_apple_verification(
    'stage1-apple-device-a', 'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app',
    v_purchase_date, now(), 1, now() + interval '1 minute', '{"test":true,"revoked":true}'::jsonb
  );
  for v_device in select unnest(array['stage1-apple-device-a', 'stage1-apple-device-b'])
  loop
    select * into v_row from public.billing_entitlements where device_id = v_device;
    if v_row.edition_entitlements ->> 'classic' <> 'false'
       or (v_device = 'stage1-apple-device-b' and v_row.edition_entitlements ->> 'tournament' <> 'true') then
      raise exception 'Apple revocation did not remove access for device %', v_device;
    end if;
  end loop;

  select count(*) into v_count from public.billing_apple_device_claims
   where environment = 'Sandbox' and original_transaction_id = 'stage1-apple-original-1';
  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND',
    v_refund_signed_date, now(), 1, now() + interval '2 minutes',
    '{"test":true,"notification":"REFUND"}'::jsonb
  ) into v_applied;
  if not v_applied then
    raise exception 'Apple refund notification did not update an existing transaction';
  end if;
  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND',
    v_refund_signed_date, now(), 1, now() + interval '2 minutes',
    '{"test":true,"notification":"REFUND"}'::jsonb
  ) into v_applied;
  if v_applied then
    raise exception 'Duplicate Apple refund notification was applied twice';
  end if;
  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND_REVERSED',
    v_refund_signed_date - interval '1 second', null, null, now() + interval '3 minutes',
    '{"test":true,"notification":"stale REFUND_REVERSED"}'::jsonb
  ) into v_applied;
  if v_applied then
    raise exception 'Out-of-order Apple refund reversal was applied';
  end if;
  select * into v_row from public.billing_entitlements
   where device_id = 'stage1-apple-device-a';
  if v_row.edition_entitlements ->> 'classic' <> 'false' then
    raise exception 'Stale Apple refund reversal restored revoked access';
  end if;
  if (select count(*) from public.billing_apple_device_claims
       where environment = 'Sandbox' and original_transaction_id = 'stage1-apple-original-1') <> v_count then
    raise exception 'Apple refund notification created a new device claim';
  end if;

  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND_REVERSED',
    v_reversal_signed_date, null, null, now() + interval '3 minutes',
    '{"test":true,"notification":"REFUND_REVERSED"}'::jsonb
  ) into v_applied;
  if not v_applied then
    raise exception 'Apple refund reversal did not update the existing transaction';
  end if;
  if (select count(*) from public.billing_apple_device_claims
       where environment = 'Sandbox' and original_transaction_id = 'stage1-apple-original-1') <> v_count then
    raise exception 'Apple refund reversal changed the existing device claims';
  end if;
  for v_device in select unnest(array['stage1-apple-device-a', 'stage1-apple-device-b'])
  loop
    select * into v_row from public.billing_entitlements where device_id = v_device;
    if v_row.edition_entitlements ->> 'classic' <> 'true' then
      raise exception 'Apple refund reversal did not restore access for device %', v_device;
    end if;
  end loop;
  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-original-1', 'stage1-apple-transaction-1',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND',
    v_reversal_signed_date - interval '1 second', now(), 1, now() + interval '4 minutes',
    '{"test":true,"notification":"stale REFUND"}'::jsonb
  ) into v_applied;
  if v_applied then
    raise exception 'Out-of-order Apple refund was applied after refund reversal';
  end if;
  select * into v_row from public.billing_entitlements
   where device_id = 'stage1-apple-device-a';
  if v_row.edition_entitlements ->> 'classic' <> 'true' then
    raise exception 'Stale Apple refund removed restored access';
  end if;

  select public.billing_record_apple_revocation(
    'Sandbox', 'stage1-apple-unclaimed-original', 'stage1-apple-unclaimed-transaction',
    'com.parforthecourse.app.edition.classic', 'com.parforthecourse.app', 'REFUND',
    now(), now(), 1, now(), '{"test":true}'::jsonb
  ) into v_applied;
  if v_applied or exists (
    select 1 from public.billing_apple_device_claims
     where original_transaction_id = 'stage1-apple-unclaimed-original'
  ) then
    raise exception 'Apple notification for an unknown transaction created a claim';
  end if;

  -- Unsupported products and bundle mismatches are rejected by the service-role RPC.
  begin
    perform public.billing_record_apple_verification(
      'stage1-apple-invalid', 'Sandbox', 'stage1-invalid-original', 'stage1-invalid-transaction',
      'com.parforthecourse.app.premium_unlock', 'com.parforthecourse.app',
      v_purchase_date, null, null, now(), '{}'::jsonb
    );
    raise exception 'Unsupported Apple product was accepted';
  exception when sqlstate '22023' then
    null;
  end;
end;
$$;

rollback;
