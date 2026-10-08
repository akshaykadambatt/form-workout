import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Download} from 'lucide-react';
import {createUpdateController,initialUpdateState} from './app-updates';
import './updates.css';
declare const __APP_BUILD__:string;
const build=typeof __APP_BUILD__==='undefined'?'Development':__APP_BUILD__;
export function useAppUpdates(blockedReason:string){
 const [state,setState]=useState(initialUpdateState),[dismissed,setDismissed]=useState(false);
 const blocked=useRef(blockedReason);blocked.current=blockedReason;
 const control=useRef<ReturnType<typeof createUpdateController>|null>(null);
 useEffect(()=>{
  if(!import.meta.env.PROD)return;
  control.current=createUpdateController(setState,()=>!blocked.current);
  return()=>{control.current?.dispose();control.current=null;};
 },[]);
 return{...state,build,blockedReason,dismissed,dismiss:()=>setDismissed(true),check:()=>{setDismissed(false);void control.current?.check();},refresh:()=>control.current?.apply()};
}
type Updates=ReturnType<typeof useAppUpdates>;
export function UpdateBanner({updates:u}:{updates:Updates}){
 if(!u.available||u.dismissed)return null;
 return <section className="app-update-banner" aria-label="App update"><div><strong>Update ready</strong><p role="status">{u.blockedReason||u.message}</p></div><div className="app-update-actions"><button className="primary" disabled={!!u.blockedReason||u.applying} onClick={u.refresh}><RefreshCw size={17}/>{u.applying?'Refreshing…':'Refresh'}</button><button className="secondary" disabled={u.applying} onClick={u.dismiss}>Later</button></div></section>;
}
export function UpdateSettings({updates:u}:{updates:Updates}){
 return <section className="app-update-settings" aria-label="App updates"><h3>App updates</h3><p>Updates appear here and at the top of the app. Refresh when you’re ready.</p><p className="update-build">Installed build · {u.build}</p><div className="app-update-actions"><button className="secondary" disabled={u.checking||u.applying} onClick={u.check}><Download size={17}/>{u.checking?'Checking…':'Check for updates'}</button>{u.available&&<button className="primary" disabled={!!u.blockedReason||u.applying} onClick={u.refresh}><RefreshCw size={17}/>{u.applying?'Refreshing…':'Refresh'}</button>}</div><p role="status">{u.available&&u.blockedReason?u.blockedReason:u.message}</p></section>;
}
