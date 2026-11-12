import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Check,ChevronDown,CloudUpload,RefreshCw,RotateCcw,Ruler,Sparkles,Trash2,Utensils,X} from 'lucide-react';
import {dateKey,dayOffset,validDate} from './model';
import {bodyDefaults,dayEntries,dayTotals,entryTotals,goals,macroKeys,mealForTime,meals,newEntry,nextMeal,remaining,type Activity,type Body,type FoodDay,type FoodEntry,type FoodItem,type Goals,type Macros} from './nutrition';
import type {NutritionStore} from './nutrition-store';
import {displayDate} from './JournalViews';
import './food.css';

// Used when the store has no nutrition API (signed out, or a test double).
export const offNutrition:NutritionStore={days:{},body:bodyDefaults,addFood:()=>false,updateFood:()=>false,removeFood:()=>false,restoreFood:()=>false,saveBody:()=>false,saveMeasurement:()=>false,estimate:async()=>({items:[],source:'table'})};
const macroLabels:Record<keyof Macros,string>={kcal:'Calories',protein:'Protein',carbs:'Carbs',fat:'Fat',fiber:'Fibre'};
const short:Record<keyof Macros,string>={kcal:'KCAL',protein:'P',carbs:'C',fat:'F',fiber:'FIB'};
const sourceLabel={ai:'AI estimate',table:'Built-in estimate',edited:'Edited by you'};
const fmt=(n:number)=>Math.round(n).toLocaleString('en-US');
const clock=(at:number)=>new Date(at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});

