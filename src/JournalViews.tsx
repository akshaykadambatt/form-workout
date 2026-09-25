import {useRef} from 'react';
import {ArrowLeft,ArrowRight,Check,Dumbbell,Eye,Pencil,Trash2,RotateCcw,Play,Pause,Plus} from 'lucide-react';
import {calendarDays,dateKey,dayOffset,progress,sessionLabel,sessionOnDate,sessionState,type Session,type Template} from './model';
import {themes,resolveTheme} from './themes';
export const displayDate=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

export function DayCard({date,today,session,template,state,active,ready,onDay,onToday,onStart,onResume,onPause,onEdit,review}:{date:string;today:string;session:Session|null;template:Template;state:string;active:Session|null;ready:boolean;onDay:(n:number)=>void;onToday:()=>void;onStart:()=>void;onResume:()=>void;onPause:()=>void;onEdit:()=>void;review:boolean}){
 const touch=useRef<{x:number;y:number}|null>(null),future=date>today,past=date<today,counts=progress(session);
 const heading=session?sessionLabel(session):future?'Room for tomorrow.':past?'A day to recover.':'Ready when you are.';
 return <section className="day-card-shell" aria-label="Workout day">
  {!review&&<div className="day-navigation"><button className="icon-button" aria-label="Previous day" onClick={()=>onDay(-1)}><ArrowLeft size={20}/></button><button className="day-label" onClick={onToday}><strong>{date===today?'Today':date===dayOffset(today,-1)?'Yesterday':date===dayOffset(today,1)?'Tomorrow':new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})}</strong><span>{new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric'})}</span></button><button className="icon-button" aria-label="Next day" onClick={()=>onDay(1)}><ArrowRight size={20}/></button></div>}
  <div className={`session-hero day-hero ${session?session.kind:'unstarted'}`} onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{if(!touch.current||review)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)onDay(dx<0?1:-1);}}>
   <div><span className="hero-pill">{session?state:future?'NOT STARTED':past?'NO WORKOUT LOGGED':'NO SESSION IN PROGRESS'}</span><h2>{heading}</h2><p>{session?`${session.exercises.length} exercises · ${session.date}`:future?'A blank page. Nothing has been logged.':past?'No sets recorded on this date.':`Up next: ${template.name.replace(' #',' body ')} · Week ${template.week}`}</p></div><div className="hero-art" aria-hidden="true"><Dumbbell strokeWidth={1.1}/></div>
   <div className="hero-bottom"><span>{session?`${counts.done} of ${counts.total} sets complete`:future?'Rest or train. Decide tomorrow.':past?'Rest days count, too.':'Your session starts only when you tap.'}</span>
    {!session&&date===today&&<button className="dark-button" disabled={!ready||!!active} onClick={onStart}><Plus size={18}/> Start session</button>}
    {session&&state==='In progress'&&<button className="dark-button" disabled={!ready} onClick={onPause}><Pause size={16}/> Pause</button>}
    {session&&state==='Paused'&&<button className="dark-button" disabled={!ready||!!active} onClick={onResume}><Play size={16}/> Resume</button>}
    {session&&state==='Completed'&&<button className="dark-button" disabled={!ready} onClick={onEdit}><Pencil size={16}/> Edit session</button>}
   </div>
  </div>
  {!review&&date!==today&&<button className="text-button return-today" onClick={onToday}>Back to today <RotateCcw size={14}/></button>}
 </section>;
}

export function TrainingCalendar({month,sessions,selectedDate,onMonth,onSelect}:{month:string;sessions:Session[];selectedDate:string|null;onMonth:(n:number)=>void;onSelect:(date:string)=>void}){
 const today=dateKey();
 return <section className="history-panel month-calendar" aria-label="Training calendar"><div className="section-heading"><div><h2>Your training calendar</h2><p className="muted">One day. One workout.</p></div></div><div className="month-heading"><button className="icon-button" aria-label="Previous month" onClick={()=>onMonth(-1)}><ArrowLeft size={20}/></button><h3>{new Date(month+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h3><button className="icon-button" aria-label="Next month" onClick={()=>onMonth(1)}><ArrowRight size={20}/></button></div><div className="month-grid">{['M','T','W','T','F','S','S'].map((day,i)=><span className="weekday-label" key={i}>{day}</span>)}{calendarDays(month).map(date=>{
  const s=sessionOnDate(sessions,date),outside=date.slice(0,7)!==month;
  return <button key={date} className={`month-day ${outside?'outside':''} ${s?s.kind:''} ${s&&!s.finishedAt?'partial':''} ${date===today?'is-today':''} ${date===selectedDate?'date-selected':''}`} aria-label={`${displayDate(date)}${s?`, ${sessionLabel(s)}, ${s.finishedAt?'completed':'unfinished'}`:', no workout'}`} aria-pressed={date===selectedDate} aria-current={date===today?'date':undefined} onClick={()=>onSelect(date)}><span>{Number(date.slice(-2))}</span>{s&&<span className="day-mark" aria-hidden="true">{s.finishedAt?<Check size={13}/>:<span>•</span>}</span>}</button>;
 })}</div><div className="calendar-legend"><span><i className="legend-pink"/>Upper</span><span><i className="legend-purple"/>Lower</span><span>Outline = unfinished</span></div></section>;
}

export function SessionHistory({sessions,allSessions,onView,onEdit,onDelete,onRestore,trash,ready}:{sessions:Session[];allSessions:Session[];onView:(s:Session)=>void;onEdit:(s:Session)=>void;onDelete:(s:Session)=>void;onRestore:(s:Session)=>void;trash:boolean;ready:boolean}){
 return <div className="session-history">{sessions.map(s=><article className="history-entry" key={s.id}><div className="history-entry-main"><span className={`history-icon ${s.kind}`}><Dumbbell size={21}/></span><div><h3>{sessionLabel(s)}</h3><p><time dateTime={s.date}>{new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</time> · Week {s.week} · {progress(s).done} sets</p></div><span className="history-status">{sessionState(s,allSessions)}</span></div><div className="history-actions"><button onClick={()=>onView(s)}><Eye size={17}/> View</button><button disabled={!ready} onClick={()=>onEdit(s)}><Pencil size={17}/> Edit</button>{trash?<button disabled={!ready} onClick={()=>onRestore(s)}><RotateCcw size={17}/> Restore</button>:<button className="delete-action" disabled={!ready} onClick={()=>onDelete(s)}><Trash2 size={17}/> Delete</button>}</div></article>)}</div>;
}

export function ThemeSettings({value,onChange,disabled}:{value?:string;onChange:(id:string)=>void;disabled:boolean}){
 return <section className="theme-settings"><div className="section-heading"><div><h2>Make it yours.</h2><p className="muted">Five palettes. Five personalities. Synced across your devices.</p></div></div><div className="theme-grid" role="radiogroup" aria-label="App theme">{themes.map(t=><button key={t.id} type="button" role="radio" aria-checked={resolveTheme(value).id===t.id} aria-label={`${t.name} theme`} disabled={disabled} className="theme-option" onClick={()=>onChange(t.id)}><span className="theme-preview" style={{background:t.base,borderColor:t.line,borderRadius:t.radius/2}}><span style={{background:t.upper,borderRadius:t.small}}/><span style={{background:t.lower,borderRadius:t.small}}/><span style={{background:t.accent,borderRadius:t.pill}}/></span><span className="theme-name">{t.name}{resolveTheme(value).id===t.id&&<Check size={17}/>}</span><small>{t.description}</small><span className="theme-mode">{t.mode==='dark'?'Dark':'Light'}</span></button>)}</div></section>;
}
