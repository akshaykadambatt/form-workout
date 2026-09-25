// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {createSession,defaults} from '../src/model';
import {readLocal,writeLocal,exportDeviceCopies,preserveBackup} from '../src/device-journal';
const mock=vi.hoisted(()=>({
 auth:{currentUser:null as any},authListener:((_:any)=>{}) as (u:any)=>void,
 rows:new Map<string,any>(),listeners:new Map<string,Function>(),cache:false,gate:null as Promise<void>|null,beforeTransaction:null as (()=>void)|null,
 emit:()=>{},
}));
const firestore=vi.hoisted(()=>({setDoc:vi.fn(),updateDoc:vi.fn(),runTransaction:vi.fn(),waitForPendingWrites:vi.fn()}));
const authMocks=vi.hoisted(()=>({signOut:vi.fn(),signInWithPopup:vi.fn()}));
vi.mock('firebase/app',()=>({getApps:()=>[],initializeApp:()=>({})}));
vi.mock('firebase/auth',()=>({getAuth:()=>mock.auth,GoogleAuthProvider:class{setCustomParameters(){}},signInWithPopup:authMocks.signInWithPopup,signOut:authMocks.signOut,onAuthStateChanged:(_:any,cb:any)=>{mock.authListener=cb;return()=>{};}}));
vi.mock('firebase/firestore',()=>({
 initializeFirestore:()=>({}),getFirestore:()=>({}),persistentLocalCache:()=>({}),persistentMultipleTabManager:()=>({}),
 doc:(_:any,...parts:string[])=>parts.join('/'),collection:(_:any,...parts:string[])=>parts.join('/'),
 onSnapshot:(path:string,_:any,cb:Function)=>{mock.listeners.set(path,cb);mock.emit();return()=>mock.listeners.delete(path);},
 ...firestore,writeBatch:()=>({set:()=>{},update:()=>{},commit:()=>Promise.resolve()}),
}));
import {useWorkoutStore} from '../src/store';
const owner={uid:'owner',email:'akshayakn6@gmail.com'};
const settingsPath='users/owner/profile/settings';
const sessionPath=(id:string)=>`users/owner/sessions/${id}`;
function packed(s:any){return{...s,sets:Object.fromEntries(s.exercises.flatMap((e:any)=>e.sets.map((x:any)=>[x.id,x]))),exercises:s.exercises.map((e:any)=>({exercise:e.exercise,setIds:e.sets.map((x:any)=>x.id)}))};}
function deferred(){let resolve!:()=>void,reject!:(e:Error)=>void;const promise=new Promise<void>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function mount(){const hook=renderHook(()=>useWorkoutStore());act(()=>{mock.auth.currentUser=owner;mock.authListener(owner);});return hook;}
beforeEach(()=>{
 localStorage.clear();vi.clearAllMocks();mock.rows.clear();mock.listeners.clear();mock.auth.currentUser=null;mock.cache=false;mock.gate=null;mock.beforeTransaction=null;
 mock.rows.set(settingsPath,{...defaults,onboarded:true});
 mock.emit=()=>mock.listeners.forEach((cb,path)=>{
  const metadata={fromCache:mock.cache,hasPendingWrites:false};
  if(path.endsWith('/settings'))cb({exists:()=>mock.rows.has(path),data:()=>mock.rows.get(path),metadata});
  else cb({docs:[...mock.rows].filter(([key])=>key.startsWith(path+'/')).map(([,v])=>({data:()=>v})),metadata});
 });
 firestore.setDoc.mockImplementation(async(path,data)=>{mock.rows.set(path,data);mock.emit();await mock.gate;});
 firestore.updateDoc.mockImplementation(async(path,data)=>{const old=mock.rows.get(path);const next=structuredClone(old);Object.entries(data).forEach(([key,v])=>{if(key.startsWith('sets.'))next.sets[key.slice(5)]=v;else next[key]=v;});mock.rows.set(path,next);mock.emit();await mock.gate;});
 firestore.runTransaction.mockImplementation(async(_:any,callback:Function)=>{
  mock.beforeTransaction?.();const writes:Array<[string,any]>=[];
  await callback({get:async(path:string)=>({exists:()=>mock.rows.has(path),data:()=>mock.rows.get(path)}),set:(path:string,data:any)=>writes.push([path,data])});
  writes.forEach(([path,data])=>mock.rows.set(path,data));mock.emit();
 });
 firestore.waitForPendingWrites.mockImplementation(()=>mock.gate||Promise.resolve());
 authMocks.signOut.mockImplementation(async()=>{mock.auth.currentUser=null;mock.authListener(null);});
});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('Firebase-first workout journal',()=>{
 it('keeps separate recovery copies for conflicting occurrences of one program slot',()=>{
  const first=createSession(defaults,[],new Date(2026,0,1)),second=createSession(defaults,[],new Date(2026,0,2));
  preserveBackup('owner',{settings:defaults,sessions:[first]});preserveBackup('owner',{settings:defaults,sessions:[second]},second);
  expect((exportDeviceCopies().copies['form-workout-backup-v1owner'] as any).sessions).toEqual([first,second]);
 });
 it('blocks all signed-out workout writes without touching the guest journal',()=>{
  const s=createSession(defaults,[]);writeLocal('guest',{settings:defaults,sessions:[s]});const raw=localStorage.getItem('form-workout-v1guest');
  const {result}=renderHook(()=>useWorkoutStore());act(()=>mock.authListener(null));
  act(()=>{result.current.addSession(s);result.current.editSet(s,0,0,s.exercises[0].sets[0]);result.current.saveSettings({...defaults,position:2});result.current.finish(s);});
  expect(firestore.setDoc).not.toHaveBeenCalled();expect(firestore.updateDoc).not.toHaveBeenCalled();expect(readLocal('guest').sessions).toEqual([s]);
  expect(localStorage.getItem('form-workout-v1guest')).toBe(raw);expect(result.current.sessions).toEqual([]);expect(result.current.error).toContain('Sign in');
 });
 it('automatically uploads missing device sessions on sign-in and retains the original',async()=>{
  const s=createSession({...defaults,position:3},[]);writeLocal('guest',{settings:defaults,sessions:[s]});
  const raw=localStorage.getItem('form-workout-v1guest'),{result}=mount();
  await waitFor(()=>expect(result.current.sessions.map(s=>s.id)).toContain(s.id));
  await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(mock.rows.get(sessionPath(s.id))).toEqual(packed(s));expect(localStorage.getItem('form-workout-v1guest')).toBe(raw);
  expect(result.current.status).toBe('Saved to Firebase');expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
 });
 it('never overwrites a cloud record with a conflicting guest occurrence',async()=>{
  const guest=createSession(defaults,[],new Date(2026,0,1)),cloud=createSession(defaults,[],new Date(2026,0,2));
  writeLocal('guest',{settings:defaults,sessions:[guest]});mock.rows.set(sessionPath(cloud.id),packed(cloud));
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(result.current.deviceConflicts).toBe(1);expect(firestore.runTransaction).not.toHaveBeenCalled();expect(mock.rows.get(sessionPath(cloud.id))).toEqual(packed(cloud));expect(readLocal('guest').sessions[0]).toEqual(guest);
 });
 it('checks for concurrent cloud creation inside the import transaction',async()=>{
  const guest=createSession(defaults,[],new Date(2026,0,1)),cloud=createSession(defaults,[],new Date(2026,0,2));
  writeLocal('guest',{settings:defaults,sessions:[guest]});mock.beforeTransaction=()=>mock.rows.set(sessionPath(cloud.id),packed(cloud));
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));expect(mock.rows.get(sessionPath(cloud.id))).toEqual(packed(cloud));
 });
 it('does not reimport or replace an already imported session after later cloud edits',async()=>{
  const guest=createSession(defaults,[]),cloud=structuredClone(guest);cloud.exercises[0].sets[0].segments[0].weight=150;
  writeLocal('guest',{settings:defaults,sessions:[guest]});mock.rows.set(sessionPath(cloud.id),packed(cloud));const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(firestore.runTransaction).not.toHaveBeenCalled();expect(result.current.sessions[0].exercises[0].sets[0].segments[0].weight).toBe(150);
 });
 it('waits for the server before importing a guest journal',async()=>{
  const s=createSession(defaults,[]);writeLocal('guest',{settings:defaults,sessions:[s]});mock.cache=true;
  const {result}=mount();expect(result.current.ready).toBe(false);expect(firestore.runTransaction).not.toHaveBeenCalled();
  await act(async()=>{mock.cache=false;mock.emit();});await waitFor(()=>expect(result.current.ready).toBe(true));expect(mock.rows.has(sessionPath(s.id))).toBe(true);
 });
 it('preserves account device data before a cloud snapshot replaces the view',async()=>{
  const s=createSession(defaults,[]);s.exercises[0].sets[0].segments[0].weight=150;writeLocal('owner',{settings:defaults,sessions:[s]});
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(result.current.sessions).toEqual([]);expect((exportDeviceCopies().copies['form-workout-backup-v1owner'] as any).sessions[0]).toEqual(s);
 });
 it('allows retrying an unsuccessful device import without claiming it was saved',async()=>{
  const s=createSession(defaults,[]);writeLocal('guest',{settings:defaults,sessions:[s]});firestore.runTransaction.mockRejectedValueOnce(new Error('offline'));
  const {result}=mount();await waitFor(()=>expect(result.current.error).toContain('Could not save'));
  expect(result.current.ready).toBe(false);expect(result.current.status).toBe('Sync needs attention');
  await act(async()=>result.current.importDevice());await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.status).toBe('Saved to Firebase');
 });
 it('keeps earlier set changes in recovery copies when multiple edits are queued together',async()=>{
  const s=createSession(defaults,[]);mock.rows.set(sessionPath(s.id),packed(s));const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));
  await act(async()=>{[0,1,2].forEach(i=>result.current.editSet(s,0,i,{...s.exercises[0].sets[i],segments:[{weight:100+i,reps:4}]}));});
  const saved=(exportDeviceCopies().copies['form-workout-backup-v1owner'] as any).sessions[0];expect(saved.exercises[0].sets.map((x:any)=>x.segments[0].weight)).toEqual([100,101,102]);
 });
 it('does not sign out until pending workout writes are acknowledged',async()=>{
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));const gate=deferred();mock.gate=gate.promise;
  act(()=>result.current.addSession(createSession(defaults,[])));expect(result.current.status).toBe('Saving to Firebase…');
  let logout!:Promise<void>;act(()=>{logout=result.current.logout();});expect(authMocks.signOut).not.toHaveBeenCalled();
  await act(async()=>{gate.resolve();await logout;});expect(authMocks.signOut).toHaveBeenCalledTimes(1);expect(result.current.sessions).toEqual([]);expect(readLocal('owner').sessions).toHaveLength(1);
 });
 it('keeps the account signed in if Firebase does not acknowledge writes',async()=>{
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));vi.useFakeTimers();const gate=deferred();mock.gate=gate.promise;
  let logout!:Promise<void>;act(()=>{logout=result.current.logout();});await act(async()=>{await vi.advanceTimersByTimeAsync(10001);await logout;});
  expect(authMocks.signOut).not.toHaveBeenCalled();expect(result.current.error).toContain('still signed in');gate.resolve();
 });
 it('reports a failed save and retains the recovery copy instead of signing out',async()=>{
  const {result}=mount();await waitFor(()=>expect(result.current.ready).toBe(true));firestore.setDoc.mockRejectedValueOnce(new Error('permission denied'));
  const s=createSession(defaults,[]);await act(async()=>result.current.addSession(s));await act(async()=>result.current.logout());
  expect(result.current.status).toBe('Sync needs attention');expect(authMocks.signOut).not.toHaveBeenCalled();expect((exportDeviceCopies().copies['form-workout-backup-v1owner'] as any).sessions).toEqual([s]);
 });
});
