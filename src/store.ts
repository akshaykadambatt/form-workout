import {useEffect,useRef,useState} from 'react';
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut,type User} from 'firebase/auth';
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,onSnapshot,setDoc,updateDoc,writeBatch,runTransaction,waitForPendingWrites} from 'firebase/firestore';
import config from './firebase-config.json';
import {defaults,type Settings,type Session,type SetLog,nextPosition,completeSession} from './model';
import {readLocal,writeLocal,preserveBackup,deviceImportPlan} from './device-journal';
const existing=getApps()[0];
const app=existing||initializeApp(config);
export const auth=getAuth(app);
const db=existing?getFirestore(app):initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
function pack(s:Session){const sets:Record<string,SetLog>={};s.exercises.forEach(e=>e.sets.forEach(x=>sets[x.id]=x));return{...s,exercises:s.exercises.map(e=>({exercise:e.exercise,setIds:e.sets.map(x=>x.id)})),sets};}
function unpack(d:any):Session{return{...d,exercises:d.exercises.map((e:any)=>({exercise:e.exercise,sets:e.setIds.map((id:string)=>d.sets[id])}))};}
export function useWorkoutStore(){
 const[user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[loaded,setLoaded]=useState(false),[loadedScope,setLoadedScope]=useState('');
 const[settings,setSettings]=useState<Settings>(defaults),[sessions,setSessions]=useState<Session[]>([]),[error,setError]=useState('');
 const[cloud,setCloud]=useState({settings:false,sessions:false,settingsPending:false,sessionsPending:false});
 const[importing,setImporting]=useState(false),[loggingOut,setLoggingOut]=useState(false),[pendingCount,setPendingCount]=useState(0),[syncFailed,setSyncFailed]=useState(false);
 const pending=useRef(new Set<Promise<unknown>>()),failed=useRef(false),importAttempt=useRef('');
 const journal=useRef({settings,sessions});journal.current={settings,sessions};
 const scope=user?.uid||'';
 const device=readLocal('guest');
 const plan=deviceImportPlan(device.sessions,sessions);
 const needsImport=!!user&&plan.missing.length>0;
 const ready=loaded&&!importing&&!needsImport&&!loggingOut;
 const status=!user?'Sign in to sync':loggingOut?'Finishing cloud saves…':importing?'Saving device workouts…':syncFailed?'Sync needs attention':needsImport?'Device workouts need sync':pendingCount||cloud.settingsPending||cloud.sessionsPending?'Saving to Firebase…':cloud.settings&&cloud.sessions?'Saved to Firebase':'Offline · cached journal';

 useEffect(()=>onAuthStateChanged(auth,u=>{
  setLoaded(false);
  if(u&&u.email!=='akshayakn6@gmail.com'){setError('This is a private journal. Please use the owner’s Google account.');void signOut(auth);return;}
  setUser(u);setAuthReady(true);
 }),[]);
 useEffect(()=>{
  if(!authReady)return;
  let live=true,a=false,b=false;
  setLoaded(false);setLoadedScope(scope);setCloud({settings:false,sessions:false,settingsPending:false,sessionsPending:false});
  failed.current=false;setSyncFailed(false);importAttempt.current='';setImporting(false);
  // Never replace the guest journal with an empty signed-out screen.
  if(!user){setSettings(defaults);setSessions([]);setLoaded(true);return;}
  const local=readLocal(scope);
  try{preserveBackup(scope,local);}catch{setError('Could not preserve the device backup. Export device backups before clearing storage.');}
  setSettings(local.settings);setSessions(local.sessions);
  const loaded=()=>{if(live&&a&&b)setLoaded(true);};
  const listenError=(e:Error)=>{if(live){setError(`Firebase could not be opened: ${e.message}`);setSyncFailed(true);}};
  const stopSettings=onSnapshot(doc(db,'users',scope,'profile','settings'),{includeMetadataChanges:true},s=>{
   if(!live)return;
   if(s.exists())setSettings(s.data() as Settings);else if(!s.metadata.fromCache)setSettings(defaults);
   setCloud(old=>({...old,settings:!s.metadata.fromCache,settingsPending:s.metadata.hasPendingWrites}));a=true;loaded();
  },listenError);
  const stopSessions=onSnapshot(collection(db,'users',scope,'sessions'),{includeMetadataChanges:true},s=>{
   if(!live)return;
   // An empty startup cache is not evidence that the saved journal is empty.
   if(!s.metadata.fromCache||s.docs.length)setSessions(s.docs.map(d=>unpack(d.data())));
   setCloud(old=>({...old,sessions:!s.metadata.fromCache,sessionsPending:s.metadata.hasPendingWrites}));b=true;loaded();
  },listenError);
  return()=>{live=false;stopSettings();stopSessions();};
 },[scope,authReady]);
 useEffect(()=>{
  if(!loaded||!user||loadedScope!==scope)return;
  try{writeLocal(scope,{settings,sessions});}catch{setError('Device storage is full. Export your data before closing the app.');}
 },[settings,sessions,scope,loaded,loadedScope,user]);

 function fail(e:any){failed.current=true;setSyncFailed(true);setError(`Could not save to Firebase: ${e.message}. A recovery copy is kept on this device; do not clear storage.`);}
 function track(work:Promise<unknown>){
  pending.current.add(work);setPendingCount(pending.current.size);
  const done=()=>{pending.current.delete(work);setPendingCount(pending.current.size);};
  void work.then(done,e=>{done();fail(e);});
 }
 function canWrite(){
  if(!user||auth.currentUser?.uid!==scope){setError('Sign in to save your workout to Firebase.');return false;}
  if(!ready||loadedScope!==scope){setError('Wait for your journal to finish syncing before editing.');return false;}
  return true;
 }
 function backup(changed?:Session,nextSettings=journal.current.settings){
  const records=journal.current.sessions;
  const next={settings:nextSettings,sessions:changed?[...records.filter(s=>s.id!==changed.id),changed]:records};
  try{preserveBackup(scope,next,changed);journal.current=next;return true;}
  catch{setError('Could not save a recovery copy. Free device storage or export your data before continuing.');return false;}
 }
 function saveSettings(next:Settings){if(!canWrite()||!backup(undefined,next))return;setSettings(next);track(setDoc(doc(db,'users',scope,'profile','settings'),next));}
 function addSession(s:Session){if(!canWrite()||!backup(s))return;setSessions(old=>[...old,s]);track(setDoc(doc(db,'users',scope,'sessions',s.id),pack(s)));}
 function editSet(session:Session,exerciseIndex:number,setIndex:number,next:SetLog){
  if(!canWrite())return;
  const current=journal.current.sessions.find(s=>s.id===session.id)||session;
  const updated={...current,exercises:current.exercises.map((e,i)=>i!==exerciseIndex?e:{...e,sets:e.sets.map((v,j)=>j===setIndex?next:v)})};
  if(!backup(updated))return;
  setSessions(old=>old.map(s=>s.id!==session.id?s:{...s,exercises:s.exercises.map((e,i)=>i!==exerciseIndex?e:{...e,sets:e.sets.map((v,j)=>j===setIndex?next:v)})}));
  track(updateDoc(doc(db,'users',scope,'sessions',session.id),{[`sets.${next.id}`]:next}));
 }
 function updateLivePreferences(session:Session,e:import('./model').Exercise){
  if(session.finishedAt||!canWrite())return;
  const exercises=session.exercises.map(x=>x.exercise.id===e.id?{...x,exercise:{...x.exercise,step:e.step}}:x);
  if(!backup({...session,exercises}))return;
  setSessions(old=>old.map(s=>s.id===session.id?{...s,exercises}:s));
  track(updateDoc(doc(db,'users',scope,'sessions',session.id),{exercises:exercises.map(x=>({exercise:x.exercise,setIds:x.sets.map(s=>s.id)}))}));
 }
 function finish(s:Session){
  if(s.finishedAt||!canWrite())return;
  const finished=completeSession(s),next={...settings,...nextPosition(s)};
  if(!backup(finished,next))return;
  setSessions(old=>old.map(x=>x.id===s.id?finished:x));setSettings(next);
  const batch=writeBatch(db);
  batch.update(doc(db,'users',scope,'sessions',s.id),{finishedAt:finished.finishedAt,...Object.fromEntries(finished.exercises.flatMap(e=>e.sets.map(x=>[`sets.${x.id}`,x])))});
  batch.set(doc(db,'users',scope,'profile','settings'),next);track(batch.commit());
 }
 async function login(){try{setError('');const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e:any){setError(e.code==='auth/popup-blocked'?'Allow the Google sign-in window, then try again.':e.message);}}
 async function importDevice(){
  if(!user||importing||!cloud.settings||!cloud.sessions)return;
  importAttempt.current=scope;setImporting(true);
  try{
   await runTransaction(db,async tx=>{
    const refs=device.sessions.map(s=>doc(db,'users',scope,'sessions',s.id));
    const existing=await Promise.all(refs.map(ref=>tx.get(ref)));
    const settingsRef=doc(db,'users',scope,'profile','settings'),profile=await tx.get(settingsRef);
    existing.forEach((snapshot,i)=>{if(!snapshot.exists())tx.set(refs[i],pack(device.sessions[i]));});
    if(!profile.exists()&&!sessions.length)tx.set(settingsRef,device.settings);
   });
   failed.current=false;setSyncFailed(false);setError('');
  }catch(e){fail(e);}finally{setImporting(false);}
 }
 useEffect(()=>{
  if(user&&loaded&&cloud.settings&&cloud.sessions&&needsImport&&!importing&&importAttempt.current!==scope)void importDevice();
 },[scope,loaded,cloud.settings,cloud.sessions,needsImport,importing]);
 async function logout(){
  if(!user||loggingOut)return;
  if(importing||needsImport){setError('Let device workouts finish saving to Firebase before signing out.');return;}
  if(failed.current){setError('A Firebase save failed. Stay signed in and export device backups before closing the app.');return;}
  setLoggingOut(true);let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
   await Promise.race([
    Promise.all([...pending.current,waitForPendingWrites(db)]),
    new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Still waiting for Firebase. Connect to the internet and try again.')),10000);}),
   ]);
   if(failed.current)throw new Error('A save failed. Your device recovery copy is available under Routine.');
   await signOut(auth);
  }catch(e:any){setError(`You are still signed in. ${e.message}`);}
  finally{clearTimeout(timeout);setLoggingOut(false);}
 }
 return{user,ready,settings,sessions,status,error,setError,saveSettings,addSession,editSet,updateLivePreferences,finish,login,logout,hasDeviceWorkouts:needsImport,importDevice,deviceConflicts:!!user?plan.conflicts.length:0};
}
