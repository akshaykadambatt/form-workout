import {defaults,type Session,type Settings} from './model';
export type Journal={settings:Settings;sessions:Session[]};
const journalKey='form-workout-v1';
const backupKey='form-workout-backup-v1';
export function readLocal(scope:string):Journal{
 try{return JSON.parse(localStorage.getItem(journalKey+scope)||'null')||{settings:defaults,sessions:[]};}
 catch{return{settings:defaults,sessions:[]};}
}
export function writeLocal(scope:string,journal:Journal){localStorage.setItem(journalKey+scope,JSON.stringify(journal));}
// Recovery copies are independent of cloud snapshots. Signing out never clears
// these or the original guest journal.
export function preserveBackup(scope:string,journal:Journal,changedSession?:Session){
 const existing=JSON.parse(localStorage.getItem(backupKey+scope)||'null') as Journal|null;
 const identity=(s:Session)=>`${s.id}:${s.startedAt}`;
 const records=new Map((existing?.sessions||[]).map(s=>[identity(s),s]));
 journal.sessions.forEach(s=>{if(!records.has(identity(s)))records.set(identity(s),s);});
 if(changedSession)records.set(identity(changedSession),changedSession);
 localStorage.setItem(backupKey+scope,JSON.stringify({settings:journal.settings,sessions:[...records.values()]}));
}
export function exportDeviceCopies(){
 const copies:Record<string,unknown>={};
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)!;
  if(key.startsWith(journalKey)||key.startsWith(backupKey)){
   const raw=localStorage.getItem(key)!;try{copies[key]=JSON.parse(raw);}catch{copies[key]=raw;}
  }
 }
 return{exportedAt:new Date().toISOString(),copies};
}
export function sameOccurrence(a:Session,b:Session){return a.id===b.id&&a.startedAt===b.startedAt&&a.name===b.name;}
export function deviceImportPlan(device:Session[],cloud:Session[]){
 const missing:Session[]=[],conflicts:Session[]=[];
 device.forEach(s=>{const saved=cloud.find(x=>x.id===s.id);if(!saved)missing.push(s);else if(!sameOccurrence(s,saved))conflicts.push(s);});
 return{missing,conflicts};
}
