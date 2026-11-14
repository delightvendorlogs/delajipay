-- Qualify pgcrypto explicitly because the signup trigger runs with an empty search_path.
create or replace function public.handle_new_delajipay_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_code text; v_referrer uuid; v_input_code text;
begin
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
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
