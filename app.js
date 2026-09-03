const ranks=["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"];
const agents=["Astra","Breach","Brimstone","Chamber","Clove","Cypher","Deadlock","Fade","Gekko","Harbor","Iso","Jett","KAY/O","Killjoy","Miks","Neon","Omen","Phoenix","Raze","Reyna","Sage","Skye","Sova","Tejo","Viper","Vyse","Waylay","Yoru"];
const competitiveMaps=["Abyss","Ascent","Haven","Lotus","Split","Summit","Sunset"];
const nonCompetitiveMaps=["Bind","Breeze","Corrode","Fracture","Icebox","Pearl"];
const maps=[...competitiveMaps,...nonCompetitiveMaps];
const agentRoles={"Brimstone":"Controller","Viper":"Controller","Omen":"Controller","Astra":"Controller","Harbor":"Controller","Clove":"Controller","Miks":"Controller","Sage":"Sentinel","Cypher":"Sentinel","Killjoy":"Sentinel","Chamber":"Sentinel","Deadlock":"Sentinel","Vyse":"Sentinel","Sova":"Initiator","Breach":"Initiator","Skye":"Initiator","KAY/O":"Initiator","Fade":"Initiator","Gekko":"Initiator","Tejo":"Initiator","Phoenix":"Duelist","Jett":"Duelist","Reyna":"Duelist","Raze":"Duelist","Yoru":"Duelist","Neon":"Duelist","Iso":"Duelist","Waylay":"Duelist"};
const $=x=>document.getElementById(x);
function escapeHtml(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function fill(id,items,placeholder="Select an option"){
 const el=$(id); if(!el) return;
 el.innerHTML=`<option value="" disabled selected>${placeholder}</option>`+items.map(item=>`<option value="${item}">${item}</option>`).join("");
}
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

function safeRead(key,fallback){
 try{
   const raw=localStorage.getItem(key);
   return raw===null?fallback:JSON.parse(raw);
 }catch(err){
   console.warn(`Could not read ${key}`,err);
   return fallback;
 }
}
let data=safeRead("vct4",null);
let activeChallenges=safeRead("vctActiveChallenges",[]);
let archives=safeRead("vctArchives",[]);
if(!Array.isArray(activeChallenges))activeChallenges=[];
if(!Array.isArray(archives))archives=[];
if(!data){
 const legacy=safeRead("vct2",null);
 if(legacy && typeof legacy==="object")data=legacy;
}
function ensureChallengeId(c){
 if(!c)return c;
 if(!c.id)c.id=`ch_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
 syncChallengeCompletion(c);
 return c;
}
function challengeProgress(c){
 const target=Math.max(0,Number(c?.target)||0);
 const recorded=Array.isArray(c?.matches)?c.matches.length:0;
 const completed=target?Math.min(recorded,target):0;
 return {target,recorded,completed,additional:target?Math.max(0,recorded-target):0,isComplete:target>0&&recorded>=target};
}
function completionBoundaryMatch(c){
 const p=challengeProgress(c);
 if(!p.isComplete)return null;
 const ordered=(c.matches||[]).slice().sort((a,b)=>Number(a.no)-Number(b.no));
 return ordered[p.target-1]||null;
}
function syncChallengeCompletion(c){
 if(!c||!Array.isArray(c.matches))return c;
 const p=challengeProgress(c);
 if(!p.isComplete){
  delete c.completedAtMatchId;
  delete c.completedAt;
  return c;
 }
 const ids=new Set(c.matches.map(m=>Number(m.no)));
 if(c.completedAtMatchId==null||!ids.has(Number(c.completedAtMatchId))){
  const boundary=completionBoundaryMatch(c);
  if(boundary){
   c.completedAtMatchId=Number(boundary.no);
   c.completedAt=boundary.date||c.completedAt||new Date().toISOString();
  }
 }
 return c;
}
function challengeProgressText(c,{history=false}={}){
 const p=challengeProgress(c);
 if(p.isComplete){
  if(history)return `Completed · ${p.completed}/${p.target} · ${p.recorded} recorded match${p.recorded===1?"":"es"}`;
  return `${p.completed} / ${p.target} completed${p.additional?` · ${p.additional} additional match${p.additional===1?"":"es"}`:""}`;
 }
 return `${p.recorded} / ${p.target} matches`;
}
// Migrate the old single-active model without losing the current challenge.
if(data){
 ensureChallengeId(data);
 if(!activeChallenges.some(c=>c.id===data.id))activeChallenges.unshift(data);
}
activeChallenges.forEach(ensureChallengeId);
archives.forEach(ensureChallengeId);
if(!data && activeChallenges.length)data=activeChallenges[0];
function syncCurrentChallenge(){
 if(!data)return;
 ensureChallengeId(data);
 syncChallengeCompletion(data);
 const i=activeChallenges.findIndex(c=>c.id===data.id);
 if(i>=0)activeChallenges[i]=data; else activeChallenges.unshift(data);
}
function persist(){
 syncCurrentChallenge();
 activeChallenges.forEach(syncChallengeCompletion);
 archives.forEach(syncChallengeCompletion);
 [data,...activeChallenges,...archives].filter(Boolean).forEach(rebuildChallengeRankProgression);
 const keys=["vct4","vctActiveChallenges","vctArchives"];
 const previous=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
 try{
  localStorage.setItem("vct4",JSON.stringify(data));
  localStorage.setItem("vctActiveChallenges",JSON.stringify(activeChallenges));
  localStorage.setItem("vctArchives",JSON.stringify(archives));
  return true;
 }catch(err){
  // Avoid leaving the three storage records at different revisions after a partial write.
  for(const k of keys){try{previous[k]===null?localStorage.removeItem(k):localStorage.setItem(k,previous[k])}catch{}}
  console.error("Could not save VCT data",err);
  showAppNotice("Your browser could not save this change. Check available storage/privacy settings, then try again.","Save failed");
  return false;
 }
}
function optionalNumber(v){
 if(v===null||v===undefined||v===""||String(v).trim().toLowerCase()==="null")return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}
function normalizeMatchOptionals(match){
 if(!match||typeof match!=="object")return match;
 ["rrAfter","rrChange","kills","deaths","assists","acs","adr","ddDelta","hs","kast","firstKills","firstDeaths","multiKills","rounds"].forEach(k=>{
   if(k in match)match[k]=optionalNumber(match[k]);
 });
 return match;
}
// Runtime-only, provenance-aware rank/RR progression. Derived values are never persisted.
// Priority: recorded > safely derived > unknown. Never guess across an information gap.
const rankProgressionRuntime=new WeakMap();
function rankValue(v){const x=String(v??"").trim();return ranks.includes(x)?x:null}
function stateValue(value,source="unknown"){return {value:value??null,source:value===null||value===undefined?"unknown":source}}
function rebuildChallengeRankProgression(challenge){
 if(!challenge||!Array.isArray(challenge.matches)){return []}
 const ordered=challenge.matches.slice().sort((a,b)=>Number(a.no)-Number(b.no));
 let previousRank=rankValue(challenge.startRank)||"Unranked";
 let previousRR=isUnranked(previousRank)?null:optionalNumber(challenge.startRR);
 let previousRRSource=previousRR===null?"unknown":"recorded";
 let chainIntact=previousRR!==null;
 const states=[];
 for(const m of ordered){
  const afterRank=rankValue(m.rankAfter)||previousRank;
  const recordedAfterRR=isUnranked(afterRank)?null:optionalNumber(m.rrAfter);
  const recordedChange=isUnranked(afterRank)?null:optionalNumber(m.rrChange);
  let beforeRR=(!isUnranked(previousRank)&&chainIntact)?previousRR:null;
  let beforeSource=beforeRR===null?"unknown":previousRRSource;
  let afterRR=recordedAfterRR,afterSource=recordedAfterRR===null?"unknown":"recorded";
  let change=recordedChange,changeSource=recordedChange===null?"unknown":"recorded";
  const sameRank=!isUnranked(previousRank)&&previousRank===afterRank;
  const placement=isUnranked(previousRank)&&!isUnranked(afterRank);

  // Same-tier arithmetic is the only safe automatic RR derivation. Rank-boundary math is not guessed.
  if(sameRank){
   if(afterRR===null&&beforeRR!==null&&change!==null){
    const candidate=beforeRR+change;
    if(candidate>=0&&candidate<=100){afterRR=candidate;afterSource="derived"}
   }
   if(beforeRR===null&&afterRR!==null&&change!==null){
    const candidate=afterRR-change;
    if(candidate>=0&&candidate<=100){beforeRR=candidate;beforeSource="derived"}
   }
   if(change===null&&beforeRR!==null&&afterRR!==null){change=afterRR-beforeRR;changeSource="derived"}
  }

  let event=String(m.rankStatus||"").trim();
  if(placement)event="Placed";
  else if(isUnranked(previousRank)&&isUnranked(afterRank))event="Same Rank";
  else if(!["Same Rank","Placed","Promoted","Demoted"].includes(event)){
   const bi=ranks.indexOf(previousRank),ai=ranks.indexOf(afterRank);
   event=ai===bi?"Same Rank":ai>bi?"Promoted":ai<bi?"Demoted":"unknown";
  }
  const state={
   matchNo:Number(m.no),
   before:{rank:stateValue(previousRank,"derived"),rr:stateValue(beforeRR,beforeSource)},
   change:{rr:stateValue(change,changeSource)},
   after:{rank:stateValue(afterRank,m.rankAfter?"recorded":"derived"),rr:stateValue(afterRR,afterSource)},
   event:{value:event||"unknown",source:m.rankStatus?"recorded":"derived"}
  };
  states.push(state);

  previousRank=afterRank;
  // Placement/rank changes and missing links break absolute RR derivation unless this match records an anchor.
  if(isUnranked(afterRank)){previousRR=null;previousRRSource="unknown";chainIntact=false}
  else if(afterRR!==null){previousRR=afterRR;previousRRSource=afterSource;chainIntact=true}
  else {previousRR=null;previousRRSource="unknown";chainIntact=false}
 }
 rankProgressionRuntime.set(challenge,states);
 return states;
}
function challengeRankProgression(challenge=data){
 if(!challenge)return [];
 return rebuildChallengeRankProgression(challenge);
}
function rankStateForMatch(matchNo,challenge=data){return challengeRankProgression(challenge).find(s=>s.matchNo===Number(matchNo))||null}
function latestRankState(challenge=data){const s=challengeRankProgression(challenge);return s.length?s[s.length-1]:null}

function normalizeStoredChallenges(){
 const all=[data,...activeChallenges,...archives].filter(Boolean);
 all.forEach(c=>{
  if(!Array.isArray(c.matches))return;
  c.matches.forEach(normalizeMatchOptionals);
  let previousRank=c.startRank||"Unranked";
  c.matches.slice().sort((a,b)=>Number(a.no)-Number(b.no)).forEach(m=>{
   const after=m.rankAfter||previousRank;
   // Migration: older builds treated first placement as a promotion.
   if(isUnranked(previousRank) && !isUnranked(after))m.rankStatus="Placed";
   else if(isUnranked(previousRank) && isUnranked(after))m.rankStatus="Same Rank";
   if(isUnranked(after)){m.rrAfter=null;m.rrChange=null;}
   previousRank=after;
  });
  rebuildChallengeRankProgression(c);
 });
}
normalizeStoredChallenges();
const cur=()=>{
 if(!data)return {rankAfter:"Unranked",rrAfter:null};
 const latest=latestRankState(data);
 if(!latest)return {rankAfter:data.startRank,rrAfter:isUnranked(data.startRank)?null:optionalNumber(data.startRR),rrSource:optionalNumber(data.startRR)===null?"unknown":"recorded"};
 return {rankAfter:latest.after.rank.value||data.startRank,rrAfter:latest.after.rr.value,rrSource:latest.after.rr.source,rankState:latest};
};
const avg=k=>{const vals=data.matches.map(m=>m[k]).filter(v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))).map(Number);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};

let roundsManuallyEdited=false;
function calculatedRoundsFromScore(){
 const my=Math.max(0,Number($("myScore")?.value||0));
 const enemy=Math.max(0,Number($("enemyScore")?.value||0));
 return my+enemy;
}
function syncRoundsFromScore(force=false){
 const rounds=$("rounds");
 if(!rounds)return;
 if(force||!roundsManuallyEdited)rounds.value=String(calculatedRoundsFromScore());
}

window.openModal=function openModal(editNo=null){
 if(!data){showAppNotice("Create or open a challenge before adding a match.","No active challenge");return}
 const form=$("matchForm");form.reset();$("editNo").value="";roundsManuallyEdited=false;clearValidationErrors();
 const isEdit=editNo!==null && editNo!==undefined && editNo!=="";
 if(isEdit){
   const no=Number(editNo),m=data.matches.find(x=>x.no===no);if(!m){showAppNotice("That match could not be found.","Match unavailable");return;}
   $("editNo").value=String(no);$("matchNo").value=String(no);$("matchTitle").textContent=`Edit match #${no}`;$("matchSubtitle")&&($("matchSubtitle").textContent="Update any match details. Analytics will recalculate after saving.");$("matchNumberBadge").textContent=`MATCH #${no}`;$("saveMatchBtn").textContent="Save changes";
   Object.entries(m).forEach(([k,v])=>{const el=$(k);if(el && v!==undefined && v!==null)el.value=String(v)});
 }else{
   const c=cur(),next=nextCountedMatchNumber();
   $("matchNo").value=String(next);
   $("matchTitle").textContent=`Add match #${next}`;$("matchSubtitle")&&($("matchSubtitle").textContent="Record the result, rank movement and performance stats.");$("matchNumberBadge").textContent=`MATCH #${next}`;$("saveMatchBtn").textContent="Save match";
   $("rankAfter").value=c.rankAfter;if(c.rrAfter!==null)$("rrAfter").value=String(c.rrAfter);
   if($("result"))$("result").value="Win";
   if($("rankStatus"))$("rankStatus").value="Same Rank";
   syncRoundsFromScore(true);
 }
 $("modal").classList.remove("hidden");
 document.body.classList.add("modal-open");
 requestAnimationFrame(()=>{const first=$("agent");if(first)first.focus()});
}
function closeModal(){const modal=$("modal");if(modal)modal.classList.add("hidden");document.body.classList.remove("modal-open")}

