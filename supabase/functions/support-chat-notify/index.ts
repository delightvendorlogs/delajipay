import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return respond({ error: "Sign-in required." }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!url || !anon || !service) return respond({ error: "Notification service is not configured." }, 503);

  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return respond({ error: "Please sign in again." }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return respond({ error: "Invalid request." }, 400); }
  const conversationId = String(payload.conversationId || "");
  const messageId = String(payload.messageId || "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(conversationId) || !uuid.test(messageId)) return respond({ error: "Invalid support message." }, 400);

  const db = createClient(url, service, { auth: { persistSession: false } });
  const [conversationResult, messageResult, profileResult] = await Promise.all([
    db.from("support_conversations").select("id,user_id,last_alert_at").eq("id", conversationId).maybeSingle(),
    db.from("support_messages").select("id,conversation_id,sender_id,sender_type,body,created_at").eq("id", messageId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const conversation = conversationResult.data;
  const message = messageResult.data;
  if (conversationResult.error || !conversation || conversation.user_id !== user.id) return respond({ error: "Conversation not found." }, 404);
  if (messageResult.error || !message || message.conversation_id !== conversationId ||
      message.sender_id !== user.id || message.sender_type !== "customer") {
    return respond({ error: "Customer message not found." }, 404);
  }

  // One alert per conversation per five minutes prevents a burst of messages from spamming the admin.
  const cooldown = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const claim = await db.from("support_conversations")
    .update({ last_alert_at: new Date().toISOString() })
    .eq("id", conversationId)
    .or("last_alert_at.is.null,last_alert_at.lt." + cooldown)
    .select("id")
    .maybeSingle();
  if (claim.error) {
    console.error("Unable to claim notification window:", claim.error.message);
    return respond({ ok: false, error: "Could not schedule support notification." }, 500);
  }
  if (!claim.data) return respond({ ok: true, throttled: true, emailSent: false, telegramSent: false });

  const customerName = profileResult.data?.full_name || user.email || "A DelajiPay customer";
  const customerEmail = user.email || "Not available";
  const preview = String(message.body || "").slice(0, 700);
  const subject = "New customer message — DelajiPay";
  const adminUrl = Deno.env.get("DELAJIPAY_ADMIN_URL") || "";
  const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "delajipay@gmail.com";

  let emailSent = false, emailError = "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";
  if (resendKey && fromEmail) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject,
          html: "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#172b3a'>" +
            "<h2 style='color:#087f68'>New message in DelajiPay Live Chat</h2>" +
            "<p><b>Customer:</b> " + escapeHtml(customerName) + "</p>" +
            "<p><b>Email:</b> " + escapeHtml(customerEmail) + "</p>" +
            "<p><b>Message:</b><br>" + escapeHtml(preview).replace(/\n/g, "<br>") + "</p>" +
            "<p><b>Conversation:</b> " + escapeHtml(conversationId) + "</p>" +
            (adminUrl ? "<p><a href='" + escapeHtml(adminUrl) + "'>Open DelajiPay Admin Support Inbox</a></p>" : "") +
            "</div>",
        }),
      });
      emailSent = response.ok;
      if (!response.ok) emailError = (await response.text()).slice(0, 350);
    } catch (error) { emailError = String(error); }
  } else {
    emailError = !resendKey ? "RESEND_API_KEY is not configured." : "RESEND_FROM_EMAIL is not configured.";
  }

  let telegramSent = false, telegramError = "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") || "";
  if (botToken && chatId) {
    try {
      const response = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          text: "<b>🔔 New DelajiPay Live Chat message</b>\n\n" +
            "<b>Customer:</b> " + escapeHtml(customerName) + "\n" +
            "<b>Email:</b> " + escapeHtml(customerEmail) + "\n" +
            "<b>Message:</b> " + escapeHtml(preview) + "\n" +
            "<b>Conversation ID:</b> <code>" + escapeHtml(conversationId) + "</code>" +
            (adminUrl ? "\n\n<a href='" + escapeHtml(adminUrl) + "'>Open Admin Support Inbox</a>" : ""),
        }),
      });
      const result = await response.json().catch(() => ({}));
      telegramSent = response.ok && result.ok === true;
      if (!telegramSent) telegramError = String(result.description || "Telegram delivery failed.");
    } catch (error) { telegramError = String(error); }
  } else {
    telegramError = "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.";
  }

  return respond({ ok: true, emailSent, telegramSent, emailError, telegramError });
});