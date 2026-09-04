// Match History table rendering.
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
 const rowsEl=$("matchRows");
 if(!rowsEl)return;
 if(!paged.length){
  rowsEl.innerHTML=total?'<tr><td colspan="11" class="muted">No matches match the current filters.</td></tr>':'<tr><td colspan="11" class="muted">No matches yet.</td></tr>';
  return;
 }
 rowsEl.textContent="";
 paged.forEach(m=>{
  const tr=document.createElement("tr");
  const normalizedResult=String(m.result||"").toLowerCase();
  const resultClass=normalizedResult==="win"||normalizedResult==="draw"||normalizedResult==="loss"?normalizedResult:"unknown";
  tr.classList.add("match-result-row",`result-${resultClass}`);

  const tdNo=document.createElement("td");
  const noSpan=document.createElement("span");
  noSpan.className="match-number";
  noSpan.textContent=String(m.no??"—");
  tdNo.appendChild(noSpan);
  tr.appendChild(tdNo);

  const tdResult=document.createElement("td");
  const resultPill=document.createElement("span");
  resultPill.className=`result-pill ${resultClass}`;
  resultPill.textContent=String(m.result??"—");
  tdResult.appendChild(resultPill);
  tr.appendChild(tdResult);

  const tdAgent=document.createElement("td");
  const agentWrap=document.createElement("div");
  agentWrap.className="table-agent";
  const agentInitials=document.createElement("span");
  agentInitials.textContent=String(m.agent||"?").slice(0,2).toUpperCase();
  const agentName=document.createElement("b");
  agentName.textContent=String(m.agent??"—");
  agentWrap.append(agentInitials,agentName);
  tdAgent.appendChild(agentWrap);
  tr.appendChild(tdAgent);

  const tdMap=document.createElement("td");
  const mapBold=document.createElement("b");
  mapBold.textContent=String(m.map??"—");
  tdMap.appendChild(mapBold);
  tr.appendChild(tdMap);

  const tdScore=document.createElement("td");
  const scoreStrong=document.createElement("strong");
  scoreStrong.className="score-cell";
  scoreStrong.append(document.createTextNode(String(m.myScore??"—")));
  const scoreSep=document.createElement("i");
  scoreSep.textContent=":";
  scoreStrong.appendChild(scoreSep);
  scoreStrong.append(document.createTextNode(String(m.enemyScore??"—")));
  tdScore.appendChild(scoreStrong);
  tr.appendChild(tdScore);

  const tdKda=document.createElement("td");
  tdKda.textContent=`${m.kills??"—"} / ${m.deaths??"—"} / ${m.assists??"—"}`;
  tr.appendChild(tdKda);

  const tdKd=document.createElement("td");
  tdKd.textContent=(m.kills==null||m.deaths==null)?"—":(Number(m.deaths)?(Number(m.kills)/Number(m.deaths)).toFixed(2):Number(m.kills).toFixed(2));
  tr.appendChild(tdKd);

  const tdAcs=document.createElement("td");
  tdAcs.textContent=String(m.acs??"—");
  tr.appendChild(tdAcs);

  const tdDd=document.createElement("td");
  tdDd.className=Number(m.ddDelta)>=0?"pos":"neg";
  tdDd.textContent=m.ddDelta==null?"—":`${Number(m.ddDelta)>=0?"+":""}${m.ddDelta}`;
  tr.appendChild(tdDd);

  const tdRr=document.createElement("td");
  tdRr.className=m.rrChange==null?"muted":(Number(m.rrChange)>=0?"pos":"neg");
  const rrBold=document.createElement("b");
  rrBold.textContent=m.rrChange==null?"—":`${Number(m.rrChange)>=0?"+":""}${Number(m.rrChange)}`;
  tdRr.appendChild(rrBold);
  tr.appendChild(tdRr);

  const tdActions=document.createElement("td");
  const actionGroup=document.createElement("div");
  actionGroup.className="match-action-group";
  const editBtn=document.createElement("button");
  editBtn.className="match-action edit-match-btn";
  editBtn.type="button";
  editBtn.dataset.editMatch=String(m.no??"");
  editBtn.textContent="Edit";
  const deleteBtn=document.createElement("button");
  deleteBtn.className="match-action delete-match-btn";
  deleteBtn.type="button";
  deleteBtn.dataset.deleteMatch=String(m.no??"");
  deleteBtn.textContent="Delete";
  actionGroup.append(editBtn,deleteBtn);
  tdActions.appendChild(actionGroup);
  tr.appendChild(tdActions);

  rowsEl.appendChild(tr);
 });
}
