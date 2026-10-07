// DOM lookup shorthand, HTML/JS escaping helpers and generic <select> population.
const $=x=>typeof document!=="undefined"?document.getElementById(x):null;
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function fill(id,items,placeholder="Select an option"){
 const el=$(id); if(!el) return;
 el.innerHTML=`<option value="" disabled selected>${placeholder}</option>`+items.map(item=>`<option value="${item}">${item}</option>`).join("");
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={$,escapeHtml,fill};
}
