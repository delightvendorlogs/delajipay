-- Sparkle SMS core order storage and wallet settlement.
-- Historical VTU records and wallet ledgers are intentionally preserved.

create table if not exists public.sparkle_sms_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null check (provider_key in ('fetchsms','textverified','virtualsms')),
  country_iso text not null check (country_iso = '*' or country_iso ~ '^[A-Z]{2}$'),
  service_code text not null,
  pricing_mode text not null default 'markup' check (pricing_mode in ('markup','fixed')),
  markup_percent numeric(8,2) not null default 100 check (markup_percent >= 0 and markup_percent <= 1000),
  fixed_price_kobo bigint check (fixed_price_kobo is null or fixed_price_kobo > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_key,country_iso,service_code),
  check ((pricing_mode = 'markup') or fixed_price_kobo is not null)
);

create table if not exists public.sparkle_sms_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider_key text not null check (provider_key in ('fetchsms','textverified','virtualsms')),
  provider_order_id text,
  idempotency_key text not null,
  country_iso text not null check (country_iso ~ '^[A-Z]{2}$'),
  country_name text not null,
  service_code text not null,
  service_name text not null,
  phone_number text,
  provider_cost_usd numeric(14,4),
  exchange_rate numeric(14,4),
  provider_cost_kobo bigint,
  customer_price_kobo bigint not null check (customer_price_kobo > 0),
  status text not null default 'creating' check (status in ('creating','waiting','received','expired','cancelled','failed','refunded','unknown')),
  provider_state text,
  otp_code text,
  sms_text text,
  expires_at timestamptz,
  code_received_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  debit_ledger_id uuid references public.wallet_ledger(id),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key),
  unique(provider_key,provider_order_id),
  check (
    (provider_key = 'virtualsms' and country_iso <> 'US')
    or (provider_key in ('fetchsms','textverified') and country_iso = 'US')
  )
);

create table if not exists public.sparkle_sms_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sparkle_sms_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  provider_message_id text,
  sender text,
  otp_code text,
  message_text text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(order_id,provider_message_id)
);

create index if not exists sparkle_sms_orders_user_created_idx
  on public.sparkle_sms_orders(user_id,created_at desc);
create index if not exists sparkle_sms_orders_status_idx
  on public.sparkle_sms_orders(status,updated_at);
create index if not exists sparkle_sms_messages_user_received_idx
  on public.sparkle_sms_messages(user_id,received_at desc);

alter table public.sparkle_sms_pricing_rules enable row level security;
alter table public.sparkle_sms_orders enable row level security;
alter table public.sparkle_sms_messages enable row level security;

revoke all on public.sparkle_sms_pricing_rules from anon, authenticated;
revoke all on public.sparkle_sms_orders from anon, authenticated;
revoke all on public.sparkle_sms_messages from anon, authenticated;
grant select on public.sparkle_sms_orders to authenticated;
grant select on public.sparkle_sms_messages to authenticated;

drop policy if exists "Customers can read their own Sparkle SMS orders" on public.sparkle_sms_orders;
create policy "Customers can read their own Sparkle SMS orders"
  on public.sparkle_sms_orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can read their own Sparkle SMS messages" on public.sparkle_sms_messages;
