import source from './program.json';
export type Exercise = typeof source[number]['exercises'][number] & {referenceId?:string};
export type Template = typeof source[number];
export const program:Template[]=source;
export type Segment={weight:number|null;reps:number|null};
export type SetLog={id:string;segments:Segment[];done:boolean;skipped:boolean};
export type ExerciseLog={exercise:Exercise;sets:SetLog[]};
export type Session={id:string;index:number;cycle:number;week:number;name:string;kind:string;date:string;startedAt:number;finishedAt:number|null;exercises:ExerciseLog[]};
export type Settings={position:number;cycle:number;overrides:Record<string,Partial<Exercise>>;orders?:Record<string,string[]>;onboarded:boolean};
export const defaults:Settings={position:0,cycle:1,overrides:{},onboarded:false};
export const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function targets(e:Exercise):Array<number|null>{if(e.timed)return[30];return e.reps.split('/').map(s=>s.toUpperCase().includes('AMRAP')?null:Number(s.split('-')[0])||null);}
export function effective(e:Exercise,s:Settings):Exercise{return{...e,...s.overrides[e.id],id:e.id};}
export function ordered(t:Template,s:Settings):Exercise[]{const ids=s.orders?.[t.id];return t.exercises.map(e=>effective(e,s)).sort((a,b)=>ids?ids.indexOf(a.id)-ids.indexOf(b.id):0).filter(e=>e.sets>0);}
export function createSession(settings:Settings,history:Session[],now=new Date()):Session{
 const template=program[settings.position];
 return{id:`cycle-${settings.cycle}-session-${settings.position}`,index:settings.position,cycle:settings.cycle,week:template.week,name:template.name,kind:template.kind,date:dateKey(now),startedAt:now.getTime(),finishedAt:null,exercises:ordered(template,settings).map(raw=>{
  const e=effective(raw,settings),past=history.filter(s=>s.finishedAt).sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0)).flatMap(s=>s.exercises).find(x=>x.exercise.id===e.id&&x.exercise.unit===e.unit&&x.exercise.mode===e.mode&&x.exercise.name===e.name&&x.sets.some(s=>s.done));
  return{exercise:e,sets:Array.from({length:e.sets},(_,i)=>({id:`${e.id}-${i}`,done:false,skipped:false,segments:targets(e).map((n,j)=>({weight:(past?.sets[i]?.done?past.sets[i].segments[j]?.weight:null)??(e.mode==='bodyweight'?0:null),reps:n}))}))};
 })};
}
export function completeSession(s:Session):Session{return{...s,finishedAt:Date.now(),exercises:s.exercises.map(e=>({...e,sets:e.sets.map(x=>({...x,skipped:!x.done}))}))};}
export function nextPosition(s:Session):Pick<Settings,'position'|'cycle'>{return{position:(s.index+1)%program.length,cycle:s.cycle+(s.index===program.length-1?1:0)};}
export function progress(s:Session|null){const sets=s?.exercises.flatMap(e=>e.sets)||[];return{done:sets.filter(s=>s.done).length,total:sets.length};}
export function validSet(s:SetLog,e:Exercise){return s.segments.every(x=>x.reps!==null&&x.reps>=0&&Number.isInteger(x.reps)&&(e.mode==='band'||(x.weight!==null&&x.weight>=0)));}
export function effortText(s:string){const n=Number(s);return !Number.isNaN(n)&&n>0&&n<1?`${Math.round(n*100)}% 1RM`:`RPE ${s}`;}
