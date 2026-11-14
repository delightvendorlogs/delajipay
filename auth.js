import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const SUPABASE_URL = "https://fgkkzxfaxgkkcbkwbamx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (selector) => document.querySelector(selector);
const showMessage = (message, kind = "info") => {
  let box = $("#auth-message");
  if (!box) {
    box = document.createElement("div");
    box.id = "auth-message";
    box.className = "notice";
    const form = $("form");
    (form || document.querySelector("main") || document.body).append(box);
  }
  box.textContent = message;
  box.dataset.kind = kind;
  box.setAttribute("role", "status");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
};
const go = (page) => { window.location.replace(page); };
const currentPath = window.location.pathname;
const onAuthPage = /\/(login|signup|forgot-password)\.html$/.test(currentPath) || currentPath.endsWith("/");

async function guardPage() {
  if (onAuthPage) return;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    go("login.html?next=" + encodeURIComponent(currentPath.split("/").pop() || "dashboard.html"));
    return;
  }
  if (document.body.dataset.adminOnly === "true" && session.user.app_metadata?.role !== "admin") {
    showMessage("This account does not have administrator access.", "error");
    go("dashboard.html");
  }
}

await guardPage();

// Make the four customer tabs navigate reliably and mark the current section.
const customerNav = document.querySelector(".topbar .app-nav");
if (customerNav) {
  const currentFile = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
  customerNav.querySelectorAll('a[href$=".html"]').forEach((link) => {
    const target = link.getAttribute("href").split("/").pop().toLowerCase();
    const section = target === "wallet.html" || target === "wallet-fund.html" || target === "wallet-history.html" ? "wallet.html"
      : target === "transactions.html" || target === "transaction-details.html" ? "transactions.html"
      : target === "profile.html" ? "profile.html"
      : target === "dashboard.html" ? "dashboard.html" : null;
    const currentSection = currentFile.startsWith("wallet") ? "wallet.html"
      : currentFile.startsWith("transaction") ? "transactions.html"
      : currentFile === "profile.html" ? "profile.html"
      : currentFile === "dashboard.html" ? "dashboard.html" : null;
    if (section && section === currentSection) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    }
    if (target === "dashboard.html") {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.assign(new URL("dashboard.html", document.baseURI).href);
      });
    }
  });
}


async function refreshWalletUI() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const balanceNodes = document.querySelectorAll("[data-wallet-balance]");
  const { data: balanceKobo, error: balanceError } = await supabase.rpc("get_my_wallet_balance");
  if (!balanceError) {
    const formatted = new Intl.NumberFormat("en-NG", {
      style: "currency", currency: "NGN", minimumFractionDigits: 2
    }).format(Number(balanceKobo || 0) / 100);
    balanceNodes.forEach((node) => { node.textContent = formatted; });
  } else {
    balanceNodes.forEach((node) => { node.textContent = "Unavailable"; });
  }

  const ledgerBox = $("#wallet-ledger");
  if (!ledgerBox) return;
  const { data: entries, error } = await supabase
    .from("wallet_ledger")
    .select("id, entry_type, amount_kobo, reference, description, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  ledgerBox.replaceChildren();
  if (error) {
    ledgerBox.textContent = "Wallet activity could not be loaded right now.";
    return;
  }
  if (!entries?.length) {
    ledgerBox.textContent = "No wallet activity yet.";
    ledgerBox.className = "empty";
    return;
  }
  ledgerBox.className = "ledger-list";
  for (const entry of entries) {
    const item = document.createElement("article");
    item.className = "tile";
    const title = document.createElement("b");
    title.textContent = entry.description || (
      entry.entry_type === "credit" ? "Wallet credit" :
      entry.entry_type === "debit" ? "Wallet debit" : "Wallet reversal"
    );
    const meta = document.createElement("small");
    const date = new Date(entry.created_at).toLocaleString("en-NG", {
      dateStyle: "medium", timeStyle: "short"
    });
    meta.textContent = `${entry.entry_type.toUpperCase()} · ${entry.status} · ${date}`;
    const amount = document.createElement("strong");
    const sign = entry.entry_type === "debit" ? "−" : "+";
    amount.textContent = sign + new Intl.NumberFormat("en-NG", {
      style: "currency", currency: "NGN", minimumFractionDigits: 2
    }).format(Number(entry.amount_kobo) / 100);
    const details = document.createElement("a");
    details.className = "ledger-entry-link";
    details.href = "transaction-details.html?id=" + encodeURIComponent(entry.id);
    details.append(title, meta, amount);
    item.append(details);
    ledgerBox.append(item);
  }
}

