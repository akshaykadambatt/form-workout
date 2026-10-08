// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {existsSync,readFileSync} from 'node:fs';
import {program} from '../src/model';
import {ExerciseMotion,motionCatalog,movementFor} from '../src/ExerciseMotion';
import {diagrams,geometry,poseAt} from '../src/movement-diagrams';

let intersect:(entries:{isIntersecting:boolean}[])=>void;
let reduced=false;
beforeEach(()=>{
 reduced=false;
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:reduced,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof intersect){intersect=callback;}observe(){}disconnect(){}});
 vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
 vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const exercise=(id:string)=>({id,name:id});
it('covers every programmed movement, ships its media and includes video license attribution',()=>{
 const ids=new Set(program.flatMap(s=>s.exercises.map(e=>e.id)));
 expect(ids.size).toBe(77);
 expect(Object.keys(motionCatalog).sort()).toEqual([...ids].sort());
 const credits=readFileSync('public/motion/credits.txt','utf8');
 for(const id of ids){const demo=motionCatalog[id];if(demo.type==='video'){
  expect(existsSync('public'+demo.src)).toBe(true);expect(existsSync('public'+demo.poster)).toBe(true);
  expect(credits).toContain(demo.source);expect(credits).toContain(demo.author);expect(demo.license).toBe('CC BY-SA 4.0');
 }else{for(const rig of demo.rigs)expect(diagrams[rig],id).toBeDefined();if(demo.rigs.length>1)expect(demo.parts?.length).toBe(demo.rigs.length);}}
});
it('uses a substituted movement reference and safely handles unknown references',()=>{
 expect(movementFor({id:'back-squat',referenceId:'deadlift'})).toBe(motionCatalog.deadlift);
 render(<ExerciseMotion exercise={{id:'back-squat',name:'Custom',referenceId:'not-in-catalog'}}/>);
 expect(screen.getByText(/Choose a reference movement/)).toBeTruthy();
});
it('keeps all animated poses finite and bounded, loops smoothly, and holds planks steady',()=>{
 for(const d of Object.values(diagrams)){
  expect(poseAt(d,0)).toEqual(poseAt(d,1));
  for(let i=0;i<=40;i++){
   const pose=poseAt(d,i/40),g=geometry(d,pose);
   for(const pt of Object.values(pose)){expect(pt[0]).toBeGreaterThan(0);expect(pt[0]).toBeLessThan(320);expect(pt[1]).toBeGreaterThanOrEqual(0);expect(pt[1]).toBeLessThan(240);}
   expect(JSON.stringify(g)).not.toMatch(/NaN|Infinity/);
  }
  if(!d.hold)expect(poseAt(d,0)).not.toEqual(poseAt(d,.5));
 }
 expect(poseAt(diagrams.plank,0)).toEqual(poseAt(diagrams.plank,.5));
});
it('starts paused for reduced motion and lets the user play, slow down and pause',()=>{
 reduced=true;render(<ExerciseMotion exercise={exercise('back-squat')}/>);
 expect(screen.getByRole('button',{name:'Play demonstration'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Play demonstration'}));
 fireEvent.click(screen.getByRole('button',{name:'Slow demonstration'}));
 expect(screen.getByRole('button',{name:'Slow demonstration'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'Pause demonstration'}));
 expect(screen.getByRole('button',{name:'Play demonstration'})).toBeTruthy();
});
it('plays a video only when visible and allowed, and pauses it on cleanup',async()=>{
 const {rerender,unmount}=render(<ExerciseMotion exercise={exercise('barbell-bench-press')}/>);
 expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
 await act(async()=>intersect([{isIntersecting:true}]));
 expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
 rerender(<ExerciseMotion exercise={exercise('barbell-bench-press')} allowed={false}/>);
 expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
 const calls=vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;unmount();
 expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length).toBeGreaterThan(calls);
});
it('offers a retry after a video error and handles blocked autoplay',async()=>{
 const {container}=render(<ExerciseMotion exercise={exercise('barbell-bench-press')}/>);
 fireEvent.error(container.querySelector('video')!);expect(screen.getByRole('status').textContent).toContain('couldn’t load');
 fireEvent.click(screen.getByRole('button',{name:'Play demonstration'}));expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
 vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('Autoplay blocked'));
 await act(async()=>intersect([{isIntersecting:true}]));
 expect(screen.getByRole('button',{name:'Play demonstration'})).toBeTruthy();
});
it('lets combination exercises show each movement separately',()=>{
 render(<ExerciseMotion exercise={exercise('pendlay-row-barbell-bent-over-row')}/>);
 fireEvent.click(screen.getByRole('button',{name:'Bent-over row',exact:true}));
 expect(screen.getByRole('button',{name:'Bent-over row',exact:true}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByText(/Hold your torso steady/)).toBeTruthy();
});
