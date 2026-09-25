import {describe,it,expect} from 'vitest';
import {createSession,defaults,progressionSuggestions,canApplySuggestion,type Session} from '../src/model';

function previous(cycle:number,weight=100,reps=12):Session{
 const s=createSession({...defaults,cycle},[],new Date(2026,0,cycle));
 s.finishedAt=s.startedAt+3600000;
 // Stable accessory prescription: three sets of ten, RPE 7.
 s.exercises[1].sets.forEach(set=>{set.done=true;set.segments=[{weight,reps}];});
 return s;
}
function fixture(){const history=[previous(1),previous(2)];return{history,current:createSession({...defaults,cycle:3},history,new Date(2026,0,3))};}

describe('previous-session prefills',()=>{
 it('copies actuals per set, including different reps, without sharing mutable objects',()=>{
  const first=previous(1);first.exercises[1].sets[1].segments[0]={weight:95,reps:11};
  const next=createSession({...defaults,cycle:2},[first],new Date(2026,0,2));
  expect(next.exercises[1].sets.map(s=>s.segments[0])).toEqual([{weight:100,reps:12},{weight:95,reps:11},{weight:100,reps:12}]);
  next.exercises[1].sets[0].segments[0].weight=200;
  expect(first.exercises[1].sets[0].segments[0].weight).toBe(100);
 });
 it('ignores unfinished sessions and falls back past skipped sets',()=>{
  const first=previous(1),second=previous(2,110);second.exercises[1].sets[1].done=false;second.exercises[1].sets[1].skipped=true;
  const unfinished=previous(3,500);unfinished.finishedAt=null;
  const next=createSession({...defaults,cycle:4},[first,second,unfinished],new Date(2026,0,4));
  expect(next.exercises[1].sets.map(s=>s.segments[0].weight)).toEqual([110,100,110]);
 });
 it.each([{unit:'kg'},{mode:'assisted'},{convention:'per dumbbell'},{name:'Different exercise'},{timed:true}])('does not mix incompatible actuals: %j',override=>{
  const first=previous(1),id=first.exercises[1].exercise.id;
  const next=createSession({...defaults,cycle:2,overrides:{[id]:override}},[first],new Date(2026,0,2));
  expect(next.exercises[1].sets[0].segments[0].weight).toBeNull();
 });
 it('copies segmented weights and reps and handles additional sets',()=>{
  const first=previous(1),entry=first.exercises[4];
  entry.sets.forEach(s=>{s.done=true;s.segments=[{weight:25,reps:7},{weight:20,reps:8}];});
  const next=createSession({...defaults,cycle:2,overrides:{[entry.exercise.id]:{sets:entry.sets.length+1}}},[first],new Date(2026,0,2));
  expect(next.exercises[4].sets.at(-1)?.segments).toEqual([{weight:25,reps:7},{weight:20,reps:8}]);
 });
});

describe('optional progression',()=>{
 it('suggests one configured step after two successful matching exposures',()=>{
  const {history,current}=fixture(),snapshot=JSON.stringify({history,current});
  const result=progressionSuggestions(current,history);
  expect(result).toHaveLength(1);expect(result[0].exerciseIndex).toBe(1);
  expect(result[0].sets.map(s=>s.after.segments[0])).toEqual(Array(3).fill({weight:105,reps:10}));
  expect(JSON.stringify({history,current})).toBe(snapshot);
 });
 it('needs two exposures and does not count unrelated upper/lower days',()=>{
  const {history,current}=fixture();expect(progressionSuggestions(current,history.slice(1))).toEqual([]);
  history[1].name='Upper #1';expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it.each(['skipped','below target','different load','changed reps','changed effort','changed sets','changed notes'])('does not cherry-pick past a recent %s session',reason=>{
  const {history,current}=fixture();const e=history[1].exercises[1];
  if(reason==='skipped'){e.sets[0].done=false;e.sets[0].skipped=true;}
  if(reason==='below target')e.sets[0].segments[0].reps=11;
  if(reason==='different load')e.sets[0].segments[0].weight=105;
  if(reason==='changed reps')e.exercise={...e.exercise,reps:'11'};
  if(reason==='changed effort')e.exercise={...e.exercise,effort:'9'};
  if(reason==='changed sets')e.exercise={...e.exercise,sets:4};
  if(reason==='changed notes')e.exercise={...e.exercise,note:'Different tempo'};
  expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it('respects the configured step and rejects jumps over ten percent',()=>{
  const {history,current}=fixture();current.exercises[1].exercise={...current.exercises[1].exercise,step:2.5};
  expect(progressionSuggestions(current,history)[0].sets[0].after.segments[0].weight).toBe(102.5);
  current.exercises[1].exercise.step=15;expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it.each(['assisted','bodyweight','band'])('leaves %s prescriptions manual',mode=>{
  const {history,current}=fixture();for(const s of [...history,current])s.exercises[1].exercise={...s.exercises[1].exercise,mode};
  expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it.each(['AMRAP','10/10','7/7/7'])('leaves complex reps %s manual',reps=>{
  const {history,current}=fixture();for(const s of [...history,current])s.exercises[1].exercise={...s.exercises[1].exercise,reps};
  expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it('respects rep ranges and leaves percent-based lifts manual',()=>{
  const {history,current}=fixture();for(const s of [...history,current])s.exercises[1].exercise={...s.exercises[1].exercise,reps:'8-10'};
  expect(progressionSuggestions(current,history)[0].sets[0].after.segments[0].reps).toBe(8);
  current.exercises[1].exercise.effort='0.75';expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it('never updates done, skipped, edited or legacy active sets',()=>{
  const {history,current}=fixture();const sets=current.exercises[1].sets;
  sets[0].done=true;sets[1].autofillEligible=false;delete sets[2].autofillEligible;
  expect(progressionSuggestions(current,history)).toEqual([]);
  sets[2].autofillEligible=true;sets[2].skipped=true;expect(progressionSuggestions(current,history)).toEqual([]);
 });
 it('protects edits made since preview and prevents repeated application',()=>{
  const {history,current}=fixture(),s=progressionSuggestions(current,history)[0].sets[0];
  expect(canApplySuggestion(s.before,s.before)).toBe(true);
  expect(canApplySuggestion({...s.before,segments:[{weight:110,reps:12}]},s.before)).toBe(false);
  expect(canApplySuggestion({...s.before,done:true},s.before)).toBe(false);
  expect(canApplySuggestion(s.after,s.before)).toBe(false);
  current.finishedAt=Date.now();expect(progressionSuggestions(current,history)).toEqual([]);
 });
});
