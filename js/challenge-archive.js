// Challenge history list on the Challenges page.
function challengeComplete(c){return challengeProgress(c).isComplete;}
function bindArchiveActionHandlers(){
  if(typeof document==="undefined")return;
  document.addEventListener("click",(event)=>{
    const target=event.target&&event.target.closest?event.target.closest("[data-archive-action]"):null;
    if(!target)return;
    const action=target.dataset.archiveAction;
    const id=target.dataset.archiveId;
    if(!action||!id)return;
    if(action==="download-report"&&typeof window!=="undefined"&&typeof window.downloadChallengeReportPDF==="function"){
      window.downloadChallengeReportPDF(id);
      return;
    }
    if(action==="open-active"&&typeof openActiveChallenge==="function"){openActiveChallenge(id);return;}
    if(action==="archive-active"&&typeof archiveActiveChallenge==="function"){archiveActiveChallenge(id);return;}
    if(action==="delete-active"&&typeof deleteActiveById==="function"){deleteActiveById(id);return;}
    if(action==="unarchive"&&typeof unarchiveChallenge==="function"){unarchiveChallenge(id);return;}
    if(action==="delete-archived"&&typeof deleteArchivedChallenge==="function"){deleteArchivedChallenge(id);return;}
  });
}
if(typeof document!=="undefined")bindArchiveActionHandlers();
function renderArchive(){
 const all=[...activeChallenges.map(c=>({...c,_active:true})),...archives.map(c=>({...c,_active:false}))];
 const el=$("challengeArchive");
 if(!el)return;
 el.innerHTML=all.length?all.map(c=>{
   const isActive=c._active;
   const selected=isActive&&data&&c.id===data.id,completed=challengeComplete(c);
   const status=completed?"COMPLETED":(isActive?(selected?"ACTIVE · OPEN":"ACTIVE"):"ARCHIVED");
   const safeId=escapeHtml(String(c.id||""));
   const safeStatus=escapeHtml(status);
   const safeName=escapeHtml(String(c.name||"Untitled challenge"));
   const safeProgress=escapeHtml(challengeProgressText(c,{history:true}));
   const safeStartRank=escapeHtml(String(c.startRank||""));
   const safeTargetRank=escapeHtml(String(c.targetRank||"No target"));
   const exportBtn=completed?`<button class="ghost report-export-btn" type="button" data-archive-action="download-report" data-archive-id="${safeId}">Download report</button>`:"";
   return `<div class="challenge-item ${selected?"selected-challenge":""} ${completed?"completed-challenge":""}"><div><span class="status ${completed?"completed":(isActive?"":"archived")}">${safeStatus}</span><h3>${safeName}</h3><p>${safeProgress} · ${safeStartRank} → target ${safeTargetRank}</p></div><div class="actions">${exportBtn}${isActive
     ? `<button class="ghost" type="button" data-archive-action="open-active" data-archive-id="${safeId}">Open</button><button class="ghost" type="button" data-archive-action="archive-active" data-archive-id="${safeId}">Archive</button><button class="ghost delete-archive-btn" type="button" data-archive-action="delete-active" data-archive-id="${safeId}">Delete</button>`
     : `<button class="ghost" type="button" data-archive-action="unarchive" data-archive-id="${safeId}">Unarchive</button><button class="ghost delete-archive-btn" type="button" data-archive-action="delete-archived" data-archive-id="${safeId}">Delete</button>`}</div></div>`;
 }).join(""):'<div class="card empty">No challenges yet.</div>';
}
function findChallengeById(id){return activeChallenges.find(c=>c.id===id)||archives.find(c=>c.id===id)||null;}

if(typeof module!=="undefined"&&module.exports){
 module.exports={challengeComplete,renderArchive,findChallengeById,bindArchiveActionHandlers};
}