function Meter({label,value,goal,unit,left}:{label:string;value:number;goal?:number;unit:string;left?:number}){
 const ratio=goal?Math.min(1,value/goal):0;
 return <div className="macro-meter"><span>{label}</span><strong>{fmt(value)}{goal?<small> / {fmt(goal)} {unit}</small>:<small> {unit}</small>}</strong>{left!==undefined&&<em>{left>0?`${fmt(left)} ${unit} left`:'Done'}</em>}<div className="meter-track" role="progressbar" aria-label={`${label} ${fmt(value)}${goal?` of ${fmt(goal)}`:''} ${unit}`} aria-valuemin={0} aria-valuemax={goal||undefined} aria-valuenow={Math.round(value)}><i style={{width:`${ratio*100}%`}}/></div></div>;
}
// Keeps typing local and saves once, on blur or Enter.
function NumberCell({value,label,onCommit}:{value:number;label:string;onCommit:(n:number)=>void}){
 const[draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{const n=Number(draft);if(draft===''||!Number.isFinite(n)||n<0){setDraft(String(value));return;}if(n!==value)onCommit(Math.round(n*10)/10);};
 return <input type="number" inputMode="decimal" min="0" step="any" aria-label={label} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>;
}

export function FoodPage({date,today,nutrition,ready,busy,setBusy,onDay,onToday,onSettings,notify,status}:{date:string;today:string;nutrition:NutritionStore;ready:boolean;busy:boolean;setBusy:(b:boolean)=>void;onDay:(n:number)=>void;onToday:()=>void;onSettings:()=>void;notify:(s:string)=>void;status:string}){
 const touch=useRef<{x:number;y:number}|null>(null);
 const[text,setText]=useState(''),[meal,setMeal]=useState<string|null>(null),[expanded,setExpanded]=useState<string|null>(null),[showDeleted,setShowDeleted]=useState(false);
 useEffect(()=>{setExpanded(null);setShowDeleted(false);},[date]);
 const day=nutrition.days[date],entries=dayEntries(day),deleted=dayEntries(day,true),total=dayTotals(day),goal=goals(nutrition.body,date<today?date:today);
 const future=date>today,chosen=meal||mealForTime(),left=goal?goal.kcal-total.kcal:0;
 const dayName=date===today?'Today':date===dayOffset(today,-1)?'Yesterday':date===dayOffset(today,1)?'Tomorrow':new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'});
 async function log(){
  const words=text.trim();if(!words||busy||!ready||future)return;
  setBusy(true);
  try{
   const estimate=await nutrition.estimate(words),entry=newEntry(date,words,chosen,estimate.items,estimate.source);
   if(!nutrition.addFood(date,entry))return;
   const kcal=entryTotals(entry).kcal,missing=entry.items.filter(i=>i.matched===false).length;
   setText('');setMeal(null);setExpanded(missing||estimate.source==='table'?entry.id:null);
   notify(missing?`${chosen} logged. ${missing} ${missing===1?'food needs':'foods need'} numbers. Tap the entry to add them.`:`${chosen} logged · ${fmt(kcal)} kcal${estimate.source==='table'?' · built-in estimate, check the numbers':''}`);
  }finally{setBusy(false);}
 }
 async function reestimate(e:FoodEntry){
  if(busy||!ready)return;setBusy(true);
  try{const estimate=await nutrition.estimate(e.text);if(estimate.items.length&&nutrition.updateFood(date,{...e,items:estimate.items,source:estimate.source}))notify(`Re-estimated · ${fmt(entryTotals({...e,items:estimate.items}).kcal)} kcal`);}
  finally{setBusy(false);}
 }
 const changeItem=(e:FoodEntry,index:number,patch:Partial<FoodItem>)=>nutrition.updateFood(date,{...e,source:'edited',items:e.items.map((item,i)=>i===index?{...item,...patch,matched:true}:item)});
 return <><div className="page-heading"><div><p className="eyebrow">{displayDate(date)}</p><h1>Fuel the work.</h1></div><span className="outline-tag">{goal?fmt(goal.kcal):'SET'} <span>{goal?'KCAL GOAL':'YOUR GOAL'}</span></span></div>
 <div className="dashboard-grid"><section className="workout-column">
  <section className="day-card-shell" aria-label="Food day">
   <div className="day-navigation"><button className="icon-button" aria-label="Previous day" onClick={()=>onDay(-1)}><ArrowLeft size={20}/></button><button className="day-label" onClick={onToday}><strong>{dayName}</strong><span>{new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric'})}</span></button><button className="icon-button" aria-label="Next day" onClick={()=>onDay(1)}><ArrowRight size={20}/></button></div>
   <div className={`session-hero day-hero food-hero ${entries.length?'food':'unstarted'}`} onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)onDay(dx<0?1:-1);}}>
    <div><span className="hero-pill">{future?'NOT YET':entries.length?`${entries.length} ${entries.length===1?'ENTRY':'ENTRIES'} LOGGED`:'NOTHING LOGGED'}</span><h2>{fmt(total.kcal)} <small>kcal</small></h2><p>{future?'Tomorrow’s plate is still empty.':!goal?'Add your height and weight in Settings to get daily goals.':left>=0?`${fmt(left)} kcal left of ${fmt(goal.kcal)}`:`${fmt(-left)} kcal over ${fmt(goal.kcal)}`}</p></div><div className="hero-art" aria-hidden="true"><Utensils strokeWidth={1.1}/></div>
    <div className="macro-meters"><Meter label="Protein" value={total.protein} goal={goal?.protein} unit="g"/><Meter label="Carbs" value={total.carbs} goal={goal?.carbs} unit="g"/><Meter label="Fat" value={total.fat} goal={goal?.fat} unit="g"/><Meter label="Fibre" value={total.fiber} goal={goal?.fiber} unit="g"/></div>
   </div>
   {date!==today&&<button className="text-button return-today" onClick={onToday}>Back to today <RotateCcw size={14}/></button>}
  </section>
  {date===today&&goal&&<NextMealLine goal={goal} day={day}/>}
  {!future&&<form className="food-composer" onSubmit={e=>{e.preventDefault();void log();}}>
   <label htmlFor="food-text">What did you eat?</label>
   <textarea id="food-text" rows={3} maxLength={600} value={text} placeholder="3 eggs, 1 tbsp olive oil, 2 idli, 1 cup sambar" onChange={e=>setText(e.target.value)} disabled={busy}/>
   <div className="meal-chips" role="radiogroup" aria-label="Meal">{meals.map(m=><button type="button" key={m} role="radio" aria-checked={chosen===m} className={chosen===m?'selected':''} onClick={()=>setMeal(m)}>{m}</button>)}</div>
   <button type="submit" className="primary full" disabled={!ready||busy||!text.trim()}>{busy?'Working out the calories…':<>Log {chosen.toLowerCase()} <Sparkles size={18}/></>}</button>
   <p className="guide-reference">Write it the way you’d say it. Calories and macros are estimated by AI, with a built-in food table as the offline fallback. Every number stays editable.</p>
  </form>}
  {(entries.length>0||!future)&&<div className="section-heading"><h3>{date===today?'Eaten today':'Eaten this day'}</h3><span>{entries.length} {entries.length===1?'entry':'entries'} <span className="small-dot">·</span> Tap to expand</span></div>}
  {!entries.length&&!future&&<div className="empty-state"><Utensils size={34}/><h3>{date===today?'Nothing logged yet.':'Nothing was logged.'}</h3><p>{date===today?'Breakfast, a smoothie, something before bed. Log as many times as you eat.':'You can still add what you ate on this day.'}</p></div>}
  <div className="exercise-list food-list">{entries.map(e=>{const t=entryTotals(e),open=expanded===e.id;return <article key={e.id} className={`exercise-card food-entry ${open?'expanded':''}`}>
   <button className="exercise-summary" aria-expanded={open} onClick={()=>setExpanded(open?null:e.id)}><span className="food-time">{clock(e.at)}</span><span className="exercise-name"><strong>{e.meal}</strong><small>{e.text}</small></span><span className="food-kcal">{fmt(t.kcal)}<small>kcal</small></span><ChevronDown className="chevron" size={18}/></button>
   {open&&<div className="exercise-body">
    <div className="mini-tags"><span>Protein {fmt(t.protein)} g</span><span>Carbs {fmt(t.carbs)} g</span><span>Fat {fmt(t.fat)} g</span><span>Fibre {fmt(t.fiber)} g</span></div>
    <fieldset className="food-items" disabled={!ready||busy} aria-label={`${e.meal} foods`}>
     <div className="food-item-labels"><span>FOOD</span>{macroKeys.map(k=><span key={k}>{short[k]}</span>)}<span/></div>
     {e.items.map((item,i)=><div className={`food-item ${item.matched===false?'unmatched':''}`} key={i}><span className="food-item-name"><strong>{item.name}</strong><small>{item.matched===false?'Not recognised. Add numbers.':[item.quantity,item.grams?`≈ ${fmt(item.grams)} g`:''].filter(Boolean).join(' · ')}</small></span>{macroKeys.map(k=><NumberCell key={k} value={item[k]} label={`${macroLabels[k]} for ${item.name}`} onCommit={n=>changeItem(e,i,{[k]:k==='kcal'?Math.round(n):n})}/>)}<button type="button" className="icon-button" aria-label={`Remove ${item.name}`} disabled={e.items.length<2} onClick={()=>nutrition.updateFood(date,{...e,source:'edited',items:e.items.filter((_,j)=>j!==i)})}><X size={16}/></button></div>)}
    </fieldset>
    <label className="food-meal-select">Meal<select value={e.meal} disabled={!ready} onChange={ev=>nutrition.updateFood(date,{...e,meal:ev.target.value})}>{[...new Set([...meals,e.meal])].map(m=><option key={m}>{m}</option>)}</select></label>
    <div className="exercise-footer"><span><CloudUpload size={14}/> {sourceLabel[e.source]||'Estimate'} · {status}</span><div className="food-actions"><button className="text-button" disabled={!ready||busy} onClick={()=>void reestimate(e)}><RefreshCw size={15}/> Re-estimate</button><button className="text-button" disabled={!ready} onClick={()=>{if(nutrition.removeFood(date,e.id)){setExpanded(null);notify('Entry deleted. Restore it from Deleted entries.');}}}><Trash2 size={15}/> Delete</button></div></div>
   </div>}
  </article>;})}</div>
  {deleted.length>0&&<div className="food-deleted"><button className="text-button" onClick={()=>setShowDeleted(v=>!v)}>{showDeleted?'Hide deleted entries':`Deleted entries (${deleted.length})`}</button>{showDeleted&&deleted.map(e=><div className="food-deleted-row" key={e.id}><span><strong>{e.meal} · {fmt(entryTotals(e).kcal)} kcal</strong><small>{e.text}</small></span><button className="text-button" disabled={!ready} onClick={()=>{if(nutrition.restoreFood(date,e.id))notify('Entry restored.');}}><RotateCcw size={15}/> Restore</button></div>)}</div>}
 </section>
 <aside className="right-column">
  <GoalCard goal={goal} onSettings={onSettings}/>
  <WeekCard nutrition={nutrition} today={today} goal={goal} onPick={n=>onDay(n)} date={date}/>
 </aside></div></>;
}

