import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const menu=document.querySelector(".app-mobile-menu"),nav=document.querySelector(".app-nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰";});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.textContent="☰";}));
const countrySelect=document.querySelector("#country-select"),serviceSelect=document.querySelector("#service-select"),providersBox=document.querySelector("#provider-options"),heading=document.querySelector("#provider-heading"),description=document.querySelector("#provider-description");
let countries=[],serviceResults=[],selectedCountry="US",selectedCountryName="United States",activeCatalog="usa",catalogRequest=0,selectedService=null;
const money=kobo=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(kobo||0)/100);
function note(parent,message){if(!parent)return;const p=document.createElement("div");p.className="app-empty";p.textContent=message;parent.replaceChildren(p);}
function fillSelect(select,items,placeholder,valueOf,labelOf,disabled=false){
 if(!select)return;select.replaceChildren();const first=document.createElement("option");first.value="";first.textContent=placeholder;select.append(first);
 for(const item of items){const option=document.createElement("option");option.value=valueOf(item);option.textContent=labelOf(item);select.append(option);}
 select.disabled=disabled||!items.length;select.value="";
}

function mountSearchPicker(inputId,listId,getItems,getValue,getLabel,onPick){
 const input=document.getElementById(inputId),list=document.getElementById(listId);if(!input||!list)return;
 let open=false,selectedLabel="";
 const close=()=>{open=false;list.hidden=true;input.setAttribute("aria-expanded","false");if(selectedLabel)input.value=selectedLabel;};
 const render=()=>{
  const q=input.value.trim().toLocaleLowerCase();
  const items=(getItems()||[]).map(item=>({item,label:getLabel(item),value:String(getValue(item))}));
  const filtered=items.filter(x=>!q||x.label.toLocaleLowerCase().includes(q)||String(x.value).toLocaleLowerCase()===q||x.label.toLocaleLowerCase().startsWith(q));
  filtered.sort((a,b)=>{if(!q)return 0;const aa=a.label.toLocaleLowerCase(),bb=b.label.toLocaleLowerCase();return Number(!aa.startsWith(q))-Number(!bb.startsWith(q))||aa.localeCompare(bb);});
  list.replaceChildren();
  if(!filtered.length){const empty=document.createElement("div");empty.className="search-picker-empty";empty.textContent="No matching options";list.append(empty);}
  for(const entry of filtered){
   const option=document.createElement("button");option.type="button";option.className="search-picker-option";option.setAttribute("role","option");option.textContent=entry.label;
   option.addEventListener("click",()=>{input.value=entry.label;selectedLabel=entry.label;onPick(entry.item);close();});
   list.append(option);
  }
  list.hidden=!open;input.setAttribute("aria-expanded",String(open));
 };
 input.addEventListener("focus",()=>{if(selectedLabel&&input.value===selectedLabel)input.value="";open=true;render();});
 input.addEventListener("click",()=>{open=true;render();});
 input.addEventListener("input",()=>{open=true;render();});
 input.addEventListener("keydown",event=>{if(event.key==="Escape")close();if(event.key==="ArrowDown"){open=true;render();list.querySelector("button")?.focus();}});
 document.addEventListener("click",event=>{if(!input.parentElement.contains(event.target)){close();}});
 return {render,close,setValue(value){input.value=value||"";selectedLabel=input.value;},clear(){input.value="";selectedLabel="";close();}};
}
function countryAliases(country){
 const code=String(country.code||"").toUpperCase(),name=String(country.name||"");
 return [name,code,...(country.aliases||[]),...(code==="GB"?["UK","United Kingdom","Britain","Great Britain"]:[]),...(code==="US"?["USA","US","United States","United States of America"]:[])].join(" ").toLowerCase();
}

