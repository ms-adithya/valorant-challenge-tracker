// Startup normalisation of stored challenges, plus current-state accessors.
function normalizeStoredChallenges(){
 const all=[data,...activeChallenges,...archives].filter(Boolean);
 all.forEach(c=>{
  if(!Array.isArray(c.matches))return;
  c.matches.forEach(normalizeMatchOptionals);
  let previousRank=c.startRank||"Unranked";
  c.matches.slice().sort((a,b)=>Number(a.no)-Number(b.no)).forEach(m=>{
   const after=m.rankAfter||previousRank;
   // Migration: older builds treated first placement as a promotion.
   if(isUnranked(previousRank) && !isUnranked(after))m.rankStatus="Placed";
   else if(isUnranked(previousRank) && isUnranked(after))m.rankStatus="Same Rank";
   if(isUnranked(after)){m.rrAfter=null;m.rrChange=null;}
   previousRank=after;
  });
  rebuildChallengeRankProgression(c);
 });
}
normalizeStoredChallenges();
const cur=()=>{
 if(!data)return {rankAfter:"Unranked",rrAfter:null};
 const latest=latestRankState(data);
 if(!latest)return {rankAfter:data.startRank,rrAfter:isUnranked(data.startRank)?null:optionalNumber(data.startRR),rrSource:optionalNumber(data.startRR)===null?"unknown":"recorded"};
 return {rankAfter:latest.after.rank.value||data.startRank,rrAfter:latest.after.rr.value,rrSource:latest.after.rr.source,rankState:latest};
};
const avg=k=>{const vals=data.matches.map(m=>m[k]).filter(v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))).map(Number);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
