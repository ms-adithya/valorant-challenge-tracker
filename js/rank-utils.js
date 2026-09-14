// Rank primitives. Declared early: rebuildChallengeRankProgression() runs during
// startup normalisation and needs isUnranked()/rankValue()/stateValue() available.
const fallbackRanks=["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"];

function rankIndex(rank){
 const r = typeof ranks !== "undefined" ? ranks : fallbackRanks;
 return r.indexOf(rank);
}
function isUnranked(rank){return rank==="Unranked"}

function rankValue(v){
 const r = typeof ranks !== "undefined" ? ranks : fallbackRanks;
 const x=String(v??"").trim();
 return r.includes(x)?x:null;
}
function stateValue(value,source="unknown"){return {value:value??null,source:value===null||value===undefined?"unknown":source}}

if(typeof module!=="undefined"&&module.exports){
 module.exports={rankIndex,isUnranked,rankValue,stateValue};
}
