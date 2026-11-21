import { askConfirm } from "./dialog.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase = createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co", "sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_", {
  auth: { persistSession: true, autoRefreshToken: true }
});
const $ = (s) => document.querySelector(s);
const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
const form = $("form[data-kind]");
const kind = form.dataset.kind;
const msg = $("#purchase-msg");
const btn = form.querySelector("button[type=submit]");
let reference = crypto.randomUUID();

const say = (text, type = "info") => { msg.textContent = text; msg.className = "purchase-msg " + type; msg.hidden = !text; };
const call = async (body) => {
  const { data, error } = await supabase.functions.invoke("vtpass-purchase", { body });
  if (error) {
    let m = "Something went wrong. Please try again.";
    try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {}
    throw new Error(m);
  }
  return data;
};

// ---- dynamic plan lists (data & cable) ----
let selectedPlan = null, allPlans = [], activeGroup = "All";
const GROUPS = ["All", "Daily", "Weekly", "Monthly", "Long term", "Other"];
function groupOf(name) {
  const n = name.toLowerCase();
  if (/(2|3|6|two|three|six)\s*months?|60\s*days?|90\s*days?|180\s*days?|quarter|year|365/.test(n)) return "Long term";
  if (/30\s*days?|31\s*days?|month/.test(n)) return "Monthly";
  if (/hrs?\b|hours?|daily|1\s*day|24|midnight|night/.test(n)) return "Daily";
  if (/week|\b[2-9]\s*days?|1[0-4]\s*days?/.test(n)) return "Weekly";
  return "Other";
}
const css = `.plan-label{display:block;font-size:13px;font-weight:700;margin:16px 0 7px}
.plan-groups{display:flex;gap:8px;overflow-x:auto;padding:10px 0 4px}
.plan-chip{border:1.5px solid var(--line);background:#fff;color:var(--ink);padding:8px 14px;border-radius:99px;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer}
.plan-chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff}
.plan-list{display:grid;gap:8px;max-height:330px;overflow:auto;margin:8px 0 14px;padding:2px}
.plan-row{display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;padding:13px 14px;border:1.5px solid var(--line);border-radius:13px;background:#fff;color:var(--ink);font-size:14px;font-weight:650;cursor:pointer}
.plan-row small{display:block;color:var(--muted);font-weight:600;font-size:12px}.plan-row b{white-space:nowrap}
.plan-row[aria-pressed="true"]{border-color:var(--brand);background:#e9f6f3}`;
const st = document.createElement("style"); st.textContent = css; document.head.append(st);

function renderPlans() {
  const list = $("#plan-list"), q = ($("#plan-search")?.value || "").toLowerCase().trim();
  const shown = allPlans.filter((p) => (activeGroup === "All" || p.group === activeGroup) && (!q || p.name.toLowerCase().includes(q)));
  list.replaceChildren();
  if (!shown.length) { const m = document.createElement("p"); m.className = "muted"; m.textContent = "No plans found."; list.append(m); return; }
  shown.forEach((p) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "plan-row"; b.setAttribute("aria-pressed", String(selectedPlan?.code === p.code));
    const l = document.createElement("span"); l.textContent = p.name; const sm = document.createElement("small"); sm.textContent = p.group; l.append(sm);
    const a = document.createElement("b"); a.textContent = naira(p.amount);
    b.append(l, a); b.addEventListener("click", () => { selectedPlan = p; renderPlans(); }); list.append(b);
  });
}
function renderGroups() {
  const box = $("#plan-groups"); box.replaceChildren();
  GROUPS.filter((g) => g === "All" || allPlans.some((p) => p.group === g)).forEach((g) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "plan-chip"; b.textContent = g; b.setAttribute("aria-pressed", String(g === activeGroup));
    b.addEventListener("click", () => { activeGroup = g; renderGroups(); renderPlans(); }); box.append(b);
  });
}
$("#plan-search")?.addEventListener("input", renderPlans);

