// Writing state back to localStorage (all-or-nothing) and numeric field coercion.
function syncCurrentChallenge(){
 const d = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : (typeof window !== "undefined" ? window.data : null));
 if(!d)return;
 const a = typeof activeChallenges !== "undefined" ? activeChallenges : (typeof global !== "undefined" ? global.activeChallenges : (typeof window !== "undefined" ? window.activeChallenges : []));
 if(typeof ensureChallengeId==="function")ensureChallengeId(d);
 if(typeof syncChallengeCompletion==="function")syncChallengeCompletion(d);
 const i=a.findIndex(c=>c.id===d.id);
 if(i>=0)a[i]=d; else a.unshift(d);
}
function persistLocal(){
 try{
  if(typeof localStorage==="undefined")return false;
  const keys=["vct4","vctActiveChallenges","vctArchives"];
  const previous={};
  for(const k of keys){
   try{previous[k]=localStorage.getItem(k)}catch{previous[k]=null}
  }
  try{
   const d = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : null);
   const a = typeof activeChallenges !== "undefined" ? activeChallenges : (typeof global !== "undefined" ? global.activeChallenges : []);
   const arc = typeof archives !== "undefined" ? archives : (typeof global !== "undefined" ? global.archives : []);
   localStorage.setItem("vct4",JSON.stringify(d));
   localStorage.setItem("vctActiveChallenges",JSON.stringify(a));
   localStorage.setItem("vctArchives",JSON.stringify(arc));
   return true;
  }catch(err){
   // Avoid leaving the three storage records at different revisions after a partial write.
   for(const k of keys){try{previous[k]===null?localStorage.removeItem(k):localStorage.setItem(k,previous[k])}catch{}}
   console.error("Could not save VCT data",err);
   if(typeof showAppNotice==="function")showAppNotice("Your browser could not save this change. Check available storage/privacy settings, then try again.","Save failed");
   return false;
  }
 }catch(outerErr){
  console.error("Could not save VCT data",outerErr);
  return false;
 }
}
function ensureMatchIds(challenge){
 if(!challenge||!Array.isArray(challenge.matches))return;
 for(const m of challenge.matches){
  if(m&&typeof m==="object"&&!m.matchId){
   m.matchId=(typeof window!=="undefined"&&window.newMatchId)?window.newMatchId():(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`m_${Date.now()}_${Math.random().toString(36).slice(2,10)}`);
  }
 }
}
function persist(){
 try{
  const d = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : null);
  const a = typeof activeChallenges !== "undefined" ? activeChallenges : (typeof global !== "undefined" ? global.activeChallenges : []);
  const arc = typeof archives !== "undefined" ? archives : (typeof global !== "undefined" ? global.archives : []);
  const all = [d,...(Array.isArray(a)?a:[]),...(Array.isArray(arc)?arc:[])].filter(Boolean);
  if(typeof ensureChallengeId==="function")all.forEach(ensureChallengeId);
  if(typeof syncCurrentChallenge==="function")syncCurrentChallenge();
  if(typeof syncChallengeCompletion==="function"){
   if(Array.isArray(a))a.forEach(syncChallengeCompletion);
   if(Array.isArray(arc))arc.forEach(syncChallengeCompletion);
  }
  if(typeof rebuildChallengeRankProgression==="function")all.forEach(rebuildChallengeRankProgression);
  if(typeof ensureMatchIds==="function")all.forEach(ensureMatchIds);
  // localStorage stays the synchronous, all-or-nothing local write. Its result is
  // what persist() reports, preserving the contract every call site relies on.
  if(!persistLocal())return false;
  // Cloud push is fire-and-forget by design: a persist() return of true means
  // "accepted locally", never "the server has it".
  if(typeof window!=="undefined"&&window.VCT&&window.VCT.cloud)window.VCT.cloud.pushChanges();
  return true;
 }catch(err){
  console.error("Could not persist data:",err);
  if(typeof showAppNotice==="function")showAppNotice("A storage error occurred while saving your data. Check available browser storage.","Save failed");
  return false;
 }
}
function optionalNumber(v){
 if(v===null||v===undefined)return null;
 const s=String(v).trim();
 if(s===""||s.toLowerCase()==="null")return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function normalizeMatchOptionals(match){
 if(!match||typeof match!=="object")return match;
 ["rrAfter","rrChange","kills","deaths","assists","acs","adr","ddDelta","hs","kast","firstKills","firstDeaths","multiKills","rounds"].forEach(k=>{
   if(k in match)match[k]=optionalNumber(match[k]);
 });
 return match;
}

if(typeof global!=="undefined"){
 global.persist=persist;
 global.persistLocal=persistLocal;
}
if(typeof module!=="undefined"&&module.exports){
 module.exports={syncCurrentChallenge,persistLocal,ensureMatchIds,persist,optionalNumber,normalizeMatchOptionals};
}
