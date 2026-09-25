import source from './program.json';
export type Exercise = typeof source[number]['exercises'][number] & {referenceId?:string};
export type Template = typeof source[number];
export const program:Template[]=source;
export type Segment={weight:number|null;reps:number|null};
export type SetLog={id:string;segments:Segment[];done:boolean;skipped:boolean;autofillEligible?:boolean};
export type ExerciseLog={exercise:Exercise;sets:SetLog[]};
export type Session={id:string;index:number;cycle:number;week:number;name:string;kind:string;date:string;startedAt:number;finishedAt:number|null;exercises:ExerciseLog[];status?:'active'|'paused'|'completed';resumedAt?:number;deletedAt?:number|null;label?:string;timeZone?:string};
export type Settings={position:number;cycle:number;overrides:Record<string,Partial<Exercise>>;orders?:Record<string,string[]>;onboarded:boolean;theme?:string;sequenceChosenAt?:number};
export const defaults:Settings={position:0,cycle:1,overrides:{},onboarded:false};
export const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function targets(e:Exercise):Array<number|null>{if(e.timed)return[30];return e.reps.split('/').map(s=>s.toUpperCase().includes('AMRAP')?null:Number(s.split('-')[0])||null);}
export function effective(e:Exercise,s:Settings):Exercise{return{...e,...s.overrides[e.id],id:e.id};}
export function ordered(t:Template,s:Settings):Exercise[]{const ids=s.orders?.[t.id];return t.exercises.map(e=>effective(e,s)).sort((a,b)=>ids?ids.indexOf(a.id)-ids.indexOf(b.id):0).filter(e=>e.sets>0);}
export function createSession(settings:Settings,history:Session[],now=new Date()):Session{
 const template=program[settings.position];
 return{id:`session-${crypto.randomUUID()}`,index:settings.position,cycle:settings.cycle,week:template.week,name:template.name,kind:template.kind,date:dateKey(now),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,status:'active',startedAt:now.getTime(),finishedAt:null,exercises:ordered(template,settings).map(raw=>{
  const e=effective(raw,settings);
  const past=previousExercises(e,history,now.getTime());
  return{exercise:e,sets:Array.from({length:e.sets},(_,i)=>{
   const usable=(s:SetLog|undefined)=>s?.done&&!s.skipped&&s.segments.length===targets(e).length&&validSet(s,e);
   const previous=past.map(x=>x.sets[i]).find(usable)||past.flatMap(x=>x.sets).find(usable);
   return{id:`${e.id}-${i}`,done:false,skipped:false,autofillEligible:true,segments:previous?previous.segments.map(v=>({...v})):targets(e).map(n=>({weight:e.mode==='bodyweight'?0:null,reps:n}))};
  })};
 })};
}
export function completeSession(s:Session):Session{return{...s,status:'completed',finishedAt:Date.now(),exercises:s.exercises.map(e=>({...e,sets:e.sets.map(x=>({...x,skipped:!x.done}))}))};}
export function nextPosition(s:Session):Pick<Settings,'position'|'cycle'>{return{position:(s.index+1)%program.length,cycle:s.cycle+(s.index===program.length-1?1:0)};}
export function progress(s:Session|null){const sets=s?.exercises.flatMap(e=>e.sets)||[];return{done:sets.filter(s=>s.done).length,total:sets.length};}
export function validSet(s:SetLog,e:Exercise){return s.segments.length>0&&s.segments.every(x=>x.reps!==null&&x.reps>=0&&Number.isInteger(x.reps)&&(e.mode==='band'||(x.weight!==null&&Number.isFinite(x.weight)&&x.weight>=0)));}
export function effortText(s:string){const n=Number(s);return !Number.isNaN(n)&&n>0&&n<1?`${Math.round(n*100)}% 1RM`:`RPE ${s}`;}

