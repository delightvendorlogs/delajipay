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
      showMessage("Your account was created, but this Supabase project is still requiring email confirmation. To enable immediate dashboard access as requested, turn off Confirm email in Supabase → Authentication → Providers → Email. No confirmation code is shown on this website.", "warning");
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
