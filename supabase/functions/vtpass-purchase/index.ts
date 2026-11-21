// DelajiPay — VTpass purchase gateway (Supabase Edge Function)
// Secrets needed: VTPASS_API_KEY, VTPASS_SECRET_KEY, VTPASS_PUBLIC_KEY, VTPASS_BASE_URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BASE = Deno.env.get("VTPASS_BASE_URL") ?? "https://sandbox.vtpass.com/api";
const API = Deno.env.get("VTPASS_API_KEY") ?? "";
const SECRET = Deno.env.get("VTPASS_SECRET_KEY") ?? "";
const PUBLIC = Deno.env.get("VTPASS_PUBLIC_KEY") ?? "";

const AIRTIME = { mtn: "mtn", airtel: "airtel", glo: "glo", "9mobile": "etisalat" } as Record<string, string>;
const DATA = { mtn: "mtn-data", airtel: "airtel-data", glo: "glo-data", "9mobile": "etisalat-data" } as Record<string, string>;
const DISCOS = ["ikeja-electric","eko-electric","abuja-electric","kano-electric","portharcourt-electric","jos-electric","ibadan-electric","kaduna-electric","enugu-electric","benin-electric","yola-electric","aba-electric"];
const CABLE = ["dstv", "gotv", "startimes"];

const phoneOk = (p: string) => /^0[789][01]\d{8}$/.test(p);

function lagosRequestId() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // Africa/Lagos = UTC+1
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  return stamp + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function vt(path: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "api-key": API };
  if (method === "POST") headers["secret-key"] = SECRET; else headers["public-key"] = PUBLIC;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return await res.json();
}

