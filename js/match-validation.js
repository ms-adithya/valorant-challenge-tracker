// Match modal validation surface and live field feedback.
function showValidationErrors(errors){const box=typeof $ === "function"?$("matchValidation"):null;if(!box)return;box.innerHTML=`<strong>Check this match before saving</strong><ul>${errors.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;box.classList.remove("hidden");box.scrollIntoView({behavior:"smooth",block:"nearest"})}
function clearValidationErrors(){const box=typeof $ === "function"?$("matchValidation"):null;if(box){box.classList.add("hidden");box.innerHTML=""}}

function validateScoreArithmetic(my,enemy,result,rounds){
 const errors=[];
 if(!Number.isFinite(my)||!Number.isFinite(enemy))return["Both score values are required numbers."];
 if(my<0||enemy<0)errors.push("Score values cannot be negative.");
 if(!Number.isInteger(my)||!Number.isInteger(enemy))errors.push("Score values must be whole numbers.");
 if(my===0&&enemy===0)errors.push("A completed match cannot have a 0–0 score.");
 if(result==="Win"&&my<=enemy)errors.push("For a Win, your score must be higher than enemy score.");
 if(result==="Loss"&&my>=enemy)errors.push("For a Loss, your score must be lower than enemy score.");
 if(result==="Draw"&&my!==enemy)errors.push("For a Draw, both scores must be equal.");
 if(Number.isFinite(rounds)&&rounds!==(my+enemy))errors.push("Rounds played must match the score total.");
 return errors;
}

if(typeof $ === "function"){
 if($("matchNo"))$("matchNo").addEventListener("input",()=>{
  const field=$("matchNo"),n=Number(field.value),edit=Number($("editNo")?.value||0);
  if(Number.isInteger(n)&&n>0){
   if($("matchNumberBadge"))$("matchNumberBadge").textContent=`MATCH #${n}`;
   if(!$("editNo")?.value && $("matchTitle"))$("matchTitle").textContent=`Add match #${n}`;
   const duplicate=matchNumberExists(n,edit||null);
   field.toggleAttribute("aria-invalid",duplicate);
   if(duplicate)showValidationErrors([`Match #${n} already exists. Choose an unused match number.`]);
   else if($("matchValidation")?.textContent?.includes("already exists"))clearValidationErrors();
  }
 });

 ["myScore","enemyScore"].forEach(id=>{
  const el=$(id);
  if(el)el.addEventListener("input",()=>syncRoundsFromScore(false));
 });
 if($("rounds")){
  $("rounds").addEventListener("input",()=>{roundsManuallyEdited=true});
 }
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={showValidationErrors,clearValidationErrors,validateScoreArithmetic};
}
