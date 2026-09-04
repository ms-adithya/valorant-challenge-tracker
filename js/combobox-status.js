// Rank-after and rank-status comboboxes.
function initRankAfterCombobox(){
 const combo=$("rankAfterCombobox"),field=$("rankAfter"),drop=$("rankAfterDropdown"),search=$("rankAfterSearch"),options=$("rankAfterOptions");
 if(!combo||!field||!drop||!search||!options)return;
 let active=-1;
 const visible=()=>[...options.querySelectorAll(".rank-option")];
 function render(q=""){
  const needle=q.trim().toLowerCase();
  const list=ranks.filter(r=>r.toLowerCase().includes(needle));
  active=-1;
  options.innerHTML=list.length?list.map(r=>`<button type="button" class="rank-option${field.value===r?" selected":""}" role="option" aria-selected="${field.value===r}" data-rank="${r}">${r}</button>`).join(""):'<div class="agent-no-results">No ranks found</div>';
 }
 function open(){drop.classList.remove("hidden");field.setAttribute("aria-expanded","true");search.value="";render();requestAnimationFrame(()=>search.focus())}
 function close(){drop.classList.add("hidden");field.setAttribute("aria-expanded","false");active=-1}
 function choose(v){field.value=v;field.dispatchEvent(new Event("change",{bubbles:true}));close();field.focus()}
 function move(d){const list=visible();if(!list.length)return;active=(active+d+list.length)%list.length;list.forEach((x,i)=>x.classList.toggle("active",i===active));list[active].scrollIntoView({block:"nearest"})}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){e.preventDefault();open()}else if(e.key==="Escape")close()});
 search.addEventListener("input",()=>render(search.value));
 search.addEventListener("keydown",e=>{if(e.key==="ArrowDown"){e.preventDefault();move(1)}else if(e.key==="ArrowUp"){e.preventDefault();move(-1)}else if(e.key==="Enter"){e.preventDefault();const list=visible();if(list.length)choose(list[active>=0?active:0].dataset.rank)}else if(e.key==="Escape"){e.preventDefault();close();field.focus()}});
 options.addEventListener("click",e=>{const b=e.target.closest(".rank-option");if(b)choose(b.dataset.rank)});
 document.addEventListener("pointerdown",e=>{if(!combo.contains(e.target))close()});render();
}
function initRankStatusCombobox(){
 const values=["Same Rank","Placed","Promoted","Demoted"],combo=$("rankStatusCombobox"),field=$("rankStatus"),drop=$("rankStatusDropdown"),options=$("rankStatusOptions");
 if(!combo||!field||!drop||!options)return;let active=-1;
 const visible=()=>[...options.querySelectorAll(".rank-option")];
 function render(){options.innerHTML=values.map(v=>`<button type="button" class="rank-option${field.value===v?" selected":""}" role="option" aria-selected="${field.value===v}" data-status="${v}">${v}</button>`).join("")}
 function open(){render();drop.classList.remove("hidden");field.setAttribute("aria-expanded","true");active=-1}
 function close(){drop.classList.add("hidden");field.setAttribute("aria-expanded","false");active=-1}
 function choose(v){field.value=v;field.dispatchEvent(new Event("change",{bubbles:true}));render();close();field.focus()}
 function move(d){const list=visible();if(!list.length)return;active=(active+d+list.length)%list.length;list.forEach((x,i)=>x.classList.toggle("active",i===active));list[active].scrollIntoView({block:"nearest"})}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){e.preventDefault();if(drop.classList.contains("hidden"))open();else move(1)}else if(e.key==="ArrowUp"&&!drop.classList.contains("hidden")){e.preventDefault();move(-1)}else if(e.key==="Escape")close()});
 options.addEventListener("click",e=>{const b=e.target.closest(".rank-option");if(b)choose(b.dataset.status)});
 document.addEventListener("pointerdown",e=>{if(!combo.contains(e.target))close()});render();
}
initRankAfterCombobox();
initRankStatusCombobox();
