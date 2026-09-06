// Writing state back to localStorage (all-or-nothing) and numeric field coercion.
function syncCurrentChallenge(){
 if(!data)return;
 ensureChallengeId(data);
 syncChallengeCompletion(data);
 const i=activeChallenges.findIndex(c=>c.id===data.id);
 if(i>=0)activeChallenges[i]=data; else activeChallenges.unshift(data);
}
function persist(){
 syncCurrentChallenge();
 activeChallenges.forEach(syncChallengeCompletion);
 archives.forEach(syncChallengeCompletion);
 [data,...activeChallenges,...archives].filter(Boolean).forEach(rebuildChallengeRankProgression);
 const keys=["vct4","vctActiveChallenges","vctArchives"];
 const previous=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
 try{
  localStorage.setItem("vct4",JSON.stringify(data));
  localStorage.setItem("vctActiveChallenges",JSON.stringify(activeChallenges));
  localStorage.setItem("vctArchives",JSON.stringify(archives));
  return true;
 }catch(err){
  // Avoid leaving the three storage records at different revisions after a partial write.
  for(const k of keys){try{previous[k]===null?localStorage.removeItem(k):localStorage.setItem(k,previous[k])}catch{}}
  console.error("Could not save VCT data",err);
  showAppNotice("Your browser could not save this change. Check available storage/privacy settings, then try again.","Save failed");
  return false;
 }
}
function optionalNumber(v){
 if(v===null||v===undefined||v===""||String(v).trim().toLowerCase()==="null")return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}
function normalizeMatchOptionals(match){
 if(!match||typeof match!=="object")return match;
 ["rrAfter","rrChange","kills","deaths","assists","acs","adr","ddDelta","hs","kast","firstKills","firstDeaths","multiKills","rounds"].forEach(k=>{
   if(k in match)match[k]=optionalNumber(match[k]);
 });
 return match;
}
