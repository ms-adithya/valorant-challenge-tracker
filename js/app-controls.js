// Backup restore input, trend/analytics range controls and the storage health check.
// Replaces every stored record from a backup file. This is the destructive counterpart to
// unarchiving, which only moves one challenge out of `archives`.
async function restoreBackupFromFile(file){
 if(!file)return;
 try{
  const p=JSON.parse(await file.text());
  if(!("archives" in p))throw new Error();
  if(!await appConfirm({title:"Import backup file?",message:"Every challenge, match and archived challenge stored in this browser will be replaced by the contents of this file. This cannot be undone.",confirmText:"Replace all data",kicker:"IMPORT BACKUP"}))return;
  activeChallenges=Array.isArray(p.activeChallenges)?p.activeChallenges:(p.activeChallenge?[p.activeChallenge]:[]);
  activeChallenges.forEach(ensureChallengeId);
  data=p.activeChallenge||activeChallenges[0]||null;
  if(data)ensureChallengeId(data);
  archives=Array.isArray(p.archives)?p.archives:[];
  archives.forEach(ensureChallengeId);
  persist();render();showToast("Backup restored.");
 }catch{
  showAppNotice("The selected file is not a valid tracker backup.","Import failed");
 }
}
// Both the Challenges page and the empty-state panel expose an import control.
function wireRestoreInput(id){
 const input=$(id);if(!input)return;
 input.onchange=async e=>{try{await restoreBackupFromFile(e.target.files[0])}finally{e.target.value=""}};
}
wireRestoreInput("restoreInput");
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
