// Completed-challenge report: stats, CSV/JSON export and the downloadable PDF.
function reportValue(v,suffix=""){const n=optionalNumber(v);return n===null?"—":`${n}${suffix}`;}
function challengeReportStats(c){
 const ms=(c.matches||[]).slice().sort((a,b)=>Number(a.no)-Number(b.no)), wins=ms.filter(m=>m.result==="Win").length,losses=ms.filter(m=>m.result==="Loss").length,draws=ms.filter(m=>m.result==="Draw").length;
 const nums=k=>ms.map(m=>optionalNumber(m[k])).filter(v=>v!==null), av=k=>{const a=nums(k);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
 const kills=nums("kills").reduce((a,b)=>a+b,0),deaths=nums("deaths").reduce((a,b)=>a+b,0),rr=nums("rrChange");
 return {ms,wins,losses,draws,wr:ms.length?wins/ms.length*100:0,kd:deaths?kills/deaths:(kills||null),acs:av("acs"),adr:av("adr"),dda:av("ddDelta"),kast:av("kast"),hs:av("hs"),netRR:rr.length?rr.reduce((a,b)=>a+b,0):null,finalRank:ms.at(-1)?.rankAfter||c.startRank,finalRR:optionalNumber(ms.at(-1)?.rrAfter)};
}
function downloadText(filename,text,type){downloadBlob(filename,new Blob([text],{type}));}
function downloadBlob(filename,blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);}
function csvCell(v){const x=v===null||v===undefined?"":String(v);return `"${x.replace(/"/g,'""')}"`;}
function reportFileStem(c){return (c.name||"challenge").replace(/[^a-z0-9_-]+/gi,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"challenge";}
window.exportChallengeCSV=function(id){const c=findChallengeById(id);if(!c)return;const fields=["no","agent","map","result","myScore","enemyScore","rankStatus","rankAfter","kills","deaths","assists","acs","adr","ddDelta","hs","kast","rrAfter","rrChange","firstKills","firstDeaths","multiKills","rounds","notes"];const rows=[fields.join(","),...(c.matches||[]).slice().sort((a,b)=>a.no-b.no).map(m=>fields.map(k=>csvCell(m[k])).join(","))];downloadText(`${reportFileStem(c)}-matches.csv`,rows.join("\n"),"text/csv;charset=utf-8");};
window.exportChallengeJSON=function(id){const c=findChallengeById(id);if(!c)return;downloadText(`${reportFileStem(c)}-report.json`,JSON.stringify({exportedAt:new Date().toISOString(),challenge:c,analytics:challengeReportStats(c)},null,2),"application/json");};

/* ---------------------------------------------------------------------------
   PDF report. Built from the stats objects with jsPDF + autoTable rather than
   rasterising the DOM, so the tables stay selectable, paginate properly and
   never touch a canvas — nothing here loads an image, so there is no origin to
   taint when the app runs from file://.
--------------------------------------------------------------------------- */
// The jsPDF core fonts are WinAnsi-encoded, so anything outside Latin-1 has to
// be folded down first. NFKC recovers most of it (Ⅲ → III, ﬁ → fi, full-width
// forms → ASCII); emoji and anything still unmappable are dropped rather than
// turned into "?", so a challenge name like "🎯 Grind" reads as "Grind".
const PDF_SUBS={"—":"-","–":"-","→":"->","←":"<-","’":"'","‘":"'","“":'"',"”":'"',"≥":">=","≤":"<="};
function pdfText(v){
 return String(v??"").normalize("NFKC")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu,"")
  .replace(/[^\x20-\x7E\xA0-\xFF]/gu,ch=>PDF_SUBS[ch]??"")
  .replace(/ {2,}/g," ").trim();
}
const PDF_INK=[22,25,29],PDF_MUTED=[104,114,124],PDF_LINE=[216,221,226],PDF_ACCENT=[237,77,88],PDF_WIN=[47,160,108],PDF_LOSS=[214,61,73],PDF_MARGIN=42;

