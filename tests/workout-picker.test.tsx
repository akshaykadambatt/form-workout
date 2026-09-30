// @vitest-environment jsdom
import React from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {createSession,defaults,dateKey,dayOffset,program,type Session} from '../src/model';
const fixture=vi.hoisted(()=>({store:{} as any}));
vi.mock('../src/store',()=>({useWorkoutStore:()=>fixture.store}));
import App from '../src/App';
beforeEach(()=>{
 vi.stubGlobal('scrollTo',vi.fn());HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 fixture.store={settings:{...defaults,onboarded:true,sequenceChosenAt:Date.now()},sessions:[],user:{uid:'test',displayName:'Tester'},ready:true,status:'Saved to Firebase',error:'',deviceConflicts:0,addSession:vi.fn(()=>true),saveSettings:vi.fn()};
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('starts the selected upper workout with its previous values, without changing settings during selection',()=>{
 const past=createSession({...defaults,position:1},[],new Date(dayOffset(dateKey(),-2)+'T12:00:00'));past.finishedAt=past.startedAt+3600000;past.exercises[0].sets[0].done=true;past.exercises[0].sets[0].segments[0]={weight:95,reps:7};fixture.store.sessions=[past];
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Choose workout',exact:true}));fireEvent.click(screen.getByRole('radio',{name:'Upper body 1',exact:true}));
 expect(fixture.store.addSession).not.toHaveBeenCalled();expect(fixture.store.saveSettings).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Start upper body 1',exact:true}));
 const s=fixture.store.addSession.mock.calls[0][0] as Session;expect(s.index).toBe(1);expect(s.name).toBe('Upper #1');expect(s.date).toBe(dateKey());expect(s.exercises[0].sets[0].segments[0]).toEqual({weight:95,reps:7});expect(s.exercises[0].sets[0].done).toBe(false);expect(fixture.store.sessions[0]).toEqual(past);
});
it('selects the correct lower workout and prescription from another program week',()=>{
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Choose workout',exact:true}));fireEvent.change(screen.getByRole('combobox',{name:'Program week'}),{target:{value:'2'}});fireEvent.click(screen.getByRole('radio',{name:'Lower body 2',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Start lower body 2',exact:true}));
 const s=fixture.store.addSession.mock.calls[0][0] as Session;expect(s.index).toBe(14);expect(s.week).toBe(3);expect(s.exercises.map(e=>e.exercise)).toEqual(program[14].exercises);
});
it('cancels without starting or moving the program',()=>{
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Choose workout',exact:true}));expect(screen.getAllByRole('radio')).toHaveLength(6);fireEvent.click(screen.getByRole('radio',{name:'Upper body 3',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Close',exact:true}));expect(fixture.store.addSession).not.toHaveBeenCalled();expect(fixture.store.saveSettings).not.toHaveBeenCalled();
});
it('keeps the picker open if starting is rejected and does not offer replacement of an active session',()=>{
 fixture.store.addSession.mockReturnValue(false);const {unmount}=render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Choose workout',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Start lower body 1',exact:true}));expect(screen.getByRole('radiogroup',{name:'Workout'})).toBeTruthy();unmount();
 fixture.store.sessions=[createSession(defaults,[])];render(<App/>);expect(screen.queryByRole('button',{name:'Choose workout',exact:true})).toBeNull();expect(screen.getByRole('button',{name:'Pause',exact:true})).toBeTruthy();
});
