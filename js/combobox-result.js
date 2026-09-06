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
 function move(d){const list=visible();if(!list.length)return;active=(active+d+list.length)%list.length;list.forEach((x,i)=>x.classList.toggle("active",i===active));list[active].scrollIntoView({block:"nearest"})}
 field.addEventListener("click",()=>drop.classList.contains("hidden")?open():close());
 field.addEventListener("keydown",e=>{
  if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){e.preventDefault();if(drop.classList.contains("hidden"))open();else move(1)}
  else if(e.key==="ArrowUp"&&!drop.classList.contains("hidden")){e.preventDefault();move(-1)}
  else if(e.key==="Escape")close();
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
