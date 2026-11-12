// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {bodyDefaults,caloriesByDate,dayTotals,estimateFromTable,goals,newEntry,nextMeal,parseFoods,remaining,sanitizeItems,type Body,type FoodDay,type FoodItem} from '../src/nutrition';
import {estimateFood} from '../src/food-ai';
import {FoodPage,FuelCard,offNutrition} from '../src/FoodViews';
import {TrainingCalendar} from '../src/JournalViews';
import {dateKey,dayOffset} from '../src/model';
afterEach(cleanup);
const item=(kcal:number,protein=0):FoodItem=>({name:'food',quantity:'1',kcal,protein,carbs:0,fat:0,fiber:0});
const body=(measurements:Body['measurements'],extra:Partial<Body>={}):Body=>({...bodyDefaults,heightCm:165,age:28,sex:'male',...extra,measurements});
const dayOf=(date:string,...entries:ReturnType<typeof newEntry>[]):FoodDay=>({date,entries:Object.fromEntries(entries.map(e=>[e.id,e]))});

describe('built-in food estimates',()=>{
 it('parses quantities, units, fractions and unknown measure words',()=>{
  const parts=parseFoods('3 eggs, 1 tbsp olive oil, 3 lets of brocolli, .75 cups of egg white');
  expect(parts.map(p=>[p.quantity,p.unit,p.name])).toEqual([[3,'','eggs'],[1,'tbsp','olive oil'],[3,'piece','brocolli'],[.75,'cup','egg white']]);
  expect(parseFoods('100g rice and half cup dal\n1 1/2 chapati').map(p=>[p.quantity,p.unit,p.name])).toEqual([[100,'g','rice'],[.5,'cup','dal'],[1.5,'','chapati']]);
 });
 it('estimates the example log, preferring the longest food name and tolerating typos',()=>{
  const items=estimateFromTable('3 eggs, 1 tbsp olive oil, 3 lets of brocolli, .75 cups of egg white');
  expect(items.map(i=>i.name)).toEqual(['egg','olive oil','broccoli','egg white']);
  expect(items.map(i=>i.grams)).toEqual([150,14,60,182]);
  expect(items[0].kcal).toBe(215);expect(items[0].protein).toBeCloseTo(18.9);
  expect(items[3].protein).toBeCloseTo(19.8,0);
  expect(estimateFromTable('2 idlis, 1 cup sambar, brocoli').every(i=>i.matched)).toBe(true);
 });
 it('keeps unrecognised foods for manual numbers instead of guessing',()=>{
  const[unknown]=estimateFromTable('2 zorblats');
  expect(unknown).toMatchObject({matched:false,kcal:0,protein:0});
 });
 it('clamps and cleans AI output',()=>{
  expect(sanitizeItems([{name:'x',kcal:-5,protein:'12.34',carbs:NaN,fat:1e9,fiber:2}])[0]).toMatchObject({kcal:0,protein:12.3,carbs:0,fat:500,fiber:2});
  expect(sanitizeItems('nope')).toEqual([]);
 });
 it('uses AI when available and falls back to the table when it fails',async()=>{
  const ai=vi.fn(async()=>[item(300,20)]);
  expect(await estimateFood({} as any,'3 eggs',ai)).toMatchObject({source:'ai',items:[{kcal:300}]});
  const failed=await estimateFood({} as any,'3 eggs',async()=>{throw new Error('not enabled');});
  expect(failed.source).toBe('table');expect(failed.items[0].name).toBe('egg');expect(failed.note).toContain('not enabled');
 });
});

