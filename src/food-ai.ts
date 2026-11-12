import type {FirebaseApp} from 'firebase/app';
import config from './ai-config.json';
import {estimateFromTable,sanitizeItems,type FoodItem,type FoodSource} from './nutrition';

export type Estimate={items:FoodItem[];source:FoodSource;note?:string};
const instructions=`You are a nutrition estimator for a personal food log kept by a South Indian user.
Split the text into individual foods and estimate each one as eaten.
- Fix typos and shorthand (for example "lets of brocolli" means broccoli florets).
- Assume home-cooked South Indian portions when unspecified: 1 cup = 240 ml, 1 katori = 150 ml, 1 idli = 40 g, 1 dosa = 80 g, 1 chapati = 40 g.
- Foods are cooked unless raw is normal for them. Include cooking oil only when it is mentioned.
- Use standard food-composition values (USDA, IFCT 2017). Be realistic rather than cautious.
- "quantity" repeats the amount the user wrote. "grams" is your weight estimate.
- kcal is kilocalories; protein, carbs, fat and fiber are grams. Never return negative numbers.
Only return foods that appear in the text. If the text contains no food, return an empty list.`;
let appCheckStarted=false;

export async function estimateWithAI(app:FirebaseApp,text:string):Promise<FoodItem[]>{
 if(config.appCheckSiteKey&&!appCheckStarted){
  const{initializeAppCheck,ReCaptchaV3Provider,ReCaptchaEnterpriseProvider}=await import('firebase/app-check');
  initializeAppCheck(app,{provider:config.appCheckProvider==='enterprise'?new ReCaptchaEnterpriseProvider(config.appCheckSiteKey):new ReCaptchaV3Provider(config.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  appCheckStarted=true;
 }
 const{getAI,getGenerativeModel,GoogleAIBackend,Schema}=await import('firebase/ai');
 const number=()=>Schema.number();
 const model=getGenerativeModel(getAI(app,{backend:new GoogleAIBackend()}),{
  model:config.model,
  systemInstruction:instructions,
  generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:Schema.object({properties:{items:Schema.array({items:Schema.object({properties:{name:Schema.string(),quantity:Schema.string(),grams:number(),kcal:number(),protein:number(),carbs:number(),fat:number(),fiber:number()}})})}})},
 });
 const result=await model.generateContent(`Food log entry:\n${text.slice(0,600)}`);
 return sanitizeItems(JSON.parse(result.response.text()).items);
}
function withTimeout<T>(work:Promise<T>,ms:number){
 let id:ReturnType<typeof setTimeout>|undefined;
 return Promise.race([work,new Promise<never>((_,reject)=>{id=setTimeout(()=>reject(new Error('timed out')),ms);})]).finally(()=>clearTimeout(id));
}
// AI first; the built-in table keeps logging available offline or when AI is
// not set up. Either way the numbers stay editable.
export async function estimateFood(app:FirebaseApp,text:string,ai=estimateWithAI):Promise<Estimate>{
 let note='';
 if(config.enabled&&(typeof navigator==='undefined'||navigator.onLine!==false)){
  try{const items=await withTimeout(ai(app,text),25000);if(items.length)return{items,source:'ai'};note='AI found no food in that text.';}
  catch(e:any){note=`AI estimate unavailable (${String(e?.message||e).slice(0,140)}).`;}
 }else note='Offline.';
 return{items:estimateFromTable(text),source:'table',note};
}
