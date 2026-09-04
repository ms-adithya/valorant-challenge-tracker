// Runtime rank/RR progression derivation.
// Runtime-only, provenance-aware rank/RR progression. Derived values are never persisted.
// Priority: recorded > safely derived > unknown. Never guess across an information gap.
const rankProgressionRuntime=new WeakMap();

function rebuildChallengeRankProgression(challenge){
 if(!challenge||!Array.isArray(challenge.matches)){return []}
 const ordered=challenge.matches.slice().sort((a,b)=>Number(a.no)-Number(b.no));
 let previousRank=rankValue(challenge.startRank)||"Unranked";
 let previousRR=isUnranked(previousRank)?null:optionalNumber(challenge.startRR);
 let previousRRSource=previousRR===null?"unknown":"recorded";
 let chainIntact=previousRR!==null;
 const states=[];
 for(const m of ordered){
  const afterRank=rankValue(m.rankAfter)||previousRank;
  const recordedAfterRR=isUnranked(afterRank)?null:optionalNumber(m.rrAfter);
  const recordedChange=isUnranked(afterRank)?null:optionalNumber(m.rrChange);
  let beforeRR=(!isUnranked(previousRank)&&chainIntact)?previousRR:null;
  let beforeSource=beforeRR===null?"unknown":previousRRSource;
  let afterRR=recordedAfterRR,afterSource=recordedAfterRR===null?"unknown":"recorded";
  let change=recordedChange,changeSource=recordedChange===null?"unknown":"recorded";
  const sameRank=!isUnranked(previousRank)&&previousRank===afterRank;
  const placement=isUnranked(previousRank)&&!isUnranked(afterRank);

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
  else if(isUnranked(previousRank)&&isUnranked(afterRank))event="Same Rank";
  else if(!["Same Rank","Placed","Promoted","Demoted"].includes(event)){
   const bi=ranks.indexOf(previousRank),ai=ranks.indexOf(afterRank);
   event=ai===bi?"Same Rank":ai>bi?"Promoted":ai<bi?"Demoted":"unknown";
  }
  const state={
   matchNo:Number(m.no),
   before:{rank:stateValue(previousRank,"derived"),rr:stateValue(beforeRR,beforeSource)},
   change:{rr:stateValue(change,changeSource)},
   after:{rank:stateValue(afterRank,m.rankAfter?"recorded":"derived"),rr:stateValue(afterRR,afterSource)},
   event:{value:event||"unknown",source:m.rankStatus?"recorded":"derived"}
  };
  states.push(state);

  previousRank=afterRank;
  // Placement/rank changes and missing links break absolute RR derivation unless this match records an anchor.
  if(isUnranked(afterRank)){previousRR=null;previousRRSource="unknown";chainIntact=false}
  else if(afterRR!==null){previousRR=afterRR;previousRRSource=afterSource;chainIntact=true}
  else {previousRR=null;previousRRSource="unknown";chainIntact=false}
 }
 rankProgressionRuntime.set(challenge,states);
 return states;
}
function challengeRankProgression(challenge=data){
 if(!challenge)return [];
 return rebuildChallengeRankProgression(challenge);
}
function rankStateForMatch(matchNo,challenge=data){return challengeRankProgression(challenge).find(s=>s.matchNo===Number(matchNo))||null}
function latestRankState(challenge=data){const s=challengeRankProgression(challenge);return s.length?s[s.length-1]:null}
