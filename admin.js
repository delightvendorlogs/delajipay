import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const supabase = createClient(
  "https://fgkkzxfaxgkkcbkwbamx.supabase.co",
  "sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const $ = (selector) => document.querySelector(selector);
const money = (kobo) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 2
}).format(Number(kobo || 0) / 100);
const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
const showError = (message) => {
  const node = $("#admin-error");
  if (node) { node.hidden = false; node.textContent = message; }
};

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  window.location.replace("login.html?next=admin.html");
} else if (session.user.app_metadata?.role !== "admin") {
  window.location.replace("dashboard.html");
} else {
  setText("#admin-user", session.user.email || "Administrator");
  await loadOverview();
}

async function loadOverview() {
  const [profiles, funding, ledger, vtuOrders, smsOrders, board] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("funding_transactions").select("amount_kobo,status,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("wallet_ledger").select("id,entry_type,amount_kobo,description,status,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("service_orders").select("status").limit(5000),
    supabase.from("sparkle_sms_orders").select("status").limit(5000),
    supabase.from("platform_settings").select("sms_board_config").eq("singleton", true).maybeSingle()
  ]);

  const failures = [profiles, funding, ledger, vtuOrders, smsOrders, board].filter(result => result.error);
  if (failures.length) {
    showError("Some dashboard information could not be loaded. Check admin access and database permissions, then refresh.");
  }

  const fundRows = funding.data || [];
  const successfulFunding = fundRows.filter(row => row.status === "successful");
  const postedCredits = (ledger.data || []).filter(row => row.entry_type === "credit" && row.status === "posted");
  const totalFundedKobo = successfulFunding.reduce((sum, row) => sum + Number(row.amount_kobo || 0), 0);
  const pendingPayments = fundRows.filter(row => ["initiated", "pending"].includes(String(row.status).toLowerCase())).length
    + (vtuOrders.data || []).filter(row => ["initiated", "pending", "processing", "waiting", "unknown", "creating"].includes(String(row.status).toLowerCase())).length
    + (smsOrders.data || []).filter(row => ["initiated", "pending", "processing", "waiting", "unknown", "creating"].includes(String(row.status).toLowerCase())).length;

  setText("#stat-customers", profiles.count == null ? "—" : profiles.count.toLocaleString("en-NG"));
  setText("#stat-funding", money(totalFundedKobo));
  setText("#stat-payments", successfulFunding.length.toLocaleString("en-NG"));
  setText("#stat-pending", pendingPayments.toLocaleString("en-NG"));
  setText("#stat-ledger", postedCredits.length.toLocaleString("en-NG"));

  const serviceList = $("#admin-services");
  if (serviceList) {
    serviceList.replaceChildren();
    const config = board.data?.sms_board_config || {};
    const server1 = config.servers?.server1?.enabled !== false;
    const server2 = config.servers?.server2?.enabled !== false;
    const routes = [
      { name: "USA tab · TestVerified", detail: "Dedicated USA catalogue", enabled: true },
      { name: "All Countries · Server 1", detail: "VirtualSMS international · FetchSMS for USA", enabled: server1 },
      { name: "All Countries · Server 2", detail: "SMSBower pool inventory", enabled: server2 }
    ];
    for (const route of routes) {
      const item = document.createElement("div"); item.className = "admin-service-row";
      const detail = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = route.name;
      const meta = document.createElement("small"); meta.textContent = route.detail;
      detail.append(name, meta);
      const status = document.createElement("span"); status.className = "pill " + (route.enabled ? "active" : "inactive"); status.textContent = route.enabled ? "Enabled" : "Disabled";
      item.append(detail, status); serviceList.append(item);
    }
  }

  const activity = $("#admin-activity");
  if (activity) {
    activity.replaceChildren();
    for (const row of ledger.data || []) {
      const item = document.createElement("article");
      item.className = "activity-row";
      const detail = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = row.description || (row.entry_type === "credit" ? "Wallet credit" : "Wallet activity");
      const meta = document.createElement("small");
      meta.textContent = new Date(row.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) + " · " + row.status;
      detail.append(title, meta);
      const amount = document.createElement("b");
      amount.textContent = (row.entry_type === "debit" ? "−" : "+") + money(row.amount_kobo);
      item.append(detail, amount);
      activity.append(item);
    }
    if (!ledger.data?.length) activity.textContent = "No wallet activity has been recorded yet.";
  }

  setText("#admin-updated", "Updated " + new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }));
}

$("#admin-refresh")?.addEventListener("click", async () => {
  const button = $("#admin-refresh");
  button.disabled = true;
  button.textContent = "Refreshing…";
  await loadOverview();
  button.disabled = false;
  button.textContent = "Refresh data";
});