async function variations(serviceID: string) {
  const r = await vt(`/service-variations?serviceID=${encodeURIComponent(serviceID)}`, "GET");
  return (r?.content?.variations ?? r?.content?.varations ?? []) as Array<{ variation_code: string; name: string; variation_amount: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (!API || !SECRET || !PUBLIC || !service) return json({ error: "Service is not configured yet." }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await caller.auth.getUser();
  if (!u?.user) return json({ error: "Please sign in again." }, 401);
  const userId = u.user.id;
  const admin = createClient(url, service, { auth: { persistSession: false } });

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

  try {
    if (b.action === "variations") {
      const id = b.kind === "data" ? DATA[b.network] : CABLE.includes(b.provider) ? b.provider : "";
      if (!id) return json({ error: "Unknown provider." }, 400);
      const list = await variations(id);
      return json({ variations: list.map((v) => ({ code: v.variation_code, name: v.name, amount: Number(v.variation_amount) })) });
    }

    if (b.action === "verify") {
      const serviceID = b.serviceID;
      if (![...DISCOS, ...CABLE].includes(serviceID)) return json({ error: "Unknown provider." }, 400);
      const r = await vt("/merchant-verify", "POST", { billersCode: String(b.billersCode ?? ""), serviceID, type: b.type });
      const name = r?.content?.Customer_Name;
      if (!name) return json({ error: "Could not verify these details. Please check and try again." }, 422);
      return json({ customerName: name });
    }

    if (b.action === "requery") {
      const { data: o } = await admin.from("service_orders").select("*").eq("id", b.orderId).eq("user_id", userId).single();
      if (!o) return json({ error: "Order not found." }, 404);
      if (!["processing", "unknown"].includes(o.status)) return json({ status: o.status });
      const r = await vt("/requery", "POST", { request_id: o.provider_reference });
      const st = r?.content?.transactions?.status;
      const next = st === "delivered" ? "successful" : st === "failed" ? "failed" : o.status;
      if (next !== o.status) await admin.rpc("delajipay_settle_order", { p_order_id: o.id, p_status: next, p_provider_reference: o.provider_reference, p_provider_response: r, p_provider_cost_kobo: null });
      return json({ status: next });
    }

    if (b.action !== "purchase") return json({ error: "Unknown action." }, 400);
    const ref = String(b.reference ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(ref)) return json({ error: "Invalid reference." }, 400);

    let serviceCode = "", payload: Record<string, unknown> = {}, amountNaira = 0, recipient: Record<string, unknown> = {};
    const phone = String(b.phone ?? "");
    if (!phoneOk(phone)) return json({ error: "Enter a valid Nigerian phone number." }, 400);

    if (b.kind === "airtime") {
      const sid = AIRTIME[b.network]; amountNaira = Math.floor(Number(b.amount));
      if (!sid || amountNaira < 50 || amountNaira > 50000) return json({ error: "Check the network and amount (₦50 – ₦50,000)." }, 400);
      serviceCode = "airtime"; payload = { serviceID: sid, amount: amountNaira, phone };
      recipient = { network: b.network, phone };
    } else if (b.kind === "data") {
      const sid = DATA[b.network]; if (!sid) return json({ error: "Unknown network." }, 400);
      const v = (await variations(sid)).find((x) => x.variation_code === b.variationCode);
      if (!v) return json({ error: "That data plan is no longer available." }, 400);
      amountNaira = Math.round(Number(v.variation_amount));
      serviceCode = "data"; payload = { serviceID: sid, billersCode: phone, variation_code: v.variation_code, amount: amountNaira, phone };
      recipient = { network: b.network, phone, plan: v.name };
    } else if (b.kind === "electricity") {
      amountNaira = Math.floor(Number(b.amount));
      if (!DISCOS.includes(b.serviceID) || !["prepaid", "postpaid"].includes(b.meterType) || amountNaira < 500 || amountNaira > 500000 || !/^\d{6,20}$/.test(String(b.meter)))
        return json({ error: "Check the provider, meter number and amount (min ₦500)." }, 400);
      serviceCode = "electricity"; payload = { serviceID: b.serviceID, billersCode: String(b.meter), variation_code: b.meterType, amount: amountNaira, phone };
      recipient = { provider: b.serviceID, meter: b.meter, meterType: b.meterType, phone };
    } else if (b.kind === "cable") {
      if (!CABLE.includes(b.serviceID) || !/^\d{6,20}$/.test(String(b.smartcard))) return json({ error: "Check the provider and smartcard number." }, 400);
      const v = (await variations(b.serviceID)).find((x) => x.variation_code === b.variationCode);
      if (!v) return json({ error: "That bouquet is no longer available." }, 400);
      amountNaira = Math.round(Number(v.variation_amount));
      serviceCode = "cable_tv"; payload = { serviceID: b.serviceID, billersCode: String(b.smartcard), variation_code: v.variation_code, amount: amountNaira, phone, subscription_type: "change" };
      recipient = { provider: b.serviceID, smartcard: b.smartcard, bouquet: v.name, phone };
    } else return json({ error: "Unknown service." }, 400);

    const { data: placed, error: pe } = await admin.rpc("delajipay_place_order", {
      p_user_id: userId, p_service_code: serviceCode, p_amount_kobo: amountNaira * 100, p_customer_reference: ref, p_recipient: recipient,
    });
    if (pe) {
      const m = pe.message ?? "";
      if (m.includes("INSUFFICIENT_FUNDS")) return json({ error: "Insufficient wallet balance. Please fund your wallet." }, 402);
      if (m.includes("SERVICE_UNAVAILABLE")) return json({ error: "This service is temporarily unavailable." }, 503);
      return json({ error: "Could not start your order. Please try again." }, 500);
    }
    const order = placed?.[0];
    if (order.already_exists) return json({ orderId: order.order_id, status: order.status });

    const requestId = lagosRequestId();
    await admin.from("service_orders").update({ provider_reference: requestId }).eq("id", order.order_id);
    let status = "processing", resp: any = null, cost: number | null = null;
    try {
      resp = await vt("/pay", "POST", { request_id: requestId, ...payload });
      const tx = resp?.content?.transactions;
      if (resp?.code === "000" && tx?.status === "delivered") status = "successful";
      else if (resp?.code === "000" || resp?.code === "099" || tx?.status === "pending" || tx?.status === "initiated") status = "processing";
      else status = "failed";
      const total = Number(tx?.total_amount);
      if (status === "successful" && Number.isFinite(total) && total > 0) cost = Math.round(total * 100);
    } catch (_e) {
      status = "processing";
    }

    if (status !== "processing") {
      await admin.rpc("delajipay_settle_order", { p_order_id: order.order_id, p_status: status, p_provider_reference: requestId, p_provider_response: resp, p_provider_cost_kobo: cost });
    }
    return json({ orderId: order.order_id, status, token: resp?.purchased_code ?? resp?.token ?? null });
  } catch (_e) {
    return json({ error: "Something went wrong. Please check your history before trying again." }, 500);
  }
});
