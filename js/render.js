// Top-level render orchestrator for the overview page and every dependent panel.
function render(){
 if(!data&&activeChallenges.length)data=activeChallenges[0];
 const active=!!data;$("setup").classList.toggle("hidden",active);$("app").classList.toggle("hidden",!active);
 if(!active){
   document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));
   if(window.renderSetupRestore)renderSetupRestore();
   return
 }
 if(window.renderSetupRestore)renderSetupRestore();
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