// What is left today and what the next plate should hold.
function NextMealLine({goal,day}:{goal:Goals;day:FoodDay|undefined}){
 const[now,setNow]=useState(()=>new Date());
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(id);},[]);
 const next=nextMeal(goal,day,now),left=remaining(goal,dayTotals(day));
 if(!next)return <div className="next-meal done"><span className="tiny">TODAY’S GOALS</span><strong>All covered.</strong><p>Calories and protein are in for today.</p></div>;
 return <div className="next-meal"><span className="tiny">NEXT UP · {next.meal.toUpperCase()}</span><strong>About {fmt(next.protein)} g protein · {fmt(next.kcal)} kcal</strong><p>With roughly {fmt(next.carbs)} g carbs, {fmt(next.fat)} g fat and {fmt(next.fiber)} g fibre. {next.capped?`You are behind for the day (${fmt(left.kcal)} kcal left), so this is a full plate rather than the whole gap. Add a smoothie or snack after it.`:next.mealsLeft>1?`That spreads the ${fmt(left.kcal)} kcal still to eat over ${next.mealsLeft} more times today.`:'That covers everything left for today.'}</p></div>;
}
// Shown on the main Today page so goals and what is left stay in view.
export function FuelCard({nutrition,today,onLog,onSettings}:{nutrition:NutritionStore;today:string;onLog:()=>void;onSettings:()=>void}){
 const day=nutrition.days[today],total=dayTotals(day),goal=goals(nutrition.body,today);
 if(!goal)return <section className="fuel-card" aria-label="Today’s food goals"><div className="fuel-head"><div><span className="tiny">TODAY’S FUEL</span><h3>{fmt(total.kcal)} kcal eaten</h3></div><button className="secondary" onClick={onLog}><Utensils size={16}/> Log food</button></div><p className="goal-note">Add your height and weight to see calorie, protein, carb, fat and fibre goals here, with how much is left to eat.</p><button className="text-button" onClick={onSettings}>Set up your goals <ArrowUpRight size={16}/></button></section>;
 const left=remaining(goal,total);
 return <section className="fuel-card" aria-label="Today’s food goals"><div className="fuel-head"><div><span className="tiny">TODAY’S FUEL</span><h3>{fmt(left.kcal)} kcal left <small>of {fmt(goal.kcal)}</small></h3></div><button className="secondary" onClick={onLog}><Utensils size={16}/> Log food</button></div>
  {goal.mode!=='build'&&<p className={`goal-mode ${goal.mode}`}>{goal.title}</p>}
  <div className="macro-meters"><Meter label="Calories" value={total.kcal} goal={goal.kcal} unit="kcal" left={left.kcal}/><Meter label="Protein" value={total.protein} goal={goal.protein} unit="g" left={left.protein}/><Meter label="Carbs" value={total.carbs} goal={goal.carbs} unit="g" left={left.carbs}/><Meter label="Fat" value={total.fat} goal={goal.fat} unit="g" left={left.fat}/><Meter label="Fibre" value={total.fiber} goal={goal.fiber} unit="g" left={left.fiber}/></div>
  <NextMealLine goal={goal} day={day}/></section>;
}

