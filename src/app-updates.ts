export type UpdateState={available:boolean;checking:boolean;applying:boolean;message:string};
export const initialUpdateState:UpdateState={available:false,checking:false,applying:false,message:''};

// Own the refresh decision: a worker activated by another tab must never interrupt a workout.
export function createUpdateController(onChange:(state:UpdateState)=>void,canRefresh:()=>boolean,reload=()=>window.location.reload()){
 let state={...initialUpdateState},registration:ServiceWorkerRegistration|undefined,disposed=false,checking=false,requested=false,controllerChanged=false,lastCheck=0;
 let activationTimer:ReturnType<typeof setTimeout>|undefined;
 const stops:(()=>void)[]=[],workers=new Set<ServiceWorker>();
 const sw=navigator.serviceWorker;
 const emit=(patch:Partial<UpdateState>)=>{state={...state,...patch};if(!disposed)onChange(state);};
 const listen=(target:EventTarget,event:string,fn:()=>void)=>{target.addEventListener(event,fn);stops.push(()=>target.removeEventListener(event,fn));};
 function inspect(){
  if(registration?.waiting)emit({available:true,checking:false,message:'An update is ready.'});
 }
 function watch(worker:ServiceWorker|null){
  if(!worker||workers.has(worker))return;
  workers.add(worker);
  const changed=()=>{
   if(worker.state==='installed'){
    if(registration?.active||sw.controller)emit({available:true,checking:false,message:'An update is ready.'});
    else emit({checking:false,message:'App is ready for offline use.'});
   }else if(worker.state==='redundant')emit({checking:false,message:'The update could not finish. Check your connection and try again.'});
  };
  listen(worker,'statechange',changed);changed();
 }
 async function check(manual=false){
  if(disposed||checking||state.applying)return;
  if(!manual&&(document.hidden||Date.now()-lastCheck<30000))return;
  if(!navigator.onLine){emit({checking:false,message:'Connect to the internet to check for updates.'});return;}
  checking=true;lastCheck=Date.now();emit({checking:true,message:'Checking for updates…'});
  try{
   if(!registration){
    const result=await sw.register('/sw.js',{scope:'/',updateViaCache:'none'});
    if(disposed)return;
    registration=result;
    inspect();
    listen(registration,'updatefound',()=>{emit({checking:true,message:'Downloading update…'});watch(registration!.installing);});
    watch(registration.installing);
   }
   await registration.update();
   if(disposed)return;
   inspect();
   if(!registration.waiting){
    if(registration.installing){watch(registration.installing);emit({checking:true,message:'Downloading update…'});}
    else emit({checking:false,message:state.available?'An update is ready.':'You’re up to date.'});
   }
  }catch{emit({checking:false,message:'Couldn’t check for updates. Check your connection and try again.'});}
  finally{checking=false;}
 }
 function apply(){
  if(disposed||state.applying||!state.available||!canRefresh())return false;
  if(controllerChanged){reload();return true;}
  const waiting=registration?.waiting;
  if(!waiting){void check(true);return false;}
  requested=true;emit({applying:true,message:'Opening the updated app…'});
  activationTimer=setTimeout(()=>{requested=false;emit({applying:false,message:'The update is taking longer than expected. Try Refresh again.'});},15000);
  waiting.postMessage({type:'SKIP_WAITING'});return true;
 }
 if(!sw){emit({message:'In-app updates aren’t supported in this browser.'});return{check:async()=>{},apply:()=>false,dispose:()=>{disposed=true;}};}
 listen(sw,'controllerchange',()=>{
  if(!registration?.active)return;
  // Initial installation can claim an uncontrolled page without needing a refresh.
  if(!state.available&&!requested)return;
  controllerChanged=true;clearTimeout(activationTimer);
  if(requested&&canRefresh()){requested=false;reload();}
  else{requested=false;emit({available:true,applying:false,message:'An update is ready. Refresh when your workout is saved.'});}
 });
 const wake=()=>{if(!document.hidden)void check();};
 listen(window,'focus',wake);listen(window,'pageshow',wake);listen(window,'online',()=>void check(true));listen(document,'visibilitychange',wake);
 const interval=setInterval(wake,5*60000);
 void check();
 return{check:()=>check(true),apply,dispose:()=>{disposed=true;clearInterval(interval);clearTimeout(activationTimer);stops.forEach(stop=>stop());}};
}
