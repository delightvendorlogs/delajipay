import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { askConfirm, showNotice } from "./dialog.js";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const menu=document.querySelector(".app-mobile-menu"),nav=document.querySelector(".app-nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰";});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.textContent="☰";}));
const countrySelect=document.querySelector("#country-select"),serviceSelect=document.querySelector("#service-select"),providersBox=document.querySelector("#provider-options"),heading=document.querySelector("#provider-heading"),description=document.querySelector("#provider-description");
let countries=[],serviceResults=[],selectedCountry="US",selectedCountryName="United States",activeCatalog="usa",catalogRequest=0,countryRequest=0,selectedService=null;
let activeEngine="1";

const money=kobo=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(kobo||0)/100);
function note(parent,message){if(!parent)return;const p=document.createElement("div");p.className="app-empty";p.textContent=message;parent.replaceChildren(p);}
function fillSelect(select,items,placeholder,valueOf,labelOf,disabled=false){
 if(!select)return;select.replaceChildren();const first=document.createElement("option");first.value="";first.textContent=placeholder;select.append(first);
 for(const item of items){const option=document.createElement("option");option.value=valueOf(item);option.textContent=labelOf(item);select.append(option);}
 select.disabled=disabled||!items.length;select.value="";
}

// ── Styled searchable dropdown ── replaces native datalist
function mountSearchPicker(inputId,listId,getItems,getValue,getLabel,onPick,getIcon=null){
 const input=document.getElementById(inputId);
 const legacySelect=document.getElementById(listId);
 if(!input)return null;
 const wrap=input.closest(".search-picker")||input.parentElement;
 let panel=wrap.querySelector(".smp-panel");
 if(!panel){panel=document.createElement("div");panel.className="smp-panel";panel.setAttribute("role","listbox");panel.hidden=true;wrap.style.position="relative";wrap.appendChild(panel);}
 if(legacySelect&&legacySelect!==input){legacySelect.style.display="none";}
 input.setAttribute("autocomplete","off");input.setAttribute("aria-expanded","false");
 let selectedItem=null,open=false;
 const entries=()=>(getItems()||[]).map(item=>({item,label:String(getLabel(item)||""),value:String(getValue(item)||"")}));
 function getItemIcon(item){
  if(typeof getIcon==="function"){const ic=getIcon(item);if(ic)return ic;}
  const code=String(item.code||item.iso||"").toUpperCase();
  if(/^[A-Z]{2}$/.test(code))return String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0)));
  const name=String(item.name||"").toLowerCase();
  const emojiMap=[[/whatsapp/,"\u{1F4AC}"],[/telegram/,"\u2708\uFE0F"],[/instagram/,"\uD83D\uDCF8"],[/tiktok/,"\uD83C\uDFB5"],[/facebook|meta/,"\uD83D\uDCD8"],[/twitter|^x$/,"\uD83D\uDC26"],[/discord/,"\uD83C\uDFAE"],[/google|gmail/,"\uD83D\uDD35"],[/amazon/,"\uD83D\uDCE6"],[/paypal/,"\uD83D\uDCB3"],[/snapchat/,"\uD83D\uDC7B"],[/netflix/,"\uD83C\uDFAC"],[/apple|icloud/,"\uD83C\uDF4E"],[/uber/,"\uD83D\uDE97"],[/microsoft/,"\uD83E\uDEA1"],[/signal/,"\uD83D\uDD12"],[/viber/,"\uD83D\uDCDE"],[/tinder/,"\uD83D\uDD25"],[/linkedin/,"\uD83D\uDCBC"],[/reddit/,"\uD83E\uDD16"],[/binance/,"\uD83E\uDE99"],[/cash.?app/,"\uD83D\uDCB5"]];
  const hit=emojiMap.find(([rx])=>rx.test(name));return hit?hit[1]:"\uD83D\uDCF1";
 }
 function renderList(){
  const q=input.value.trim().toLowerCase();
  const filtered=entries().filter(x=>!q||x.label.toLowerCase().includes(q)||x.value.toLowerCase().includes(q));
  panel.replaceChildren();
  if(!filtered.length){const e=document.createElement("div");e.className="smp-empty";e.textContent="Nothing found";panel.append(e);return;}
  filtered.forEach(({item,label,value})=>{
   const row=document.createElement("button");row.type="button";row.className="smp-item";row.setAttribute("role","option");row.setAttribute("aria-selected",String(selectedItem&&getValue(selectedItem)===value));
   const ic=document.createElement("span");ic.className="smp-ic";ic.textContent=getItemIcon(item);ic.setAttribute("aria-hidden","true");
   const lbl=document.createElement("span");lbl.className="smp-lbl";lbl.textContent=label;
   if(item.note){const sub=document.createElement("small");sub.className="smp-sub";sub.textContent=item.note;lbl.append(sub);}
   row.append(ic,lbl);
   row.addEventListener("pointerdown",e=>{e.preventDefault();selectItem(item);});
   panel.append(row);
  });
 }
 function selectItem(item){selectedItem=item;input.value=getLabel(item);closePanel();onPick(item);}
 function openPanel(){open=true;renderList();panel.hidden=false;panel.style.display="block";input.setAttribute("aria-expanded","true");}
 function closePanel(){open=false;panel.hidden=true;panel.style.display="none";input.setAttribute("aria-expanded","false");}
 input.addEventListener("focus",openPanel);
 input.addEventListener("click",openPanel);
 input.addEventListener("input",()=>{selectedItem=null;if(!open)openPanel();else renderList();});
 input.addEventListener("blur",()=>setTimeout(()=>{if(!panel.contains(document.activeElement))closePanel();},300));
 input.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closePanel();return;}
  if(e.key==="ArrowDown"){e.preventDefault();panel.querySelector(".smp-item")?.focus();}
 });
 panel.addEventListener("keydown",e=>{
  const items=[...panel.querySelectorAll(".smp-item")];const idx=items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){e.preventDefault();items[idx+1]?.focus();}
  else if(e.key==="ArrowUp"){e.preventDefault();if(idx===0)input.focus();else items[idx-1]?.focus();}
  else if(e.key==="Escape"){closePanel();input.focus();}
 });
 if(!document.getElementById("smp-styles")){
  const st=document.createElement("style");st.id="smp-styles";st.textContent=
   `.smp-panel{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:300;background:#fff;border:1.5px solid #ccd5df;border-radius:14px;box-shadow:0 16px 48px rgba(9,19,38,.20);max-height:280px;overflow-y:auto;overflow-x:hidden}`+
   `.smp-item{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border:0;background:transparent;color:#0e1e2e;text-align:left;font:inherit;font-size:14px;font-weight:600;cursor:pointer}`+
   `.smp-item:hover,.smp-item:focus{background:#eaf4fb;outline:0}`+
   `.smp-item[aria-selected=true]{background:#ddeef8;color:#074e82}`+
   `.smp-ic{font-size:20px;flex:none;width:28px;text-align:center;line-height:1}`+
   `.smp-lbl{flex:1;min-width:0;line-height:1.3}`+
   `.smp-sub{display:block;font-size:11px;font-weight:500;color:#6b8299;margin-top:2px}`+
   `.smp-empty{padding:16px;text-align:center;color:#6b8299;font-size:13px}`+
   `@media(prefers-color-scheme:dark){.smp-panel{background:#0f1b2d;border-color:#2a3e55}.smp-item{color:#e8f0f8}.smp-item:hover,.smp-item:focus{background:#1a2d42}.smp-item[aria-selected=true]{background:#193654;color:#7dd3fc}}`;
  document.head.append(st);
 }
 return {
  render(){renderList();if(open){panel.hidden=false;}},
  close(){closePanel();},
  setValue(value){if(!value){input.value="";selectedItem=null;return;}const match=entries().find(x=>x.label===value||x.value===value);if(match){selectedItem=match.item;input.value=match.label;}else{input.value=value;}},
  clear(){input.value="";selectedItem=null;if(open)renderList();}
 };
}
function countryFlag(code){const value=String(code||"").toUpperCase();return /^[A-Z]{2}$/.test(value)?String.fromCodePoint(...[...value].map(char=>127397+char.charCodeAt(0))):"\uD83C\uDF0D";}
function serviceIconUrl(service){
 const name=String(service?.name||"").toLowerCase(),supplied=String(service?.icon||"").trim();
 if(/^https:\/\//i.test(supplied))return supplied;
 const brands=[[/whatsapp/,"whatsapp"],[/telegram/,"telegram"],[/instagram/,"instagram"],[/facebook|meta/,"facebook"],[/tiktok/,"tiktok"],[/youtube/,"youtube"],[/google|gmail/,"google"],[/discord/,"discord"],[/microsoft|outlook|hotmail/,"microsoft"],[/uber/,"uber"],[/amazon/,"amazon"],[/apple|icloud/,"apple"],[/snapchat/,"snapchat"],[/reddit/,"reddit"],[/binance/,"binance"],[/steam/,"steam"],[/linkedin/,"linkedin"],[/paypal/,"paypal"],[/tinder/,"tinder"],[/cash app|cashapp/,"cashapp"],[/viber/,"viber"],[/signal/,"signal"],[/netflix/,"netflix"],[/twitter|^x$/,"x"]];
 const slug=brands.find(([pattern])=>pattern.test(name))?.[1];
 return slug?"https://cdn.simpleicons.org/"+slug:"";
}
function appendServiceIcon(parent,service){
 const src=serviceIconUrl(service);
 if(src){const img=document.createElement("img");img.className="service-brand-icon";img.src=src;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>img.remove();parent.append(img);return;}
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("class","service-brand-icon service-brand-icon-fallback");svg.setAttribute("aria-hidden","true");
 const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("x","6");rect.setAttribute("y","2.5");rect.setAttribute("width","12");rect.setAttribute("height","19");rect.setAttribute("rx","2.5");rect.setAttribute("fill","none");rect.setAttribute("stroke","currentColor");rect.setAttribute("stroke-width","1.8");
 const line=document.createElementNS("http://www.w3.org/2000/svg","path");line.setAttribute("d","M10 18h4");line.setAttribute("stroke","currentColor");line.setAttribute("stroke-width","1.6");line.setAttribute("stroke-linecap","round");svg.append(rect,line);parent.append(svg);
}
function countryAliases(country){
 const code=String(country.code||"").toUpperCase(),name=String(country.name||"");
 return [name,code,...(country.aliases||[]),...(code==="GB"?["UK","United Kingdom","Britain","Great Britain"]:[]),...(code==="US"?["USA","US","United States","United States of America"]:[])].join(" ").toLowerCase();
}

let countryPicker,servicePicker;
function setEngine(engine){
 activeEngine=engine==="2"?"2":"1";
 document.querySelectorAll("[data-engine-tab]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.engineTab===activeEngine)));
 catalogRequest++;selectedService=null;servicePicker?.clear();countryPicker?.clear();
 selectedCountry="";selectedCountryName="";
 if(countrySelect)countrySelect.value="";
 const countrySearch=document.querySelector("#country-search");if(countrySearch)countrySearch.value="";
 if(heading)heading.textContent="Choose a country first";
 if(description)description.textContent="Select a country to browse its available services.";
 fillSelect(serviceSelect,[],"Choose a country first",x=>x.ref,x=>x.name,true);
 note(providersBox,"Select a country to see available services.");
 void loadCountries();
}
function setCatalog(mode){
 const requested=mode==="all"?"all":"usa";
 activeCatalog=requested;
 document.querySelectorAll("[data-catalog-tab]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.catalogTab===requested)));
 const picker=document.querySelector("#all-country-picker"),usaIntro=document.querySelector("#usa-intro"),engines=document.querySelector("#all-country-engines");
 if(picker){picker.hidden=requested!=="all";picker.style.display=requested==="all"?"block":"none";}
 if(usaIntro){usaIntro.hidden=requested!=="usa";usaIntro.style.display=requested==="usa"?"block":"none";}
 if(engines){engines.hidden=requested!=="all";engines.style.display=requested==="all"?"flex":"none";}
 const search=document.querySelector("#service-search");if(search)search.value="";
 catalogRequest++;selectedService=null;servicePicker?.clear();countryPicker?.clear();
 if(requested==="usa"){
  activeEngine="1";document.querySelectorAll("[data-engine-tab]").forEach(button=>button.setAttribute("aria-selected",String(button.dataset.engineTab==="1")));
  selectedCountry="US";selectedCountryName="United States";
  if(heading)heading.textContent="USA services";if(description)description.textContent="Choose a service to see its customer price.";
  void loadServices("US","United States","usa");
 }else{
  setEngine("1");
 }
}
function renderCountries(){
 if(!countrySelect)return;
 const q=(document.querySelector("#country-search")?.value||"").trim().toLowerCase();
 const filtered=countries.filter(c=>countryAliases(c).includes(q));
 const current=countrySelect.value;
 fillSelect(countrySelect,filtered,"Select a country",c=>c.key||c.code,c=>countryFlag(c.code)+" "+c.name,!countries.length);
 if(filtered.some(c=>(c.key||c.code)===current))countrySelect.value=current;
 if(!filtered.length){countrySelect.disabled=true;const option=document.createElement("option");option.textContent="No matching countries";option.value="";countrySelect.append(option);}
 countryPicker?.render();
}
async function invokeOrder(body,headers={}){const {data,error}=await supabase.functions.invoke("sparkle-sms-orders",{body,headers});if(error){let detail="";try{const response=error.context;if(response&&typeof response.clone==="function"){const payload=await response.clone().json();detail=payload?.error||payload?.message||"";}}}catch{}throw new Error(detail||error.message||"The request could not be completed.");}if(data?.success===false)throw new Error(data.error||"The request could not be completed.");return data;}
const POPULAR_SERVICE_ORDER=["whatsapp","telegram","signal","instagram","facebook","tinder","cash app","google","tiktok","snapchat","x","discord"];
function popularServiceRank(service){
 const name=String(service?.name||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const compact=name.replace(/\s+/g,"");
 const aliases=[
  ["whatsapp",["whatsapp"]],
  ["telegram",["telegram"]],
  ["signal",["signal"]],
  ["instagram",["instagram"]],
  ["facebook",["facebook","meta"]],
  ["tinder",["tinder"]],
  ["cash app",["cashapp","cash app"]],
  ["google",["google","gmail"]],
  ["tiktok",["tiktok"]],
  ["snapchat",["snapchat"]],
  ["x",["twitter","x"]],
  ["discord",["discord"]]
 ];
 for(let rank=0;rank<aliases.length;rank++){
  const [key,terms]=aliases[rank];
  if(terms.some(term=>term==="x"?name==="x"||name.startsWith("x "):compact.includes(term.replace(/\s+/g,""))))return rank;
 }
 return POPULAR_SERVICE_ORDER.length;
}
function sortServicesPopularFirst(services){
 return (services||[]).map((service,index)=>({service,index,rank:popularServiceRank(service)}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(entry=>entry.service);
}
function renderServices(data){
 if(!providersBox)return;serviceResults=sortServicesPopularFirst(data.services||[]);
 const q=(document.querySelector("#service-search")?.value||"").trim().toLowerCase();
 const services=serviceResults.filter(s=>!q||String(s.name).toLowerCase().includes(q));
 const previous=serviceSelect?.value||"";
 fillSelect(serviceSelect,services,"Select a service",s=>s.ref,s=>s.name+(s.available_count!==null&&s.available_count!==undefined?" \u00b7 "+s.available_count+" available":""),!services.length);
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
 appendServiceIcon(title,service);title.append(document.createTextNode(service.name));
 meta.textContent=service.available===false?"Currently unavailable":service.available_count!==null&&service.available_count!==undefined?service.available_count+" numbers currently available":"Availability is checked again before purchase";
 details.append(title,meta);
 const actions=document.createElement("div");actions.className="catalogue-service-actions";
 const quoteButton=document.createElement("button");quoteButton.type="button";quoteButton.className="app-button secondary";quoteButton.textContent="View price";quoteButton.disabled=service.available===false;
 const result=document.createElement("div");result.className="service-price-result";
 quoteButton.addEventListener("click",async()=>{
  quoteButton.disabled=true;quoteButton.textContent="Checking\u2026";result.textContent="";
  try{
   let selectedPoolId="";
   let quote=await invokeOrder({action:"quote",catalogue:activeCatalog,country_iso:selectedCountry,service_ref:service.ref,engine:activeEngine});
   result.textContent="Price "+money(quote.customer_price_kobo);
   let poolPicker=actions.querySelector("[data-pool-picker]");if(poolPicker)poolPicker.remove();
   if(activeEngine==="2"&&Array.isArray(quote.pools)&&quote.pools.length){
    poolPicker=document.createElement("div");poolPicker.dataset.poolPicker="true";poolPicker.className="sms-pool-options";poolPicker.setAttribute("aria-label","Available pools");selectedPoolId=quote.selected_pool_id||quote.pools[0].id;quote.pools.forEach((pool,index)=>{const option=document.createElement("button");option.type="button";option.className="app-button secondary sms-pool-option"+(pool.id===selectedPoolId?" is-selected":"");option.textContent=pool.label+" \u00b7 "+money(pool.customerPriceKobo)+" \u00b7 "+pool.stock+" available";option.addEventListener("click",async()=>{selectedPoolId=pool.id;poolPicker.querySelectorAll("button").forEach(b=>b.classList.remove("is-selected"));option.classList.add("is-selected");try{quote=await invokeOrder({action:"quote",catalogue:activeCatalog,country_iso:selectedCountry,service_ref:service.ref,pool_id:selectedPoolId,engine:activeEngine});result.textContent="Price "+money(quote.customer_price_kobo);}catch(error){result.textContent=error.message||"Price is temporarily unavailable.";}});poolPicker.append(option);});actions.insertBefore(poolPicker,result);result.textContent="Price "+money(quote.customer_price_kobo);});
   }
   let buy=actions.querySelector("[data-buy-service]");
   if(!buy){buy=document.createElement("button");buy.type="button";buy.className="app-button";buy.dataset.buyService="true";buy.textContent="Get this number";actions.append(buy);}
   buy.onclick=async()=>{
    if(!await askConfirm({title:"Confirm number purchase",message:"Get a "+selectedCountryName+" number for "+service.name+" at "+money(quote.customer_price_kobo)+"?",note:"Your wallet will only be charged if the provider confirms the order.",confirmText:"Continue to buy"}))return;
    buy.disabled=true;buy.textContent="Processing\u2026";
    try{const purchase=await invokeOrder({action:"purchase",catalogue:activeCatalog,country_iso:selectedCountry,country_name:selectedCountryName,service_ref:service.ref,pool_id:selectedPoolId,engine:activeEngine},{"Idempotency-Key":crypto.randomUUID()});result.textContent=purchase.order?.phone_number?"Your number: "+purchase.order.phone_number:"Your number request is being confirmed.";buy.textContent="Open SMS inbox";buy.disabled=false;buy.onclick=()=>location.href="inbox.html";}
    catch(error){result.textContent=error.message||"The request could not be completed.";buy.disabled=false;buy.textContent="Try again";}
   };
  }catch(error){result.textContent=error.message||"Price is temporarily unavailable.";}
  finally{quoteButton.textContent="Refresh price";quoteButton.disabled=false;}
 });
 if(activeEngine==="2"){quoteButton.hidden=true;queueMicrotask(()=>quoteButton.click());}actions.append(quoteButton,result);card.append(details,actions);providersBox.append(card);
}
async function loadCountries(){
 if(!countrySelect)return;
 const request=++countryRequest,engine=activeEngine,status=document.querySelector("#country-catalogue-status");
 countries=[];fillSelect(countrySelect,[],"Loading countries\u2026",x=>x.code,x=>x.name,true);countryPicker?.render();
 if(status){status.hidden=false;status.textContent="Loading available destinations\u2026";}
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries",engine}});
  if(error)throw error;
  if(request!==countryRequest||engine!==activeEngine)return;
  countries=Array.isArray(data?.countries)?data.countries:[];
  renderCountries();
  if(status)status.textContent=data?.warnings?.length?data.warnings.join(" "):countries.length+" destinations available.";
 }catch(error){
  if(request!==countryRequest||engine!==activeEngine)return;
  countries=[];renderCountries();
  if(status)status.textContent="We couldn't load destinations just now. Tap the country field again to retry.";
  console.warn("Country catalogue:",error);
 }
}
async function loadServices(country,name,mode=activeCatalog,countryId=""){
 if(!providersBox)return;const request=++catalogRequest;selectedCountry=country;selectedCountryName=name||country;selectedService=null;servicePicker?.clear();
 if(heading)heading.textContent=mode==="usa"?"USA services":selectedCountryName+" services";if(description)description.textContent="Choose a service to see its customer price.";
 fillSelect(serviceSelect,[],"Loading services\u2026",x=>x.ref,x=>x.name,true);note(providersBox,"Loading available services\u2026");
 try{const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"services",country,mode,engine:activeEngine,country_id:countryId}});if(error)throw error;if(request!==catalogRequest)return;renderServices(data||{services:[]});}
 catch(error){if(request===catalogRequest){fillSelect(serviceSelect,[],"Services unavailable",x=>x.ref,x=>x.name,true);note(providersBox,"We couldn't load services. Please try again shortly.");}console.warn("Service catalogue:",error);}
}
window.addEventListener("bjverify:catalog-request",event=>setCatalog(event.detail==="all"?"all":"usa"));
window.addEventListener("bjverify:engine-request",event=>setEngine(event.detail==="2"?"2":"1"));
countryPicker=mountSearchPicker("country-search","country-picker-list",()=>countries,c=>c.key||c.code,c=>countryFlag(c.code)+" "+c.name,c=>{
  if(countrySelect)countrySelect.value=c.key||c.code;
  void loadServices(c.code,c.name,"all",c.id||"");
 });
 document.querySelector("#country-search")?.addEventListener("input",renderCountries);
