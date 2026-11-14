-- Notify administrator accounts when a customer requests a referral bank payout.
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
  insert into public.notifications(user_id,title,body,category)
    select id,'New referral withdrawal request',
      'A customer submitted a referral bank withdrawal request. Open Admin Settings to review it.','referral'
    from auth.users where raw_app_meta_data->>'role'='admin';
  return jsonb_build_object('ok',true,'withdrawal_id',v_id,'status','pending');
end;
$$;
revoke all on function public.request_referral_bank_withdrawal(bigint,text,text,text) from public, anon;
grant execute on function public.request_referral_bank_withdrawal(bigint,text,text,text) to authenticated;
