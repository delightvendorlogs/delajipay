create or replace function public.delajipay_support_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := coalesce(auth.jwt()->'app_metadata'->>'role' = 'admin', false);
  v_is_customer boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  -- A user can be both an admin and the owner of a customer/test conversation.
  -- Ownership takes precedence when deciding which side has read the messages.
  select (c.user_id = v_uid)
    into v_is_customer
  from public.support_conversations c
  where c.id = p_conversation_id
    and (c.user_id = v_uid or v_is_admin);

  if not found then raise exception 'Conversation access denied'; end if;

  if v_is_customer then
    update public.support_messages
       set read_at = now()
     where conversation_id = p_conversation_id
       and sender_type = 'admin'
       and read_at is null;
  elsif v_is_admin then
    update public.support_messages
       set read_at = now()
     where conversation_id = p_conversation_id
       and sender_type = 'customer'
       and read_at is null;
  else
    raise exception 'Conversation access denied';
  end if;
end;
$$;

revoke all on function public.delajipay_support_mark_read(uuid) from public, anon;
grant execute on function public.delajipay_support_mark_read(uuid) to authenticated;
