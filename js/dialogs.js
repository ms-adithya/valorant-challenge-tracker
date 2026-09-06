// Shared confirm dialog, notice dialog and toasts.
let pendingConfirmation=null;
function appConfirm({
 title="Are you sure?",
 message="This action cannot be undone.",
 confirmText="Confirm",
 kicker="CONFIRM ACTION",
 danger=true
}={}){
 return new Promise(resolve=>{
   pendingConfirmation=resolve;
   $("confirmKicker").textContent=kicker;
   $("confirmTitle").textContent=title;
   $("confirmMessage").textContent=message;
   $("confirmActionBtn").textContent=confirmText;
   $("confirmActionBtn").classList.toggle("danger-confirm",danger);
   $("confirmModal").classList.remove("hidden");
   $("confirmModal").setAttribute("aria-hidden","false");
   requestAnimationFrame(()=>$("confirmActionBtn").focus());
 });
}
function finishConfirmation(value){
 if(!$("confirmModal") || $("confirmModal").classList.contains("hidden"))return;
 $("confirmModal").classList.add("hidden");
 $("confirmModal").setAttribute("aria-hidden","true");
 const resolve=pendingConfirmation;pendingConfirmation=null;
 if(resolve)resolve(value);
}
document.querySelectorAll("[data-confirm-cancel]").forEach(el=>el.addEventListener("click",()=>finishConfirmation(false)));
if($("confirmActionBtn"))$("confirmActionBtn").addEventListener("click",()=>finishConfirmation(true));


function showAppNotice(message,title="Something needs attention"){
 const modal=$("noticeModal");
 if(!modal){console.warn(title,message);return}
 $("noticeTitle").textContent=title;
 $("noticeMessage").textContent=message;
 modal.classList.remove("hidden");
 modal.setAttribute("aria-hidden","false");
 requestAnimationFrame(()=>$("noticeOkBtn")?.focus());
}
function closeAppNotice(){
 const modal=$("noticeModal");if(!modal)return;
 modal.classList.add("hidden");modal.setAttribute("aria-hidden","true");
}
function showToast(message,tone="success"){
 const host=$("toastHost");if(!host)return;
 const el=document.createElement("div");
 el.className=`app-toast ${tone}`;
 el.textContent=message;
 host.appendChild(el);
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},2600);
}
document.querySelectorAll("[data-notice-close]").forEach(x=>x.addEventListener("click",closeAppNotice));
