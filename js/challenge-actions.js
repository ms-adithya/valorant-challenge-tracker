// Open / archive / unarchive / delete actions for challenges (exposed on window
// because the challenge list renders inline onclick handlers).
window.openActiveChallenge=(id)=>{
 const chosen=activeChallenges.find(c=>c.id===id);if(!chosen)return;
 data=chosen;persist();render();showPage("overview");
};
window.archiveActiveChallenge=async (id)=>{
 const challenge=activeChallenges.find(c=>c.id===id);if(!challenge)return;
 if(!await appConfirm({title:`Archive "${challenge.name}"?`,message:"It will leave your active challenges and can be restored later.",confirmText:"Archive challenge",kicker:"ARCHIVE CHALLENGE",danger:false}))return;
 activeChallenges=activeChallenges.filter(c=>c.id!==id);
 archives.unshift({...challenge,archivedAt:new Date().toISOString()});
 if(data&&data.id===id)data=activeChallenges[0]||null;
 persist();render();if(data)showPage("challenges");
};
window.deleteActiveById=async (id)=>{
 const challenge=activeChallenges.find(c=>c.id===id);if(!challenge)return;
 if(!await appConfirm({title:`Delete "${challenge.name}"?`,message:"This permanently removes the active challenge and all of its match data.",confirmText:"Delete permanently",kicker:"DELETE CHALLENGE"}))return;
 activeChallenges=activeChallenges.filter(c=>c.id!==id);
 if(data&&data.id===id)data=activeChallenges[0]||null;
 persist();render();if(data)showPage("challenges");
};
window.deleteActiveChallenge=async ()=>{
 if(!data)return;
 const id=data.id;
 await deleteActiveById(id);
 closeChallengeOptions();
};
window.deleteArchivedChallenge=async (archiveIndex)=>{
 const challenge=archives[archiveIndex];if(!challenge)return;
 if(!await appConfirm({title:`Delete "${challenge.name}"?`,message:"This permanently removes this archived challenge and all of its match data. This cannot be undone.",confirmText:"Delete permanently",kicker:"DELETE ARCHIVE"}))return;
 archives.splice(archiveIndex,1);
 try{persist()}catch(err){console.error(err);showAppNotice("Could not update browser storage after deleting the archived challenge.","Storage error");}
 renderArchive();
 renderArchiveBrowser();
 if(window.renderSetupRestore)renderSetupRestore();
 if(archives.length===0)closeArchiveBrowser();
};
window.archiveCurrent=async ()=>{if(!data)return;await archiveActiveChallenge(data.id);};
window.unarchiveChallenge=async (archiveIndex)=>{
 const restored=archives[archiveIndex];if(!restored)return;
 archives.splice(archiveIndex,1);
 const {archivedAt,...activeChallenge}=restored;
 ensureChallengeId(activeChallenge);
 activeChallenges.push(activeChallenge);
 data=activeChallenge;
 persist();render();showPage("overview");
};
