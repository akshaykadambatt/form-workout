import {dateKey,dayOffset} from './model';
import table from './foods.json';

export type Macros={kcal:number;protein:number;carbs:number;fat:number;fiber:number};
export type FoodItem=Macros&{name:string;quantity:string;grams?:number|null;matched?:boolean};
export type FoodSource='ai'|'table'|'edited';
export type FoodEntry={id:string;at:number;meal:string;text:string;items:FoodItem[];source:FoodSource;deletedAt?:number|null};
export type FoodDay={date:string;entries:Record<string,FoodEntry>};
export type Measurement={weightKg?:number|null;waistCm?:number|null};
export type Activity='light'|'moderate'|'high';
export type Body={heightCm:number|null;age:number|null;sex:'male'|'female'|'';activity:Activity;measurements:Record<string,Measurement>};
export const bodyDefaults:Body={heightCm:null,age:null,sex:'',activity:'moderate',measurements:{}};
export const macroKeys=['kcal','protein','carbs','fat','fiber'] as const;
export const meals=['Breakfast','Lunch','Smoothie','Snack','Dinner','Before bed'] as const;
export const zero=():Macros=>({kcal:0,protein:0,carbs:0,fat:0,fiber:0});
const round1=(n:number)=>Math.round(n*10)/10;

export function sum(items:Macros[]):Macros{
 const t=zero();
 items.forEach(i=>macroKeys.forEach(k=>{t[k]+=Number.isFinite(i[k])?i[k]:0;}));
 return{kcal:Math.round(t.kcal),protein:round1(t.protein),carbs:round1(t.carbs),fat:round1(t.fat),fiber:round1(t.fiber)};
}
export function dayEntries(day:FoodDay|undefined,deleted=false){
 return Object.values(day?.entries||{}).filter(e=>Boolean(e.deletedAt)===deleted).sort((a,b)=>a.at-b.at);
}
export const entryTotals=(e:FoodEntry)=>sum(e.items);
export const dayTotals=(day:FoodDay|undefined)=>sum(dayEntries(day).flatMap(e=>e.items));
export function caloriesByDate(days:Record<string,FoodDay>){
 const out:Record<string,number>={};
 Object.values(days).forEach(d=>{if(dayEntries(d).length)out[d.date]=dayTotals(d).kcal;});
 return out;
}
export function mealForTime(d=new Date()):string{
 const h=d.getHours()+d.getMinutes()/60;
 return h<11?'Breakfast':h<15?'Lunch':h<18.5?'Snack':h<21.5?'Dinner':'Before bed';
}
export function newEntry(date:string,text:string,meal:string,items:FoodItem[],source:FoodSource,now=new Date()):FoodEntry{
 // Entries logged for another day keep that day's date with the current clock time.
 const at=new Date(`${date}T12:00:00`);at.setHours(now.getHours(),now.getMinutes(),now.getSeconds(),0);
 return{id:`food-${crypto.randomUUID()}`,at:date===dateKey(now)?now.getTime():at.getTime(),meal,text:text.trim().slice(0,600),items,source};
}