let countryPicker,servicePicker;
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
  fillSelect(serviceSelect,[],"Choose a country first",x=>x.ref,x=>x.name,true);
  note(providersBox,"Select a country to see available services.");
  if(countrySelect)countrySelect.value="";
 }
}
function renderCountries(){
 if(!countrySelect)return;
 const q=(document.querySelector("#country-search")?.value||"").trim().toLowerCase();
 const filtered=countries.filter(c=>countryAliases(c).includes(q));
 const current=countrySelect.value;
 fillSelect(countrySelect,filtered,"Select a country",c=>c.code,c=>(c.flag?c.flag+" ":"")+c.name,!countries.length);
 if(filtered.some(c=>c.code===current))countrySelect.value=current;
 if(!filtered.length){countrySelect.disabled=true;const option=document.createElement("option");option.textContent="No matching countries";option.value="";countrySelect.append(option);}
 countryPicker?.render();
}
async function invokeOrder(body,headers={}){const {data,error}=await supabase.functions.invoke("sparkle-sms-orders",{body,headers});if(error){let detail="";try{const response=error.context;if(response&&typeof response.clone==="function"){const payload=await response.clone().json();detail=payload?.error||payload?.message||"";}}catch{}throw new Error(detail||error.message||"The request could not be completed.");}if(data?.success===false)throw new Error(data.error||"The request could not be completed.");return data;}
function renderServices(data){
 if(!providersBox)return;serviceResults=data.services||[];
 const q=(document.querySelector("#service-search")?.value||"").trim().toLowerCase();
 const services=serviceResults.filter(s=>!q||String(s.name).toLowerCase().includes(q));
 const previous=serviceSelect?.value||"";
 fillSelect(serviceSelect,services,"Select a service",s=>s.ref,s=>s.name+(s.available_count!==null&&s.available_count!==undefined?" · "+s.available_count+" available":""),!services.length);
 if(services.some(s=>s.ref===previous))serviceSelect.value=previous;
 servicePicker?.render();
 if(!services.length){selectedService=null;note(providersBox,q?"No services match that search.":"No services are currently available for this destination.");return;}
 if(serviceSelect.value){selectedService=services.find(s=>s.ref===serviceSelect.value)||null;renderSelectedService();}
 else {selectedService=null;note(providersBox,"Choose a service from the dropdown above to view its price and availability.");}
}
function renderSelectedService(){
 if(!providersBox||!selectedService)return;
 const service=selectedService;providersBox.replaceChildren();
 const card=document.createElement("div");card.className="catalogue-selected-service";
 const details=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
 title.textContent=service.name;
 meta.textContent=service.available===false?"Currently unavailable":service.available_count!==null&&service.available_count!==undefined?service.available_count+" numbers currently available":"Availability is checked again before purchase";
 details.append(title,meta);
 const actions=document.createElement("div");actions.className="catalogue-service-actions";
 const quoteButton=document.createElement("button");quoteButton.type="button";quoteButton.className="app-button secondary";quoteButton.textContent="View price";quoteButton.disabled=service.available===false;
 const result=document.createElement("div");result.className="service-price-result";
 quoteButton.addEventListener("click",async()=>{
  quoteButton.disabled=true;quoteButton.textContent="Checking…";result.textContent="";
  try{
   const quote=await invokeOrder({action:"quote",catalogue:activeCatalog,country_iso:selectedCountry,service_ref:service.ref});
   result.textContent="Price "+money(quote.customer_price_kobo);
   let buy=actions.querySelector("[data-buy-service]");
   if(!buy){buy=document.createElement("button");buy.type="button";buy.className="app-button";buy.dataset.buyService="true";buy.textContent="Get this number";actions.append(buy);}
   buy.onclick=async()=>{
    if(!confirm("Get a "+selectedCountryName+" number for "+service.name+" at "+money(quote.customer_price_kobo)+"?"))return;
    buy.disabled=true;buy.textContent="Processing…";
    try{const purchase=await invokeOrder({action:"purchase",catalogue:activeCatalog,country_iso:selectedCountry,country_name:selectedCountryName,service_ref:service.ref},{"Idempotency-Key":crypto.randomUUID()});result.textContent=purchase.order?.phone_number?"Your number: "+purchase.order.phone_number:"Your number request is being confirmed.";buy.textContent="Open SMS inbox";buy.disabled=false;buy.onclick=()=>location.href="inbox.html";}
    catch(error){result.textContent=error.message||"The request could not be completed.";buy.disabled=false;buy.textContent="Try again";}
   };
  }catch(error){result.textContent=error.message||"Price is temporarily unavailable.";}
  finally{quoteButton.textContent="Refresh price";quoteButton.disabled=false;}
 });
 actions.append(quoteButton,result);card.append(details,actions);providersBox.append(card);
}
async function loadCountries(){
 if(!countrySelect)return;fillSelect(countrySelect,[],"Loading countries…",x=>x.code,x=>x.name,true);
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries"}});if(error)throw error;countries=data?.countries||[];renderCountries();}
 catch(error){fillSelect(countrySelect,[],"Country list unavailable",x=>x.code,x=>x.name,true);console.warn("Country catalogue:",error);}
}
async function loadServices(country,name,mode=activeCatalog){
 if(!providersBox)return;const request=++catalogRequest;selectedCountry=country;selectedCountryName=name||country;selectedService=null;servicePicker?.clear();
 if(heading)heading.textContent=mode==="usa"?"USA services":selectedCountryName+" services";if(description)description.textContent="Choose a service to see its customer price.";
 fillSelect(serviceSelect,[],"Loading services…",x=>x.ref,x=>x.name,true);note(providersBox,"Loading available services…");
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"services",country,mode}});if(error)throw error;if(request!==catalogRequest)return;renderServices(data||{services:[]});}
 catch(error){if(request===catalogRequest){fillSelect(serviceSelect,[],"Services unavailable",x=>x.ref,x=>x.name,true);note(providersBox,"We couldn't load services. Please try again shortly.");}console.warn("Service catalogue:",error);}
}
document.querySelectorAll("[data-catalog-tab]").forEach(button=>button.addEventListener("click",()=>setCatalog(button.dataset.catalogTab)));
countryPicker=mountSearchPicker("country-search","country-picker-list",()=>countries,c=>c.code+" "+countryAliases(c),c=>(c.flag?c.flag+" ":"")+c.name,c=>{if(countrySelect){countrySelect.value=c.code;countrySelect.dispatchEvent(new Event("change"));}});
countrySelect?.addEventListener("change",()=>{const country=countries.find(c=>c.code===countrySelect.value);if(country)loadServices(country.code,country.name,"all");});
servicePicker=mountSearchPicker("service-search","service-picker-list",()=>serviceResults,s=>s.ref,s=>s.name+(s.available_count!==null&&s.available_count!==undefined?" · "+s.available_count+" available":""),s=>{if(serviceSelect){serviceSelect.value=s.ref;serviceSelect.dispatchEvent(new Event("change"));}});
serviceSelect?.addEventListener("change",()=>{const service=serviceResults.find(s=>s.ref===serviceSelect.value);selectedService=service||null;if(service)renderSelectedService();else note(providersBox,"Choose a service from the dropdown above.");});
const dashboardSearch=document.querySelector("#dashboard-number-search");dashboardSearch?.addEventListener("keydown",event=>{if(event.key==="Enter")location.href="numbers.html?tab=all&q="+encodeURIComponent(dashboardSearch.value);});
if(countrySelect){void loadCountries().then(()=>{const params=new URLSearchParams(location.search);if(params.get("tab")==="all"){setCatalog("all");const q=params.get("q")||"",search=document.querySelector("#country-search");if(search){search.value=q;renderCountries();countryPicker?.render();}}else setCatalog("usa");});}
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
    catch(error){console.warn("BJVERIFY background status check:",error);}
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
 }catch(error){note(box,"Your SMS orders could not be loaded. Please refresh and try again.");console.warn("BJVERIFY orders:",error);}
}
const initialParams=new URLSearchParams(location.search);
if(document.querySelector("#all-country-picker")&&!countrySelect){setCatalog("usa");}
if(document.querySelector("#sms-orders")){
 void loadSmsOrders();
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void loadSmsOrders();});
}