describe('goals',()=>{
 it('needs height and a weight reading',()=>{
  expect(goals(bodyDefaults)).toBeNull();expect(goals(body({}))).toBeNull();
 });
 it('sets a lean-gain surplus that grows with body weight',()=>{
  const light=goals(body({'2026-11-01':{weightKg:55}}),'2026-11-05')!,heavy=goals(body({'2026-11-01':{weightKg:60}}),'2026-11-05')!;
  expect(light.mode).toBe('build');expect(light.bmr).toBe(1446);expect(light.kcal).toBe(2470);expect(light.protein).toBe(99);
  expect(heavy.kcal).toBeGreaterThan(light.kcal);expect(heavy.protein).toBeGreaterThan(light.protein);
  expect(light.protein*4+light.carbs*4+light.fat*9).toBeGreaterThan(light.kcal-15);
 });
 it('uses the reading in force on the day viewed',()=>{
  const b=body({'2026-10-01':{weightKg:54},'2026-11-01':{weightKg:58}});
  expect(goals(b,'2026-10-15')!.weightKg).toBe(54);expect(goals(b,'2026-11-02')!.weightKg).toBe(58);
 });
 it('cuts carbs when the waist grows faster than body weight',()=>{
  const steady=goals(body({'2026-10-01':{weightKg:55,waistCm:74},'2026-10-20':{weightKg:56,waistCm:74.5}}),'2026-10-21')!;
  const creeping=goals(body({'2026-10-01':{weightKg:55,waistCm:74},'2026-10-20':{weightKg:55.2,waistCm:75.5}}),'2026-10-21')!;
  expect(steady.mode).toBe('build');expect(creeping.mode).toBe('hold');
  expect(creeping.carbs).toBeLessThan(steady.carbs);expect(creeping.protein).toBeGreaterThan(steady.protein);expect(creeping.kcal).toBeLessThan(steady.kcal);
 });
 it('holds calories when the waist jumps or passes half of height',()=>{
  expect(goals(body({'2026-10-01':{weightKg:55,waistCm:74},'2026-10-20':{weightKg:57,waistCm:76.5}}),'2026-10-21')!.mode).toBe('trim');
  const wide=goals(body({'2026-10-20':{weightKg:60,waistCm:84}}),'2026-10-21')!;
  expect(wide.mode).toBe('trim');expect(wide.kcal).toBe(Math.round(wide.tdee/10)*10);
 });
 it('raises calories when weight stalls and the waist is steady',()=>{
  const g=goals(body({'2026-10-01':{weightKg:55,waistCm:74},'2026-10-25':{weightKg:55.1,waistCm:74}}),'2026-10-26')!;
  expect(g.mode).toBe('push');expect(g.kcal).toBeGreaterThan(goals(body({'2026-10-25':{weightKg:55.1}}),'2026-10-26')!.kcal);
 });
 it('ignores cleared readings',()=>{
  expect(goals(body({'2026-10-01':{weightKg:55},'2026-10-20':{weightKg:null,waistCm:null}}),'2026-10-21')!.weightKg).toBe(55);
 });
});

describe('day totals and the next meal',()=>{
 const goal={kcal:2400,protein:100,carbs:320,fat:70,fiber:34};
 it('totals a day without deleted entries and feeds the calendar',()=>{
  const a=newEntry('2026-11-10','eggs','Breakfast',[item(300,20),item(120,1)],'ai'),b={...newEntry('2026-11-10','cake','Snack',[item(500)],'ai'),deletedAt:1};
  const day=dayOf('2026-11-10',a,b);
  expect(dayTotals(day)).toMatchObject({kcal:420,protein:21});
  expect(caloriesByDate({'2026-11-10':day,'2026-11-11':dayOf('2026-11-11',b)})).toEqual({'2026-11-10':420});
 });
 it('spreads what is left over the meals still ahead',()=>{
  const morning=new Date(2026,10,10,9,0),breakfast=newEntry('2026-11-10','3 eggs, .75 cups egg white','Breakfast',[item(310,39)],'ai',morning);
  const next=nextMeal(goal,dayOf('2026-11-10',breakfast),morning)!;
  expect(next.meal).toBe('Lunch');expect(next.mealsLeft).toBe(4);
  // 61 g protein left; lunch carries 0.30 of the remaining 0.75 day share.
  expect(next.protein).toBe(24);expect(next.kcal).toBe(840);
  const evening=nextMeal(goal,dayOf('2026-11-10',breakfast),new Date(2026,10,10,20,0))!;
  // Catching up late: 51 g would be due, but one sitting is capped at 40% of the day.
  expect(evening.meal).toBe('Dinner');expect(evening.protein).toBe(40);expect(evening.capped).toBe(true);expect(next.capped).toBe(false);
 });
 it('caps the last slot at a realistic plate and stops once goals are met',()=>{
  const late=new Date(2026,10,10,22,30);
  expect(nextMeal(goal,undefined,late)).toMatchObject({meal:'Before bed',kcal:960,protein:40,mealsLeft:1,capped:true});
  expect(nextMeal(goal,dayOf('2026-11-10',newEntry('2026-11-10','most of it','Dinner',[item(2300,90)],'ai')),late)).toMatchObject({kcal:100,protein:10,capped:false});
  expect(nextMeal(goal,dayOf('2026-11-10',newEntry('2026-11-10','feast','Dinner',[item(2600,120)],'ai')),late)).toBeNull();
  expect(remaining(goal,{kcal:2600,protein:40,carbs:0,fat:0,fiber:0})).toMatchObject({kcal:0,protein:60});
 });
});