function challengeReportGroups(ms,key){
 return Object.entries(ms.reduce((o,m)=>{const n=m[key]||"Unknown";o[n]??={n:0,w:0,k:0,d:0};o[n].n++;if(m.result==="Win")o[n].w++;o[n].k+=Number(m.kills)||0;o[n].d+=Number(m.deaths)||0;return o;},{})).sort((a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0]));
}
function challengeReportGroupRows(ms,key){
 return challengeReportGroups(ms,key).map(([n,v])=>[pdfText(n),String(v.n),`${(v.w/v.n*100).toFixed(1)}%`,v.d?(v.k/v.d).toFixed(2):String(v.k||"-")]);
}
function challengeReportTiles(s){
 const dec=v=>v===null?"-":v.toFixed(1),pct=v=>v===null?"-":`${v.toFixed(1)}%`;
 return [["Record",`${s.wins}W · ${s.losses}L · ${s.draws}D`],["Win rate",`${s.wr.toFixed(1)}%`],["K/D",s.kd===null?"-":s.kd.toFixed(2)],["Net RR",s.netRR===null?"-":`${s.netRR>=0?"+":""}${s.netRR}`],["ACS",dec(s.acs)],["ADR",dec(s.adr)],["DD Delta",dec(s.dda)],["KAST / HS",`${pct(s.kast)} / ${pct(s.hs)}`]];
}
function challengeReportMatchRows(ms){
 return ms.map(m=>[`#${m.no}`,pdfText(m.result),pdfText(m.agent),pdfText(m.map),`${reportValue(m.myScore)}-${reportValue(m.enemyScore)}`,`${reportValue(m.kills)}/${reportValue(m.deaths)}/${reportValue(m.assists)}`,reportValue(m.acs),reportValue(m.adr),reportValue(m.ddDelta),reportValue(m.hs,"%"),reportValue(m.kast,"%"),reportValue(m.rrChange)].map(pdfText));
}
// Shrink a tile value until it clears the box, so a long "62.5% / 24.1%" never
// runs past its border.
function pdfFitText(doc,text,max,size){doc.setFontSize(size);while(size>7&&doc.getTextWidth(text)>max){size-=.5;doc.setFontSize(size);}return size;}
function drawReportTiles(doc,tiles,x,y,width){
 const cols=4,gap=9,w=(width-gap*(cols-1))/cols,h=46;
 tiles.forEach(([label,value],i)=>{
  const cx=x+(i%cols)*(w+gap),cy=y+Math.floor(i/cols)*(h+gap);
  doc.setDrawColor(...PDF_LINE);doc.setLineWidth(.7);doc.roundedRect(cx,cy,w,h,4,4);
  doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...PDF_MUTED);
  doc.text(pdfText(label).toUpperCase(),cx+8,cy+16);
  doc.setFont("helvetica","bold");doc.setTextColor(...PDF_INK);
  const t=pdfText(value);pdfFitText(doc,t,w-16,13);doc.text(t,cx+8,cy+35);
 });
 return y+Math.ceil(tiles.length/cols)*(h+gap)-gap;
}
function drawReportHeading(doc,label,y){
 doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(...PDF_INK);
 doc.text(pdfText(label),PDF_MARGIN,y);
 return y+7;
}
function buildChallengeReportPDF(c,s){
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:"pt",format:"a4",orientation:"portrait"});
 const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),width=pw-PDF_MARGIN*2;
 const styles={font:"helvetica",fontSize:8,cellPadding:4,textColor:PDF_INK,lineColor:PDF_LINE,lineWidth:.5,overflow:"linebreak"};
 const headStyles={fillColor:[243,245,247],textColor:PDF_INK,fontStyle:"bold",fontSize:8};
 const breakdown=(title,key,y)=>{
  // Keep the heading with at least the first rows of its table rather than
  // stranding it at the foot of the previous page.
  if(y>ph-120){doc.addPage();y=PDF_MARGIN+18;}
  y=drawReportHeading(doc,title,y)+4;
  doc.autoTable({startY:y,margin:{left:PDF_MARGIN,right:PDF_MARGIN,bottom:PDF_MARGIN+16},tableWidth:330,theme:"grid",styles,headStyles,
   head:[[key==="agent"?"Agent":"Map","Matches","Win rate","K/D"]],body:challengeReportGroupRows(s.ms,key),
   columnStyles:{0:{cellWidth:132},1:{cellWidth:60,halign:"right"},2:{cellWidth:66,halign:"right"},3:{cellWidth:72,halign:"right"}}});
  return doc.lastAutoTable.finalY;
 };
 // Header block.
 doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(...PDF_INK);
 doc.text(pdfText(c.name)||"Challenge report",PDF_MARGIN,58);
 doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...PDF_MUTED);
 doc.text(pdfText(`Completed challenge report · ${challengeProgressText(c,{history:true})}`),PDF_MARGIN,74);
 doc.text(pdfText(`${c.startRank} → ${s.finalRank}${s.finalRR===null?"":` · ${s.finalRR} RR`}`),PDF_MARGIN,87);
 doc.setDrawColor(...PDF_ACCENT);doc.setLineWidth(2);doc.line(PDF_MARGIN,95,PDF_MARGIN+width,95);

 let y=drawReportTiles(doc,challengeReportTiles(s),PDF_MARGIN,113,width)+28;
 y=breakdown("Agent breakdown","agent",y)+22;
 y=breakdown("Map breakdown","map",y)+22;
 if(y>ph-150){doc.addPage();y=PDF_MARGIN+18;}
 y=drawReportHeading(doc,"Match history",y)+4;
 doc.autoTable({startY:y,margin:{left:PDF_MARGIN,right:PDF_MARGIN,bottom:PDF_MARGIN+16},theme:"grid",headStyles,
  styles:{...styles,fontSize:7,cellPadding:3},
  head:[["Match","Result","Agent","Map","Score","K/D/A","ACS","ADR","DD","HS","KAST","RR"]],
  body:challengeReportMatchRows(s.ms),
  // Agent and Map are left flexible so autoTable can absorb the leftover width
  // and the table spans the full content column on any page size.
  columnStyles:{0:{cellWidth:34},1:{cellWidth:36},4:{cellWidth:40,halign:"right"},5:{cellWidth:56,halign:"right"},6:{cellWidth:32,halign:"right"},7:{cellWidth:32,halign:"right"},8:{cellWidth:34,halign:"right"},9:{cellWidth:36,halign:"right"},10:{cellWidth:38,halign:"right"},11:{cellWidth:35,halign:"right"}},
  didParseCell:d=>{if(d.section==="body"&&d.column.index===1){const r=d.cell.raw;if(r==="Win"){d.cell.styles.textColor=PDF_WIN;d.cell.styles.fontStyle="bold";}else if(r==="Loss"){d.cell.styles.textColor=PDF_LOSS;}}}});

 // Footers last, so the page count is final.
 const total=doc.internal.getNumberOfPages(),stamp=pdfText(`${c.name||"Challenge"} · generated ${new Date().toLocaleString()}`)||"Challenge report";
 for(let p=1;p<=total;p++){
  doc.setPage(p);
  doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...PDF_MUTED);
  doc.text(stamp,PDF_MARGIN,ph-24);
  doc.text(`Page ${p} of ${total}`,pw-PDF_MARGIN,ph-24,{align:"right"});
 }
 return doc;
}
window.downloadChallengeReportPDF=function(id){
 const c=findChallengeById(id);
 if(!c||!challengeComplete(c))return;
 if(!window.jspdf?.jsPDF){showAppNotice("The PDF library failed to load, so the report could not be generated. Reload the page and try again.","Report unavailable");return;}
 try{downloadBlob(`${reportFileStem(c)}-report.pdf`,buildChallengeReportPDF(c,challengeReportStats(c)).output("blob"));}
 catch(err){console.error("Challenge report PDF failed",err);showAppNotice("The challenge report could not be generated. Your match data is unchanged.","Report failed");}
};
// Older call sites (and the archive list) still reach the report through these.
window.openChallengeReport=function(id){downloadChallengeReportPDF(id);};
window.showChallengeExportMenu=function(id){downloadChallengeReportPDF(id);};