document.addEventListener("click",async function(e){
 const add=e.target.closest("#addMatchBtn");
 if(add){e.preventDefault();openModal();return;}
 const edit=e.target.closest("[data-edit-match]");
 if(edit){e.preventDefault();openModal(Number(edit.dataset.editMatch));return;}
 const del=e.target.closest("[data-delete-match]");
 if(del){
   e.preventDefault();
   const no=Number(del.dataset.deleteMatch);
   const match=data&&data.matches.find(m=>m.no===no);
   if(!match)return;
   if(!await appConfirm({title:`Delete match #${no}?`,message:"This match will be permanently removed. Challenge progress and analytics will recalculate immediately.",confirmText:"Delete match",kicker:"DELETE MATCH"}))return;
   data.matches=data.matches.filter(m=>m.no!==no);
   // Match IDs are stable user-facing identifiers; deleting one must not renumber the rest.
   data.matches.sort((a,b)=>Number(a.no)-Number(b.no));
   if(!persist()){ data.matches.push(match); data.matches.sort((a,b)=>Number(a.no)-Number(b.no)); return; }
   render();showPage("matches");return;
 }
});
document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",async function(e){e.preventDefault();closeModal()}));
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("noticeModal")&&!$("noticeModal").classList.contains("hidden")){closeAppNotice();return}if(!$("confirmModal").classList.contains("hidden")){finishConfirmation(false);return}if(!$("modal").classList.contains("hidden"))closeModal()});

let pendingConfirmation=null;
function appConfirm({
 title="Are you sure?",
 message="This action cannot be undone.",
 confirmText="Confirm",
 kicker="CONFIRM ACTION",
 danger=true
}={}){
 return new Promise(resolve=>{
   pendingConfirmation=resolve;
   $("confirmKicker").textContent=kicker;
   $("confirmTitle").textContent=title;
   $("confirmMessage").textContent=message;
   $("confirmActionBtn").textContent=confirmText;
   $("confirmActionBtn").classList.toggle("danger-confirm",danger);
   $("confirmModal").classList.remove("hidden");
   $("confirmModal").setAttribute("aria-hidden","false");
   requestAnimationFrame(()=>$("confirmActionBtn").focus());
 });
}
function finishConfirmation(value){
 if(!$("confirmModal") || $("confirmModal").classList.contains("hidden"))return;
 $("confirmModal").classList.add("hidden");
 $("confirmModal").setAttribute("aria-hidden","true");
 const resolve=pendingConfirmation;pendingConfirmation=null;
 if(resolve)resolve(value);
}
document.querySelectorAll("[data-confirm-cancel]").forEach(el=>el.addEventListener("click",()=>finishConfirmation(false)));
if($("confirmActionBtn"))$("confirmActionBtn").addEventListener("click",()=>finishConfirmation(true));


function showAppNotice(message,title="Something needs attention"){
 const modal=$("noticeModal");
 if(!modal){console.warn(title,message);return}
 $("noticeTitle").textContent=title;
 $("noticeMessage").textContent=message;
 modal.classList.remove("hidden");
 modal.setAttribute("aria-hidden","false");
 requestAnimationFrame(()=>$("noticeOkBtn")?.focus());
}
function closeAppNotice(){
 const modal=$("noticeModal");if(!modal)return;
 modal.classList.add("hidden");modal.setAttribute("aria-hidden","true");
}
function showToast(message,tone="success"){
 const host=$("toastHost");if(!host)return;
 const el=document.createElement("div");
 el.className=`app-toast ${tone}`;
 el.textContent=message;
 host.appendChild(el);
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},2600);
}
document.querySelectorAll("[data-notice-close]").forEach(x=>x.addEventListener("click",closeAppNotice));

function rankIndex(rank){return ranks.indexOf(rank)}
function isUnranked(rank){return rank==="Unranked"}
function syncStartingRRState(){
 const rank=$("startRank"),rr=$("startRR");if(!rank||!rr)return;
 const unranked=isUnranked(rank.value);
 rr.disabled=unranked;rr.required=!unranked;
 rr.placeholder=unranked?"Not applicable":"0–100";
 if(unranked)rr.value="";
}
function updateTargetRankOptions(){
 const current=$("startRank"),target=$("targetRank");
 if(!current||!target)return;
 const currentIndex=rankIndex(current.value);
 Array.from(target.options).forEach(option=>{
   if(option.value===""){
     option.disabled=false;
     option.hidden=false;
     return;
   }
   const optionIndex=rankIndex(option.value);
   option.disabled=currentIndex>=0 && optionIndex<=currentIndex;
 });
 // If the previous target is now invalid, switch cleanly to No target.
 if(target.value && rankIndex(target.value)<=currentIndex)target.value="";
}

function validateRankTransition(prevRank,nextRank,status){
 const a=rankIndex(prevRank),b=rankIndex(nextRank);
 if(a<0||b<0)return "Select a recognised rank.";
 if(isUnranked(prevRank)){
  if(isUnranked(nextRank) && status!=="Same Rank")return "Placement is still unresolved, so rank status must remain Same Rank.";
  if(!isUnranked(nextRank) && status!=="Placed")return "The first ranked result after Unranked must use Placed, not promotion or demotion.";
  return "";
 }
 if(isUnranked(nextRank))return "A placed player cannot return to Unranked within the same challenge.";
 if(status==="Placed")return "Placed is only valid when the previous rank is Unranked.";
 if(status==="Same Rank" && a!==b)return "Rank status is Same Rank, but the selected rank changed.";
 if(status==="Promoted" && b<=a)return "Promoted requires the ending rank to be higher than the previous rank.";
 if(status==="Demoted" && b>=a)return "Demoted requires the ending rank to be lower than the previous rank.";
 return "";
}
function renderRankPath(){
 const safeStartRank=escapeHtml(data?.startRank ?? "");
 const safeStartRr=(isUnranked(data?.startRank)||data?.startRR==null) ? "" : ` ${escapeHtml(data.startRR)}RR`;
 const chips=[`<span class="rank-chip">Start: ${safeStartRank}${safeStartRr}</span>`];
 countedMatches().forEach(m=>{
  if(m.rankStatus!=="Same Rank"){
   const statusText=String(m.rankStatus ?? "");
   const statusClass=statusText==="Promoted"?"promoted":statusText==="Demoted"?"demoted":"same-rank";
   chips.push(`<span class="rank-chip ${statusClass}">#${escapeHtml(m.no)} ${escapeHtml(statusText)}: ${escapeHtml(m.rankAfter)}</span>`);
  }
 });
 $("rankPath").innerHTML=chips.join("");
}
function renderComparison(){
 const ms=analyticsMatches();if(ms.length<2){$("comparison").innerHTML='<div class="empty">Add more matches to compare performance periods.</div>';return}
 const first=ms.slice(0,Math.min(5,ms.length)),last=ms.slice(-Math.min(5,ms.length));
 const av=(arr,key)=>{const vals=arr.map(m=>key==="kd"?((m.kills==null||m.deaths==null)?null:(Number(m.deaths)?Number(m.kills)/Number(m.deaths):Number(m.kills))):optionalNumber(m[key])).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
 const metrics=[["K/D","kd",2],["ACS","acs",0],["ADR","adr",0],["DDΔ","ddDelta",1],["KAST","kast",1],["HS","hs",1]];
 $("comparison").innerHTML=metrics.map(([label,key,dp])=>{const a=av(first,key),b=av(last,key),suffix=["kast","hs"].includes(key)?"%":"";if(a===null||b===null)return `<div class="compare"><span>${label}</span><b>—</b><small class="delta-flat">Not enough recorded data</small></div>`;const d=b-a,cls=d>.001?"delta-up":d<-.001?"delta-down":"delta-flat";return `<div class="compare"><span>${label}</span><b>${b.toFixed(dp)}${suffix}</b><small class="${cls}">${d>=0?"+":""}${d.toFixed(dp)}${suffix} vs first ${first.length}</small></div>`}).join("");
}
function renderArchiveBrowser(){
 const list=$("archiveBrowserList");if(!list)return;
 list.innerHTML=archives.length?archives.map((c,i)=>`<div class="archive-restore-row"><div><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.matches?.length ?? 0)}/${escapeHtml(c.target ?? "")} matches · ${escapeHtml(c.startRank ?? "")} → ${escapeHtml(c.targetRank||"No target")}</p></div><div class="actions"><button class="ghost" type="button" data-restore-archive="${i}">Unarchive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteArchivedChallenge(${i})">Delete</button></div></div>`).join(""):'<div class="empty">No archived challenges.</div>';
}
function openArchiveBrowser(){renderArchiveBrowser();$("archiveBrowserModal").classList.remove("hidden")}
function closeArchiveBrowser(){$("archiveBrowserModal").classList.add("hidden")}
function showPage(id){
 if(id==="changelog"){
   $("setup").classList.add("hidden");
   $("app").classList.remove("hidden");
   document.querySelectorAll(".page").forEach(page=>page.classList.remove("active-page"));
   document.querySelectorAll(".nav").forEach(btn=>btn.classList.toggle("active",btn.dataset.target===id));
   $("changelog").classList.add("active-page");
   window.scrollTo({top:0,behavior:"smooth"});
   return;
 }
 if(!data){
   $("setup").classList.remove("hidden");
   if(id==="challenges")openArchiveBrowser();
   return;
 }
 document.querySelectorAll(".page").forEach(page=>page.classList.remove("active-page"));
 document.querySelectorAll(".nav").forEach(btn=>btn.classList.toggle("active",btn.dataset.target===id));
 const page=$(id);
 if(!page){console.error(`Unknown page: ${id}`);return}
 page.classList.add("active-page");
 if(id==="challenges")renderArchive();
 if(id==="matches")renderTable();
 if(id==="analytics"){
   renderDist("agent","agentDist");renderDist("map","mapDist");
   renderWinBars("agent","agentWinBars");renderWinBars("map","mapWinBars");
   renderComparison();renderInsights();renderMatrix(); if(window.renderTopMaps)window.renderTopMaps();
 }
}
document.querySelectorAll(".nav").forEach(btn=>{
 btn.type="button";
 btn.addEventListener("click",async e=>{e.preventDefault();showPage(btn.dataset.target)});
async function startNewChallengeFlow(){
 document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));
 document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));
 $("app").classList.add("hidden");
 $("setup").classList.remove("hidden");
 $("challengeForm").reset();
 if($("cancelNewChallenge"))$("cancelNewChallenge").classList.toggle("hidden",activeChallenges.length===0);
 updateTargetRankOptions();
 window.scrollTo({top:0,behavior:"smooth"});
 setTimeout(()=>$("challengeName")?.focus(),180);
}
if($("cancelNewChallenge"))$("cancelNewChallenge").addEventListener("click",()=>{
 $("setup").classList.add("hidden");
 if(activeChallenges.length){
   if(!data)data=activeChallenges[0];
   $("app").classList.remove("hidden");
   render();showPage("challenges");
 }
});
if($("newChallengePage"))$("newChallengePage").addEventListener("click",e=>{
 e.preventDefault();
 startNewChallengeFlow();
});

});

