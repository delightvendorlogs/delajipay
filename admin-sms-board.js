import {createClient} from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
const money=k=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(Number(k||0)/100);
let config={servers:{server1:{enabled:true},server2:{enabled:true,max_pools:100}},services:{},pools:{},server_pricing:{},pool_pricing:{}};
const countryCache=new Map(),serviceCache=new Map();
const serviceManagementSelect=document.createElement("select");serviceManagementSelect.id="service-management-internal";
function note(message,kind="info"){const n=$("board-message");n.hidden=false;n.textContent=message;n.dataset.kind=kind;}
async function invoke(name,body){
 const {data,error}=await supabase.functions.invoke(name,{body});
 if(error){let message=error.message;try{message=(await error.context.clone().json())?.error||message;}catch{}throw new Error(message);}
 if(data?.success===false)throw new Error(data.error||"The request could not be completed.");
 return data||{};
}
async function adminCheck(){
 const {data:{session},error}=await supabase.auth.getSession();
 if(error||!session){location.replace("login.html?next=admin-sms-board.html");throw new Error("Authentication required");}
 if(session.user.app_metadata?.role!=="admin"){location.replace("dashboard.html");throw new Error("Administrator access required");}
}
function options(select,items,placeholder,value,label){
 select.replaceChildren(new Option(placeholder,""));
 for(const item of items)select.add(new Option(label(item),value(item)));
}
function serverKeyFrom(id){return $(id).value;}
function engineFor(server){return server==="server2"?"2":"1";}
async function loadCountries(server,select){
 if(server==="usa-tab"){
  const list=[{code:"US",name:"United States",id:""}];countryCache.set(select.id,list);options(select,list,"Choose country",x=>x.code,x=>x.name);select.value="US";return list;
 }
 select.disabled=true;select.replaceChildren(new Option("Loading countries…",""));
 try{
  const data=await invoke("sparkle-sms-catalog",{action:"admin-countries",engine:engineFor(server)});
  const list=data.countries||[];countryCache.set(select.id,list);options(select,list,"Choose country",x=>x.code,x=>(x.flag?x.flag+" ":"")+x.name);select.disabled=!list.length;
  if(list.length)select.value=list[0].code;
  return list;
 }finally{select.disabled=false;}
}
function selectedCountry(select){return (countryCache.get(select.id)||[]).find(x=>x.code===select.value)||null;}
async function loadServices(server,countrySelect,serviceSelect){
 const country=selectedCountry(countrySelect);if(!country){options(serviceSelect,[],"Choose a country first",x=>x.ref,x=>x.name);return [];}
 serviceSelect.disabled=true;serviceSelect.replaceChildren(new Option("Loading services…",""));
 try{
  const data=await invoke("sparkle-sms-catalog",{action:"admin-services",country:country.code,mode:server==="usa-tab"?"usa":"all",engine:engineFor(server),country_id:country.id||""});
  const list=data.services||[];serviceCache.set(serviceSelect.id,list);
  options(serviceSelect,list,"Choose service",x=>x.ref,x=>x.name+" · "+(x.is_active===false?"Disabled":"Enabled"));
  if(list.length)serviceSelect.value=list[0].ref;
  return list;
 }finally{serviceSelect.disabled=false;}
}
function serviceByRef(select){return (serviceCache.get(select.id)||[]).find(x=>x.ref===select.value)||null;}
async function saveBoard(payload){const data=await invoke("sparkle-sms-orders",{action:"admin-board-save",...payload});config=data.config||config;renderServerConfig();return data;}
function renderServerConfig(){
 $("server1-enabled").checked=config.servers?.server1?.enabled!==false;
 $("server2-enabled").checked=config.servers?.server2?.enabled!==false;
 $("server2-max-pools").value=String(config.servers?.server2?.max_pools??100);
}
async function loadConfig(){const data=await invoke("sparkle-sms-orders",{action:"admin-board-get"});config=data.config||config;renderServerConfig();}
async function loadServiceList(){
 const server=serverKeyFrom("service-server"),countrySelect=$("service-country");
 const services=await loadServices(server,countrySelect,serviceManagementSelect);
 const box=$("service-list");box.replaceChildren();
 if(!services.length){const empty=document.createElement("div");empty.className="app-empty";empty.textContent="No live services were returned for this country. Check provider inventory and credentials.";box.append(empty);return;}
 for(const service of services){
  const row=document.createElement("article");row.className="board-item";
  const detail=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small"),state=document.createElement("span");
  name.textContent=service.name;meta.textContent="Service code: "+service.code;state.className="board-status "+(service.is_active===false?"off":"on");state.textContent=service.is_active===false?"Disabled":"Enabled";
  detail.append(name,meta);
  const actions=document.createElement("div");actions.className="board-item-actions";
  const toggle=document.createElement("button");toggle.type="button";toggle.className="btn secondary";toggle.textContent=service.is_active===false?"Enable service":"Disable service";
  toggle.addEventListener("click",async()=>{toggle.disabled=true;try{await saveBoard({kind:"service",server_key:server,country_iso:countrySelect.value,service_code:service.code,enabled:service.is_active===false});note(service.name+" availability saved.","success");await loadServiceList();}catch(e){note(e.message,"error");toggle.disabled=false;}});
  actions.append(state.cloneNode(true),toggle);row.append(detail,actions);box.append(row);
 }

}
function fillPriceForm(){
 const server=$("price-server").value,country=$("price-country").value,service=serviceByRef($("price-service"));
 if(!service)return;
 const rule=config.server_pricing?.[server+"|"+country+"|"+service.code];
 $("server-price-mode").value=rule?.pricing_mode||"markup";
 $("server-price-markup").value=String(rule?.markup_percent??100);
 $("server-price-fixed").value=rule?.fixed_price_kobo?String(Number(rule.fixed_price_kobo)/100):"";
}
async function loadPricingServices(){
 const server=$("price-server").value,cs=$("price-country");
 const list=await loadServices(server,cs,$("price-service"));
 fillPriceForm();return list;
}
async function loadPoolServices(){
 const country=$("pool-country"),list=await loadServices("server2",country,$("pool-service"));
 return list;
}
async function loadPools(){
 const country=$("pool-country").value,service=serviceByRef($("pool-service")),box=$("pool-list");
 if(!country||!service){box.innerHTML='<div class="app-empty">Choose a country and service first.</div>';return;}
 box.innerHTML='<div class="app-empty">Loading live pools…</div>';
 try{
  const data=await invoke("sparkle-sms-orders",{action:"admin-pools",catalogue:"all",country_iso:country,service_ref:service.ref});
  box.replaceChildren();
  if(!data.pools?.length){const e=document.createElement("div");e.className="app-empty";e.textContent="No live pools were returned for this service.";box.append(e);return;}
  for(const pool of data.pools){
   const row=document.createElement("article");row.className="board-item";
   const detail=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small"),status=document.createElement("span");
   name.textContent=pool.label+" · "+(pool.stock||0)+" available";
   meta.textContent="Pool ID "+pool.id+" · Provider cost $"+Number(pool.provider_cost_usd||0).toFixed(4)+" · Current price "+money(pool.customer_price_kobo);
   status.className="board-status "+(pool.enabled?"on":"off");status.textContent=pool.enabled?(pool.within_display_limit?"Enabled · Customer-visible":"Enabled · Beyond display limit"):"Disabled";
   detail.append(name,meta,status);
   const actions=document.createElement("div");actions.className="board-item-actions";
   const toggle=document.createElement("button");toggle.type="button";toggle.className="btn secondary";toggle.textContent=pool.enabled?"Hide pool":"Enable pool";
   toggle.addEventListener("click",async()=>{toggle.disabled=true;try{await saveBoard({kind:"pool",server_key:"server2",country_iso:country,service_code:service.code,pool_id:String(pool.id),enabled:!pool.enabled});note("Pool availability saved.","success");await loadPools();}catch(e){note(e.message,"error");toggle.disabled=false;}});
   actions.append(toggle);
   const price=document.createElement("div");price.className="board-price";
   const modeLabel=document.createElement("label");modeLabel.textContent="Price mode";const mode=document.createElement("select");mode.add(new Option("Markup %","markup"));mode.add(new Option("Fixed ₦","fixed"));mode.value=config.pool_pricing?.["server2|"+country+"|"+service.code+"|"+pool.id]?.pricing_mode||"markup";modeLabel.append(mode);
   const markupLabel=document.createElement("label");markupLabel.textContent="Markup %";const markup=document.createElement("input");markup.type="number";markup.min="0";markup.max="1000";markup.step="0.01";markup.value=String(config.pool_pricing?.["server2|"+country+"|"+service.code+"|"+pool.id]?.markup_percent??config.server_pricing?.["server2|"+country+"|"+service.code]?.markup_percent??100);markupLabel.append(markup);
   const fixedLabel=document.createElement("label");fixedLabel.textContent="Fixed price ₦";const fixed=document.createElement("input");fixed.type="number";fixed.min="1";fixed.step="0.01";const saved=config.pool_pricing?.["server2|"+country+"|"+service.code+"|"+pool.id];fixed.value=saved?.fixed_price_kobo?String(Number(saved.fixed_price_kobo)/100):"";fixedLabel.append(fixed);
   const save=document.createElement("button");save.type="button";save.className="btn";save.textContent="Save pool price";
   save.addEventListener("click",async()=>{save.disabled=true;try{await saveBoard({kind:"pool-pricing",country_iso:country,service_code:service.code,pool_id:String(pool.id),pricing_mode:mode.value,markup_percent:Number(markup.value),fixed_price_ngn:Number(fixed.value)});note("Pool-specific price saved.","success");await loadPools();}catch(e){note(e.message,"error");save.disabled=false;}});
   price.append(modeLabel,markupLabel,fixedLabel,save);row.append(detail,actions,price);box.append(row);
  }
 }catch(e){box.innerHTML='<div class="app-empty"></div>';box.firstElementChild.textContent=e.message;note(e.message,"error");}
}
async function setupSelects(){
 await loadCountries("server1",$("service-country"));await loadServiceList();
 await loadCountries("server1",$("price-country"));await loadPricingServices();
 await loadCountries("server2",$("pool-country"));await loadPoolServices();
}
$("save-server-settings").addEventListener("click",async()=>{
 const button=$("save-server-settings"),max=Number($("server2-max-pools").value);
 if(!Number.isInteger(max)||max<1||max>100){note("Maximum visible pools must be a whole number from 1 to 100.","error");return;}
 button.disabled=true;
 try{
  await saveBoard({kind:"server",server_key:"server1",enabled:$("server1-enabled").checked});
  await saveBoard({kind:"server",server_key:"server2",enabled:$("server2-enabled").checked,max_pools:max});
  note("Server availability and maximum pool display saved.","success");
 }catch(e){note(e.message,"error");}
 finally{button.disabled=false;}
});
$("service-server").addEventListener("change",async()=>{try{await loadCountries(serverKeyFrom("service-server"),$("service-country"));await loadServiceList();}catch(e){note(e.message,"error");}});
$("service-country").addEventListener("change",()=>loadServiceList().catch(e=>note(e.message,"error")));
$("load-services").addEventListener("click",()=>loadServiceList().catch(e=>note(e.message,"error")));
$("price-server").addEventListener("change",async()=>{try{await loadCountries(serverKeyFrom("price-server"),$("price-country"));await loadPricingServices();}catch(e){note(e.message,"error");}});
$("price-country").addEventListener("change",()=>loadPricingServices().catch(e=>note(e.message,"error")));
$("price-service").addEventListener("change",fillPriceForm);
$("server-price-mode").addEventListener("change",()=>{const fixed=$("server-price-mode").value==="fixed";$("server-price-markup").disabled=fixed;$("server-price-fixed").disabled=!fixed;});
$("save-server-price").addEventListener("click",async()=>{
 const server=$("price-server").value,country=$("price-country").value,service=serviceByRef($("price-service"));
 if(!service){note("Choose a service before saving its server price.","error");return;}
 const button=$("save-server-price");button.disabled=true;
 try{await saveBoard({kind:"server-pricing",server_key:server,country_iso:country,service_code:service.code,pricing_mode:$("server-price-mode").value,markup_percent:Number($("server-price-markup").value),fixed_price_ngn:Number($("server-price-fixed").value)});note("Server-specific price saved.","success");}
 catch(e){note(e.message,"error");}
 finally{button.disabled=false;}
});
$("pool-country").addEventListener("change",async()=>{try{await loadPoolServices();$("pool-list").innerHTML='<div class="app-empty">Choose a service and load its pools.</div>';}catch(e){note(e.message,"error");}});
$("pool-service").addEventListener("change",()=>{$("pool-list").innerHTML='<div class="app-empty">Press Load pools to view this service inventory.</div>';});
$("load-pools").addEventListener("click",loadPools);
await adminCheck();
try{await loadConfig();await setupSelects();$("server-price-mode").dispatchEvent(new Event("change"));note("SMS board settings loaded. Server, service, pool and pricing controls are ready.","success");}
catch(e){note(e.message||"The SMS board could not be loaded.","error");}
