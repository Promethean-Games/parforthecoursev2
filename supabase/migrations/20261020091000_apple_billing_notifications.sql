-- Apply verified Apple refund/revocation notifications without creating new device claims.
create or replace function public.billing_record_apple_revocation(
  p_environment       text,
  p_original_transaction_id text,
  p_transaction_id    text,
  p_product_id        text,
  p_bundle_id         text,
  p_notification_type text,
  p_revocation_date   timestamptz,
  p_revocation_reason integer,
  p_signed_date       timestamptz,
  p_signed_transaction jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device_id text;
  v_updated boolean;
begin
  if p_environment is null or p_environment not in ('Sandbox', 'Production')
     or p_notification_type is null
     or p_notification_type not in ('REFUND', 'REVOKE', 'REFUND_REVERSED')
     or p_original_transaction_id is null
     or char_length(p_original_transaction_id) not between 1 and 128
     or p_transaction_id is null
     or char_length(p_transaction_id) not between 1 and 128
     or p_product_id is null
     or public.billing_apple_grant_for_product(p_product_id) is null
     or p_bundle_id is distinct from 'com.parforthecourse.app'
     or p_signed_date is null
     or p_signed_transaction is null
     or (p_notification_type in ('REFUND', 'REVOKE') and p_revocation_date is null)
     or (p_notification_type = 'REFUND_REVERSED' and p_revocation_date is not null) then
    raise exception 'invalid Apple revocation notification' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('billing_record_play_verification'));

  update public.billing_apple_transactions t
     set revocation_date = case
           when p_notification_type = 'REFUND_REVERSED' then null
           else coalesce(t.revocation_date, p_revocation_date)
         end,
         revocation_reason = case
           when p_notification_type = 'REFUND_REVERSED' then null
           else coalesce(t.revocation_reason, p_revocation_reason)
         end,
         signed_date = greatest(t.signed_date, p_signed_date),
         signed_transaction = case
           when t.signed_date <= p_signed_date then p_signed_transaction
           else t.signed_transaction
         end,
         last_verified_at = now()
   where t.environment = p_environment
     and t.original_transaction_id = p_original_transaction_id
     and t.transaction_id = p_transaction_id
     and t.product_id = p_product_id
     and t.bundle_id = p_bundle_id
     and (p_notification_type <> 'REFUND_REVERSED' or t.revocation_date is not null)
  returning true into v_updated;

  if not coalesce(v_updated, false) then
    return false;
  end if;

  for v_device_id in
    select c.device_id
      from public.billing_apple_device_claims c
     where c.environment = p_environment
       and c.original_transaction_id = p_original_transaction_id
  loop
    perform public.billing_recompute_entitlements(v_device_id);
  end loop;

  return true;
end;
$$;

alter function public.billing_record_apple_revocation(text, text, text, text, text, text, timestamptz, integer, timestamptz, jsonb)
  owner to postgres;
revoke all on function public.billing_record_apple_revocation(text, text, text, text, text, text, timestamptz, integer, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.billing_record_apple_revocation(text, text, text, text, text, text, timestamptz, integer, timestamptz, jsonb)
  to postgres, service_role;
