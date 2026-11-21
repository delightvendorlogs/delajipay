import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VIRTUALSMS_API_KEY = Deno.env.get("VIRTUALSMS_API_KEY") ?? "";
const FETCHSMS_API_KEY = Deno.env.get("FETCHSMS_API_KEY") ?? "";
const TEXTVERIFIED_API_USERNAME = Deno.env.get("TEXTVERIFIED_API_USERNAME") ?? "";
const TEXTVERIFIED_API_KEY = Deno.env.get("TEXTVERIFIED_API_KEY") ?? "";

const VIRTUALSMS_BASE = "https://virtualsms.io/api/v1";
const FETCHSMS_BASE = "https://api.fetchsms.com/v1";
const TEXTVERIFIED_BASE = "https://www.textverified.com/api/pub/v2";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: corsHeaders }); }
function str(...values: unknown[]): string {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}
function num(v: unknown, fallback = 0): number { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function rows(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ["data","results","services","orders","messages","sms"]) if (Array.isArray(data?.[key])) return data[key];
  return [];
}
async function getUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new Error("Please sign in to continue.");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession:false, autoRefreshToken:false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user;
}
async function requestJson(url: string, headers: Record<string,string> = {}, options: RequestInit = {}) {
  let response: Response;
  try { response = await fetch(url, { ...options, headers: { Accept:"application/json", ...headers, ...((options.headers || {}) as Record<string,string>) } }); }
  catch (e) { const error = new Error("Provider connection could not be confirmed."); (error as any).status = 0; throw error; }
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok || data?.success === false) { const status=response.status>=400?response.status:400; const error = new Error(str(data?.detail,data?.message,data?.error,"Provider request failed ("+status+").")); (error as any).status=status; (error as any).data=data; throw error; }
  return data;
}
async function virtualRequest(path: string, options: RequestInit = {}) {
  if (!VIRTUALSMS_API_KEY) throw new Error("VirtualSMS API key is not configured.");
  return requestJson(VIRTUALSMS_BASE+path,{ "X-API-Key":VIRTUALSMS_API_KEY, ...(options.headers as Record<string,string>||{}) },options);
}
async function fetchRequest(path: string, options: RequestInit = {}, authenticated = true) {
  if (authenticated && !FETCHSMS_API_KEY) throw new Error("Fetch SMS API key is not configured.");
  return requestJson(FETCHSMS_BASE+path,authenticated?{Authorization:"Bearer "+FETCHSMS_API_KEY}: {},options);
}
let tvToken="",tvTokenExpires=0;
async function getTvToken(force=false) {
  if (!TEXTVERIFIED_API_USERNAME || !TEXTVERIFIED_API_KEY) throw new Error("TextVerified credentials are not configured.");
  if (!force && tvToken && Date.now()<tvTokenExpires) return tvToken;
  const data=await requestJson(TEXTVERIFIED_BASE+"/auth",{"X-API-KEY":TEXTVERIFIED_API_KEY,"X-API-USERNAME":TEXTVERIFIED_API_USERNAME},{method:"POST"});
  tvToken=str(data?.token,data?.access_token,data?.data?.token);
  if(!tvToken)throw new Error("TextVerified did not return an access token.");
  tvTokenExpires=Date.now()+50*60*1000;return tvToken;
}
async function tvRequest(path:string,options:RequestInit={}) {
  let token=await getTvToken();
  try { return await requestJson(TEXTVERIFIED_BASE+path,{Authorization:"Bearer "+token},options); }
  catch(error) {
    if(num((error as any)?.status)!==401)throw error;
    token=await getTvToken(true);
    return await requestJson(TEXTVERIFIED_BASE+path,{Authorization:"Bearer "+token},options);
  }
}
async function fxRate():Promise<number>{
  for(const url of ["https://open.er-api.com/v6/latest/USD","https://api.frankfurter.dev/v1/latest?base=USD&symbols=NGN"]){
    try{const r=await fetch(url);if(!r.ok)continue;const d=await r.json();const rate=num(d?.rates?.NGN);if(rate>0)return rate;}catch{}
  }
  throw new Error("The current USD to NGN exchange rate is unavailable.");
}
async function pricingRule(provider:string,country:string,service:string){
  const {data,error}=await admin.from("sparkle_sms_pricing_rules").select("country_iso,service_code,pricing_mode,markup_percent,fixed_price_kobo").eq("provider_key",provider).eq("is_active",true);
  if(error)throw new Error("Unable to load the current number pricing rules.");
  const rules=data||[];
  return rules.find((r:any)=>r.country_iso===country&&r.service_code===service)
    ||rules.find((r:any)=>r.country_iso===country&&r.service_code==="*")
    ||rules.find((r:any)=>r.country_iso==="*"&&r.service_code===service)
    ||rules.find((r:any)=>r.country_iso==="*"&&r.service_code==="*")
    ||null;
}
async function quote(provider:string,country:string,service:string,serviceName:string){
  if(provider==="virtualsms"&&country==="US")throw new Error("USA orders must use Fetch SMS or TextVerified.");
  if(["fetchsms","textverified"].includes(provider)&&country!=="US")throw new Error("This provider only supplies United States numbers.");
  let providerUsd=0,available=true,availabilityCount:number|null=null;
  if(provider==="fetchsms"){
    if(!/^\d+$/.test(service)||Number(service)===1)throw new Error("Choose a short-term Fetch SMS verification service.");
    const [q,catalog,fx]=await Promise.all([
      fetchRequest("/services/quote?service="+encodeURIComponent(service)+"&mode=short",{},false),
      fetchRequest("/services",{},false),
      fxRate()
    ]);
    const item=rows(catalog).find((x:any)=>String(x.id)===service);
    availabilityCount=num(item?.short_available);
    available=availabilityCount>0;
    providerUsd=num(q?.total_cents,-1)/100;
    if(providerUsd<0)throw new Error("Fetch SMS did not return a valid price.");
    const rule=await pricingRule(provider,country,service);
    const providerCostNgn=providerUsd*fx;
    const customerPriceKobo=rule?.pricing_mode==="fixed"&&rule.fixed_price_kobo?num(rule.fixed_price_kobo):Math.ceil(providerCostNgn*(1+num(rule?.markup_percent,100)/100)*100);
    return {provider,providerUsd,fx,providerCostKobo:Math.ceil(providerCostNgn*100),customerPriceKobo,markupPercent:num(rule?.markup_percent,100),available,availabilityCount,serviceName:str(item?.name,item?.slug,service)};
  }
  if(provider==="textverified"){
    const result=await tvRequest("/pricing/verifications",{method:"POST",body:JSON.stringify({serviceName:serviceName||service,areaCode:false,carrier:false,numberType:"mobile",capability:"sms"})});
    providerUsd=num(result?.price??result?.cost??result?.data?.price??result?.data?.cost,-1);
    if(providerUsd<0)throw new Error("TextVerified did not return a valid price.");
    const fx=await fxRate(),rule=await pricingRule(provider,country,service.toLowerCase());
    const providerCostNgn=providerUsd*fx;
    const customerPriceKobo=rule?.pricing_mode==="fixed"&&rule.fixed_price_kobo?num(rule.fixed_price_kobo):Math.ceil(providerCostNgn*(1+num(rule?.markup_percent,100)/100)*100);
    return {provider,providerUsd,fx,providerCostKobo:Math.ceil(providerCostNgn*100),customerPriceKobo,markupPercent:num(rule?.markup_percent,100),available:true,availabilityCount:null,serviceName:serviceName||service};
  }
  if(provider==="virtualsms"){
    const result=await virtualRequest("/price?service="+encodeURIComponent(service)+"&country="+encodeURIComponent(country));
    providerUsd=num(result?.price??result?.data?.price,-1);
    if(providerUsd<0)throw new Error("VirtualSMS did not return a valid price.");
    available=result?.available!==false&&result?.data?.available!==false;
    const fx=await fxRate(),rule=await pricingRule(provider,country,service);
    const providerCostNgn=providerUsd*fx;
    const customerPriceKobo=rule?.pricing_mode==="fixed"&&rule.fixed_price_kobo?num(rule.fixed_price_kobo):Math.ceil(providerCostNgn*(1+num(rule?.markup_percent,100)/100)*100);
    return {provider,providerUsd,fx,providerCostKobo:Math.ceil(providerCostNgn*100),customerPriceKobo,markupPercent:num(rule?.markup_percent,100),available,availabilityCount:null,serviceName:serviceName||service};
  }
  throw new Error("Unknown provider.");
}
function getProviderId(data:any,provider:string){
  if(provider==="textverified")return str(data?.id,data?.verificationId,data?.verification_id,data?.data?.id,data?.data?.verificationId);
  return str(data?.id,data?.order_id,data?.verification_id,data?.data?.id,data?.data?.order_id);
}
function getPhone(data:any){return str(data?.number,data?.phone_number,data?.phoneNumber,data?.phone,data?.data?.number,data?.data?.phone_number,data?.data?.phoneNumber,data?.data?.phone);}
function getExpiry(data:any){const raw=str(data?.expires_at,data?.expiresAt,data?.expiry,data?.expires,data?.data?.expires_at);if(!raw)return null;const d=new Date(raw);return Number.isFinite(d.getTime())?d.toISOString():null;}
function findCode(root:any):string{
  const seen=new Set<object>(),stack=[root];
  while(stack.length){const v=stack.pop();if(!v||typeof v!=="object"||seen.has(v))continue;seen.add(v);
    for(const [k,x] of Object.entries(v)){if(/^(code|otp|verificationcode|verification_code|smscode|sms_code)$/i.test(k)&&typeof x==="string"&&x.trim())return x.trim();if(x&&typeof x==="object")stack.push(x);}
  }return "";
}
function findSms(root:any):string{
  const seen=new Set<object>(),stack=[root];
  while(stack.length){const v=stack.pop();if(!v||typeof v!=="object"||seen.has(v))continue;seen.add(v);
    for(const [k,x] of Object.entries(v)){if(/^(sms|message|body|text|content|message_body|sms_text)$/i.test(k)&&typeof x==="string"&&x.trim())return x.trim();if(x&&typeof x==="object")stack.push(x);}
  }return "";
}
function findState(data:any){return str(data?.status,data?.state,data?.data?.status,data?.order?.status,data?.verification?.status).toLowerCase();}
async function ownOrder(orderId:string,userId:string){
  const {data,error}=await admin.from("sparkle_sms_orders").select("*").eq("id",orderId).eq("user_id",userId).maybeSingle();
  if(error||!data)throw new Error("Order not found.");
  return data;
}
async function updateOrder(orderId:string,updates:Record<string,unknown>){
  const {data,error}=await admin.from("sparkle_sms_orders").update({...updates,updated_at:new Date().toISOString()}).eq("id",orderId).select().single();
  if(error||!data)throw new Error("The order update could not be saved. Please refresh or contact support.");
  return data;
}
async function saveMessage(order:any,code:string,sms:string,sender:string){
  const {error}=await admin.from("sparkle_sms_messages").insert({order_id:order.id,user_id:order.user_id,otp_code:code||null,message_text:sms||null,sender:sender||null,received_at:new Date().toISOString()});
  if(error&&error.code!=="23505")console.error("Sparkle message save failed:",error.message);
}
async function refund(orderId:string,finalStatus:string,reason:string){
  const {data,error}=await admin.rpc("sparkle_refund_sms_order",{p_order_id:orderId,p_final_status:finalStatus,p_reason:reason});
  if(error)throw new Error("The provider order ended, but its wallet refund needs review.");
  return data;
}
async function providerStatus(order:any){
  const id=encodeURIComponent(str(order.provider_order_id));
  if(order.provider_key==="fetchsms")return await fetchRequest("/verifications/"+id);
  if(order.provider_key==="textverified"){
    const result=await tvRequest("/verifications/"+id);
    if(!findCode(result)&&!findSms(result)){
      try{return { ...result, sms_result: await tvRequest("/sms?reservationId="+id) };}catch{}
    }
    return result;
  }
  return await virtualRequest("/customer/order/"+id);
}
async function actionQuote(body:any){
  const provider=str(body.provider_key,body.provider).toLowerCase(),country=str(body.country_iso,body.country).toUpperCase(),service=str(body.service_code,body.service),name=str(body.service_name,body.serviceName);
  if(!provider||!country||!service)throw new Error("Choose a country, service and provider.");
  const q=await quote(provider,country,service,name);
  return json({success:true,provider_key:provider,country_iso:country,service_code:service,service_name:q.serviceName,available:q.available,available_count:q.availabilityCount,provider_cost_usd:q.providerUsd,exchange_rate:q.fx,customer_price_kobo:q.customerPriceKobo,customer_price_ngn:q.customerPriceKobo/100,markup_percent:q.markupPercent});
}
async function actionBuy(body:any,userId:string,req:Request){
  const provider=str(body.provider_key,body.provider).toLowerCase(),country=str(body.country_iso,body.country).toUpperCase(),countryName=str(body.country_name,body.countryName,country),service=str(body.service_code,body.service),serviceName=str(body.service_name,body.serviceName,service);
  if(!provider||!country||!service)throw new Error("Choose a country, service and provider.");
  const q=await quote(provider,country,service,serviceName);
  if(!q.available) return json({success:false,error:"This service is currently out of stock.",available:false},409);
  if(provider==="fetchsms"){
    const wallet=await fetchRequest("/wallet/balance",{},true);
    if(num(wallet?.balance_cents,-1)<Math.ceil(q.providerUsd*100))return json({success:false,error:"The USA provider is temporarily unable to fulfil orders.",code:"PROVIDER_BALANCE_LOW"},503);
  }
  const idempotencyKey=str(req.headers.get("idempotency-key"),body.idempotency_key,body.idempotencyKey)||crypto.randomUUID();
  const reserved=await admin.rpc("sparkle_create_sms_order",{
    p_user_id:userId,p_provider_key:provider,p_idempotency_key:idempotencyKey,p_country_iso:country,p_country_name:countryName,
    p_service_code:service,p_service_name:serviceName,p_customer_price_kobo:q.customerPriceKobo,
    p_provider_cost_usd:q.providerUsd,p_exchange_rate:q.fx
  });
  if(reserved.error){
    const message=reserved.error.message||"Unable to reserve this order.";
    if(message.includes("INSUFFICIENT_FUNDS"))return json({success:false,error:"Your wallet balance is too low. Please add funds.",code:"INSUFFICIENT_WALLET_FUNDS"},402);
    return json({success:false,error:"Your order could not be reserved. Please try again."},400);
  }
  const reservation=Array.isArray(reserved.data)?reserved.data[0]:reserved.data;
  const orderId=str(reservation?.order_id);
  if(!orderId)throw new Error("Order reservation did not return an order ID.");
  if(reservation?.already_exists){
    const existing=await ownOrder(orderId,userId);
    return json({success:true,pending:true,order:existing,message:"This request already exists. Open the existing order instead of purchasing again."},202);
  }
  let providerData:any;
  try{
    if(provider==="fetchsms"){
      providerData=await fetchRequest("/verifications",{method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:JSON.stringify({service:Number(service)})},true);
    }else if(provider==="textverified"){
      providerData=await tvRequest("/verifications",{method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:JSON.stringify({serviceName,capability:"sms",numberType:"mobile",areaCodeSelectOption:[],carrierSelectOption:[]})});
    }else{
      providerData=await virtualRequest("/customer/purchase",{method:"POST",body:JSON.stringify({service,country})});
    }
  }catch(error){
    const status=num((error as any)?.status);
    if(status>=400&&status<500){
      await refund(orderId,"failed","Provider rejected number purchase");
      return json({success:false,error:"The provider could not allocate a number. Your wallet has been refunded.",refunded:true},409);
    }
    await updateOrder(orderId,{status:"unknown",provider_state:"provider_result_unconfirmed"});
    return json({success:true,pending:true,order_id:orderId,message:"The provider response could not be confirmed. Your request is being checked; please do not submit another purchase."},202);
  }
  let providerOrderId=getProviderId(providerData,provider);
  let phone=getPhone(providerData);
  let expiry=getExpiry(providerData);
  if(provider==="textverified"&&!providerOrderId){
    const selfLink=str(providerData?.href,providerData?.links?.self?.href);
    if(selfLink){
      try{
        const linkUrl=new URL(selfLink);
        if(linkUrl.hostname==="www.textverified.com"){
          const details=await tvRequest(linkUrl.pathname+linkUrl.search);
          providerOrderId=getProviderId(details,provider);
          phone=phone||getPhone(details);
          expiry=expiry||getExpiry(details);
        }
      }catch(error){console.error("TextVerified reservation detail lookup failed:",String(error));}
    }
  }
  if(!providerOrderId){
    await updateOrder(orderId,{status:"unknown",provider_state:"provider_order_id_missing",provider_payload:{response_received:true}});
    return json({success:true,pending:true,order_id:orderId,message:"The provider response is incomplete. Your order is awaiting confirmation; please do not purchase again."},202);
  }
  const order=await updateOrder(orderId,{provider_order_id:providerOrderId,phone_number:phone||null,expires_at:expiry,status:phone?"waiting":"unknown",provider_state:phone?"waiting":"number_pending_confirmation",provider_cost_kobo:q.providerCostKobo,provider_payload:{response_received:true}});
  return json({success:true,order});
}
async function actionStatus(orderId:string,userId:string){
  const order=await ownOrder(orderId,userId);
  if(["refunded","failed","expired","cancelled"].includes(order.status))return json({success:true,order});
  if(!order.provider_order_id)return json({success:true,pending:true,order});
  const result=await providerStatus(order);
  const code=findCode(result)||findCode(result?.sms_result);
  const sms=findSms(result)||findSms(result?.sms_result);
  const state=findState(result);
  const expiry=getExpiry(result)||order.expires_at||null;
  const phone=getPhone(result)||order.phone_number||null;
  const now=new Date().toISOString();
  if(code||sms||/^(received|complete|completed|success|successful|verified|finished)$/.test(state)){
    const updated=await updateOrder(order.id,{status:"received",provider_state:state||"received",otp_code:code||order.otp_code,sms_text:sms||order.sms_text,phone_number:phone,code_received_at:order.code_received_at||now,expires_at:expiry});
    if(code||sms)await saveMessage(updated,code,sms,str(result?.sender,result?.from));
    return json({success:true,order:updated,code_received:true});
  }
  if(/expired|timeout|timed.?out/.test(state)){
    await refund(order.id,"expired","Verification expired before an SMS was received");
    const updated=await ownOrder(order.id,userId);
    return json({success:true,order:updated,refunded:true});
  }
  if(/cancelled|canceled/.test(state)){
    await refund(order.id,"cancelled","Provider confirmed cancellation");
    const updated=await ownOrder(order.id,userId);
    return json({success:true,order:updated,refunded:true});
  }
  if(/failed|rejected|declined/.test(state)){
    await refund(order.id,"failed","Provider marked the verification as failed");
    const updated=await ownOrder(order.id,userId);
    return json({success:true,order:updated,refunded:true});
  }
  const updated=await updateOrder(order.id,{status:"waiting",provider_state:state||order.provider_state,phone_number:phone,expires_at:expiry});
  return json({success:true,order:updated,pending:true});
}
async function actionCancel(orderId:string,userId:string){
  const order=await ownOrder(orderId,userId);
  if(order.otp_code||order.status==="received")return json({success:false,error:"A message has already arrived. This order cannot be cancelled or refunded."},409);
  if(order.status==="refunded")return json({success:true,order,refunded:true});
  if(!order.provider_order_id)return json({success:false,error:"The provider has not confirmed a number for this request yet. Please refresh or contact support."},409);
  const id=encodeURIComponent(order.provider_order_id);
  try{
    if(order.provider_key==="fetchsms")await fetchRequest("/verifications/"+id+"/cancel",{method:"POST"},true);
    else if(order.provider_key==="textverified")await tvRequest("/verifications/"+id+"/cancel",{method:"POST"});
    else await virtualRequest("/customer/cancel/"+id,{method:"POST"});
  }catch(error){
    if(num((error as any)?.status)===409){
      const latest=await actionStatus(order.id,userId);
      return latest;
    }
    return json({success:true,pending:true,error:"Cancellation could not be confirmed. No refund has been processed yet."},202);
  }
  const latest=await providerStatus(order);
  const code=findCode(latest),sms=findSms(latest),state=findState(latest);
  if(code||sms||/complete|received|success|verified/.test(state)){
    const updated=await updateOrder(order.id,{status:"received",provider_state:state||"received",otp_code:code||null,sms_text:sms||null,code_received_at:new Date().toISOString()});
    if(code||sms)await saveMessage(updated,code,sms,str(latest?.sender,latest?.from));
    return json({success:false,error:"A message arrived before cancellation completed. This order cannot be refunded.",order:updated},409);
  }
  if(!/cancel/.test(state)){
    return json({success:true,pending:true,error:"The provider has not confirmed cancellation. No refund has been processed."},202);
  }
  await refund(order.id,"cancelled","Customer cancelled the verification");
  return json({success:true,refunded:true,order:await ownOrder(order.id,userId)});
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({success:false,error:"Method not allowed."},405);
  try{
    const user=await getUser(req),body=await req.json().catch(()=>({})),action=str(body?.action).toLowerCase();
    if(action==="pricing-list"||action==="pricing-save"){
      if(user.app_metadata?.role!=="admin")return json({success:false,error:"Administrator access is required."},403);
      if(action==="pricing-list"){
        const {data,error}=await admin.from("sparkle_sms_pricing_rules").select("*").order("provider_key").order("country_iso").order("service_code");
        if(error)throw new Error("Unable to load pricing rules.");
        return json({success:true,rules:data||[]});
      }
      const provider_key=str(body?.provider_key).toLowerCase();
      const country_iso=str(body?.country_iso).toUpperCase();
      const service_code=str(body?.service_code)||"*";
      const pricing_mode=str(body?.pricing_mode).toLowerCase();
      const markup_percent=num(body?.markup_percent,-1);
      const fixed_price_kobo=Math.round(num(body?.fixed_price_ngn,0)*100);
      if(!["fetchsms","textverified","virtualsms"].includes(provider_key))return json({success:false,error:"Choose a valid provider."},400);
      if(!(country_iso==="*"||/^[A-Z0-9_-]{2,16}$/.test(country_iso)))return json({success:false,error:"Enter a valid country code or * for all countries."},400);
      if(!["markup","fixed"].includes(pricing_mode))return json({success:false,error:"Choose a valid pricing mode."},400);
      if(pricing_mode==="markup"&&(!Number.isFinite(markup_percent)||markup_percent<0||markup_percent>1000))return json({success:false,error:"Markup must be between 0 and 1000 percent."},400);
      if(pricing_mode==="fixed"&&fixed_price_kobo<=0)return json({success:false,error:"Enter a fixed customer price greater than zero."},400);
      if((provider_key==="virtualsms"&&country_iso==="US")||(provider_key!=="virtualsms"&&country_iso!=="US"&&country_iso!=="*"))return json({success:false,error:"That provider cannot be assigned to the selected country."},400);
      const payload={provider_key,country_iso,service_code,pricing_mode,markup_percent:pricing_mode==="markup"?markup_percent:0,fixed_price_kobo:pricing_mode==="fixed"?fixed_price_kobo:null,is_active:true,updated_at:new Date().toISOString()};
      const {data,error}=await admin.from("sparkle_sms_pricing_rules").upsert(payload,{onConflict:"provider_key,country_iso,service_code"}).select().single();
      if(error)throw new Error("The pricing rule could not be saved.");
      return json({success:true,rule:data});
    }
    if(action==="quote")return await actionQuote(body);
    if(action==="purchase"||action==="buy")return await actionBuy(body,user.id,req);
    if(action==="status"||action==="check")return await actionStatus(str(body?.order_id,body?.orderId,body?.id),user.id);
    if(action==="cancel")return await actionCancel(str(body?.order_id,body?.orderId,body?.id),user.id);
    if(action==="orders"){
      const {data,error}=await admin.from("sparkle_sms_orders").select("id,provider_key,country_iso,country_name,service_name,provider_order_id,phone_number,customer_price_kobo,status,otp_code,sms_text,expires_at,code_received_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
      if(error)throw new Error("Unable to load your number orders.");
      return json({success:true,orders:data||[]});
    }
    return json({success:false,error:"Use quote, purchase, status, cancel or orders."},400);
  }catch(error){
    const message=error instanceof Error?error.message:"Unexpected server error.";
    console.error("Sparkle SMS order function:",message);
    return json({success:false,error:message},400);
  }
});