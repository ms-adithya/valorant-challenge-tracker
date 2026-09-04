// Archive browser modal, page routing and the sidebar nav wiring.
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
