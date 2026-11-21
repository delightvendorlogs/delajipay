import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const menu=document.querySelector(".app-mobile-menu"),nav=document.querySelector(".app-nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰";});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.textContent="☰";}));
const results=document.querySelector("#country-results"),providersBox=document.querySelector("#provider-options"),heading=document.querySelector("#provider-heading"),description=document.querySelector("#provider-description");
let countries=[],serviceResults=[],selectedCountry="US",selectedCountryName="United States",activeCatalog="usa",catalogRequest=0;
const money=kobo=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(kobo||0)/100);
function note(parent,message){if(!parent)return;const p=document.createElement("div");p.className="app-empty";p.textContent=message;parent.replaceChildren(p);}
function setCatalog(mode){
 activeCatalog=mode==="all"?"all":"usa";
 document.querySelectorAll("[data-catalog-tab]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.catalogTab===activeCatalog)));
 const picker=document.querySelector("#all-country-picker"),usaIntro=document.querySelector("#usa-intro");
 if(picker)picker.hidden=activeCatalog!=="all";if(usaIntro)usaIntro.hidden=activeCatalog!=="usa";
 const search=document.querySelector("#service-search");if(search)search.value="";
 if(activeCatalog==="usa"){
  selectedCountry="US";selectedCountryName="United States";
  if(heading)heading.textContent="USA services";if(description)description.textContent="Choose a service to see its customer price.";
  void loadServices("US","United States","usa");
 }else{
  selectedCountry="";selectedCountryName="";
  if(heading)heading.textContent="Choose a country first";if(description)description.textContent="Select a country to browse its available services.";
  note(providersBox,"Select a country to see available services.");renderCountries();
 }
}
function renderCountries(){
 if(!results)return;const q=(document.querySelector("#country-search")?.value||"").trim().toLowerCase();
 const filtered=countries.filter(c=>(String(c.name||"")+" "+String(c.code||"")+" "+(c.aliases||[]).join(" ")).toLowerCase().includes(q));
 results.replaceChildren();if(!filtered.length){note(results,"No matching countries. Try another search.");return;}
 for(const country of filtered){const row=document.createElement("button");row.type="button";row.className="app-country-result country-choice";const name=document.createElement("strong"),meta=document.createElement("small");name.textContent=(country.flag?country.flag+" ":"")+country.name;meta.textContent=country.code==="US"?"United States":"Available destination";row.append(name,meta);row.addEventListener("click",()=>loadServices(country.code,country.name,"all"));results.append(row);}
}
async function invokeOrder(body,headers={}){const {data,error}=await supabase.functions.invoke("sparkle-sms-orders",{body,headers});if(error)throw error;if(data?.success===false)throw new Error(data.error||"The request could not be completed.");return data;}
function renderServices(data){
 if(!providersBox)return;serviceResults=data.services||[];providersBox.replaceChildren();
 const q=(document.querySelector("#service-search")?.value||"").trim().toLowerCase(),services=serviceResults.filter(s=>!q||String(s.name).toLowerCase().includes(q));
 if(!services.length){note(providersBox,q?"No services match this search.":"No services are currently available for this destination.");return;}
 const list=document.createElement("div");list.className="app-list";
 for(const service of services.slice(0,100)){
  const item=document.createElement("article");item.className="app-list-row";const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),actions=document.createElement("div");
  title.textContent=service.name;meta.textContent=service.available===false?"Currently unavailable":service.available_count!==null&&service.available_count!==undefined?service.available_count+" available":"Availability checked at purchase";detail.append(title,meta);actions.className="service-actions";
  const quoteButton=document.createElement("button");quoteButton.type="button";quoteButton.className="app-button secondary";quoteButton.textContent="View price";quoteButton.disabled=service.available===false;const result=document.createElement("div");result.className="service-price-result";
  quoteButton.addEventListener("click",async()=>{
   quoteButton.disabled=true;quoteButton.textContent="Checking…";result.textContent="";
   try{
    const quote=await invokeOrder({action:"quote",catalogue:activeCatalog,country_iso:selectedCountry,service_ref:service.ref});result.textContent="Price "+money(quote.customer_price_kobo);
    const buy=document.createElement("button");buy.type="button";buy.className="app-button";buy.textContent="Get this number";const idempotencyKey=crypto.randomUUID();
    buy.addEventListener("click",async()=>{
     if(!confirm("Get a "+selectedCountryName+" number for "+service.name+" at "+money(quote.customer_price_kobo)+"?"))return;
     buy.disabled=true;buy.textContent="Processing…";
     try{const purchase=await invokeOrder({action:"purchase",catalogue:activeCatalog,country_iso:selectedCountry,country_name:selectedCountryName,service_ref:service.ref},{"Idempotency-Key":idempotencyKey});result.textContent=purchase.order?.phone_number?"Your number: "+purchase.order.phone_number:"Your number request is being confirmed.";buy.textContent="Open SMS inbox";buy.disabled=false;buy.onclick=()=>location.href="inbox.html";}
     catch(error){result.textContent=error.message||"The request could not be completed.";buy.disabled=false;buy.textContent="Try again";}
    });actions.append(buy);
   }catch(error){result.textContent=error.message||"Price is temporarily unavailable.";}
   finally{quoteButton.textContent="Refresh price";quoteButton.disabled=false;}
  });
  actions.append(quoteButton,result);item.append(detail,actions);list.append(item);
 }
 providersBox.append(list);
}
async function loadCountries(){
 if(!results)return;note(results,"Loading available countries…");
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries"}});if(error)throw error;countries=data?.countries||[];renderCountries();}
 catch(error){note(results,"We couldn't load the country list. Please try again shortly.");console.warn("Country catalogue:",error);}
}
async function loadServices(country,name,mode=activeCatalog){
 if(!providersBox)return;const request=++catalogRequest;selectedCountry=country;selectedCountryName=name||country;
 if(heading)heading.textContent=mode==="usa"?"USA services":selectedCountryName+" services";if(description)description.textContent="Choose a service to see its customer price.";
 note(providersBox,"Loading available services…");
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"services",country,mode}});if(error)throw error;if(request!==catalogRequest)return;renderServices(data||{services:[]});}
 catch(error){if(request===catalogRequest)note(providersBox,"Services are temporarily unavailable. Please try again.");console.warn("Service catalogue:",error);}
}
document.querySelectorAll("[data-catalog-tab]").forEach(button=>button.addEventListener("click",()=>setCatalog(button.dataset.catalogTab)));
document.querySelector("#country-search")?.addEventListener("input",renderCountries);
document.querySelector("#service-search")?.addEventListener("input",()=>renderServices({services:serviceResults}));
const dashboardSearch=document.querySelector("#dashboard-number-search");dashboardSearch?.addEventListener("keydown",event=>{if(event.key==="Enter")location.href="numbers.html?tab=all&q="+encodeURIComponent(dashboardSearch.value);});
if(results){void loadCountries().then(()=>{const params=new URLSearchParams(location.search);if(params.get("tab")==="all"){setCatalog("all");const q=params.get("q")||"",search=document.querySelector("#country-search");if(search){search.value=q;renderCountries();}}else setCatalog("usa");});}
let inboxPollTimer=null,inboxPolling=false;
async function loadSmsOrders(){
 const box=document.querySelector("#sms-orders");if(!box)return;
 note(box,"Loading your SMS orders…");
 try{
  const data=await invokeOrder({action:"orders"});const orders=data.orders||[];box.replaceChildren();
  if(!orders.length){note(box,"No number purchases yet. Choose a supported country to get started.");return;}
  box.className="app-list";
  const pendingOrders=orders.filter(order=>["waiting","unknown","creating"].includes(order.status)).slice(0,5);
  if(inboxPollTimer){clearTimeout(inboxPollTimer);inboxPollTimer=null;}
  if(pendingOrders.length){
   inboxPollTimer=setTimeout(async()=>{
    if(document.visibilityState!=="visible"||inboxPolling)return;
    inboxPolling=true;
    try{for(const pending of pendingOrders)await invokeOrder({action:"status",order_id:pending.id});}
    catch(error){console.warn("Sparkle background status check:",error);}
    finally{inboxPolling=false;void loadSmsOrders();}
   },15000);
  }
  for(const order of orders){
   const card=document.createElement("article");card.className="app-panel";card.style.marginTop="0";
   const title=document.createElement("h2");title.textContent=order.service_name+" · "+order.country_name;
   const number=document.createElement("p");number.className="app-panel-intro";number.textContent=order.phone_number||"Number confirmation pending";
   const status=document.createElement("div");status.className="provider-region";status.textContent=String(order.status||"pending").toUpperCase();
   card.append(title,number,status);
   if(order.otp_code){const code=document.createElement("div");code.className="message-code";code.style.marginTop="12px";const value=document.createElement("strong");value.textContent=order.otp_code;const copy=document.createElement("button");copy.type="button";copy.className="app-button secondary";copy.textContent="Copy code";copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(order.otp_code);copy.textContent="Copied";}catch{copy.textContent="Copy unavailable";}});code.append(value,copy);card.append(code);}
   if(order.sms_text){const message=document.createElement("p");message.style.fontSize="11px";message.textContent=order.sms_text;card.append(message);}
   const meta=document.createElement("small");meta.style.color="#8ea5c0";meta.textContent=new Date(order.created_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})+" · "+money(order.customer_price_kobo);card.append(meta);
   if(["waiting","unknown","creating"].includes(order.status)){
    const refresh=document.createElement("button");refresh.type="button";refresh.className="app-button secondary";refresh.textContent="Refresh status";
    refresh.addEventListener("click",async()=>{refresh.disabled=true;refresh.textContent="Checking…";try{await invokeOrder({action:"status",order_id:order.id});await loadSmsOrders();}catch(error){refresh.disabled=false;refresh.textContent="Try again";alert(error.message||"Could not refresh order status.");}});
    const cancel=document.createElement("button");cancel.type="button";cancel.className="app-button secondary";cancel.textContent="Cancel request";
    cancel.addEventListener("click",async()=>{if(!confirm("Try to cancel this verification? A received message cannot be refunded."))return;cancel.disabled=true;cancel.textContent="Cancelling…";try{await invokeOrder({action:"cancel",order_id:order.id});await loadSmsOrders();}catch(error){cancel.disabled=false;cancel.textContent="Try again";alert(error.message||"Cancellation could not be confirmed.");}});
    card.append(refresh,cancel);
   }
   box.append(card);
  }
 }catch(error){note(box,"Your SMS orders could not be loaded. Please refresh and try again.");console.warn("Sparkle orders:",error);}
}
const initialParams=new URLSearchParams(location.search);
if(results){
 void loadCountries().then(()=>{
  setCatalog(initialParams.get("tab")==="all"?"all":"usa");
  const initialQuery=initialParams.get("q")||"";
  const search=document.querySelector("#country-search");
  if(search&&initialQuery){setCatalog("all");search.value=initialQuery;renderCountries();}
 });
}
if(document.querySelector("#sms-orders")){
 void loadSmsOrders();
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void loadSmsOrders();});
}