const walletFundForm = $("#wallet-fund-form");
if (walletFundForm) {
  const amountInput = $("#wallet-fund-amount");
  const submitButton = walletFundForm.querySelector('button[type="submit"]');
  if (new URLSearchParams(window.location.search).get("payment") === "return") {
    showMessage("We are checking your payment. Your wallet will update automatically after Paystack confirms it.", "success");
  }
  walletFundForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = Number(amountInput?.value);
    if (!Number.isFinite(amount) || amount < 100 || Math.round(amount * 100) !== amount * 100) {
      showMessage("Enter an amount of at least ₦100, using no more than 2 decimal places.", "error");
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Connecting to Paystack…";
    const { data, error } = await supabase.functions.invoke("paystack_init_payment", {
      body: { amount }
    });
    if (error || data?.success !== true || !data?.authorization_url) {
      showMessage(data?.error || error?.message || "We could not start your payment. Please try again.", "error");
      submitButton.disabled = false;
      submitButton.textContent = "Continue to Paystack";
      return;
    }
    window.location.assign(data.authorization_url);
  });
}

if (document.querySelector("[data-wallet-balance]") || $("#wallet-ledger")) {
  await refreshWalletUI();
}


const loginForm = $("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Signing in…";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showMessage(error.message || "Unable to sign in. Check your details and try again.", "error");
      button.disabled = false; button.textContent = "Sign in";
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    go(next && /^[a-z0-9-]+\.html$/i.test(next) ? next : "dashboard.html");
  });
}

const signupForm = $("#signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const full_name = $("#signup-name").value.trim();
    const email = $("#signup-email").value.trim();
    const phone = $("#signup-phone").value.trim();
    const password = $("#signup-password").value;
    if (password.length < 8) {
      showMessage("Please use a password with at least 8 characters.", "error"); return;
    }
    const button = signupForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Creating account…";
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name, phone },
        emailRedirectTo: "https://delightvendorlogs.github.io/delajipay/dashboard.html"
      }
    });
    if (error) {
      showMessage(error.message || "Account creation failed. Please try again.", "error");
      button.disabled = false; button.textContent = "Create account";
      return;
    }
    if (data.session) {
      go("dashboard.html");
    } else {
      showMessage("Your account has been created. Please check your email (including Spam) and click the confirmation link to verify your address. You will then be taken to your DelajiPay dashboard.", "success");
      button.disabled = false; button.textContent = "Create account";
    }
  });
}

const recoveryForm = $("#recovery-form");
if (recoveryForm) {
  recoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#recovery-email").value.trim();
    const button = recoveryForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Sending link…";
    const redirectTo = new URL("forgot-password.html", window.location.href).href;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    showMessage(error ? error.message : "If an account exists for that email, a secure password-reset link has been sent.", error ? "error" : "success");
    button.disabled = false; button.textContent = "Send reset link";
  });
}

const updatePasswordForm = $("#update-password-form");
if (updatePasswordForm) {
  const revealReset = () => { updatePasswordForm.hidden = false; const intro = $("#recovery-intro"); if (intro) intro.hidden = true; };
  supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") revealReset(); });
  if (window.location.hash.includes("type=recovery")) revealReset();
  updatePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("#new-password").value;
    if (password.length < 8) { showMessage("Use at least 8 characters for your new password.", "error"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { showMessage(error.message, "error"); return; }
    showMessage("Your password has been updated. You can now sign in.", "success");
    await supabase.auth.signOut();
    setTimeout(() => go("login.html"), 1200);
  });
}

document.querySelectorAll("[data-signout]").forEach((button) => {
  button.addEventListener("click", async () => { await supabase.auth.signOut(); go("login.html"); });
});

