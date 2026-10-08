import {useEffect,useRef,useState} from 'react';
import {ExternalLink,Pause,Play,RotateCcw} from 'lucide-react';
import type {Exercise} from './model';
import catalog from './motion.json';
import './motion.css';

type VideoDemo={type:'video';src:string;poster:string;label:string;source:string;author:string;provider:string;license:string;licenseUrl:string};
type YouTubeDemo={type:'youtube';videoId:string;poster:string;label:string;source:string;author:string};
type Clip=VideoDemo|YouTubeDemo;
type Sequence={type:'sequence';parts:{label:string;demo:Clip}[]};
export const motionCatalog=catalog as Record<string,Clip|Sequence>;
export const movementFor=(exercise:Pick<Exercise,'id'|'referenceId'>)=>motionCatalog[exercise.referenceId||exercise.id];

export function ExerciseMotion({exercise,allowed=true}:{exercise:Pick<Exercise,'id'|'referenceId'|'name'>;allowed?:boolean}){
 const demo=movementFor(exercise);
 return demo?<Movement key={exercise.referenceId||exercise.id} demo={demo} allowed={allowed}/>:<p className="guide-reference">Choose a reference movement in exercise settings to see its demonstration.</p>;
}

function Movement({demo,allowed}:{demo:Clip|Sequence;allowed:boolean}){
 const [part,setPart]=useState(0);
 const clip=demo.type==='sequence'?demo.parts[part].demo:demo;
 return <div className="exercise-motion">
  {demo.type==='sequence'&&<div className="motion-variants" aria-label="Movement parts">{demo.parts.map((p,i)=><button key={p.label} aria-pressed={part===i} onClick={()=>setPart(i)}>{p.label}</button>)}</div>}
  <MotionPlayer key={part} demo={clip} allowed={allowed}/>
  <p className="motion-caption motion-variation">Follow your program notes for tempo, grip, assistance and partial reps.</p>
  <p className="motion-credit"><a href={clip.source} target="_blank" rel="noopener noreferrer">{clip.label} · {clip.author}{clip.type==='video'&&clip.provider!==clip.author?` / ${clip.provider}`:''}</a>{clip.type==='video'&&<> · <a href={clip.licenseUrl} target="_blank" rel="noopener noreferrer">{clip.license}</a> · resized, muted.</>}</p>
 </div>;
}

function MotionPlayer({demo,allowed}:{demo:Clip;allowed:boolean}){
 const box=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null);
 const [playing,setPlaying]=useState(()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const [visible,setVisible]=useState(false),[foreground,setForeground]=useState(!document.hidden);
 const [slow,setSlow]=useState(false),[failed,setFailed]=useState(false),[opened,setOpened]=useState(false);
 const available=allowed&&visible&&foreground;
 const active=playing&&available&&!failed;
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
 // Unmount embedded players when hidden so their audio cannot keep playing.
 // Returning to the card requires another deliberate tap.
 useEffect(()=>{if(!available)setOpened(false);},[available]);
 useEffect(()=>{
  const element=video.current;if(!element)return;
  let disposed=false;element.playbackRate=slow?.5:1;
  if(active){element.play()?.catch(()=>{if(!disposed)setPlaying(false);});}else element.pause();
  return()=>{disposed=true;element.pause();};
 },[active,slow]);
 function restart(){if(video.current){video.current.currentTime=0;if(failed)video.current.load();}setFailed(false);setPlaying(true);}
 return <div ref={box}>
  {demo.type==='youtube'?<>
   <div className="motion-youtube">
    {opened&&available?<iframe title={`${demo.label} video demonstration`} src={`https://www.youtube-nocookie.com/embed/${demo.videoId}?autoplay=1&playsinline=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button className="motion-watch" onClick={()=>setOpened(true)} aria-label={`Play ${demo.label} video`}>
     <img src={demo.poster} alt="" loading="lazy" referrerPolicy="no-referrer"/>
     <span><Play size={23} fill="currentColor"/>Watch form video</span>
    </button>}
   </div>
   <p className="motion-online">YouTube · Internet required <a href={demo.source} target="_blank" rel="noopener noreferrer">Open video <ExternalLink size={13}/></a></p>
  </>:<>
   <div className="motion-stage"><video ref={video} src={demo.src} poster={demo.poster} muted loop playsInline preload="metadata" aria-label={`${demo.label} base movement demonstration`} onError={()=>{setFailed(true);setPlaying(false);}}/><span className="motion-kind">BASE MOVEMENT</span></div>
   <div className="motion-controls">
    <button aria-label={playing?'Pause demonstration':'Play demonstration'} onClick={()=>failed?restart():setPlaying(!playing)}>{playing?<Pause size={17}/>:<Play size={17}/>}<span>{playing?'Pause':'Play'}</span></button>
    <button aria-label="Slow demonstration" aria-pressed={slow} onClick={()=>setSlow(!slow)}>{slow?'½ speed':'1× speed'}</button>
    <button aria-label="Restart demonstration" onClick={restart}><RotateCcw size={17}/></button>
   </div>
   {failed&&<p className="motion-caption" role="status">Video couldn’t load. Check your connection and tap Play to retry.</p>}
  </>}
 </div>;
}