async function loadPlans() {
  selectedPlan = null; activeGroup = "All"; allPlans = [];
  const sel = $("#plan");
  const key = kind === "data" ? $("#network").value : $("#provider").value;
  if (kind === "data") { $("#plan-groups").replaceChildren(); $("#plan-list").textContent = key ? "Loading plans…" : "Choose a network first"; }
  else { sel.innerHTML = '<option value="">Loading plans…</option>'; }
  if (!key) { if (kind !== "data") sel.innerHTML = '<option value="">Choose a provider first</option>'; return; }
  try {
    const r = await call(kind === "data" ? { action: "variations", kind, network: key } : { action: "variations", kind, provider: key });
    if (kind === "data") {
      allPlans = r.variations.map((v) => ({ code: v.code, name: v.name.replace(/[<>&]/g, ""), amount: v.amount, group: groupOf(v.name) }))
        .sort((a, b) => a.amount - b.amount);
      renderGroups(); renderPlans();
    } else {
      sel.innerHTML = '<option value="">Choose a plan</option>' + r.variations.map((v) =>
        `<option value="${v.code}">${v.name.replace(/[<>&]/g, "")} — ${naira(v.amount)}</option>`).join("");
    }
  } catch (e) {
    if (kind === "data") $("#plan-list").textContent = "Could not load plans."; else sel.innerHTML = '<option value="">Could not load plans</option>';
    say(e.message, "error");
  }
}
$("#network")?.addEventListener("change", () => kind === "data" && loadPlans());
$("#provider")?.addEventListener("change", () => { if (kind === "cable") loadPlans(); $("#verified").textContent = ""; });

// ---- verify meter / smartcard ----
$("#verify-btn")?.addEventListener("click", async () => {
  const out = $("#verified"); out.textContent = "Checking…";
  try {
    const r = kind === "electricity"
      ? await call({ action: "verify", serviceID: $("#provider").value, billersCode: $("#meter").value.trim(), type: $("#meterType").value })
      : await call({ action: "verify", serviceID: $("#provider").value, billersCode: $("#smartcard").value.trim() });
    out.textContent = "✓ " + r.customerName;
  } catch (e) { out.textContent = ""; say(e.message, "error"); }
});

// ---- submit ----
form.addEventListener("submit", async (ev) => {
  ev.preventDefault(); say("");
  const v = (id) => ($("#" + id)?.value || "").trim();
  const body = { action: "purchase", kind, reference, phone: v("phone") };
  let summary = "";
  if (kind === "airtime") { Object.assign(body, { network: v("network"), amount: Number(v("amount")) }); summary = `${naira(body.amount)} ${body.network} airtime to ${body.phone}`; }
  if (kind === "data") {
    if (!selectedPlan) { say("Please choose a data plan.", "error"); return; }
    Object.assign(body, { network: v("network"), variationCode: selectedPlan.code }); summary = `${selectedPlan.name} (${naira(selectedPlan.amount)}) for ${body.phone}`;
  }
  if (kind === "electricity") { Object.assign(body, { serviceID: v("provider"), meter: v("meter"), meterType: v("meterType"), amount: Number(v("amount")) }); summary = `${naira(body.amount)} electricity for meter ${body.meter}`; }
  if (kind === "cable") { Object.assign(body, { serviceID: v("provider"), smartcard: v("smartcard"), variationCode: v("plan") }); summary = `${$("#plan").selectedOptions[0]?.text} for card ${body.smartcard}`; }
  if (!(await askConfirm({ title: "Confirm payment", message: summary, note: "This amount will be taken from your wallet.", confirmText: "Pay now" }))) return;

  btn.disabled = true; const label = btn.textContent; btn.textContent = "Processing…";
  try {
    const r = await call(body);
    if (r.status === "successful") {
      say("✓ Successful! " + (r.token ? "Your token: " + r.token : "Your order is complete.") + " See History for your receipt.", "success");
      reference = crypto.randomUUID(); form.reset(); selectedPlan = null;
      if (kind === "data") { allPlans = []; $("#plan-groups").replaceChildren(); $("#plan-list").textContent = "Choose a network first"; }
      return;
    }
    if (r.status === "failed") { say("The provider could not complete this. Your wallet has been refunded.", "error"); reference = crypto.randomUUID(); return; }
    say("Your order is processing. Please do not pay again — check History in a few minutes.", "info");
    reference = crypto.randomUUID();
  } catch (e) { say(e.message, "error"); }
  finally { btn.disabled = false; btn.textContent = label; }
});

supabase.auth.getSession().then(({ data }) => { if (!data.session) location.href = "login.html"; });
