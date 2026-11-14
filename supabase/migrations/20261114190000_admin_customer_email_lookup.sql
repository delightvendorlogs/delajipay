-- Allow authenticated administrators to retrieve emails for the customer IDs
-- already displayed in the admin customer list. Email addresses remain hidden
-- from normal profile queries and non-admin callers.
create or replace function public.admin_get_customer_emails(p_user_ids uuid[])
returns table(user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'Administrator access required.';
  end if;

  if coalesce(cardinality(p_user_ids), 0) > 1000 then
    raise exception 'A maximum of 1000 customer IDs may be requested at once.';
  end if;

  return query
    select u.id, u.email::text
    from auth.users as u
    where u.id = any(coalesce(p_user_ids, '{}'::uuid[]));
end;
$function$;

revoke all on function public.admin_get_customer_emails(uuid[]) from public, anon;
grant execute on function public.admin_get_customer_emails(uuid[]) to authenticated;
