import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s), feed=$("#admin-notification-feed"), feedback=$("#notify-feedback");
const {data:{session}}=await supabase.auth.getSession();
if(!session||session.user.app_metadata?.role!=="admin"){location.replace("login.html?next=admin-notifications.html");throw new Error("Admin access required");}
const date=v=>new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"});
function message(text,bad=false){feedback.hidden=false;feedback.textContent=text;feedback.dataset.kind=bad?"error":"success";}
async function loadFeed(){
 const {data,error}=await supabase.from("notifications").select("id,title,body,category,read_at,created_at").order("created_at",{ascending:false}).limit(100);
 feed.replaceChildren();if(error){feed.className="empty";feed.textContent="Could not load platform notifications.";return;}
 const events=(data||[]).filter(n=>["new_customer","service_order"].includes(n.category));
 if(!events.length){feed.className="empty";feed.textContent="No new platform activity yet.";return;}
 feed.className="";for(const n of events){const card=document.createElement("article");card.className="notify-item"+(n.read_at?"":" unread");const h=document.createElement("strong");h.textContent=n.title;const p=document.createElement("p");p.textContent=n.body;const small=document.createElement("small");small.textContent=date(n.created_at);card.append(h,p,small);feed.append(card);}
}
$("#broadcast-form").addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget;const button=form.querySelector("button");button.disabled=true;button.textContent="Sending…";
 const title=$("#broadcast-title").value.trim(),body=$("#broadcast-body").value.trim(),category=$("#broadcast-category").value;
 const {data:customers,error}=await supabase.from("profiles").select("id");
 if(error){message("Could not retrieve customer accounts. No announcement was sent.",true);button.disabled=false;button.textContent="Send to all customers";return;}
 const recipients=(customers||[]).map(x=>x.id).filter(id=>id!==session.user.id);
 if(!recipients.length){message("There are no customer accounts to notify yet.",true);}
 else{
   let sent=0,failed=false;
   for(let i=0;i<recipients.length;i+=300){const batch=recipients.slice(i,i+300).map(user_id=>({user_id,title,body,category}));const {error:insertError}=await supabase.from("notifications").insert(batch);if(insertError){failed=true;break;}sent+=batch.length;}
   message(failed?"Some notifications may not have been sent. Check the notification list before retrying.":"Announcement sent to "+sent+" customer account(s).",failed);
   if(!failed)form.reset();
 }
 button.disabled=false;button.textContent="Send to all customers";
});
await loadFeed();
supabase.channel("admin-notification-feed").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},loadFeed).subscribe();