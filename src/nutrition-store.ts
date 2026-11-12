import {useEffect,useRef,useState} from 'react';
import type {FirebaseApp} from 'firebase/app';
import {collection,doc,onSnapshot,setDoc,updateDoc,type Firestore} from 'firebase/firestore';
import {bodyDefaults,type Body,type FoodDay,type FoodEntry,type Measurement} from './nutrition';
import {validDate,dateKey} from './model';
import {estimateFood} from './food-ai';

// Shares the device-backup prefix so "Export device backups" includes it.
const backupKey='form-workout-backup-v1:nutrition:';
type Copy={days:Record<string,FoodDay>;body:Body};
// Recovery copy: cloud values win for records they contain; records missing
// from the cloud are kept rather than dropped.
function preserve(scope:string,next:Partial<Copy>){
 try{
  const old=JSON.parse(localStorage.getItem(backupKey+scope)||'null') as Copy|null,days={...(old?.days||{})};
  Object.values(next.days||{}).forEach(d=>{days[d.date]={date:d.date,entries:{...(days[d.date]?.entries||{}),...d.entries}};});
  const body=next.body?{...next.body,measurements:{...(old?.body?.measurements||{}),...next.body.measurements}}:old?.body||bodyDefaults;
  localStorage.setItem(backupKey+scope,JSON.stringify({days,body}));
 }catch{/* Storage full: the Firestore cache still holds queued writes. */}
}
const plain=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));

export function useNutritionStore({app,db,scope,canWrite,track,setError}:{app:FirebaseApp;db:Firestore;scope:string;canWrite:()=>boolean;track:(work:Promise<unknown>)=>void;setError:(s:string)=>void}){
 const[days,setDays]=useState<Record<string,FoodDay>>({}),[body,setBody]=useState<Body>(bodyDefaults);
 const current=useRef({days,body});current.current={days,body};
 useEffect(()=>{
  setDays({});setBody(bodyDefaults);
  if(!scope)return;
  let live=true;
  const failed=(e:Error)=>{if(live)setError(`Your food log could not be opened: ${e.message}`);};
  const stopFood=onSnapshot(collection(db,'users',scope,'food'),{includeMetadataChanges:true},s=>{
   if(!live)return;
   const next:Record<string,FoodDay>={};
   s.docs.forEach(d=>{const v=d.data() as FoodDay;if(v?.date)next[v.date]={date:v.date,entries:v.entries||{}};});
   // An empty startup cache is not evidence that nothing was logged.
   if(!s.metadata.fromCache||s.docs.length){setDays(next);preserve(scope,{days:next});}
  },failed);
  const stopBody=onSnapshot(doc(db,'users',scope,'nutrition','settings'),{includeMetadataChanges:true},s=>{
   if(!live||!s.exists())return;
   const next={...bodyDefaults,...s.data()} as Body;next.measurements=next.measurements||{};
   setBody(next);preserve(scope,{body:next});
  },failed);
  return()=>{live=false;stopFood();stopBody();};
 },[scope]);
 const foodRef=(date:string)=>doc(db,'users',scope,'food',date);
 const bodyRef=()=>doc(db,'users',scope,'nutrition','settings');
 function okDate(date:string){if(validDate(date)&&date<=dateKey())return true;setError('Choose today or an earlier date.');return false;}
 function addFood(date:string,entry:FoodEntry){
  if(!canWrite()||!okDate(date))return false;
  const saved=plain(entry);preserve(scope,{days:{[date]:{date,entries:{[saved.id]:saved}}}});
  track(setDoc(foodRef(date),{date,entries:{[saved.id]:saved}},{merge:true}));return true;
 }
 function updateFood(date:string,entry:FoodEntry){
  if(!canWrite()||!current.current.days[date]?.entries[entry.id])return false;
  const saved=plain(entry);preserve(scope,{days:{[date]:{date,entries:{[saved.id]:saved}}}});
  track(updateDoc(foodRef(date),{[`entries.${saved.id}`]:saved}));return true;
 }
 function removeFood(date:string,id:string){const e=current.current.days[date]?.entries[id];return !!e&&updateFood(date,{...e,deletedAt:Date.now()});}
 function restoreFood(date:string,id:string){const e=current.current.days[date]?.entries[id];return !!e&&updateFood(date,{...e,deletedAt:null});}
 function saveBody(profile:Pick<Body,'heightCm'|'age'|'sex'|'activity'>){
  if(!canWrite())return false;
  const saved=plain(profile);preserve(scope,{body:{...current.current.body,...saved}});
  track(setDoc(bodyRef(),saved,{merge:true}));return true;
 }
 // Clearing a reading stores nulls so the date keeps its place in exports.
 function saveMeasurement(date:string,m:Measurement){
  if(!canWrite()||!okDate(date))return false;
  const saved={weightKg:m.weightKg??null,waistCm:m.waistCm??null};
  preserve(scope,{body:{...current.current.body,measurements:{[date]:saved}}});
  track(setDoc(bodyRef(),{measurements:{[date]:saved}},{merge:true}));return true;
 }
 const estimate=(text:string)=>estimateFood(app,text);
 return{days,body,addFood,updateFood,removeFood,restoreFood,saveBody,saveMeasurement,estimate};
}
export type NutritionStore=ReturnType<typeof useNutritionStore>;