// ---------- Goals ----------
export type GoalMode='build'|'push'|'hold'|'trim';
export type Goals=Macros&{mode:GoalMode;title:string;notes:string[];bmr:number;tdee:number;weightKg:number;waistCm:number|null;waistRatio:number|null;waistChange:number|null};
type Point={date:string;value:number};
function series(body:Body,key:keyof Measurement,upTo:string):Point[]{
 return Object.entries(body.measurements||{}).filter(([d,m])=>d<=upTo&&typeof m?.[key]==='number'&&Number.isFinite(m[key])&&m[key]!>0).map(([date,m])=>({date,value:m[key]!})).sort((a,b)=>a.date.localeCompare(b.date));
}
// The reading the trend is measured against: the newest one that is between
// `min` and `max` days older than the latest reading.
function earlier(points:Point[],min:number,max:number):Point|null{
 const last=points[points.length-1];if(!last)return null;
 return points.filter(p=>p.date<=dayOffset(last.date,-min)&&p.date>=dayOffset(last.date,-max)).pop()||null;
}
const activityFactor:Record<Activity,number>={light:1.375,moderate:1.55,high:1.725};
const plans:Record<GoalMode,{surplus:number;protein:number;fat:number;title:string}>={
 build:{surplus:.10,protein:1.8,fat:.25,title:'Lean gain'},
 push:{surplus:.15,protein:1.8,fat:.25,title:'Eat more: weight has stalled'},
 hold:{surplus:.05,protein:2.0,fat:.30,title:'Carb control: waist is creeping up'},
 trim:{surplus:0,protein:2.2,fat:.30,title:'Hold calories: bring the waist down'},
};
export function goals(body:Body,date=dateKey()):Goals|null{
 const weights=series(body,'weightKg',date),waists=series(body,'waistCm',date),weight=weights[weights.length-1],waist=waists[waists.length-1];
 if(!body.heightCm||!weight)return null;
 const age=body.age||30,sexTerm=body.sex==='male'?5:body.sex==='female'?-161:-78;
 // Mifflin-St Jeor resting energy, scaled by activity.
 const bmr=10*weight.value+6.25*body.heightCm-5*age+sexTerm,tdee=bmr*(activityFactor[body.activity]||activityFactor.moderate);
 const waistBefore=earlier(waists,14,70),waistChange=waist&&waistBefore?round1(waist.value-waistBefore.value):null;
 const waistRatio=waist?waist.value/body.heightCm:null;
 const weightAtWaist=waistBefore?weights.filter(p=>p.date<=waistBefore.date).pop():undefined;
 const weightBefore=earlier(weights,21,60);
 const notes:string[]=[];let mode:GoalMode='build';
 if(waistRatio!==null&&waistRatio>=.5){mode='trim';notes.push(`Waist is ${Math.round(waistRatio*100)}% of height. Under 50% is the usual target, and it matters more for South Asian builds.`);}
 else if(waistChange!==null&&waistChange>=2){mode='trim';notes.push(`Waist is up ${waistChange} cm since ${waistBefore!.date}.`);}
 else if(waistChange!==null&&waistChange>=1){
  const waistPct=waistChange/waistBefore!.value,weightPct=weightAtWaist?(weight.value-weightAtWaist.value)/weightAtWaist.value:0;
  // A waist growing faster than body weight suggests fat rather than muscle.
  if(waistPct>weightPct){mode='hold';notes.push(`Waist is up ${waistChange} cm since ${waistBefore!.date}, faster than your weight.`);}
 }
 if(mode==='build'&&weightBefore&&weight.value-weightBefore.value<.3){mode='push';notes.push(`Weight has moved ${round1(weight.value-weightBefore.value)} kg since ${weightBefore.date} while your waist held steady.`);}
 const plan=plans[mode],kcal=Math.round(tdee*(1+plan.surplus)/10)*10;
 const protein=Math.round(plan.protein*weight.value),fat=Math.round(kcal*plan.fat/9),carbs=Math.max(0,Math.round((kcal-protein*4-fat*9)/4)),fiber=Math.round(kcal/1000*14);
 if(mode==='hold'||mode==='trim')notes.push('Carbs are lowered and protein raised. Keep carbs around training and prefer whole grains, pulses and vegetables over sugar, white rice and fried snacks.');
 if(mode==='build')notes.push('A small surplus for muscle gain. Goals rise as your weight does.');
 if(mode==='push')notes.push('Calories are raised a step. Add a smoothie or a pre-bed snack rather than bigger meals.');
 if(!waist)notes.push('Add a waist measurement so carb goals can react to it.');
 if(!body.age||!body.sex)notes.push('Add age and sex for a closer estimate.');
 return{kcal,protein,carbs,fat,fiber,mode,title:plan.title,notes,bmr:Math.round(bmr),tdee:Math.round(tdee),weightKg:weight.value,waistCm:waist?.value??null,waistRatio,waistChange};
}

