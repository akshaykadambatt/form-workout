import {sessionLabel,sessionState,type Session} from './model';
import type {Body,FoodDay} from './nutrition';

// One spreadsheet for everything: each row has a record_type, and only the
// columns that apply to that type are filled. Filter by record_type to work
// with workouts, food, body measurements, sleep or the profile on their own.
export const csvColumns=['record_type','date','time','status','session','week','exercise','set','part','weight','unit','reps','meal','entry','food','quantity','grams','kcal','protein_g','carbs_g','fat_g','fiber_g','source','weight_kg','waist_cm','bed_time','wake_time','sleep_hours','height_cm','age','sex','activity'] as const;
type Column=typeof csvColumns[number];
type Row=Partial<Record<Column,string|number|null|undefined>>;

// Text that a spreadsheet would run as a formula is prefixed with an apostrophe.
function cell(v:Row[Column]){
 if(v===null||v===undefined)return '';
 if(typeof v==='number')return Number.isFinite(v)?String(v):'';
 const text=/^[=+\-@\t\r]/.test(v)?`'${v}`:v;
 return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
const clock=(ms:number)=>{const d=new Date(ms);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

export function journalCsv({sessions,days,body}:{sessions:Session[];days:Record<string,FoodDay>;body:Body}){
 const rows:Row[]=[{record_type:'profile',height_cm:body.heightCm,age:body.age,sex:body.sex||null,activity:body.activity}];
 [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.startedAt-b.startedAt).forEach(s=>{
  const base={date:s.date,time:clock(s.startedAt),status:sessionState(s,sessions).toLowerCase(),session:sessionLabel(s),week:s.week};
  s.exercises.forEach(e=>e.sets.forEach((set,si)=>set.segments.forEach((v,pi)=>rows.push({...base,record_type:'workout_set',exercise:e.exercise.name,set:si+1,part:set.segments.length>1?String.fromCharCode(65+pi):null,weight:e.exercise.mode==='band'?null:v.weight,unit:e.exercise.mode==='band'?'band':e.exercise.unit,reps:v.reps,
   // Status per set: done, skipped or not done, unless the whole session is deleted.
   ...(s.deletedAt?{}:{status:set.done?'done':set.skipped?'skipped':'not done'})}))));
 });
 Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)).forEach(d=>Object.values(d.entries||{}).sort((a,b)=>a.at-b.at).forEach(entry=>entry.items.forEach(item=>rows.push({record_type:'food',date:d.date,time:clock(entry.at),status:entry.deletedAt?'deleted':null,meal:entry.meal,entry:entry.text,food:item.name,quantity:item.quantity,grams:item.grams??null,kcal:item.kcal,protein_g:item.protein,carbs_g:item.carbs,fat_g:item.fat,fiber_g:item.fiber,source:entry.source}))));
 Object.entries(body.measurements||{}).filter(([,m])=>m?.weightKg||m?.waistCm).sort(([a],[b])=>a.localeCompare(b)).forEach(([date,m])=>rows.push({record_type:'measurement',date,weight_kg:m.weightKg??null,waist_cm:m.waistCm??null}));
 Object.entries(body.sleep||{}).filter(([,s])=>s?.hours).sort(([a],[b])=>a.localeCompare(b)).forEach(([date,s])=>rows.push({record_type:'sleep',date,bed_time:s.bed??null,wake_time:s.wake??null,sleep_hours:s.hours}));
 // A byte-order mark lets Excel read the file as UTF-8.
 return '﻿'+[csvColumns.join(','),...rows.map(r=>csvColumns.map(c=>cell(r[c])).join(','))].join('\r\n')+'\r\n';
}
