alter table public.support_messages add column if not exists read_at timestamptz;
alter table public.support_conversations add column if not exists customer_typing_at timestamptz, add column if not exists admin_typing_at timestamptz;
create or replace function public.delajipay_support_mark_read(p_conversation_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_admin boolean:=coalesce(auth.jwt()->'app_metadata'->>'role'='admin',false);
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.support_conversations c where c.id=p_conversation_id and (v_admin or c.user_id=v_uid)) then raise exception 'Conversation access denied'; end if;
 update public.support_messages set read_at=now() where conversation_id=p_conversation_id and read_at is null and ((v_admin and sender_type='customer') or (not v_admin and sender_type='admin'));
end; $$;
create or replace function public.delajipay_support_set_typing(p_conversation_id uuid,p_is_typing boolean) returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_admin boolean:=coalesce(auth.jwt()->'app_metadata'->>'role'='admin',false);
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.support_conversations c where c.id=p_conversation_id and (v_admin or c.user_id=v_uid)) then raise exception 'Conversation access denied'; end if;
 if v_admin then update public.support_conversations set admin_typing_at=case when p_is_typing then now() else null end where id=p_conversation_id;
 else update public.support_conversations set customer_typing_at=case when p_is_typing then now() else null end where id=p_conversation_id; end if;
end; $$;
create or replace function public.delajipay_support_unread_count() returns integer language sql stable security definer set search_path=public as $$
 select count(*)::integer from public.support_messages m join public.support_conversations c on c.id=m.conversation_id where c.user_id=auth.uid() and m.sender_type='admin' and m.read_at is null;
$$;
create or replace function public.delajipay_admin_support_unread_counts() returns table(conversation_id uuid,unread_count bigint) language plpgsql stable security definer set search_path=public as $$
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role'='admin',false) is not true then raise exception 'Administrator access required'; end if;
 return query select c.id,count(m.id) from public.support_conversations c left join public.support_messages m on m.conversation_id=c.id and m.sender_type='customer' and m.read_at is null group by c.id;
end; $$;
revoke all on function public.delajipay_support_mark_read(uuid) from public,anon;
revoke all on function public.delajipay_support_set_typing(uuid,boolean) from public,anon;
revoke all on function public.delajipay_support_unread_count() from public,anon;
revoke all on function public.delajipay_admin_support_unread_counts() from public,anon;
grant execute on function public.delajipay_support_mark_read(uuid) to authenticated;
grant execute on function public.delajipay_support_set_typing(uuid,boolean) to authenticated;
grant execute on function public.delajipay_support_unread_count() to authenticated;
grant execute on function public.delajipay_admin_support_unread_counts() to authenticated;