const pricingForm=document.querySelector("#pricing-form"),pricingList=document.querySelector("#pricing-rules"),pricingMessage=document.querySelector("#pricing-message"),pricingMode=document.querySelector("#pricing-mode");
function showPricingMessage(message,kind="info"){if(!pricingMessage)return;pricingMessage.hidden=false;pricingMessage.textContent=message;pricingMessage.dataset.kind=kind;}
function syncPricingMode(){const fixed=pricingMode?.value==="fixed";const markup=document.querySelector("#pricing-markup"),price=document.querySelector("#pricing-fixed");if(markup)markup.disabled=fixed;if(price)price.disabled=!fixed;}
pricingMode?.addEventListener("change",syncPricingMode);syncPricingMode();
async function loadPricingRules(){
 if(!pricingList)return;
 note(pricingList,"Loading pricing rules…");
 try{
  const data=await invokeOrder({action:"pricing-list"});const rules=data.rules||[];pricingList.replaceChildren();
  if(!rules.length){note(pricingList,"No pricing rules are configured.");return;}
  for(const rule of rules){
   const row=document.createElement("article");row.className="app-list-row";
   const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
   title.textContent=rule.provider_key+" · "+rule.country_iso+" · "+rule.service_code;
   meta.textContent=rule.pricing_mode==="fixed"?"Fixed price: "+money(rule.fixed_price_kobo):"Markup: "+Number(rule.markup_percent).toLocaleString("en-NG")+"%";
   info.append(title,meta);
   const edit=document.createElement("button");edit.type="button";edit.className="app-button secondary";edit.textContent="Edit";
   edit.addEventListener("click",()=>{document.querySelector("#pricing-provider").value=rule.provider_key;document.querySelector("#pricing-country").value=rule.country_iso;document.querySelector("#pricing-service").value=rule.service_code;document.querySelector("#pricing-mode").value=rule.pricing_mode;document.querySelector("#pricing-markup").value=rule.markup_percent;document.querySelector("#pricing-fixed").value=rule.fixed_price_kobo?Number(rule.fixed_price_kobo)/100:"";syncPricingMode();pricingForm.scrollIntoView({behavior:"smooth",block:"start"});});
   row.append(info,edit);pricingList.append(row);
  }
 }catch(error){note(pricingList,error.message||"Pricing rules could not be loaded.");}
}
pricingForm?.addEventListener("submit",async event=>{
 event.preventDefault();const button=document.querySelector("#pricing-save");button.disabled=true;button.textContent="Saving…";
 try{
  await invokeOrder({action:"pricing-save",provider_key:document.querySelector("#pricing-provider").value,country_iso:document.querySelector("#pricing-country").value.trim(),service_code:document.querySelector("#pricing-service").value.trim()||"*",pricing_mode:document.querySelector("#pricing-mode").value,markup_percent:Number(document.querySelector("#pricing-markup").value),fixed_price_ngn:Number(document.querySelector("#pricing-fixed").value)});
  showPricingMessage("Pricing rule saved.", "success");await loadPricingRules();
 }catch(error){showPricingMessage(error.message||"Pricing rule could not be saved.","error");}
 finally{button.disabled=false;button.textContent="Save pricing rule";}
});
if(pricingList)void loadPricingRules();