function GoalCard({goal,onSettings}:{goal:Goals|null;onSettings:()=>void}){
 return <div className="rhythm-card goal-card"><div className="section-heading"><h3>Your targets</h3><Ruler size={20}/></div>
  {goal?<><p className={`goal-mode ${goal.mode}`}>{goal.title}</p><dl className="goal-list">{macroKeys.map(k=><div key={k}><dt>{macroLabels[k]}</dt><dd>{fmt(goal[k])} {k==='kcal'?'kcal':'g'}</dd></div>)}</dl><p className="goal-note">{goal.notes[0]}</p></>:<p className="goal-note">Goals are worked out from your height, weight and waist. Add them once, then log changes as they happen.</p>}
  <button className="text-button" onClick={onSettings}>{goal?'Update weight and waist':'Set up your goals'} <ArrowUpRight size={16}/></button></div>;
}
function WeekCard({nutrition,today,goal,date,onPick}:{nutrition:NutritionStore;today:string;goal:Goals|null;date:string;onPick:(offset:number)=>void}){
 const week=Array.from({length:7},(_,i)=>{const d=dayOffset(today,i-6);return{date:d,kcal:dayTotals(nutrition.days[d]).kcal,logged:dayEntries(nutrition.days[d]).length>0};});
 const logged=week.filter(d=>d.logged),average=logged.length?logged.reduce((n,d)=>n+d.kcal,0)/logged.length:0,top=Math.max(goal?.kcal||0,...week.map(d=>d.kcal),1);
 return <div className="rhythm-card food-week"><div className="section-heading"><h3>Last 7 days</h3><Utensils size={20}/></div><div className="rhythm-number">{fmt(average)}<span>kcal a day, on days you logged</span></div>
  <div className="kcal-bars">{week.map(d=><button key={d.date} className={`${d.date===date?'current':''} ${goal&&d.kcal>=goal.kcal*.9?'on-goal':''}`} aria-label={`${displayDate(d.date)}, ${d.logged?`${fmt(d.kcal)} kcal`:'nothing logged'}`} onClick={()=>onPick(Math.round((new Date(d.date+'T12:00:00').getTime()-new Date(date+'T12:00:00').getTime())/86400000))}><span className="kcal-bar"><i style={{height:`${Math.max(d.logged?6:0,d.kcal/top*100)}%`}}/></span><small>{new Date(d.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'narrow'})}</small></button>)}</div></div>;
}