let matchPage=1;
// Match data pipeline boundaries:
// - countedMatches(): canonical challenge dataset; analytics/overview/charts read from here.
// - getTableMatches(): table-only filtering/sorting; never an analytics source.
// - getTablePage(): presentation-only pagination; must never feed charts or statistics.
function countedMatches(){ return data && Array.isArray(data.matches) ? data.matches : []; }
function usedMatchNumbers(excludeNo=null){
 const excluded=excludeNo===null||excludeNo===undefined?null:Number(excludeNo);
 return new Set(countedMatches()
  .map(m=>Number(m?.no))
  .filter(n=>Number.isInteger(n)&&n>0&&(excluded===null||n!==excluded)));
}
function matchNumberExists(no,excludeNo=null){
 const n=Number(no);
 return Number.isInteger(n)&&n>0&&usedMatchNumbers(excludeNo).has(n);
}
function analyticsMatches(){ const all=countedMatches().slice().sort((a,b)=>Number(a.no)-Number(b.no)); const raw=$("analyticsRange")?.value||"all"; const n=raw==="all"?all.length:Number(raw); return all.slice(-n); }
function nextCountedMatchNumber(){ const used=usedMatchNumbers();let n=1;while(used.has(n))n++;return n; }
function populateMatchFilterOptions(){
 const agent=$("matchAgentFilter"),map=$("matchMapFilter");if(!agent||!map)return;
 const av=agent.value,mv=map.value,agents=[...new Set(countedMatches().map(m=>m.agent).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),maps=[...new Set(countedMatches().map(m=>m.map).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 agent.innerHTML='<option value="">All agents</option>'+agents.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
 map.innerHTML='<option value="">All maps</option>'+maps.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
 if(agents.includes(av))agent.value=av;if(maps.includes(mv))map.value=mv;
}
function getTableMatches(){
 let ms=countedMatches().slice(),result=$("matchResultFilter")?.value||"",agent=$("matchAgentFilter")?.value||"",map=$("matchMapFilter")?.value||"";
 if(result)ms=ms.filter(m=>m.result===result);if(agent)ms=ms.filter(m=>m.agent===agent);if(map)ms=ms.filter(m=>m.map===map);
 const sort=$("matchSort")?.value||"no-desc",order={Win:0,Draw:1,Loss:2},kd=m=>(m.kills==null||m.deaths==null)?-Infinity:(Number(m.deaths)?Number(m.kills)/Number(m.deaths):Number(m.kills));
 ms.sort((a,b)=>{
  if(sort==="no-asc")return Number(a.no)-Number(b.no);
  if(sort==="agent-asc")return String(a.agent||"").localeCompare(String(b.agent||""))||Number(b.no)-Number(a.no);
  if(sort==="agent-desc")return String(b.agent||"").localeCompare(String(a.agent||""))||Number(b.no)-Number(a.no);
  if(sort==="result")return (order[a.result]??9)-(order[b.result]??9)||Number(b.no)-Number(a.no);
  if(sort==="map-asc")return String(a.map||"").localeCompare(String(b.map||""))||Number(b.no)-Number(a.no);
  if(sort==="map-desc")return String(b.map||"").localeCompare(String(a.map||""))||Number(b.no)-Number(a.no);
  if(sort==="kd-desc")return kd(b)-kd(a)||Number(b.no)-Number(a.no);
  if(sort==="acs-desc")return Number(b.acs??-Infinity)-Number(a.acs??-Infinity)||Number(b.no)-Number(a.no);
  if(sort==="dda-desc")return Number(b.ddDelta??-Infinity)-Number(a.ddDelta??-Infinity)||Number(b.no)-Number(a.no);
  return Number(b.no)-Number(a.no);
 });return ms;
}

function getTablePage(tableMatches,pageRaw,page){
 // Pagination is deliberately isolated from the canonical/analytics dataset.
 // Only Match History rendering may consume `paged`.
 const size=pageRaw==="all"?Math.max(1,tableMatches.length):Math.max(1,Number(pageRaw)||25);
 const pages=Math.max(1,Math.ceil(tableMatches.length/size));
 const safePage=Math.min(Math.max(1,Number(page)||1),pages);
 const start=(safePage-1)*size;
 return {page:safePage,pageSize:size,pages,start,paged:tableMatches.slice(start,start+size)};
}

function getPaginationPages(page,pages){
 if(pages<=9){
  return Array.from({length:pages},(_,i)=>i+1);
 }
 const output=[1];
 const leftBound=Math.max(2,page-3);
 const rightBound=Math.min(pages-1,page+3);
 if(leftBound>2)output.push("left");
 for(let num=leftBound;num<=rightBound;num++){
  output.push(num);
 }
 if(rightBound<pages-1)output.push("right");
 output.push(pages);
 return output;
}

function render(){
 if(!data&&activeChallenges.length)data=activeChallenges[0];
 const active=!!data;$("setup").classList.toggle("hidden",active);$("app").classList.toggle("hidden",!active);
 if(!active){
   document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));
   if($("setupArchiveAccess"))$("setupArchiveAccess").classList.toggle("hidden",archives.length===0&&activeChallenges.length===0);
   return
 }
 if($("setupArchiveAccess"))$("setupArchiveAccess").classList.add("hidden");
 const activePage=document.querySelector(".page.active-page");
 if(!activePage)showPage("overview");
 const ms=data.matches,c=cur(),wins=ms.filter(m=>m.result==="Win").length,losses=ms.filter(m=>m.result==="Loss").length,draws=ms.filter(m=>m.result==="Draw").length,rrChanges=ms.map(m=>optionalNumber(m.rrChange)).filter(v=>v!==null),net=rrChanges.reduce((s,v)=>s+v,0);
 $("heroName").textContent=data.name;$("heroDesc").textContent=data.description||`Target: ${(data.targetRank||"No target")}`;$("heroRank").textContent=c.rankAfter;const tier=c.rankAfter.split(" ")[0];
 const emblem=$("rankEmblem");
 const rankAssetName=String(c.rankAfter||"").trim().toLowerCase().replace(/\s+/g,"-");
 const imageRanks=new Set(["unranked","bronze-1","bronze-2","bronze-3","silver-1","silver-2","silver-3","gold-1","gold-2","gold-3"]);
 if(imageRanks.has(rankAssetName)){emblem.innerHTML=`<img src="assets/ranks/${rankAssetName}.png" alt="${escapeHtml(c.rankAfter)} rank emblem">`;emblem.classList.add("rank-emblem-image");}
 else{emblem.textContent=tier==="Radiant"?"R":tier.slice(0,2).toUpperCase();emblem.classList.remove("rank-emblem-image");}
 $("heroRR").textContent=isUnranked(c.rankAfter)?"Unrated":(c.rrAfter===null?"— RR":`${c.rrAfter} RR`);$("heroNet").textContent=rrChanges.length?`${net>=0?"+":""}${net} RR overall`:"— RR overall";
 const progress=challengeProgress(data);
 $("progressFill").style.width=`${progress.target?progress.completed/progress.target*100:0}%`;$("progressLabel").textContent=challengeProgressText(data);$("recordLabel").textContent=`${wins}W · ${losses}L · ${draws}D · ${ms.length?(wins/ms.length*100).toFixed(1):0}% WR`;
 const kills=ms.reduce((s,m)=>s+(Number(m.kills)||0),0),deaths=ms.reduce((s,m)=>s+(Number(m.deaths)||0),0),kd=deaths?kills/deaths:kills;
 const fmtAvg=(key,suffix="",signed=false)=>{const v=avg(key);return v===null?"—":`${signed&&v>=0?"+":""}${v.toFixed(1)}${suffix}`};
 const stats=[["K/D",ms.length?kd.toFixed(2):"—","Combat efficiency"],["ACS",fmtAvg("acs"),"Avg combat score"],["ADR",fmtAvg("adr"),"Damage / round"],["DDΔ",fmtAvg("ddDelta","",true),"Damage differential"],["KAST",fmtAvg("kast","%"),"Round impact"],["HS",fmtAvg("hs","%"),"Headshot rate"]];
 $("statCards").innerHTML=stats.map((x,i)=>`<div class="stat metric-tile"><div class="metric-top"><span>${x[0]}</span><i>${String(i+1).padStart(2,"0")}</i></div><b>${x[1]}</b><small>${x[2]}</small></div>`).join("");
 renderRankPath();renderChart();renderMetricChart();renderResultBars();renderRecent();renderTable();renderAnalyticsStrip();renderAccuracyPanel();renderRolePanel();renderTopAgents();renderDist("agent","agentDist");renderDist("map","mapDist");renderWinBars("agent","agentWinBars");renderWinBars("map","mapWinBars");renderComparison();renderInsights();renderMatrix(); if(window.renderTopMaps)window.renderTopMaps();renderArchive();
}
function lineSVG(values, format=v=>v.toFixed(1), labels=null, overlay=null, options=null){
 const pairs=values.map((v,i)=>({v:(v===null||v===undefined||v==="")?NaN:Number(v),label:Number(labels?.[i]??(i+1))})).filter(x=>Number.isFinite(x.v)&&Number.isFinite(x.label));
 const overlayPairs=(overlay?.values||[]).map((v,i)=>({v:(v===null||v===undefined||v==="")?NaN:Number(v),label:Number(labels?.[i]??(i+1))})).filter(x=>Number.isFinite(x.v)&&Number.isFinite(x.label));
 const clean=[...pairs.map(x=>x.v),...overlayPairs.map(x=>x.v)],w=720,h=220,pl=54,pr=18,pt=22,pb=34;
 if(!pairs.length)return '<div class="empty chart-empty">No chart data yet.</div>';
 let min=Math.min(...clean),max=Math.max(...clean);
 // RR progression is cumulative net change, so zero is a meaningful reference point.
 // Include it in the domain rather than allowing auto-scaling to hide the baseline.
 if(options?.zeroBaseline){min=Math.min(min,0);max=Math.max(max,0)}
 if(min===max){min-=1;max+=1}
 const pad=(max-min)*.12||1;min-=pad;max+=pad;
 const allLabels=[...pairs,...overlayPairs].map(x=>x.label),minLabel=Math.min(...allLabels),maxLabel=Math.max(...allLabels);
 const x=label=>minLabel===maxLabel?(pl+w-pr)/2:pl+(label-minLabel)*(w-pl-pr)/(maxLabel-minLabel),y=v=>pt+(max-v)*(h-pt-pb)/(max-min);
 const pts=pairs.map(p=>`${x(p.label)},${y(p.v)}`).join(' '),gid='g'+Math.random().toString(36).slice(2,8);
 const smoothPath=ps=>{if(!ps.length)return '';const xy=ps.map(p=>[x(p.label),y(p.v)]);if(xy.length===1)return `M ${xy[0][0]} ${xy[0][1]}`;let d=`M ${xy[0][0]} ${xy[0][1]}`;for(let i=1;i<xy.length-1;i++){const mx=(xy[i][0]+xy[i+1][0])/2,my=(xy[i][1]+xy[i+1][1])/2;d+=` Q ${xy[i][0]} ${xy[i][1]} ${mx} ${my}`}d+=` Q ${xy.at(-1)[0]} ${xy.at(-1)[1]} ${xy.at(-1)[0]} ${xy.at(-1)[1]}`;return d};
 const hasZeroBaseline=Boolean(options?.zeroBaseline&&min<=0&&max>=0),zeroY=hasZeroBaseline?y(0):null;
 let grid='';for(let i=0;i<5;i++){const yy=pt+i*(h-pt-pb)/4,val=max-i*(max-min)/4;const nearZero=hasZeroBaseline&&Math.abs(yy-zeroY)<14;grid+=`<line class="chart-grid-line" x1="${pl}" y1="${yy}" x2="${w-pr}" y2="${yy}"/>${nearZero?'':`<text class="chart-axis-label" x="${pl-10}" y="${yy+4}" text-anchor="end">${format(val)}</text>`}`}
 // For cumulative RR, zero is the semantic baseline. Fill gain/loss area to zero, not to the chart floor.
 const areaBaseY=hasZeroBaseline?zeroY:(h-pb);
 const area=`${x(pairs[0].label)},${areaBaseY} ${pts} ${x(pairs.at(-1).label)},${areaBaseY}`;
 const zeroBaseline=hasZeroBaseline?`<line class="chart-zero-line" x1="${pl}" y1="${zeroY}" x2="${w-pr}" y2="${zeroY}"/><text class="chart-zero-label" x="${pl-10}" y="${zeroY+4}" text-anchor="end">0</text>`:'';
 const overlaySvg=overlayPairs.length?`<path class="chart-average-path" d="${smoothPath(overlayPairs)}"/>${overlayPairs.map(p=>`<circle class="chart-average-point" cx="${x(p.label)}" cy="${y(p.v)}" r="3"><title>Match #${p.label} · ${overlay?.label||"Average"}: ${format(p.v)}</title></circle>`).join('')}`:'';
 return `<svg class="modern-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Match trend from match ${minLabel} to ${maxLabel}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef5360" stop-opacity=".28"/><stop offset="1" stop-color="#ef5360" stop-opacity="0"/></linearGradient></defs>${grid}${zeroBaseline}<polygon points="${area}" fill="url(#${gid})"/><polyline class="chart-path" points="${pts}"/>${overlaySvg}${pairs.map(p=>`<circle class="chart-point" cx="${x(p.label)}" cy="${y(p.v)}" r="4" tabindex="0"><title>Match #${p.label}: ${format(p.v)}</title></circle>`).join('')}<text class="chart-x-label" x="${pl}" y="${h-8}">MATCH ${minLabel}</text><text class="chart-x-label" x="${w-pr}" y="${h-8}" text-anchor="end">MATCH ${maxLabel}</text></svg>`;
}
function renderChart(){
 let cumulative=0,vals=[],labels=[];countedMatches().slice().sort((a,b)=>Number(a.no)-Number(b.no)).forEach(m=>{const change=optionalNumber(m.rrChange);if(change!==null){cumulative+=change;vals.push(cumulative);labels.push(Number(m.no))}});
 $("rrChart").innerHTML=vals.length?lineSVG(vals,v=>`${v>=0?"+":""}${Math.round(v)}`,labels,null,{zeroBaseline:true}):'<div class="empty chart-empty">RR tracking is optional. Add RR changes to enable progression.</div>'; if($("overviewProgressGrid"))$("overviewProgressGrid").classList.toggle("rr-unavailable",!vals.length);
}
function renderMetricChart(){
 const metric=$("trendMetric").value;
 // Overview trends must use the same real Match History dataset as the rest of the app.
 // Using data.matches directly can include non-counted/internal records and make Auto range
 // drop the first genuine match (for example Match #1 in a 25-match history).
 const sorted=countedMatches().slice().sort((a,b)=>Number(a.no)-Number(b.no));
 const range=$("trendRange")?.value||"auto";
 // Auto range is a readability aid, not a hard 25-match page size. Keep modest
 // histories intact (including Match #1) and only window genuinely dense charts.
 // Explicit Last 10/25/50 and All matches remain exact.
 const AUTO_TREND_MAX_POINTS=30;
 const limit=range==="all"?sorted.length:range==="auto"?(sorted.length>AUTO_TREND_MAX_POINTS?AUTO_TREND_MAX_POINTS:sorted.length):Math.max(1,Number(range)||sorted.length);
 const ms=sorted.slice(-limit);
 const values=ms.map(m=>{
  if(metric==="kd"){
   const k=optionalNumber(m.kills),d=optionalNumber(m.deaths);
   if(k===null||d===null)return null;
   return d?k/d:k;
  }
  return optionalNumber(m[metric]);
 });
 // Plot the exact per-match metric. Trend range controls visibility only; it must
 // never smooth, average, normalize or otherwise transform the stored match value.
 // Missing values remain unavailable and are omitted by lineSVG rather than fabricated.
 const labels=ms.map(m=>Number(m.no));
 $("metricChart").innerHTML=ms.length?lineSVG(values,v=>metric==="kast"||metric==="hs"?`${v.toFixed(0)}%`:v.toFixed(metric==="acs"||metric==="adr"?0:2),labels):'<div class="empty">Add matches to see performance trends.</div>';
}
function renderResultBars(){
 const ms=data.matches,total=ms.length||1, items=["Win","Loss","Draw"].map(n=>[n,ms.filter(m=>m.result===n).length]);
 $("resultBars").innerHTML=ms.length?items.map(([n,c])=>`<div class="result-row ${n.toLowerCase()}"><b>${n}</b><div class="result-track"><div class="result-fill" style="width:${c/total*100}%"></div></div><span>${c} · ${(c/total*100).toFixed(0)}%</span></div>`).join(""):'<div class="empty">No result data yet.</div>';
}
function renderWinBars(key,id){
 const groups={};analyticsMatches().forEach(m=>{groups[m[key]]??={n:0,w:0};groups[m[key]].n++;if(m.result==="Win")groups[m[key]].w++});
 const arr=Object.entries(groups).map(([name,v])=>[name,v.n,v.w/v.n*100]).sort((a,b)=>b[2]-a[2]);
 $(id).innerHTML=arr.length?arr.map(([n,count,wr])=>`<div class="hbar"><span class="hbar-name" title="${n}">${n}</span><div class="hbar-track"><div class="hbar-fill" style="width:${wr}%"></div></div><span class="hbar-value">${wr.toFixed(0)}% <small>(${count})</small></span></div>`).join(""):'<div class="empty">No data yet.</div>';
}
function renderRecent(){
 const ms=countedMatches().slice().sort((a,b)=>Number(b.no)-Number(a.no)).slice(0,5);$("recentMatches").innerHTML=ms.length?ms.map(m=>{const rr=optionalNumber(m.rrChange);return `<div class="recent"><div class="result-dot ${String(m.result||"").toLowerCase()}">${escapeHtml(String(m.result||"?").slice(0,1))}</div><div><b>${m.agent} · ${m.map}</b><span>${m.kills??"—"}/${m.deaths??"—"}/${m.assists??"—"} · ${m.acs??"—"} ACS</span></div><strong class="${rr===null?"muted":(rr>=0?"pos":"neg")}">${rr===null?"— RR":`${rr>=0?"+":""}${rr} RR`}</strong></div>`}).join(""):'<div class="empty">No matches recorded yet.</div>';
}
function renderTable(){
 populateMatchFilterOptions();
 const tableMatches=getTableMatches(),total=countedMatches().length;
 const activeFilters=[$("matchResultFilter")?.value,$("matchAgentFilter")?.value,$("matchMapFilter")?.value].filter(Boolean).length;
 const pageRaw=$("matchPageSize")?.value||"25";
 const pageState=getTablePage(tableMatches,pageRaw,matchPage);
 matchPage=pageState.page;
 const {pageSize,pages,start,paged}=pageState;
 if($("matchFilterCount"))$("matchFilterCount").textContent=total?`Showing ${tableMatches.length} of ${total}${activeFilters?` · ${activeFilters} filter${activeFilters===1?"":"s"} active`:""}`:"No matches recorded";
 if($("matchFilterToggle")){ $("matchFilterToggle").classList.toggle("filter-active",activeFilters>0); $("matchFilterToggle").textContent=`Sort & filter${activeFilters?` · ${activeFilters}`:""}`; }
    if($("matchPagination")){
      const pagEl=$("matchPagination");
      const summaryText=pageRaw==="all"?`${tableMatches.length} match${tableMatches.length===1?"":"es"}`:`Showing ${start+1}–${Math.min(start+pageSize,tableMatches.length)} of ${tableMatches.length} matches`;
      const showControls=pageRaw!=="all"&&pages>1;
      const prevDisabled=matchPage===1?"disabled":"";
      const nextDisabled=matchPage===pages?"disabled":"";
      const svgPrev=`<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>`;
      const svgNext=`<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"></path></svg>`;
      const pagesList=showControls?getPaginationPages(matchPage,pages):[];
      const centerHtml=showControls?`<div class="pagination-center"><button class="page-nav" type="button" data-match-page="prev" ${prevDisabled} aria-label="Previous page">${svgPrev}</button>${pagesList.map(p=>typeof p==="number"?`<button class="page-button${p===matchPage?" active":""}" type="button" data-match-page="goto" data-page="${p}" aria-label="Go to page ${p}">${p}</button>`:`<span class="page-button ellipsis" aria-hidden="true">…</span>`).join("")}<button class="page-nav" type="button" data-match-page="next" ${nextDisabled} aria-label="Next page">${svgNext}</button></div>`:`<div class="pagination-center"></div>`;
      // Ensure there's a separate summary node placed as a sibling so we can use CSS Grid at the outer level.
      const meta=$("matchPagination")?.parentElement; // .match-table-meta-bottom
      if(meta){
        let sum=meta.querySelector('.match-pagination-summary');
        if(!sum){ sum=document.createElement('div'); sum.className='match-pagination-summary'; meta.insertBefore(sum, meta.firstChild); }
        sum.textContent=summaryText;
      }
      // Render only the center pagination controls inside the pagination container
      pagEl.innerHTML=`<div class="match-footer-center">${centerHtml}</div>`;
      // keep #matchPageSize in place (original DOM); CSS grid will align it to the right visually
    }
 $("matchRows").innerHTML=paged.length?paged.map(m=>`<tr class="match-result-row result-${String(m.result||"").toLowerCase()}"><td><span class="match-number">${m.no}</span></td><td><span class="result-pill ${String(m.result||"").toLowerCase()}">${escapeHtml(m.result||"—")}</span></td><td><div class="table-agent"><span>${(m.agent||"?").slice(0,2).toUpperCase()}</span><b>${escapeHtml(m.agent||"—")}</b></div></td><td><b>${escapeHtml(m.map||"—")}</b></td><td><strong class="score-cell">${m.myScore}<i>:</i>${m.enemyScore}</strong></td><td>${m.kills??"—"} / ${m.deaths??"—"} / ${m.assists??"—"}</td><td>${(m.kills==null||m.deaths==null)?"—":(Number(m.deaths)?(Number(m.kills)/Number(m.deaths)).toFixed(2):Number(m.kills).toFixed(2))}</td><td>${m.acs??"—"}</td><td class="${Number(m.ddDelta)>=0?"pos":"neg"}">${m.ddDelta==null?"—":`${Number(m.ddDelta)>=0?"+":""}${m.ddDelta}`}</td><td class="${m.rrChange==null?"muted":(Number(m.rrChange)>=0?"pos":"neg")}"><b>${m.rrChange==null?"—":`${Number(m.rrChange)>=0?"+":""}${Number(m.rrChange)}`}</b></td><td><div class="match-action-group"><button class="match-action edit-match-btn" type="button" data-edit-match="${m.no}">Edit</button><button class="match-action delete-match-btn" type="button" data-delete-match="${m.no}">Delete</button></div></td></tr>`).join(""):(total?'<tr><td colspan="11" class="muted">No matches match the current filters.</td></tr>':'<tr><td colspan="11" class="muted">No matches yet.</td></tr>');
}

function finiteVals(ms,key){return ms.map(m=>m[key]).filter(v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))).map(Number)}
function summariesByAgent(ms=analyticsMatches()){
 const o={};ms.forEach(m=>{const n=m.agent||"Unknown";if(!o[n])o[n]={agent:n,m:0,w:0,k:0,d:0,a:0,adr:[],acs:[],dda:[],maps:{}};const x=o[n];x.m++;if(m.result==="Win")x.w++;x.k+=Number(m.kills)||0;x.d+=Number(m.deaths)||0;x.a+=Number(m.assists)||0;if(m.adr!=null)x.adr.push(Number(m.adr));if(m.acs!=null)x.acs.push(Number(m.acs));if(m.ddDelta!=null)x.dda.push(Number(m.ddDelta));if(m.map){x.maps[m.map]??={m:0,w:0};x.maps[m.map].m++;if(m.result==="Win")x.maps[m.map].w++}});
 const av=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
 return Object.values(o).map(x=>({...x,wr:x.m?x.w/x.m*100:0,kd:x.d?x.k/x.d:x.k,adrA:av(x.adr),acsA:av(x.acs),ddaA:av(x.dda),best:Object.entries(x.maps).sort((a,b)=>(b[1].w/b[1].m)-(a[1].w/a[1].m)||b[1].m-a[1].m)[0]})).sort((a,b)=>b.m-a.m||b.wr-a.wr)
}
function renderAccuracyPanel(){
 const el=$("accuracyPanel");if(!el)return;const ms=analyticsMatches().filter(m=>m.hs!==null&&m.hs!==undefined&&m.hs!==""&&Number.isFinite(Number(m.hs))),vals=ms.map(m=>Number(m.hs)),labels=ms.map(m=>m.no),v=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
 const expandingAvg=vals.map((_,i)=>vals.slice(0,i+1).reduce((sum,n)=>sum+n,0)/(i+1));
 el.innerHTML=`<div class="accuracy-hero"><div class="accuracy-ring" style="--pct:${Math.min(100,v)}"><div><b>${v.toFixed(1)}%</b><span>AVG HS%</span></div></div><div class="accuracy-copy"><strong>${vals.length}</strong><span>matches in view</span><small>Chart follows actual Match History IDs. Change the analytics range to zoom in or out.</small></div></div>${vals.length?'<div class="accuracy-legend"><span><i class="legend-dot actual"></i>Recorded HS%</span><span><i class="legend-line average"></i>Expanding average</span></div>':''}<div class="accuracy-chart">${vals.length?lineSVG(vals,x=>`${x.toFixed(0)}%`,labels,{values:expandingAvg,label:"Expanding average"}):'<div class="empty">Add HS% to build this chart.</div>'}</div>`;
}
function renderRolePanel(){
 const el=$("rolePanel");if(!el)return;const groups={Sentinel:[],Controller:[],Initiator:[],Duelist:[]};analyticsMatches().forEach(m=>{const r=agentRoles[m.agent];if(r)groups[r].push(m)});
 el.innerHTML=Object.entries(groups).map(([r,ms])=>{const w=ms.filter(m=>m.result==="Win").length,k=ms.reduce((s,m)=>s+(Number(m.kills)||0),0),d=ms.reduce((s,m)=>s+(Number(m.deaths)||0),0),a=ms.reduce((s,m)=>s+(Number(m.assists)||0),0),wr=ms.length?w/ms.length*100:0,kd=d?k/d:k;return `<div class="role-row"><div class="role-icon">${r.slice(0,2).toUpperCase()}</div><div class="role-main"><span>${r}</span><b>${ms.length?`WR ${wr.toFixed(1)}%`:"No matches"}</b><small>${w}W · ${ms.length-w}L</small></div><div class="role-kda"><b>${ms.length?`K/D ${kd.toFixed(2)}`:"—"}</b><small>${k} / ${d} / ${a}</small></div><div class="role-meter"><i style="width:${wr}%"></i></div></div>`}).join("");
}
function renderTopAgents(){
 const el=$("topAgentsTable");if(!el)return;const rows=summariesByAgent();if(!rows.length){el.innerHTML='<div class="empty">No agent data yet.</div>';return}
 el.innerHTML=`<div class="agent-table-head"><span>Agent</span><span>Matches</span><span>Win %</span><span>K/D</span><span>ADR</span><span>ACS</span><span>DDΔ</span><span>Best map</span></div>${rows.map((x,i)=>{const b=x.best,bwr=b?b[1].w/b[1].m*100:0;return `<div class="agent-table-row ${i===0?"featured":""}"><div class="agent-name-cell"><div class="agent-portrait-fallback">${x.agent.slice(0,2).toUpperCase()}</div><div><b>${x.agent}</b><small>${x.m} match${x.m===1?"":"es"}</small></div></div><b>${x.m}</b><b>${x.wr.toFixed(1)}%</b><b>${x.kd.toFixed(2)}</b><b>${x.adrA==null?"—":x.adrA.toFixed(1)}</b><b>${x.acsA==null?"—":x.acsA.toFixed(1)}</b><b class="${(x.ddaA||0)>=0?"pos":"neg"}">${x.ddaA==null?"—":`${x.ddaA>=0?"+":""}${x.ddaA.toFixed(1)}`}</b><div class="best-map"><b>${b?b[0]:"—"}</b><small>${b?`${bwr.toFixed(0)}% WR`:""}</small></div></div>`}).join("")}`;
}
function renderAnalyticsStrip(){
 const el=$("analyticsStrip");if(!el)return;const ms=analyticsMatches();
 const wins=ms.filter(m=>m.result==="Win").length,wr=ms.length?wins/ms.length*100:0;
 const k=ms.reduce((s,m)=>s+(Number(m.kills)||0),0),d=ms.reduce((s,m)=>s+(Number(m.deaths)||0),0),kd=d?k/d:k;
 const viewAvg=k=>{const vals=finiteVals(ms,k);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0};
 const adr=viewAvg("adr"),acs=viewAvg("acs"),dda=viewAvg("ddDelta");
 const items=[["Win %",`${wr.toFixed(1)}%`],["K/D",kd.toFixed(2)],["ADR",adr.toFixed(1)],["ACS",acs.toFixed(1)],["DDΔ",`${dda>=0?"+":""}${dda.toFixed(1)}`],["Matches",String(ms.length)]];
 const meters=[wr,Math.min(100,kd/2*100),Math.min(100,adr/200*100),Math.min(100,acs/300*100),Math.min(100,Math.max(0,(dda+100)/2)),Math.min(100,ms.length/Math.max(1,countedMatches().length)*100)]; el.innerHTML=items.map(([l,v],i)=>`<div class="strip-metric"><span>${l}</span><b>${v}</b><div class="mini-meter"><i style="width:${meters[i]}%"></i></div></div>`).join("");
}
function renderDist(key,id){
 const scope=analyticsMatches(),c={};scope.forEach(m=>c[m[key]]=(c[m[key]]||0)+1);const total=scope.length||1,arr=Object.entries(c).sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
 if(!arr.length){$(id).innerHTML='<div class="empty">No data yet.</div>';return}
 const cls=key==="agent"?"agent":"map";
 $(id).innerHTML=arr.map(([n,v])=>{const mark=key==="agent"?n.slice(0,2).toUpperCase():n[0].toUpperCase(),matches=scope.filter(m=>m[key]===n),wins=matches.filter(m=>m.result==="Win").length,wr=wins/matches.length*100;return `<div class="${cls}-card"><div class="${cls}-avatar">${mark}</div><div class="entity-copy"><b>${n}</b><span>${v} match${v===1?"":"es"} · ${(v/total*100).toFixed(0)}% usage</span></div><div class="entity-metric"><b>${wr.toFixed(0)}%</b><span>WIN RATE</span></div></div>`}).join("");
}
function streaks(){
 let bestW=0,bestL=0,cw=0,cl=0,curS=0,curType="";
 analyticsMatches().forEach(m=>{if(m.result==="Win"){cw++;cl=0;bestW=Math.max(bestW,cw)}else if(m.result==="Loss"){cl++;cw=0;bestL=Math.max(bestL,cl)}else{cw=cl=0}});
 const scoped=analyticsMatches(); for(let i=scoped.length-1;i>=0;i--){let r=scoped[i].result;if(!["Win","Loss"].includes(r))break;if(!curType)curType=r;if(r!==curType)break;curS++}
 return {bestW,bestL,curS,curType};
}
function comboInsight(){
 const groups={};
 analyticsMatches().forEach(m=>{
  const agent=String(m.agent||"").trim(),map=String(m.map||"").trim();
  if(!agent||!map)return;
  const key=`${agent} × ${map}`;
  groups[key]??={label:key,n:0,w:0,k:0,d:0};
  const x=groups[key];x.n++;if(m.result==="Win")x.w++;x.k+=Number(m.kills)||0;x.d+=Number(m.deaths)||0;
 });
 const eligible=Object.values(groups).filter(v=>v.n>=3).map(v=>({...v,wr:v.w/v.n*100,kd:v.d?v.k/v.d:v.k}));
 if(eligible.length===0)return {count:0,best:null,worst:null,only:null,bestTies:[],worstTies:[]};
 if(eligible.length===1)return {count:1,best:null,worst:null,only:eligible[0],bestTies:[],worstTies:[]};
 // Best/worst is outcome-first. Sample size is the confidence tie-breaker; K/D is
 // only used when both WR and sample size are identical. Anything still equal is
 // reported as a true tie instead of manufacturing a winner from unrelated stats.
 const bestRanked=[...eligible].sort((a,b)=>b.wr-a.wr||b.n-a.n||b.kd-a.kd||a.label.localeCompare(b.label));
 const worstRanked=[...eligible].sort((a,b)=>a.wr-b.wr||b.n-a.n||a.kd-b.kd||a.label.localeCompare(b.label));
 const sameRank=(a,b)=>Math.abs(a.wr-b.wr)<1e-12&&a.n===b.n&&Math.abs(a.kd-b.kd)<1e-12;
 const best=bestRanked[0],worst=worstRanked[0];
 const bestTies=bestRanked.filter(x=>sameRank(x,best));
 const worstTies=worstRanked.filter(x=>sameRank(x,worst));
 return {count:eligible.length,best,worst,only:null,bestTies,worstTies};
}
function renderInsights(){
 const s=streaks(),c=comboInsight(),ms=analyticsMatches(),rrVals=ms.map(m=>optionalNumber(m.rrChange)).filter(v=>v!==null),rr=rrVals.length?rrVals.reduce((a,v)=>a+v,0)/rrVals.length:null;
 const streakLabel=s.curS?(s.curType==="Win"?`${s.curS}-win streak`:`${s.curS}-loss streak`):"—";
 const cards=[
  ["Current streak",streakLabel,`Best W: ${s.bestW} · Best L: ${s.bestL}`],
  ["RR / match",rr===null?"—":`${rr>=0?"+":""}${rr.toFixed(1)}`,rr===null?`RR not recorded · 0 of ${ms.length} matches`:`${rrVals.length} of ${ms.length} matches with RR`]
 ];
 if(c.count===0){
  cards.push(["Best combo","Waiting for qualification","0 of 2 qualified combos"],["Weakest combo","Waiting for qualification","0 of 2 qualified combos"]);
 }else if(c.count===1){
  cards.push(["Best combo","Waiting for comparison","1 of 2 qualified combos"],["Weakest combo","Waiting for comparison","1 of 2 qualified combos"]);
 }else{
  const comboCard=(kind,item,ties)=>{
   const tied=ties.length>1;
   const title=tied?`${ties.length}-way tie`:item.label;
   const stats=`${item.n} matches · ${item.wr.toFixed(0)}% WR · ${item.kd.toFixed(2)} K/D`;
   const detail=tied?`${stats} · ${ties.map(x=>x.label).join(" / ")}`:stats;
   return [kind,title,detail];
  };
  cards.push(comboCard("Best combo",c.best,c.bestTies),comboCard("Weakest combo",c.worst,c.worstTies));
 }
 $("insights").innerHTML=cards.map(x=>`<div class="insight"><span>${escapeHtml(x[0])}</span><b>${escapeHtml(x[1])}</b><small>${escapeHtml(x[2])}</small></div>`).join("");
}
function challengeComplete(c){return challengeProgress(c).isComplete;}
function renderArchive(){
 const all=[...activeChallenges.map(c=>({...c,_active:true})),...archives.map(c=>({...c,_active:false}))];
 $("challengeArchive").innerHTML=all.length?all.map(c=>{
   const isActive=c._active;
   const archiveIndex=isActive?-1:archives.findIndex(x=>x.id===c.id);
   const selected=isActive&&data&&c.id===data.id,completed=challengeComplete(c);
   const status=completed?"COMPLETED":(isActive?(selected?"ACTIVE · OPEN":"ACTIVE"):"ARCHIVED");
   const exportBtn=completed?`<button class="ghost report-export-btn" type="button" onclick="openChallengeReport('${c.id}')">Export report</button>`:"";
   return `<div class="challenge-item ${selected?"selected-challenge":""} ${completed?"completed-challenge":""}"><div><span class="status ${completed?"completed":(isActive?"":"archived")}">${status}</span><h3>${c.name}</h3><p>${challengeProgressText(c,{history:true})} · ${c.startRank} → target ${c.targetRank||"No target"}</p></div><div class="actions">${exportBtn}${isActive
    ? `<button class="ghost" type="button" onclick="openActiveChallenge('${c.id}')">Open</button><button class="ghost" type="button" onclick="archiveActiveChallenge('${c.id}')">Archive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteActiveById('${c.id}')">Delete</button>`
    : `<button class="ghost" type="button" onclick="unarchiveChallenge(${archiveIndex})">Unarchive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteArchivedChallenge(${archiveIndex})">Delete</button>`}</div></div>`;
 }).join(""):'<div class="card empty">No challenges yet.</div>';
}
function findChallengeById(id){return activeChallenges.find(c=>c.id===id)||archives.find(c=>c.id===id)||null;}
function reportValue(v,suffix=""){const n=optionalNumber(v);return n===null?"—":`${n}${suffix}`;}
function challengeReportStats(c){
 const ms=(c.matches||[]).slice().sort((a,b)=>Number(a.no)-Number(b.no)), wins=ms.filter(m=>m.result==="Win").length,losses=ms.filter(m=>m.result==="Loss").length,draws=ms.filter(m=>m.result==="Draw").length;
 const nums=k=>ms.map(m=>optionalNumber(m[k])).filter(v=>v!==null), av=k=>{const a=nums(k);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
 const kills=nums("kills").reduce((a,b)=>a+b,0),deaths=nums("deaths").reduce((a,b)=>a+b,0),rr=nums("rrChange");
 return {ms,wins,losses,draws,wr:ms.length?wins/ms.length*100:0,kd:deaths?kills/deaths:(kills||null),acs:av("acs"),adr:av("adr"),dda:av("ddDelta"),kast:av("kast"),hs:av("hs"),netRR:rr.length?rr.reduce((a,b)=>a+b,0):null,finalRank:ms.at(-1)?.rankAfter||c.startRank,finalRR:optionalNumber(ms.at(-1)?.rrAfter)};
}
function downloadText(filename,text,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
function csvCell(v){const x=v===null||v===undefined?"":String(v);return `"${x.replace(/"/g,'""')}"`;}
window.exportChallengeCSV=function(id){const c=findChallengeById(id);if(!c)return;const fields=["no","agent","map","result","myScore","enemyScore","rankStatus","rankAfter","kills","deaths","assists","acs","adr","ddDelta","hs","kast","rrAfter","rrChange","firstKills","firstDeaths","multiKills","rounds","notes"];const rows=[fields.join(","),...(c.matches||[]).slice().sort((a,b)=>a.no-b.no).map(m=>fields.map(k=>csvCell(m[k])).join(","))];downloadText(`${(c.name||"challenge").replace(/[^a-z0-9_-]+/gi,"-")}-matches.csv`,rows.join("\n"),"text/csv;charset=utf-8");};
window.exportChallengeJSON=function(id){const c=findChallengeById(id);if(!c)return;downloadText(`${(c.name||"challenge").replace(/[^a-z0-9_-]+/gi,"-")}-report.json`,JSON.stringify({exportedAt:new Date().toISOString(),challenge:c,analytics:challengeReportStats(c)},null,2),"application/json");};
window.openChallengeReport=function(id){
 const c=findChallengeById(id);if(!c||!challengeComplete(c))return;const s=challengeReportStats(c),esc=x=>String(x??"").replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
 const rows=s.ms.map(m=>`<tr><td>#${m.no}</td><td>${esc(m.result)}</td><td>${esc(m.agent)}</td><td>${esc(m.map)}</td><td>${esc(m.myScore)}–${esc(m.enemyScore)}</td><td>${reportValue(m.kills)}/${reportValue(m.deaths)}/${reportValue(m.assists)}</td><td>${reportValue(m.acs)}</td><td>${reportValue(m.adr)}</td><td>${reportValue(m.ddDelta)}</td><td>${reportValue(m.hs,"%")}</td><td>${reportValue(m.kast,"%")}</td><td>${reportValue(m.rrChange," RR")}</td></tr>`).join("");
 const group=(key)=>Object.entries(s.ms.reduce((o,m)=>{const n=m[key]||"Unknown";o[n]??={n:0,w:0,k:0,d:0};o[n].n++;if(m.result==="Win")o[n].w++;o[n].k+=Number(m.kills)||0;o[n].d+=Number(m.deaths)||0;return o;},{})).sort((a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0])); const groupRows=key=>group(key).map(([n,v])=>`<tr><td>${esc(n)}</td><td>${v.n}</td><td>${(v.w/v.n*100).toFixed(1)}%</td><td>${v.d?(v.k/v.d).toFixed(2):(v.k||"—")}</td></tr>`).join("");
 const html=`<!doctype html><html><head><title>${esc(c.name)} — Challenge report</title><style>body{font:14px system-ui;margin:32px;color:#16191d}h1{margin-bottom:4px}.muted{color:#68727c}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.k{border:1px solid #d8dde2;border-radius:8px;padding:12px}.k b{display:block;font-size:20px;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}button{padding:10px 14px;margin-right:8px}@media print{button{display:none}.grid{grid-template-columns:repeat(4,1fr)}body{margin:12mm}}</style></head><body><button onclick="print()">Print / Save as PDF</button><button onclick="opener.exportChallengeCSV('${c.id}')">Export match CSV</button><button onclick="opener.exportChallengeJSON('${c.id}')">Export full JSON</button><h1>${esc(c.name)}</h1><div class="muted">Completed challenge report · ${esc(challengeProgressText(c,{history:true}))} · ${esc(c.startRank)} → ${esc(s.finalRank)}</div><div class="grid"><div class="k">Record<b>${s.wins}W · ${s.losses}L · ${s.draws}D</b></div><div class="k">Win rate<b>${s.wr.toFixed(1)}%</b></div><div class="k">K/D<b>${s.kd===null?"—":s.kd.toFixed(2)}</b></div><div class="k">Net RR<b>${s.netRR===null?"—":`${s.netRR>=0?"+":""}${s.netRR}`}</b></div><div class="k">ACS<b>${s.acs===null?"—":s.acs.toFixed(1)}</b></div><div class="k">ADR<b>${s.adr===null?"—":s.adr.toFixed(1)}</b></div><div class="k">DDΔ<b>${s.dda===null?"—":s.dda.toFixed(1)}</b></div><div class="k">KAST / HS<b>${s.kast===null?"—":s.kast.toFixed(1)+"%"} / ${s.hs===null?"—":s.hs.toFixed(1)+"%"}</b></div></div><h2>Detailed analytics</h2><div class="grid"><div><h3>Agents</h3><table><thead><tr><th>Agent</th><th>Matches</th><th>WR</th><th>K/D</th></tr></thead><tbody>${groupRows("agent")}</tbody></table></div><div><h3>Maps</h3><table><thead><tr><th>Map</th><th>Matches</th><th>WR</th><th>K/D</th></tr></thead><tbody>${groupRows("map")}</tbody></table></div></div><h2>Match history</h2><table><thead><tr><th>Match</th><th>Result</th><th>Agent</th><th>Map</th><th>Score</th><th>K/D/A</th><th>ACS</th><th>ADR</th><th>DDΔ</th><th>HS</th><th>KAST</th><th>RR</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
 const w=window.open("","_blank");if(!w){showAppNotice("Allow pop-ups to open the printable challenge report.","Report blocked");return;}w.document.write(html);w.document.close();
};
window.showChallengeExportMenu=function(id){openChallengeReport(id);};

window.openActiveChallenge=(id)=>{
 const chosen=activeChallenges.find(c=>c.id===id);if(!chosen)return;
 data=chosen;persist();render();showPage("overview");
};
window.archiveActiveChallenge=async (id)=>{
 const challenge=activeChallenges.find(c=>c.id===id);if(!challenge)return;
 if(!await appConfirm({title:`Archive "${challenge.name}"?`,message:"It will leave your active challenges and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 activeChallenges=activeChallenges.filter(c=>c.id!==id);
 archives.unshift({...challenge,archivedAt:new Date().toISOString()});
 if(data&&data.id===id)data=activeChallenges[0]||null;
 persist();render();if(data)showPage("challenges");
};
window.deleteActiveById=async (id)=>{
 const challenge=activeChallenges.find(c=>c.id===id);if(!challenge)return;
 if(!await appConfirm({title:`Delete "${challenge.name}"?`,message:"This permanently removes the active challenge and all of its match data.",confirmText:"Delete permanently",kicker:"DELETE CHALLENGE"}))return;
 activeChallenges=activeChallenges.filter(c=>c.id!==id);
 if(data&&data.id===id)data=activeChallenges[0]||null;
 persist();render();if(data)showPage("challenges");
};
window.deleteActiveChallenge=async ()=>{
 if(!data)return;
 const id=data.id;
 await deleteActiveById(id);
 closeChallengeOptions();
};
window.deleteArchivedChallenge=async (archiveIndex)=>{
 const challenge=archives[archiveIndex];if(!challenge)return;
 if(!await appConfirm({title:`Delete "${challenge.name}"?`,message:"This permanently removes this archived challenge and all of its match data. This cannot be undone.",confirmText:"Delete permanently",kicker:"DELETE ARCHIVE"}))return;
 archives.splice(archiveIndex,1);
 try{persist()}catch(err){console.error(err);showAppNotice("Could not update browser storage after deleting the archived challenge.","Storage error");}
 renderArchive();
 renderArchiveBrowser();
 if($("setupArchiveAccess"))$("setupArchiveAccess").classList.toggle("hidden",archives.length===0&&activeChallenges.length===0);
 if(archives.length===0)closeArchiveBrowser();
};
window.archiveCurrent=async ()=>{if(!data)return;await archiveActiveChallenge(data.id);};
window.unarchiveChallenge=async (archiveIndex)=>{
 const restored=archives[archiveIndex];if(!restored)return;
 archives.splice(archiveIndex,1);
 const {archivedAt,...activeChallenge}=restored;
 ensureChallengeId(activeChallenge);
 activeChallenges.push(activeChallenge);
 data=activeChallenge;
 persist();render();showPage("overview");
};
function renderMatrix(){
 const scope=analyticsMatches();
 const usedAgents=[...new Set(scope.map(m=>m.agent).filter(Boolean))],usedMaps=[...new Set(scope.map(m=>m.map).filter(Boolean))];
 if(!usedAgents.length){$("matrix").innerHTML='<div class="empty">Agent × map combinations appear here after matches are added.</div>';return}
 let head=`<div class="matrix" style="--cols:${usedMaps.length}"><div class="matrix-row"><b>Agent</b>${usedMaps.map(x=>`<b class="cell">${escapeHtml(x)}</b>`).join("")}</div>`;
 usedAgents.forEach(a=>{head+=`<div class="matrix-row"><b>${escapeHtml(a)}</b>${usedMaps.map(mp=>{const x=scope.filter(m=>m.agent===a&&m.map===mp),w=x.filter(m=>m.result==="Win").length,kVals=x.map(m=>optionalNumber(m.kills)),dVals=x.map(m=>optionalNumber(m.deaths)),hasKD=kVals.every(v=>v!==null)&&dVals.every(v=>v!==null),k=hasKD?kVals.reduce((sum,v)=>sum+v,0):null,d=hasKD?dVals.reduce((sum,v)=>sum+v,0):null,kd=hasKD?(d?k/d:k):null;return x.length?`<div class="cell ${x.length>=3?"qualified-combo":""}"><strong>${(w/x.length*100).toFixed(0)}% WR</strong><span>${x.length}M · ${kd===null?"—":kd.toFixed(2)} KD</span>${x.length>=3?`<em class="combo-qualified" title="Qualified: 3+ matches" aria-label="Qualified combination">Q</em>`:""}</div>`:`<div class="cell"><span>—</span></div>`}).join("")}</div>`});
 $("matrix").innerHTML=head+"</div>";
}

if($("startRank"))$("startRank").addEventListener("change",()=>{updateTargetRankOptions();syncStartingRRState();});
updateTargetRankOptions();syncStartingRRState();
if($("challengeForm"))$("challengeForm").addEventListener("submit",e=>{
 e.preventDefault();e.stopPropagation();
 const selectedStart=$("startRank").value;
 const selectedTarget=$("targetRank").value;
 if(selectedTarget && rankIndex(selectedTarget)<=rankIndex(selectedStart)){
   showAppNotice("Target rank must be higher than the current / starting rank, or choose No target.","Check challenge");
   updateTargetRankOptions();
   return;
 }
 const name=$("challengeName").value.trim();
 const target=Number($("targetMatches").value);
 const startRank=$("startRank").value;
 const targetRank=$("targetRank").value;
 const rrRaw=$("startRR").value;
 if(!name){showAppNotice("Enter a challenge name.","Challenge details");return;}
 if(!target || target<1){showAppNotice("Enter the number of matches to track.","Challenge details");return;}
 if(!startRank){showAppNotice("Select your current / starting rank.","Challenge details");return;}
 
 let rr=null;
 if(!isUnranked(startRank)){
  if(rrRaw===""){showAppNotice("Enter your starting RR.","Challenge details");return;}
  rr=Number(rrRaw);
  if(!Number.isFinite(rr)||rr<0||rr>100){showAppNotice("Starting RR must be between 0 and 100.","Challenge details");return;}
 }

 const nextChallenge=ensureChallengeId({name,target,startRank,startRR:rr,targetRank:targetRank||null,description:$("description").value.trim(),matches:[]});
 const previous=data;
 activeChallenges.push(nextChallenge);
 data=nextChallenge;
 try{
   persist();
 }catch(err){
   activeChallenges=activeChallenges.filter(c=>c.id!==nextChallenge.id);
   data=previous;
   console.error("Storage write failed:",err);
   const reason=err && err.name==="QuotaExceededError"
     ?"Browser storage is full. Export/delete older local data and try again."
     :"Browser storage is unavailable. Make sure this page is not running in a restricted/private file context.";
   showAppNotice(`Could not save the challenge. ${reason}`,"Challenge not saved");
   return;
 }
 render();
 showPage("overview");
 showToast("Challenge created.");
});

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

if($("matchForm"))$("matchForm").onsubmit=e=>{
 e.preventDefault();clearValidationErrors();
 const saveBtn=$("saveMatchBtn");
 const originalText=saveBtn?.textContent||"Save match";
 const finish=()=>{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent=originalText;saveBtn.removeAttribute("aria-busy")}};
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Checking…";saveBtn.setAttribute("aria-busy","true")}
 try{
  const value=id=>String($(id)?.value??"").trim();
  const number=id=>Number(value(id));
  const nullable=id=>{const raw=value(id);if(raw==="")return null;const v=Number(raw);return Number.isFinite(v)?v:null};
  const edit=Number(value("editNo")||0),requestedNo=Number(value("matchNo"));
  const errors=[];
  if(!Number.isInteger(requestedNo)||requestedNo<1)errors.push("Match number must be a positive whole number.");
  // Only actual records in the currently open challenge reserve a Match #.
  // Challenge progress, archived challenges, deleted IDs and missing numeric gaps do not.
  const duplicateMatch=matchNumberExists(requestedNo,edit||null);
  if(duplicateMatch){
   const duplicateMessage=`Match #${requestedNo} already exists. Choose an unused match number.`;
   // Use both the modal's own validation surface and the normal app toast.
   // The inline message guarantees the feedback remains visible inside the open Add/Edit Match modal.
   showValidationErrors([duplicateMessage]);
   showToast(duplicateMessage,"error");
   const matchNoField=$("matchNo");
   if(matchNoField){
    matchNoField.setAttribute("aria-invalid","true");
    matchNoField.focus({preventScroll:true});
    matchNoField.select?.();
    const clearDuplicateState=()=>{
     matchNoField.removeAttribute("aria-invalid");
     clearValidationErrors();
     matchNoField.removeEventListener("input",clearDuplicateState);
    };
    matchNoField.addEventListener("input",clearDuplicateState);
   }
   return;
  }
  const earlier=countedMatches().filter(x=>Number(x.no)<requestedNo && Number(x.no)!==edit).sort((a,b)=>Number(a.no)-Number(b.no));
  const previous=earlier.at(-1)||{rankAfter:data.startRank,rrAfter:data.startRR};
  if(!value("agent"))errors.push("Select the agent played.");
  if(!value("map"))errors.push("Select the map played.");
  if(!value("rankAfter"))errors.push("Select the rank after the match.");
  if(value("rankAfter")){
   const rankErr=validateRankTransition(previous.rankAfter,value("rankAfter"),value("rankStatus"));
   if(rankErr)errors.push(rankErr);
  }
  const my=number("myScore"),enemy=number("enemyScore"),result=value("result"),rounds=number("rounds");
  if(!Number.isFinite(my)||!Number.isFinite(enemy))errors.push("Both score values are required numbers.");
  else{
   if(my===0&&enemy===0)errors.push("A completed match cannot have a 0–0 score.");
   if(result==="Win"&&my<=enemy)errors.push("For a Win, your score must be higher than the enemy score.");
   if(result==="Loss"&&my>=enemy)errors.push("For a Loss, your score must be lower than the enemy score.");
   if(result==="Draw"&&my!==enemy)errors.push("For a Draw, both scores must be equal.");
   const expectedRounds=my+enemy;
   if(!Number.isFinite(rounds)||rounds!==expectedRounds)errors.push(`Rounds played must match the score: ${my}–${enemy} equals ${expectedRounds} rounds.`);
  }
  [["HS %","hs"],["KAST %","kast"]].forEach(([label,id])=>{const v=nullable(id);if(v!==null&&(v<0||v>100))errors.push(`${label} must be between 0 and 100.`)});
  [["Kills","kills"],["Deaths","deaths"],["Assists","assists"],["ACS","acs"],["ADR","adr"],["First kills","firstKills"],["First deaths","firstDeaths"],["Multi kills","multiKills"]].forEach(([label,id])=>{const v=nullable(id);if(v!==null&&v<0)errors.push(`${label} cannot be negative.`)});
  let rrAfter=nullable("rrAfter"),rrChange=nullable("rrChange");
  if(isUnranked(value("rankAfter"))){rrAfter=null;rrChange=null;}
  if(rrAfter!==null&&(rrAfter<0||rrAfter>100))errors.push("RR after match must be between 0 and 100.");
  if(rrChange!==null&&value("rankStatus")==="Promoted"&&rrChange<=0)errors.push("Promoted requires a positive RR change when RR change is entered.");
  if(rrChange!==null&&value("rankStatus")==="Demoted"&&rrChange>=0)errors.push("Demoted requires a negative RR change when RR change is entered.");
  if(errors.length){showValidationErrors(errors);return;}

  const m={
   no:requestedNo,date:edit?(data.matches.find(x=>Number(x.no)===edit)?.date||new Date().toISOString()):new Date().toISOString(),
   agent:value("agent"),map:value("map"),result,rankAfter:value("rankAfter"),rankStatus:value("rankStatus"),
   rrAfter,rrChange,myScore:my,enemyScore:enemy,
   kills:nullable("kills"),deaths:nullable("deaths"),assists:nullable("assists"),ddDelta:nullable("ddDelta"),hs:nullable("hs"),acs:nullable("acs"),adr:nullable("adr"),kast:nullable("kast"),
   firstKills:nullable("firstKills"),firstDeaths:nullable("firstDeaths"),multiKills:nullable("multiKills"),rounds,notes:value("notes")
  };
  const beforeMatches=data.matches.slice();
  if(edit){const idx=data.matches.findIndex(x=>Number(x.no)===edit);if(idx<0){showValidationErrors(["That match could not be found."]);return}data.matches[idx]=m}else data.matches.push(m);
  data.matches.sort((a,b)=>Number(a.no)-Number(b.no));
  if(!persist()){data.matches=beforeMatches;throw new Error("Browser storage rejected the save.")}
  try{render();showPage("matches")}catch(err){console.error("Match saved; UI refresh failed:",err)}
  closeModal();showToast(edit?"Match changes saved.":`Match #${requestedNo} saved.`);
 }catch(err){
  console.error("Match save failed:",err);
  showValidationErrors([err?.message||"An unexpected error stopped the match from saving. Please try again."]);
 }finally{finish()}
};

