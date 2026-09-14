// Runtime rank/RR progression derivation.
// Runtime-only, provenance-aware rank/RR progression. Derived values are never persisted.
// Priority: recorded > safely derived > unknown. Never guess across an information gap.
const rankProgressionRuntime=new WeakMap();

const _ranks = typeof ranks !== "undefined" ? ranks : (typeof global !== "undefined" && global.ranks ? global.ranks : ["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"]);
const _isUnranked = typeof isUnranked === "function" ? isUnranked : (r => r === "Unranked");
const _rankValue = typeof rankValue === "function" ? rankValue : (v => { const x=String(v??"").trim(); return _ranks.includes(x)?x:null; });
const _stateValue = typeof stateValue === "function" ? stateValue : ((val, src="unknown") => ({ value: val ?? null, source: val === null || val === undefined ? "unknown" : src }));
const _optionalNumber = typeof optionalNumber === "function" ? optionalNumber : (v => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
});

function rebuildChallengeRankProgression(challenge){
 if(!challenge||!Array.isArray(challenge.matches)){return []}
 const ordered=challenge.matches.filter(m=>m&&typeof m==="object").slice().sort((a,b)=>Number(a.no||0)-Number(b.no||0));
 let previousRank=_rankValue(challenge.startRank)||"Unranked";
 let previousRR=_isUnranked(previousRank)?null:_optionalNumber(challenge.startRR);
 let previousRRSource=previousRR===null?"unknown":"recorded";
 let chainIntact=previousRR!==null;
 const states=[];
 for(const m of ordered){
  if(!m||typeof m!=="object")continue;
  const afterRank=_rankValue(m.rankAfter)||previousRank;
  const recordedAfterRR=_isUnranked(afterRank)?null:_optionalNumber(m.rrAfter);
  const recordedChange=_isUnranked(afterRank)?null:_optionalNumber(m.rrChange);
  let beforeRR=(!_isUnranked(previousRank)&&chainIntact)?previousRR:null;
  let beforeSource=beforeRR===null?"unknown":previousRRSource;
  let afterRR=recordedAfterRR,afterSource=recordedAfterRR===null?"unknown":"recorded";
  let change=recordedChange,changeSource=recordedChange===null?"unknown":"recorded";
  const sameRank=!_isUnranked(previousRank)&&previousRank===afterRank;
  const placement=_isUnranked(previousRank)&&!_isUnranked(afterRank);

  // Same-tier arithmetic is the only safe automatic RR derivation. Rank-boundary math is not guessed.
  if(sameRank){
   if(afterRR===null&&beforeRR!==null&&change!==null){
    const candidate=beforeRR+change;
    if(candidate>=0&&candidate<=100){afterRR=candidate;afterSource="derived"}
   }
   if(beforeRR===null&&afterRR!==null&&change!==null){
    const candidate=afterRR-change;
    if(candidate>=0&&candidate<=100){beforeRR=candidate;beforeSource="derived"}
   }
   if(change===null&&beforeRR!==null&&afterRR!==null){change=afterRR-beforeRR;changeSource="derived"}
  }

  let event=String(m.rankStatus||"").trim();
  if(placement)event="Placed";
  else if(_isUnranked(previousRank)&&_isUnranked(afterRank))event="Same Rank";
  else if(!["Same Rank","Placed","Promoted","Demoted"].includes(event)){
   const bi=_ranks.indexOf(previousRank),ai=_ranks.indexOf(afterRank);
   event=ai===bi?"Same Rank":ai>bi?"Promoted":ai<bi?"Demoted":"unknown";
  }
  const state={
   matchNo:Number(m.no),
   before:{rank:_stateValue(previousRank,"derived"),rr:_stateValue(beforeRR,beforeSource)},
   change:{rr:_stateValue(change,changeSource)},
   after:{rank:_stateValue(afterRank,m.rankAfter?"recorded":"derived"),rr:_stateValue(afterRR,afterSource)},
   event:{value:event||"unknown",source:m.rankStatus?"recorded":"derived"}
  };
  states.push(state);

  previousRank=afterRank;
  // Placement/rank changes and missing links break absolute RR derivation unless this match records an anchor.
  if(_isUnranked(afterRank)){previousRR=null;previousRRSource="unknown";chainIntact=false}
  else if(afterRR!==null){previousRR=afterRR;previousRRSource=afterSource;chainIntact=true}
  else {previousRR=null;previousRRSource="unknown";chainIntact=false}
 }
 rankProgressionRuntime.set(challenge,states);
 return states;
}
function challengeRankProgression(challenge){
 const c=challenge!==undefined?challenge:(typeof data!=="undefined"?data:(typeof global!=="undefined"?global.data:(typeof window!=="undefined"?window.data:null)));
 if(!c)return [];
 return rebuildChallengeRankProgression(c);
}
function rankStateForMatch(matchNo,challenge){
 const c=challenge!==undefined?challenge:(typeof data!=="undefined"?data:(typeof global!=="undefined"?global.data:(typeof window!=="undefined"?window.data:null)));
 return challengeRankProgression(c).find(s=>s.matchNo===Number(matchNo))||null;
}
function latestRankState(challenge){
 const c=challenge!==undefined?challenge:(typeof data!=="undefined"?data:(typeof global!=="undefined"?global.data:(typeof window!=="undefined"?window.data:null)));
 const s=challengeRankProgression(c);
 return s.length?s[s.length-1]:null;
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={
  rankProgressionRuntime,
  rebuildChallengeRankProgression,
  challengeRankProgression,
  rankStateForMatch,
  latestRankState
 };
}