// ---------- Remaining and next meal ----------
export function remaining(goal:Macros,total:Macros):Macros{
 const out=zero();macroKeys.forEach(k=>{out[k]=Math.max(0,Math.round(goal[k]-total[k]));});return out;
}
// Typical share of a day's food per eating slot, in the order of mealForTime.
const slots:[string,number][]=[['Breakfast',.25],['Lunch',.3],['Snack',.15],['Dinner',.25],['Before bed',.05]];
export type NextMeal=Macros&{meal:string;mealsLeft:number;capped:boolean};
// No single sitting is asked to carry more than this share of a day's goals.
const largestMeal=.4;
// Splits what is left of today's goals across the eating slots still ahead,
// so the next plate has a concrete target.
export function nextMeal(goal:Macros,day:FoodDay|undefined,now=new Date()):NextMeal|null{
 const left=remaining(goal,dayTotals(day));
 if(left.kcal<=0&&left.protein<=0)return null;
 const eaten=new Set(dayEntries(day).map(e=>e.meal==='Smoothie'?'Snack':e.meal));
 let start=slots.findIndex(([name])=>name===mealForTime(now));
 if(eaten.has(slots[start][0]))start++;
 const ahead=slots.slice(start),share=ahead.length?ahead[0][1]/ahead.reduce((n,[,w])=>n+w,0):1,out=zero();
 let capped=false;
 macroKeys.forEach(k=>{const want=left[k]*share,most=goal[k]*largestMeal;if(want>most+.5&&(k==='kcal'||k==='protein'))capped=true;out[k]=Math.round(Math.min(want,most));});
 return{...out,kcal:Math.round(out.kcal/10)*10,meal:ahead[0]?.[0]||'Anything else today',mealsLeft:Math.max(1,ahead.length),capped};
}

