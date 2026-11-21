import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const menu=document.querySelector(".app-mobile-menu"),nav=document.querySelector(".app-nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰";});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.textContent="☰";}));
const results=document.querySelector("#country-results"),providersBox=document.querySelector("#provider-options"),heading=document.querySelector("#provider-heading"),description=document.querySelector("#provider-description");
let countries=[],providerResults=[],selectedCountry="",selectedCountryName="";
const money=kobo=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(kobo||0)/100);
function note(parent,message){const p=document.createElement("div");p.className="app-empty";p.textContent=message;parent.replaceChildren(p);}
function renderCountries(){
 if(!results)return;
 const q=(document.querySelector("#country-search")?.value||new URLSearchParams(location.search).get("q")||"").trim().toLowerCase();
 const filtered=countries.filter(c=>(c.name+" "+c.code+" "+(c.aliases||[]).join(" ")).toLowerCase().includes(q));
 results.replaceChildren();
 if(!filtered.length){note(results,"No matching countries in the connected provider catalogue.");return;}
 for(const country of filtered){
  const row=document.createElement("div");row.className="app-country-result";
  const left=document.createElement("div"),name=document.createElement("span"),meta=document.createElement("small"),button=document.createElement("button");
  name.textContent=(country.flag?country.flag+" ":"")+country.name;
  meta.textContent=country.code==="US"?"Fetch SMS · TextVerified":"VirtualSMS";
  button.type="button";button.textContent="View services";button.addEventListener("click",()=>loadServices(country.code,country.name));
  left.append(name,meta);row.append(left,button);results.append(row);
 }
}
async function invokeOrder(body,headers={}){
 const {data,error}=await supabase.functions.invoke("sparkle-sms-orders",{body,headers});
 if(error)throw error;
 if(data?.success===false)throw new Error(data.error||"The request could not be completed.");
 return data;
}
function renderServices(data){
 if(!providersBox)return;
 providerResults=data.providers||[];
 providersBox.replaceChildren();
 const q=(document.querySelector("#service-search")?.value||"").trim().toLowerCase();
 let totalServices=0;
 for(const provider of providerResults){
  const card=document.createElement("article");card.className="provider-card";
  const h=document.createElement("h3");h.textContent=provider.provider_name;
  const p=document.createElement("p");p.textContent=provider.error||((provider.services||[]).length+" services returned by provider");
  const region=document.createElement("div");region.className="provider-region";region.textContent=provider.country==="US"?"UNITED STATES":"INTERNATIONAL";
  card.append(h,p,region);
  if(provider.error){const e=document.createElement("p");e.textContent="This provider catalogue is temporarily unavailable.";card.append(e);}
  else{
   const list=document.createElement("div");list.className="app-list";
   const services=(provider.services||[]).filter(s=>!q||String(s.name).toLowerCase().includes(q)||String(s.code).toLowerCase().includes(q));
   totalServices+=services.length;
   for(const service of services.slice(0,80)){
    const item=document.createElement("div");item.className="app-list-row";
    const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),actions=document.createElement("div");
    title.textContent=service.name;
    meta.textContent=service.available===false?"Currently unavailable":service.available_count!==null&&service.available_count!==undefined?service.available_count+" available":"Check live availability";
    detail.append(title,meta);actions.style.display="grid";actions.style.gap="7px";
    const quoteButton=document.createElement("button");quoteButton.type="button";quoteButton.className="app-button secondary";quoteButton.textContent="Check price";
    const quoteResult=document.createElement("div");quoteResult.style.fontSize="10px";quoteResult.style.color="#9bdff1";
    quoteButton.disabled=service.available===false;
    quoteButton.addEventListener("click",async()=>{
      quoteButton.disabled=true;quoteButton.textContent="Checking…";quoteResult.textContent="";
      try{
       const quote=await invokeOrder({action:"quote",provider_key:provider.provider_key,country_iso:selectedCountry,service_code:service.code,service_name:service.name});
       quoteResult.textContent="Price: "+money(quote.customer_price_kobo);
       const buy=document.createElement("button");buy.type="button";buy.className="app-button";buy.textContent="Purchase number";
       buy.addEventListener("click",async()=>{
        if(!confirm("Purchase a "+selectedCountryName+" number for "+service.name+" at "+money(quote.customer_price_kobo)+"?"))return;
        buy.disabled=true;buy.textContent="Submitting…";
        try{
         const result=await invokeOrder({action:"purchase",provider_key:provider.provider_key,country_iso:selectedCountry,country_name:selectedCountryName,service_code:service.code,service_name:service.name},{"Idempotency-Key":crypto.randomUUID()});
         quoteResult.textContent=result.order?.phone_number?"Number: "+result.order.phone_number+" · Order saved.":"Your order is being confirmed. Do not submit another purchase.";
         buy.textContent="Open SMS inbox";buy.disabled=false;buy.onclick=()=>location.href="inbox.html";
        }catch(error){quoteResult.textContent=error.message||"Purchase could not be completed.";buy.disabled=false;buy.textContent="Try again";}
       });
       actions.append(buy);
      }catch(error){quoteResult.textContent=error.message||"Price could not be retrieved.";}
      finally{quoteButton.textContent="Refresh price";quoteButton.disabled=false;}
    });
    actions.append(quoteButton,quoteResult);item.append(detail,actions);list.append(item);
   }
   if(!services.length){const empty=document.createElement("p");empty.textContent=q?"No services match this search.":"No services were returned by this provider.";card.append(empty);}else card.append(list);
  }
  providersBox.append(card);
 }
 if(totalServices===0&&!providerResults.some(p=>p.error)){const footer=document.createElement("div");footer.className="app-note";footer.textContent="No services match the current search. Try another service name.";providersBox.append(footer);}
}
async function loadCountries(){
 if(!results)return;
 note(results,"Loading live country catalogue…");
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries"}});
  if(error)throw error;
  countries=data?.countries||[];
  renderCountries();
 }catch(error){note(results,"The country catalogue could not load. Provider API credentials may still need to be added.");console.warn("Sparkle country catalogue:",error);}
}
async function loadServices(country,name){
 if(!providersBox)return;
 selectedCountry=country;selectedCountryName=name||country;
 heading.textContent=selectedCountryName+" services";
 description.textContent=country==="US"?"USA results combine Fetch SMS and TextVerified.":"International results come from VirtualSMS; USA is excluded from this provider.";
 note(providersBox,"Loading provider services…");
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"services",country}});
  if(error)throw error;
  renderServices(data||{providers:[]});
 }catch(error){note(providersBox,"The service catalogue is unavailable for this country. Check provider API credentials and try again.");console.warn("Sparkle services:",error);}
}
document.querySelector("#country-search")?.addEventListener("input",renderCountries);
document.querySelector("#service-search")?.addEventListener("input",()=>{if(selectedCountry&&providerResults.length)renderServices({providers:providerResults});});
document.querySelectorAll("[data-country]").forEach(button=>button.addEventListener("click",()=>loadServices(button.dataset.country,button.dataset.country==="US"?"United States":"International destinations")));
const dashboardSearch=document.querySelector("#dashboard-number-search");
dashboardSearch?.addEventListener("keydown",event=>{if(event.key==="Enter")location.href="numbers.html?q="+encodeURIComponent(dashboardSearch.value);});
async function loadSmsOrders(){
 const box=document.querySelector("#sms-orders");if(!box)return;
 note(box,"Loading your SMS orders…");
 try{
  const data=await invokeOrder({action:"orders"});const orders=data.orders||[];box.replaceChildren();
  if(!orders.length){note(box,"No number purchases yet. Choose a supported country to get started.");return;}
  box.className="app-list";
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
if(results)void loadCountries();
if(document.querySelector("#sms-orders"))void loadSmsOrders();

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
