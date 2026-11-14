create or replace function public.admin_set_service_order_provider_cost(p_order_id uuid,p_provider_cost_kobo bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_order public.service_orders%rowtype;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then
   raise exception 'Administrator access is required.';
 end if;
 if p_provider_cost_kobo is null or p_provider_cost_kobo<0 then raise exception 'Enter a valid provider cost.'; end if;
 select * into v_order from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'Service order not found.'; end if;
 if lower(v_order.status) not in ('success','successful','completed') then
   raise exception 'Provider cost can only be recorded for a successful service order.';
 end if;
 if p_provider_cost_kobo>v_order.amount_kobo then raise exception 'Provider cost cannot exceed the customer payment.'; end if;
 update public.service_orders set provider_cost_kobo=p_provider_cost_kobo,updated_at=now() where id=p_order_id;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,details)
 values(auth.uid(),'set_service_order_provider_cost','service_order',p_order_id::text,
   jsonb_build_object('provider_cost_kobo',p_provider_cost_kobo,'customer_amount_kobo',v_order.amount_kobo));
 return jsonb_build_object('ok',true,'order_id',p_order_id,'provider_cost_kobo',p_provider_cost_kobo);
end;
$$;
revoke all on function public.admin_set_service_order_provider_cost(uuid,bigint) from public,anon;
grant execute on function public.admin_set_service_order_provider_cost(uuid,bigint) to authenticated;
