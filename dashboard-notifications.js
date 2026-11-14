import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const supabase=createClient("https://fgkkzxfaxgkkcbkwbamx.supabase.co","sb_publishable_ImuiMjql4SAceGSyvvgeww_YPC9X4I_",{auth:{persistSession:true,autoRefreshToken:true}});
const {data:{user},error}=await supabase.auth.getUser();if(error)console.warn(error.message);
if(user){
 const style=document.createElement("style");
 style.textContent=".dp-quick-actions{position:fixed;right:14px;top:42%;z-index:30;display:flex;flex-direction:column;gap:10px}.dp-quick-actions a{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#0c8b7b;color:#fff;box-shadow:0 5px 18px #102b3d30;position:relative;border:2px solid #fff}.dp-quick-actions svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dp-quick-actions .dp-count{position:absolute;right:-5px;top:-5px;min-width:19px;height:19px;border-radius:20px;background:#d94b42;color:#fff;font:700 10px/19px system-ui;text-align:center;padding:0 4px;border:1px solid #fff}.dp-quick-actions a:focus-visible{outline:3px solid #142c3d;outline-offset:3px}@media(max-width:520px){.dp-quick-actions{right:10px;top:auto;bottom:112px}.dp-quick-actions a{width:44px;height:44px}}";
 document.head.append(style);
 const wrap=document.createElement("div");wrap.className="dp-quick-actions";wrap.setAttribute("aria-label","Quick actions");
 wrap.innerHTML='<a href="notifications.html" aria-label="Notifications" title="Notifications"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="dp-count" data-kind="notifications" hidden></span></a><a href="support.html" aria-label="Live chat support" title="Live chat"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg><span class="dp-count" data-kind="chat" hidden></span></a>';
 document.body.append(wrap);
 const notificationBadge=wrap.querySelector('[data-kind="notifications"]'),chatBadge=wrap.querySelector('[data-kind="chat"]');
 function paint(node,n){const count=Number.isFinite(Number(n))?Math.max(0,Number(n)):0;node.hidden=count===0;node.textContent=count===0?"":count>99?"99+":String(count);}
 async function refreshNotifications(){const {count,error}=await supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null);if(error){console.warn("Notification count unavailable:",error.message);paint(notificationBadge,0);return;}paint(notificationBadge,Number(count||0));}
 async function refreshChat(){const {data,error}=await supabase.rpc("delajipay_support_unread_count");if(error){console.warn("Unread support reply count unavailable:",error.message);paint(chatBadge,0);return;}paint(chatBadge,Number(data||0));}
 await Promise.all([refreshNotifications(),refreshChat()]);
 supabase.channel("dashboard-badges-"+user.id)
  .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},refreshNotifications)
  .on("postgres_changes",{event:"*",schema:"public",table:"support_messages"},refreshChat)
  .subscribe();
 window.addEventListener("focus",refreshChat);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshChat();});
}
