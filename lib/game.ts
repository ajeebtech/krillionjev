import built from '../data/prompts/built.json';
export type Answer = {id:string; name:string; article:string; aliases:string[]; views:number};
export type Question = {id:string; prompt:string; hint:string; answers:Answer[]};
export const viewsMonth = built.month;
export const questions: Question[] = built.prompts;
export function normalize(s:string) {return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
export const catalog: string[] = [...new Set(questions.flatMap(q=>q.answers.map(a=>a.name)))].sort();
export function score(q:Question,a:Answer) { if(q.answers.length<=1)return 1000; const lower=q.answers.filter(x=>x.views<a.views).length; return Math.round(100+900*(1-lower/(q.answers.length-1))); }
export function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function makeQuestions(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);const copy=[...questions];for(let i=copy.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)|0;const j=(n>>>0)%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,7)}

function distance(a:string,b:string){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=row}return previous[b.length]}
export function resolveAnswer(q:Question,input:string):Answer|undefined {
 const key=normalize(input);if(!key)return;
 const names=(a:Answer)=>[a.name,a.article,...a.aliases].map(normalize);
 const exact=q.answers.filter(a=>names(a).includes(key));if(exact.length===1)return exact[0];if(exact.length>1||key.length<5)return;
 const tolerance=key.length>=10?2:1;
 const matches=q.answers.map(a=>({a,d:Math.min(...names(a).map(n=>distance(key,n)))})).filter(x=>x.d<=tolerance).sort((x,y)=>x.d-y.d);
 return matches.length&&(!matches[1]||matches[0].d<matches[1].d)?matches[0].a:undefined;
}
