// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {existsSync,readFileSync} from 'node:fs';
import {program} from '../src/model';
import {ExerciseMotion,motionCatalog,movementFor} from '../src/ExerciseMotion';

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
 for(const id of ids){const entry=motionCatalog[id];const clips=entry.type==='sequence'?entry.parts.map(p=>p.demo):[entry];
  for(const demo of clips){expect(credits).toContain(demo.source);expect(credits).toContain(demo.author);
   if(demo.type==='video'){
    expect(existsSync('public'+demo.src)).toBe(true);expect(existsSync('public'+demo.poster)).toBe(true);
    expect(['CC BY-SA 4.0','Free app-use licence']).toContain(demo.license);
   }else{expect(demo.type).toBe('youtube');expect(demo.videoId).toMatch(/^[\w-]{11}$/);expect(demo.source).toBe(`https://www.youtube.com/watch?v=${demo.videoId}`);}
  }
 }
});
it('uses a substituted movement reference and safely handles unknown references',()=>{
 expect(movementFor({id:'back-squat',referenceId:'deadlift'})).toBe(motionCatalog.deadlift);
 render(<ExerciseMotion exercise={{id:'back-squat',name:'Custom',referenceId:'not-in-catalog'}}/>);
 expect(screen.getByText(/Choose a reference movement/)).toBeTruthy();
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
it('loads YouTube only after a tap and removes the player when hidden without restarting automatically',async()=>{
 const {container,rerender}=render(<ExerciseMotion exercise={exercise('good-morning')}/>);
 expect(container.querySelector('iframe')).toBeNull();
 await act(async()=>intersect([{isIntersecting:true}]));
 fireEvent.click(screen.getByRole('button',{name:/Play .* video/}));
 const iframe=container.querySelector('iframe')!;
 expect(iframe.src).toContain('youtube-nocookie.com/embed/YA-h3n9L4YU');
 expect(iframe.src).toContain('playsinline=1');
 expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
 expect(screen.getByRole('link',{name:'Open video'}).getAttribute('href')).toBe('https://www.youtube.com/watch?v=YA-h3n9L4YU');
 rerender(<ExerciseMotion exercise={exercise('good-morning')} allowed={false}/>);
 expect(container.querySelector('iframe')).toBeNull();
 rerender(<ExerciseMotion exercise={exercise('good-morning')}/>);
 expect(container.querySelector('iframe')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Play .* video/}));
 await act(async()=>intersect([{isIntersecting:false}]));
 expect(container.querySelector('iframe')).toBeNull();
 await act(async()=>intersect([{isIntersecting:true}]));
 expect(container.querySelector('iframe')).toBeNull();
});
it('removes embedded playback when the app enters the background',async()=>{
 const {container}=render(<ExerciseMotion exercise={exercise('good-morning')}/>);
 await act(async()=>intersect([{isIntersecting:true}]));
 fireEvent.click(screen.getByRole('button',{name:/Play .* video/}));
 expect(container.querySelector('iframe')).not.toBeNull();
 vi.spyOn(document,'hidden','get').mockReturnValue(true);
 fireEvent(document,new Event('visibilitychange'));
 expect(container.querySelector('iframe')).toBeNull();
});
it('lets combination exercises show each video separately and resets the previous player',async()=>{
 const {container,rerender}=render(<ExerciseMotion exercise={exercise('pendlay-row-barbell-bent-over-row')}/>);
 await act(async()=>intersect([{isIntersecting:true}]));
 fireEvent.click(screen.getByRole('button',{name:/Play .* video/}));
 expect(container.querySelector('iframe')!.src).toContain('axoeDmW0oAY');
 fireEvent.click(screen.getByRole('button',{name:'Bent-over row',exact:true}));
 expect(screen.getByRole('button',{name:'Bent-over row',exact:true}).getAttribute('aria-pressed')).toBe('true');
 expect(container.querySelector('iframe')).toBeNull();
 expect(screen.getByRole('link',{name:'Open video'}).getAttribute('href')).toContain('FWJR5Ve8bnQ');
 rerender(<ExerciseMotion exercise={exercise('dumbbell-front-raise-lateral-raise')}/>);
 fireEvent.click(screen.getByRole('button',{name:'Lateral raise',exact:true}));
 expect(container.querySelector('video')!.getAttribute('src')).toBe('/motion/wger-348.mp4');
});
