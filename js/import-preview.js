// Match import: match-number assignment, revalidation and the review preview.
function nextUnusedMatchNo(used){let n=1;while(used.has(n))n++;return n}
function assignImportNumbers(objects){
 const used=new Set(data.matches.map(m=>Number(m.no)).filter(n=>Number.isInteger(n)&&n>0));
 return objects.map((raw,i)=>{
  const o=normaliseImportedObject(raw);
  const parsed=importNum(o.no);
  const requested=Number.isInteger(parsed)&&parsed>0?parsed:null;
  let assigned=requested;
  let reason="";
  if(!assigned||used.has(assigned)){
   assigned=nextUnusedMatchNo(used);
   reason=requested?`${requested} already exists`:(parsed===null?"no match number supplied":"invalid match number");
  }
  used.add(assigned);
  return {raw:o,requested,assigned,reason,row:i+1};
 });
}
function rebuildPendingImport(){
 const assignments=assignImportNumbers(pendingImportSource);
 const sorted=[...assignments].sort((a,b)=>a.assigned-b.assigned);
 let previous={rankAfter:data.startRank,rrAfter:data.startRR};
 const existing=[...data.matches].sort((a,b)=>a.no-b.no);
 const checkedByRow=new Map();
 for(const a of sorted){
  const priorExisting=existing.filter(m=>m.no<a.assigned).at(-1);
  if(priorExisting && (!previous.no || priorExisting.no>(previous.no||0)))previous=priorExisting;
  const checked=validateImportedMatch(a.raw,previous,a.assigned);
  checked.assignment=a;
  if(!checked.errors.length)previous=checked.match;
  checkedByRow.set(a.row,checked);
 }
 pendingMatchImport=assignments.map(a=>checkedByRow.get(a.row));
 renderImportPreview();
}
function renderImportPreview(){
 const valid=pendingMatchImport.filter(x=>!x.errors.length).length,invalid=pendingMatchImport.length-valid;
 const bulk=pendingMatchImport.length>1;
 const ordered=[...pendingMatchImport].sort((a,b)=>{
  const ae=a.errors.length?1:0,be=b.errors.length?1:0;
  return ae-be || (a.assignment?.row||0)-(b.assignment?.row||0);
 });
 const visible=ordered.filter(x=>importReviewFilter==="ready"?!x.errors.length:importReviewFilter==="attention"?x.errors.length:true);
 $("importMatchesSummary").innerHTML=`<div class="import-stat"><span>Rows</span><b>${pendingMatchImport.length}</b></div><div class="import-stat good"><span>Ready</span><b>${valid}</b></div><div class="import-stat bad"><span>Attention</span><b>${invalid}</b></div>${bulk?`<label class="import-ready-only"><input id="importReadyOnly" type="checkbox" checked> <span><b>Import ready rows only</b><small>Valid rows will be saved; invalid rows will be skipped.</small></span></label><div class="import-review-filters" role="group" aria-label="Filter import review"><button type="button" data-import-filter="all" class="${importReviewFilter==="all"?"active":""}">All <b>${pendingMatchImport.length}</b></button><button type="button" data-import-filter="ready" class="${importReviewFilter==="ready"?"active":""}">Ready <b>${valid}</b></button><button type="button" data-import-filter="attention" class="${importReviewFilter==="attention"?"active":""}">Needs attention <b>${invalid}</b></button></div>`:""}`;
 $("importMatchesPreview").innerHTML=visible.length?visible.map(x=>{
  const a=x.assignment||{};const sourceIndex=Math.max(0,(a.row||1)-1);const changed=a.requested!==a.assigned;
  const numberNote=changed?`<span class="import-meta reassign">#${a.requested??"?"} → #${a.assigned}<em>${a.reason}</em></span>`:`<span class="import-meta">Match #${a.assigned}<em>number preserved</em></span>`;
  const rankNote=x.rankStatusAdjusted?`<span class="import-meta">${x.rankStatusAdjusted}<em>rank status derived automatically</em></span>`:"";
  const rr=Number.isFinite(x.match.rrChange)?`${x.match.rrChange>=0?"+":""}${x.match.rrChange} RR`:"RR —";
  const score=`${Number.isFinite(x.match.myScore)?x.match.myScore:"?"}–${Number.isFinite(x.match.enemyScore)?x.match.enemyScore:"?"}`;
  return `<article class="import-row ${x.errors.length?"bad":"ok"}">
   <div class="import-row-index"><span>Row ${a.row||sourceIndex+1}</span><label class="import-number-field"><small>Match #</small><input class="import-no-edit" type="number" min="1" step="1" value="${a.assigned}" data-import-no="${sourceIndex}" aria-label="Match number for import row ${a.row||sourceIndex+1}"></label></div>
   <div class="import-row-main"><div class="import-row-title"><b>${x.match.agent||"Unknown agent"} <i>·</i> ${x.match.map||"Unknown map"}</b><span class="result-pill ${(x.match.result||"").toLowerCase()}">${x.match.result||"No result"}</span></div><div class="import-meta-line">${numberNote}${rankNote}</div><small class="import-match-line">${score} · ${x.match.rankAfter||"No rank"} · ${rr}</small>${x.errors.length?`<ul class="import-errors">${x.errors.map(e=>`<li>${e}</li>`).join("")}</ul>`:""}</div>
   <div class="import-status"><span>${x.errors.length?"Needs attention":"Ready"}</span></div></article>`;
 }).join(""):`<div class="import-help">No ${importReviewFilter==="ready"?"ready":importReviewFilter==="attention"?"problem":"match"} rows in this import.</div>`;
 $("confirmImportMatchesBtn").disabled=false;
 $("confirmImportMatchesBtn").dataset.mode=valid===0?"fix":"import";
 $("confirmImportMatchesBtn").textContent=valid===0?"Choose another file":`Import ${valid} ready match${valid===1?"":"es"}${invalid?` · skip ${invalid}`:""}`;
}


let pendingImportSource=[];
let importReviewFilter="all";
function buildImportPreview(objects){pendingImportSource=objects.map(o=>normaliseImportedObject(o));importReviewFilter="all";rebuildPendingImport();openImportMatchesModal()}
document.addEventListener("click",e=>{
 const filter=e.target.closest("[data-import-filter]");if(!filter)return;
 importReviewFilter=filter.dataset.importFilter||"all";renderImportPreview();
});
document.addEventListener("change",e=>{
 const input=e.target.closest("[data-import-no]");if(!input)return;
 const i=Number(input.dataset.importNo),v=Number(input.value);
 if(!Number.isInteger(v)||v<1){showAppNotice("Match number must be a positive whole number.","Invalid match number");renderImportPreview();return}
 // User edits are authoritative when free; collisions are moved to the next available slot.
 pendingImportSource[i].no=String(v);rebuildPendingImport();
});