const activities:Record<Activity,string>={light:'Light: desk job, 1-3 sessions a week',moderate:'Moderate: 4-5 lifting sessions a week',high:'High: daily training or an active job'};
const parse=(s:string)=>{const n=Number(s);return s.trim()!==''&&Number.isFinite(n)&&n>0?Math.round(n*10)/10:null;};
export function BodySettings({nutrition,ready,notify}:{nutrition:NutritionStore;ready:boolean;notify:(s:string)=>void}){
 const{body}=nutrition,today=dateKey();
 const[profile,setProfile]=useState({heightCm:'',age:'',sex:body.sex,activity:body.activity});
 const[reading,setReading]=useState({date:today,weightKg:'',waistCm:''});
 useEffect(()=>setProfile({heightCm:body.heightCm?String(body.heightCm):'',age:body.age?String(body.age):'',sex:body.sex,activity:body.activity}),[body.heightCm,body.age,body.sex,body.activity]);
 const rows=Object.entries(body.measurements).filter(([,m])=>m.weightKg||m.waistCm).sort((a,b)=>b[0].localeCompare(a[0])),goal=goals(body);
 const weight=parse(reading.weightKg),waist=parse(reading.waistCm),dateOk=validDate(reading.date)&&reading.date<=today;
 return <section className="history-panel body-settings" aria-label="Body and food goals"><div className="section-heading"><div><h2>Body and food goals.</h2><p className="muted">Your goals follow your weight. Your carbs follow your waist.</p></div></div>
  <form className="session-details" onSubmit={e=>{e.preventDefault();if(nutrition.saveBody({heightCm:parse(profile.heightCm),age:parse(profile.age),sex:profile.sex,activity:profile.activity}))notify('Body profile saved. Goals updated.');}}>
   <div className="form-grid"><label>Height (cm)<input type="number" inputMode="decimal" min="100" max="230" step="0.1" value={profile.heightCm} onChange={e=>setProfile({...profile,heightCm:e.target.value})}/></label><label>Age<input type="number" inputMode="numeric" min="13" max="100" step="1" value={profile.age} onChange={e=>setProfile({...profile,age:e.target.value})}/></label><label>Sex (for the energy formula)<select value={profile.sex} onChange={e=>setProfile({...profile,sex:e.target.value as Body['sex']})}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option></select></label><label>Activity<select value={profile.activity} onChange={e=>setProfile({...profile,activity:e.target.value as Activity})}>{(Object.keys(activities) as Activity[]).map(a=><option key={a} value={a}>{activities[a]}</option>)}</select></label></div>
   <button type="submit" className="secondary" disabled={!ready||!parse(profile.heightCm)}>Save profile <Check size={16}/></button>
  </form>
  <form className="session-details" onSubmit={e=>{e.preventDefault();if(!dateOk||(!weight&&!waist))return;const old=body.measurements[reading.date]||{};if(nutrition.saveMeasurement(reading.date,{weightKg:weight??old.weightKg??null,waistCm:waist??old.waistCm??null})){setReading({date:today,weightKg:'',waistCm:''});notify('Measurement logged. Goals updated.');}}}>
   <h3>Log a measurement</h3>
   <div className="form-grid"><label>Date<input type="date" max={today} value={reading.date} onChange={e=>setReading({...reading,date:e.target.value})}/></label><label>Weight (kg)<input type="number" inputMode="decimal" min="20" max="300" step="0.1" value={reading.weightKg} onChange={e=>setReading({...reading,weightKg:e.target.value})}/></label><label>Waist at the navel (cm)<input type="number" inputMode="decimal" min="40" max="200" step="0.1" value={reading.waistCm} onChange={e=>setReading({...reading,waistCm:e.target.value})}/></label></div>
   <p className="guide-reference">Measure in the morning, before eating, relaxed and not sucked in, tape level with your navel. Log weekly; either field can be left blank.</p>
   <button type="submit" className="secondary" disabled={!ready||!dateOk||(!weight&&!waist)}>Log measurement <Check size={16}/></button>
  </form>
  {rows.length>0&&<div className="reading-list"><div className="reading-row reading-head"><span>DATE</span><span>WEIGHT</span><span>WAIST</span><span/></div>{rows.slice(0,8).map(([date,m])=><div className="reading-row" key={date}><span>{new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><span>{m.weightKg?`${m.weightKg} kg`:'—'}</span><span>{m.waistCm?`${m.waistCm} cm`:'—'}</span><button className="icon-button" aria-label={`Remove measurement from ${date}`} disabled={!ready} onClick={()=>{if(nutrition.saveMeasurement(date,{weightKg:null,waistCm:null}))notify('Measurement removed.');}}><Trash2 size={16}/></button></div>)}</div>}
  {goal?<div className="goal-summary"><p className={`goal-mode ${goal.mode}`}>{goal.title} · {fmt(goal.kcal)} kcal a day</p><ul className="goal-notes">{goal.notes.map(n=><li key={n}>{n}</li>)}</ul><p className="guide-reference">Your goals and what is left to eat are shown on Today and Food.Resting energy {fmt(goal.bmr)} kcal (Mifflin-St Jeor), about {fmt(goal.tdee)} kcal with activity.{goal.waistRatio?` Waist is ${Math.round(goal.waistRatio*100)}% of height.`:''} These are estimates for planning, not medical advice.</p></div>:<p className="guide-reference">Save your height and one weight reading to see daily calorie, protein, carb, fat and fibre goals.</p>}
 </section>;
}
