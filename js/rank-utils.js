// Rank primitives. Declared early: rebuildChallengeRankProgression() runs during
// startup normalisation and needs isUnranked()/rankValue()/stateValue() available.
function rankIndex(rank){return ranks.indexOf(rank)}
function isUnranked(rank){return rank==="Unranked"}

function rankValue(v){const x=String(v??"").trim();return ranks.includes(x)?x:null}
function stateValue(value,source="unknown"){return {value:value??null,source:value===null||value===undefined?"unknown":source}}
