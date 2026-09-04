// Match modal validation surface and live field feedback.
function showValidationErrors(errors){const box=$("matchValidation");if(!box)return;box.innerHTML=`<strong>Check this match before saving</strong><ul>${errors.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;box.classList.remove("hidden");box.scrollIntoView({behavior:"smooth",block:"nearest"})}
function clearValidationErrors(){const box=$("matchValidation");if(box){box.classList.add("hidden");box.innerHTML=""}}

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
