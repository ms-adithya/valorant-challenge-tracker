// localStorage reads and the legacy `vct2` fallback. Owns the top-level app state.
function safeRead(key,fallback){
 try{
   if(typeof localStorage==="undefined")return fallback;
   const raw=localStorage.getItem(key);
   return raw===null?fallback:JSON.parse(raw);
 }catch(err){
   console.warn(`Could not read ${key}`,err);
   return fallback;
 }
}
function isValidChallengeDoc(c){
 return Boolean(c && typeof c==="object" && !Array.isArray(c));
}
function sanitizeChallengeData(c){
 if(!isValidChallengeDoc(c))return null;
 if(!Array.isArray(c.matches))c.matches=[];
 else c.matches=c.matches.filter(m=>m&&typeof m==="object"&&!Array.isArray(m));
 return c;
}

let data=safeRead("vct4",null);
if(!isValidChallengeDoc(data))data=null;
let activeChallenges=safeRead("vctActiveChallenges",[]);
let archives=safeRead("vctArchives",[]);
if(!Array.isArray(activeChallenges))activeChallenges=[];
if(!Array.isArray(archives))archives=[];
activeChallenges=activeChallenges.filter(isValidChallengeDoc);
archives=archives.filter(isValidChallengeDoc);
if(!data){
 const legacy=safeRead("vct2",null);
 if(isValidChallengeDoc(legacy))data=legacy;
}
if(data)sanitizeChallengeData(data);
activeChallenges.forEach(sanitizeChallengeData);
archives.forEach(sanitizeChallengeData);

if(typeof module!=="undefined"&&module.exports){
 module.exports={safeRead,isValidChallengeDoc,sanitizeChallengeData};
}

