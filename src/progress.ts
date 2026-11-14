import type {Session} from './model';
import {dayEntries,dayTotals,type Body,type FoodDay} from './nutrition';

export type Point={date:string;value:number};
export type Metric='e1rm'|'top'|'volume'|'reps';
export const metricLabels:Record<Metric,string>={e1rm:'Est. 1RM',top:'Top weight',volume:'Volume',reps:'Reps'};
export const allExercises='All exercises';
const perKg:Record<string,number>={kg:1,lb:.45359237};
const convert=(weight:number,from:string,to:string)=>weight*(perKg[from]||1)/(perKg[to]||1);
const round1=(n:number)=>Math.round(n*10)/10;
// Finished, undeleted sessions, oldest first.
const finished=(sessions:Session[])=>sessions.filter(s=>s.finishedAt&&!s.deletedAt).sort((a,b)=>a.date.localeCompare(b.date)||a.startedAt-b.startedAt);
const doneSets=(s:Session,name:string)=>s.exercises.filter(e=>e.exercise.name===name).flatMap(e=>e.sets.filter(x=>x.done&&!x.skipped).map(x=>({set:x,exercise:e.exercise})));

// Exercises with at least one completed set, most-trained first.
export function trainedExercises(sessions:Session[]):{name:string;sessions:number}[]{
 const counts=new Map<string,number>();
 finished(sessions).forEach(s=>new Set(s.exercises.filter(e=>e.sets.some(x=>x.done&&!x.skipped)).map(e=>e.exercise.name)).forEach(n=>counts.set(n,(counts.get(n)||0)+1)));
 return[...counts].map(([name,n])=>({name,sessions:n})).sort((a,b)=>b.sessions-a.sessions||a.name.localeCompare(b.name));
}
// One point per session. Weights are shown in the unit of the latest session.
export function exerciseSeries(sessions:Session[],name:string,metric:Metric):{points:Point[];unit:string;weighted:boolean;timed:boolean}{
 const history=finished(sessions).map(s=>({s,sets:doneSets(s,name)})).filter(x=>x.sets.length);
 const latest=history[history.length-1]?.sets[0].exercise,unit=latest?.unit||'kg',timed=!!latest?.timed;
 const weighted=history.some(h=>h.sets.some(({set})=>set.segments.some(v=>(v.weight||0)>0)));
 const points=history.map(({s,sets})=>{
  const parts=sets.flatMap(({set,exercise})=>set.segments.map(v=>({weight:convert(v.weight||0,exercise.unit,unit),reps:v.reps||0})));
  // Epley estimate from the best set; a 1-rep set is its own weight.
  const value=metric==='e1rm'?Math.max(0,...parts.filter(p=>p.weight>0&&p.reps>0).map(p=>p.reps===1?p.weight:p.weight*(1+p.reps/30)))
   :metric==='top'?Math.max(0,...parts.filter(p=>p.reps>0).map(p=>p.weight))
   :metric==='volume'?parts.reduce((n,p)=>n+p.weight*p.reps,0)
   :parts.reduce((n,p)=>n+p.reps,0);
  return{date:s.date,value:round1(value)};
 }).filter(p=>p.value>0);
 return{points,unit:metric==='reps'?(timed?'sec':'reps'):unit,weighted,timed};
}
// Total load lifted per session across every exercise, in kilograms.
export function sessionVolume(sessions:Session[]):Point[]{
 return finished(sessions).map(s=>({date:s.date,value:Math.round(s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.done&&!x.skipped).reduce((m,x)=>m+x.segments.reduce((k,v)=>k+convert(v.weight||0,e.exercise.unit,'kg')*(v.reps||0),0),0),0))})).filter(p=>p.value>0);
}
export function change(points:Point[]):{amount:number;percent:number}|null{
 if(points.length<2||!points[0].value)return null;
 const amount=round1(points[points.length-1].value-points[0].value);
 return{amount,percent:Math.round(amount/points[0].value*100)};
}

export type BodyMetric='weight'|'waist'|'sleep'|'kcal'|'protein';
export const bodyMetricLabels:Record<BodyMetric,string>={weight:'Weight',waist:'Waist',sleep:'Sleep',kcal:'Calories',protein:'Protein'};
export const bodyUnits:Record<BodyMetric,string>={weight:'kg',waist:'cm',sleep:'h',kcal:'kcal',protein:'g'};
export function bodySeries(body:Body,days:Record<string,FoodDay>,metric:BodyMetric,today:string):Point[]{
 if(metric==='sleep')return Object.entries(body.sleep||{}).filter(([,s])=>typeof s?.hours==='number'&&s.hours>0).map(([date,s])=>({date,value:Math.round(s.hours!*10)/10})).sort((a,b)=>a.date.localeCompare(b.date));
 if(metric==='weight'||metric==='waist'){
  const key=metric==='weight'?'weightKg':'waistCm';
  return Object.entries(body.measurements||{}).filter(([,m])=>typeof m?.[key]==='number'&&m[key]!>0).map(([date,m])=>({date,value:m[key]!})).sort((a,b)=>a.date.localeCompare(b.date));
 }
 // Today is left out until it is over, so a half-logged day does not read as a drop.
 return Object.values(days).filter(d=>d.date<today&&dayEntries(d).length).map(d=>({date:d.date,value:Math.round(dayTotals(d)[metric])})).filter(p=>p.value>0).sort((a,b)=>a.date.localeCompare(b.date));
}
