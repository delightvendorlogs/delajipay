import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase = createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co", "sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_", { auth: { persistSession: true, autoRefreshToken: true } });
const box = document.querySelector("#orders-list");
const naira = (k) => "₦" + (Number(k) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
const LABEL = { airtime: "Airtime", data: "Data", electricity: "Electricity", cable_tv: "Cable TV" };
const STATUS = { successful: ["Successful", "ok"], failed: ["Failed · refunded", "bad"], processing: ["Processing", "wait"], pending: ["Pending", "wait"], unknown: ["Checking", "wait"], reversed: ["Reversed", "bad"] };

function detail(o) {
  const r = o.recipient || {};
  return [r.network, r.plan, r.provider, r.bouquet, r.phone || r.meter || r.smartcard].filter(Boolean).join(" · ");
}
async function recheck(o, btn) {
  btn.disabled = true; btn.textContent = "Checking…";
  const { data, error } = await supabase.functions.invoke("vtpass-purchase", { body: { action: "requery", orderId: o.id } });
  if (error || !data) { btn.disabled = false; btn.textContent = "Check status"; return; }
  load();
}
async function load() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: rows, error } = await supabase.from("service_orders")
    .select("id,service_code,amount_kobo,status,recipient,created_at").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(20);
  box.replaceChildren();
  if (error) { box.className = "empty"; box.textContent = "Orders could not be loaded right now."; return; }
  if (!rows.length) { box.className = "empty"; box.textContent = "No orders yet. Your airtime, data, electricity and TV purchases will appear here."; return; }
  box.className = "order-list";
  rows.forEach((o) => {
    const [text, tone] = STATUS[o.status] || [o.status, "wait"];
    const row = document.createElement("div"); row.className = "order-row";
    const left = document.createElement("div");
    const t = document.createElement("strong"); t.textContent = LABEL[o.service_code] || o.service_code;
    const d = document.createElement("small"); d.textContent = detail(o) + (detail(o) ? " · " : "") + new Date(o.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
    left.append(t, d);
    const right = document.createElement("div"); right.className = "order-right";
    const a = document.createElement("b"); a.textContent = naira(o.amount_kobo);
    const s = document.createElement("span"); s.className = "chip " + tone; s.textContent = text;
    right.append(a, s);
    if (["processing", "unknown", "pending"].includes(o.status)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn-ghost"; b.textContent = "Check status";
      b.addEventListener("click", () => recheck(o, b)); right.append(b);
    }
    row.append(left, right); box.append(row);
  });
}
load();
