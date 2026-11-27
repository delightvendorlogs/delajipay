const adminLinks=[["admin.html","Overview"],["admin-customers.html","Customers"],["admin-wallets.html","Wallets"],["admin-sms-orders.html","SMS orders"],["admin-sms-board.html","SMS board management"],["admin-providers.html","Providers"],["admin-pricing.html","SMS pricing"],["admin-settings.html","Platform settings"],["admin-support.html","Support inbox"],["admin-notifications.html","Notifications"]];
const header=document.querySelector(".topbar,.app-header");
if(header&&!header.querySelector(".admin-nav-menu")){
 const details=document.createElement("details");details.className="admin-nav-menu";
 const summary=document.createElement("summary");summary.textContent="Admin menu";
 const panel=document.createElement("nav");panel.className="admin-nav-menu-panel";panel.setAttribute("aria-label","Administrator pages");
 const current=(location.pathname.split("/").pop()||"admin.html").toLowerCase();
 for(const [href,label] of adminLinks){const a=document.createElement("a");a.href=href;a.textContent=label;if(href===current)a.setAttribute("aria-current","page");panel.append(a);}
 const external=document.createElement("a");external.href="index.html";external.className="admin-nav-external";external.textContent="Open customer website ↗";panel.append(external);
 details.append(summary,panel);header.insertBefore(details,header.querySelector("nav")||null);
 document.addEventListener("click",event=>{if(details.open&&!details.contains(event.target))details.open=false;});
}
