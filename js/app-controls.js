// Backup restore input, trend/analytics range controls and the storage health check.
// Replaces every stored record from a backup file. This is the destructive counterpart to
// unarchiving, which only moves one challenge out of `archives`.
async function restoreBackupFromFile(file){
 if(!file)return;
 try{
  const p=JSON.parse(await file.text());
  if(!p||typeof p!=="object"||!("archives" in p))throw new Error("Invalid backup format");
  if(!await appConfirm({title:"Import backup file?",message:"Every challenge, match and archived challenge stored in this browser will be replaced by the contents of this file. This cannot be undone.",confirmText:"Replace all data",kicker:"IMPORT BACKUP"}))return;
  const isChallenge=c=>c&&typeof c==="object"&&!Array.isArray(c);
  const rawActive=Array.isArray(p.activeChallenges)?p.activeChallenges:(p.activeChallenge?[p.activeChallenge]:[]);
  const rawArchives=Array.isArray(p.archives)?p.archives:[];
  const prevActive=activeChallenges,prevArchives=archives,prevData=data;
  activeChallenges=rawActive.filter(isChallenge);
  archives=rawArchives.filter(isChallenge);
  data=(isChallenge(p.activeChallenge)?p.activeChallenge:null)||activeChallenges[0]||null;
  const sanitizeFn=typeof sanitizeChallengeData==="function"?sanitizeChallengeData:(typeof global!=="undefined"?global.sanitizeChallengeData:null);
  if(sanitizeFn){
   activeChallenges.forEach(sanitizeFn);
   archives.forEach(sanitizeFn);
   if(data)sanitizeFn(data);
  }
  const ensureIdFn=typeof ensureChallengeId==="function"?ensureChallengeId:(typeof global!=="undefined"?global.ensureChallengeId:null);
  if(ensureIdFn){
   activeChallenges.forEach(ensureIdFn);
   archives.forEach(ensureIdFn);
   if(data)ensureIdFn(data);
  }
  if(!persist()){
   activeChallenges=prevActive;archives=prevArchives;data=prevData;
   throw new Error("Failed to persist restored backup");
  }
  if(typeof render==="function")render();
  if(typeof showToast==="function")showToast("Backup restored.");
 }catch(err){
  console.warn("Backup restore failed:",err);
  if(typeof showAppNotice==="function")showAppNotice("The selected file is not a valid tracker backup.","Import failed");
 }
}
// Both the Challenges page and the empty-state panel expose an import control.
function wireRestoreInput(id){
 const input=typeof $==="function"?$(id):null;if(!input)return;
 input.onchange=async e=>{try{await restoreBackupFromFile(e.target.files[0])}finally{e.target.value=""}};
}
wireRestoreInput("restoreInput");
if(typeof $==="function"&&$("trendMetric"))$("trendMetric").onchange=()=>data&&renderMetricChart();
if(typeof $==="function"&&$("trendRange"))$("trendRange").onchange=()=>data&&renderMetricChart();
if(typeof $==="function"&&$("analyticsRange"))$("analyticsRange").onchange=()=>{if(!data)return;renderAnalyticsStrip();renderAccuracyPanel();renderRolePanel();renderTopAgents();renderDist("agent","agentDist");renderDist("map","mapDist");renderWinBars("agent","agentWinBars");renderWinBars("map","mapWinBars");renderComparison();renderInsights();renderMatrix();if(window.renderTopMaps)window.renderTopMaps();};
if(typeof localStorage!=="undefined"){
 try{
  const testKey="vct_storage_test";
  localStorage.setItem(testKey,"1");localStorage.removeItem(testKey);
 }catch(err){
  const n=typeof $==="function"?$("storageNotice"):null;
  if(n){n.textContent="Local browser storage appears restricted. Challenge data may not persist until storage is available.";n.classList.remove("hidden")}
  console.warn("Storage health check failed",err);
 }
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={
  restoreBackupFromFile,
  wireRestoreInput
 };
}
