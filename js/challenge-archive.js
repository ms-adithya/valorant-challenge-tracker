// Challenge history list on the Challenges page.
function challengeComplete(c){return challengeProgress(c).isComplete;}
function renderArchive(){
 const all=[...activeChallenges.map(c=>({...c,_active:true})),...archives.map(c=>({...c,_active:false}))];
 $("challengeArchive").innerHTML=all.length?all.map(c=>{
   const isActive=c._active;
   const archiveIndex=isActive?-1:archives.findIndex(x=>x.id===c.id);
   const selected=isActive&&data&&c.id===data.id,completed=challengeComplete(c);
   const status=completed?"COMPLETED":(isActive?(selected?"ACTIVE · OPEN":"ACTIVE"):"ARCHIVED");
   const safeId=escapeJsSingleQuoted(c.id);
   const safeStatus=escapeHtml(status);
   const safeName=escapeHtml(c.name);
   const safeProgress=escapeHtml(challengeProgressText(c,{history:true}));
   const safeStartRank=escapeHtml(c.startRank);
   const safeTargetRank=escapeHtml(c.targetRank||"No target");
   const exportBtn=completed?`<button class="ghost report-export-btn" type="button" onclick="downloadChallengeReportPDF('${safeId}')">Download report</button>`:"";
   return `<div class="challenge-item ${selected?"selected-challenge":""} ${completed?"completed-challenge":""}"><div><span class="status ${completed?"completed":(isActive?"":"archived")}">${safeStatus}</span><h3>${safeName}</h3><p>${safeProgress} · ${safeStartRank} → target ${safeTargetRank}</p></div><div class="actions">${exportBtn}${isActive
    ? `<button class="ghost" type="button" onclick="openActiveChallenge('${safeId}')">Open</button><button class="ghost" type="button" onclick="archiveActiveChallenge('${safeId}')">Archive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteActiveById('${safeId}')">Delete</button>`
    : `<button class="ghost" type="button" onclick="unarchiveChallenge(${archiveIndex})">Unarchive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteArchivedChallenge(${archiveIndex})">Delete</button>`}</div></div>`;
 }).join(""):'<div class="card empty">No challenges yet.</div>';
}
function findChallengeById(id){return activeChallenges.find(c=>c.id===id)||archives.find(c=>c.id===id)||null;}