async function loadAdminSmsOrders(){
 const box=document.querySelector("#admin-sms-orders");if(!box)return;
 note(box,"Loading SMS orders…");
 try{
  const data=await invokeOrder({action:"admin-orders"}),orders=data.orders||[];box.replaceChildren();
  if(!orders.length){note(box,"No Sparkle SMS orders have been placed yet.");return;}
  box.className="app-list";
  for(const order of orders){
   const row=document.createElement("article");row.className="app-panel";row.style.marginTop="0";
   const title=document.createElement("h2");title.textContent=order.service_name+" · "+order.country_name;
   const meta=document.createElement("p");meta.className="app-panel-intro";meta.textContent=[order.provider_key,order.phone_number||"Number pending","User "+String(order.user_id).slice(0,8),new Date(order.created_at).toLocaleString("en-NG")].join(" · ");
   const status=document.createElement("div");status.className="provider-region";status.textContent=String(order.status).toUpperCase()+" · "+money(order.customer_price_kobo);
   row.append(title,meta,status);
   if(order.otp_code){const code=document.createElement("p");code.style.color="#8de5f4";code.textContent="SMS code: "+order.otp_code;row.append(code);}
   if(order.sms_text){const sms=document.createElement("p");sms.style.fontSize="10px";sms.textContent=order.sms_text;row.append(sms);}
   if(order.provider_order_id&&["waiting","unknown","creating"].includes(order.status)){
    const refresh=document.createElement("button");refresh.type="button";refresh.className="app-button secondary";refresh.textContent="Check provider status";
    refresh.addEventListener("click",async()=>{refresh.disabled=true;refresh.textContent="Checking…";try{await invokeOrder({action:"status",order_id:order.id});await loadAdminSmsOrders();}catch(error){refresh.disabled=false;refresh.textContent="Try again";alert(error.message||"Status check failed.");}});
    row.append(refresh);
   }
   box.append(row);
  }
 }catch(error){note(box,error.message||"SMS order records could not be loaded.");}
}
if(document.querySelector("#admin-sms-orders"))void loadAdminSmsOrders();

async function loadDashboardSmsOrders(){
 const box=document.querySelector("#dashboard-sms-orders");if(!box)return;
 note(box,"Loading your latest number orders…");
 try{
  const data=await invokeOrder({action:"orders"}),orders=(data.orders||[]).slice(0,3);box.replaceChildren();
  if(!orders.length){note(box,"No number orders yet. Explore the catalogue to get started.");return;}
  box.className="app-list";
  for(const order of orders){
   const row=document.createElement("article");row.className="app-list-row";
   const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),status=document.createElement("span");
   title.textContent=order.service_name+" · "+order.country_name;
   meta.textContent=order.phone_number||"Number confirmation pending";
   status.className="provider-region";status.textContent=String(order.status||"pending").toUpperCase();
   info.append(title,meta);row.append(info,status);box.append(row);
  }
  const link=document.createElement("a");link.className="app-button secondary";link.href="inbox.html";link.textContent="Open SMS inbox";link.style.marginTop="10px";box.append(link);
 }catch(error){note(box,"Your number activity could not be loaded. Open the inbox to try again.");}
}
if(document.querySelector("#dashboard-sms-orders"))void loadDashboardSmsOrders();
