// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {bodyDefaults,sleepAverage,sleepHours,sleepText} from '../src/nutrition';
import {bodySeries} from '../src/progress';
import {SleepCard,offNutrition} from '../src/FoodViews';
afterEach(cleanup);
const today='2026-11-14';
const body={...bodyDefaults,sleep:{'2026-11-14':{bed:'23:30',wake:'07:10',hours:7.67},'2026-11-13':{hours:6},'2026-11-12':{hours:null},'2026-11-01':{hours:9}}};

describe('sleep',()=>{
 it('works out hours across midnight and rejects bad times',()=>{
  expect(sleepHours('23:30','07:10')).toBe(7.67);expect(sleepHours('01:00','08:30')).toBe(7.5);expect(sleepHours('22:00','22:00')).toBeNull();expect(sleepHours('25:00','07:00')).toBeNull();
  expect(sleepText(7.67)).toBe('7 h 40 min');expect(sleepText(8)).toBe('8 h 00 min');
 });
 it('averages the logged nights of the last week and charts every night',()=>{
  expect(sleepAverage(body,today)).toEqual({hours:6.84,nights:2});expect(sleepAverage(bodyDefaults,today)).toBeNull();
  expect(bodySeries(body,{},'sleep',today)).toEqual([{date:'2026-11-01',value:9},{date:'2026-11-13',value:6},{date:'2026-11-14',value:7.7}]);
 });
 it('shows last night and warns when the average is short',()=>{
  render(<SleepCard nutrition={{...offNutrition,body}} today={today} ready notify={()=>{}}/>);
  expect(screen.getByText('7 h 40 min')).toBeTruthy();expect(screen.getByText(/11:30 PM to 7:10 AM/)).toBeTruthy();expect(screen.getByText(/2-night average 6 h 50 min\. Under 7 hours/)).toBeTruthy();
 });
 it('saves bed and wake times under today, or just the hours',()=>{
  const saveSleep=vi.fn(()=>true),notify=vi.fn();
  render(<SleepCard nutrition={{...offNutrition,saveSleep}} today={today} ready notify={notify}/>);
  expect(screen.getByText('Not logged')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Log sleep/}));
  expect((screen.getByRole('button',{name:/Save sleep/}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Or total hours'),{target:{value:'6.5'}});
  fireEvent.click(screen.getByRole('button',{name:/Save sleep/}));
  expect(saveSleep).toHaveBeenLastCalledWith(today,{bed:null,wake:null,hours:6.5});
  fireEvent.click(screen.getByRole('button',{name:/Log sleep/}));
  fireEvent.change(screen.getByLabelText('Went to bed'),{target:{value:'23:00'}});fireEvent.change(screen.getByLabelText('Woke up'),{target:{value:'06:45'}});
  fireEvent.click(screen.getByRole('button',{name:/Save sleep/}));
  expect(saveSleep).toHaveBeenLastCalledWith(today,{bed:'23:00',wake:'06:45',hours:7.75});expect(notify).toHaveBeenLastCalledWith('Sleep logged · 7 h 45 min');
 });
});
