import {useEffect,useState} from 'react';
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut,type User} from 'firebase/auth';
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,collection,doc,onSnapshot,setDoc,updateDoc,writeBatch} from 'firebase/firestore';
import config from './firebase-config.json';
import {defaults,type Settings,type Session,type SetLog,nextPosition,completeSession} from './model';
const existing=getApps()[0];
const app=existing||initializeApp(config);
export const auth=getAuth(app);
const db=existing?getFirestore(app):initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
const key='form-workout-v1';
function readLocal(scope:string){try{return JSON.parse(localStorage.getItem(key+scope)||'null')||{settings:defaults,sessions:[]};}catch{return{settings:defaults,sessions:[]};}}
function pack(s:Session){const sets:Record<string,SetLog>={};s.exercises.forEach(e=>e.sets.forEach(x=>sets[x.id]=x));return{...s,exercises:s.exercises.map(e=>({exercise:e.exercise,setIds:e.sets.map(x=>x.id)})),sets};}
function unpack(d:any):Session{return{...d,exercises:d.exercises.map((e:any)=>({exercise:e.exercise,sets:e.setIds.map((id:string)=>d.sets[id])}))};}
export function useWorkoutStore(){
 const[user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[ready,setReady]=useState(false),[loadedScope,setLoadedScope]=useState(''),[settings,setSettings]=useState<Settings>(defaults),[sessions,setSessions]=useState<Session[]>([]),[status,setStatus]=useState('Saved on device'),[error,setError]=useState('');
 useEffect(()=>onAuthStateChanged(auth,u=>{if(u&&u.email!=='akshayakn6@gmail.com'){setError('This is a private journal. Please use the owner’s Google account.');void signOut(auth);return;}setUser(u);setAuthReady(true);}),[]);
 useEffect(()=>{if(!authReady)return;setReady(false);setLoadedScope(user?.uid||'guest');const local=readLocal(user?.uid||'guest');setSettings(local.settings);setSessions(local.sessions);if(!user){setStatus('Saved on device');setReady(true);return;}
  let a=false,b=false;const loaded=()=>{if(a&&b)setReady(true);};
  const stopSettings=onSnapshot(doc(db,'users',user.uid,'profile','settings'),{includeMetadataChanges:true},s=>{if(s.exists())setSettings(s.data() as Settings);else if(!s.metadata.fromCache)setSettings(defaults);a=true;loaded();},e=>{setError(e.message);setReady(true);});
  const stopSessions=onSnapshot(collection(db,'users',user.uid,'sessions'),{includeMetadataChanges:true},s=>{setSessions(s.docs.map(d=>unpack(d.data())));setStatus(s.metadata.hasPendingWrites?'Saved on device · syncing':s.metadata.fromCache?'Available offline':'Synced');b=true;loaded();},e=>{setError(e.message);setReady(true);});
  return()=>{stopSettings();stopSessions();};
 },[user,authReady]);
 useEffect(()=>{if(!ready||loadedScope!==(user?.uid||'guest'))return;try{localStorage.setItem(key+(user?.uid||'guest'),JSON.stringify({settings,sessions}));}catch{setError('Device storage is full. Export your data before closing the app.');}},[settings,sessions,user,ready,loadedScope]);
 const fail=(e:any)=>setError(`Could not sync: ${e.message}. Your device copy is retained.`);
 function saveSettings(next:Settings){setSettings(next);if(user)void setDoc(doc(db,'users',user.uid,'profile','settings'),next).catch(fail);}
 function addSession(s:Session){setSessions(old=>[...old,s]);if(user)void setDoc(doc(db,'users',user.uid,'sessions',s.id),pack(s)).catch(fail);}
 function editSet(session:Session,exerciseIndex:number,setIndex:number,next:SetLog){setSessions(old=>old.map(s=>s.id!==session.id?s:{...s,exercises:s.exercises.map((e,i)=>i!==exerciseIndex?e:{...e,sets:e.sets.map((v,j)=>j===setIndex?next:v)})}));if(user)void updateDoc(doc(db,'users',user.uid,'sessions',session.id),{[`sets.${next.id}`]:next}).catch(fail);}
 function updateLivePreferences(session:Session,e:import('./model').Exercise){if(session.finishedAt)return;const exercises=session.exercises.map(x=>x.exercise.id===e.id?{...x,exercise:{...x.exercise,step:e.step}}:x);setSessions(old=>old.map(s=>s.id===session.id?{...s,exercises}:s));if(user)void updateDoc(doc(db,'users',user.uid,'sessions',session.id),{exercises:exercises.map(x=>({exercise:x.exercise,setIds:x.sets.map(s=>s.id)}))}).catch(fail);}
 function finish(s:Session){if(s.finishedAt)return;const finished=completeSession(s),next={...settings,...nextPosition(s)};setSessions(old=>old.map(x=>x.id===s.id?finished:x));setSettings(next);if(user){const batch=writeBatch(db);batch.update(doc(db,'users',user.uid,'sessions',s.id),{finishedAt:finished.finishedAt,...Object.fromEntries(finished.exercises.flatMap(e=>e.sets.map(x=>[`sets.${x.id}`,x])))});batch.set(doc(db,'users',user.uid,'profile','settings'),next);void batch.commit().catch(fail);}}
 async function login(){try{setError('');const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e:any){setError(e.code==='auth/popup-blocked'?'Allow the Google sign-in window, then try again.':e.message);}}
 const device=readLocal('guest');
 const hasDeviceWorkouts=!!user&&device.sessions.some((s:Session)=>!sessions.some(x=>x.id===s.id));
 function importDevice(){if(!user)return;const added=device.sessions.filter((s:Session)=>!sessions.some(x=>x.id===s.id));if(!added.length)return;const batch=writeBatch(db);added.forEach((s:Session)=>batch.set(doc(db,'users',user.uid,'sessions',s.id),pack(s)));if(!sessions.length){batch.set(doc(db,'users',user.uid,'profile','settings'),device.settings);setSettings(device.settings);}setSessions(old=>[...old,...added]);void batch.commit().catch(fail);}
 return{user,ready,settings,sessions,status,error,setError,saveSettings,addSession,editSet,updateLivePreferences,finish,login,hasDeviceWorkouts,importDevice,logout:()=>signOut(auth)};
}