const pricingForm=document.querySelector("#pricing-form"),pricingList=document.querySelector("#pricing-rules"),pricingMessage=document.querySelector("#pricing-message"),pricingMode=document.querySelector("#pricing-mode");
function showPricingMessage(message,kind="info"){if(!pricingMessage)return;pricingMessage.hidden=false;pricingMessage.textContent=message;pricingMessage.dataset.kind=kind;}
function syncPricingMode(){const fixed=pricingMode?.value==="fixed";const markup=document.querySelector("#pricing-markup"),price=document.querySelector("#pricing-fixed");if(markup)markup.disabled=fixed;if(price)price.disabled=!fixed;}
pricingMode?.addEventListener("change",syncPricingMode);syncPricingMode();

let adminCountries=[{code:"*",name:"All countries (*)"}],adminServices=[{code:"*",name:"All services (*)"}],pricingCountryPicker,pricingServicePicker;
async function loadAdminPricingCatalog(){
 const countryInput=document.querySelector("#pricing-country-search"),serviceInput=document.querySelector("#pricing-service-search");
 if(!countryInput||!serviceInput)return;
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries"}});
  if(error)throw error;
  adminCountries=[{code:"*",name:"All countries (*)"},...(data?.countries||[])];
 }catch(error){console.warn("Admin country catalogue:",error);}
 pricingCountryPicker=mountSearchPicker("pricing-country-search","pricing-country-list",()=>adminCountries.filter(c=>c.code==="*"||(document.querySelector("#pricing-provider")?.value==="virtualsms"?c.code!=="US":c.code==="US")),c=>c.code+" "+countryAliases(c),c=>c.flag?c.flag+" "+c.name:c.name,c=>{
  document.querySelector("#pricing-country").value=c.code;
  void loadAdminPricingServices();
 });
 pricingServicePicker=mountSearchPicker("pricing-service-search","pricing-service-list",()=>adminServices,s=>s.code,s=>s.name,s=>{
  document.querySelector("#pricing-service").value=s.code;
 });
 const countryValue=document.querySelector("#pricing-country").value||"*";
 const initial=adminCountries.find(c=>c.code===countryValue)||adminCountries[0];
 document.querySelector("#pricing-country").value=initial.code;
 pricingCountryPicker.setValue(initial.flag?initial.flag+" "+initial.name:initial.name);
 await loadAdminPricingServices();
}
async function loadAdminPricingServices(){
 const provider=document.querySelector("#pricing-provider")?.value||"fetchsms";
 const country=document.querySelector("#pricing-country")?.value||"*";
 const input=document.querySelector("#pricing-service-search");if(!input)return;
 if(country==="*"){adminServices=[{code:"*",name:"All services (*)"}];pricingServicePicker?.render();document.querySelector("#pricing-service").value="*";pricingServicePicker?.setValue("All services (*)");return;}
 if((provider==="virtualsms"&&country==="US")||(provider!=="virtualsms"&&country!=="US")){
  adminServices=[{code:"*",name:"All services (*)"}];pricingServicePicker?.render();document.querySelector("#pricing-service").value="*";pricingServicePicker?.setValue("All services (*)");return;
 }
 const mode=provider==="textverified"?"usa":"all";
 input.placeholder="Loading available services…";
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"admin-services",country,mode}});
  if(error){let detail="";try{detail=(await error.context.clone().json())?.error||"";}catch{}throw new Error(detail||error.message);}
  adminServices=[{code:"*",name:"All services (*)"},...(data?.services||[]).map(s=>({code:String(s.code),name:s.name}))];
 }catch(error){adminServices=[{code:"*",name:"All services (*)"}];console.warn("Admin service catalogue:",error);}
 input.placeholder="Choose or search service…";
 pricingServicePicker?.render();
 const current=document.querySelector("#pricing-service").value||"*";
 const selected=adminServices.find(s=>s.code===current)||adminServices[0];
 document.querySelector("#pricing-service").value=selected.code;pricingServicePicker?.setValue(selected.name);
}
document.querySelector("#pricing-provider")?.addEventListener("change",()=>{
 const provider=document.querySelector("#pricing-provider").value;
 if(provider==="virtualsms"&&document.querySelector("#pricing-country").value==="US"){document.querySelector("#pricing-country").value="*";pricingCountryPicker?.setValue("All countries (*)");}
 if(provider!=="virtualsms"&&document.querySelector("#pricing-country").value!=="US"){document.querySelector("#pricing-country").value="US";pricingCountryPicker?.setValue("🇺🇸 United States");}
 void loadAdminPricingServices();
});

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
if(pricingList){void loadPricingRules();void loadAdminPricingCatalog();}

