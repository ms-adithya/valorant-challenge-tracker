// Match import: delimited parsing, header mapping, row validation and the modal shell.
const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 2 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 100,
  maxFieldLength: 4000,
  maxScoreStringLength: 24,
});

let pendingMatchImport=[];

function checkImportBounds(rows, textLength){
  if (typeof textLength === "number" && textLength > IMPORT_LIMITS.maxFileBytes) {
    throw new Error(`Import file is too large: ${textLength} bytes exceeds the ${IMPORT_LIMITS.maxFileBytes} byte limit.`);
  }
  checkImportRowCount(rows.length);
  const overWide = rows.find((row) => row.length > IMPORT_LIMITS.maxColumns);
  if (overWide) {
    throw new Error(`Import column count exceeds the ${IMPORT_LIMITS.maxColumns} column limit.`);
  }
  for (const row of rows) {
    for (const cell of row) {
      const value = String(cell ?? "");
      if (value.length > IMPORT_LIMITS.maxFieldLength) {
        throw new Error(`Import field exceeds the ${IMPORT_LIMITS.maxFieldLength} character field limit.`);
      }
    }
  }
}

function checkImportRowCount(rowCount){
  if (rowCount > IMPORT_LIMITS.maxRows) {
    throw new Error(`Import row count exceeds the ${IMPORT_LIMITS.maxRows} row limit.`);
  }
}

function importTextByteLength(text){
 return new TextEncoder().encode(text).byteLength;
}

function parseDelimited(text,delimiter=","){
 if (typeof text !== "string") throw new Error("Import content must be a string.");
 const size = importTextByteLength(text);
 if (size > IMPORT_LIMITS.maxFileBytes) {
   throw new Error(`Import file is too large: ${size} bytes exceeds the ${IMPORT_LIMITS.maxFileBytes} byte limit.`);
 }
 const rows=[];let row=[],cell="",quoted=false;
 const appendCell=value=>{
  if(cell.length+value.length>IMPORT_LIMITS.maxFieldLength){
   throw new Error(`Import field exceeds the ${IMPORT_LIMITS.maxFieldLength} character field limit.`);
  }
  cell+=value;
 };
 const pushCell=()=>{
  if(row.length>=IMPORT_LIMITS.maxColumns){
   throw new Error(`Import column count exceeds the ${IMPORT_LIMITS.maxColumns} column limit.`);
  }
  row.push(cell);cell="";
 };
 const pushRow=()=>{
  if(row.some(v=>String(v).trim()!=="")){
   if(rows.length>=IMPORT_LIMITS.maxRows){
    throw new Error(`Import row count exceeds the ${IMPORT_LIMITS.maxRows} row limit.`);
   }
   rows.push(row);
  }
  row=[];
 };
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'&&quoted&&next==='"'){appendCell('"');i++;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===delimiter&&!quoted){pushCell();continue}
  if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&next==="\n")i++;
   pushCell();pushRow();continue
  }
  appendCell(ch);
 }
 pushCell();pushRow();
 return rows;
}
function normHeader(v){return String(v||"").toLowerCase().replace(/[%Δ]/g,m=>m==="%"?"percent":"delta").replace(/[^a-z0-9]+/g,"").trim()}
const importHeaderMap={
 match:"no",no:"no",date:"date",result:"result",agent:"agent",map:"map",
 myscore:"myScore",yourscore:"myScore",score:"score",enemyscore:"enemyScore",
 rankafter:"rankAfter",rankstatus:"rankStatus",rrafter:"rrAfter",currentrr:"rrAfter",rrchange:"rrChange",rr:"rrChange",
 kills:"kills",deaths:"deaths",assists:"assists",dddelta:"ddDelta",dda:"ddDelta",
 hspercent:"hs",hs:"hs",acs:"acs",adr:"adr",kastpercent:"kast",kast:"kast",
 firstkills:"firstKills",firstdeaths:"firstDeaths",multikills:"multiKills",rounds:"rounds",roundsplayed:"rounds",notes:"notes"
};
function blankToNull(v){return v===undefined||v===null||String(v).trim()===""?null:String(v).trim()}
function importNum(v){const x=blankToNull(v);if(x===null)return null;const n=Number(String(x).replace(/^\+/,""));return Number.isFinite(n)?n:NaN}
function normaliseImportedObject(raw){
 const o={};Object.entries(raw||{}).forEach(([k,v])=>{const mapped=importHeaderMap[normHeader(k)]||k;o[mapped]=v});
 if(o.score && String(o.score).trim().length<=IMPORT_LIMITS.maxScoreStringLength && (o.myScore==null||o.enemyScore==null)){const m=String(o.score).match(/(\d+)\s*[-:]\s*(\d+)/);if(m){o.myScore=m[1];o.enemyScore=m[2]}}
 return o;
}

