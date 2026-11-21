import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const menu=document.querySelector(".app-mobile-menu"),nav=document.querySelector(".app-nav");
menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"×":"☰";});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu?.setAttribute("aria-expanded","false");if(menu)menu.textContent="☰";}));
const results=document.querySelector("#country-results"),providersBox=document.querySelector("#provider-options"),heading=document.querySelector("#provider-heading"),description=document.querySelector("#provider-description");
let countries=[],providerResults=[],selectedCountry="";
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
  meta.textContent=country.code==="US"?"Fetch SMS · TextVerified":"Virtual Number";
  button.type="button";button.textContent="View services";button.addEventListener("click",()=>loadServices(country.code,country.name));
  left.append(name,meta);row.append(left,button);results.append(row);
 }
}
function renderServices(data){
 if(!providersBox)return;
 providerResults=data.providers||[];
 providersBox.replaceChildren();
 const q=(document.querySelector("#service-search")?.value||"").trim().toLowerCase();
 let visible=0;
 for(const provider of providerResults){
  const card=document.createElement("article");card.className="provider-card";
  const h=document.createElement("h3");h.textContent=provider.provider_name;
  const p=document.createElement("p");p.textContent=provider.error||((provider.services||[]).length+" supported services returned by provider");
  const region=document.createElement("div");region.className="provider-region";region.textContent=provider.country==="US"?"UNITED STATES":"INTERNATIONAL";
  card.append(h,p,region);
  if(provider.error){const e=document.createElement("p");e.textContent=provider.error;card.append(e);}
  else{
   const list=document.createElement("div");list.className="app-list";
   const services=(provider.services||[]).filter(s=>!q||String(s.name).toLowerCase().includes(q)||String(s.code).toLowerCase().includes(q));
   for(const service of services.slice(0,60)){
    const item=document.createElement("div");item.className="app-list-row";
    const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
    title.textContent=service.name;meta.textContent=service.available===false?"Currently unavailable":service.available_count!==null&&service.available_count!==undefined?service.available_count+" available":"Availability confirmed at checkout";
    detail.append(title,meta);item.append(detail);list.append(item);visible++;
   }
   if(!services.length){const empty=document.createElement("p");empty.textContent=q?"No services match this search.":"No services were returned by this provider.";card.append(empty);}else card.append(list);
  }
  providersBox.append(card);
 }
 if(!visible&&providerResults.every(p=>!p.error)){const footer=document.createElement("div");footer.className="app-note";footer.textContent="Service catalogues are loaded. Live prices and purchase checkout will be enabled after pricing rules are configured.";providersBox.append(footer);}
}
async function loadCountries(){
 if(!results)return;
 note(results,"Loading live country catalogue…");
 try{
  const {data,error}=await supabase.functions.invoke("sparkle-sms-catalog",{body:{action:"countries"}});
  if(error)throw error;
  countries=data?.countries||[];
  if(data?.warnings?.length)console.warn("Sparkle country catalogue warnings:",data.warnings);
  renderCountries();
 }catch(error){note(results,"The country catalogue could not load. Provider API credentials may still need to be added.");console.warn("Sparkle country catalogue:",error);}
}
async function loadServices(country,name){
 if(!providersBox)return;
 selectedCountry=country;
 heading.textContent=(name||country)+" services";
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
if(results)void loadCountries();
