-- DelajiPay referral foundation: per-user codes, configurable domain/rate, profit-based rewards and controlled withdrawals.
create table if not exists public.platform_settings (
  singleton boolean primary key default true check (singleton),
  referral_base_url text not null default 'https://deltagp.com/',
  referral_commission_percent numeric(5,2) not null default 10.00 check (referral_commission_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(singleton) values (true) on conflict (singleton) do nothing;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;
create unique index if not exists profiles_referral_code_uidx
  on public.profiles(referral_code) where referral_code is not null;

-- Backfill the existing customer (and any other existing profiles) with stable unique codes.
do $$
declare r record; v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    loop
      v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
      exit when not exists (select 1 from public.profiles where referral_code = v_code);
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end $$;

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete restrict,
  referred_user_id uuid not null references auth.users(id) on delete restrict,
  service_order_id uuid not null unique references public.service_orders(id) on delete restrict,
  eligible_profit_kobo bigint not null check (eligible_profit_kobo > 0),
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 100),
  reward_kobo bigint not null check (reward_kobo > 0),
  status text not null default 'available' check (status in ('available','paid','reversed')),
  created_at timestamptz not null default now()
);

alter table public.service_orders
  add column if not exists provider_cost_kobo bigint
  check (provider_cost_kobo is null or provider_cost_kobo >= 0);

create table if not exists public.referral_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  withdrawal_type text not null check (withdrawal_type in ('wallet','bank')),
  status text not null default 'pending' check (status in ('pending','paid','rejected','transferred')),
  bank_name text,
  account_name text,
  account_number text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  wallet_ledger_id uuid references public.wallet_ledger(id)
);

alter table public.platform_settings enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_withdrawals enable row level security;

drop policy if exists "Admins manage platform settings" on public.platform_settings;
create policy "Admins manage platform settings" on public.platform_settings
  for all to authenticated
  using ((select (auth.jwt()->'app_metadata'->>'role')) = 'admin')
  with check ((select (auth.jwt()->'app_metadata'->>'role')) = 'admin');

drop policy if exists "Users and admins read referral rewards" on public.referral_rewards;
create policy "Users and admins read referral rewards" on public.referral_rewards
  for select to authenticated
  using (auth.uid() = referrer_user_id or (select (auth.jwt()->'app_metadata'->>'role')) = 'admin');

drop policy if exists "Users and admins read referral withdrawals" on public.referral_withdrawals;
create policy "Users and admins read referral withdrawals" on public.referral_withdrawals
  for select to authenticated
  using (auth.uid() = user_id or (select (auth.jwt()->'app_metadata'->>'role')) = 'admin');

revoke all on public.platform_settings from anon, authenticated;
grant select, insert, update, delete on public.platform_settings to authenticated;
revoke all on public.referral_rewards from anon, authenticated;
grant select on public.referral_rewards to authenticated;
revoke all on public.referral_withdrawals from anon, authenticated;
grant select on public.referral_withdrawals to authenticated;

create or replace function public.get_referral_base_url()
returns text language sql stable security definer set search_path = ''
as $$
  select referral_base_url from public.platform_settings where singleton = true;
$$;
revoke all on function public.get_referral_base_url() from public;
grant execute on function public.get_referral_base_url() to anon, authenticated;

create or replace function public.admin_set_referral_settings(p_base_url text, p_commission_percent numeric)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_url text;
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Administrator access required.';
  end if;
  v_url := trim(coalesce(p_base_url,''));
  if v_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^[:space:]?#]*)?/?$' then
    raise exception 'Enter a valid HTTPS website URL.';
  end if;
  if p_commission_percent is null or p_commission_percent < 0 or p_commission_percent > 100 then
    raise exception 'Commission must be between 0 and 100 percent.';
  end if;
  if right(v_url,1) <> '/' then v_url := v_url || '/'; end if;
  update public.platform_settings
    set referral_base_url = v_url,
        referral_commission_percent = round(p_commission_percent,2),
        updated_at = now()
    where singleton = true;
  return jsonb_build_object('referral_base_url',v_url,'commission_percent',round(p_commission_percent,2));
end;
$$;
revoke all on function public.admin_set_referral_settings(text,numeric) from public, anon, authenticated;
grant execute on function public.admin_set_referral_settings(text,numeric) to authenticated;

create or replace function public.my_referred_people()
returns table(full_name text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.full_name,'DelajiPay member'), p.created_at
  from public.referrals r
  join public.profiles p on p.id = r.referred_user_id
  where r.referrer_user_id = auth.uid()
  order by p.created_at desc;
