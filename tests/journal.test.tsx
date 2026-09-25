// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {createSession,defaults,activeSession,sequenceSettings,dayOffset,calendarDays,validDate,sessionOnDate,previousExercises,program,sessionState} from '../src/model';
import {DayCard,SessionHistory,TrainingCalendar} from '../src/JournalViews';
afterEach(cleanup);
const old=()=>createSession(defaults,[],new Date(2026,8,23,20,3));
const completed=()=>({...createSession({...defaults,position:3},[],new Date(2026,8,24,20,32)),finishedAt:new Date(2026,8,24,21,32).getTime()});
describe('daily journal lifecycle',()=>{
 it('leaves old unfinished sessions paused after a later workout completes',()=>{
  const a=old(),b=completed();expect(activeSession([a,b])).toBeNull();expect(sessionState(a,[a,b])).toBe('Paused');
  expect(sequenceSettings(defaults,[a,b]).position).toBe(4);
  expect(a.date).toBe('2026-09-23');expect(b.date).toBe('2026-09-24');
 });
 it('honors an explicit starting point chosen after the latest finish',()=>{
  const b=completed();expect(sequenceSettings({...defaults,position:9,sequenceChosenAt:b.finishedAt+1},[b]).position).toBe(9);
 });
 it('requires an explicit resume and never reactivates deleted sessions',()=>{
  const a={...old(),resumedAt:completed().finishedAt+100,status:'active' as const},b=completed();
  expect(activeSession([a,b])?.id).toBe(a.id);expect(activeSession([{...a,status:'paused'},b])).toBeNull();
  expect(activeSession([{...a,deletedAt:Date.now()},b])).toBeNull();expect(activeSession([old(),{...b,deletedAt:Date.now()}])).toBeNull();
 });
 it('does not use deleted workouts for date display or prefill',()=>{
  const b={...completed(),deletedAt:Date.now()};expect(sessionOnDate([b],b.date)).toBeNull();expect(previousExercises(b.exercises[0].exercise,[b])).toEqual([]);
 });
 it('browses dates across month/year boundaries and daylight saving changes',()=>{
  expect(dayOffset('2026-12-31',1)).toBe('2027-01-01');expect(dayOffset('2026-03-08',1)).toBe('2026-03-09');expect(dayOffset('2026-11-01',-1)).toBe('2026-10-31');
  expect(validDate('2026-02-30')).toBe(false);expect(validDate('2028-02-29')).toBe(true);
  const days=calendarDays('2026-08');expect(days).toHaveLength(42);expect(days[0]).toBe('2026-07-27');expect(days.at(-1)).toBe('2026-09-06');
 });
});
function dayProps(){return{date:'2026-09-25',today:'2026-09-25',session:null,template:program[4],state:'',active:null,ready:true,review:false,onDay:vi.fn(),onToday:vi.fn(),onStart:vi.fn(),onResume:vi.fn(),onPause:vi.fn(),onEdit:vi.fn()};}
describe('day browsing and history controls',()=>{
 it('offers explicit start today and keeps tomorrow blank',()=>{
  const props=dayProps(),{rerender}=render(<DayCard {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Start session'}));expect(props.onStart).toHaveBeenCalledOnce();
  rerender(<DayCard {...props} date="2026-09-26"/>);expect(screen.queryByRole('button',{name:'Start session'})).toBeNull();expect(screen.getByText('A blank page. Nothing has been logged.')).toBeTruthy();
 });
 it('swipes horizontally through dates without treating vertical scrolling as a swipe',()=>{
  const props=dayProps(),{container}=render(<DayCard {...props}/>),hero=container.querySelector('.day-hero')!;
  fireEvent.touchStart(hero,{touches:[{clientX:280,clientY:100}]});fireEvent.touchEnd(hero,{changedTouches:[{clientX:70,clientY:110}]});expect(props.onDay).toHaveBeenLastCalledWith(1);
  fireEvent.touchStart(hero,{touches:[{clientX:70,clientY:100}]});fireEvent.touchEnd(hero,{changedTouches:[{clientX:280,clientY:110}]});expect(props.onDay).toHaveBeenLastCalledWith(-1);
  fireEvent.touchStart(hero,{touches:[{clientX:70,clientY:100}]});fireEvent.touchEnd(hero,{changedTouches:[{clientX:150,clientY:310}]});expect(props.onDay).toHaveBeenCalledTimes(2);expect(props.onStart).not.toHaveBeenCalled();
 });
 it('provides separate view, edit and delete actions for every session',()=>{
  const a=old(),b=completed(),onView=vi.fn(),onEdit=vi.fn(),onDelete=vi.fn();render(<SessionHistory sessions={[b,a]} allSessions={[b,a]} ready trash={false} onView={onView} onEdit={onEdit} onDelete={onDelete} onRestore={vi.fn()}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'View'})[0]);fireEvent.click(screen.getAllByRole('button',{name:'Edit'})[1]);fireEvent.click(screen.getAllByRole('button',{name:'Delete'})[1]);
  expect(onView).toHaveBeenCalledWith(b);expect(onEdit).toHaveBeenCalledWith(a);expect(onDelete).toHaveBeenCalledWith(a);
 });
 it('renders one calendar cell per date and excludes deleted records',()=>{
  const a=old(),b=completed(),{container}=render(<TrainingCalendar month="2026-09" sessions={[a,b,{...b,id:'deleted',date:'2026-09-20',deletedAt:1}]} selectedDate={null} onMonth={vi.fn()} onSelect={vi.fn()}/>);
  expect(container.querySelectorAll('.month-day')).toHaveLength(35);expect(container.querySelectorAll('.month-day.upper')).toHaveLength(1);expect(container.querySelectorAll('.month-day.lower')).toHaveLength(1);
 });
});
