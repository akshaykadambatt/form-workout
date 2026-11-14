import {useState} from 'react';
import {TrendingUp} from 'lucide-react';
import type {Session} from './model';
import type {NutritionStore} from './nutrition-store';
import {allExercises,bodyMetricLabels,bodySeries,bodyUnits,change,exerciseSeries,metricLabels,overallProgress,trainedExercises,weeklyVolume,type Overall,type BodyMetric,type Metric,type Point} from './progress';
import './progress.css';

const shownPoints=16;
const shortDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1});
const strip=(name:string)=>name.replace('Eccentric-Accentuated/Constant-Tension ','').replace('Eccentric-Accentuated ','').replace('Constant-Tension ','').replace('Unilateral Eccentric-Overloaded ','').replace('Eccentric-Overloaded ','');

// A small line chart: the most recent points, first and last dates, low and high values.
export function TrendChart({points,unit,label}:{points:Point[];unit:string;label:string}){
 const shown=points.slice(-shownPoints),width=320,height=96,pad=6;
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

const verdicts={up:['Growing','Your lifts are trending up. That is the signal for muscle gain.'],flat:['Holding steady','Your lifts are level. Add a rep or a small weight step where sets feel easy.'],down:['Slipping','Your lifts are trending down. Check sleep, food and missed sessions.']} as const;
const signed=(n:number)=>`${n>0?'+':''}${fmt(n)}`;
// The one-glance answer: an average across every exercise, with a verdict.
function OverallProgress({overall}:{overall:Overall}){
 const[open,setOpen]=useState(false),count=(t:string)=>overall.lifts.filter(l=>l.trend===t).length,[title,advice]=verdicts[overall.trend];
 return <div className="overall-progress"><p className={`overall-verdict ${overall.trend}`}><strong>{title}</strong><span>{signed(overall.percent)}% stronger on average since {shortDate(overall.since)}{overall.recent!==null&&`, ${signed(overall.recent)}% in the last 4 weeks`}</span></p>
  <p className="goal-note">{advice}</p>
  {overall.points.length>1&&<TrendChart points={overall.points} unit="%" label="Average progress across all exercises"/>}
  <button type="button" className="text-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{count('up')} up · {count('flat')} level · {count('down')} down across {overall.lifts.length} exercises</button>
  {open&&<ul className="lift-list">{overall.lifts.map(l=><li key={l.name} className={l.trend}><span>{strip(l.name)}</span><strong>{signed(l.percent)}%</strong></li>)}</ul>}
  <p className="guide-reference">Each exercise is compared with its own first session (estimated one-rep max, or reps for bodyweight moves), then averaged. Muscle size is not measured directly: rising strength at 6-15 reps, with weight creeping up and waist steady, is the practical sign of growth.</p>
 </div>;
}
// The same closer look, for one exercise, inside its expanded card.
export function ExerciseTrend({sessions,name}:{sessions:Session[];name:string}){
 const[metric,setMetric]=useState<Metric>('e1rm');
 const probe=exerciseSeries(sessions,name,'reps'),metrics:Metric[]=probe.weighted?['e1rm','top','volume','reps']:['reps'],active=metrics.includes(metric)?metric:metrics[0];
 const full=exerciseSeries(sessions,name,active),points=full.points.slice(-shownPoints);
 if(!points.length)return <p className="exercise-trend-empty">Your progress graph for this exercise appears after you finish a session with it.</p>;
 return <section className="exercise-trend" aria-label={`${strip(name)} progress`}><div className="progress-head"><span className="tiny">YOUR PROGRESS</span><TrendingUp size={16}/></div>
  {metrics.length>1&&<div className="trend-tabs" role="radiogroup" aria-label={`${strip(name)} metric`}>{metrics.map(m=><button key={m} type="button" role="radio" aria-checked={active===m} className={active===m?'selected':''} onClick={()=>setMetric(m)}>{metricLabels[m]}</button>)}</div>}
  <Headline points={points} unit={full.unit}/><TrendChart points={points} unit={full.unit} label={`${strip(name)} ${metricLabels[active].toLowerCase()}`}/>
  {points.length<2&&<p className="goal-note">One session so far. The trend appears after the next one.</p>}
 </section>;
}
// Training progress from finished sessions, shown above the Today hero.
export function ProgressCard({sessions}:{sessions:Session[]}){
 const exercises=trainedExercises(sessions);
 const[choice,setChoice]=useState<string|null>(null),[metric,setMetric]=useState<Metric>('e1rm');
 // Default to the most-trained exercise that has a trend to show.
 const selected=choice??(exercises.find(e=>e.sessions>1)?.name||allExercises),overall=selected===allExercises;
 const probe=overall?null:exerciseSeries(sessions,selected,'reps'),metrics:Metric[]=probe?.weighted?['e1rm','top','volume','reps']:['reps'];
 const active=metrics.includes(metric)?metric:metrics[0];
 const weekly=overall?weeklyVolume(sessions):null,overallScore=overallProgress(sessions);
 // The headline compares the same sessions the chart shows.
 const full=weekly?{points:weekly.points,unit:'kg a week'}:exerciseSeries(sessions,selected,active),series={...full,points:full.points.slice(-shownPoints)};
 if(!exercises.length)return <section className="progress-card" aria-label="Training progress"><div className="progress-head"><span className="tiny">YOUR PROGRESS</span><TrendingUp size={18}/></div><p className="goal-note">Finish a workout and your weights, reps and volume will be charted here.</p></section>;
 return <section className="progress-card" aria-label="Training progress"><div className="progress-head"><span className="tiny">YOUR PROGRESS</span><TrendingUp size={18}/></div>
  {overallScore?<OverallProgress overall={overallScore}/>:<p className="goal-note">Your overall progress score appears once you have repeated an exercise.</p>}
  <span className="tiny progress-detail">LOOK CLOSER</span>
  <label className="progress-select"><span className="sr-only">Exercise</span><select value={selected} onChange={e=>setChoice(e.target.value)}><option value={allExercises}>All exercises · weekly volume</option>{exercises.map(e=><option key={e.name} value={e.name}>{strip(e.name)} ({e.sessions})</option>)}</select></label>
  {!overall&&metrics.length>1&&<div className="trend-tabs" role="radiogroup" aria-label="Metric">{metrics.map(m=><button key={m} type="button" role="radio" aria-checked={active===m} className={active===m?'selected':''} onClick={()=>setMetric(m)}>{metricLabels[m]}</button>)}</div>}
  {series.points.length?<><Headline points={series.points} unit={series.unit}/><TrendChart points={series.points} unit={series.unit} label={`${overall?'Weekly volume':`${strip(selected)} ${metricLabels[active].toLowerCase()}`}`}/>{series.points.length<2&&<p className="goal-note">{overall?'One full week so far. The trend appears after the next one.':'One session so far. The trend appears after the next one.'}</p>}</>:<p className="goal-note">{overall?'Weekly totals appear once a full week of training is behind you.':'No completed sets with numbers for this yet.'}</p>}
  {weekly&&weekly.sessions>0&&<p className="goal-note">This week so far: {fmt(weekly.current)} kg over {weekly.sessions} {weekly.sessions===1?'session':'sessions'}. It joins the chart when the week ends.</p>}
  <p className="guide-reference">{overall?'Weight × reps over every completed set, added up per week (Monday to Sunday), in kg. Single sessions swing because upper and lower days differ, so compare weeks. A week with fewer sessions will read lower.':active==='e1rm'?'Estimated one-rep max from your best set each session (Epley). It rises when you add weight or reps.':active==='volume'?'Weight × reps over the completed sets of this exercise.':active==='top'?'Heaviest completed set each session.':'Total completed reps each session.'}</p>
 </section>;
}

// Weight, waist and intake trends, shown above the Food hero.
export function BodyTrendCard({nutrition,today}:{nutrition:NutritionStore;today:string}){
 const[metric,setMetric]=useState<BodyMetric>('weight');
 const available=(Object.keys(bodyMetricLabels) as BodyMetric[]).filter(m=>bodySeries(nutrition.body,nutrition.days,m,today).length>0);
 if(!available.length)return null;
 const active=available.includes(metric)?metric:available[0],points=bodySeries(nutrition.body,nutrition.days,active,today).slice(-shownPoints),unit=bodyUnits[active];
 return <section className="progress-card" aria-label="Body and food trends"><div className="progress-head"><span className="tiny">YOUR TREND</span><TrendingUp size={18}/></div>
  <div className="trend-tabs" role="radiogroup" aria-label="Trend">{available.map(m=><button key={m} type="button" role="radio" aria-checked={active===m} className={active===m?'selected':''} onClick={()=>setMetric(m)}>{bodyMetricLabels[m]}</button>)}</div>
  <Headline points={points} unit={unit}/><TrendChart points={points} unit={unit} label={bodyMetricLabels[active]}/>
  {points.length<2&&<p className="goal-note">One reading so far. The trend appears after the next one.</p>}
 </section>;
}
