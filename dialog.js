// In-page dialogs that replace the browser's native confirm()/prompt() pop-ups.
const css = `
.dlg-back{position:fixed;inset:0;z-index:2000;background:rgba(11,38,56,.55);display:grid;place-items:center;padding:20px;animation:dlgf .15s ease}
.dlg-box{width:min(420px,100%);background:#fff;color:#142c3d;border-radius:20px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.35);font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.dlg-box h3{margin:0 0 8px;font-size:19px;letter-spacing:-.4px}
.dlg-box p{margin:0 0 6px;color:#3f5866;overflow-wrap:anywhere}
.dlg-box .dlg-note{font-size:13px;color:#687c89}
.dlg-box input{width:100%;margin-top:12px;padding:12px 13px;border:1.5px solid #dce5e8;border-radius:10px;font:inherit;color:#142c3d}
.dlg-box input:focus{outline:0;border-color:#0c8b7b;box-shadow:0 0 0 4px #0c8b7b1f}
.dlg-actions{display:flex;gap:10px;margin-top:20px}
.dlg-actions button{flex:1;min-height:46px;border-radius:12px;border:0;font:inherit;font-weight:750;cursor:pointer}
.dlg-cancel{background:#edf3f4;color:#173b49}.dlg-ok{background:#0c8b7b;color:#fff}
@keyframes dlgf{from{opacity:0}to{opacity:1}}`;
function ensureStyle() {
  if (document.getElementById("dlg-style")) return;
  const s = document.createElement("style"); s.id = "dlg-style"; s.textContent = css; document.head.append(s);
}
function open({ title, message, note, confirmText = "Continue", cancelText = "Cancel", input }) {
  ensureStyle();
  return new Promise((resolve) => {
    const back = document.createElement("div"); back.className = "dlg-back";
    const box = document.createElement("div"); box.className = "dlg-box"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    const h = document.createElement("h3"); h.textContent = title; box.append(h);
    if (message) { const p = document.createElement("p"); p.textContent = message; box.append(p); }
    if (note) { const n = document.createElement("p"); n.className = "dlg-note"; n.textContent = note; box.append(n); }
    let field = null;
    if (input) { field = document.createElement("input"); field.type = "text"; field.placeholder = input.placeholder || ""; field.maxLength = 200; box.append(field); }
    const row = document.createElement("div"); row.className = "dlg-actions";
    const no = document.createElement("button"); no.type = "button"; no.className = "dlg-cancel"; no.textContent = cancelText;
    const yes = document.createElement("button"); yes.type = "button"; yes.className = "dlg-ok"; yes.textContent = confirmText;
    row.append(no, yes); box.append(row); back.append(box); document.body.append(back);
    const prev = document.activeElement;
    const done = (v) => { back.remove(); document.removeEventListener("keydown", key); prev?.focus?.(); resolve(v); };
    const key = (e) => { if (e.key === "Escape") done(input ? null : false); if (e.key === "Enter" && field) done(field.value.trim()); };
    document.addEventListener("keydown", key);
    no.onclick = () => done(input ? null : false);
    yes.onclick = () => done(input ? field.value.trim() : true);
    back.addEventListener("click", (e) => { if (e.target === back) done(input ? null : false); });
    (field || yes).focus();
  });
}
export const askConfirm = (opts) => open(opts);
export const askText = (opts) => open({ ...opts, input: { placeholder: opts.placeholder } });