function openChallengeOptions(){if(data)$("challengeModal").classList.remove("hidden")}
function closeChallengeOptions(){$("challengeModal").classList.add("hidden")}
if($("challengeSettingsBtn"))$("challengeSettingsBtn").onclick=openChallengeOptions;
document.querySelectorAll("[data-challenge-close]").forEach(x=>x.onclick=closeChallengeOptions);
if($("resetChallengeBtn"))$("resetChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:"Reset this challenge?",message:"All matches in the active challenge will be removed and its progress will return to the starting rank and RR.",confirmText:"Reset challenge",kicker:"RESET CHALLENGE"}))return;
 if(data){data.matches=[];persist()}closeChallengeOptions();render();
};
if($("deleteActiveChallengeBtn"))$("deleteActiveChallengeBtn").onclick=()=>deleteActiveChallenge();
if($("archiveChallengeBtn"))$("archiveChallengeBtn").onclick=async ()=>{
 if(!data)return;
 if(!await appConfirm({title:`Archive "${data.name}"?`,message:"The challenge will move to your archive and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 archives.unshift({...data,archivedAt:new Date().toISOString()});data=null;persist();closeChallengeOptions();render();
};
if($("viewArchivedBtn"))$("viewArchivedBtn").onclick=openArchiveBrowser;
document.querySelectorAll("[data-archive-browser-close]").forEach(x=>x.onclick=closeArchiveBrowser);
document.addEventListener("click",async e=>{
 const btn=e.target.closest("[data-restore-archive]");if(!btn)return;
 const idx=Number(btn.dataset.restoreArchive),restored=archives[idx];if(!restored)return;
 archives.splice(idx,1);
 const {archivedAt,...activeChallenge}=restored;ensureChallengeId(activeChallenge);
 activeChallenges.push(activeChallenge);data=activeChallenge;
 persist();closeArchiveBrowser();render();showPage("overview");
});

if($("restoreInput")) $("restoreInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const p=JSON.parse(await f.text());if(!("archives" in p))throw new Error();if(!await appConfirm({title:"Confirm action",message:String("Restore this backup? Current local tracker data will be replaced."),confirmText:"Confirm"}))return;activeChallenges=Array.isArray(p.activeChallenges)?p.activeChallenges:(p.activeChallenge?[p.activeChallenge]:[]);
activeChallenges.forEach(ensureChallengeId);
archives.forEach(ensureChallengeId);
data=p.activeChallenge||activeChallenges[0]||null;
if(data)ensureChallengeId(data);
archives=Array.isArray(p.archives)?p.archives:[];archives.forEach(ensureChallengeId);
persist();render();showToast("Backup restored.");}catch{showAppNotice("The selected file is not a valid tracker backup.","Import failed");}finally{e.target.value=""}};
if($("trendMetric"))$("trendMetric").onchange=()=>data&&renderMetricChart();
if($("trendRange"))$("trendRange").onchange=()=>data&&renderMetricChart();
if($("analyticsRange"))$("analyticsRange").onchange=()=>{if(!data)return;renderAnalyticsStrip();renderAccuracyPanel();renderRolePanel();renderTopAgents();renderDist("agent","agentDist");renderDist("map","mapDist");renderWinBars("agent","agentWinBars");renderWinBars("map","mapWinBars");renderComparison();renderInsights();renderMatrix();if(window.renderTopMaps)window.renderTopMaps();};
try{
 const testKey="vct_storage_test";
 localStorage.setItem(testKey,"1");localStorage.removeItem(testKey);
}catch(err){
 const n=$("storageNotice");
 if(n){n.textContent="Local browser storage appears restricted. Challenge data may not persist until storage is available.";n.classList.remove("hidden")}
 console.warn("Storage health check failed",err);
}



let pendingMatchImport=[];

function parseDelimited(text,delimiter=","){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===delimiter&&!quoted){row.push(cell);cell="";continue}
  if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&next==="\n")i++;
   row.push(cell);cell="";
   if(row.some(v=>String(v).trim()!==""))rows.push(row);
   row=[];continue
  }
  cell+=ch;
 }
 row.push(cell);if(row.some(v=>String(v).trim()!==""))rows.push(row);
 return rows;
}
function normHeader(v){return String(v||"").toLowerCase().replace(/[%Δ]/g,m=>m==="%"?"percent":"delta").replace(/[^a-z0-9]+/g,"").trim()}
const importHeaderMap={
 match:"no",no:"no",date:"date",result:"result",agent:"agent",map:"map",
 myscore:"myScore",yourscore:"myScore",score:"score",enemyscore:"enemyScore",
 rankafter:"rankAfter",rankstatus:"rankStatus",rrafter:"rrAfter",currentrr:"rrAfter",rrchange:"rrChange",rr:"rrChange",
 kills:"kills",deaths:"deaths",assists:"assists",dddelta:"ddDelta",dda:"ddDelta",
 hspercent:"hs",hs:"hs",acs:"acs",adr:"adr",kastpercent:"kast",kast:"kast",
 firstkills:"firstKills",firstdeaths:"firstDeaths",multikills:"multiKills",rounds:"rounds",roundsplayed:"rounds",notes:"notes"
};
function blankToNull(v){return v===undefined||v===null||String(v).trim()===""?null:String(v).trim()}
function importNum(v){const x=blankToNull(v);if(x===null)return null;const n=Number(String(x).replace(/^\+/,""));return Number.isFinite(n)?n:NaN}
function normaliseImportedObject(raw){
 const o={};Object.entries(raw||{}).forEach(([k,v])=>{const mapped=importHeaderMap[normHeader(k)]||k;o[mapped]=v});
 if(o.score && (o.myScore==null||o.enemyScore==null)){const m=String(o.score).match(/(\d+)\s*[-:]\s*(\d+)/);if(m){o.myScore=m[1];o.enemyScore=m[2]}}
 return o;
}
function validateImportedMatch(raw,previous,index){
 const o=normaliseImportedObject(raw),errors=[];
 const result=String(o.result||"").trim().toLowerCase();
 const canonicalResult=result==="win"?"Win":result==="loss"?"Loss":result==="draw"?"Draw":"";
 const my=importNum(o.myScore),enemy=importNum(o.enemyScore);
 if(!canonicalResult)errors.push("Result must be Win, Loss or Draw.");
 if(!String(o.agent||"").trim())errors.push("Agent is required.");
 if(!String(o.map||"").trim())errors.push("Map is required.");
 if(!Number.isFinite(my)||!Number.isFinite(enemy))errors.push("Both score values are required numbers.");
 else{
  if(my===0&&enemy===0)errors.push("A completed match cannot be 0–0.");
  if(canonicalResult==="Win"&&my<=enemy)errors.push("Win requires your score to be higher.");
  if(canonicalResult==="Loss"&&my>=enemy)errors.push("Loss requires your score to be lower.");
  if(canonicalResult==="Draw"&&my!==enemy)errors.push("Draw requires equal scores.");
 }
 const rankAfter=String(o.rankAfter||previous?.rankAfter||"").trim();
 let rankStatus=String(o.rankStatus||"").trim();
 let rankStatusAdjusted="";
 if(!ranks.includes(rankAfter))errors.push("Rank After is missing or not recognised.");
 if(previous&&ranks.includes(rankAfter)&&ranks.includes(previous.rankAfter)){
  const beforeIndex=ranks.indexOf(previous.rankAfter),afterIndex=ranks.indexOf(rankAfter);
  const inferred=isUnranked(previous.rankAfter)?(isUnranked(rankAfter)?"Same Rank":"Placed"):(isUnranked(rankAfter)?"Invalid":afterIndex===beforeIndex?"Same Rank":afterIndex>beforeIndex?"Promoted":"Demoted");
  if(inferred!=="Invalid" && (!rankStatus||!["Same Rank","Placed","Promoted","Demoted"].includes(rankStatus)||rankStatus!==inferred)){
   rankStatusAdjusted=rankStatus?`${rankStatus} → ${inferred}`:`Auto: ${inferred}`;
   rankStatus=inferred;
  }
 }else if(!rankStatus){rankStatus="Same Rank"}
 if(!["Same Rank","Placed","Promoted","Demoted"].includes(rankStatus))errors.push("Rank Status must be Same Rank, Placed, Promoted or Demoted.");
 if(previous&&ranks.includes(rankAfter)){
  const re=validateRankTransition(previous.rankAfter,rankAfter,rankStatus);if(re)errors.push(re);
 }
 let rrAfter=importNum(o.rrAfter),rrChange=importNum(o.rrChange);
 if(isUnranked(rankAfter)){rrAfter=null;rrChange=null;}
 if(Number.isNaN(rrAfter)||(rrAfter!==null&&(rrAfter<0||rrAfter>100)))errors.push("RR After must be between 0 and 100 when provided.");
 if(Number.isNaN(rrChange))errors.push("RR Change must be numeric when provided.");
 if(rankStatus==="Promoted"&&rrChange!==null&&Number.isFinite(rrChange)&&rrChange<=0)errors.push("Promoted requires positive RR change when RR Change is provided.");
 if(rankStatus==="Demoted"&&rrChange!==null&&Number.isFinite(rrChange)&&rrChange>=0)errors.push("Demoted requires negative RR change when RR Change is provided.");
 const expected=Number.isFinite(my)&&Number.isFinite(enemy)?my+enemy:null;
 let rounds=importNum(o.rounds);if(rounds===null&&expected!==null)rounds=expected;
 if(expected!==null&&rounds!==expected)errors.push(`Rounds must equal the score total (${expected}).`);
 const nullableKeys=["kills","deaths","assists","acs","adr","firstKills","firstDeaths","multiKills"];
 nullableKeys.forEach(k=>{const v=importNum(o[k]);if(Number.isNaN(v))errors.push(`${k} must be numeric.`);else if(v!==null&&v<0)errors.push(`${k} cannot be negative.`)});
 ["hs","kast"].forEach(k=>{const v=importNum(o[k]);if(Number.isNaN(v)|| (v!==null&&(v<0||v>100)))errors.push(`${k.toUpperCase()} must be between 0 and 100.`)});
 const dd=importNum(o.ddDelta);if(Number.isNaN(dd))errors.push("DDΔ must be numeric.");
 const n=k=>{const v=importNum(o[k]);return v===null?null:v};
 const match={
  no:index,date:blankToNull(o.date)||new Date().toISOString(),result:canonicalResult,
  agent:String(o.agent||"").trim(),map:String(o.map||"").trim(),myScore:my,enemyScore:enemy,
  rankAfter,rankStatus,rrAfter,rrChange,kills:n("kills"),deaths:n("deaths"),assists:n("assists"),
  acs:n("acs"),adr:n("adr"),ddDelta:n("ddDelta"),hs:n("hs"),kast:n("kast"),
  firstKills:n("firstKills"),firstDeaths:n("firstDeaths"),multiKills:n("multiKills"),
  rounds,notes:String(o.notes||"").trim()
 };
 return {match,errors,raw:o,rankStatusAdjusted};
}
function openImportMatchesModal(){$("importMatchesModal").classList.remove("hidden");$("importMatchesModal").setAttribute("aria-hidden","false")}
function closeImportMatchesModal(){$("importMatchesModal").classList.add("hidden");$("importMatchesModal").setAttribute("aria-hidden","true");pendingMatchImport=[]}
document.querySelectorAll("[data-import-close]").forEach(x=>x.addEventListener("click",closeImportMatchesModal));

