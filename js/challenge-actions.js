// Open / archive / unarchive / delete actions for challenges (exposed on window
// because the challenge list renders inline onclick handlers).
const host = typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : {});
const safePersist=()=>(typeof persist==="function"?persist():(typeof host.persist==="function"?host.persist():(typeof global!=="undefined"&&typeof global.persist==="function"?global.persist():true)));

host.openActiveChallenge=(id)=>{
 const currentActive=typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[]);
 const chosen=currentActive.find(c=>c.id===id);if(!chosen)return;
 const prevData=typeof data!=="undefined"?data:host.data;
 data=chosen;if(typeof host!=="undefined")host.data=chosen;
 if(!safePersist()){data=prevData;if(typeof host!=="undefined")host.data=prevData;return;}
 if(typeof render==="function")render();
 if(typeof showPage==="function")showPage("overview");
};
host.archiveActiveChallenge=async (id)=>{
 const currentActive=typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[]);
 const challenge=currentActive.find(c=>c.id===id);if(!challenge)return;
 const confirmFn=typeof appConfirm==="function"?appConfirm:(typeof host.appConfirm==="function"?host.appConfirm:async ()=>true);
 if(!await confirmFn({title:`Archive "${challenge.name}"?`,message:"It will leave your active challenges and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 const prevActive=(typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[])).slice();
 const prevArchives=(typeof archives!=="undefined"?archives:(host.archives||[])).slice();
 const prevData=typeof data!=="undefined"?data:host.data;
 const updatedActive=prevActive.filter(c=>c.id!==id);
 const updatedArchives=[{...challenge,archivedAt:new Date().toISOString()},...prevArchives];
 activeChallenges=updatedActive;if(typeof host!=="undefined")host.activeChallenges=updatedActive;
 archives=updatedArchives;if(typeof host!=="undefined")host.archives=updatedArchives;
 if(prevData&&prevData.id===id){
  const nextData=updatedActive[0]||null;
  data=nextData;if(typeof host!=="undefined")host.data=nextData;
 }
 if(!safePersist()){
  activeChallenges=prevActive;if(typeof host!=="undefined")host.activeChallenges=prevActive;
  archives=prevArchives;if(typeof host!=="undefined")host.archives=prevArchives;
  data=prevData;if(typeof host!=="undefined")host.data=prevData;
  return;
 }
 if(typeof render==="function")render();
 if(data&&typeof showPage==="function")showPage("challenges");
};
host.deleteActiveById=async (id)=>{
 const currentActive=typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[]);
 const challenge=currentActive.find(c=>c.id===id);if(!challenge)return;
 const confirmFn=typeof appConfirm==="function"?appConfirm:(typeof host.appConfirm==="function"?host.appConfirm:async ()=>true);
 if(!await confirmFn({title:`Delete "${challenge.name}"?`,message:"This permanently removes the active challenge and all of its match data.",confirmText:"Delete permanently",kicker:"DELETE CHALLENGE"}))return;
 const prevActive=(typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[])).slice();
 const prevData=typeof data!=="undefined"?data:host.data;
 const updatedActive=prevActive.filter(c=>c.id!==id);
 activeChallenges=updatedActive;if(typeof host!=="undefined")host.activeChallenges=updatedActive;
 if(prevData&&prevData.id===id){
  const nextData=updatedActive[0]||null;
  data=nextData;if(typeof host!=="undefined")host.data=nextData;
 }
 if(!safePersist()){
  activeChallenges=prevActive;if(typeof host!=="undefined")host.activeChallenges=prevActive;
  data=prevData;if(typeof host!=="undefined")host.data=prevData;
  return;
 }
 if(typeof render==="function")render();
 if(data&&typeof showPage==="function")showPage("challenges");
};
host.deleteActiveChallenge=async ()=>{
 const currentData=typeof data!=="undefined"?data:host.data;
 if(!currentData)return;
 const id=currentData.id;
 await host.deleteActiveById(id);
 if(typeof closeChallengeOptions==="function")closeChallengeOptions();
};
host.deleteArchivedChallenge=async (id)=>{
 const currentArchives=typeof archives!=="undefined"?archives:(host.archives||[]);
 const archiveIndex=currentArchives.findIndex(c=>c.id===id);if(archiveIndex<0)return;
 const challenge=currentArchives[archiveIndex];if(!challenge)return;
 const confirmFn=typeof appConfirm==="function"?appConfirm:(typeof host.appConfirm==="function"?host.appConfirm:async ()=>true);
 if(!await confirmFn({title:`Delete "${challenge.name}"?`,message:"This permanently removes this archived challenge and all of its match data. This cannot be undone.",confirmText:"Delete permanently",kicker:"DELETE ARCHIVE"}))return;
 const prevArchives=currentArchives.slice();
 const updatedArchives=currentArchives.filter(c=>c.id!==id);
 archives=updatedArchives;if(typeof host!=="undefined")host.archives=updatedArchives;
 try{
  if(!safePersist()){
   archives=prevArchives;if(typeof host!=="undefined")host.archives=prevArchives;
   return;
  }
 }catch(err){
  archives=prevArchives;if(typeof host!=="undefined")host.archives=prevArchives;
  console.error(err);
  if(typeof showAppNotice==="function")showAppNotice("Could not update browser storage after deleting the archived challenge.","Storage error");
  return;
 }
 if(typeof renderArchive==="function")renderArchive();
 if(typeof renderArchiveBrowser==="function")renderArchiveBrowser();
 if(typeof renderSetupRestore==="function")renderSetupRestore();
 else if(typeof window!=="undefined"&&window.renderSetupRestore)window.renderSetupRestore();
 if(typeof closeArchiveBrowser==="function"&&updatedArchives.length===0)closeArchiveBrowser();
};
host.archiveCurrent=async ()=>{
 const currentData=typeof data!=="undefined"?data:host.data;
 if(!currentData)return;
 await host.archiveActiveChallenge(currentData.id);
};
host.unarchiveChallenge=async (id)=>{
 const currentArchives=typeof archives!=="undefined"?archives:(host.archives||[]);
 const idx=currentArchives.findIndex(c=>c.id===id);if(idx<0)return;
 const restored=currentArchives[idx];if(!restored)return;
 const prevArchives=currentArchives.slice();
 const prevActive=(typeof activeChallenges!=="undefined"?activeChallenges:(host.activeChallenges||[])).slice();
 const prevData=typeof data!=="undefined"?data:host.data;
 const updatedArchives=currentArchives.filter(c=>c.id!==id);
 archives=updatedArchives;if(typeof host!=="undefined")host.archives=updatedArchives;
 const {archivedAt,...activeChallenge}=restored;
 if(typeof ensureChallengeId==="function")ensureChallengeId(activeChallenge);
 const updatedActive=[...prevActive,activeChallenge];
 activeChallenges=updatedActive;if(typeof host!=="undefined")host.activeChallenges=updatedActive;
 data=activeChallenge;if(typeof host!=="undefined")host.data=activeChallenge;
 if(!safePersist()){
  archives=prevArchives;if(typeof host!=="undefined")host.archives=prevArchives;
  activeChallenges=prevActive;if(typeof host!=="undefined")host.activeChallenges=prevActive;
  data=prevData;if(typeof host!=="undefined")host.data=prevData;
  return;
 }
 if(typeof render==="function")render();
 if(typeof showPage==="function")showPage("overview");
};

if(typeof module!=="undefined"&&module.exports){
 module.exports={
  openActiveChallenge:host.openActiveChallenge,
  archiveActiveChallenge:host.archiveActiveChallenge,
  deleteActiveById:host.deleteActiveById,
  deleteActiveChallenge:host.deleteActiveChallenge,
  deleteArchivedChallenge:host.deleteArchivedChallenge,
  archiveCurrent:host.archiveCurrent,
  unarchiveChallenge:host.unarchiveChallenge
 };
}
