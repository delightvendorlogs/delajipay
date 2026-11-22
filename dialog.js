// BJVERIFY in-app dialogs. No browser-owned confirm/alert prompts.
const css = `
.dlg-back{position:fixed;inset:0;z-index:3000;background:rgba(3,10,23,.76);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;animation:dlgf .16s ease}
.dlg-box{width:min(430px,100%);background:linear-gradient(155deg,#12243b,#091629);color:#edf7ff;border:1px solid #294761;border-radius:20px;padding:23px;box-shadow:0 28px 90px #0009;font:14px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.dlg-box h3{margin:0 0 9px;font-size:19px;letter-spacing:-.35px;color:#f5fbff}
.dlg-box p{margin:0 0 7px;color:#b8cbe0;overflow-wrap:anywhere}
.dlg-box .dlg-note{font-size:12px;color:#89a4c0}
.dlg-actions{display:flex;gap:10px;margin-top:20px}
.dlg-actions button{flex:1;min-height:46px;border-radius:11px;border:1px solid transparent;font:inherit;font-weight:750;cursor:pointer}
.dlg-cancel{background:#1b3048;color:#d8e8f8;border-color:#34516e!important}.dlg-ok{background:linear-gradient(100deg,#1f9ac4,#31c6d9);color:#041522}
@keyframes dlgf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`;
function ensureStyle(){if(document.getElementById("dlg-style"))return;const s=document.createElement("style");s.id="dlg-style";s.textContent=css;document.head.append(s);}
function open({title="BJVERIFY",message="",note="",confirmText="Continue",cancelText="Cancel",singleAction=false}={}){
 ensureStyle();return new Promise(resolve=>{
  const back=document.createElement("div");back.className="dlg-back";
  const box=document.createElement("div");box.className="dlg-box";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");
  const h=document.createElement("h3");h.textContent=title;box.append(h);
  if(message){const p=document.createElement("p");p.textContent=message;box.append(p);}
  if(note){const n=document.createElement("p");n.className="dlg-note";n.textContent=note;box.append(n);}
  const row=document.createElement("div");row.className="dlg-actions";
  const no=document.createElement("button");no.type="button";no.className="dlg-cancel";no.textContent=cancelText;
  const yes=document.createElement("button");yes.type="button";yes.className="dlg-ok";yes.textContent=confirmText;
  if(!singleAction)row.append(no);row.append(yes);box.append(row);back.append(box);document.body.append(back);
  const prev=document.activeElement;const done=value=>{back.remove();document.removeEventListener("keydown",key);prev?.focus?.();resolve(value);};
  const key=e=>{if(e.key==="Escape")done(false);if(e.key==="Enter")done(true);};document.addEventListener("keydown",key);
  no.onclick=()=>done(false);yes.onclick=()=>done(true);back.addEventListener("click",e=>{if(e.target===back)done(false);});yes.focus();
 });
}
export const askConfirm=opts=>open(opts);
export const showNotice=opts=>open({...opts,singleAction:true,confirmText:opts?.confirmText||"Got it"});
