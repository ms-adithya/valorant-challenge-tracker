// Empty-state restore panel. Shown under the create-challenge form when there is no
// active challenge, so an archived challenge or a backup file can be brought back
// without the (hidden) app shell that normally hosts those controls.
//
// This module renders and toggles only. Unarchiving reuses the delegated
// [data-restore-archive] handler in challenge-options.js, and the file input reuses
// wireRestoreInput/restoreBackupFromFile in app-controls.js, so both paths stay
// single-sourced with their in-app equivalents.
function renderSetupRestore(){
 const panel=$("setupArchiveAccess");if(!panel)return;
 // Only when the app shell is hidden and there is nothing to open.
 const stranded=!data&&activeChallenges.length===0;
 panel.classList.toggle("hidden",!stranded);
 if(!stranded)return;
 const block=$("setupArchiveBlock"),list=$("setupArchiveList");
 if(block)block.classList.toggle("hidden",archives.length===0);
 if(list)list.innerHTML=archives.map((c,i)=>{
  const progress=escapeHtml(challengeProgressText(c,{history:true}));
  return `<div class="archive-restore-row"><div><h3>${escapeHtml(c.name)}</h3><p>${progress} · ${escapeHtml(c.startRank??"")} → target ${escapeHtml(c.targetRank||"No target")}</p></div><div class="actions"><button class="ghost" type="button" data-restore-archive="${i}">Unarchive</button><button class="ghost delete-archive-btn" type="button" onclick="deleteArchivedChallenge(${i})">Delete</button></div></div>`;
 }).join("");
}
wireRestoreInput("setupRestoreInput");
