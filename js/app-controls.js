// Backup restore input, trend/analytics range controls and the storage health check.
if($("restoreInput")) $("restoreInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const p=JSON.parse(await f.text());if(!("archives" in p))throw new Error();if(!await appConfirm({title:"Confirm action",message:String("Restore this backup? Current local tracker data will be replaced."),confirmText:"Confirm"}))return;activeChallenges=Array.isArray(p.activeChallenges)?p.activeChallenges:(p.activeChallenge?[p.activeChallenge]:[]);
activeChallenges.forEach(ensureChallengeId);
archives.forEach(ensureChallengeId);
data=p.activeChallenge||activeChallenges[0]||null;
if(data)ensureChallengeId(data);
archives=Array.isArray(p.archives)?p.archives:[];archives.forEach(ensureChallengeId);
persist();render();showToast("Backup restored.");}catch{showAppNotice("The selected file is not a valid tracker backup.","Import failed");}finally{e.target.value=""}};
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