document.addEventListener("click",e=>{
 const modal=$("importMatchesModal");
 if(!modal||modal.classList.contains("hidden"))return;
 if(e.target.closest("[data-import-close]")){
  e.preventDefault();
  e.stopPropagation();
  closeImportMatchesModal();
 }
});
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!$("importMatchesModal")?.classList.contains("hidden"))closeImportMatchesModal();
});

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
async function readMatchImportFile(file){
 if(!data){showAppNotice("Open a challenge before importing matches.","No active challenge");return}
 if(!file)return;
 try{
  const text=(await file.text()).replace(/^\uFEFF/,"");
  let objects=[];
  if(file.name.toLowerCase().endsWith(".json")||file.type.includes("json")){
   const parsed=JSON.parse(text);
   if(Array.isArray(parsed))objects=parsed;
   else if(Array.isArray(parsed.matches))objects=parsed.matches;
   else if(Array.isArray(parsed.activeChallenge?.matches))objects=parsed.activeChallenge.matches;
   else throw new Error("No matches array found");
  }else{
   const delimiter=file.name.toLowerCase().endsWith(".tsv")?"\t":",";
   const rows=parseDelimited(text,delimiter);
   if(rows.length<2)throw new Error("No data rows found");
   const headers=rows[0];
   objects=rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??""])));
  }
  buildImportPreview(objects);
 }catch(err){
  console.error(err);showAppNotice("The file could not be read as CSV, TSV or compatible JSON. Exported tracker CSV files can be imported directly.","Import failed");
 }
}
if($("importMatchesBtn"))$("importMatchesBtn").addEventListener("click",()=>{if(!data){showAppNotice("Open a challenge before importing matches.","No active challenge");return}$("importMatchesFile").click()});
if($("importMatchesFile"))$("importMatchesFile").addEventListener("change",e=>{const file=e.target.files?.[0];readMatchImportFile(file);e.target.value=""});
async function commitPendingImport(){
 const btn=$("confirmImportMatchesBtn");
 if(!btn)return;
 if(btn.dataset.busy==="1")return;
 if(btn.dataset.mode==="fix"){
  closeImportMatchesModal();
  requestAnimationFrame(()=>$("importMatchesFile")?.click());
  return;
 }
 const valid=pendingMatchImport.filter(x=>!x.errors.length);
 const invalid=pendingMatchImport.filter(x=>x.errors.length);
 const bulk=pendingMatchImport.length>1;
 const readyOnly=bulk ? ($("importReadyOnly")?.checked!==false) : false;
 if(!valid.length)return;
 if(bulk&&invalid.length&&!readyOnly){showAppNotice("Some imported rows still need attention. Enable ‘Import ready only’ to import the valid rows and skip the rest, or fix the file first.","Import blocked");return}
 btn.dataset.busy="1";btn.disabled=true;
 const originalText=btn.textContent;btn.textContent="Importing…";
 const before=data.matches.slice();
 data.matches.push(...valid.map(x=>x.match));
 data.matches.sort((a,b)=>a.no-b.no);
 try{if(!persist())throw new Error("Browser storage rejected the import.");render();closeImportMatchesModal();showPage("matches");showToast(`${valid.length} match${valid.length===1?"":"es"} imported${invalid.length?` · ${invalid.length} row${invalid.length===1?"":"s"} skipped`:""}.`)}
 catch(err){data.matches=before;console.error(err);showAppNotice("Imported matches could not be saved to browser storage.","Import failed")}
 finally{if(btn){btn.dataset.busy="0";btn.disabled=false;if(!$("importMatchesModal")?.classList.contains("hidden"))renderImportPreview()}}
}
// The import modal is declared after app.js in index.html, so use delegated handling.
document.addEventListener("click",e=>{
 const trigger=e.target.closest("#confirmImportMatchesBtn");
 if(!trigger)return;
 e.preventDefault();e.stopPropagation();
 commitPendingImport();
});

