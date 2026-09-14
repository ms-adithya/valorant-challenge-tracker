// Challenge settings modal (reset / archive / delete) and archive restore.
function openChallengeOptions(){if(data)$("challengeModal").classList.remove("hidden")}
function closeChallengeOptions(){$("challengeModal").classList.add("hidden")}
if($("challengeSettingsBtn"))$("challengeSettingsBtn").onclick=openChallengeOptions;
document.querySelectorAll("[data-challenge-close]").forEach(x=>x.onclick=closeChallengeOptions);
if($("resetChallengeBtn"))$("resetChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:"Reset this challenge?",message:"All matches in the active challenge will be removed and its progress will return to the starting rank and RR.",confirmText:"Reset challenge",kicker:"RESET CHALLENGE"}))return;
 const before=Array.isArray(data.matches)?data.matches.slice():[];
 if(data){
  data.matches=[];
  if(!persist()){
   data.matches=before;
   return;
  }
 }
 closeChallengeOptions();render();
};
if($("deleteActiveChallengeBtn"))$("deleteActiveChallengeBtn").onclick=()=>deleteActiveChallenge();
if($("archiveChallengeBtn"))$("archiveChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:`Archive "${data.name}"?`,message:"The challenge will move to your archive and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 const currentId=data.id;
 const prevActive=activeChallenges.slice(),prevArchives=archives.slice(),prevData=data;
 activeChallenges=activeChallenges.filter(c=>c.id!==currentId);
 archives.unshift({...data,archivedAt:new Date().toISOString()});
 data=activeChallenges[0]||null;
 if(!persist()){
  activeChallenges=prevActive;
  archives=prevArchives;
  data=prevData;
  return;
 }
 closeChallengeOptions();render();
};
if($("viewArchivedBtn"))$("viewArchivedBtn").onclick=openArchiveBrowser;
document.querySelectorAll("[data-archive-browser-close]").forEach(x=>x.onclick=closeArchiveBrowser);
document.addEventListener("click",async e=>{
 const trigger=e.target.closest("[data-restore-archive]");if(!trigger)return;
 unarchiveChallenge(trigger.dataset.restoreArchive);
 closeArchiveBrowser();
});
