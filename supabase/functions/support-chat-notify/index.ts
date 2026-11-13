import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const escapeHtml=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Method not allowed."},405);
 const authorization=req.headers.get("Authorization")||"";
 if(!authorization.startsWith("Bearer "))return respond({error:"Sign-in required."},401);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||"";
 if(!url||!anon||!service)return respond({error:"Notification service is not configured."},503);
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return respond({error:"Please sign in again."},401);
 let payload:any;try{payload=await req.json();}catch{return respond({error:"Invalid request."},400);}
 const conversationId=String(payload.conversationId||""),messageId=String(payload.messageId||"");
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(conversationId)||!uuid.test(messageId))return respond({error:"Invalid support message."},400);
 const db=createClient(url,service,{auth:{persistSession:false}});
 const [c,m,p]=await Promise.all([
  db.from("support_conversations").select("id,user_id").eq("id",conversationId).maybeSingle(),
  db.from("support_messages").select("id,conversation_id,sender_id,sender_type,body").eq("id",messageId).maybeSingle(),
  db.from("profiles").select("full_name").eq("id",user.id).maybeSingle()
 ]);
 if(c.error||!c.data||c.data.user_id!==user.id)return respond({error:"Conversation not found."},404);
 if(m.error||!m.data||m.data.conversation_id!==conversationId||m.data.sender_id!==user.id||m.data.sender_type!=="customer")return respond({error:"Customer message not found."},404);
 const cooldown=new Date(Date.now()-5*60*1000).toISOString();
 const claim=await db.from("support_conversations").update({last_alert_at:new Date().toISOString()}).eq("id",conversationId).or("last_alert_at.is.null,last_alert_at.lt."+cooldown).select("id").maybeSingle();
 if(claim.error)return respond({ok:false,error:"Could not schedule support notification."},500);
 if(!claim.data)return respond({ok:true,throttled:true,emailSent:false,telegramSent:false});
 const name=p.data?.full_name||user.email||"A DelajiPay customer",email=user.email||"Not available",preview=String(m.data.body||"").slice(0,700);
 const adminUrl=Deno.env.get("DELAJIPAY_ADMIN_URL")||"",adminEmail=Deno.env.get("ADMIN_NOTIFICATION_EMAIL")||"delajipay@gmail.com";
 let emailSent=false,emailError="";
 const key=Deno.env.get("RESEND_API_KEY")||"",from=Deno.env.get("RESEND_FROM_EMAIL")||"";
 if(key&&from){try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[adminEmail],subject:"New customer message — DelajiPay",html:"<h2>New message in DelajiPay Live Chat</h2><p><b>Customer:</b> "+escapeHtml(name)+"</p><p><b>Email:</b> "+escapeHtml(email)+"</p><p><b>Message:</b><br>"+escapeHtml(preview).replace(/\n/g,"<br>")+"</p><p>Conversation: "+escapeHtml(conversationId)+"</p>"+(adminUrl?"<p><a href='"+escapeHtml(adminUrl)+"'>Open Admin Support Inbox</a></p>":"")})});emailSent=response.ok;if(!response.ok)emailError=(await response.text()).slice(0,350);}catch(e){emailError=String(e);}}
 else emailError=!key?"RESEND_API_KEY is not configured.":"RESEND_FROM_EMAIL is not configured.";
 const {data:telegramSent,error:telegramRpcError}=await db.rpc("send_delajipay_telegram",{p_message:"💬 NEW DELAJIPAY LIVE CHAT MESSAGE\n\nCustomer: "+name+"\nEmail: "+email+"\nMessage: "+preview+"\nConversation ID: "+conversationId+(adminUrl?"\nAdmin inbox: "+adminUrl:"")});
 const telegramError=telegramRpcError?telegramRpcError.message:(telegramSent?"":"Telegram credentials are not configured in Supabase Vault.");
 return respond({ok:true,emailSent,telegramSent:telegramSent===true,emailError,telegramError});
});