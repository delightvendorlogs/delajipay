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
    item.append(title, meta, amount);
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
