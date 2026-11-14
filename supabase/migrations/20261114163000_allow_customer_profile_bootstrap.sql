-- Allow a signed-in customer to create only their own missing profile row.
grant insert(id, full_name, phone) on public.profiles to authenticated;
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);