create policy "Customers can read their own Sparkle SMS messages"
  on public.sparkle_sms_messages for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.sparkle_create_sms_order(
  p_user_id uuid,
  p_provider_key text,
  p_idempotency_key text,
  p_country_iso text,
  p_country_name text,
  p_service_code text,
  p_service_name text,
  p_customer_price_kobo bigint,
  p_provider_cost_usd numeric default null,
  p_exchange_rate numeric default null
) returns table(order_id uuid, status text, already_exists boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_wallet uuid;
  v_balance bigint;
  v_ledger uuid;
  v_order uuid;
  v_existing record;
  v_country text := upper(trim(p_country_iso));
begin
  if p_user_id is null or p_provider_key not in ('fetchsms','textverified','virtualsms') then
    raise exception 'INVALID_ORDER';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_customer_price_kobo is null or p_customer_price_kobo < 1 then
    raise exception 'INVALID_PRICE';
  end if;
  if p_provider_key = 'virtualsms' and v_country = 'US' then
    raise exception 'USA_MUST_USE_US_PROVIDER';
  end if;
  if p_provider_key in ('fetchsms','textverified') and v_country <> 'US' then
    raise exception 'US_PROVIDER_ONLY';
  end if;

  select o.id, o.status into v_existing
    from public.sparkle_sms_orders o
   where o.user_id = p_user_id and o.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.status, true;
    return;
  end if;

  select w.id into v_wallet
    from public.wallets w
   where w.user_id = p_user_id
   for update;
  if v_wallet is null then raise exception 'NO_WALLET'; end if;

  select coalesce(sum(case l.entry_type
    when 'credit' then l.amount_kobo
    when 'debit' then -l.amount_kobo
    when 'reversal' then case orig.entry_type
      when 'debit' then l.amount_kobo
      when 'credit' then -l.amount_kobo
      else 0 end
    else 0 end),0)::bigint
    into v_balance
    from public.wallet_ledger l
    left join public.wallet_ledger orig on orig.id = l.related_entry_id
   where l.user_id = p_user_id and l.status = 'posted';

  if v_balance < p_customer_price_kobo then raise exception 'INSUFFICIENT_FUNDS'; end if;

  v_order := gen_random_uuid();
  insert into public.wallet_ledger(
    wallet_id,user_id,entry_type,amount_kobo,reference,description,status,metadata
  ) values (
    v_wallet,p_user_id,'debit',p_customer_price_kobo,
    'sparkle_sms_debit_'||replace(v_order::text,'-',''),
    'Sparkle SMS number purchase','posted',
    jsonb_build_object('sparkle_sms_order_id',v_order,'provider_key',p_provider_key)
  ) returning id into v_ledger;

  insert into public.sparkle_sms_orders(
    id,user_id,provider_key,idempotency_key,country_iso,country_name,
    service_code,service_name,customer_price_kobo,provider_cost_usd,
    exchange_rate,debit_ledger_id,status
  ) values (
    v_order,p_user_id,p_provider_key,p_idempotency_key,v_country,
    coalesce(nullif(trim(p_country_name),''),v_country),
    trim(p_service_code),trim(p_service_name),p_customer_price_kobo,
    p_provider_cost_usd,p_exchange_rate,v_ledger,'creating'
  );

  return query select v_order, 'creating'::text, false;
end;
$$;

create or replace function public.sparkle_refund_sms_order(
  p_order_id uuid,
  p_final_status text,
  p_reason text default null
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  o public.sparkle_sms_orders%rowtype;
  v_wallet uuid;
begin
  if p_final_status not in ('failed','expired','cancelled') then
    raise exception 'INVALID_REFUND_STATUS';
  end if;
  select * into o from public.sparkle_sms_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.refunded_at is not null or o.status = 'refunded' then return 'refunded'; end if;
  if o.otp_code is not null or o.status = 'received' then
    raise exception 'CODE_ALREADY_RECEIVED';
  end if;
  if o.debit_ledger_id is null then raise exception 'ORDER_NOT_DEBITED'; end if;

  select id into v_wallet from public.wallets where user_id = o.user_id;
  if v_wallet is null then raise exception 'NO_WALLET'; end if;

  insert into public.wallet_ledger(
    wallet_id,user_id,entry_type,amount_kobo,reference,description,status,
    related_entry_id,metadata
  ) values (
    v_wallet,o.user_id,'reversal',o.customer_price_kobo,
    'sparkle_sms_refund_'||replace(o.id::text,'-',''),
    'Sparkle SMS refund: '||coalesce(nullif(p_reason,''),p_final_status),
    'posted',o.debit_ledger_id,
    jsonb_build_object('sparkle_sms_order_id',o.id,'final_status',p_final_status)
  ) on conflict (reference) do nothing;

  update public.sparkle_sms_orders
     set status='refunded',provider_state=p_final_status,
         refunded_at=now(),updated_at=now()
   where id=o.id;
  return 'refunded';
end;
$$;

revoke execute on function public.sparkle_create_sms_order(uuid,text,text,text,text,text,text,bigint,numeric,numeric) from public, anon, authenticated;
revoke execute on function public.sparkle_refund_sms_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.sparkle_create_sms_order(uuid,text,text,text,text,text,text,bigint,numeric,numeric) to service_role;
grant execute on function public.sparkle_refund_sms_order(uuid,text,text) to service_role;
