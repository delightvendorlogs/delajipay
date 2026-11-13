create extension if not exists pg_net with schema extensions;

create or replace function public.send_delajipay_telegram(p_message text)
returns boolean language plpgsql security definer
set search_path = public, vault, extensions as $$
declare bot_token text; target_chat text; request_id bigint;
begin
  select decrypted_secret into bot_token from vault.decrypted_secrets where name='TELEGRAM_BOT_TOKEN' limit 1;
  select decrypted_secret into target_chat from vault.decrypted_secrets where name='TELEGRAM_CHAT_ID' limit 1;
  if coalesce(bot_token,'')='' or coalesce(target_chat,'')='' then
    raise warning 'DelajiPay Telegram secrets are not configured in Supabase Vault.';
    return false;
  end if;
  select net.http_post(
    url := 'https://api.telegram.org/bot'||bot_token||'/sendMessage',
    body := jsonb_build_object('chat_id',target_chat,'text',left(coalesce(p_message,''),3900),'disable_web_page_preview',true),
    headers := jsonb_build_object('Content-Type','application/json'),
    timeout_milliseconds := 10000
  ) into request_id;
  return request_id is not null;
exception when others then
  raise warning 'DelajiPay Telegram notification could not be queued: %',sqlerrm;
  return false;
end; $$;

revoke all on function public.send_delajipay_telegram(text) from public,anon,authenticated;
grant execute on function public.send_delajipay_telegram(text) to service_role;

create or replace function public.delajipay_notify_new_customer()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare admin_id uuid; customer_name text;
begin
  select id into admin_id from auth.users where raw_app_meta_data->>'role'='admin' order by created_at asc limit 1;
  customer_name:=coalesce(new.raw_user_meta_data->>'full_name',new.email,'New customer');
  if admin_id is not null then
    insert into public.notifications(user_id,title,body,category)
    values(admin_id,'New DelajiPay customer',customer_name||' just created a DelajiPay account.','new_customer');
  end if;
  insert into public.notifications(user_id,title,body,category)
  values(new.id,'Welcome to DelajiPay','Your account has been created. You can now explore your dashboard and available services.','account');
  perform public.send_delajipay_telegram(
    '🔔 NEW DELAJIPAY CUSTOMER'||E'\n\n'||'Name: '||customer_name||E'\n'||
    'Email: '||coalesce(new.email,'Not provided')||E'\n'||
    'Phone: '||coalesce(new.raw_user_meta_data->>'phone','Not provided')||E'\n'||
    'User ID: '||new.id::text
  );
  return new;
end; $$;

create or replace function public.delajipay_notify_service_order()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare admin_id uuid; service_label text; customer_name text; order_amount text;
begin
  select id into admin_id from auth.users where raw_app_meta_data->>'role'='admin' order by created_at asc limit 1;
  select coalesce(display_name,new.service_code) into service_label from public.service_catalog where service_code=new.service_code;
  select coalesce(full_name,'Customer') into customer_name from public.profiles where id=new.user_id;
  order_amount:='₦'||to_char(new.amount_kobo::numeric/100,'FM999,999,990.00');
  if tg_op='INSERT' then
    if admin_id is not null then
      insert into public.notifications(user_id,title,body,category)
      values(admin_id,'New service order',customer_name||' placed a '||service_label||' order for '||order_amount||'. Status: '||new.status||'.','service_order');
    end if;
    insert into public.notifications(user_id,title,body,category)
    values(new.user_id,service_label||' order received','Your order for '||order_amount||' has been received. Current status: '||new.status||'.','service_order');
    perform public.send_delajipay_telegram(
      '🛒 NEW DELAJIPAY ORDER'||E'\n\n'||'Customer: '||customer_name||E'\n'||
      'Service: '||coalesce(service_label,new.service_code)||E'\n'||
      'Amount: '||order_amount||E'\n'||
      'Status: '||new.status||E'\n'||
      'Reference: '||new.customer_reference||E'\n'||
      'Order ID: '||new.id::text
    );
    return new;
  end if;
  if old.status is distinct from new.status then
    insert into public.notifications(user_id,title,body,category)
    values(new.user_id,service_label||' order update','Your order status is now '||new.status||'.','service_order');
  end if;
  return new;
end; $$;