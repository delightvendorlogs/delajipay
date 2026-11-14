import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id), view=document.body.dataset.adminView;
const money=k=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(Number(k||0)/100);
const dt=v=>v?new Date(v).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}):"—";
let rows=[],headers=[],renderRow=()=>[];
function note(text,kind="info"){const n=$("admin-page-message");n.hidden=false;n.textContent=text;n.dataset.kind=kind;}
function cell(tr,value){const td=document.createElement("td");td.textContent=value==null?"—":String(value);tr.append(td);return td;}
function metric(label,value){const a=document.createElement("article"),s=document.createElement("small"),b=document.createElement("strong");s.textContent=label;b.textContent=value;a.append(s,b);$("admin-page-metrics").append(a);}
function render(){
 if(view==="customers"){renderCustomers();return;}
 const q=($("admin-search").value||"").trim().toLowerCase(),body=$("admin-table-body");body.replaceChildren();
 const filtered=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q));
 if(!filtered.length){const tr=document.createElement("tr");cell(tr,rows.length?"No records match your search.":"No records found.");body.append(tr);return;}
 filtered.forEach(row=>body.append(renderRow(row)));
}
function setHeaders(names){headers=names;const tr=document.createElement("tr");names.forEach(name=>{const th=document.createElement("th");th.textContent=name;tr.append(th);});$("admin-table-head").replaceChildren(tr);}
async function customers(){
 const [list,countResult]=await Promise.all([
  supabase.from("profiles").select("id,full_name,phone,referral_code,referred_by,created_at").order("created_at",{ascending:false}).limit(1000),
  supabase.from("profiles").select("id",{count:"exact",head:true})
 ]);
 if(list.error)throw list.error;if(countResult.error)throw countResult.error;
 rows=list.data||[];
 const total=countResult.count??rows.length;
 $("total-users").textContent=Number(total).toLocaleString("en-NG");
 $("loaded-users").textContent=Number(rows.length).toLocaleString("en-NG");
 $("referred-users").textContent=Number(rows.filter(x=>x.referred_by).length).toLocaleString("en-NG");
 renderRow=r=>r;
}
function renderCustomers(){
 const q=($("admin-search").value||"").trim().toLowerCase(),list=$("customer-list");
 const filtered=rows.filter(r=>[r.full_name,r.phone,r.id,r.referral_code,r.referred_by].some(v=>String(v||"").toLowerCase().includes(q)));
 list.replaceChildren();
 $("customer-search-count").textContent=`Showing ${filtered.length.toLocaleString("en-NG")} of ${rows.length.toLocaleString("en-NG")} loaded customer profiles`;
 if(!filtered.length){const empty=document.createElement("div");empty.className="empty";empty.textContent=rows.length?"No customers match your search.":"No customer profiles found.";list.append(empty);return;}
 filtered.forEach(r=>{
  const card=document.createElement("article");card.className="customer-card";
  const head=document.createElement("div");head.className="customer-card-head";
  const name=document.createElement("strong");name.textContent=r.full_name||"Unnamed customer";
  const joined=document.createElement("span");joined.className="admin-note";joined.textContent="Joined "+dt(r.created_at);
  head.append(name,joined);
  const meta=document.createElement("div");meta.className="customer-card-meta";
  const fields=[["Phone",r.phone],["Customer ID",r.id],["Referral code",r.referral_code],["Referred by",r.referred_by||"Direct signup"]];
  fields.forEach(([label,value])=>{const box=document.createElement("div"),small=document.createElement("small"),span=document.createElement("span");small.textContent=label;span.textContent=value||"—";if(label==="Customer ID")span.className="customer-id";box.append(small,span);meta.append(box);});
  const link=document.createElement("a");link.className="btn secondary";link.href="admin-customer-details.html?id="+encodeURIComponent(r.id);link.textContent="View customer account";link.setAttribute("aria-label","View account for "+(r.full_name||"customer"));
  card.append(head,meta,link);list.append(card);
 });
}
async function wallets(){
 const [w,f,l]=await Promise.all([
  supabase.from("wallets").select("id,user_id,currency,created_at").order("created_at",{ascending:false}).limit(1000),
  supabase.from("funding_transactions").select("user_id,amount_kobo,status,gateway,gateway_reference,created_at").order("created_at",{ascending:false}).limit(500),
  supabase.from("wallet_ledger").select("user_id,entry_type,amount_kobo,description,status,reference,created_at").order("created_at",{ascending:false}).limit(500)
 ]);for(const r of [w,f,l])if(r.error)throw r.error;
 const users=[...new Set([...(w.data||[]).map(x=>x.user_id),...(f.data||[]).map(x=>x.user_id),...(l.data||[]).map(x=>x.user_id)])];
 const names={};if(users.length){const p=await supabase.from("profiles").select("id,full_name").in("id",users);if(p.error)throw p.error;(p.data||[]).forEach(x=>names[x.id]=x.full_name||"Unnamed customer");}
 const funds=f.data||[],ledger=l.data||[];metric("Wallet accounts",String((w.data||[]).length));metric("Funding events",String(funds.length));metric("Ledger entries",String(ledger.length));
 rows=[...funds.map(x=>({...x,record_type:"Funding",customer:names[x.user_id]||x.user_id})),...ledger.map(x=>({...x,record_type:"Ledger · "+x.entry_type,customer:names[x.user_id]||x.user_id}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 setHeaders(["Type","Customer","Amount","Status","Reference / description","Date"]);
 renderRow=r=>{const tr=document.createElement("tr");cell(tr,r.record_type);cell(tr,r.customer);cell(tr,money(r.amount_kobo));cell(tr,r.status);cell(tr,r.gateway_reference||r.reference||r.description||r.gateway);cell(tr,dt(r.created_at));return tr;};
}
async function orders(){
 const [o,p]=await Promise.all([
  supabase.from("service_orders").select("id,user_id,service_code,amount_kobo,provider_cost_kobo,currency,customer_reference,provider_reference,status,created_at,updated_at").order("created_at",{ascending:false}).limit(1000),
  supabase.from("profiles").select("id,full_name").limit(2000)
 ]);if(o.error)throw o.error;if(p.error)throw p.error;
 const names={};(p.data||[]).forEach(x=>names[x.id]=x.full_name||"Customer");
 rows=o.data||[];metric("Orders loaded",String(rows.length));metric("Successful",String(rows.filter(x=>["success","successful","completed"].includes((x.status||"").toLowerCase())).length));metric("Missing provider cost",String(rows.filter(x=>["success","successful","completed"].includes((x.status||"").toLowerCase())&&x.provider_cost_kobo==null).length));
 setHeaders(["Service / customer","Amount paid","Status","Provider cost (₦)","Order reference","Created"]);
 renderRow=r=>{
  const tr=document.createElement("tr");const name=cell(tr,(r.service_code||"Service")+" · "+(names[r.user_id]||r.user_id.slice(0,8)));
  cell(tr,money(r.amount_kobo));cell(tr,r.status);const cost=cell(tr,r.provider_cost_kobo==null?"Not recorded":money(r.provider_cost_kobo));
  if(["success","successful","completed"].includes((r.status||"").toLowerCase())){
   const form=document.createElement("form");form.className="admin-cost-form";const input=document.createElement("input");input.type="number";input.min="0";input.step="0.01";input.required=true;input.placeholder="Provider cost ₦";input.setAttribute("aria-label","Actual provider cost in naira");
   const button=document.createElement("button");button.type="submit";button.className="btn secondary";button.textContent="Save cost";
   form.append(input,button);cost.append(form);
   form.addEventListener("submit",async ev=>{ev.preventDefault();const amount=Number(input.value);if(!Number.isFinite(amount)||amount<0||Math.round(amount*100)!==amount*100||amount*100>Number(r.amount_kobo)){note("Enter a valid provider cost not greater than the customer payment.","error");return;}button.disabled=true;button.textContent="Saving…";try{const {data,error}=await supabase.rpc("admin_set_service_order_provider_cost",{p_order_id:r.id,p_provider_cost_kobo:Math.round(amount*100)});if(error)throw error;if(!data?.ok)throw new Error("Provider cost was not saved.");note("Verified provider cost saved. The referral reward calculation has been triggered.","success");await load();}catch(e){note(e.message||"Could not save provider cost.","error");}finally{button.disabled=false;button.textContent="Save cost";}});
  }
  cell(tr,r.customer_reference||r.provider_reference||r.id);cell(tr,dt(r.created_at));return tr;
 };
}
async function services(){
 const {data,error}=await supabase.from("service_catalog").select("id,service_code,display_name,description,is_active,sort_order,updated_at").order("sort_order");if(error)throw error;
 rows=data||[];metric("Services configured",String(rows.length));metric("Active",String(rows.filter(x=>x.is_active).length));metric("Inactive",String(rows.filter(x=>!x.is_active).length));
 setHeaders(["Service","Code","Description","Availability","Sort order","Actions"]);
 renderRow=r=>{const tr=document.createElement("tr");cell(tr,r.display_name);cell(tr,r.service_code);cell(tr,r.description||"—");cell(tr,r.is_active?"Active":"Inactive");cell(tr,r.sort_order);
 const td=document.createElement("td"),button=document.createElement("button");button.type="button";button.className="btn secondary";button.textContent=r.is_active?"Disable":"Enable";button.addEventListener("click",async()=>{button.disabled=true;try{const {error}=await supabase.from("service_catalog").update({is_active:!r.is_active,updated_at:new Date().toISOString()}).eq("id",r.id);if(error)throw error;note("Service availability updated.","success");await load();}catch(e){note(e.message||"Could not update service.","error");}finally{button.disabled=false;}});td.append(button);tr.append(td);return tr;};
}
async function load(){ $("admin-page-refresh").disabled=true;$("admin-page-refresh").textContent="Loading…";if(view!=="customers")$("admin-page-metrics").replaceChildren();try{if(view==="customers")await customers();else if(view==="wallets")await wallets();else if(view==="orders")await orders();else if(view==="services")await services();render();}catch(e){console.error(e);note(e.message||"Could not load admin records. Verify admin access and permissions.","error");}finally{$("admin-page-refresh").disabled=false;$("admin-page-refresh").textContent="Refresh";}}
$("admin-search").addEventListener("input",render);$("admin-page-refresh").addEventListener("click",load);
load();
