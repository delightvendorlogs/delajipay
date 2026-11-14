import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase = createClient(
  "https://fgkkzxfaxgkkcbkwbamx.supabase.co",
  "sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const $ = (id) => document.getElementById(id);
const money = (kobo) => new Intl.NumberFormat("en-NG", { style:"currency", currency:"NGN", minimumFractionDigits:2 }).format(Number(kobo || 0) / 100);
const date = (value) => value ? new Date(value).toLocaleString("en-NG", { dateStyle:"medium", timeStyle:"short" }) : "—";
function message(text, kind="info") {
  const node=$("referral-message"); node.hidden=false; node.textContent=text;
  node.dataset.kind=kind; node.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function item(title, detail, amount, status) {
  const node=document.createElement("article"); node.className="referral-item";
  const heading=document.createElement("strong"); heading.textContent=title;
  const meta=document.createElement("small"); meta.textContent=detail;
  node.append(heading,meta);
  if (amount !== null) { const value=document.createElement("b"); value.textContent=money(amount); value.style.display="block"; value.style.marginTop="6px"; node.append(value); }
  if (status) { const state=document.createElement("small"); state.textContent="Status: "+status; state.style.display="block"; node.append(state); }
  return node;
}
async function copyValue(value) {
  if (!value) return;
  try { await navigator.clipboard.writeText(value); message("Copied to clipboard.","success"); }
  catch {
    const field=document.createElement("textarea"); field.value=value; field.style.position="fixed"; field.style.opacity="0";
    document.body.append(field); field.select(); const ok=document.execCommand("copy"); field.remove();
    message(ok?"Copied to clipboard.":"Copy failed. Please select and copy the link manually.",ok?"success":"error");
  }
}
function showTab(name) {
  ["people","earnings","history"].forEach(key => { $("referral-tab-"+key).hidden=key!==name; });
  document.querySelectorAll("[data-ref-tab]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.refTab===name)));
}
document.querySelectorAll("[data-ref-tab]").forEach(button=>button.addEventListener("click",()=>showTab(button.dataset.refTab)));
$("show-wallet-withdraw").addEventListener("click",()=>{ $("wallet-withdraw-form").hidden=false; $("bank-withdraw-form").hidden=true; });
$("show-bank-withdraw").addEventListener("click",()=>{ $("bank-withdraw-form").hidden=false; $("wallet-withdraw-form").hidden=true; });
$("copy-code").addEventListener("click",()=>copyValue($("referral-code").value));
$("copy-link").addEventListener("click",()=>copyValue($("referral-link").value));
$("share-link").addEventListener("click",async()=>{
  const url=$("referral-link").value;
  if (!url) return;
  if (navigator.share) { try { await navigator.share({title:"Join DelajiPay",text:"Sign up with my DelajiPay referral link:",url}); } catch(error) { if(error.name!=="AbortError") message("Sharing was not available. Copy your link instead.","error"); } }
  else await copyValue("Join DelajiPay with my referral link: "+url);
});
async function loadData() {
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError) throw userError;
  if(!user){ window.location.replace("login.html?next=referrals.html"); return; }
  const [profileResult,baseResult,peopleResult,rewardResult,withdrawalResult,balanceResult]=await Promise.all([
    supabase.from("profiles").select("full_name,referral_code").eq("id",user.id).maybeSingle(),
    supabase.rpc("get_referral_base_url"),
    supabase.rpc("my_referred_people"),
    supabase.from("referral_rewards").select("id,eligible_profit_kobo,commission_percent,reward_kobo,status,created_at").eq("referrer_user_id",user.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("referral_withdrawals").select("id,amount_kobo,withdrawal_type,status,bank_name,account_number,admin_note,requested_at,paid_at").eq("user_id",user.id).order("requested_at",{ascending:false}).limit(100),
    supabase.rpc("get_my_referral_balance")
  ]);
  for (const result of [profileResult,baseResult,peopleResult,rewardResult,withdrawalResult,balanceResult]) if(result.error) throw result.error;
  const code=profileResult.data?.referral_code;
  if(!code) throw new Error("Your referral code is not ready. Refresh the page or contact support.");
  let base=String(baseResult.data||"https://deltagp.com/").trim();
  if(!base.endsWith("/")) base+="/";
  $("referral-code").value=code;
  $("referral-link").value=base+"signup.html?ref="+encodeURIComponent(code);
  const people=peopleResult.data||[], rewards=rewardResult.data||[], withdrawals=withdrawalResult.data||[];
  const totalEarned=rewards.filter(row=>row.status!=="reversed").reduce((sum,row)=>sum+Number(row.reward_kobo||0),0);
  $("referral-count").textContent=String(people.length);
  $("referral-balance").textContent=money(balanceResult.data||0);
  $("referral-earned").textContent=money(totalEarned);
  const peopleBox=$("referral-people"); peopleBox.replaceChildren();
  if(!people.length) peopleBox.append(item("No referrals yet","Share your link to invite your first customer.",null,null));
  else people.forEach(person=>peopleBox.append(item(person.full_name||"DelajiPay member","Joined "+date(person.joined_at),null,"registered")));
  const earningsBox=$("referral-earnings"); earningsBox.replaceChildren();
  if(!rewards.length) earningsBox.append(item("No referral earnings yet","Rewards appear after a referred customer's eligible service is successful and its provider cost is verified.",null,null));
  else rewards.forEach(row=>earningsBox.append(item("Referral commission","Eligible profit "+money(row.eligible_profit_kobo)+" · "+Number(row.commission_percent).toFixed(2)+"% · "+date(row.created_at),row.reward_kobo,row.status)));
  const historyBox=$("referral-history"); historyBox.replaceChildren();
  if(!withdrawals.length) historyBox.append(item("No withdrawals yet","Your wallet transfers and bank payout requests will appear here.",null,null));
  else withdrawals.forEach(row=>{
    const account=row.withdrawal_type==="bank"&&row.account_number?" · Account ending "+String(row.account_number).slice(-4):"";
    const note=row.admin_note?" · "+row.admin_note:"";
    historyBox.append(item(row.withdrawal_type==="wallet"?"Transfer to DelajiPay wallet":"Bank withdrawal",date(row.requested_at)+account+note,row.amount_kobo,row.status));
  });
}
$("wallet-withdraw-form").addEventListener("submit",async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button[type="submit"]');
  const amount=Number($("wallet-withdraw-amount").value);
  if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100){message("Enter a valid amount in naira.","error");return;}
  button.disabled=true; button.textContent="Transferring…";
  try{
    const {data,error}=await supabase.rpc("referral_withdraw_to_wallet",{p_amount_kobo:Math.round(amount*100)});
    if(error) throw error; if(!data?.ok) throw new Error(data?.reason||"Transfer could not be completed.");
    event.currentTarget.reset(); event.currentTarget.hidden=true;
    message("Referral earnings transferred to your DelajiPay wallet.","success"); await loadData();
  }catch(error){message(error.message||"Could not transfer referral earnings.","error");}
  finally{button.disabled=false;button.textContent="Transfer to Wallet";}
});
$("bank-withdraw-form").addEventListener("submit",async event=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button[type="submit"]');
  const amount=Number($("bank-withdraw-amount").value);
  if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100){message("Enter a valid amount in naira.","error");return;}
  if(!confirm("Submit this bank withdrawal request? The amount will be reserved while an administrator reviews it.")) return;
  button.disabled=true;button.textContent="Submitting…";
  try{
    const {data,error}=await supabase.rpc("request_referral_bank_withdrawal",{
      p_amount_kobo:Math.round(amount*100),p_bank_name:$("bank-name").value.trim(),
      p_account_name:$("bank-account-name").value.trim(),p_account_number:$("bank-account-number").value.trim()
    });
    if(error) throw error;if(!data?.ok) throw new Error(data?.reason||"Withdrawal request could not be submitted.");
    event.currentTarget.reset();event.currentTarget.hidden=true;
    message("Bank withdrawal request submitted. You can track its status in Withdrawal history.","success");await loadData();
  }catch(error){message(error.message||"Could not submit withdrawal request.","error");}
  finally{button.disabled=false;button.textContent="Submit bank withdrawal";}
});
loadData().catch(error=>{console.error(error);message(error.message||"Could not load referral information. Please refresh.","error");});
