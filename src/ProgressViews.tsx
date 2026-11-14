import {useState} from 'react';
import {TrendingUp} from 'lucide-react';
import type {Session} from './model';
import type {NutritionStore} from './nutrition-store';
import {allExercises,bodyMetricLabels,bodySeries,bodyUnits,change,exerciseSeries,metricLabels,sessionVolume,trainedExercises,type BodyMetric,type Metric,type Point} from './progress';
import './progress.css';

const shortDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1});
const strip=(name:string)=>name.replace('Eccentric-Accentuated/Constant-Tension ','').replace('Eccentric-Accentuated ','').replace('Constant-Tension ','').replace('Unilateral Eccentric-Overloaded ','').replace('Eccentric-Overloaded ','');

// A small line chart: the most recent points, first and last dates, low and high values.
export function TrendChart({points,unit,label}:{points:Point[];unit:string;label:string}){
 const shown=points.slice(-16),width=320,height=96,pad=6;
 const values=shown.map(p=>p.value),low=Math.min(...values),high=Math.max(...values),span=high-low||1;
 const x=(i:number)=>shown.length===1?width/2:pad+i*(width-pad*2)/(shown.length-1),y=(v:number)=>height-pad-(v-low)/span*(height-pad*2);
 const line=shown.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
 const summary=`${label}: ${shown.map(p=>`${shortDate(p.date)} ${fmt(p.value)} ${unit}`).join(', ')}`;
 return <div className="trend-chart"><div className="trend-scale" aria-hidden="true"><span>{fmt(high)}</span><span>{fmt(low)}</span></div><div className="trend-plot"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={summary}><polygon className="trend-area" points={`${x(0).toFixed(1)},${height} ${line} ${x(shown.length-1).toFixed(1)},${height}`}/><polyline className="trend-line" points={line} vectorEffect="non-scaling-stroke"/></svg>{shown.map((p,i)=><span key={p.date+i} className={`trend-dot ${i===shown.length-1?'last':''}`} style={{left:`${x(i)/width*100}%`,top:`${y(p.value)}px`}} title={`${shortDate(p.date)} · ${fmt(p.value)} ${unit}`}/>)}<div className="trend-dates" aria-hidden="true"><span>{shortDate(shown[0].date)}</span><span>{shown.length>1?shortDate(shown[shown.length-1].date):''}</span></div></div></div>;
}
function Headline({points,unit}:{points:Point[];unit:string}){
 const delta=change(points),last=points[points.length-1];
 return <p className="trend-headline"><strong>{fmt(last.value)} <small>{unit}</small></strong>{delta&&<span className={delta.amount>0?'up':delta.amount<0?'down':''}>{delta.amount>0?'+':''}{fmt(delta.amount)} {unit} ({delta.percent>0?'+':''}{delta.percent}%) since {shortDate(points[0].date)}</span>}</p>;
}

// Training progress from finished sessions, shown above the Today hero.
export function ProgressCard({sessions}:{sessions:Session[]}){
 const exercises=trainedExercises(sessions);
 const[choice,setChoice]=useState<string|null>(null),[metric,setMetric]=useState<Metric>('e1rm');
 // Default to the most-trained exercise that has a trend to show.
 const selected=choice??(exercises.find(e=>e.sessions>1)?.name||allExercises),overall=selected===allExercises;
 const probe=overall?null:exerciseSeries(sessions,selected,'reps'),metrics:Metric[]=probe?.weighted?['e1rm','top','volume','reps']:['reps'];
 const active=metrics.includes(metric)?metric:metrics[0];
 const series=overall?{points:sessionVolume(sessions),unit:'kg'}:exerciseSeries(sessions,selected,active);
 if(!exercises.length)return <section className="progress-card" aria-label="Training progress"><div className="progress-head"><span className="tiny">YOUR PROGRESS</span><TrendingUp size={18}/></div><p className="goal-note">Finish a workout and your weights, reps and volume will be charted here.</p></section>;
 return <section className="progress-card" aria-label="Training progress"><div className="progress-head"><span className="tiny">YOUR PROGRESS</span><TrendingUp size={18}/></div>
  <label className="progress-select"><span className="sr-only">Exercise</span><select value={selected} onChange={e=>setChoice(e.target.value)}><option value={allExercises}>All exercises · session volume</option>{exercises.map(e=><option key={e.name} value={e.name}>{strip(e.name)} ({e.sessions})</option>)}</select></label>
  {!overall&&metrics.length>1&&<div className="trend-tabs" role="radiogroup" aria-label="Metric">{metrics.map(m=><button key={m} type="button" role="radio" aria-checked={active===m} className={active===m?'selected':''} onClick={()=>setMetric(m)}>{metricLabels[m]}</button>)}</div>}
  {series.points.length?<><Headline points={series.points} unit={series.unit}/><TrendChart points={series.points} unit={series.unit} label={`${overall?'Session volume':`${strip(selected)} ${metricLabels[active].toLowerCase()}`}`}/>{series.points.length<2&&<p className="goal-note">One session so far. The trend appears after the next one.</p>}</>:<p className="goal-note">No completed sets with numbers for this yet.</p>}
  <p className="guide-reference">{overall?'Volume is weight × reps over every completed set, in kg. Rising volume over weeks is the main driver of muscle growth.':active==='e1rm'?'Estimated one-rep max from your best set each session (Epley). It rises when you add weight or reps.':active==='volume'?'Weight × reps over the completed sets of this exercise.':active==='top'?'Heaviest completed set each session.':'Total completed reps each session.'}</p>
 </section>;
}

// Weight, waist and intake trends, shown above the Food hero.
export function BodyTrendCard({nutrition,today}:{nutrition:NutritionStore;today:string}){
 const[metric,setMetric]=useState<BodyMetric>('weight');
 const available=(Object.keys(bodyMetricLabels) as BodyMetric[]).filter(m=>bodySeries(nutrition.body,nutrition.days,m,today).length>0);
 if(!available.length)return null;
 const active=available.includes(metric)?metric:available[0],points=bodySeries(nutrition.body,nutrition.days,active,today),unit=bodyUnits[active];
 return <section className="progress-card" aria-label="Body and food trends"><div className="progress-head"><span className="tiny">YOUR TREND</span><TrendingUp size={18}/></div>
  <div className="trend-tabs" role="radiogroup" aria-label="Trend">{available.map(m=><button key={m} type="button" role="radio" aria-checked={active===m} className={active===m?'selected':''} onClick={()=>setMetric(m)}>{bodyMetricLabels[m]}</button>)}</div>
  <Headline points={points} unit={unit}/><TrendChart points={points} unit={unit} label={bodyMetricLabels[active]}/>
  {points.length<2&&<p className="goal-note">One reading so far. The trend appears after the next one.</p>}
 </section>;
}
