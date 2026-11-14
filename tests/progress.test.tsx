// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {createSession,defaults,type Session} from '../src/model';
import {bodyDefaults,newEntry} from '../src/nutrition';
import {allExercises,bodySeries,change,exerciseSeries,sessionVolume,overallProgress,trainedExercises,weeklyVolume,weekStart} from '../src/progress';
import {ProgressCard,BodyTrendCard,ExerciseTrend} from '../src/ProgressViews';
import {offNutrition} from '../src/FoodViews';
afterEach(cleanup);
// A finished session of the first workout with the first exercise logged.
function workout(day:number,weight:number,reps:number,extra:Partial<Session>={}):Session{
 const s=createSession(defaults,[],new Date(2026,9,day,18));
 s.exercises[0].sets.forEach(x=>{x.done=true;x.segments=[{weight,reps}];});
 return{...s,finishedAt:s.startedAt+3600000,status:'completed',...extra};
}
const first=workout(1,100,8).exercises[0].exercise,name=first.name,sets=first.sets;

describe('training progress',()=>{
 const history=[workout(8,105,8),workout(1,100,8),workout(15,105,10)];
 it('charts each finished session oldest first, per metric',()=>{
  expect(exerciseSeries(history,name,'top').points).toEqual([{date:'2026-10-01',value:100},{date:'2026-10-08',value:105},{date:'2026-10-15',value:105}]);
  expect(exerciseSeries(history,name,'e1rm').points.map(p=>p.value)).toEqual([126.7,133,140]);
  expect(exerciseSeries(history,name,'volume').points.map(p=>p.value)).toEqual([100*8*sets,105*8*sets,105*10*sets]);
  expect(exerciseSeries(history,name,'reps')).toMatchObject({unit:'reps',weighted:true,points:[{value:8*sets},{value:8*sets},{value:10*sets}]});
  expect(change(exerciseSeries(history,name,'e1rm').points)).toEqual({amount:13.3,percent:10});
 });
 it('ignores unfinished, deleted and skipped work',()=>{
  const skipped=workout(22,200,8);skipped.exercises[0].sets.forEach(x=>{x.skipped=true;});
  const all=[...history,workout(20,300,8,{finishedAt:null}),workout(21,300,8,{deletedAt:1}),skipped];
  expect(exerciseSeries(all,name,'top').points).toHaveLength(3);
  expect(trainedExercises(all)).toEqual([{name,sessions:3}]);
  expect(sessionVolume(all)).toHaveLength(3);
 });
 it('converts pounds when the unit changed between sessions',()=>{
  const kg=workout(9,50,8);kg.exercises[0].exercise={...kg.exercises[0].exercise,unit:'kg'};
  const series=exerciseSeries([workout(1,100,8),kg],name,'top');
  expect(series.unit).toBe('kg');expect(series.points.map(p=>p.value)).toEqual([45.4,50]);
  expect(sessionVolume([workout(1,100,8)])[0].value).toBe(Math.round(100*.45359237*8*sets));
 });
 it('shows a trend with a metric switch and an all-exercises view',()=>{
  render(<ProgressCard sessions={history}/>);
  expect(screen.getByText(/\+13\.3 .* \(\+10%\) since Oct 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'Top weight'}));
  expect(screen.getByRole('img',{name:/top weight: Oct 1 100 .*Oct 15 105/})).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:allExercises}});
  expect(screen.getByRole('img',{name:/Weekly volume/})).toBeTruthy();expect(screen.queryByRole('radiogroup')).toBeNull();
 });
 it('adds volume up per week and keeps the week in progress out of the trend',()=>{
  // Oct 2026: the 5th and 12th are Mondays.
  expect(weekStart('2026-10-08')).toBe('2026-10-05');expect(weekStart('2026-10-05')).toBe('2026-10-05');expect(weekStart('2026-10-11')).toBe('2026-10-05');
  const one=sessionVolume([workout(6,100,8)])[0].value,sessions=[workout(6,100,8),workout(8,100,8),workout(13,100,8),workout(20,100,8)];
  const weekly=weeklyVolume(sessions,'2026-10-21');
  expect(weekly.points).toEqual([{date:'2026-10-05',value:one*2},{date:'2026-10-12',value:one}]);
  expect(weekly).toMatchObject({current:one,sessions:1});
  expect(weeklyVolume(sessions,'2026-11-02')).toMatchObject({current:0,sessions:0});
 });
 it('compares only the sessions the chart shows',()=>{
  const many=Array.from({length:20},(_,i)=>workout(i+1,i===0?500:100+i,8));
  render(<ProgressCard sessions={many}/>);fireEvent.click(screen.getByRole('radio',{name:'Top weight'}));
  // The 500 outlier on Oct 1 is older than the 16 sessions shown.
  expect(screen.getByText(/\+15 .* since Oct 5/)).toBeTruthy();
 });
 it('averages every exercise against its own start into one score and verdict',()=>{
  // Second exercise: bodyweight-style reps only, going 10 -> 11. First: 100x8 -> 105x10.
  const two=(day:number,weight:number,reps:number,other:number)=>{const s=workout(day,weight,reps);s.exercises[1].sets.forEach(x=>{x.done=true;x.segments=[{weight:0,reps:other}];});return s;};
  const run=[two(1,100,8,10),two(8,105,8,10),two(15,105,10,11)],score=overallProgress(run,'2026-10-16')!;
  // e1RM 126.7 -> 140 is +10.5%; reps 10 -> 11 per set is +10%.
  expect(score.lifts.map(l=>l.percent)).toEqual([10.5,10]);expect(score.percent).toBe(10.2);expect(score.trend).toBe('up');expect(score.since).toBe('2026-10-01');
  expect(score.points).toEqual([{date:'2026-09-28',value:0},{date:'2026-10-05',value:2.5},{date:'2026-10-12',value:10.2}]);
  // A later week without training carries the last values forward instead of dropping.
  expect(overallProgress(run,'2026-10-30')!.points.slice(-1)[0].value).toBe(10.2);
  expect(overallProgress([two(1,100,8,10),two(8,90,8,9)],'2026-10-09')).toMatchObject({trend:'down',percent:-10});
  expect(overallProgress([workout(1,100,8)],'2026-10-09')).toBeNull();
 });
 it('leads with the verdict and lists each exercise on request',()=>{
  render(<ProgressCard sessions={history}/>);
  // These sessions are over four weeks old, so the recent verdict is level.
  expect(screen.getByText('Holding steady')).toBeTruthy();expect(screen.getByText(/\+10\.5% stronger on average since Oct 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/1 up · 0 level · 0 down across 1 exercises/}));
  expect(screen.getByRole('list').textContent).toContain('+10.5%');
 });
 it('charts one exercise inside its card, with the same metric switch',()=>{
  const{rerender}=render(<ExerciseTrend sessions={history} name={name}/>);
  expect(screen.getByRole('img',{name:/est\. 1rm: Oct 1 126\.7 .*Oct 15 140/})).toBeTruthy();expect(screen.getByText(/\(\+10%\) since Oct 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'Reps'}));
  expect(screen.getByRole('img',{name:/reps: Oct 1 /})).toBeTruthy();
  rerender(<ExerciseTrend sessions={history} name="Never trained"/>);
  expect(screen.queryByRole('img')).toBeNull();expect(screen.getByText(/appears after you finish a session/)).toBeTruthy();
 });
 it('explains itself before any workout is finished',()=>{
  render(<ProgressCard sessions={[workout(1,100,8,{finishedAt:null})]}/>);
  expect(screen.getByText(/Finish a workout/)).toBeTruthy();
 });
});

