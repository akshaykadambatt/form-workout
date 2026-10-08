// Coordinates describe simplified movement paths, not individualized joint angles.
export type Point=[number,number];
export type Pose={h:Point;s:Point;e:Point;w:Point;k:Point;f:Point; e2?:Point;w2?:Point;k2?:Point;f2?:Point};
export type Diagram={poses:Pose[];view?:'front';equipment?:string;fixture?:string;cue:string;phases:string[];hold?:boolean};
const stand:Pose={h:[155,140],s:[155,76],e:[151,112],w:[148,151],k:[165,177],f:[169,213]};
const front:Pose={h:[160,143],s:[160,79],e:[127,117],w:[126,155],e2:[193,117],w2:[194,155],k:[139,178],f:[134,213],k2:[181,178],f2:[186,213]};
const lie:Pose={h:[179,187],s:[112,183],e:[120,148],w:[124,112],k:[213,161],f:[240,211]};
const hinge:Pose={h:[130,145],s:[188,113],e:[187,151],w:[186,189],k:[156,178],f:[170,213]};
const seat:Pose={h:[126,144],s:[118,79],e:[126,112],w:[145,142],k:[177,150],f:[181,210]};
const chair='M100 82V157H178M120 157V211M165 157V211';
const tower='M270 35V215M254 215H286M255 48H270';
const p=(base:Pose,patch:Partial<Pose>):Pose=>({...base,...patch});
export const diagrams:Record<string,Diagram>={
 neutralPullup:{view:'front',poses:[p(front,{s:[160,92],h:[160,155],e:[130,61],w:[142,22],e2:[190,61],w2:[178,22]}),p(front,{s:[160,34],h:[160,97],e:[125,59],w:[142,22],e2:[195,59],w2:[178,22],k:[139,132],f:[134,167],k2:[181,132],f2:[186,167]})],equipment:'none',fixture:'M110 18H210M142 18V29M178 18V29M110 18V230M210 18V230',cue:'Use handles with palms facing each other. Pull up, then lower under control. Follow the program for assisted negatives.',phases:['Controlled hang','Pull chest toward handles']},
 squat:{poses:[p(stand,{e:[170,105],w:[174,82]}),p(stand,{h:[128,166],s:[161,108],e:[177,132],w:[178,111],k:[181,173]})],equipment:'back-bar',cue:'Brace your torso. Bend hips and knees together; keep the whole foot planted.',phases:['Stand tall','Lower under control']},
 hinge:{poses:[p(stand,{e:[171,112],w:[186,150]}),p(hinge,{h:[130,143],s:[193,126],k:[159,177],e:[188,160],w:[185,197]})],equipment:'bar',cue:'Hinge at your hips with softly bent knees. Keep the bar close to your legs.',phases:['Stand tall','Push hips back']},
 deadlift:{poses:[p(hinge,{h:[132,147],s:[187,116],w:[184,197]}),p(stand,{e:[171,112],w:[184,150]})],equipment:'bar',cue:'Brace before lifting. Keep the bar close; stand up without leaning back.',phases:['Set up and brace','Stand with the bar']},
 deficit:{poses:[p(hinge,{h:[132,140],s:[187,115],w:[184,197],f:[169,204]}),p(stand,{h:[155,131],s:[155,67],e:[171,103],w:[184,141],k:[165,168],f:[169,204]})],equipment:'bar',fixture:'M143 209H190M143 215V204H190V215',cue:'Use the prescribed small deficit. Brace and keep the bar close throughout.',phases:['Brace from the platform','Stand tall']},
 morning:{poses:[p(stand,{e:[171,105],w:[173,83]}),p(stand,{h:[129,145],s:[193,129],e:[202,157],w:[210,133],k:[153,177]})],equipment:'back-bar',cue:'Keep a neutral spine. Push hips back and hinge within your controlled range.',phases:['Stand tall','Hinge at the hips']},
 row:{poses:[hinge,p(hinge,{e:[158,116],w:[167,146]})],equipment:'bar',cue:'Hold your torso steady. Pull toward the upper abdomen, then lower with control.',phases:['Arms extended','Elbows travel back']},
 pendlay:{poses:[p(hinge,{h:[130,139],s:[194,133],e:[191,166],w:[188,200]}),p(hinge,{h:[130,139],s:[194,133],e:[162,113],w:[167,149]})],equipment:'bar',cue:'Pendlay reps reset on the floor. Bent-over reps keep the bar suspended.',phases:['Reset on the floor','Pull toward the torso']},
 dumbbellRow:{poses:[p(hinge,{h:[122,138],s:[185,108],w:[187,183]}),p(hinge,{h:[122,138],s:[185,108],e:[157,111],w:[167,145]})],equipment:'dumbbell',fixture:'M215 159H276M229 159V213M263 159V213M182 110L223 148L237 156',cue:'Brace your free hand on a bench. Pull the elbow back without twisting your torso.',phases:['Let the arm reach','Pull elbow toward the hip']},
 supportedRow:{poses:[p(hinge,{h:[138,160],s:[180,103],e:[191,137],w:[196,175],k:[168,180],f:[185,213]}),p(hinge,{h:[138,160],s:[180,103],e:[145,119],w:[162,149],k:[168,180],f:[185,213]})],equipment:'handle',fixture:'M142 165L185 105M151 155V215M132 215H173M257 62V215',cue:'Keep your chest against the pad. Draw the elbows back and control the return.',phases:['Reach with control','Pull and squeeze']},
 highRow:{poses:[p(seat,{w:[236,51],e:[187,60]}),p(seat,{w:[161,115],e:[129,108]})],equipment:'high-cable',fixture:chair+' '+tower,cue:'Reach up toward the handles, then pull your elbows down and back.',phases:['Reach up','Pull down and back']},
 pulldown:{view:'front',poses:[p(front,{w:[98,29],e:[115,54],w2:[222,29],e2:[205,54],k:[133,169],f:[127,211],k2:[187,169],f2:[193,211]}),p(front,{w:[105,105],e:[91,103],w2:[215,105],e2:[229,103],k:[133,169],f:[127,211],k2:[187,169],f2:[193,211]})],equipment:'lat-bar',fixture:'M70 22H250M70 22V218M250 22V218M129 154H191M141 154V214M179 154V214',cue:'Stay tall. Pull the bar toward the upper chest, keeping the movement in front of you.',phases:['Reach overhead','Drive elbows down']},
 singlePulldown:{poses:[p(seat,{s:[106,81],e:[162,57],w:[202,23]}),p(seat,{s:[127,87],e:[158,98],w:[166,128]})],equipment:'high-cable',fixture:chair+' '+tower,cue:'Reach and lean away slightly; bring the working elbow down toward your side.',phases:['Reach and lengthen','Pull toward your side']},
 overhead:{view:'front',poses:[p(front,{w:[107,91],e:[108,119],w2:[213,91],e2:[212,119]}),p(front,{w:[113,20],e:[107,51],w2:[207,20],e2:[213,51]})],equipment:'front-bar',cue:'Brace your trunk and squeeze your glutes. Press overhead without leaning back.',phases:['Bar at upper chest','Press overhead']},
 pushPress:{view:'front',poses:[p(front,{w:[107,91],e:[108,119],w2:[213,91],e2:[212,119]}),p(front,{h:[160,154],s:[160,90],w:[107,102],e:[108,130],w2:[213,102],e2:[212,130],k:[127,182],k2:[193,182]}),p(front,{w:[113,20],e:[107,51],w2:[207,20],e2:[213,51]})],equipment:'front-bar',cue:'Make a small knee dip, drive through your legs, then press. Lower under control.',phases:['Rack the bar','Dip','Drive and press']},
 arnold:{view:'front',poses:[p(front,{w:[147,92],e:[133,121],w2:[173,92],e2:[187,121]}),p(front,{w:[111,21],e:[110,53],w2:[209,21],e2:[210,53]})],equipment:'two-dumbbells',cue:'Start with palms facing you. Rotate palms forward as you press; reverse on the way down.',phases:['Palms face you','Rotate and press']},
 lateral:{view:'front',poses:[front,p(front,{e:[108,86],w:[70,91],e2:[212,86],w2:[250,91]})],equipment:'two-dumbbells',cue:'Raise out to the sides with a soft elbow bend. Stop around shoulder height.',phases:['Arms beside you','Raise out to the sides']},
 machineLateral:{view:'front',poses:[p(front,{e:[128,116],w:[111,93],e2:[192,116],w2:[209,93]}),p(front,{e:[102,84],w:[92,52],e2:[218,84],w2:[228,52]})],equipment:'elbow-pads',fixture:'M144 154H176M151 154V217M169 154V217M87 168H233',cue:'Place upper arms against the pads. Lift out to the sides without shrugging.',phases:['Pads beside you','Lift the pads']},
 frontRaise:{poses:[p(stand,{w:[163,152],e:[162,114]}),p(stand,{w:[231,82],e:[193,86]})],equipment:'dumbbell',cue:'Raise in front to about shoulder height. Keep the torso still.',phases:['Arm down','Raise in front']},
 closePress:{poses:[p(lie,{h:[179,155],s:[112,151],e:[136,169],w:[150,137],k:[205,173]}),p(lie,{h:[179,155],s:[112,151],e:[118,115],w:[124,79],k:[205,173]})],equipment:'bar',fixture:'M87 163H190M103 163V216M178 163V216',cue:'Use a shoulder-width grip. Keep wrists over forearms and lower toward the chest.',phases:['Lower to the chest','Press up']},
 floorPress:{poses:[p(lie,{e:[140,201],w:[153,167]}),lie],equipment:'bar',cue:'Let the upper arms meet the floor gently. Pause, then press without bouncing.',phases:['Upper arms reach the floor','Press up']},
 chestPress:{poses:[p(seat,{e:[92,110],w:[122,106]}),p(seat,{e:[157,100],w:[198,105]})],equipment:'handle',fixture:chair+' M227 68V212M213 212H249',cue:'Keep your back against the pad. Press the handles forward and return with control.',phases:['Handles at chest level','Press forward']},
 fly:{view:'front',poses:[p(front,{e:[99,92],w:[63,108],e2:[221,92],w2:[257,108]}),p(front,{e:[127,113],w:[155,119],e2:[193,113],w2:[165,119]})],equipment:'fly-cables',fixture:'M30 35V216M290 35V216',cue:'Keep a soft elbow bend. Bring the handles together in front of your chest.',phases:['Open under control','Bring hands together']},
 pecDeck:{view:'front',poses:[p(front,{e:[102,90],w:[102,55],e2:[218,90],w2:[218,55]}),p(front,{e:[151,104],w:[151,68],e2:[169,104],w2:[169,68]})],equipment:'elbow-pads',fixture:'M127 154H193M140 154V216M180 154V216M75 160V60M245 160V60',cue:'Keep your back supported. Bring the pads together without rolling the shoulders forward.',phases:['Open the arms','Squeeze together']},
 bandApart:{view:'front',poses:[p(front,{e:[127,108],w:[151,92],e2:[193,108],w2:[169,92]}),p(front,{e:[105,80],w:[70,80],e2:[215,80],w2:[250,80]})],equipment:'band',cue:'Hold the band at shoulder height. Spread your hands apart with softly bent elbows.',phases:['Hands in front','Pull the band apart']},
 curl:{poses:[stand,p(stand,{e:[151,112],w:[176,84]})],equipment:'bar',cue:'Keep upper arms beside your torso. Bend at the elbows without swinging.',phases:['Lower range','Curl toward the shoulders']},
 cableKickback:{poses:[p(hinge,{e:[153,122],w:[161,159]}),p(hinge,{e:[153,122],w:[116,127]})],equipment:'low-cable',fixture:tower,cue:'Keep the upper arm still behind the torso. Straighten the elbow, then bend it slowly.',phases:['Elbow bent','Extend behind you']},
 skullFloor:{poses:[p(lie,{e:[106,149],w:[99,113]}),p(lie,{e:[104,153],w:[68,197]})],equipment:'bar',cue:'Lower the bar behind the head to the floor with control. Keep the upper arms steady.',phases:['Arms angled back','Lower behind the head']},
 california:{poses:[p(lie,{h:[179,155],s:[112,151],e:[141,166],w:[153,136],k:[205,173]}),p(lie,{h:[179,155],s:[112,151],e:[117,114],w:[123,79],k:[205,173]}),p(lie,{h:[179,155],s:[112,151],e:[105,117],w:[79,141],k:[205,173]})],equipment:'bar',fixture:'M87 163H190M103 163V216M178 163V216',cue:'Press up with a close grip; lower with a skull-crusher motion. Use the program’s combination technique.',phases:['Close-grip start','Press up','Lower toward the head']},
 overheadTriceps:{poses:[p(stand,{e:[158,41],w:[124,57]}),p(stand,{e:[158,41],w:[170,9]})],equipment:'overhead-rope',fixture:'M53 63V218M38 218H70',cue:'Keep the working elbow overhead. Use the other arm to assist the lift as prescribed; lower with the working arm.',phases:['Elbow bent overhead','Extend the elbow']},
 uprightSupine:{poses:[p(lie,{s:[102,185],h:[168,190],e:[142,178],w:[180,171],k:[214,199],f:[253,208]}),p(lie,{s:[102,185],h:[168,190],e:[124,143],w:[123,165],k:[214,199],f:[253,208]})],equipment:'supine-cable',fixture:'M285 123V216M270 216H300',cue:'Lie down facing the low pulley. Draw the bar toward the upper chest with elbows leading.',phases:['Arms reach toward pulley','Lead with elbows']},
 extension:{poses:[seat,p(seat,{f:[232,151]})],equipment:'ankle-pad',fixture:chair,cue:'Keep hips on the seat. Straighten the knee, then lower the pad under control.',phases:['Knees bent','Extend the knees']},
 singleExtension:{poses:[p(seat,{k2:[170,154],f2:[173,210]}),p(seat,{f:[232,151],k2:[170,154],f2:[173,210]})],equipment:'ankle-pad',fixture:chair,cue:'Move the working leg through a controlled range. Repeat for the other side.',phases:['Working knee bent','Extend the working leg']},
 assistedExtension:{poses:[p(seat,{k2:[170,154],f2:[173,210]}),p(seat,{f:[232,151],k2:[170,154],f2:[225,155]}),p(seat,{f:[232,151],k2:[170,154],f2:[173,210]})],equipment:'ankle-pad',fixture:chair,cue:'Lift with both legs. Remove the assisting leg, then lower slowly with the working leg. Repeat on the other side.',phases:['Both knees bent','Lift with both legs','Lower with one leg']},
 hipAbduction:{view:'front',poses:[p(front,{k:[136,171],f:[132,212],k2:[184,171],f2:[188,212]}),p(front,{k:[108,168],f:[92,202],k2:[212,168],f2:[228,202]})],equipment:'knee-pads',fixture:'M142 154H178M145 154V217M175 154V217M90 183H230',cue:'Stay against the back support. Press your knees apart, then return slowly.',phases:['Knees closer together','Press knees apart']},
 cableAbduction:{view:'front',poses:[p(front,{k:[143,178],f:[140,213],k2:[180,178],f2:[185,213]}),p(front,{k:[143,178],f:[140,213],k2:[203,165],f2:[234,186]})],equipment:'ankle-cable',fixture:'M60 32V216M48 216H75',cue:'Keep the pelvis steady. Move the working leg out to the side without leaning.',phases:['Stand tall','Move the leg out']},
 pullThrough:{poses:[p(hinge,{e:[159,149],w:[141,182]}),p(stand,{e:[144,113],w:[145,151]})],equipment:'rear-cable',fixture:'M50 85V215M35 215H70',cue:'Face away from a low pulley. Hinge back, then extend your hips; let arms hold the rope.',phases:['Hips back','Stand and squeeze glutes']},
 splitSquat:{poses:[p(stand,{h:[166,134],s:[169,72],e:[176,108],w:[177,144],k:[196,171],f:[214,213],k2:[130,157],f2:[100,174]}),p(stand,{h:[151,164],s:[162,103],e:[170,139],w:[170,175],k:[193,177],f:[214,213],k2:[137,199],f2:[100,174]})],equipment:'dumbbell',fixture:'M69 177H114M79 177V214M104 177V214',cue:'Support the back foot on a low bench. Lower down while keeping the front foot planted.',phases:['Split stance','Lower under control']},
 stepUp:{poses:[p(stand,{h:[132,147],s:[132,83],e:[131,118],w:[128,157],k:[178,145],f:[196,178],k2:[123,180],f2:[124,215]}),p(stand,{h:[194,103],s:[194,39],e:[199,77],w:[205,116],k:[196,140],f:[196,178],k2:[162,139],f2:[161,178]})],equipment:'dumbbell',fixture:'M177 215V179H231V215Z',cue:'Plant the whole working foot on the box. Drive through that leg, then step down with control.',phases:['Foot on the box','Stand onto the box']},
 backExtension:{poses:[p(stand,{h:[172,144],s:[124,101],e:[121,127],w:[140,120],k:[201,177],f:[231,209]}),p(stand,{h:[172,144],s:[124,181],e:[137,207],w:[155,190],k:[201,177],f:[231,209]})],equipment:'back-bar',fixture:'M156 149L180 137M169 145V213M148 213H205M219 210L243 191',cue:'Hinge over the hip pad. Return to a straight body line without arching past it.',phases:['Body in a straight line','Hinge over the pad']},
 reverseHyper:{poses:[p(stand,{s:[110,103],h:[176,112],e:[86,131],w:[83,162],k:[180,154],f:[182,197]}),p(stand,{s:[110,103],h:[176,112],e:[86,131],w:[83,162],k:[218,113],f:[260,114]})],equipment:'none',fixture:'M91 120H179M106 120V216M162 120V216M73 164H94',cue:'Keep your torso supported. Lift the legs until they line up with your body, then lower slowly.',phases:['Legs hang down','Lift to body level']},
 crunch:{poses:[p(lie,{e:[134,158],w:[139,176]}),p(lie,{s:[128,162],e:[148,143],w:[147,165]})],equipment:'plate',cue:'Curl the rib cage toward your pelvis. Keep it a small, controlled crunch.',phases:['Shoulders down','Curl the upper back']},
 cableCrunch:{poses:[p(stand,{h:[177,161],s:[153,105],e:[130,128],w:[133,103],k:[192,207],f:[229,213]}),p(stand,{h:[177,161],s:[143,149],e:[126,170],w:[124,143],k:[192,207],f:[229,213]})],equipment:'crunch-rope',fixture:'M66 23V214M66 23H155',cue:'Keep the hips fairly still. Curl your rib cage toward your pelvis rather than just hinging.',phases:['Tall kneeling','Curl the torso']},
 reverseCrunch:{poses:[p(lie,{e:[137,199],w:[167,204],k:[198,151],f:[231,152]}),p(lie,{h:[165,174],e:[137,199],w:[167,204],k:[144,140],f:[151,104]})],equipment:'none',cue:'Curl the pelvis up gently. Avoid swinging the legs to create momentum.',phases:['Knees bent','Curl pelvis off the floor']},
 hangingRaise:{poses:[p(stand,{s:[157,91],h:[161,155],e:[154,55],w:[151,20],k:[172,187],f:[182,221]}),p(stand,{s:[157,91],h:[166,145],e:[154,55],w:[151,20],k:[208,147],f:[250,149]})],equipment:'none',fixture:'M95 17H210M95 17V228M210 17V228',cue:'Raise the legs with your abs and curl the pelvis. Keep swinging to a minimum.',phases:['Controlled hang','Lift legs and curl pelvis']},
 slidingCurl:{poses:[p(lie,{s:[93,196],h:[153,175],e:[113,207],w:[145,212],k:[202,183],f:[248,211]}),p(lie,{s:[93,196],h:[151,163],e:[113,207],w:[145,212],k:[187,156],f:[193,211]})],equipment:'sliders',cue:'Keep hips lifted while you draw the heels in. Slide out slowly without losing trunk control.',phases:['Heels slide away','Pull heels toward you']},
 pushup:{poses:[p(stand,{s:[106,126],h:[172,148],e:[107,164],w:[105,205],k:[211,175],f:[250,205]}),p(stand,{s:[109,173],h:[178,184],e:[77,185],w:[105,205],k:[215,195],f:[250,205]})],equipment:'none',cue:'Move as one unit from shoulders to heels. Lower the chest, then press the floor away.',phases:['Straight body line','Lower as one unit']},
 plank:{poses:[p(stand,{s:[111,139],h:[175,157],e:[115,198],w:[83,204],k:[212,178],f:[247,204]})],hold:true,equipment:'none',cue:'Hold a straight line and breathe. Keep ribs and pelvis stacked; this is a hold, not a repeated lift.',phases:['Hold steady · breathe']},
};
export function poseAt(d:Diagram,t:number):Pose{
 if(d.poses.length===1)return d.poses[0];
 // Travel through each key position, then return, with a smooth pause at each end.
 const path=d.poses.length===3?[...d.poses,d.poses[0]]:[d.poses[0],d.poses[1],d.poses[0]];
 const x=t*(path.length-1),i=Math.min(path.length-2,Math.floor(x)),u=(1-Math.cos((x-i)*Math.PI))/2;
 const a=path[i],b=path[i+1],out={} as Pose;
 for(const key of Object.keys(a) as (keyof Pose)[]){const q=a[key]!,r=b[key]||q;out[key]=[q[0]+(r[0]-q[0])*u,q[1]+(r[1]-q[1])*u];}
 return out;
}
const shift=(q:Point,x:number,y=0):Point=>[q[0]+x,q[1]+y];
const line=(...pts:Point[])=>pts.map((q,i)=>`${i?'L':'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('');
export function geometry(d:Diagram,p:Pose){
 const front=d.view==='front',l=front?shift(p.s,-19):p.s,r=front?shift(p.s,19):shift(p.s,-6),h2=front?shift(p.h,9):shift(p.h,-6),h1=front?shift(p.h,-9):p.h;
 const head:Point=front?[p.s[0],p.s[1]-25]:[p.s[0]+(p.s[0]-p.h[0])*.28,p.s[1]+(p.s[1]-p.h[1])*.28];
 const w2=p.w2||shift(p.w,-7),e2=p.e2||shift(p.e,-7),k2=p.k2||shift(p.k,-7),f2=p.f2||shift(p.f,-7);
 let gear='',cable='';const eq=d.equipment;
 if(eq==='bar'||eq==='back-bar'||eq==='front-bar'||eq==='lat-bar'){
  const q=eq==='back-bar'?shift(p.s,0,4):p.w,z=eq==='lat-bar'||eq==='front-bar'?w2:shift(q,0,0);
  gear=front?line(shift(q,-15),shift(z,15)):line(shift(q,-28),shift(q,28));
  const ends=front?[q,z]:[shift(q,-20),shift(q,20)];ends.forEach(q=>gear+=line(shift(q,0,-10),shift(q,0,10)));
 }
 if(eq==='dumbbell'||eq==='two-dumbbells'){(eq==='two-dumbbells'?[p.w,w2]:[p.w]).forEach(q=>{gear+=line(shift(q,-9),shift(q,9))+line(shift(q,-8,-7),shift(q,-8,7))+line(shift(q,8,-7),shift(q,8,7));});}
 if(eq==='elbow-pads')gear=line(shift(p.e,0,-9),shift(p.e,0,9))+line(shift(e2,0,-9),shift(e2,0,9));
 if(eq==='knee-pads')gear=line(shift(p.k,-5,-5),shift(p.k,5,5))+line(shift(k2,-5,-5),shift(k2,5,5));
 if(eq==='ankle-pad')gear=line(shift(p.f,-8,5),shift(p.f,8,5));
 if(eq==='plate')gear=line(shift(p.w,-9),shift(p.w,9));
 if(eq==='sliders')gear=line(shift(p.f,-10,3),shift(p.f,10,3));
 if(eq==='band')cable=line(p.w,w2);
 if(eq==='fly-cables')cable=line([30,48],p.w)+line([290,48],w2);
 if(eq==='high-cable')cable=line([264,40],p.w);
 if(eq==='low-cable')cable=line([270,205],p.w);
 if(eq==='rear-cable')cable=line([50,205],p.w);
 if(eq==='overhead-rope')cable=line([53,190],p.w);
 if(eq==='crunch-rope')cable=line([152,23],p.w);
 if(eq==='supine-cable')cable=line([285,200],p.w);
 if(eq==='ankle-cable'){cable=line([60,209],f2);gear=line(shift(f2,-5,-3),shift(f2,5,3));}
 if(eq==='handle'||(eq?.includes('cable')&&eq!=='ankle-cable')||eq?.includes('rope'))gear+=line(shift(p.w,-6,3),shift(p.w,6,-3));
 return{body:line(p.h,p.s),shoulders:front?line(l,r):'',arm:line(l,p.e,p.w),arm2:line(r,e2,w2),leg:line(h1,p.k,p.f),leg2:line(h2,k2,f2),head,gear,cable};
}