countrySelect?.addEventListener("change",()=>{const country=countries.find(c=>(c.key||c.code)===countrySelect.value);if(country)loadServices(country.code,country.name,"all",country.id||"");});
servicePicker=null;document.querySelector("#service-search")?.addEventListener("input",()=>renderServices({services:serviceResults}));
serviceSelect?.addEventListener("change",()=>{const service=serviceResults.find(s=>s.ref===serviceSelect.value);selectedService=service||null;if(service)renderSelectedService();else note(providersBox,"Choose a service from the dropdown above.");});
const dashboardSearch=document.querySelector("#dashboard-number-search");dashboardSearch?.addEventListener("keydown",event=>{if(event.key==="Enter")location.href="numbers.html?tab=all&q="+encodeURIComponent(dashboardSearch.value);});
if(countrySelect){const params=new URLSearchParams(location.search);setCatalog(params.get("tab")==="all"?"all":"usa");if(params.get("tab")==="all"){const q=params.get("q")||"",search=document.querySelector("#country-search");if(search){search.value=q;renderCountries();countryPicker?.render();}}}
let inboxPollTimer=null,inboxPolling=false;
async function loadSmsOrders(){
 const box=document.querySelector("#sms-orders");if(!box)return;
 note(box,"Loading your SMS orders\u2026");
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
   const title=document.createElement("h2");title.textContent=order.service_name+" \u00b7 "+order.country_name;
   const number=document.createElement("p");number.className="app-panel-intro";number.textContent=order.phone_number||"Number confirmation pending";
   const status=document.createElement("div");status.className="provider-region";status.textContent=String(order.status||"pending").toUpperCase();
   card.append(title,number,status);
   if(order.otp_code){const code=document.createElement("div");code.className="message-code";code.style.marginTop="12px";const value=document.createElement("strong");value.textContent=order.otp_code;const copy=document.createElement("button");copy.type="button";copy.className="app-button secondary";copy.textContent="Copy code";copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(order.otp_code);copy.textContent="Copied";}catch{copy.textContent="Copy unavailable";}});code.append(value,copy);card.append(code);}
   if(order.sms_text){const message=document.createElement("p");message.style.fontSize="11px";message.textContent=order.sms_text;card.append(message);}
   const meta=document.createElement("small");meta.style.color="#8ea5c0";meta.textContent=new Date(order.created_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})+" \u00b7 "+money(order.customer_price_kobo);card.append(meta);
   if(["waiting","unknown","creating"].includes(order.status)){
    const refresh=document.createElement("button");refresh.type="button";refresh.className="app-button secondary";refresh.textContent="Refresh status";
    refresh.addEventListener("click",async()=>{refresh.disabled=true;refresh.textContent="Checking\u2026";try{await invokeOrder({action:"status",order_id:order.id});await loadSmsOrders();}catch(error){refresh.disabled=false;refresh.textContent="Try again";void showNotice({title:"Status check failed",message:error.message||"Could not refresh order status."})}});
    const cancel=document.createElement("button");cancel.type="button";cancel.className="app-button secondary";cancel.textContent="Cancel request";
    cancel.addEventListener("click",async()=>{if(!await askConfirm({title:"Cancel verification?",message:"Try to cancel this verification?",note:"A received message cannot be refunded.",confirmText:"Yes, try to cancel"}))return;cancel.disabled=true;cancel.textContent="Cancelling\u2026";try{await invokeOrder({action:"cancel",order_id:order.id});await loadSmsOrders();}catch(error){cancel.disabled=false;cancel.textContent="Try again";void showNotice({title:"Cancellation failed",message:error.message||"Cancellation could not be confirmed."})}});
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
 // Mount immediately so the country control responds even while the catalogue is loading.
 if(!pricingCountryPicker){
  pricingCountryPicker=mountSearchPicker("pricing-country-search","pricing-country-list",()=>adminCountries.filter(c=>c.code==="*"||(document.querySelector("#pricing-provider")?.value==="virtualsms"?c.code!=="US":document.querySelector("#pricing-provider")?.value==="smsbower"?true:c.code==="US")),c=>c.code+" "+countryAliases(c),c=>countryFlag(c.code)+" "+c.name,c=>{
   document.querySelector("#pricing-country").value=c.code;
   void loadAdminPricingServices();
  });
 }
 if(!pricingServicePicker){
  pricingServicePicker=mountSearchPicker("pricing-service-search","pricing-service-list",()=>adminServices,s=>s.code,s=>s.name,s=>{
   document.querySelector("#pricing-service").value=s.code;
  },s=>s.code==="*"?null:s);
 }
 countryInput.placeholder="Loading countries…";
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries",engine:document.querySelector("#pricing-provider")?.value==="smsbower"?"2":"1"}});
  if(error)throw error;
  adminCountries=[{code:"*",name:"All countries (*)"},...(data?.countries||[])];
 }catch(error){console.warn("Admin country catalogue:",error);}
 pricingCountryPicker.render();
 const countryValue=document.querySelector("#pricing-country").value||"*";
 const initial=adminCountries.find(c=>c.code===countryValue)||adminCountries[0];
 document.querySelector("#pricing-country").value=initial.code;
 pricingCountryPicker.setValue(initial.code==="*"?"🌍 "+initial.name:countryFlag(initial.code)+" "+initial.name);
 countryInput.placeholder="Choose or search country…";
 await loadAdminPricingServices();
}
async function loadAdminPricingServices(){
 const provider=document.querySelector("#pricing-provider")?.value||"fetchsms";
 const country=document.querySelector("#pricing-country")?.value||"*";
 const input=document.querySelector("#pricing-service-search");if(!input)return;
 if(country==="*"){adminServices=[{code:"*",name:"All services (*)"}];pricingServicePicker?.render();document.querySelector("#pricing-service").value="*";pricingServicePicker?.setValue("All services (*)");return;}
 if((provider==="virtualsms"&&country==="US")||(provider!=="virtualsms"&&provider!=="smsbower"&&country!=="US")){
  adminServices=[{code:"*",name:"All services (*)"}];pricingServicePicker?.render();document.querySelector("#pricing-service").value="*";pricingServicePicker?.setValue("All services (*)");return;
 }
 const mode=provider==="textverified"?"usa":"all";const engine=provider==="smsbower"?"2":"1";
 input.placeholder="Loading available services\u2026";
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"admin-services",country,mode,engine}});
  if(error){let detail="";try{detail=(await error.context.clone().json())?.error||"";}catch{}throw new Error(detail||error.message);}
  adminServices=[{code:"*",name:"All services (*)"},...(data?.services||[]).map(s=>({code:String(s.code),name:s.name,icon:s.icon}))];
 }catch(error){adminServices=[{code:"*",name:"All services (*)"}];console.warn("Admin service catalogue:",error);}
 input.placeholder="Choose or search service\u2026";
 pricingServicePicker?.render();
 const current=document.querySelector("#pricing-service").value||"*";
 const selected=adminServices.find(s=>s.code===current)||adminServices[0];
 document.querySelector("#pricing-service").value=selected.code;pricingServicePicker?.setValue(selected.name);
}
document.querySelector("#pricing-provider")?.addEventListener("change",()=>{
 const provider=document.querySelector("#pricing-provider").value;
 if(provider==="smsbower"){document.querySelector("#pricing-country").value="*";pricingCountryPicker?.setValue("All countries (*)");void loadAdminPricingCatalog();return;}
 if(provider==="virtualsms"&&document.querySelector("#pricing-country").value==="US"){document.querySelector("#pricing-country").value="*";pricingCountryPicker?.setValue("All countries (*)");}
 if(provider!=="virtualsms"&&document.querySelector("#pricing-country").value!=="US"){document.querySelector("#pricing-country").value="US";pricingCountryPicker?.setValue("\uD83C\uDDFA\uD83C\uDDF8 United States");}
 void loadAdminPricingServices();
});

