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

// A short, branded hand-off after successful authentication.
if (window.location.pathname.endsWith("/welcome.html")) {
  const { data: { user } } = await supabase.auth.getUser();
  const params = new URLSearchParams(window.location.search);
  const isNew = params.get("mode") === "new";
  const rawName = user?.user_metadata?.full_name?.trim() || "";
  const name = rawName && !/^bj\s*verify$/i.test(rawName) ? rawName : "";
  const title = document.querySelector("[data-welcome-title]");
  const copy = document.querySelector("[data-welcome-copy]");
  const status = document.querySelector("[data-welcome-status]");
  if (title) title.textContent = isNew ? `Welcome to BJVERIFY${name ? ", " + name.split(/\s+/)[0] : ""}!` : `Welcome back${name ? ", " + name.split(/\s+/)[0] : ""}!`;
  if (copy) copy.textContent = isNew ? "Your account is ready. Your verification journey starts here." : "You're signed in. Your numbers, messages and wallet are ready.";
  const next = params.get("next");
  const destination = next && /^[a-z0-9-]+\.html$/i.test(next) ? next : "dashboard.html";
  // Automatically enter the dashboard when the welcome sequence completes.
  window.setTimeout(() => go(destination), 4200);
  if (status) status.textContent = "Preparing your secure dashboard…";

  // Pull real country/service pairs from the live catalogue for the rotating welcome display.
  const activity = document.querySelector("[data-welcome-activity]");
  const showActivity = (flag, service, countryName) => {
    if (!activity) return;
    activity.classList.add("is-changing");
    window.setTimeout(() => {
      const icon = document.createElement("span");
      icon.className = "welcome-activity-icon";
      icon.textContent = flag || "🌍";
      const label = document.createElement("span");
      label.textContent = (countryName || "Available destination") + " · " + service;
      activity.replaceChildren(icon, label);
      activity.classList.remove("is-changing");
    }, 350);
  };
  const fallbackActivities = [
    ["📱", "Virtual numbers"],
    ["💬", "SMS inbox"],
    ["🌍", "Country destinations"],
    ["🔐", "Secure verification"]
  ];
  let activities = [];
  try {
    const { data: countryData, error: countryError } = await supabase.functions.invoke("BJVERIFY-sms-catalog", { body: { action: "countries" } });
    if (!countryError && Array.isArray(countryData?.countries)) {
      const countryList = countryData.countries.slice(0, 4);
      const serviceLists = await Promise.all(countryList.map(async (country) => {
        const mode = country.code === "US" ? "usa" : "all";
        const { data, error } = await supabase.functions.invoke("BJVERIFY-sms-catalog", { body: { action: "services", country: country.code, mode } });
        if (error) return [];
        return (data?.services || []).filter(service => service.available !== false).slice(0, 2).map(service => ({
          flag: country.flag || "🌍", country: country.name, service: service.name
        }));
      }));
      activities = serviceLists.flat();
    }
  } catch (error) {
    console.warn("Welcome catalogue preview unavailable:", error);
  }
  if (activity) {
    const items = activities.length ? activities : fallbackActivities.map(([icon, service]) => ({ flag: icon, country: "", service }));
    let index = 0;
    const rotate = () => {
      const item = items[index % items.length];
      showActivity(item.flag, item.service, item.country);
      index += 1;
    };
    rotate();
    if (items.length > 1) window.setInterval(rotate, 1450);
  }
}