async function loadAdminSmsOrders(){
 const box=document.querySelector("#admin-sms-orders");if(!box)return;
 note(box,"Loading SMS orders…");
 try{
  const data=await invokeOrder({action:"admin-orders"}),orders=data.orders||[];box.replaceChildren();
  if(!orders.length){note(box,"No BJVERIFY SMS orders have been placed yet.");return;}
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

function orderStatusLabel(value){
 const labels={waiting:"Waiting for SMS",unknown:"Confirming number",creating:"Preparing number",received:"Code received",completed:"Completed",expired:"Expired",failed:"Failed",cancelled:"Cancelled",refunded:"Refunded"};
 return labels[String(value||"").toLowerCase()]||"In progress";
}
async function loadDashboardSmsOrders(){
 const box=document.querySelector("#dashboard-sms-orders");if(!box)return;
 note(box,"Loading your latest number orders…");
 try{
  const data=await invokeOrder({action:"orders"}),orders=(data.orders||[]).slice(0,4);box.replaceChildren();
  if(!orders.length){note(box,"No number orders yet. Your purchases will appear here.");return;}
  box.className="activity-feed";
  for(const order of orders){
   const card=document.createElement("a");card.className="activity-order-card";card.href="inbox.html";
   const top=document.createElement("div");top.className="activity-order-top";
   const identity=document.createElement("div");identity.className="activity-order-identity";
   const service=document.createElement("strong");service.textContent=order.service_name||"Virtual number";
   const country=document.createElement("span");country.textContent=order.country_name||"Destination";
   identity.append(service,country);
   const status=document.createElement("span");status.className="activity-status status-"+String(order.status||"pending").toLowerCase();status.textContent=orderStatusLabel(order.status);
   top.append(identity,status);
   const bottom=document.createElement("div");bottom.className="activity-order-bottom";
   const number=document.createElement("span");number.className="activity-order-number";number.textContent=order.phone_number||"Number confirmation pending";
   const date=document.createElement("span");date.className="activity-order-date";date.textContent=order.created_at?new Date(order.created_at).toLocaleString("en-NG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"Recent order";
   const price=document.createElement("strong");price.className="activity-order-price";price.textContent=money(order.customer_price_kobo);
   bottom.append(number,date,price);card.append(top,bottom);box.append(card);
  }
 }catch(error){note(box,"Your number activity could not be loaded. Please refresh to try again.");console.warn("BJVERIFY dashboard number activity:",error);}
}
if(document.querySelector("#dashboard-sms-orders"))void loadDashboardSmsOrders();
