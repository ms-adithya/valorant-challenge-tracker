// DOM lookup shorthand, HTML/JS escaping helpers and generic <select> population.
const $=x=>typeof document!=="undefined"?document.getElementById(x):null;
/**
 * Escape a value so it can be safely inserted into HTML text or attributes.
 * @param {*} value - Raw value to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
/**
 * Populate a select element with the provided option list.
 * @param {string} id - Element identifier to fill.
 * @param {Array<string>} items - Options to render.
 * @param {string} [placeholder="Select an option"] - Placeholder label.
 */
function fill(id,items,placeholder="Select an option"){
 const el=$(id); if(!el) return;
 el.innerHTML=`<option value="" disabled selected>${placeholder}</option>`+items.map(item=>`<option value="${item}">${item}</option>`).join("");
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={$,escapeHtml,fill};
}
