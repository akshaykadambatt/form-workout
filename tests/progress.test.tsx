// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {createSession,defaults,type Session} from '../src/model';
import {bodyDefaults,newEntry} from '../src/nutrition';
import {allExercises,bodySeries,change,exerciseSeries,sessionVolume,trainedExercises} from '../src/progress';
import {ProgressCard,BodyTrendCard} from '../src/ProgressViews';
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
  expect(screen.getByRole('img',{name:/Session volume/})).toBeTruthy();expect(screen.queryByRole('radiogroup')).toBeNull();
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
