// Match data pipeline: canonical dataset, analytics scope, table filtering,
// sorting and pagination maths.
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