// Mark the active customer section without intercepting native navigation.
const customerNav = document.querySelector(".topbar .app-nav");
if (customerNav) {
  const currentFile = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
  const currentSection = currentFile.startsWith("wallet") ? "wallet.html"
    : currentFile.startsWith("transaction") ? "transactions.html"
    : currentFile === "profile.html" ? "profile.html"
    : currentFile === "dashboard.html" ? "dashboard.html" : null;
  customerNav.querySelectorAll('a[href$=".html"]').forEach((link) => {
    const target = link.getAttribute("href").split("/").pop().toLowerCase();
    const section = target === "wallet.html" || target === "wallet-fund.html" || target === "wallet-history.html" ? "wallet.html"
      : target === "transactions.html" || target === "transaction-details.html" ? "transactions.html"
      : target === "profile.html" ? "profile.html"
      : target === "dashboard.html" ? "dashboard.html" : null;
    if (section && section === currentSection) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
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
    item.className = "tile wallet-ledger-item ledger-" + String(entry.entry_type || "other").toLowerCase();
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
    const summary = document.createElement("span");
    summary.className = "ledger-entry-main";
    summary.append(title, meta);
    details.append(summary, amount);
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
  void refreshWalletUI().catch((error) => console.warn("Wallet summary unavailable:", error));
}


const profilePasswordForm = $("#profile-password-form");
if (profilePasswordForm) {
  profilePasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = $("#profile-new-password").value;
    const confirmPassword = $("#profile-confirm-password").value;
    if (next.length < 8) { showMessage("Use at least 8 characters for your new password.", "error"); return; }
    if (next !== confirmPassword) { showMessage("The new passwords do not match.", "error"); return; }
    const button = profilePasswordForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Updating password…";
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) showMessage(error.message || "Your password could not be updated.", "error");
    else { profilePasswordForm.reset(); showMessage("Your password has been changed successfully.", "success"); }
    button.disabled = false; button.textContent = "Change password";
  });
}
const profileEmailForm = $("#profile-email-form");
if (profileEmailForm) {
  profileEmailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#profile-new-email").value.trim();
    if (!email) { showMessage("Enter the new email address.", "error"); return; }
    const button = profileEmailForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Updating email…";
    const { error } = await supabase.auth.updateUser({ email });
    if (error) showMessage(error.message || "Your email could not be updated.", "error");
    else { profileEmailForm.reset(); showMessage("Check your inbox to confirm the new email address. Your current email remains active until confirmation.", "success"); }
    button.disabled = false; button.textContent = "Change email";
  });
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
    go("welcome.html?v=20261122-progress&mode=back&next=" + encodeURIComponent(next && /^[a-z0-9-]+\.html$/i.test(next) ? next : "dashboard.html"));
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
    const referralCode = (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase();
    if (password.length < 8) {
      showMessage("Please use a password with at least 8 characters.", "error"); return;
    }
    const button = signupForm.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = "Creating account…";
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name, phone, ...(referralCode ? { referral_code: referralCode } : {}) },
        emailRedirectTo: new URL("welcome.html?mode=new", window.location.href).href
      }
    });
    if (error) {
      showMessage(error.message || "Account creation failed. Please try again.", "error");
      button.disabled = false; button.textContent = "Create account";
      return;
    }
    if (data.session) {
      go("welcome.html?v=20261122-progress&mode=new");
    } else {
      showMessage("Your account has been created. Please check your email (including Spam) and click the confirmation link to verify your address. You will then be taken to your BJVERIFY dashboard.", "success");
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

// One consistent customer header, copied from the approved dashboard layout.
const currentCustomerFile = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
const isAdminPage = document.body.dataset.adminOnly === "true";
if (!onAuthPage && !isAdminPage) {
  const header = document.querySelector(".app-header, .topbar");
  if (header) {
    header.classList.remove("topbar");
    header.classList.add("app-header");
    document.body.classList.add("bjverify-app");

    // Use the exact dashboard brand mark and wordmark on every customer page.
    const brand = header.querySelector(".app-brand, .brand");
    if (brand) {
      brand.className = "app-brand";
      brand.replaceChildren();
      const mark = document.createElement("span");
      mark.className = "app-brand-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = '<svg viewBox="0 0 40 40"><rect x="10.5" y="3.5" width="19" height="33" rx="4.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 8h9M17 31.5h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m15.5 20.5 3.5 3.5 6.5-7" fill="none" stroke="#b9f5ff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const word = document.createElement("span");
      word.className = "app-brand-word";
      word.textContent = "BJVERIFY";
      brand.append(mark, word);
    }

    // Keep the hamburger after the logo, never before it.
    let toggle = header.querySelector(".app-mobile-menu");
    if (!toggle) {
      toggle = document.createElement("button");
      header.insertBefore(toggle, brand ? brand.nextSibling : header.firstChild);
    } else {
      const freshToggle = toggle.cloneNode(true);
      toggle.replaceWith(freshToggle);
      toggle = freshToggle;
      if (brand && brand.nextSibling !== toggle) brand.after(toggle);
    }
    toggle.className = "app-mobile-menu";
    toggle.type = "button";
    toggle.textContent = "☰";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-expanded", "false");

    let nav = header.querySelector(".app-nav");
    if (!nav) {
      nav = document.createElement("nav");
      header.append(nav);
    }
    nav.className = "app-nav";
    nav.setAttribute("aria-label", "Main navigation");
    nav.replaceChildren();

    const activeSection = currentCustomerFile.startsWith("wallet") ? "wallet.html"
      : currentCustomerFile.startsWith("transaction") ? "transactions.html"
      : currentCustomerFile === "dashboard.html" ? "dashboard.html"
      : currentCustomerFile === "numbers.html" ? "numbers.html"
      : currentCustomerFile === "inbox.html" ? "inbox.html"
      : currentCustomerFile === "profile.html" ? "profile.html" : "";

    const links = [
      ["dashboard.html", "Dashboard"],
      ["numbers.html", "Buy a number"],
      ["inbox.html", "SMS inbox"],
      ["wallet.html", "Wallet"],
      ["transactions.html", "Activity"],
      ["profile.html", "Profile"]
    ];
    for (const [href, label] of links) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (href === activeSection) link.setAttribute("aria-current", "page");
      nav.append(link);
    }
    const signout = document.createElement("button");
    signout.type = "button";
    signout.className = "nav-signout";
    signout.dataset.signout = "";
    signout.textContent = "Sign out";
    nav.append(signout);

    const closeMenu = () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.textContent = "☰";
    };
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.textContent = open ? "×" : "☰";
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a, [data-signout]")) closeMenu();
    });
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }
}

