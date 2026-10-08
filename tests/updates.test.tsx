// @vitest-environment jsdom
import React from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {createUpdateController,initialUpdateState,type UpdateState} from '../src/app-updates';
import {UpdateBanner,UpdateSettings} from '../src/AppUpdates';
class Worker extends EventTarget{state='installing';postMessage=vi.fn();}
let sw:EventTarget&{controller:Worker|null;register:ReturnType<typeof vi.fn>};
let registration:EventTarget&{waiting:Worker|null;installing:Worker|null;active:Worker|null;update:ReturnType<typeof vi.fn>};
let state:UpdateState,allowed:boolean,reload:ReturnType<typeof vi.fn>,control:ReturnType<typeof createUpdateController>|undefined;
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
beforeEach(()=>{
 vi.useFakeTimers();allowed=true;reload=vi.fn();state={...initialUpdateState};
 registration=Object.assign(new EventTarget(),{waiting:null,installing:null,active:new Worker(),update:vi.fn().mockResolvedValue(undefined)});
 sw=Object.assign(new EventTarget(),{controller:registration.active,register:vi.fn().mockResolvedValue(registration)});
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});
 vi.spyOn(navigator,'onLine','get').mockReturnValue(true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
});
afterEach(()=>{control?.dispose();control=undefined;cleanup();vi.restoreAllMocks();vi.useRealTimers();delete (navigator as any).serviceWorker;});
const start=async()=>{control=createUpdateController(s=>state=s,()=>allowed,reload);await settle();};
const waiting=()=>{const worker=new Worker();registration.installing=worker;registration.dispatchEvent(new Event('updatefound'));worker.state='installed';registration.waiting=worker;registration.installing=null;worker.dispatchEvent(new Event('statechange'));return worker;};
it('registers without HTTP cache, detects an already waiting update, and waits for a click',async()=>{
 const worker=new Worker();registration.waiting=worker;await start();
 expect(sw.register).toHaveBeenCalledWith('/sw.js',{scope:'/',updateViaCache:'none'});expect(state.available).toBe(true);
 expect(worker.postMessage).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();
 expect(control!.apply()).toBe(true);expect(worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});
 sw.dispatchEvent(new Event('controllerchange'));expect(reload).toHaveBeenCalledOnce();
});
it('detects a downloaded update and blocks activation while writes are pending',async()=>{
 await start();waiting();expect(state.available).toBe(true);allowed=false;
 expect(control!.apply()).toBe(false);expect(registration.waiting!.postMessage).not.toHaveBeenCalled();
 allowed=true;expect(control!.apply()).toBe(true);
});
it('does not reload if a new save starts while activation is in flight',async()=>{
 await start();waiting();control!.apply();allowed=false;sw.dispatchEvent(new Event('controllerchange'));
 expect(reload).not.toHaveBeenCalled();expect(state.applying).toBe(false);allowed=true;control!.apply();expect(reload).toHaveBeenCalledOnce();
});
it('does not force a reload when another tab activates an update',async()=>{
 await start();waiting();registration.waiting=null;sw.dispatchEvent(new Event('controllerchange'));
 expect(reload).not.toHaveBeenCalled();expect(state.available).toBe(true);control!.apply();expect(reload).toHaveBeenCalledOnce();
});
it('checks on foreground return and every five minutes, but not while hidden',async()=>{
 await start();registration.update.mockClear();vi.advanceTimersByTime(31000);window.dispatchEvent(new Event('focus'));await settle();expect(registration.update).toHaveBeenCalledOnce();
 vi.advanceTimersByTime(300000);await settle();expect(registration.update).toHaveBeenCalledTimes(2);
 vi.spyOn(document,'hidden','get').mockReturnValue(true);vi.advanceTimersByTime(300000);await settle();expect(registration.update).toHaveBeenCalledTimes(2);
});
it('recovers from failed registration and reports offline checks honestly',async()=>{
 sw.register.mockRejectedValueOnce(new Error('Network'));await start();expect(state.message).toMatch(/Couldn’t check/);
 await control!.check();expect(sw.register).toHaveBeenCalledTimes(2);
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);await control!.check();expect(state.message).toMatch(/Connect to the internet/);
});
it('does not mistake first installation for an available update',async()=>{
 registration.active=null;sw.controller=null;await start();waiting();expect(state.available).toBe(false);
 sw.dispatchEvent(new Event('controllerchange'));expect(reload).not.toHaveBeenCalled();
});
it('cleans up listeners and timers, and allows retry if activation stalls',async()=>{
 await start();waiting();control!.apply();vi.advanceTimersByTime(15000);expect(state.applying).toBe(false);expect(state.message).toMatch(/longer than expected/);
 control!.dispose();registration.update.mockClear();vi.advanceTimersByTime(300000);window.dispatchEvent(new Event('focus'));await settle();expect(registration.update).not.toHaveBeenCalled();
});
it('keeps Refresh disabled until saving finishes and leaves a manual check in Settings',()=>{
 const props={...initialUpdateState,available:true,build:'test build',dismissed:false,blockedReason:'Finish syncing your workout before refreshing.',refresh:vi.fn(),dismiss:vi.fn(),check:vi.fn()};
 const {rerender}=render(<UpdateBanner updates={props}/>);
 expect((screen.getByRole('button',{name:'Refresh',exact:true}) as HTMLButtonElement).disabled).toBe(true);
 rerender(<UpdateBanner updates={{...props,blockedReason:''}}/>);fireEvent.click(screen.getByRole('button',{name:'Refresh',exact:true}));expect(props.refresh).toHaveBeenCalledOnce();
 rerender(<UpdateSettings updates={{...props,dismissed:true}}/>);fireEvent.click(screen.getByRole('button',{name:'Check for updates'}));expect(props.check).toHaveBeenCalledOnce();
 expect(screen.getByText('Installed build · test build')).toBeTruthy();
});
