// Startup normalisation of stored challenges, plus current-state accessors.
function normalizeStoredChallenges(){
 const currentData = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : null);
 const currentActive = typeof activeChallenges !== "undefined" ? activeChallenges : (typeof global !== "undefined" ? global.activeChallenges : []);
 const currentArchives = typeof archives !== "undefined" ? archives : (typeof global !== "undefined" ? global.archives : []);
 const all=[currentData,...(Array.isArray(currentActive)?currentActive:[]),...(Array.isArray(currentArchives)?currentArchives:[])].filter(Boolean);
 all.forEach(c=>{
  if(!Array.isArray(c.matches))return;
  const isObj=m=>m&&typeof m==="object"&&!Array.isArray(m);
  c.matches.forEach(m=>{if(isObj(m)&&typeof normalizeMatchOptionals==="function")normalizeMatchOptionals(m);});
  let previousRank=c.startRank||"Unranked";
  const isUnrankedFn=typeof isUnranked==="function"?isUnranked:(r=>r==="Unranked");
  c.matches.filter(isObj).slice().sort((a,b)=>Number(a.no||0)-Number(b.no||0)).forEach(m=>{
   const after=m.rankAfter||previousRank;
   // Migration: older builds treated first placement as a promotion.
   if(isUnrankedFn(previousRank) && !isUnrankedFn(after))m.rankStatus="Placed";
   else if(isUnrankedFn(previousRank) && isUnrankedFn(after))m.rankStatus="Same Rank";
   else if(!m.rankStatus || !["Same Rank","Placed","Promoted","Demoted"].includes(m.rankStatus)){
    const ranksArr = typeof ranks !== "undefined" ? ranks : (typeof global !== "undefined" && global.ranks ? global.ranks : ["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"]);
    const bi = ranksArr.indexOf(previousRank), ai = ranksArr.indexOf(after);
    if(bi >= 0 && ai >= 0) m.rankStatus = ai === bi ? "Same Rank" : ai > bi ? "Promoted" : "Demoted";
   }
   if(isUnrankedFn(after)){m.rrAfter=null;m.rrChange=null;}
   previousRank=after;
  });
  if(typeof rebuildChallengeRankProgression==="function")rebuildChallengeRankProgression(c);
 });
}
if(typeof window!=="undefined")normalizeStoredChallenges();
const cur=()=>{
 const d = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : null);
 if(!d)return {rankAfter:"Unranked",rrAfter:null};
 const latest=typeof latestRankState==="function"?latestRankState(d):null;
 const startRank=d.startRank||"Unranked";
 const isUnrankedFn=typeof isUnranked==="function"?isUnranked:(r=>r==="Unranked");
 const optNum=typeof optionalNumber==="function"?optionalNumber:(v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null));
 if(!latest)return {rankAfter:startRank,rrAfter:isUnrankedFn(startRank)?null:optNum(d.startRR),rrSource:optNum(d.startRR)===null?"unknown":"recorded"};
 return {rankAfter:latest.after?.rank?.value||startRank,rrAfter:latest.after?.rr?.value??null,rrSource:latest.after?.rr?.source??"unknown",rankState:latest};
};
const avg=k=>{
 const d = typeof data !== "undefined" ? data : (typeof global !== "undefined" ? global.data : null);
 if(!d||!Array.isArray(d.matches))return null;
 const vals=d.matches.map(m=>m&&m[k]).filter(v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))).map(Number);
 return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
};

if(typeof module!=="undefined"&&module.exports){
 module.exports={normalizeStoredChallenges,cur,avg};
}
