// Add/edit match modal: open/close, rounds auto-sync, and the add/edit/delete
// click delegation and Escape handling.
let roundsManuallyEdited=false;
function calculatedRoundsFromScore(){
 const my=Math.max(0,Number($("myScore")?.value||0));
 const enemy=Math.max(0,Number($("enemyScore")?.value||0));
 return my+enemy;
}
function syncRoundsFromScore(force=false){
 const rounds=$("rounds");
 if(!rounds)return;
 if(force||!roundsManuallyEdited)rounds.value=String(calculatedRoundsFromScore());
}

window.openModal=function openModal(editNo=null){
 if(!data){showAppNotice("Create or open a challenge before adding a match.","No active challenge");return}
 const form=$("matchForm");form.reset();$("editNo").value="";roundsManuallyEdited=false;clearValidationErrors();
 const isEdit=editNo!==null && editNo!==undefined && editNo!=="";
 if(isEdit){
   const no=Number(editNo),m=data.matches.find(x=>x.no===no);if(!m){showAppNotice("That match could not be found.","Match unavailable");return;}
   $("editNo").value=String(no);$("matchNo").value=String(no);$("matchTitle").textContent=`Edit match #${no}`;$("matchSubtitle")&&($("matchSubtitle").textContent="Update any match details. Analytics will recalculate after saving.");$("matchNumberBadge").textContent=`MATCH #${no}`;$("saveMatchBtn").textContent="Save changes";
   Object.entries(m).forEach(([k,v])=>{const el=$(k);if(el && v!==undefined && v!==null)el.value=String(v)});
 }else{
   const c=cur(),next=nextCountedMatchNumber();
   $("matchNo").value=String(next);
   $("matchTitle").textContent=`Add match #${next}`;$("matchSubtitle")&&($("matchSubtitle").textContent="Record the result, rank movement and performance stats.");$("matchNumberBadge").textContent=`MATCH #${next}`;$("saveMatchBtn").textContent="Save match";
   $("rankAfter").value=c.rankAfter;if(c.rrAfter!==null)$("rrAfter").value=String(c.rrAfter);
   if($("result"))$("result").value="Win";
   if($("rankStatus"))$("rankStatus").value="Same Rank";
   syncRoundsFromScore(true);
 }
 $("modal").classList.remove("hidden");
 document.body.classList.add("modal-open");
 requestAnimationFrame(()=>{const first=$("agent");if(first)first.focus()});
}
function closeModal(){const modal=$("modal");if(modal)modal.classList.add("hidden");document.body.classList.remove("modal-open")}

document.addEventListener("click",async function(e){
 const add=e.target.closest("#addMatchBtn");
 if(add){e.preventDefault();openModal();return;}
 const edit=e.target.closest("[data-edit-match]");
 if(edit){e.preventDefault();openModal(Number(edit.dataset.editMatch));return;}
 const del=e.target.closest("[data-delete-match]");
 if(del){
   e.preventDefault();
   const no=Number(del.dataset.deleteMatch);
   const match=data&&data.matches.find(m=>m.no===no);
   if(!match)return;
   if(!await appConfirm({title:`Delete match #${no}?`,message:"This match will be permanently removed. Challenge progress and analytics will recalculate immediately.",confirmText:"Delete match",kicker:"DELETE MATCH"}))return;
   data.matches=data.matches.filter(m=>m.no!==no);
   // Match IDs are stable user-facing identifiers; deleting one must not renumber the rest.
   data.matches.sort((a,b)=>Number(a.no)-Number(b.no));
   if(!persist()){ data.matches.push(match); data.matches.sort((a,b)=>Number(a.no)-Number(b.no)); return; }
   render();showPage("matches");return;
 }
});
document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",async function(e){e.preventDefault();closeModal()}));
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("noticeModal")&&!$("noticeModal").classList.contains("hidden")){closeAppNotice();return}if(!$("confirmModal").classList.contains("hidden")){finishConfirmation(false);return}if(!$("modal").classList.contains("hidden"))closeModal()});
