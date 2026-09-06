// Match form submit: full validation, persistence and rollback.
if($("matchForm"))$("matchForm").onsubmit=e=>{
 e.preventDefault();clearValidationErrors();
 const saveBtn=$("saveMatchBtn");
 const originalText=saveBtn?.textContent||"Save match";
 const finish=()=>{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=originalText;saveBtn.removeAttribute("aria-busy")}};
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Checking…";saveBtn.setAttribute("aria-busy","true")}
 try{
  const value=id=>String($(id)?.value??"").trim();
  const number=id=>Number(value(id));
  const nullable=id=>{const raw=value(id);if(raw==="")return null;const v=Number(raw);return Number.isFinite(v)?v:null};
  const edit=Number(value("editNo")||0),requestedNo=Number(value("matchNo"));
  const errors=[];
  if(!Number.isInteger(requestedNo)||requestedNo<1)errors.push("Match number must be a positive whole number.");
  // Only actual records in the currently open challenge reserve a Match #.
  // Challenge progress, archived challenges, deleted IDs and missing numeric gaps do not.
  const duplicateMatch=matchNumberExists(requestedNo,edit||null);
  if(duplicateMatch){
   const duplicateMessage=`Match #${requestedNo} already exists. Choose an unused match number.`;
   // Use both the modal's own validation surface and the normal app toast.
   // The inline message guarantees the feedback remains visible inside the open Add/Edit Match modal.
   showValidationErrors([duplicateMessage]);
   showToast(duplicateMessage,"error");
   const matchNoField=$("matchNo");
   if(matchNoField){
    matchNoField.setAttribute("aria-invalid","true");
    matchNoField.focus({preventScroll:true});
    matchNoField.select?.();
    const clearDuplicateState=()=>{
     matchNoField.removeAttribute("aria-invalid");
     clearValidationErrors();
     matchNoField.removeEventListener("input",clearDuplicateState);
    };
    matchNoField.addEventListener("input",clearDuplicateState);
   }
   return;
  }
  const earlier=countedMatches().filter(x=>Number(x.no)<requestedNo && Number(x.no)!==edit).sort((a,b)=>Number(a.no)-Number(b.no));
  const previous=earlier.at(-1)||{rankAfter:data.startRank,rrAfter:data.startRR};
  if(!value("agent"))errors.push("Select the agent played.");
  if(!value("map"))errors.push("Select the map played.");
  if(!value("rankAfter"))errors.push("Select the rank after the match.");
  if(value("rankAfter")){
   const rankErr=validateRankTransition(previous.rankAfter,value("rankAfter"),value("rankStatus"));
   if(rankErr)errors.push(rankErr);
  }
  const my=number("myScore"),enemy=number("enemyScore"),result=value("result"),rounds=number("rounds");
  if(!Number.isFinite(my)||!Number.isFinite(enemy))errors.push("Both score values are required numbers.");
  else{
   if(my===0&&enemy===0)errors.push("A completed match cannot have a 0–0 score.");
   if(result==="Win"&&my<=enemy)errors.push("For a Win, your score must be higher than the enemy score.");
   if(result==="Loss"&&my>=enemy)errors.push("For a Loss, your score must be lower than the enemy score.");
   if(result==="Draw"&&my!==enemy)errors.push("For a Draw, both scores must be equal.");
   const expectedRounds=my+enemy;
   if(!Number.isFinite(rounds)||rounds!==expectedRounds)errors.push(`Rounds played must match the score: ${my}–${enemy} equals ${expectedRounds} rounds.`);
  }
  [["HS %","hs"],["KAST %","kast"]].forEach(([label,id])=>{const v=nullable(id);if(v!==null&&(v<0||v>100))errors.push(`${label} must be between 0 and 100.`)});
  [["Kills","kills"],["Deaths","deaths"],["Assists","assists"],["ACS","acs"],["ADR","adr"],["First kills","firstKills"],["First deaths","firstDeaths"],["Multi kills","multiKills"]].forEach(([label,id])=>{const v=nullable(id);if(v!==null&&v<0)errors.push(`${label} cannot be negative.`)});
  let rrAfter=nullable("rrAfter"),rrChange=nullable("rrChange");
  if(isUnranked(value("rankAfter"))){rrAfter=null;rrChange=null;}
  if(rrAfter!==null&&(rrAfter<0||rrAfter>100))errors.push("RR after match must be between 0 and 100.");
  if(rrChange!==null&&value("rankStatus")==="Promoted"&&rrChange<=0)errors.push("Promoted requires a positive RR change when RR change is entered.");
  if(rrChange!==null&&value("rankStatus")==="Demoted"&&rrChange>=0)errors.push("Demoted requires a negative RR change when RR change is entered.");
  if(errors.length){showValidationErrors(errors);return;}

  const m={
   no:requestedNo,date:edit?(data.matches.find(x=>Number(x.no)===edit)?.date||new Date().toISOString()):new Date().toISOString(),
   agent:value("agent"),map:value("map"),result,rankAfter:value("rankAfter"),rankStatus:value("rankStatus"),
   rrAfter,rrChange,myScore:my,enemyScore:enemy,
   kills:nullable("kills"),deaths:nullable("deaths"),assists:nullable("assists"),ddDelta:nullable("ddDelta"),hs:nullable("hs"),acs:nullable("acs"),adr:nullable("adr"),kast:nullable("kast"),
   firstKills:nullable("firstKills"),firstDeaths:nullable("firstDeaths"),multiKills:nullable("multiKills"),rounds,notes:value("notes")
  };
  const beforeMatches=data.matches.slice();
  if(edit){const idx=data.matches.findIndex(x=>Number(x.no)===edit);if(idx<0){showValidationErrors(["That match could not be found."]);return}data.matches[idx]=m}else data.matches.push(m);
  data.matches.sort((a,b)=>Number(a.no)-Number(b.no));
  if(!persist()){data.matches=beforeMatches;throw new Error("Browser storage rejected the save.")}
  try{render();showPage("matches")}catch(err){console.error("Match saved; UI refresh failed:",err)}
  closeModal();showToast(edit?"Match changes saved.":`Match #${requestedNo} saved.`);
 }catch(err){
  console.error("Match save failed:",err);
  showValidationErrors([err?.message||"An unexpected error stopped the match from saving. Please try again."]);
 }finally{finish()}
};