async function loadPricingRules(){
 if(!pricingList)return;
 note(pricingList,"Loading pricing rules\u2026");
 try{
  const data=await invokeOrder({action:"pricing-list"});const rules=data.rules||[];pricingList.replaceChildren();
  if(!rules.length){note(pricingList,"No pricing rules are configured.");return;}
  for(const rule of rules){
   const row=document.createElement("article");row.className="app-list-row";
   const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
   title.textContent=rule.provider_key+" \u00b7 "+rule.country_iso+" \u00b7 "+rule.service_code;
   meta.textContent=rule.pricing_mode==="fixed"?"Fixed price: "+money(rule.fixed_price_kobo):"Markup: "+Number(rule.markup_percent).toLocaleString("en-NG")+"%";
   info.append(title,meta);
   const edit=document.createElement("button");edit.type="button";edit.className="app-button secondary";edit.textContent="Edit";
   edit.addEventListener("click",()=>{document.querySelector("#pricing-provider").value=rule.provider_key;document.querySelector("#pricing-country").value=rule.country_iso;document.querySelector("#pricing-service").value=rule.service_code;document.querySelector("#pricing-mode").value=rule.pricing_mode;document.querySelector("#pricing-markup").value=rule.markup_percent;document.querySelector("#pricing-fixed").value=rule.fixed_price_kobo?Number(rule.fixed_price_kobo)/100:"";syncPricingMode();pricingForm.scrollIntoView({behavior:"smooth",block:"start"}};});
   row.append(info,edit);pricingList.append(row);
  }
 }catch(error){note(pricingList,error.message||"Pricing rules could not be loaded.");}
}
pricingForm?.addEventListener("submit",async event=>{
 event.preventDefault();const button=document.querySelector("#pricing-save");button.disabled=true;button.textContent="Saving\u2026";
 try{
  await invokeOrder({action:"pricing-save",provider_key:document.querySelector("#pricing-provider").value,country_iso:document.querySelector("#pricing-country").value.trim(),service_code:document.querySelector("#pricing-service").value.trim()||"*",pricing_mode:document.querySelector("#pricing-mode").value,markup_percent:Number(document.querySelector("#pricing-markup").value),fixed_price_ngn:Number(document.querySelector("#pricing-fixed").value)});
  showPricingMessage("Pricing rule saved.", "success");await loadPricingRules();
 }catch(error){showPricingMessage(error.message||"Pricing rule could not be saved.","error");}
 finally{button.disabled=false;button.textContent="Save pricing rule";}
});
if(pricingList){void loadPricingRules();void loadAdminPricingCatalog();}

