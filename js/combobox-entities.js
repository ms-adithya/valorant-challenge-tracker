// Agent and map comboboxes (searchable agent list, grouped map list).
function initAgentCombobox(){
 const combo=$("agentCombobox"),field=$("agent"),drop=$("agentDropdown"),search=$("agentSearch"),options=$("agentOptions");
 if(!combo||!field||!drop||!search||!options)return;
 const sorted=agents.slice().sort((a,b)=>a.localeCompare(b));
 let active=-1;
 const visible=()=>[...options.querySelectorAll(".agent-option")];
 function render(q=""){
  const needle=q.trim().toLowerCase();
  const list=sorted.filter(a=>a.toLowerCase().includes(needle));
  active=-1;
  options.innerHTML=list.length?list.map(a=>`<button type="button" class="agent-option${field.value===a?" selected":""}" role="option" aria-selected="${field.value===a}" data-agent="${a}">${a}</button>`).join(""):'<div class="agent-no-results">No agents found</div>';
 }
 function open(){drop.classList.remove("hidden");field.setAttribute("aria-expanded","true");search.value="";render();requestAnimationFrame(()=>search.focus());}
 function close(){drop.classList.add("hidden");field.setAttribute("aria-expanded","false");active=-1;}
 function choose(name){field.value=name;field.dispatchEvent(new Event("change",{bubbles:true}));close();field.focus();}
 function move(delta){const list=visible();if(!list.length)return;active=(active+delta+list.length)%list.length;list.forEach((x,i)=>x.classList.toggle("active",i===active));list[active].scrollIntoView({block:"nearest"});}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){e.preventDefault();open();}});
 search.addEventListener("input",()=>render(search.value));
 search.addEventListener("keydown",e=>{if(e.key==="ArrowDown"){e.preventDefault();move(1)}else if(e.key==="ArrowUp"){e.preventDefault();move(-1)}else if(e.key==="Enter"){e.preventDefault();const list=visible();if(list.length)choose((list[active>=0?active:0]).dataset.agent)}else if(e.key==="Escape"){e.preventDefault();close();field.focus();}});
 options.addEventListener("click",e=>{const b=e.target.closest(".agent-option");if(b)choose(b.dataset.agent)});
 document.addEventListener("pointerdown",e=>{if(!combo.contains(e.target))close()});
 render();
}
initAgentCombobox();

function initMapCombobox(){
 const combo=$("mapCombobox"),field=$("map"),drop=$("mapDropdown"),options=$("mapOptions");
 if(!combo||!field||!drop||!options)return;
 let active=-1;
 const group=(title,items)=>`<div class="map-group"><div class="map-group-title" role="option" aria-disabled="true">${title}</div>${items.map(map=>`<button type="button" class="map-option${field.value===map?" selected":""}" role="option" aria-selected="${field.value===map}" data-map="${map}">${map}</button>`).join("")}</div>`;
 const render=()=>{options.innerHTML=group("Current competitive pool",competitiveMaps)+group("Out of competitive rotation",nonCompetitiveMaps)};
 const visible=()=>[...options.querySelectorAll(".map-option")];
 function open(){render();drop.classList.remove("hidden");field.setAttribute("aria-expanded","true");active=-1;}
 function close(){drop.classList.add("hidden");field.setAttribute("aria-expanded","false");active=-1;}
 function choose(name){field.value=name;field.dispatchEvent(new Event("change",{bubbles:true}));render();close();field.focus();}
 function move(delta){const list=visible();if(!list.length)return;active=(active+delta+list.length)%list.length;list.forEach((x,i)=>x.classList.toggle("active",i===active));list[active].scrollIntoView({block:"nearest"});}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){e.preventDefault();if(drop.classList.contains("hidden"))open();else move(1)}else if(e.key==="ArrowUp"&&!drop.classList.contains("hidden")){e.preventDefault();move(-1)}else if(e.key==="Escape"){close()}});
 options.addEventListener("click",e=>{const b=e.target.closest(".map-option");if(b)choose(b.dataset.map)});
 document.addEventListener("pointerdown",e=>{if(!combo.contains(e.target))close()});
 render();
}
initMapCombobox();
