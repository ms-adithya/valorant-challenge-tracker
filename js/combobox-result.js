// Result combobox and the plain rank <select> options used by the setup form.
function initResultCombobox(){
 const values=["Win","Loss","Draw"],combo=$("resultCombobox"),field=$("result"),drop=$("resultDropdown"),options=$("resultOptions");
 if(!combo||!field||!drop||!options)return;
 let active=-1;
 const visible=()=>[...options.querySelectorAll(".rank-option")];
 function render(){
  options.innerHTML=values.map(v=>`<button type="button" class="rank-option${field.value===v?" selected":""}" role="option" aria-selected="${field.value===v}" data-result="${v}">${v}</button>`).join("");
 }
 function open(){render();drop.classList.remove("hidden");field.setAttribute("aria-expanded","true");active=-1}
 function close(){drop.classList.add("hidden");field.setAttribute("aria-expanded","false");active=-1}
 function choose(v){field.value=v;field.dispatchEvent(new Event("change",{bubbles:true}));render();close();field.focus()}
 function highlight(i){const list=visible();if(!list.length)return;active=i;list.forEach((x,n)=>x.classList.toggle("active",n===active));list[active].scrollIntoView({block:"nearest"})}
 function move(d){const list=visible();if(!list.length)return;highlight((active+d+list.length)%list.length)}
 // Commit the highlighted option, defaulting to the first one when the list
 // was opened but never arrowed through.
 function chooseActive(){const list=visible();if(!list.length)return;choose(list[active>=0?active:0].dataset.result)}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{
  const isOpen=!drop.classList.contains("hidden");
  if(e.key==="Enter"||e.key===" "){e.preventDefault();isOpen?chooseActive():open()}
  else if(e.key==="ArrowDown"){e.preventDefault();isOpen?move(1):open()}
  else if(e.key==="ArrowUp"&&isOpen){e.preventDefault();move(-1)}
  else if(e.key==="Home"&&isOpen){e.preventDefault();highlight(0)}
  else if(e.key==="End"&&isOpen){e.preventDefault();highlight(visible().length-1)}
  else if(e.key==="Escape"&&isOpen){e.stopPropagation();close()}
 });
 options.addEventListener("click",e=>{const b=e.target.closest(".rank-option");if(b)choose(b.dataset.result)});
 document.addEventListener("pointerdown",e=>{if(!combo.contains(e.target))close()});
 render();
}

initResultCombobox();
function ensureRankOptions(id,label){
 const el=$(id); if(!el || el.options.length>1) return;
 el.innerHTML=`<option value="" disabled selected>${label}</option>`+ranks.map(r=>`<option value="${r}">${r}</option>`).join("");
}
ensureRankOptions("startRank","Choose rank");
ensureRankOptions("targetRank","Choose target");
