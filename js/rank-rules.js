// Setup-form rank field rules and match-level rank transition validation.
function syncStartingRRState(){
 const rank=$("startRank"),rr=$("startRR");if(!rank||!rr)return;
 const unranked=isUnranked(rank.value);
 rr.disabled=unranked;rr.required=!unranked;
 rr.placeholder=unranked?"Not applicable":"0–100";
 if(unranked)rr.value="";
}
function updateTargetRankOptions(){
 const current=$("startRank"),target=$("targetRank");
 if(!current||!target)return;
 const currentIndex=rankIndex(current.value);
 Array.from(target.options).forEach(option=>{
   if(option.value===""){
     option.disabled=false;
     option.hidden=false;
     return;
   }
   const optionIndex=rankIndex(option.value);
   option.disabled=currentIndex>=0 && optionIndex<=currentIndex;
 });
 // If the previous target is now invalid, switch cleanly to No target.
 if(target.value && rankIndex(target.value)<=currentIndex)target.value="";
}

const defaultRanksList=["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"];
function getRankIdx(r){return typeof rankIndex==="function"?rankIndex(r):defaultRanksList.indexOf(r)}
function getIsUnranked(r){return typeof isUnranked==="function"?isUnranked(r):(r==="Unranked")}

function validateRankTransition(prevRank,nextRank,status){
 const a=getRankIdx(prevRank),b=getRankIdx(nextRank);
 if(a<0||b<0)return "Select a recognised rank.";
 if(getIsUnranked(prevRank)){
  if(getIsUnranked(nextRank) && status!=="Same Rank")return "Placement is still unresolved, so rank status must remain Same Rank.";
  if(!getIsUnranked(nextRank) && status!=="Placed")return "The first ranked result after Unranked must use Placed, not promotion or demotion.";
  return "";
 }
 if(getIsUnranked(nextRank))return "A placed player cannot return to Unranked within the same challenge.";
 if(status==="Placed")return "Placed is only valid when the previous rank is Unranked.";
 if(status==="Same Rank" && a!==b)return "Rank status is Same Rank, but the selected rank changed.";
 if(status==="Promoted" && b<=a)return "Promoted requires the ending rank to be higher than the previous rank.";
 if(status==="Demoted" && b>=a)return "Demoted requires the ending rank to be lower than the previous rank.";
 return "";
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={validateRankTransition};
}
