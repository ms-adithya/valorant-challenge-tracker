// Challenge settings modal (reset / archive / delete) and archive restore.
function openChallengeOptions(){if(data)$("challengeModal").classList.remove("hidden")}
function closeChallengeOptions(){$("challengeModal").classList.add("hidden")}
if($("challengeSettingsBtn"))$("challengeSettingsBtn").onclick=openChallengeOptions;
document.querySelectorAll("[data-challenge-close]").forEach(x=>x.onclick=closeChallengeOptions);
if($("resetChallengeBtn"))$("resetChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:"Reset this challenge?",message:"All matches in the active challenge will be removed and its progress will return to the starting rank and RR.",confirmText:"Reset challenge",kicker:"RESET CHALLENGE"}))return;
 if(data){data.matches=[];persist()}closeChallengeOptions();render();
};
if($("deleteActiveChallengeBtn"))$("deleteActiveChallengeBtn").onclick=()=>deleteActiveChallenge();
if($("archiveChallengeBtn"))$("archiveChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:`Archive "${data.name}"?`,message:"The challenge will move to your archive and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 archives.unshift({...data,archivedAt:new Date().toISOString()});data=null;persist();closeChallengeOptions();render();
};
if($("viewArchivedBtn"))$("viewArchivedBtn").onclick=openArchiveBrowser;
document.querySelectorAll("[data-archive-browser-close]").forEach(x=>x.onclick=closeArchiveBrowser);
document.addEventListener("click",async e=>{
 const btn=e.target.closest("[data-restore-archive]");if(!btn)return;
 const idx=Number(btn.dataset.restoreArchive),restored=archives[idx];if(!restored)return;
 archives.splice(idx,1);
 const {archivedAt,...activeChallenge}=restored;ensureChallengeId(activeChallenge);
 activeChallenges.push(activeChallenge);data=activeChallenge;
 persist();closeArchiveBrowser();render();showPage("overview");
});
