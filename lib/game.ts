import raw from '../data/players.json';
export type Player = {name:string; teams:{team:string;years:string[]}[]; appearances?:number|null; appearanceSource?:string};
export type Question = {teams:[string,string]; answers:Player[]};
const teamAliases: Record<string,string> = {
  'rising pune supergiant': 'Rising Pune Supergiant',
  'rising pune supergiants': 'Rising Pune Supergiant',
  'kings xi punjab': 'Punjab Kings',
  'punjab kings': 'Punjab Kings',
  'delhi daredevils': 'Delhi Capitals',
  'delhi capitals': 'Delhi Capitals',
};
export function normalize(s:string) {return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
export function normalizeTeam(team:string) {return teamAliases[normalize(team)] || team}
export const players:Player[] = raw.map(p=>({...p, teams:p.teams.map(t=>({...t,team:normalizeTeam(t.team)}))}));
const teams = [...new Set(players.flatMap(p=>p.teams.map(t=>t.team)))].sort();
export const questions:Question[] = teams.flatMap((a,i)=>teams.slice(i+1).map(b=>({teams:[a,b] as [string,string], answers:players.filter(p=>[a,b].every(t=>p.teams.some(x=>x.team===t)))}))).filter(q=>q.answers.length>=5);
export function score(q:Question,p:Player) { if(p.appearances == null)return 100; const known=q.answers.filter(a=>a.appearances!=null); if(known.length<=1)return 1000; const lower=known.filter(a=>a.appearances!<p.appearances!).length; return Math.round(100+900*(1-lower/(known.length-1))); }
export function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function makeQuestions(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);const copy=[...questions];for(let i=copy.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)|0;const j=(n>>>0)%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,7)}

function distance(a:string,b:string){let previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=row}return previous[b.length]}
export function resolvePlayer(input:string):Player|undefined {const key=normalize(input);if(!key)return;const exact=players.filter(p=>normalize(p.name)===key);if(exact.length===1)return exact[0];if(exact.length>1||key.length<5)return;const tolerance=key.length>=10?2:1;const matches=players.map(p=>({p,d:distance(key,normalize(p.name))})).filter(x=>x.d<=tolerance).sort((a,b)=>a.d-b.d);return matches.length&&(!matches[1]||matches[0].d<matches[1].d)?matches[0].p:undefined}
