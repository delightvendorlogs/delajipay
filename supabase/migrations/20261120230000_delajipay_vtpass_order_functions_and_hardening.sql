-- Applied to the Supabase project (fgkkzxfaxgkkcbkwbamx) via MCP. Kept here for version control.

-- 1) Hardening: trigger functions must not be callable from the API
revoke execute on function public.delajipay_notify_new_customer() from public, anon, authenticated;
revoke execute on function public.delajipay_notify_service_order() from public, anon, authenticated;

-- 2) Atomic place-order: lock wallet, check balance, debit, create order (server/service_role only)
create or replace function public.delajipay_place_order(
  p_user_id uuid, p_service_code text, p_amount_kobo bigint,
  p_customer_reference text, p_recipient jsonb
) returns table(order_id uuid, status text, already_exists boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_wallet uuid; v_balance bigint; v_ledger uuid; v_order uuid; v_existing record;
begin
  if p_amount_kobo is null or p_amount_kobo < 5000 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (select 1 from service_catalog where service_code = p_service_code and is_active) then
    raise exception 'SERVICE_UNAVAILABLE';
  end if;

  select o.id, o.status into v_existing from service_orders o
   where o.customer_reference = p_customer_reference and o.user_id = p_user_id;
  if found then return query select v_existing.id, v_existing.status, true; return; end if;

  select w.id into v_wallet from wallets w where w.user_id = p_user_id for update;
  if v_wallet is null then raise exception 'NO_WALLET'; end if;

  select coalesce(sum(case l.entry_type
      when 'credit' then l.amount_kobo
      when 'debit' then -l.amount_kobo
      when 'reversal' then case orig.entry_type when 'debit' then l.amount_kobo when 'credit' then -l.amount_kobo else 0 end
      else 0 end), 0)::bigint
    into v_balance
    from wallet_ledger l left join wallet_ledger orig on orig.id = l.related_entry_id
   where l.user_id = p_user_id and l.status = 'posted';

  if v_balance < p_amount_kobo then raise exception 'INSUFFICIENT_FUNDS'; end if;

  insert into wallet_ledger(wallet_id,user_id,entry_type,amount_kobo,reference,description,status,metadata)
  values (v_wallet,p_user_id,'debit',p_amount_kobo,'debit_'||p_customer_reference,
          initcap(replace(p_service_code,'_',' '))||' purchase','posted',
          jsonb_build_object('service_code',p_service_code))
  returning id into v_ledger;

  insert into service_orders(user_id,service_code,amount_kobo,customer_reference,status,recipient,debit_ledger_id)
  values (p_user_id,p_service_code,p_amount_kobo,p_customer_reference,'processing',coalesce(p_recipient,'{}'::jsonb),v_ledger)
  returning id into v_order;

  return query select v_order, 'processing'::text, false;
end $$;

-- 3) Settle order: success, or failed with automatic refund (idempotent)
create or replace function public.delajipay_settle_order(
  p_order_id uuid, p_status text, p_provider_reference text,
  p_provider_response jsonb, p_provider_cost_kobo bigint
) returns text language plpgsql security definer set search_path = public as $$
declare o record; v_wallet uuid;
begin
  if p_status not in ('successful','failed','unknown','processing') then raise exception 'BAD_STATUS'; end if;
  select * into o from service_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('successful','failed','reversed') then return o.status; end if;

  if p_status = 'failed' then
    select id into v_wallet from wallets where user_id = o.user_id;
    insert into wallet_ledger(wallet_id,user_id,entry_type,amount_kobo,reference,description,status,related_entry_id,metadata)
    values (v_wallet,o.user_id,'reversal',o.amount_kobo,'reversal_'||o.customer_reference,
            'Refund: '||initcap(replace(o.service_code,'_',' '))||' purchase failed','posted',o.debit_ledger_id,
            jsonb_build_object('order_id',o.id))
    on conflict (reference) do nothing;
  end if;

  update service_orders set status = p_status,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         provider_response = coalesce(p_provider_response, provider_response),
         provider_cost_kobo = coalesce(p_provider_cost_kobo, provider_cost_kobo),
         updated_at = now()
   where id = p_order_id;
  return p_status;
end $$;

revoke execute on function public.delajipay_place_order(uuid,text,bigint,text,jsonb) from public, anon, authenticated;
revoke execute on function public.delajipay_settle_order(uuid,text,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.delajipay_place_order(uuid,text,bigint,text,jsonb) to service_role;
grant execute on function public.delajipay_settle_order(uuid,text,text,jsonb,bigint) to service_role;
