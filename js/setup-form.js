// New-challenge setup form: rank option wiring and submit handling.
if($("startRank"))$("startRank").addEventListener("change",()=>{updateTargetRankOptions();syncStartingRRState();});
updateTargetRankOptions();syncStartingRRState();
if($("challengeForm"))$("challengeForm").addEventListener("submit",e=>{
 e.preventDefault();e.stopPropagation();
 const selectedStart=$("startRank").value;
 const selectedTarget=$("targetRank").value;
 if(selectedTarget && rankIndex(selectedTarget)<=rankIndex(selectedStart)){
   showAppNotice("Target rank must be higher than the current / starting rank, or choose No target.","Check challenge");
   updateTargetRankOptions();
   return;
 }
 const name=$("challengeName").value.trim();
 const target=Number($("targetMatches").value);
 const startRank=$("startRank").value;
 const targetRank=$("targetRank").value;
 const rrRaw=$("startRR").value;
 if(!name){showAppNotice("Enter a challenge name.","Challenge details");return;}
 if(!target || target<1){showAppNotice("Enter the number of matches to track.","Challenge details");return;}
 if(!startRank){showAppNotice("Select your current / starting rank.","Challenge details");return;}
 
 let rr=null;
 if(!isUnranked(startRank)){
  if(rrRaw===""){showAppNotice("Enter your starting RR.","Challenge details");return;}
  rr=Number(rrRaw);
  if(!Number.isFinite(rr)||rr<0||rr>100){showAppNotice("Starting RR must be between 0 and 100.","Challenge details");return;}
 }

 const nextChallenge=ensureChallengeId({name,target,startRank,startRR:rr,targetRank:targetRank||null,description:$("description").value.trim(),matches:[]});
 const previous=data;
 activeChallenges.push(nextChallenge);
 data=nextChallenge;
 try{
   persist();
 }catch(err){
   activeChallenges=activeChallenges.filter(c=>c.id!==nextChallenge.id);
   data=previous;
   console.error("Storage write failed:",err);
   const reason=err && err.name==="QuotaExceededError"
     ?"Browser storage is full. Export/delete older local data and try again."
     :"Browser storage is unavailable. Make sure this page is not running in a restricted/private file context.";
   showAppNotice(`Could not save the challenge. ${reason}`,"Challenge not saved");
   return;
 }
 render();
 showPage("overview");
 showToast("Challenge created.");
});
