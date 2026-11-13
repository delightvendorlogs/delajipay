create policy "Admins can create customer notifications"
on public.notifications for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.delajipay_notify_new_customer()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare admin_id uuid; customer_name text;
begin
  select id into admin_id from auth.users where raw_app_meta_data ->> 'role' = 'admin' order by created_at asc limit 1;
  customer_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'New customer');
  if admin_id is not null then
    insert into public.notifications(user_id,title,body,category)
    values(admin_id,'New DelajiPay customer',customer_name || ' just created a DelajiPay account.','new_customer');
  end if;
  insert into public.notifications(user_id,title,body,category)
  values(new.id,'Welcome to DelajiPay','Your account has been created. You can now explore your dashboard and available services.','account');
  return new;
end; $$;

drop trigger if exists delajipay_new_customer_notification on auth.users;
create trigger delajipay_new_customer_notification after insert on auth.users
for each row execute function public.delajipay_notify_new_customer();

create or replace function public.delajipay_notify_service_order()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare admin_id uuid; service_label text; customer_name text; order_amount text;
begin
  select id into admin_id from auth.users where raw_app_meta_data ->> 'role' = 'admin' order by created_at asc limit 1;
  select coalesce(display_name,new.service_code) into service_label from public.service_catalog where service_code=new.service_code;
  select coalesce(full_name,'Customer') into customer_name from public.profiles where id=new.user_id;
  order_amount := '₦' || to_char(new.amount_kobo::numeric/100,'FM999,999,990.00');
  if tg_op='INSERT' then
    if admin_id is not null then
      insert into public.notifications(user_id,title,body,category)
      values(admin_id,'New service order',customer_name || ' placed a ' || service_label || ' order for ' || order_amount || '. Status: ' || new.status || '.','service_order');
    end if;
    insert into public.notifications(user_id,title,body,category)
    values(new.user_id,service_label || ' order received','Your order for ' || order_amount || ' has been received. Current status: ' || new.status || '.','service_order');
    return new;
  end if;
  if old.status is distinct from new.status then
    insert into public.notifications(user_id,title,body,category)
    values(new.user_id,service_label || ' order update','Your order status is now ' || new.status || '.','service_order');
  end if;
  return new;
end; $$;

drop trigger if exists delajipay_service_order_insert_notification on public.service_orders;
create trigger delajipay_service_order_insert_notification after insert on public.service_orders
for each row execute function public.delajipay_notify_service_order();

drop trigger if exists delajipay_service_order_update_notification on public.service_orders;
create trigger delajipay_service_order_update_notification after update of status on public.service_orders
for each row execute function public.delajipay_notify_service_order();