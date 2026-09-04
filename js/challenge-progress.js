// Challenge identity, progress maths and completion tracking, plus the one-time
// migration from the old single-active-challenge model.
function ensureChallengeId(c){
 if(!c)return c;
 if(!c.id)c.id=`ch_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
 syncChallengeCompletion(c);
 return c;
}
function challengeProgress(c){
 const target=Math.max(0,Number(c?.target)||0);
 const recorded=Array.isArray(c?.matches)?c.matches.length:0;
 const completed=target?Math.min(recorded,target):0;
 return {target,recorded,completed,additional:target?Math.max(0,recorded-target):0,isComplete:target>0&&recorded>=target};
}
function completionBoundaryMatch(c){
 const p=challengeProgress(c);
 if(!p.isComplete)return null;
 const ordered=(c.matches||[]).slice().sort((a,b)=>Number(a.no)-Number(b.no));
 return ordered[p.target-1]||null;
}
function syncChallengeCompletion(c){
 if(!c||!Array.isArray(c.matches))return c;
 const p=challengeProgress(c);
 if(!p.isComplete){
  delete c.completedAtMatchId;
  delete c.completedAt;
  return c;
 }
 const ids=new Set(c.matches.map(m=>Number(m.no)));
 if(c.completedAtMatchId==null||!ids.has(Number(c.completedAtMatchId))){
  const boundary=completionBoundaryMatch(c);
  if(boundary){
   c.completedAtMatchId=Number(boundary.no);
   c.completedAt=boundary.date||c.completedAt||new Date().toISOString();
  }
 }
 return c;
}
function challengeProgressText(c,{history=false}={}){
 const p=challengeProgress(c);
 if(p.isComplete){
  if(history)return `Completed · ${p.completed}/${p.target} · ${p.recorded} recorded match${p.recorded===1?"":"es"}`;
  return `${p.completed} / ${p.target} completed${p.additional?` · ${p.additional} additional match${p.additional===1?"":"es"}`:""}`;
 }
 return `${p.recorded} / ${p.target} matches`;
}
// Migrate the old single-active model without losing the current challenge.
if(data){
 ensureChallengeId(data);
 if(!activeChallenges.some(c=>c.id===data.id))activeChallenges.unshift(data);
}
activeChallenges.forEach(ensureChallengeId);
archives.forEach(ensureChallengeId);
if(!data && activeChallenges.length)data=activeChallenges[0];
