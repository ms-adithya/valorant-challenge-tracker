// Streaks, agent x map combo insights and the agent/map matrix.
const safeEscapeHtml = typeof escapeHtml === "function"
    ? escapeHtml
    : (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));

const safeOptionalNumber = typeof optionalNumber === "function"
    ? optionalNumber
    : (value) => {
            if (value === null || value === undefined || value === "") return null;
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

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
    $("insights").innerHTML=cards.map(x=>`<div class="insight"><span>${safeEscapeHtml(x[0])}</span><b>${safeEscapeHtml(x[1])}</b><small>${safeEscapeHtml(x[2])}</small></div>`).join("");
}

function renderMatrix(){
 const scope=analyticsMatches();
 const matrixLimit = 12;
 const agentSet=new Set(),mapSet=new Set();
 let agentsTruncated=false,mapsTruncated=false;
 for(const match of scope){
  const agent=match.agent,map=match.map;
  if(agent){if(agentSet.size<matrixLimit||agentSet.has(agent))agentSet.add(agent);else agentsTruncated=true}
  if(map){if(mapSet.size<matrixLimit||mapSet.has(map))mapSet.add(map);else mapsTruncated=true}
 }
 const usedAgents=[...agentSet],usedMaps=[...mapSet];
 const truncated=agentsTruncated||mapsTruncated;
 if(!usedAgents.length){$("matrix").innerHTML='<div class="empty">Agent × map combinations appear here after matches are added.</div>';return}
 const matrixBanner=truncated?`<div class="matrix-limit-note">Showing first ${matrixLimit} agents and maps only.</div>`:"";
 const selectedAgents=new Set(usedAgents),selectedMaps=new Set(usedMaps),statsByAgent=new Map(usedAgents.map(agent=>[agent,new Map()]));
 for(const match of scope){
  const agent=match.agent,map=match.map;
  if(!selectedAgents.has(agent)||!selectedMaps.has(map))continue;
  let stats=statsByAgent.get(agent).get(map);
  if(!stats){stats={matches:0,wins:0,kills:0,deaths:0,hasKD:true};statsByAgent.get(agent).set(map,stats)}
  stats.matches++;
  if(match.result==="Win")stats.wins++;
  const kills=safeOptionalNumber(match.kills),deaths=safeOptionalNumber(match.deaths);
  if(kills===null||deaths===null)stats.hasKD=false;
  else{stats.kills+=kills;stats.deaths+=deaths}
 }
 let head=`<div class="matrix" style="--cols:${usedMaps.length}"><div class="matrix-row"><b>Agent</b>${usedMaps.map(x=>`<b class="cell">${safeEscapeHtml(x)}</b>`).join("")}</div>`;
 usedAgents.forEach(agent=>{head+=`<div class="matrix-row"><b>${safeEscapeHtml(agent)}</b>${usedMaps.map(map=>{
  const stats=statsByAgent.get(agent).get(map);
  if(!stats)return '<div class="cell"><span>—</span></div>';
  const kd=stats.hasKD?(stats.deaths?stats.kills/stats.deaths:stats.kills):null;
  return `<div class="cell ${stats.matches>=3?"qualified-combo":""}"><strong>${(stats.wins/stats.matches*100).toFixed(0)}% WR</strong><span>${stats.matches}M · ${kd===null?"—":kd.toFixed(2)} KD</span>${stats.matches>=3?`<em class="combo-qualified" title="Qualified: 3+ matches" aria-label="Qualified combination">Q</em>`:""}</div>`;
 }).join("")}</div>`});
 $("matrix").innerHTML=matrixBanner+head+"</div>";
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={streaks,comboInsight,renderInsights,renderMatrix};
}
