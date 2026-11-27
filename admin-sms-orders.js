import {createClient} from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id),money=k=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(Number(k||0)/100),date=v=>v?new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"—";
const {data:{session},error:authError}=await supabase.auth.getSession();
if(authError||!session){location.replace("login.html?next=admin-sms-orders.html");throw new Error("Authentication required");}
let isAdmin=session.user.app_metadata?.role==="admin";
if(!isAdmin){try{const {data}=await supabase.rpc("is_admin");isAdmin=data===true||data==="true"||(Array.isArray(data)&&data.some(x=>x===true));}catch{}}
if(!isAdmin){try{const {data:row}=await supabase.from("admin_users").select("user_id").eq("user_id",session.user.id).maybeSingle();isAdmin=!!row;}catch{}}
if(!isAdmin){location.replace("dashboard.html");throw new Error("Administrator access required");}
let allOrders=[];
function notice(message,kind="info"){const n=$("sms-orders-message");n.hidden=false;n.textContent=message;n.dataset.kind=kind;}
function render(){
 const q=$("sms-order-search").value.trim().toLowerCase(),status=$("sms-order-status").value;
 const rows=allOrders.filter(o=>(!status||o.status===status)&&[o.id,o.user_id,o.provider_key,o.country_name,o.country_iso,o.service_name,o.phone_number,o.provider_order_id,o.otp_code,o.status].some(v=>String(v||"").toLowerCase().includes(q)));
 $("sms-order-count").textContent=rows.length+" of "+allOrders.length+" orders";
 const body=$("sms-orders-body");body.replaceChildren();
 if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=9;td.className="empty";td.textContent=allOrders.length?"No orders match these filters.":"No SMS number orders have been placed yet.";tr.append(td);body.append(tr);return;}
 for(const o of rows){const tr=document.createElement("tr");const values=[date(o.created_at),o.country_name+" · "+o.service_name,o.provider_key,o.phone_number||"Number pending",o.status,money(o.customer_price_kobo),o.otp_code||"—",String(o.user_id||"").slice(0,8),String(o.id||"").slice(0,8)];for(let i=0;i<values.length;i++){const td=document.createElement("td");td.textContent=values[i]||"—";if(i===4){td.className="status-cell";td.dataset.status=o.status;}tr.append(td);}body.append(tr);}
}
async function load(){
 const button=$("sms-orders-refresh");button.disabled=true;button.textContent="Loading…";
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-orders",{body:{action:"admin-orders"}});if(error){let msg=error.message;try{msg=(await error.context.clone().json())?.error||msg;}catch{}throw new Error(msg);}if(!data?.success)throw new Error(data?.error||"Could not load SMS orders.");
 allOrders=Array.isArray(data.orders)?data.orders:[];const statuses=[...new Set(allOrders.map(o=>o.status).filter(Boolean))].sort();const select=$("sms-order-status"),previous=select.value;select.replaceChildren(new Option("All statuses",""));statuses.forEach(s=>select.add(new Option(s,s)));select.value=statuses.includes(previous)?previous:"";render();
 $("sms-order-total").textContent=String(allOrders.length);$("sms-order-pending").textContent=String(allOrders.filter(o=>["waiting","unknown","creating","pending"].includes(String(o.status).toLowerCase())).length);$("sms-order-completed").textContent=String(allOrders.filter(o=>["received","completed","success","successful"].includes(String(o.status).toLowerCase())).length);
 $("sms-order-updated").textContent="Updated "+new Date().toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"});
 }catch(e){notice(e.message||"Could not load SMS orders. Check admin access.","error");}
 finally{button.disabled=false;button.textContent="Refresh orders";}
}
$("sms-orders-refresh").addEventListener("click",load);$("sms-order-search").addEventListener("input",render);$("sms-order-status").addEventListener("change",render);
await load();