export function sameExercise(a:Exercise,b:Exercise){
 return a.id===b.id&&a.name===b.name&&(a.referenceId||a.id)===(b.referenceId||b.id)&&a.unit===b.unit&&a.mode===b.mode&&a.convention===b.convention&&a.timed===b.timed;
}
export function previousExercises(e:Exercise,history:Session[],before=Infinity){
 return history.filter(s=>!s.deletedAt&&s.finishedAt&&s.finishedAt<=before).sort((a,b)=>b.finishedAt!-a.finishedAt!).flatMap(s=>s.exercises).filter(x=>sameExercise(x.exercise,e));
}
export type ProgressionSuggestion={exerciseIndex:number;name:string;unit:string;sets:{setIndex:number;before:SetLog;after:SetLog}[]};
// A conservative application of the AHA's 2-for-2 guideline. Program changes
// reset eligibility; percentage prescriptions and advanced sets stay manual.
export function progressionSuggestions(session:Session|null,history:Session[]):ProgressionSuggestion[]{
 if(!session||session.finishedAt||session.deletedAt)return[];
 return session.exercises.flatMap((entry,exerciseIndex)=>{
  const e=entry.exercise,range=/^(\d+)(?:\s*-\s*(\d+))?$/.exec(e.reps.trim());
  if(e.mode!=='weight'||e.timed||!range||!Number.isFinite(e.step)||e.step<=0||Number(e.effort)<1)return[];
  const low=Number(range[1]),high=Number(range[2]||range[1]);
  if(low<=0||high<low)return[];
  // Consecutive occurrences of this workout, including failures/skips: do not
  // cherry-pick two successful sessions from older history.
  const recent=history.filter(s=>!s.deletedAt&&s.id!==session.id&&s.name===session.name&&s.finishedAt&&s.finishedAt<=session.startedAt).sort((a,b)=>b.finishedAt!-a.finishedAt!).slice(0,2);
  if(recent.length!==2)return[];
  const previous=recent.map(s=>s.exercises.find(x=>sameExercise(x.exercise,e)));
  if(previous.some(x=>!x||x.exercise.reps!==e.reps||x.exercise.sets!==e.sets||x.exercise.effort!==e.effort||x.exercise.note!==e.note||x.sets.length!==e.sets||x.sets.some(s=>!s.done||s.skipped||s.segments.length!==1||!validSet(s,e)||s.segments[0].reps!<high+2)))return[];
  const latest=previous[0]!,older=previous[1]!;
  if(latest.sets.some((s,i)=>s.segments[0].weight!==older.sets[i].segments[0].weight))return[];
  const sets=entry.sets.flatMap((s,setIndex)=>{
   const last=latest.sets[setIndex]?.segments[0],weight=last?.weight;
   if(!s.autofillEligible||s.done||s.skipped||s.segments.length!==1||!weight||!Number.isFinite(weight)||e.step/weight>.1||s.segments[0].weight!==weight||s.segments[0].reps!==last.reps)return[];
   return[{setIndex,before:s,after:{...s,autofillEligible:false,segments:[{weight:Math.round((weight+e.step)*100)/100,reps:low}]}}];
  });
  return sets.length?[{exerciseIndex,name:e.name,unit:e.unit,sets}]:[];
 });
}
export function canApplySuggestion(current:SetLog,expected:SetLog){
 return !!current.autofillEligible&&!current.done&&!current.skipped&&JSON.stringify(current)===JSON.stringify(expected);
}

export const sessionLabel=(s:Session)=>s.label?.trim()||s.name.replace(' #',' body ');
export function activeSession(sessions:Session[]):Session|null{
 const latestFinish=Math.max(0,...sessions.filter(s=>s.finishedAt).map(s=>s.finishedAt!));
 return sessions.filter(s=>!s.deletedAt&&!s.finishedAt&&s.status!=='paused'&&Math.max(s.startedAt,s.resumedAt||0)>latestFinish).sort((a,b)=>Math.max(b.startedAt,b.resumedAt||0)-Math.max(a.startedAt,a.resumedAt||0))[0]||null;
}
export function sessionState(s:Session,sessions:Session[]){return s.deletedAt?'Deleted':s.finishedAt?'Completed':activeSession(sessions)?.id===s.id?'In progress':'Paused';}
export function sequenceSettings(settings:Settings,sessions:Session[]):Settings{
 const latest=sessions.filter(s=>s.finishedAt).sort((a,b)=>b.finishedAt!-a.finishedAt!)[0];
 if(!latest||(settings.sequenceChosenAt||0)>=latest.finishedAt!)return settings;
 const next=nextPosition(latest);
 return{...settings,...next,onboarded:true};
}
export function dayOffset(date:string,amount:number){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+amount);return dateKey(d);}
export function validDate(date:string){const d=new Date(`${date}T12:00:00`);return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(d.getTime())&&dateKey(d)===date;}
export function calendarDays(month:string){
 const first=new Date(`${month}-01T12:00:00`),start=new Date(first);start.setDate(1-(first.getDay()+6)%7);
 const count=Math.ceil(((first.getDay()+6)%7+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7)*7;
 return Array.from({length:count},(_,i)=>dayOffset(dateKey(start),i));
}
export function sessionOnDate(sessions:Session[],date:string){return sessions.filter(s=>!s.deletedAt&&s.date===date).sort((a,b)=>Number(!!b.finishedAt)-Number(!!a.finishedAt)||b.startedAt-a.startedAt)[0]||null;}