const profileName = $("#account-name");
if (profileName) {
  const { data: { user } } = await supabase.auth.getUser();
  profileName.textContent = user?.user_metadata?.full_name || user?.email || "Customer";
}


// Live customer activity, transaction details, profile and notifications.
const moneyNGN = (kobo) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 2
}).format(Number(kobo || 0) / 100);
const dateNG = (value) => new Date(value).toLocaleString("en-NG", {
  dateStyle: "medium", timeStyle: "short"
});
const safeText = (value, fallback = "—") => value == null || value === "" ? fallback : String(value);

async function loadTransactions() {
  const list = document.querySelector("[data-transactions-list]");
  if (!list) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  list.textContent = "Loading your transactions…";
  const { data: rows, error } = await supabase.from("wallet_ledger")
    .select("id,entry_type,amount_kobo,reference,description,status,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) {
    list.className = "empty";
    list.textContent = "Your transactions could not be loaded. Please refresh and try again.";
    return;
  }
  const search = document.querySelector("#transaction-search");
  const filter = document.querySelector("#transaction-filter");
  const render = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const kind = filter?.value || "all";
    const filtered = (rows || []).filter(row => {
      const text = [row.description, row.reference, row.status, row.entry_type].join(" ").toLowerCase();
      return (kind === "all" || row.entry_type === kind) && (!q || text.includes(q));
    });
    list.replaceChildren();
    if (!filtered.length) {
      list.className = "empty";
      list.textContent = rows?.length ? "No transactions match this search." : "Your wallet transactions will appear here after activity.";
      return;
    }
    list.className = "transaction-list";
    for (const row of filtered) {
      const item = document.createElement("a");
      item.className = "transaction-row";
      item.href = "transaction-details.html?id=" + encodeURIComponent(row.id);
      const left = document.createElement("div");
      left.className = "transaction-main";
      const title = document.createElement("strong");
      title.textContent = row.description || (row.entry_type === "credit" ? "Wallet funding" : row.entry_type === "debit" ? "Wallet payment" : "Wallet adjustment");
      const meta = document.createElement("span");
      meta.textContent = dateNG(row.created_at) + " · " + safeText(row.reference);
      const status = document.createElement("small");
      status.className = "status-pill status-" + String(row.status || "pending").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      status.textContent = safeText(row.status, "Pending");
      left.append(title, meta, status);
      const amount = document.createElement("b");
      amount.className = row.entry_type === "debit" ? "amount-out" : "amount-in";
      amount.textContent = (row.entry_type === "debit" ? "−" : "+") + moneyNGN(row.amount_kobo);
      item.append(left, amount);
      list.append(item);
    }
  };
  search?.addEventListener("input", render);
  filter?.addEventListener("change", render);
  render();
}

async function loadTransactionDetails() {
  const panel = document.querySelector("[data-transaction-detail]");
  if (!panel) return;
  const { data: { user } } = await supabase.auth.getUser();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!user || !id) {
    panel.textContent = "This transaction link is missing or invalid.";
    return;
  }
  const { data: row, error } = await supabase.from("wallet_ledger")
    .select("id,entry_type,amount_kobo,reference,description,status,created_at,metadata")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !row) {
    panel.textContent = "We couldn't find this transaction in your account.";
    return;
  }
  panel.remove();
  const values = {
    "detail-description": row.description || "Wallet transaction",
    "detail-reference": row.reference,
    "detail-type": String(row.entry_type || "—").replace(/^./, c => c.toUpperCase()),
    "detail-status": row.status,
    "detail-date": dateNG(row.created_at),
    "detail-amount": (row.entry_type === "debit" ? "−" : "+") + moneyNGN(row.amount_kobo)
  };
  for (const [id, value] of Object.entries(values)) {
    const node = document.getElementById(id);
    if (node) node.textContent = safeText(value);
  }
}