function exportMatchesCsv(){
 if(!data){showAppNotice("Open a challenge before exporting matches.","Nothing to export");return}
 const columns=[
  ["Match","no"],["Date","date"],["Result","result"],["Agent","agent"],["Map","map"],
  ["My Score","myScore"],["Enemy Score","enemyScore"],["Rank After","rankAfter"],["Rank Status","rankStatus"],
  ["RR After","rrAfter"],["RR Change","rrChange"],["Kills","kills"],["Deaths","deaths"],["Assists","assists"],
  ["K/D",null],["DDDelta","ddDelta"],["HS%","hs"],["ACS","acs"],["ADR","adr"],["KAST%","kast"],
  ["First Kills","firstKills"],["First Deaths","firstDeaths"],["Multi Kills","multiKills"],["Rounds","rounds"],["Notes","notes"]
 ];
 const rows=[columns.map(c=>csvCell(c[0])).join(",")];
 data.matches.forEach(m=>rows.push(columns.map(([_,key])=>csvCell(key===null?(m.deaths?(m.kills/m.deaths).toFixed(2):Number(m.kills||0).toFixed(2)):m[key])).join(",")));
 const blob=new Blob(["\ufeff"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download=`${(data.name||"challenge").replace(/[^a-z0-9_-]+/gi,"-")}-matches.csv`;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const exportCsvButton=$("exportCsv");
if(exportCsvButton)exportCsvButton.addEventListener("click",function(e){e.preventDefault();exportMatchesCsv()});
function exportBackupJson(){
 const payload={version:7,exportedAt:new Date().toISOString(),activeChallenge:data,activeChallenges,archives};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="valorant-challenge-tracker-backup.json";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if($("backupBtn"))$("backupBtn").addEventListener("click",exportBackupJson);
$("matchFilterToggle")?.addEventListener("click",()=>{const panel=$("matchFilterPanel"),open=!panel.classList.contains("hidden");panel.classList.toggle("hidden",open);$("matchFilterToggle").setAttribute("aria-expanded",String(!open))});
["matchSort","matchResultFilter","matchAgentFilter","matchMapFilter"].forEach(id=>$(id)?.addEventListener("change",()=>{matchPage=1;renderTable()}));
$("matchPageSize")?.addEventListener("change",()=>{matchPage=1;renderTable()});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-match-page]");
  if(!b) return;
  const action=b.dataset.matchPage;
  // recompute pages from current filters and page size
  const tableMatches=getTableMatches();
  const pageRaw=$("matchPageSize")?.value||"25";
  const size=pageRaw==="all"?Math.max(1,tableMatches.length):Math.max(1,Number(pageRaw)||25);
  const pages=Math.max(1,Math.ceil(tableMatches.length/size));
  if(action==="prev") matchPage=Math.max(1,matchPage-1);
  else if(action==="next") matchPage=Math.min(pages,matchPage+1);
  else if(action==="goto"){
    const p=Number(b.dataset.page);
    if(Number.isFinite(p)) matchPage=Math.min(Math.max(1,p),pages);
  }
  renderTable();
});
$("clearMatchFilters")?.addEventListener("click",()=>{matchPage=1;$("matchSort").value="no-desc";$("matchResultFilter").value="";$("matchAgentFilter").value="";$("matchMapFilter").value="";renderTable()});
render();
window.addEventListener("error",event=>{
 console.error("VCT runtime error:",event.error||event.message);
});

document.querySelectorAll("[data-new-challenge]").forEach(btn=>btn.addEventListener("click",e=>{
 e.preventDefault();startNewChallengeFlow();
}));
