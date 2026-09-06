// Analytics panels: accuracy, roles, top agents, summary strip, distributions,
// win-rate bars and the first-vs-last period comparison.
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

function renderWinBars(key,id){
 const groups={};analyticsMatches().forEach(m=>{groups[m[key]]??={n:0,w:0};groups[m[key]].n++;if(m.result==="Win")groups[m[key]].w++});
 const arr=Object.entries(groups).map(([name,v])=>[name,v.n,v.w/v.n*100]).sort((a,b)=>b[2]-a[2]);
 $(id).innerHTML=arr.length?arr.map(([n,count,wr])=>`<div class="hbar"><span class="hbar-name" title="${n}">${n}</span><div class="hbar-track"><div class="hbar-fill" style="width:${wr}%"></div></div><span class="hbar-value">${wr.toFixed(0)}% <small>(${count})</small></span></div>`).join(""):'<div class="empty">No data yet.</div>';
}

function renderComparison(){
 const ms=analyticsMatches();if(ms.length<2){$("comparison").innerHTML='<div class="empty">Add more matches to compare performance periods.</div>';return}
 const first=ms.slice(0,Math.min(5,ms.length)),last=ms.slice(-Math.min(5,ms.length));
 const av=(arr,key)=>{const vals=arr.map(m=>key==="kd"?((m.kills==null||m.deaths==null)?null:(Number(m.deaths)?Number(m.kills)/Number(m.deaths):Number(m.kills))):optionalNumber(m[key])).filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
 const metrics=[["K/D","kd",2],["ACS","acs",0],["ADR","adr",0],["DDΔ","ddDelta",1],["KAST","kast",1],["HS","hs",1]];
 $("comparison").innerHTML=metrics.map(([label,key,dp])=>{const a=av(first,key),b=av(last,key),suffix=["kast","hs"].includes(key)?"%":"";if(a===null||b===null)return `<div class="compare"><span>${label}</span><b>—</b><small class="delta-flat">Not enough recorded data</small></div>`;const d=b-a,cls=d>.001?"delta-up":d<-.001?"delta-down":"delta-flat";return `<div class="compare"><span>${label}</span><b>${b.toFixed(dp)}${suffix}</b><small class="${cls}">${d>=0?"+":""}${d.toFixed(dp)}${suffix} vs first ${first.length}</small></div>`}).join("");
}
