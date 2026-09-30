import {useState} from 'react';
import {ArrowRight,Check,Dumbbell} from 'lucide-react';
import {program,ordered,type Settings} from './model';

export function WorkoutPicker({settings,ready,onStart}:{settings:Settings;ready:boolean;onStart:(position:number)=>void}){
 const[position,setPosition]=useState(settings.position);
 const week=Math.floor(position/6),chosen=program[position],exercises=ordered(chosen,settings);
 const name=chosen.name.replace(' #',' body ');
 return <div className="workout-picker">
  <p className="modal-copy">Pick what you feel like training today. Your last weights and reps will be filled in.</p>
  <label className="picker-week">Program week<select value={week} onChange={e=>setPosition(Number(e.target.value)*6+position%6)}>{Array.from({length:9},(_,i)=><option key={i} value={i}>Week {i+1}</option>)}</select></label>
  <div className="workout-options" role="radiogroup" aria-label="Workout">
   {[1,0,3,2,5,4].map(slot=>{const index=week*6+slot,t=program[index],selected=index===position;return <button type="button" role="radio" aria-checked={selected} aria-label={t.name.replace(' #',' body ')} className={`workout-option ${t.kind}`} key={slot} onClick={()=>setPosition(index)}><span className="workout-option-icon"><Dumbbell size={20}/>{selected&&<Check size={19}/>}</span><strong>{t.name.replace(' #',' body ')}</strong><small>{ordered(t,settings).length} exercises{index===settings.position?' · Up next':''}</small></button>;})}
  </div>
  <button className="primary full picker-start" disabled={!ready} onClick={()=>onStart(position)}>Start {name.toLowerCase()} <ArrowRight size={18}/></button>
  <div className="picker-preview"><strong>{name} · Week {chosen.week}</strong><p>{exercises.reduce((n,e)=>n+e.sets,0)} sets · {exercises.map(e=>e.name).join(' · ')}</p></div>
  <p className="guide-reference">The next suggestion follows the workout you finish. You can choose a different one every time.</p>
 </div>;
}
