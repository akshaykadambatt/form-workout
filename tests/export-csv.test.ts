import {describe,it,expect} from 'vitest';
import {createSession,defaults} from '../src/model';
import {bodyDefaults,newEntry} from '../src/nutrition';
import {csvColumns,journalCsv} from '../src/export-csv';

// Minimal CSV reader for the test: handles quoted fields and doubled quotes.
function parse(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\r'){}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else field+=c;}
 return rows;
}
const records=(csv:string)=>{const[head,...rest]=parse(csv.replace(/^﻿/,''));return rest.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]])));};

describe('CSV export',()=>{
 const s=createSession(defaults,[],new Date(2026,10,10,18,5));
 s.exercises[0].sets[0]={...s.exercises[0].sets[0],done:true,segments:[{weight:100,reps:8}]};
 const finished={...s,finishedAt:s.startedAt+3600000,status:'completed' as const};
 const deleted={...createSession(defaults,[],new Date(2026,10,8,18)),deletedAt:1};
 const food=newEntry('2026-11-10','3 eggs, "big" ones','Breakfast',[{name:'egg',quantity:'3 eggs',grams:150,kcal:215,protein:18.9,carbs:1,fat:14.3,fiber:0}],'ai',new Date(2026,10,10,8,30));
 const trashed={...newEntry('2026-11-10','=SUM(A1)','Snack',[{name:'=cmd',quantity:'1',kcal:100,protein:0,carbs:20,fat:0,fiber:0}],'edited',new Date(2026,10,10,16)),deletedAt:5};
 const body={...bodyDefaults,heightCm:165,age:28,sex:'male' as const,measurements:{'2026-11-01':{weightKg:55,waistCm:74},'2026-11-05':{weightKg:null,waistCm:null}},sleep:{'2026-11-10':{bed:'23:30',wake:'07:00',hours:7.5},'2026-11-09':{hours:null}}};
 const csv=journalCsv({sessions:[finished,deleted],days:{'2026-11-10':{date:'2026-11-10',entries:{[food.id]:food,[trashed.id]:trashed}}},body});
 const rows=records(csv);
 it('writes one header and a UTF-8 marker for spreadsheets',()=>{
  expect(csv.startsWith('﻿'+csvColumns.join(',')+'\r\n')).toBe(true);
  expect(new Set(rows.map(r=>r.record_type))).toEqual(new Set(['profile','workout_set','food','measurement','sleep']));
 });
 it('includes the profile, every set, food item, reading and night',()=>{
  expect(rows[0]).toMatchObject({record_type:'profile',height_cm:'165',age:'28',sex:'male',activity:'moderate'});
  const sets=rows.filter(r=>r.record_type==='workout_set'),total=finished.exercises.reduce((n,e)=>n+e.sets.reduce((m,x)=>m+x.segments.length,0),0);
  expect(sets.filter(r=>r.date==='2026-11-10')).toHaveLength(total);
  expect(sets.find(r=>r.date==='2026-11-10')).toMatchObject({time:'18:05',status:'done',set:'1',weight:'100',reps:'8',week:'1',exercise:finished.exercises[0].exercise.name});
  expect(sets.find(r=>r.date==='2026-11-08')!.status).toBe('deleted');
  expect(rows.filter(r=>r.record_type==='measurement')).toEqual([expect.objectContaining({date:'2026-11-01',weight_kg:'55',waist_cm:'74'})]);
  expect(rows.filter(r=>r.record_type==='sleep')).toEqual([expect.objectContaining({date:'2026-11-10',bed_time:'23:30',wake_time:'07:00',sleep_hours:'7.5'})]);
 });
 it('keeps quotes and commas intact and stops spreadsheet formulas',()=>{
  const[egg,snack]=rows.filter(r=>r.record_type==='food');
  expect(egg).toMatchObject({time:'08:30',meal:'Breakfast',entry:'3 eggs, "big" ones',food:'egg',grams:'150',kcal:'215',protein_g:'18.9',source:'ai',status:''});
  expect(snack).toMatchObject({status:'deleted',entry:"'=SUM(A1)",food:"'=cmd"});
 });
});
