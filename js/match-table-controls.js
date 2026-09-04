// Match History filter, sort, page-size and pagination controls.
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
