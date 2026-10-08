import {useEffect,useRef,useState} from 'react';
import {Pause,Play,RotateCcw} from 'lucide-react';
import type {Exercise} from './model';
import catalog from './motion.json';
import {diagrams,geometry,poseAt,type Diagram} from './movement-diagrams';
import './motion.css';

type VideoDemo={type:'video';src:string;poster:string;label:string;source:string;author:string;license:string;licenseUrl:string};
type VectorDemo={type:'diagram';rigs:string[];label:string;parts?:string[]};
export const motionCatalog=catalog as Record<string,VideoDemo|VectorDemo>;
export const movementFor=(exercise:Pick<Exercise,'id'|'referenceId'>)=>motionCatalog[exercise.referenceId||exercise.id];

export function MovementFigure({diagram,time=0}:{diagram:Diagram;time?:number}){
 const g=geometry(diagram,poseAt(diagram,time));
 return <svg className="movement-figure" viewBox="0 -12 320 252" role="img" aria-label={`Simplified ${diagram.view==='front'?'front':'side'} view of the movement`}>
  <path d="M28 221H292" stroke="#d8d0c4" strokeWidth="2"/>
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
   <path d={diagram.fixture} stroke="#b0aaa1" strokeWidth="5"/>
   <path d={g.cable} stroke="#c45981" strokeWidth="3"/>
   <path d={g.leg2} stroke="#9fa9a3" strokeWidth="12"/>
   <path d={g.arm2} stroke="#9fa9a3" strokeWidth="9"/>
   <path d={g.body} stroke="#263b38" strokeWidth="23"/>
   <path d={g.shoulders} stroke="#263b38" strokeWidth="12"/>
   <path d={g.leg} stroke="#263b38" strokeWidth="13"/>
   <path d={g.arm} stroke="#263b38" strokeWidth="10"/>
   <circle cx={g.head[0]} cy={g.head[1]} r="11" fill="#263b38"/>
   {diagram.equipment==='band'&&<path d={g.cable} stroke="#c45981" strokeWidth="3"/>}
   <path d={g.gear} stroke="#8951ba" strokeWidth="6"/>
  </g>
  {diagram.hold&&<circle cx="278" cy="38" r={8+Math.sin(time*Math.PI*2)*3} fill="#8951ba" opacity=".6"/>}
 </svg>;
}

export function ExerciseMotion({exercise,allowed=true}:{exercise:Pick<Exercise,'id'|'referenceId'|'name'>;allowed?:boolean}){
 const demo=movementFor(exercise);
 // Reset playback and errors when the user selects a different reference movement.
 return demo?<MotionPlayer key={exercise.referenceId||exercise.id} demo={demo} allowed={allowed}/>:<p className="guide-reference">Choose a reference movement in exercise settings to see its demonstration.</p>;
}

function MotionPlayer({demo,allowed}:{demo:VideoDemo|VectorDemo;allowed:boolean}){
 const box=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null),clock=useRef(0);
 const [playing,setPlaying]=useState(()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const [visible,setVisible]=useState(false),[foreground,setForeground]=useState(!document.hidden);
 const [time,setTime]=useState(0),[slow,setSlow]=useState(false),[rigIndex,setRigIndex]=useState(0),[failed,setFailed]=useState(false);
 const active=playing&&allowed&&visible&&foreground&&!failed;
 const diagram=demo.type==='diagram'?diagrams[demo.rigs[rigIndex]]:null;
 useEffect(()=>{
  const onVisibility=()=>setForeground(!document.hidden);
  document.addEventListener('visibilitychange',onVisibility);
  const node=box.current;
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.15});
  if(node&&observer)observer.observe(node);else setVisible(true);
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onPreference=()=>{if(media?.matches)setPlaying(false);};
  media?.addEventListener('change',onPreference);
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);media?.removeEventListener('change',onPreference);};
 },[]);
 useEffect(()=>{
  const element=video.current;if(!element)return;
  let disposed=false;element.playbackRate=slow?.5:1;
  if(active){element.play()?.catch(()=>{if(!disposed)setPlaying(false);});}else element.pause();
  return()=>{disposed=true;element.pause();};
 },[active,slow]);
 useEffect(()=>{
  if(!active||!diagram)return;
  let frame=0,last=0,paint=0;
  const tick=(now:number)=>{
   if(last)clock.current=(clock.current+Math.min(now-last,100)/(slow?8000:4000))%1;
   last=now;if(now-paint>=40){setTime(clock.current);paint=now;}
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[active,slow,diagram]);
 function restart(){clock.current=0;setTime(0);if(video.current){video.current.currentTime=0;if(failed)video.current.load();}setFailed(false);setPlaying(true);}
 return <div className="exercise-motion" ref={box}>
  <div className="motion-stage">
   {demo.type==='video'?<video ref={video} src={demo.src} poster={demo.poster} muted loop playsInline preload="metadata" aria-label={`${demo.label} base movement demonstration`} onError={()=>{setFailed(true);setPlaying(false);}}/>:diagram&&<MovementFigure diagram={diagram} time={time}/>}
   <span className="motion-kind">{demo.type==='video'?'BASE MOVEMENT':'ILLUSTRATED MOVEMENT'}</span>
  </div>
  {demo.type==='diagram'&&demo.rigs.length>1&&<div className="motion-variants" aria-label="Movement parts">{demo.rigs.map((rig,i)=><button key={rig} aria-pressed={rigIndex===i} onClick={()=>{setRigIndex(i);clock.current=0;setTime(0);}}>{demo.parts?.[i]||`Part ${i+1}`}</button>)}</div>}
  <div className="motion-controls">
   <button aria-label={playing?'Pause demonstration':'Play demonstration'} onClick={()=>failed?restart():setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}<span>{playing?'Pause':'Play'}</span></button>
   <button aria-label="Slow demonstration" aria-pressed={slow} onClick={()=>setSlow(!slow)}>{slow?'½ speed':'1× speed'}</button>
   <button aria-label="Restart demonstration" onClick={restart}><RotateCcw size={17}/></button>
  </div>
  {failed?<p className="motion-caption" role="status">Video couldn’t load. Check your connection and tap Play to retry.</p>:diagram?<><p className="motion-phase">{diagram.phases[(Math.floor(time*diagram.poses.length)+1)%diagram.phases.length]}</p><p className="motion-caption">{diagram.cue}</p></>:null}
  <p className="motion-caption motion-variation">{demo.type==='diagram'?'Simplified movement path. ':''}Follow your program notes for tempo, grip, assistance and partial reps.</p>
  {demo.type==='video'&&<p className="motion-credit"><a href={demo.source} target="_blank" rel="noreferrer">{demo.label} · {demo.author} / wger</a> · <a href={demo.licenseUrl} target="_blank" rel="noreferrer">{demo.license}</a> · resized, muted.</p>}
 </div>;
}