function enforceScoreStringLength(rawValue, fieldName){
 const value = blankToNull(rawValue);
 if (value === null) return null;
 if (value.length > IMPORT_LIMITS.maxScoreStringLength) {
  return `Score value exceeds the ${IMPORT_LIMITS.maxScoreStringLength} character limit for ${fieldName}.`;
 }
 return null;
}

const importFallbackRanks=["Unranked","Iron 1","Iron 2","Iron 3","Bronze 1","Bronze 2","Bronze 3","Silver 1","Silver 2","Silver 3","Gold 1","Gold 2","Gold 3","Platinum 1","Platinum 2","Platinum 3","Diamond 1","Diamond 2","Diamond 3","Ascendant 1","Ascendant 2","Ascendant 3","Immortal 1","Immortal 2","Immortal 3","Radiant"];
const getRanks=()=>typeof ranks!=="undefined"?ranks:(typeof global!=="undefined"&&global.ranks?global.ranks:(typeof defaultRanksList!=="undefined"?defaultRanksList:importFallbackRanks));
const checkIsUnranked=r=>typeof isUnranked==="function"?isUnranked(r):(r==="Unranked");

function validateImportedMatch(raw,previous,index){
 const o=normaliseImportedObject(raw),errors=[];
 const result=String(o.result||"").trim().toLowerCase();
 const canonicalResult=result==="win"?"Win":result==="loss"?"Loss":result==="draw"?"Draw":"";

 [
  ["score", o.score],
  ["myScore", o.myScore],
  ["enemyScore", o.enemyScore],
  ["rounds", o.rounds],
 ].forEach(([fieldName, rawValue]) => {
  const issue = enforceScoreStringLength(rawValue, fieldName);
  if (issue) errors.push(issue);
 });

 const my=importNum(o.myScore),enemy=importNum(o.enemyScore);
 if(!canonicalResult)errors.push("Result must be Win, Loss or Draw.");
 if(!String(o.agent||"").trim())errors.push("Agent is required.");
 if(!String(o.map||"").trim())errors.push("Map is required.");
 if(!Number.isFinite(my)||!Number.isFinite(enemy))errors.push("Both score values are required numbers.");
 else{
  if(!Number.isInteger(my)||!Number.isInteger(enemy))errors.push("Score values must be whole numbers.");
  if(my<0||enemy<0)errors.push("Score values cannot be negative.");
  if(my===0&&enemy===0)errors.push("A completed match cannot be 0–0.");
  if(canonicalResult==="Win"&&my<=enemy)errors.push("Win requires your score to be higher.");
  if(canonicalResult==="Loss"&&my>=enemy)errors.push("Loss requires your score to be lower.");
  if(canonicalResult==="Draw"&&my!==enemy)errors.push("Draw requires equal scores.");
 }
 const currentRanks=getRanks();
 const rankAfter=String(o.rankAfter||previous?.rankAfter||"").trim();
 let rankStatus=String(o.rankStatus||"").trim();
 let rankStatusAdjusted="";
 if(!currentRanks.includes(rankAfter))errors.push("Rank After is missing or not recognised.");
 if(previous&&currentRanks.includes(rankAfter)&&currentRanks.includes(previous.rankAfter)){
  const beforeIndex=currentRanks.indexOf(previous.rankAfter),afterIndex=currentRanks.indexOf(rankAfter);
  const inferred=checkIsUnranked(previous.rankAfter)?(checkIsUnranked(rankAfter)?"Same Rank":"Placed"):(checkIsUnranked(rankAfter)?"Invalid":afterIndex===beforeIndex?"Same Rank":afterIndex>beforeIndex?"Promoted":"Demoted");
  if(inferred!=="Invalid" && (!rankStatus||!["Same Rank","Placed","Promoted","Demoted"].includes(rankStatus)||rankStatus!==inferred)){
   rankStatusAdjusted=rankStatus?`${rankStatus} → ${inferred}`:`Auto: ${inferred}`;
   rankStatus=inferred;
  }
 }else if(!rankStatus){rankStatus="Same Rank"}
 if(!["Same Rank","Placed","Promoted","Demoted"].includes(rankStatus))errors.push("Rank Status must be Same Rank, Placed, Promoted or Demoted.");
 if(previous&&currentRanks.includes(rankAfter)){
  const validateRankTransitionFn=typeof validateRankTransition==="function"?validateRankTransition:(typeof global!=="undefined"&&global.validateRankTransition?global.validateRankTransition:null);
  if(validateRankTransitionFn){
   const re=validateRankTransitionFn(previous.rankAfter,rankAfter,rankStatus);if(re)errors.push(re);
  }
 }
 let rrAfter=importNum(o.rrAfter),rrChange=importNum(o.rrChange);
 if(checkIsUnranked(rankAfter)){rrAfter=null;rrChange=null;}
 if(Number.isNaN(rrAfter)||(rrAfter!==null&&(rrAfter<0||rrAfter>100)))errors.push("RR After must be between 0 and 100 when provided.");
 if(Number.isNaN(rrChange))errors.push("RR Change must be numeric when provided.");
 if(rankStatus==="Promoted"&&rrChange!==null&&Number.isFinite(rrChange)&&rrChange<=0)errors.push("Promoted requires positive RR change when RR Change is provided.");
 if(rankStatus==="Demoted"&&rrChange!==null&&Number.isFinite(rrChange)&&rrChange>=0)errors.push("Demoted requires negative RR change when RR Change is provided.");
 const expected=Number.isFinite(my)&&Number.isFinite(enemy)?my+enemy:null;
 let rounds=importNum(o.rounds);if(rounds===null&&expected!==null)rounds=expected;
 if(expected!==null&&rounds!==expected)errors.push(`Rounds must equal the score total (${expected}).`);
 const nullableKeys=["kills","deaths","assists","acs","adr","firstKills","firstDeaths","multiKills"];
 nullableKeys.forEach(k=>{const v=importNum(o[k]);if(Number.isNaN(v))errors.push(`${k} must be numeric.`);else if(v!==null&&v<0)errors.push(`${k} cannot be negative.`)});
 ["hs","kast"].forEach(k=>{const v=importNum(o[k]);if(Number.isNaN(v)|| (v!==null&&(v<0||v>100)))errors.push(`${k.toUpperCase()} must be between 0 and 100.`)});
 const dd=importNum(o.ddDelta);if(Number.isNaN(dd))errors.push("DDΔ must be numeric.");
 const n=k=>{const v=importNum(o[k]);return v===null?null:v};
 const match={
  no:index,date:blankToNull(o.date)||new Date().toISOString(),result:canonicalResult,
  agent:String(o.agent||"").trim(),map:String(o.map||"").trim(),myScore:my,enemyScore:enemy,
  rankAfter,rankStatus,rrAfter,rrChange,kills:n("kills"),deaths:n("deaths"),assists:n("assists"),
  acs:n("acs"),adr:n("adr"),ddDelta:n("ddDelta"),hs:n("hs"),kast:n("kast"),
  firstKills:n("firstKills"),firstDeaths:n("firstDeaths"),multiKills:n("multiKills"),
  rounds,notes:String(o.notes||"").trim()
 };
 return {match,errors,raw:o,rankStatusAdjusted};
}
function openImportMatchesModal(){if(typeof $==="function"&&$("importMatchesModal")){$("importMatchesModal").classList.remove("hidden");$("importMatchesModal").setAttribute("aria-hidden","false")}}
function closeImportMatchesModal(){if(typeof $==="function"&&$("importMatchesModal")){$("importMatchesModal").classList.add("hidden");$("importMatchesModal").setAttribute("aria-hidden","true");}pendingMatchImport=[]}

if(typeof document!=="undefined"){
 const importCloseEls=document.querySelectorAll ? document.querySelectorAll("[data-import-close]") : [];
 importCloseEls.forEach(x=>x.addEventListener("click",closeImportMatchesModal));

 if (typeof document.addEventListener === "function") {
  document.addEventListener("click",e=>{
   const modal=typeof $==="function"?$("importMatchesModal"):null;
   if(!modal||modal.classList.contains("hidden"))return;
   if(e.target.closest("[data-import-close]")){
    e.preventDefault();
    e.stopPropagation();
    closeImportMatchesModal();
   }
  });
  document.addEventListener("keydown",e=>{
   if(e.key==="Escape"&&typeof $==="function"&&!$("importMatchesModal")?.classList.contains("hidden"))closeImportMatchesModal();
  });
 }
}

if(typeof module!=="undefined"&&module.exports){
 module.exports={
  IMPORT_LIMITS,
  checkImportBounds,
  importTextByteLength,
  parseDelimited,
  normHeader,
  normaliseImportedObject,
  validateImportedMatch,
  pendingMatchImport
 };
}
