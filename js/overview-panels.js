// Overview page panels: rank path, RR chart, metric trend, result bars, recents.
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

function renderRecent(){
 const ms=countedMatches().slice().sort((a,b)=>Number(b.no)-Number(a.no)).slice(0,5);$("recentMatches").innerHTML=ms.length?ms.map(m=>{const rr=optionalNumber(m.rrChange);const rawResult=String(m.result||"").toLowerCase();const resultClass=rawResult==="win"||rawResult==="loss"||rawResult==="draw"?rawResult:"";const agentText=escapeHtml(String(m.agent??"—"));const mapText=escapeHtml(String(m.map??"—"));const killsText=escapeHtml(String(m.kills??"—"));const deathsText=escapeHtml(String(m.deaths??"—"));const assistsText=escapeHtml(String(m.assists??"—"));const acsText=escapeHtml(String(m.acs??"—"));const rrText=escapeHtml(rr===null?"— RR":`${rr>=0?"+":""}${rr} RR`);return `<div class="recent"><div class="result-dot ${resultClass}">${escapeHtml(String(m.result||"?").slice(0,1))}</div><div><b>${agentText} · ${mapText}</b><span>${killsText}/${deathsText}/${assistsText} · ${acsText} ACS</span></div><strong class="${rr===null?"muted":(rr>=0?"pos":"neg")}">${rrText}</strong></div>`}).join(""):'<div class="empty">No matches recorded yet.</div>';
}
