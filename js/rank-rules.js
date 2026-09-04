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

function validateRankTransition(prevRank,nextRank,status){
 const a=rankIndex(prevRank),b=rankIndex(nextRank);
 if(a<0||b<0)return "Select a recognised rank.";
 if(isUnranked(prevRank)){
  if(isUnranked(nextRank) && status!=="Same Rank")return "Placement is still unresolved, so rank status must remain Same Rank.";
  if(!isUnranked(nextRank) && status!=="Placed")return "The first ranked result after Unranked must use Placed, not promotion or demotion.";
  return "";
 }
 if(isUnranked(nextRank))return "A placed player cannot return to Unranked within the same challenge.";
 if(status==="Placed")return "Placed is only valid when the previous rank is Unranked.";
 if(status==="Same Rank" && a!==b)return "Rank status is Same Rank, but the selected rank changed.";
 if(status==="Promoted" && b<=a)return "Promoted requires the ending rank to be higher than the previous rank.";
 if(status==="Demoted" && b>=a)return "Demoted requires the ending rank to be lower than the previous rank.";
 return "";
}
