import prompts from '../data/prompts.json';
export type Question = {id:string; prompt:string; hint:string};
export type Candidate = {title:string; description:string};
export type Verdict = {correct:false} | {correct:true; name:string; points:number; views:number; month:string};
export const questions: Question[] = prompts;
export function dateKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function makeQuestions(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);const copy=[...questions];for(let i=copy.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)|0;const j=(n>>>0)%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,7)}
