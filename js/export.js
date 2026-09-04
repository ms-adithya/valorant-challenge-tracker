// Match CSV export and full backup JSON export.
function exportMatchesCsv(){
 if(!data){showAppNotice("Open a challenge before exporting matches.","Nothing to export");return}
 const columns=[
  ["Match","no"],["Date","date"],["Result","result"],["Agent","agent"],["Map","map"],
  ["My Score","myScore"],["Enemy Score","enemyScore"],["Rank After","rankAfter"],["Rank Status","rankStatus"],
  ["RR After","rrAfter"],["RR Change","rrChange"],["Kills","kills"],["Deaths","deaths"],["Assists","assists"],
  ["K/D",null],["DDDelta","ddDelta"],["HS%","hs"],["ACS","acs"],["ADR","adr"],["KAST%","kast"],
  ["First Kills","firstKills"],["First Deaths","firstDeaths"],["Multi Kills","multiKills"],["Rounds","rounds"],["Notes","notes"]
 ];
 const rows=[columns.map(c=>csvCell(c[0])).join(",")];
 data.matches.forEach(m=>rows.push(columns.map(([_,key])=>csvCell(key===null?(m.deaths?(m.kills/m.deaths).toFixed(2):Number(m.kills||0).toFixed(2)):m[key])).join(",")));
 const blob=new Blob(["\ufeff"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download=`${(data.name||"challenge").replace(/[^a-z0-9_-]+/gi,"-")}-matches.csv`;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const exportCsvButton=$("exportCsv");
if(exportCsvButton)exportCsvButton.addEventListener("click",function(e){e.preventDefault();exportMatchesCsv()});
function exportBackupJson(){
 const payload={version:7,exportedAt:new Date().toISOString(),activeChallenge:data,activeChallenges,archives};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="valorant-challenge-tracker-backup.json";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if($("backupBtn"))$("backupBtn").addEventListener("click",exportBackupJson);