async function loadAdminSmsOrders(){
 const box=document.querySelector("#admin-sms-orders");if(!box)return;
 note(box,"Loading SMS orders\u2026");
 try{
  const data=await invokeOrder({action:"admin-orders"}),orders=data.orders||[];box.replaceChildren();
  if(!orders.length){note(box,"No BJVERIFY SMS orders have been placed yet.");return;}
  box.className="app-list";
  for(const order of orders){
   const row=document.createElement("article");row.className="app-panel";row.style.marginTop="0";
   const title=document.createElement("h2");title.textContent=order.service_name+" \u00b7 "+order.country_name;
   const meta=document.createElement("p");meta.className="app-panel-intro";meta.textContent=[order.provider_key,order.phone_number||"Number pending","User "+String(order.user_id).slice(0,8),new Date(order.created_at).toLocaleString("en-NG")].join(" \u00b7 ");
   const status=document.createElement("div");status.className="provider-region";status.textContent=String(order.status).toUpperCase()+" \u00b7 "+money(order.customer_price_kobo);
   row.append(title,meta,status);
   if(order.otp_code){const code=document.createElement("p");code.style.color="#8de5f4";code.textContent="SMS code: "+order.otp_code;row.append(code);}
   if(order.sms_text){const sms=document.createElement("p");sms.style.fontSize="10px";sms.textContent=order.sms_text;row.append(sms);}
   if(order.provider_order_id&&["waiting","unknown","creating"].includes(order.status)){
    const refresh=document.createElement("button");refresh.type="button";refresh.className="app-button secondary";refresh.textContent="Check provider status";
    refresh.addEventListener("click",async()=>{refresh.disabled=true;refresh.textContent="Checking\u2026";try{await invokeOrder({action:"status",order_id:order.id});await loadAdminSmsOrders();}catch(error){refresh.disabled=false;refresh.textContent="Try again";void showNotice({title:"Status check failed",message:error.message||"Status check failed."})}});
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
 note(box,"Loading your latest number orders\u2026");
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
