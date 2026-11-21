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
async function loadPlans() {
  const sel = $("#plan"); if (!sel) return;
  const key = kind === "data" ? $("#network").value : $("#provider").value;
  sel.innerHTML = '<option value="">Loading plans…</option>';
  if (!key) { sel.innerHTML = '<option value="">Choose a provider first</option>'; return; }
  try {
    const r = await call(kind === "data" ? { action: "variations", kind, network: key } : { action: "variations", kind, provider: key });
    sel.innerHTML = '<option value="">Choose a plan</option>' + r.variations.map((v) =>
      `<option value="${v.code}">${v.name.replace(/[<>&]/g, "")} — ${naira(v.amount)}</option>`).join("");
  } catch (e) { sel.innerHTML = '<option value="">Could not load plans</option>'; say(e.message, "error"); }
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
  if (kind === "data") { Object.assign(body, { network: v("network"), variationCode: v("plan") }); summary = `${$("#plan").selectedOptions[0]?.text} for ${body.phone}`; }
  if (kind === "electricity") { Object.assign(body, { serviceID: v("provider"), meter: v("meter"), meterType: v("meterType"), amount: Number(v("amount")) }); summary = `${naira(body.amount)} electricity for meter ${body.meter}`; }
  if (kind === "cable") { Object.assign(body, { serviceID: v("provider"), smartcard: v("smartcard"), variationCode: v("plan") }); summary = `${$("#plan").selectedOptions[0]?.text} for card ${body.smartcard}`; }
  if (!confirm(`Confirm payment:\n${summary}\n\nThis will be taken from your wallet.`)) return;

  btn.disabled = true; const label = btn.textContent; btn.textContent = "Processing…";
  try {
    const r = await call(body);
    if (r.status === "successful") {
      say("✓ Successful! " + (r.token ? "Your token: " + r.token : "Your order is complete.") + " See History for your receipt.", "success");
      reference = crypto.randomUUID(); form.reset(); return;
    }
    if (r.status === "failed") { say("The provider could not complete this. Your wallet has been refunded.", "error"); reference = crypto.randomUUID(); return; }
    say("Your order is processing. Please do not pay again — check History in a few minutes.", "info");
    reference = crypto.randomUUID();
  } catch (e) { say(e.message, "error"); }
  finally { btn.disabled = false; btn.textContent = label; }
});

supabase.auth.getSession().then(({ data }) => { if (!data.session) location.href = "login.html"; });
