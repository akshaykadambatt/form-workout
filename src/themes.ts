export const themes=[
 {id:'form',name:'Form',description:'Charcoal, soft pastels, rounded cards.',mode:'dark',base:'#171919',surface:'#212424',raised:'#30362f',text:'#eeeee8',muted:'#acb4aa',line:'#485044',accent:'#e8ed91',accentInk:'#252b19',upper:'#f4a5c4',lower:'#bdb1ed',colorInk:'#27232d',radius:28,small:14,pill:999,border:1},
 {id:'blueprint',name:'Blueprint',description:'Paper white, cobalt, crisp geometry.',mode:'light',base:'#f4f3ec',surface:'#ffffff',raised:'#e8e9e4',text:'#17203c',muted:'#536078',line:'#17203c',accent:'#284bdb',accentInk:'#ffffff',upper:'#f7a16b',lower:'#93b8fd',colorInk:'#142346',radius:8,small:4,pill:8,border:2},
 {id:'pop',name:'Pop',description:'Warm cream, vivid pink, playful shapes.',mode:'light',base:'#fff2d8',surface:'#fffcf5',raised:'#f2dfb9',text:'#332037',muted:'#755c65',line:'#563344',accent:'#762dc1',accentInk:'#ffffff',upper:'#ff8dc5',lower:'#a4b5ff',colorInk:'#32213e',radius:32,small:16,pill:16,border:2},
 {id:'midnight',name:'Midnight',description:'Deep navy, electric cyan, clean edges.',mode:'dark',base:'#101a2b',surface:'#19283e',raised:'#263b56',text:'#eef5ff',muted:'#a9bdd6',line:'#425976',accent:'#85f1ed',accentInk:'#112c39',upper:'#ff9ab7',lower:'#7bbaf7',colorInk:'#102938',radius:16,small:8,pill:12,border:1},
 {id:'clay',name:'Clay',description:'Soft sage, terracotta, generous curves.',mode:'light',base:'#e8ede2',surface:'#f8f8ee',raised:'#dbe3d2',text:'#2e382f',muted:'#596751',line:'#a1af96',accent:'#476844',accentInk:'#ffffff',upper:'#eab095',lower:'#bdc5e8',colorInk:'#343334',radius:40,small:20,pill:999,border:1},
] as const;
export function resolveTheme(id?:string){return themes.find(t=>t.id===id)||themes[0];}
export function applyTheme(id?:string){
 const t=resolveTheme(id),root=document.documentElement;
 const colors={base:t.base,surface:t.surface,raised:t.raised,text:t.text,muted:t.muted,line:t.line,lime:t.accent,pink:t.upper,purple:t.lower,'accent-ink':t.accentInk,'color-ink':t.colorInk};
 Object.entries(colors).forEach(([key,value])=>root.style.setProperty('--'+key,value));
 root.style.setProperty('--radius',t.radius+'px');root.style.setProperty('--radius-small',t.small+'px');root.style.setProperty('--radius-pill',t.pill+'px');root.style.setProperty('--border-width',t.border+'px');
 root.style.colorScheme=t.mode;root.dataset.theme=t.id;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',t.base);
}