$$;
revoke all on function public.my_referred_people() from public, anon;
grant execute on function public.my_referred_people() to authenticated;

create or replace function public.get_my_referral_balance()
returns bigint language sql stable security definer set search_path = ''
as $$
  select greatest(
    coalesce((select sum(reward_kobo) from public.referral_rewards
      where referrer_user_id = auth.uid() and status = 'available'),0)
    - coalesce((select sum(amount_kobo) from public.referral_withdrawals
      where user_id = auth.uid() and status in ('pending','paid','transferred')),0),
    0
  )::bigint;
$$;
revoke all on function public.get_my_referral_balance() from public, anon;
grant execute on function public.get_my_referral_balance() to authenticated;

create or replace function public.referral_withdraw_to_wallet(p_amount_kobo bigint)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_balance bigint; v_wallet_id uuid; v_withdrawal_id uuid; v_ledger_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 then raise exception 'Enter a valid amount.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 19));
  v_balance := public.get_my_referral_balance();
  if p_amount_kobo > v_balance then raise exception 'Insufficient available referral balance.'; end if;
  select id into v_wallet_id from public.wallets where user_id = auth.uid() for update;
  if v_wallet_id is null then raise exception 'Your DelajiPay wallet is not ready.'; end if;
  insert into public.referral_withdrawals(user_id,amount_kobo,withdrawal_type,status)
    values(auth.uid(),p_amount_kobo,'wallet','transferred') returning id into v_withdrawal_id;
  insert into public.wallet_ledger(wallet_id,user_id,entry_type,amount_kobo,reference,description,status,metadata)
    values(v_wallet_id,auth.uid(),'credit',p_amount_kobo,'referral-wallet-'||v_withdrawal_id,
      'Referral earnings transferred to wallet','posted',jsonb_build_object('referral_withdrawal_id',v_withdrawal_id))
    returning id into v_ledger_id;
  update public.referral_withdrawals set wallet_ledger_id=v_ledger_id where id=v_withdrawal_id;
  return jsonb_build_object('ok',true,'withdrawal_id',v_withdrawal_id,'wallet_ledger_id',v_ledger_id);
end;
$$;
revoke all on function public.referral_withdraw_to_wallet(bigint) from public, anon;
grant execute on function public.referral_withdraw_to_wallet(bigint) to authenticated;

