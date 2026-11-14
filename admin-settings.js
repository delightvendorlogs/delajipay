import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const money=kobo=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(Number(kobo||0)/100);
function notify(text,kind="info"){const n=$("settings-message");n.hidden=false;n.textContent=text;n.dataset.kind=kind;n.scrollIntoView({behavior:"smooth",block:"nearest"});}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
async function loadSettings(){
 const [settings,referrals,rewards,withdrawals,profiles]=await Promise.all([
  supabase.from("platform_settings").select("referral_base_url,referral_commission_percent").eq("singleton",true).maybeSingle(),
  supabase.from("referrals").select("id",{count:"exact",head:true}),
  supabase.from("referral_rewards").select("reward_kobo"),
  supabase.from("referral_withdrawals").select("id,user_id,amount_kobo,status,bank_name,account_name,account_number,requested_at,admin_note").eq("withdrawal_type","bank").order("requested_at",{ascending:false}).limit(200),
  supabase.from("profiles").select("id,full_name")
 ]);
 for(const result of [settings,referrals,rewards,withdrawals,profiles])if(result.error)throw result.error;
 $("referral-base-url").value=settings.data?.referral_base_url||"https://deltagp.com/";
 $("referral-commission").value=String(settings.data?.referral_commission_percent??10);
 $("settings-referrals").textContent=String(referrals.count??0);
 $("settings-pending").textContent=String((withdrawals.data||[]).filter(w=>w.status==="pending").length);
 $("settings-rewards").textContent=money((rewards.data||[]).reduce((sum,r)=>sum+Number(r.reward_kobo||0),0));
 const names=new Map((profiles.data||[]).map(p=>[p.id,p.full_name||"DelajiPay customer"]));
 const box=$("referral-withdrawals");box.replaceChildren();
 const rows=withdrawals.data||[];
 if(!rows.length){box.append(el("div","No referral bank withdrawal requests yet.","empty"));return;}
 rows.forEach(row=>{
  const card=el("article",undefined,"admin-withdrawal");
  const head=el("div",undefined,"admin-withdrawal-head");
  const identity=el("div");identity.append(el("strong",names.get(row.user_id)||"DelajiPay customer"),el("small",new Date(row.requested_at).toLocaleString("en-NG")));
  const state=el("strong",row.status.toUpperCase());head.append(identity,state);
  const amount=el("h3",money(row.amount_kobo));amount.style.margin="12px 0 4px";
  const bank=el("div","Bank: "+(row.bank_name||"—")+" · Account name: "+(row.account_name||"—"));
  const account=el("div","Account number: "+(row.account_number||"—"));
  const note=el("small",row.admin_note?"Admin note: "+row.admin_note:"");
  card.append(head,amount,bank,account);if(row.admin_note)card.append(note);
  if(row.status==="pending"){
   const actions=el("div",undefined,"actions");
   const paid=el("button","Confirm sent & mark paid","primary");
   const reject=el("button","Reject & release funds");
   paid.type=reject.type="button";
   paid.addEventListener("click",()=>review(row.id,"paid"));
   reject.addEventListener("click",()=>review(row.id,"reject"));
   actions.append(paid,reject);card.append(actions);
   card.append(el("small","Mark as paid only after you have actually sent the bank transfer."));
  }
  box.append(card);
 });
}
async function review(id,decision){
 if(decision==="paid"&&!confirm("Have you already sent this bank transfer? This only marks the request as paid; it does not send money."))return;
 const note=prompt(decision==="paid"?"Optional transfer reference or admin note:":"Reason for rejecting this request (optional):","");
 if(note===null)return;
 try{
  const {data,error}=await supabase.rpc("admin_review_referral_withdrawal",{p_withdrawal_id:id,p_decision:decision,p_note:note});
  if(error)throw error;if(!data?.ok)throw new Error("The withdrawal could not be updated.");
  notify(decision==="paid"?"Withdrawal marked as paid.":"Withdrawal rejected; reserved funds have been released.","success");
  await loadSettings();
 }catch(error){notify(error.message||"Could not review this withdrawal.","error");}
}
$("referral-settings-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const button=event.currentTarget.querySelector('button[type="submit"]');
 const base=$("referral-base-url").value.trim(),percent=Number($("referral-commission").value);
 if(!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[^\s?#]*)?\/?$/i.test(base)){notify("Enter a valid HTTPS website URL.","error");return;}
 if(!Number.isFinite(percent)||percent<0||percent>100){notify("Commission must be between 0 and 100 percent.","error");return;}
 button.disabled=true;button.textContent="Saving…";
 try{
  const {data,error}=await supabase.rpc("admin_set_referral_settings",{p_base_url:base,p_commission_percent:percent});
  if(error)throw error;
  notify("Referral website and commission rate saved. New referral links will use the updated domain; existing referral codes remain the same.","success");
  await loadSettings();
 }catch(error){notify(error.message||"Could not save settings.","error");}
 finally{button.disabled=false;button.textContent="Save referral settings";}
});
$("use-current-site").addEventListener("click",()=>{$("referral-base-url").value=new URL(".",window.location.href).href;notify("Current GitHub Pages site filled in. Save settings to apply it.","info");});
loadSettings().catch(error=>{console.error(error);notify(error.message||"Could not load admin settings. Check your administrator access.","error");});
