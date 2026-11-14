create or replace function public.record_delajipay_referral_profit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_referrer uuid; v_percent numeric(5,2); v_profit bigint; v_reward bigint;
begin
  if lower(coalesce(new.status,'')) not in ('successful','success','completed') or new.provider_cost_kobo is null then return new; end if;
  if new.provider_cost_kobo < 0 or new.provider_cost_kobo >= new.amount_kobo then return new; end if;
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
