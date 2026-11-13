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
  const [profiles, funding, ledger, orders, services] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("funding_transactions").select("amount_kobo,status,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("wallet_ledger").select("id,entry_type,amount_kobo,description,status,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("service_orders").select("id,status,amount_kobo,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("service_catalog").select("service_code,display_name,is_active,sort_order").order("sort_order")
  ]);

  const failures = [profiles, funding, ledger, orders, services].filter(result => result.error);
  if (failures.length) {
    showError("Some dashboard information could not be loaded. Check admin access and database permissions, then refresh.");
  }

  const fundRows = funding.data || [];
  const orderRows = orders.data || [];
  const successfulFunding = fundRows.filter(row => row.status === "successful");
  const postedCredits = (ledger.data || []).filter(row => row.entry_type === "credit" && row.status === "posted");
  const totalFundedKobo = successfulFunding.reduce((sum, row) => sum + Number(row.amount_kobo || 0), 0);
  const pendingPayments = fundRows.filter(row => ["initiated", "pending"].includes(row.status)).length;
  const pendingOrders = orderRows.filter(row => ["pending", "processing", "unknown"].includes(row.status)).length;

  setText("#stat-customers", profiles.count == null ? "—" : profiles.count.toLocaleString("en-NG"));
  setText("#stat-funding", money(totalFundedKobo));
  setText("#stat-payments", successfulFunding.length.toLocaleString("en-NG"));
  setText("#stat-pending", (pendingPayments + pendingOrders).toLocaleString("en-NG"));
  setText("#stat-ledger", postedCredits.length.toLocaleString("en-NG"));
  setText("#stat-orders", orderRows.length.toLocaleString("en-NG"));

  const serviceList = $("#admin-services");
  if (serviceList) {
    serviceList.replaceChildren();
    for (const service of services.data || []) {
      const item = document.createElement("div");
      item.className = "admin-service-row";
      const name = document.createElement("strong");
      name.textContent = service.display_name;
      const status = document.createElement("span");
      status.className = service.is_active ? "pill active" : "pill inactive";
      status.textContent = service.is_active ? "Active" : "Coming soon";
      item.append(name, status);
      serviceList.append(item);
    }
    if (!services.data?.length) serviceList.textContent = "No services configured.";
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
