// localStorage reads and the legacy `vct2` fallback. Owns the top-level app state.
function safeRead(key,fallback){
 try{
   const raw=localStorage.getItem(key);
   return raw===null?fallback:JSON.parse(raw);
 }catch(err){
   console.warn(`Could not read ${key}`,err);
   return fallback;
 }
}
let data=safeRead("vct4",null);
let activeChallenges=safeRead("vctActiveChallenges",[]);
let archives=safeRead("vctArchives",[]);
if(!Array.isArray(activeChallenges))activeChallenges=[];
if(!Array.isArray(archives))archives=[];
if(!data){
 const legacy=safeRead("vct2",null);
 if(legacy && typeof legacy==="object")data=legacy;
}