// ---------- Built-in estimator (offline fallback) ----------
type Food={names:string[];per100:number[];units?:Record<string,number|undefined>};
const foods:Food[]=table;
const words:Record<string,number>={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:.5,quarter:.25,couple:2,few:3};
const unitNames:Record<string,string>={g:'g',gm:'g',gms:'g',gram:'g',grams:'g',kg:'kg',kgs:'kg',ml:'ml',l:'l',litre:'l',liter:'l',litres:'l',liters:'l',oz:'oz',ounce:'oz',ounces:'oz',tbsp:'tbsp',tbsps:'tbsp',tablespoon:'tbsp',tablespoons:'tbsp',tsp:'tsp',tsps:'tsp',teaspoon:'tsp',teaspoons:'tsp',cup:'cup',cups:'cup',glass:'glass',glasses:'glass',bowl:'bowl',bowls:'bowl',katori:'katori',katoris:'katori',plate:'plate',plates:'plate',slice:'slice',slices:'slice',piece:'piece',pieces:'piece',pc:'piece',pcs:'piece',nos:'piece',scoop:'scoop',scoops:'scoop',handful:'handful',handfuls:'handful',floret:'piece',florets:'piece'};
const fixed:Record<string,number>={g:1,kg:1000,ml:1,l:1000,oz:28.35};
const fallback:Record<string,number>={tbsp:15,tsp:5,cup:200,glass:250,bowl:250,katori:150,plate:300,slice:30,piece:100,scoop:30,handful:30};
const clean=(s:string)=>s.toLowerCase().replace(/[^a-z0-9./\s-]/g,' ').replace(/\s+/g,' ').trim();
const singular=(w:string)=>w.length>3&&w.endsWith('ies')?w.slice(0,-3)+'y':/(oes|ches|shes|sses|xes)$/.test(w)?w.slice(0,-2):w.length>2&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
const stem=(s:string)=>clean(s).split(' ').map(w=>singular(w)).join(' ');
function distance(a:string,b:string){
 const row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const keep=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=keep;}}
 return row[b.length];
}
export function findFood(name:string):Food|null{
 const text=` ${stem(name)} `;let best:Food|null=null,size=0;
 foods.forEach(f=>f.names.forEach(n=>{const alias=stem(n);if(alias.length>size&&text.includes(` ${alias} `)){best=f;size=alias.length;}}));
 if(best)return best;
 // Tolerate small typos ("brocolli") against single-word names.
 const tokens=text.trim().split(' ').filter(w=>w.length>=5);let closest=3;
 foods.forEach(f=>f.names.forEach(n=>{const alias=stem(n);if(alias.includes(' ')||alias.length<5)return;tokens.forEach(w=>{const d=distance(w,alias);if(d<closest){closest=d;best=f;}});}));
 return best;
}
function amount(s:string):number|null{
 const mixed=/^(\d+)\s+(\d+)\/(\d+)$/.exec(s),fraction=/^(\d+)\/(\d+)$/.exec(s);
 if(mixed)return Number(mixed[1])+Number(mixed[2])/Number(mixed[3]);
 if(fraction)return Number(fraction[1])/Number(fraction[2]);
 if(s in words)return words[s];
 const n=Number(s);return Number.isFinite(n)&&n>0?n:null;
}
export function parseFoods(text:string):{quantity:number;unit:string;name:string;raw:string}[]{
 return text.split(/[,;\n+&]|\band\b|\bwith\b/i).map(part=>part.trim()).filter(Boolean).map(raw=>{
  const part=clean(raw);
  const m=/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[a-z]+)?\s*(.*)$/.exec(part)!;
  let quantity=m[1]?amount(m[1]):null,rest=quantity===null?part:m[2];
  if(quantity===null)quantity=1;
  let unit='';
  const attached=/^(g|gm|gms|kg|ml|l|oz)\b\s*(.*)$/.exec(rest),first=rest.split(' ')[0];
  if(attached){unit=unitNames[attached[1]];rest=attached[2];}
  else if(unitNames[first]){unit=unitNames[first];rest=rest.slice(first.length).trim();}
  // "3 lets of broccoli": an unknown measure word before "of" counts as pieces.
  else if(/^[a-z]+ of /.test(rest)){unit='piece';rest=rest.slice(first.length).trim();}
  rest=rest.replace(/^of\s+/,'').trim();
  return{quantity,unit,name:rest||part,raw};
 });
}
export function estimateFromTable(text:string):FoodItem[]{
 return parseFoods(text).map(p=>{
  const food=findFood(p.name),label=p.raw.replace(/\s+/g,' ').slice(0,80);
  if(!food)return{name:p.name.slice(0,80),quantity:label,grams:null,...zero(),matched:false};
  const units=food.units||{},unit=p.unit||(units.piece?'piece':units.cup?'cup':'g100');
  const each=unit==='g100'?100:fixed[unit]??units[unit]??(unit==='slice'?units.piece:unit==='bowl'&&units.cup?units.cup*1.25:unit==='katori'&&units.cup?units.cup*.625:unit==='glass'&&units.cup?units.cup:undefined)??fallback[unit]??100;
  const grams=Math.round(p.quantity*each),k=grams/100,[kcal,protein,carbs,fat,fiber]=food.per100;
  return{name:food.names[0],quantity:label,grams,kcal:Math.round(kcal*k),protein:round1(protein*k),carbs:round1(carbs*k),fat:round1(fat*k),fiber:round1(fiber*k),matched:true};
 });
}
export function sanitizeItems(raw:unknown):FoodItem[]{
 if(!Array.isArray(raw))return[];
 const num=(v:unknown,max:number)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.min(max,n):0;};
 return raw.slice(0,40).map((r:any)=>({name:String(r?.name||'Food').slice(0,80),quantity:String(r?.quantity||'').slice(0,80),grams:r?.grams==null?null:Math.round(num(r.grams,5000)),kcal:Math.round(num(r?.kcal,5000)),protein:round1(num(r?.protein,500)),carbs:round1(num(r?.carbs,1000)),fat:round1(num(r?.fat,500)),fiber:round1(num(r?.fiber,200)),matched:true}));
}