describe('food views',()=>{
 const today=dateKey();
 const ready=()=>({...offNutrition,body:body({[dayOffset(today,-1)]:{weightKg:55}}),addFood:vi.fn(()=>true),estimate:vi.fn(async()=>({items:[item(410,32)],source:'ai' as const}))});
 it('logs free text through the estimator and saves it on the viewed day',async()=>{
  const nutrition=ready(),notify=vi.fn();
  render(<FoodPage date={today} today={today} nutrition={nutrition} ready busy={false} setBusy={()=>{}} onDay={()=>{}} onToday={()=>{}} onSettings={()=>{}} notify={notify} status="Saved to Firebase"/>);
  fireEvent.change(screen.getByLabelText('What did you eat?'),{target:{value:'3 eggs, 1 tbsp olive oil'}});
  fireEvent.click(screen.getByRole('radio',{name:'Smoothie'}));
  fireEvent.click(screen.getByRole('button',{name:/Log smoothie/}));
  await waitFor(()=>expect(nutrition.addFood).toHaveBeenCalled());
  const[date,entry]=nutrition.addFood.mock.calls[0] as any;
  expect(date).toBe(today);expect(entry).toMatchObject({meal:'Smoothie',text:'3 eggs, 1 tbsp olive oil',source:'ai',items:[{kcal:410}]});
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('410 kcal'));
 });
 it('shows entries, totals and day navigation, and blocks logging on future days',()=>{
  const onDay=vi.fn(),entry=newEntry(today,'2 idli, sambar','Breakfast',[item(260,9)],'ai');
  const{rerender}=render(<FoodPage date={today} today={today} nutrition={{...ready(),days:{[today]:dayOf(today,entry)}}} ready busy={false} setBusy={()=>{}} onDay={onDay} onToday={()=>{}} onSettings={()=>{}} notify={()=>{}} status=""/>);
  expect(screen.getByText('2 idli, sambar')).toBeTruthy();expect(screen.getByText('1 ENTRY LOGGED')).toBeTruthy();expect(screen.getByText(/NEXT UP/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Previous day'}));expect(onDay).toHaveBeenCalledWith(-1);
  rerender(<FoodPage date={dayOffset(today,1)} today={today} nutrition={ready()} ready busy={false} setBusy={()=>{}} onDay={onDay} onToday={()=>{}} onSettings={()=>{}} notify={()=>{}} status=""/>);
  expect(screen.queryByLabelText('What did you eat?')).toBeNull();expect(screen.getByText('Tomorrow')).toBeTruthy();
 });
 it('shows goals, what is left and the next meal on the Today card',()=>{
  const entry=newEntry(today,'eggs','Breakfast',[item(470,39)],'ai');
  render(<FuelCard nutrition={{...ready(),days:{[today]:dayOf(today,entry)}}} today={today} onLog={()=>{}} onSettings={()=>{}}/>);
  expect(screen.getAllByText(/2,000 kcal left/).length).toBeGreaterThan(0);expect(screen.getByText('60 g left')).toBeTruthy();expect(screen.getByText(/g protein · /)).toBeTruthy();
 });
 it('prompts for body details when goals cannot be worked out',()=>{
  render(<FuelCard nutrition={offNutrition} today={today} onLog={()=>{}} onSettings={()=>{}}/>);
  expect(screen.getByRole('button',{name:/Set up your goals/})).toBeTruthy();
 });
 it('marks calories on calendar days',()=>{
  render(<TrainingCalendar month="2026-11" sessions={[]} calories={{'2026-11-10':2140}} selectedDate={null} onMonth={()=>{}} onSelect={()=>{}}/>);
  expect(screen.getByRole('button',{name:/November 10, 2026, no workout, 2140 kcal eaten/})).toBeTruthy();expect(screen.getByText('2.1k')).toBeTruthy();
 });
});