create or replace function public.request_referral_bank_withdrawal(
  p_amount_kobo bigint, p_bank_name text, p_account_name text, p_account_number text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_balance bigint; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 then raise exception 'Enter a valid amount.'; end if;
  if length(trim(coalesce(p_bank_name,''))) < 2
     or length(trim(coalesce(p_account_name,''))) < 2
     or trim(coalesce(p_account_number,'')) !~ '^[0-9]{10}$' then
    raise exception 'Enter a bank, account name and valid 10-digit account number.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 19));
  v_balance := public.get_my_referral_balance();
  if p_amount_kobo > v_balance then raise exception 'Insufficient available referral balance.'; end if;
  insert into public.referral_withdrawals(user_id,amount_kobo,withdrawal_type,status,bank_name,account_name,account_number)
    values(auth.uid(),p_amount_kobo,'bank','pending',trim(p_bank_name),trim(p_account_name),trim(p_account_number))
    returning id into v_id;
  insert into public.notifications(user_id,title,body,category)
    values(auth.uid(),'Referral withdrawal requested','Your referral bank withdrawal request is pending admin review.','referral');
  return jsonb_build_object('ok',true,'withdrawal_id',v_id,'status','pending');
end;
$$;
revoke all on function public.request_referral_bank_withdrawal(bigint,text,text,text) from public, anon;
grant execute on function public.request_referral_bank_withdrawal(bigint,text,text,text) to authenticated;

create or replace function public.admin_review_referral_withdrawal(
  p_withdrawal_id uuid, p_decision text, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v public.referral_withdrawals%rowtype;
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Administrator access required.';
  end if;
  if p_decision not in ('paid','reject') then raise exception 'Invalid withdrawal decision.'; end if;
  select * into v from public.referral_withdrawals where id=p_withdrawal_id for update;
  if not found or v.withdrawal_type <> 'bank' or v.status <> 'pending' then
    raise exception 'This bank withdrawal is no longer pending.';
  end if;
  update public.referral_withdrawals
    set status = case when p_decision='paid' then 'paid' else 'rejected' end,
        admin_note = nullif(trim(coalesce(p_note,'')), ''),
        reviewed_at = now(),
        paid_at = case when p_decision='paid' then now() else null end
    where id=p_withdrawal_id;
  insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,details)
    values(auth.uid(),'referral_withdrawal_'||p_decision,'referral_withdrawal',p_withdrawal_id::text,
      jsonb_build_object('amount_kobo',v.amount_kobo,'user_id',v.user_id,'admin_note',p_note));
  insert into public.notifications(user_id,title,body,category)
    values(v.user_id,
      case when p_decision='paid' then 'Referral withdrawal paid' else 'Referral withdrawal rejected' end,
      case when p_decision='paid' then 'Your referral bank withdrawal has been marked as paid.' else 'Your referral withdrawal was rejected. The reserved balance is available again.' end,
      'referral');
  return jsonb_build_object('ok',true,'status',case when p_decision='paid' then 'paid' else 'rejected' end);
end;
$$;
revoke all on function public.admin_review_referral_withdrawal(uuid,text,text) from public, anon;
grant execute on function public.admin_review_referral_withdrawal(uuid,text,text) to authenticated;

-- Generate codes and attribute a signup only from a valid existing referral code.
create or replace function public.handle_new_delajipay_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_referrer uuid; v_input_code text;
begin
  loop
    v_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
    exit when not exists(select 1 from public.profiles where referral_code=v_code);
  end loop;

  insert into public.profiles(id,full_name,phone,referral_code)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'phone',''),v_code)
  on conflict(id) do nothing;

  insert into public.wallets(user_id) values(new.id) on conflict(user_id) do nothing;

  v_input_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  if v_input_code <> '' then
    select id into v_referrer from public.profiles
      where referral_code=v_input_code and id<>new.id limit 1;
    if v_referrer is not null then
      update public.profiles set referred_by=v_referrer where id=new.id and referred_by is null;
      insert into public.referrals(referrer_user_id,referred_user_id,referral_code,reward_kobo,status)
        values(v_referrer,new.id,v_input_code,0,'pending')
        on conflict(referred_user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Backfill missing referral attribution for profiles created before this feature only when metadata carries a valid code.
do $$
declare r record; v_referrer uuid; v_code text;
begin
  for r in select u.id,u.raw_user_meta_data from auth.users u
    join public.profiles p on p.id=u.id where p.referred_by is null loop
    v_code := upper(trim(coalesce(r.raw_user_meta_data->>'referral_code','')));
    if v_code <> '' then
      select id into v_referrer from public.profiles where referral_code=v_code and id<>r.id limit 1;
      if v_referrer is not null then
        update public.profiles set referred_by=v_referrer where id=r.id;
        insert into public.referrals(referrer_user_id,referred_user_id,referral_code,reward_kobo,status)
          values(v_referrer,r.id,v_code,0,'pending') on conflict(referred_user_id) do nothing;
      end if;
    end if;
  end loop;
end $$;

-- Commission is only credited after the service order is successful and a trusted provider cost is stored.
create or replace function public.record_delajipay_referral_profit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_referrer uuid; v_percent numeric(5,2); v_profit bigint; v_reward bigint;
begin
  if new.status <> 'successful' or new.provider_cost_kobo is null then return new; end if;
  if new.provider_cost_kobo >= new.amount_kobo then return new; end if;
  select referrer_user_id into v_referrer from public.referrals
    where referred_user_id=new.user_id and status in ('pending','qualified','rewarded') limit 1;
  if v_referrer is null then return new; end if;
  if exists(select 1 from public.referral_rewards where service_order_id=new.id) then return new; end if;
  select referral_commission_percent into v_percent from public.platform_settings where singleton=true;
  v_profit := new.amount_kobo-new.provider_cost_kobo;
  v_reward := floor(v_profit*v_percent/100.0)::bigint;
  if v_reward <= 0 then return new; end if;
  insert into public.referral_rewards(referrer_user_id,referred_user_id,service_order_id,
    eligible_profit_kobo,commission_percent,reward_kobo,status)
  values(v_referrer,new.user_id,new.id,v_profit,v_percent,v_reward,'available')
  on conflict(service_order_id) do nothing;
  update public.referrals set reward_kobo=reward_kobo+v_reward,status='rewarded'
    where referrer_user_id=v_referrer and referred_user_id=new.user_id;
  insert into public.notifications(user_id,title,body,category)
    values(v_referrer,'Referral reward earned','You earned a referral commission from a completed eligible service.','referral');
  return new;
end;
$$;
drop trigger if exists service_order_referral_profit on public.service_orders;
create trigger service_order_referral_profit
  after insert or update of status,provider_cost_kobo on public.service_orders
  for each row execute function public.record_delajipay_referral_profit();

-- Only the server-side service role may supply provider cost values.
revoke all on function public.record_delajipay_referral_profit() from public, anon, authenticated;
