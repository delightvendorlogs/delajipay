import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_REF_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VIRTUALSMS_API_KEY = Deno.env.get("VIRTUALSMS_API_KEY") ?? "";
const FETCHSMS_API_KEY = Deno.env.get("FETCHSMS_API_KEY") ?? "";
const TEXTVERIFIED_API_USERNAME = Deno.env.get("TEXTVERIFIED_API_USERNAME") ?? "";
const TEXTVERIFIED_API_KEY = Deno.env.get("TEXTVERIFIED_API_KEY") ?? "";

const VIRTUALSMS_BASE = "https://virtualsms.io/api/v1";
const FETCHSMS_BASE = "https://api.fetchsms.com/v1";
const TEXTVERIFIED_BASE = "https://www.textverified.com/api/pub/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}
function str(...values: unknown[]): string {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  for (const value of values) if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
function rows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["data", "results", "countries", "services", "items", "records", "list", "available_services", "available_countries"]) {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = rows(value);
      if (nested.length) return nested;
    }
  }
  const entries = Object.entries(data);
  if (entries.length && entries.every(([, value]) => typeof value === "string" || (value && typeof value === "object"))) {
    return entries.map(([key, value]) => typeof value === "string"
      ? { code: key, name: value, service_code: key, service_name: value }
      : { code: key, service_code: key, ...value as Record<string, unknown> });
  }
  return [];
}
function normalizeCountry(item: any) {
  const code = str(item?.code, item?.country_code, item?.countryCode, item?.country_iso, item?.countryIso, item?.iso2, item?.iso, item?.short_code, item?.value).toUpperCase();
  const name = str(item?.name, item?.country_name, item?.countryName, item?.country, item?.label, item?.title);
  return code && name ? { code, name, flag: str(item?.flag, item?.emoji), available: item?.available !== false } : null;
}
function cleanServiceName(value: string) {
  return value.replace(/\b(?:virtual\s*sms|virtualsms|fetch\s*sms|fetchsms|text\s*verified|textverified)\b/gi, "").replace(/[|·•:–—-]{2,}/g, " ").replace(/\s{2,}/g, " ").trim();
}
function normalizeService(item: any) {
  const code = str(item?.service_code, item?.serviceCode, item?.service_id, item?.serviceId, item?.code, item?.id, item?.service, item?.key, item?.slug, item?.value, item?.service_name, item?.serviceName);
  const name = cleanServiceName(str(item?.service_name, item?.serviceName, item?.name, item?.label, item?.title, item?.service, code));
  if (!code || !name) return null;
  return {
    code, name,
    available: item?.available !== false && (item?.short_available === undefined || Number(item.short_available) > 0),
    available_count: Number.isFinite(Number(item?.short_available ?? item?.available_count ?? item?.stock ?? item?.quantity)) ? Number(item.short_available ?? item.available_count ?? item.stock ?? item.quantity) : null,
    price_hint: Number.isFinite(Number(item?.price_cents ?? item?.price)) ? Number(item.price_cents ?? item.price) / 100 : null,
  };
}
async function getUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new Error("Please sign in.");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return data.user;
}
async function providerJson(url: string, headers: Record<string,string> = {}, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...headers, ...(options.headers as Record<string,string> || {}) } });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok || data?.success === false) throw new Error(str(data?.detail, data?.message, data?.error, "Provider request failed (" + response.status + ")."));
  return data;
}
async function virtualSmsRequest(path: string) {
  if (!VIRTUALSMS_API_KEY) throw new Error("VirtualSMS API key is not configured.");
  return await providerJson(VIRTUALSMS_BASE + path, { "X-API-Key": VIRTUALSMS_API_KEY });
}
async function fetchSmsRequest(path: string, authenticated = false) {
  if (authenticated && !FETCHSMS_API_KEY) throw new Error("Fetch SMS API key is not configured.");
  const headers: Record<string,string> = {};
  if (authenticated) headers.Authorization = "Bearer " + FETCHSMS_API_KEY;
  return await providerJson(FETCHSMS_BASE + path, headers);
}
let textVerifiedToken = "";
let textVerifiedTokenExpiresAt = 0;
async function getTextVerifiedToken(force = false) {
  if (!TEXTVERIFIED_API_USERNAME || !TEXTVERIFIED_API_KEY) throw new Error("TextVerified credentials are not configured.");
  if (!force && textVerifiedToken && Date.now() < textVerifiedTokenExpiresAt) return textVerifiedToken;
  const response = await fetch(TEXTVERIFIED_BASE + "/auth", {
    method: "POST",
    headers: { "X-API-KEY": TEXTVERIFIED_API_KEY, "X-API-USERNAME": TEXTVERIFIED_API_USERNAME, Accept: "application/json" },
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw new Error(str(data?.message, data?.error, data?.detail, "TextVerified authentication failed."));
  textVerifiedToken = str(data?.token, data?.access_token, data?.data?.token);
  if (!textVerifiedToken) throw new Error("TextVerified did not return an access token.");
  textVerifiedTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return textVerifiedToken;
}
async function textVerifiedRequest(path: string) {
  const token = await getTextVerifiedToken();
  const response = await fetch(TEXTVERIFIED_BASE + path, { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (response.status === 401) {
    await getTextVerifiedToken(true);
    const retry = await fetch(TEXTVERIFIED_BASE + path, { headers: { Authorization: "Bearer " + textVerifiedToken, Accept: "application/json" } });
    const retryRaw = await retry.text();
    try { data = retryRaw ? JSON.parse(retryRaw) : {}; } catch { data = { message: retryRaw }; }
    if (!retry.ok) throw new Error(str(data?.message, data?.error, data?.detail, "TextVerified catalogue request failed."));
    return data;
  }
  if (!response.ok) throw new Error(str(data?.message, data?.error, data?.detail, "TextVerified catalogue request failed."));
  return data;
}
function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function serviceRef(provider: string, country: string, code: string, name: string) {
  if (!SERVICE_REF_SECRET) throw new Error("Service catalogue is unavailable.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SERVICE_REF_SECRET));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify({ provider, country, code, name, issued: Date.now() })));
  return base64Url(iv) + "." + base64Url(new Uint8Array(encrypted));
}
async function countries() {
  const warnings: string[] = []; let international: any[] = [];
  try { const result = await virtualSmsRequest("/customer/countries"); international = rows(result).map(normalizeCountry).filter((x): x is NonNullable<typeof x> => Boolean(x && x.code !== "US" && !/united states|\busa\b/i.test(x.name))); } catch (error) { console.error("VirtualSMS country catalogue failed:", error instanceof Error ? error.message : String(error)); warnings.push("VirtualSMS country list temporarily unavailable."); }
  const usa = { code: "US", name: "United States", flag: "🇺🇸", available: true, aliases: ["USA", "US"] };
  const deduped = new Map<string, any>(); for (const country of international) deduped.set(country.code, country);
  return { success: true, countries: [usa, ...Array.from(deduped.values()).sort((a,b)=>a.name.localeCompare(b.name))], warnings };
}
async function services(country: string, mode: string) {
  const code = country.trim().toUpperCase(), catalogue = mode.trim().toLowerCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Choose a valid country.");
  let provider: string, data: any;
  if (catalogue === "usa" && code === "US") { provider = "textverified"; data = await textVerifiedRequest("/services?numberType=mobile&reservationType=verification"); }
  else if (catalogue === "all" && code === "US") { provider = "fetchsms"; data = await fetchSmsRequest("/services"); }
  else if (catalogue === "all" && code !== "US") { provider = "virtualsms"; data = await virtualSmsRequest("/customer/services?country=" + encodeURIComponent(code)); }
  else throw new Error("Choose a valid number destination.");
  const normalized = rows(data).map(normalizeService).filter(Boolean);
  const available = provider === "fetchsms" ? normalized.filter((item:any)=>item.available) : normalized;
  const publicServices = await Promise.all(available.map(async (item:any)=>({ref:await serviceRef(provider,code,item.code,item.name),name:item.name,available:item.available,available_count:item.available_count})));
  return { success:true, services:publicServices };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success:false,error:"Method not allowed." },405);
  try {
    await getUser(req);
    const body = await req.json().catch(()=>({}));
    const action = str(body?.action).toLowerCase();
    if (action === "countries") return json(await countries());
    if (action === "services") return json(await services(str(body?.country,body?.country_iso), str(body?.mode).toLowerCase()));
    return json({ success:false,error:"Use the countries or services action." },400);
  } catch (error) {
    console.error("BJVERIFY catalogue request failed:", error instanceof Error ? error.message : String(error));
    const raw = error instanceof Error ? error.message : "Unexpected server error.";
    const message = /virtualsms|fetchsms|textverified|provider|api key|credential|http \\d{3}/i.test(raw) ? "The catalogue is temporarily unavailable. Please try again." : raw;
    return json({ success:false,error:message },400);
  }
});