describe('body and food trends',()=>{
 const body={...bodyDefaults,measurements:{'2026-10-20':{weightKg:55.4,waistCm:null},'2026-10-01':{weightKg:54.6,waistCm:73.5}}};
 const entry=(date:string,kcal:number)=>{const e=newEntry(date,'food','Lunch',[{name:'x',quantity:'1',kcal,protein:30,carbs:0,fat:0,fiber:0}],'ai');return{date,entries:{[e.id]:e}};};
 const days={'2026-10-19':entry('2026-10-19',2100),'2026-10-20':entry('2026-10-20',900)};
 it('orders readings and leaves today out of intake trends',()=>{
  expect(bodySeries(body,days,'weight','2026-10-20')).toEqual([{date:'2026-10-01',value:54.6},{date:'2026-10-20',value:55.4}]);
  expect(bodySeries(body,days,'waist','2026-10-20')).toEqual([{date:'2026-10-01',value:73.5}]);
  expect(bodySeries(body,days,'kcal','2026-10-20')).toEqual([{date:'2026-10-19',value:2100}]);
 });
 it('offers only the trends that have data and hides when there is none',()=>{
  const{container,rerender}=render(<BodyTrendCard nutrition={offNutrition} today="2026-10-20"/>);
  expect(container.innerHTML).toBe('');
  rerender(<BodyTrendCard nutrition={{...offNutrition,body,days}} today="2026-10-20"/>);
  expect(screen.getAllByRole('radio').map(r=>r.textContent)).toEqual(['Weight','Waist','Calories','Protein']);
  expect(screen.getByText(/\+0\.8 kg \(\+1%\) since Oct 1/)).toBeTruthy();
 });
});