document.querySelectorAll("[data-signout]").forEach((button) => {
  button.addEventListener("click", async () => { await supabase.auth.signOut(); go("login.html"); });
});

const profileName = $("#account-name");
if (profileName) {
  const { data: { user } } = await supabase.auth.getUser();
  const displayName = user?.user_metadata?.full_name || user?.email || "Customer";
  profileName.textContent = displayName;
  const welcomeHeading = document.querySelector("[data-welcome-heading]");
  if (welcomeHeading && user?.user_metadata?.full_name) welcomeHeading.textContent = "Welcome back, " + user.user_metadata.full_name.trim().split(/\s+/)[0] + ".";
}

const dashboardWelcome = document.querySelector("[data-welcome-heading]");
if (dashboardWelcome && !profileName) {
  const { data: { user } } = await supabase.auth.getUser();
  const savedName = user?.user_metadata?.full_name?.trim();
  if (savedName) dashboardWelcome.textContent = "Welcome back, " + savedName.split(/\s+/)[0] + ".";
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
      item.className = "transaction-row transaction-" + String(row.entry_type || "other").toLowerCase();
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
  const heading = document.querySelector("[data-profile-heading]");
  const avatar = document.querySelector(".profile-avatar");
  const setAvatarInitials = (value) => {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    const initials = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "BJ").slice(0, 2);
    if (avatar) avatar.textContent = initials.toUpperCase();
  };
  const currentName = profile?.full_name || user.user_metadata?.full_name || "";
  if (heading) heading.textContent = currentName || "Your BJVERIFY account";
  setAvatarInitials(currentName);
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
    const profileWrite = profile
      ? await supabase.from("profiles").update({ full_name, phone: phoneValue }).eq("id", user.id)
      : await supabase.from("profiles").insert({ id: user.id, full_name, phone: phoneValue });
    if (profileWrite.error) {
      showMessage("Your account details were saved, but the profile record could not be created or refreshed. " + profileWrite.error.message, "warning");
      button.disabled = false; button.textContent = "Save changes";
      return;
    }
    if (heading) heading.textContent = full_name;
    setAvatarInitials(full_name);
    document.querySelectorAll("#account-name,[data-account-name]").forEach((node) => { node.textContent = full_name; });
    const welcomeHeading = document.querySelector("[data-welcome-heading]");
    if (welcomeHeading) welcomeHeading.textContent = "Welcome back, " + full_name.split(/\s+/)[0] + ".";
    showMessage("Your profile has been updated. Your name will appear across your BJVERIFY account.", "success");
    button.disabled = false; button.textContent = "Save profile details";
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

void Promise.all([
  loadTransactions(),
  loadTransactionDetails(),
  loadProfile(),
  loadNotifications()
]).catch((error) => console.warn("BJVERIFY SMS page data could not be fully loaded:", error));


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
void loadRecentActivity().catch((error) => console.warn("Recent activity unavailable:", error));