async function loadProfile() {
  const form = document.querySelector("#profile-form");
  if (!form) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles")
    .select("full_name,phone,created_at").eq("id", user.id).maybeSingle();
  const name = form.querySelector("#profile-full-name");
  const phone = form.querySelector("#profile-phone");
  if (name) name.value = profile?.full_name || user.user_metadata?.full_name || "";
  if (phone) phone.value = profile?.phone || user.user_metadata?.phone || "";
  const email = document.querySelector("[data-profile-email]");
  if (email) email.textContent = user.email || "—";
  const joined = document.querySelector("[data-profile-joined]");
  if (joined) joined.textContent = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-NG", {dateStyle:"long"}) : "—";
  const verified = document.querySelector("[data-profile-status]");
  if (verified) verified.textContent = user.email_confirmed_at ? "Email verified" : "Email not verified";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const full_name = name?.value.trim() || "";
    const phoneValue = phone?.value.trim() || "";
    if (!full_name) { showMessage("Please enter your name.", "error"); return; }
    button.disabled = true; button.textContent = "Saving…";
    const { error: authUpdateError } = await supabase.auth.updateUser({ data: { full_name, phone: phoneValue } });
    if (authUpdateError) {
      showMessage(authUpdateError.message || "Your profile could not be saved.", "error");
      button.disabled = false; button.textContent = "Save changes";
      return;
    }
    if (profile) {
      const { error: profileError } = await supabase.from("profiles").update({ full_name, phone: phoneValue }).eq("id", user.id);
      if (profileError) {
        showMessage("Your account details were saved, but the profile record could not be refreshed. Please contact support if this continues.", "warning");
        button.disabled = false; button.textContent = "Save changes";
        return;
      }
    }
    showMessage("Your profile has been updated.", "success");
    button.disabled = false; button.textContent = "Save changes";
  });
}

async function loadNotifications() {
  const list = document.querySelector("[data-notifications-list]");
  if (!list) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: rows, error } = await supabase.from("notifications")
    .select("id,title,body,category,read_at,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  list.replaceChildren();
  if (error) {
    list.className = "empty";
    list.textContent = "Notifications could not be loaded. Please try again.";
    return;
  }
  if (!rows?.length) {
    list.className = "empty";
    list.textContent = "You're all caught up. New account and payment updates will appear here.";
    return;
  }
  list.className = "notification-list";
  for (const row of rows) {
    const card = document.createElement("article");
    card.className = "notification-row" + (row.read_at ? "" : " notification-unread");
    const title = document.createElement("strong");
    title.textContent = row.title;
    const body = document.createElement("p");
    body.textContent = row.body;
    const meta = document.createElement("small");
    meta.textContent = safeText(row.category) + " · " + dateNG(row.created_at);
    card.append(title, body, meta);
    if (!row.read_at) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "text-button"; button.textContent = "Mark as read";
      button.addEventListener("click", async () => {
        button.disabled = true;
        const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", user.id);
        if (updateError) { button.disabled = false; showMessage("Could not update this notification.", "error"); return; }
        card.classList.remove("notification-unread"); button.remove();
      });
      card.append(button);
    }
    list.append(card);
  }
}

await loadTransactions();
await loadTransactionDetails();
await loadProfile();
await loadNotifications();


async function loadRecentActivity() {
  const box = document.querySelector("[data-recent-transactions]");
  if (!box) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: rows, error } = await supabase.from("wallet_ledger")
    .select("id,entry_type,amount_kobo,reference,description,status,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(4);
  box.replaceChildren();
  if (error || !rows?.length) {
    box.className = "empty";
    box.textContent = error ? "Recent activity is temporarily unavailable." : "Your latest wallet activity will appear here.";
    return;
  }
  box.className = "recent-activity";
  for (const row of rows) {
    const link = document.createElement("a");
    link.className = "recent-activity-row";
    link.href = "transaction-details.html?id=" + encodeURIComponent(row.id);
    const title = document.createElement("strong");
    title.textContent = row.description || (row.entry_type === "credit" ? "Wallet funding" : "Wallet payment");
    const meta = document.createElement("small");
    meta.textContent = dateNG(row.created_at);
    const amount = document.createElement("b");
    amount.className = row.entry_type === "debit" ? "amount-out" : "amount-in";
    amount.textContent = (row.entry_type === "debit" ? "−" : "+") + moneyNGN(row.amount_kobo);
    link.append(title, meta, amount);
    box.append(link);
  }
}
await loadRecentActivity();
