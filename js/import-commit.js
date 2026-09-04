// Match import: file reading, trigger buttons and committing the import.
async function readMatchImportFile(file){
 if(!data){showAppNotice("Open a challenge before importing matches.","No active challenge");return}
 if(!file)return;
 try{
  const text=(await file.text()).replace(/^\uFEFF/,"");
  let objects=[];
  if(file.name.toLowerCase().endsWith(".json")||file.type.includes("json")){
   const parsed=JSON.parse(text);
   if(Array.isArray(parsed))objects=parsed;
   else if(Array.isArray(parsed.matches))objects=parsed.matches;
   else if(Array.isArray(parsed.activeChallenge?.matches))objects=parsed.activeChallenge.matches;
   else throw new Error("No matches array found");
  }else{
   const delimiter=file.name.toLowerCase().endsWith(".tsv")?"\t":",";
   const rows=parseDelimited(text,delimiter);
   if(rows.length<2)throw new Error("No data rows found");
   const headers=rows[0];
   objects=rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??""])));
  }
  buildImportPreview(objects);
 }catch(err){
  console.error(err);showAppNotice("The file could not be read as CSV, TSV or compatible JSON. Exported tracker CSV files can be imported directly.","Import failed");
 }
}
if($("importMatchesBtn"))$("importMatchesBtn").addEventListener("click",()=>{if(!data){showAppNotice("Open a challenge before importing matches.","No active challenge");return}$("importMatchesFile").click()});
if($("importMatchesFile"))$("importMatchesFile").addEventListener("change",e=>{const file=e.target.files?.[0];readMatchImportFile(file);e.target.value=""});
async function commitPendingImport(){
 const btn=$("confirmImportMatchesBtn");
 if(!btn)return;
 if(btn.dataset.busy==="1")return;
 if(btn.dataset.mode==="fix"){
  closeImportMatchesModal();
  requestAnimationFrame(()=>$("importMatchesFile")?.click());
  return;
 }
 const valid=pendingMatchImport.filter(x=>!x.errors.length);
 const invalid=pendingMatchImport.filter(x=>x.errors.length);
 const bulk=pendingMatchImport.length>1;
 const readyOnly=bulk ? ($("importReadyOnly")?.checked!==false) : false;
 if(!valid.length)return;
 if(bulk&&invalid.length&&!readyOnly){showAppNotice("Some imported rows still need attention. Enable ‘Import ready only’ to import the valid rows and skip the rest, or fix the file first.","Import blocked");return}
 btn.dataset.busy="1";btn.disabled=true;
 const originalText=btn.textContent;btn.textContent="Importing…";
 const before=data.matches.slice();
 data.matches.push(...valid.map(x=>x.match));
 data.matches.sort((a,b)=>a.no-b.no);
 try{if(!persist())throw new Error("Browser storage rejected the import.");render();closeImportMatchesModal();showPage("matches");showToast(`${valid.length} match${valid.length===1?"":"es"} imported${invalid.length?` · ${invalid.length} row${invalid.length===1?"":"s"} skipped`:""}.`)}
 catch(err){data.matches=before;console.error(err);showAppNotice("Imported matches could not be saved to browser storage.","Import failed")}
 finally{if(btn){btn.dataset.busy="0";btn.disabled=false;if(!$("importMatchesModal")?.classList.contains("hidden"))renderImportPreview()}}
}
// The import modal is declared after app.js in index.html, so use delegated handling.
document.addEventListener("click",e=>{
 const trigger=e.target.closest("#confirmImportMatchesBtn");
 if(!trigger)return;
 e.preventDefault();e.stopPropagation();
 commitPendingImport();
});
