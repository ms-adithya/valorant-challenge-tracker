// DOM lookup shorthand, HTML/JS escaping helpers and generic <select> population.
const $=x=>document.getElementById(x);
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function escapeJsSingleQuoted(value){
 return String(value??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\r/g,"\\r").replace(/\n/g,"\\n").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
}
function fill(id,items,placeholder="Select an option"){
 const el=$(id); if(!el) return;
 el.innerHTML=`<option value="" disabled selected>${placeholder}</option>`+items.map(item=>`<option value="${item}">${item}</option>`).join("");
}
