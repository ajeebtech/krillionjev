'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { dateKey, makeQuestions, normalize, players, score, resolvePlayer, type Question } from '../lib/game';

type Result={question:Question; answer:string; correct:boolean; points:number; appearances:number|null; appearanceSource?:string};
type Session={mode:'daily'|'practice'; date:string; questions:Question[]; results:Result[]; deadline:number; phase:'question'|'feedback'|'summary'};
const KEY='ipl-climb-daily-v4';
type Stats={players:number; total:number|null; higher:number; average:number; buckets:number[]};
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUMMIT=7000;

function tier(r:Result){
 if(!r.correct)return {name:r.answer?'DUCK':'TIMED OUT',color:'var(--tier-miss-lit)'};
 if(r.points>=1000)return {name:'CENTURY',color:'var(--tier-gold)'};
 if(r.points>=750)return {name:'HAT-TRICK',color:'var(--tier-deepcut)'};
 if(r.points>=500)return {name:'MAXIMUM',color:'var(--tier-rare)'};
 if(r.points>=250)return {name:'BOUNDARY',color:'var(--tier-solid)'};
 return {name:'SINGLE',color:'var(--tier-obvious)'};
}

const BALL=Array.from({length:12},(_,y)=>Array.from({length:12},(_,x)=>{
 const d=Math.hypot(x-5.5,y-5.5);
 if(d>5.9)return '';
 if((x===7)&&y>=2&&y<=9)return y%2?'#ffe9ef':'#ffb3c8';
 if(d>4.9)return '#9e2346';
 if((x===2||x===3)&&(y===3||y===4)&&!(x===3&&y===4))return '#ffb3c8';
 return '#ff5d8f';
}));
function Ball(){
 return <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">{BALL.flatMap((row,y)=>row.map((c,x)=>c?<rect key={x+'-'+y} x={x} y={y} width="1" height="1" fill={c}/>:null))}<rect x="3" y="6" width="1" height="1" fill="#2a0a16"/><rect x="5" y="6" width="1" height="1" fill="#2a0a16"/></svg>;
}

function Sky({altitude,mood}:{altitude:number; mood:''|'up'|'miss'}){
 const f=Math.min(altitude/SUMMIT,1);
 return <div className="ds-sky" style={{'--f':f} as CSSProperties} aria-hidden="true">
  <div className="ds-stars"/>
  <div className="ds-horizon"/>
  <div className="ds-world">
   {Array.from({length:8},(_,i)=><div key={i} className={'ds-amb'+(i===7?' major':'')} style={{bottom:'calc(var(--mascot-y) + '+i*20+'vh)'}}><span className="dash">———</span> {i===7?'SUMMIT · ':''}{(i*1000).toLocaleString()} M <span className="dash">———</span></div>)}
   <svg className="ds-flag" style={{bottom:'calc(var(--mascot-y) + 140vh + 12px)'}} viewBox="0 0 10 12" shapeRendering="crispEdges"><rect x="1" y="0" width="1" height="12" fill="#e8f1ff"/><rect x="2" y="0" width="6" height="4" fill="#ffd166"/><rect x="2" y="4" width="3" height="1" fill="#ffd166"/></svg>
   <svg className="ds-ground" viewBox="0 0 160 40" preserveAspectRatio="none" shapeRendering="crispEdges">
    <path d="M0 6h12v-2h14v-2h10v2h16v2h12v-3h14v-1h12v2h18v2h14v-2h12v2h16v1h10V40H0z" fill="#103330"/>
    <path d="M0 6h12v-2h14v-2h10v2h16v2h12v-3h14v-1h12v2h18v2h14v-2h12v2h16v1h10" fill="none" stroke="#3ddc97" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    <path d="M0 14h20v-2h22v2h18v-3h24v2h20v-2h26v3h30V40H0z" fill="#0a1d1f"/>
   </svg>
  </div>
  <div className={'ds-mascot '+mood}><div className="ds-mascot-sprite"><Ball/></div></div>
 </div>;
}

function Curve({stats}:{stats:Stats|'loading'|'error'}){
 if(stats==='loading')return <div className="ds-curve"><p className="ds-curve-note">COUNTING TODAY’S CLIMBERS…</p></div>;
 if(stats==='error'||stats.total===null)return <div className="ds-curve"><p className="ds-curve-note">COULDN’T REACH THE LEADERBOARD</p></div>;
 const mine=Math.min(Math.floor(stats.total/500),13);
 const max=Math.max(...stats.buckets,1);
 const top=Math.max(1,Math.ceil((stats.higher+1)/stats.players*100));
 return <div className="ds-curve">
  <p className="ds-curve-top">{stats.players===1?'FIRST CLIMBER TODAY':'TOP '+top+'%'}</p>
  <p className="ds-curve-note">#{stats.higher+1} OF {stats.players.toLocaleString()} {stats.players===1?'CLIMBER':'CLIMBERS'} · AVG {stats.average.toLocaleString()} M</p>
  <div className="ds-curve-plot">
   <span className="ds-curve-you" style={{left:((mine+.5)/14*100)+'%'}}>YOU ▼</span>
   <svg viewBox="0 0 140 52" preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={'Distribution of '+stats.players+' daily scores; you are in the top '+top+' percent'}>
    {stats.buckets.map((n,i)=>{const h=n?Math.max(2,Math.round(n/max*50)):1;return <rect key={i} x={i*10+1} y={52-h} width="8" height={h} fill={i===mine?'#ff5d8f':n?'#4de3ff66':'#1b3050'}/>})}
   </svg>
  </div>
  <div className="ds-curve-axis"><span>0 M</span><span>3,500 M</span><span>7,000 M</span></div>
 </div>;
}

function AnimatedScore({ value }: { value: number }) {
 const [shown, setShown] = useState(0);
 useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || value === 0) { setShown(value); return; }
  let frame = 0; const start = performance.now();
  const tick = (time: number) => { const progress = Math.min((time - start) / 650, 1); setShown(Math.round(value * (1 - Math.pow(1 - progress, 3)))); if (progress < 1) frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
 }, [value]);
 return <b aria-label={'Plus '+value+' metres'}>+{shown} M</b>;
}

export default function Page(){
 const [soundOn,setSoundOn]=useState(true);const audio=useRef<Record<string,HTMLAudioElement>>({});const answerInput=useRef<HTMLInputElement>(null);const [session,setSession]=useState<Session|null>(null);const [input,setInput]=useState('');const [picked,setPicked]=useState(false);const [stats,setStats]=useState<Stats|'loading'|'error'|null>(null);const [answerError,setAnswerError]=useState('');const [now,setNow]=useState(0);const [hydrated,setHydrated]=useState(false);
 useEffect(()=>{setSoundOn(localStorage.getItem('ipl-climb-sound') !== 'off');setNow(Date.now());setHydrated(true);const saved=localStorage.getItem(KEY);if(saved){try{const s=JSON.parse(saved) as Session;if(s.date===dateKey()||s.phase!=='summary')setSession(s)}catch{localStorage.removeItem(KEY)}}const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id)},[]);
 useEffect(()=>{if(session?.mode==='daily')localStorage.setItem(KEY,JSON.stringify(session))},[session]);
 useEffect(()=>{
  if(session?.phase!=='summary'||session.mode!=='daily'||!SUPABASE_URL||!SUPABASE_KEY){setStats(null);return}
  let player=localStorage.getItem('ipl-climb-player');if(!player){player=crypto.randomUUID();localStorage.setItem('ipl-climb-player',player)}
  let cancelled=false;setStats('loading');
  fetch(SUPABASE_URL+'/rest/v1/rpc/ipl_climb_submit',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_date:session.date,p_player:player,p_points:session.results.map(r=>r.points)})})
   .then(r=>r.ok?r.json():Promise.reject(r.status)).then((s:Stats)=>{if(!cancelled)setStats(s)}).catch(()=>{if(!cancelled)setStats('error')});
  return()=>{cancelled=true};
 },[session?.phase,session?.mode,session?.date]);
 useEffect(()=>{if(session?.phase==='question')answerInput.current?.focus()},[session?.phase,session?.results.length]);
 function playSound(name:'click-soft'|'success-chime'|'error-004') { if (!soundOn) return; try { const sound=audio.current[name] || new Audio('/sounds/'+name+'.mp3'); audio.current[name]=sound; sound.volume=0.35; sound.currentTime=0; void sound.play().catch(()=>{}); } catch { /* Audio is optional. */ } }
 function toggleSound(){const next=!soundOn;setSoundOn(next);localStorage.setItem('ipl-climb-sound',next?'on':'off');}
 const remaining=session?Math.max(0,Math.ceil((session.deadline-now)/1000)):25;
 function start(mode:'daily'|'practice'){playSound('click-soft');const date=dateKey();setInput('');setAnswerError('');setSession({mode,date,questions:makeQuestions(mode==='daily'?date:String(Date.now())+Math.random()),results:[],deadline:Date.now()+25000,phase:'question'})}
 function startDaily(){const saved=localStorage.getItem(KEY);if(saved){try{const s=JSON.parse(saved);if(s.date===dateKey()){setSession(s);return}}catch{}}start('daily')}
 function submit(value=input, userInitiated=true){if(!session||session.phase!=='question')return;const q=session.questions[session.results.length];const match=resolvePlayer(value);const accepted=match&&q.answers.find(p=>p.name===match.name);const valid=!!accepted;if(userInitiated)playSound(valid?'success-chime':'error-004');if(userInitiated && typeof navigator !== 'undefined' && 'vibrate' in navigator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(valid ? [35, 55, 45] : [90]);if(userInitiated&&!valid){setAnswerError('NOT IN BOTH SQUADS — TRY ANOTHER NAME');requestAnimationFrame(()=>answerInput.current?.focus());return}setAnswerError('');const result:Result={question:q,answer:match?.name||value.trim(),correct:!!valid,points:accepted?score(q,accepted):0,appearances:accepted?accepted.appearances??null:null,appearanceSource:accepted?accepted.appearanceSource:undefined};setSession({...session,results:[...session.results,result],phase:'feedback'});setInput('')}
 useEffect(()=>{if(session?.phase==='question'&&now>0&&session.deadline<=now)submit('',false)},[now,session]);
 function next(){if(!session)return;playSound('click-soft');setSession({...session,phase:session.results.length===7?'summary':'question',deadline:Date.now()+25000})}
 const total=session?.results.reduce((sum,r)=>sum+r.points,0)||0;const q=session?.questions[session.results.length];const last=session?.results.at(-1);const suggestions=!picked&&input.trim().length>=2?players.filter(p=>normalize(p.name).includes(normalize(input))).slice(0,5):[];
 const phase=!session?'intro':session.phase==='question'?'answering':session.phase;
 const hot=remaining<=5;
 const lastTier=last&&tier(last);
 const todayDone=hydrated&&(()=>{try{const s=JSON.parse(localStorage.getItem(KEY)||'null');return s?.date===dateKey()&&s.phase==='summary'}catch{return false}})();

 return <main className="ds-root" data-phase={phase}>
  <Sky altitude={total} mood={session?.phase==='feedback'?(last?.correct?'up':'miss'):''}/>
  <div className="ds-vignette" aria-hidden="true"/>

  <button className="ds-mute" type="button" onClick={toggleSound} aria-label={soundOn ? 'Mute sound effects' : 'Turn on sound effects'} aria-pressed={soundOn}>
   <svg viewBox="0 0 20 20" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d="M2 7h4l5-4v14l-5-4H2z"/>{soundOn?<path d="M13 7h2v6h-2zM16 5h2v10h-2z"/>:<path d="M13 7h2v2h-2zM15 9h2v2h-2zM17 7h2v2h-2zM13 11h2v2h-2zM17 11h2v2h-2z"/>}</svg>
  </button>

  {session&&<header className="ds-hud" aria-label="Game progress">
   <div className="ds-pod"><div className="label">ALTITUDE</div><div className="ds-depth-num">{total.toLocaleString()}<small>M</small></div></div>
   <div className="ds-hud-mid"><div className="ds-dots" aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} className={i<session.results.length ? 'done' : i===session.results.length && session.phase === 'question' ? 'cur' : ''}/>)}</div><span className="ds-prompt-count">{session.mode==='daily'?'DAILY':'PRACTICE'} · {Math.min(session.results.length + (session.phase === 'question' ? 1 : 0),7)}/7</span></div>
   <div className="ds-pod ds-score-pod"><div className="label">TIME</div><div className={'ds-score-num'+(hot&&session.phase==='question'?' hot':'')} aria-label={remaining+' seconds remaining'}>{session.phase==='question'?remaining:'--'}<small>S</small></div></div>
  </header>}

  {!session&&<>
   <section className="ds-title">
    <h1>IPL CLIMB</h1>
    <p className="ds-tagline">THE DAILY ASCENT</p>
    <p className="ds-sub">Two teams. One player in both. Rare answers climb you higher.</p>
   </section>
   <section className="ds-intro">
    <div className="ds-intro-inner">
     <button className="ds-begin-btn" disabled={!hydrated} onClick={startDaily}>{todayDone?'VIEW TODAY’S CLIMB':'CLIMB ▲'}</button>
     <button className="btn-quiet" onClick={()=>start('practice')}>∞ PRACTICE CLIMB</button>
     <details className="ds-howto"><summary>How to play</summary><ul>
      <li>Seven prompts a day, same for everyone.</li>
      <li>Name a player who was in both squads.</li>
      <li>25 seconds each. Rarer players climb higher.</li>
      <li>Squad members count even with zero matches.</li>
      <li>Single · Boundary · Maximum · Hat-trick · Century</li>
     </ul></details>
     <div className="ds-intro-meta"><span>{hydrated?dateKey():'—'} · RESETS 00:00 IST</span><a href="https://cricsheet.org/" target="_blank" rel="noreferrer">DATA: CRICSHEET ↗</a></div>
    </div>
   </section>
  </>}

  {session?.phase==='question'&&q&&<>
   <section key={session.results.length} className="ds-card ds-px">
    <div className="rnd">PROMPT {String(session.results.length+1).padStart(2,'0')} / 07</div>
    <h1 className="prompt">{q.teams[0]}<span> × </span>{q.teams[1]}</h1>
    <div className="hint">NAME A PLAYER WHO WAS IN BOTH SQUADS</div>
   </section>
   {answerError&&<p className="ds-reject" id="answer-error" role="alert">{answerError}</p>}
   <form className={'ds-dock'+(hot?' hot':'')} onSubmit={e=>{e.preventDefault();submit()}}>
    <div className="ds-dock-inner">
     <div className="ds-input-col">
      {suggestions.length>0&&<div className="ds-suggest">{suggestions.map(p=><button type="button" key={p.name} onClick={()=>{setInput(p.name);setPicked(true);setAnswerError('');answerInput.current?.focus()}}>{p.name}</button>)}</div>}
      <label htmlFor="answer" className="sr-only">Your answer</label>
      <input ref={answerInput} id="answer" className={'ds-input'+(answerError?' ds-shake':'')} autoComplete="off" value={input} aria-invalid={!!answerError} aria-describedby={answerError ? 'answer-error' : undefined} onChange={e=>{setInput(e.target.value);setPicked(false);if(answerError)setAnswerError('')}} placeholder="type a player…"/>
      <div className="ds-fuse" aria-hidden="true"><div className="ds-fuse-fill" style={{transform:'scaleX('+(remaining/25)+')'}}/></div>
     </div>
     <button className="ds-dive-btn" type="submit" aria-label="Submit answer">CLIMB</button>
    </div>
   </form>
  </>}

  {session?.phase==='feedback'&&last&&lastTier&&<section className={'ds-landed'+(last.correct?'':' miss')} style={{'--tc':lastTier.color} as CSSProperties} role="status" aria-live="polite">
   <div className="tname">{lastTier.name}</div>
   <div className="tans">{last.answer||'NO ANSWER'}</div>
   <div className="tpts"><AnimatedScore value={last.points}/></div>
   <div className="tsub">{last.correct?(last.appearances===null?'APPEARANCES UNKNOWN · MINIMUM HEIGHT':last.appearances+' IPL '+(last.appearanceSource === 'Cricsheet' ? 'MATCHES IN CRICSHEET LINEUPS' : 'APPEARANCES')):last.answer?'NOT IN BOTH SQUADS':'THE CLOCK RAN OUT'}</div>
   <button className="ds-next-btn" onClick={next} autoFocus>{session.results.length===7?'RESULTS ▲':'NEXT ▲'}</button>
  </section>}

  {session?.phase==='summary'&&<section className="ds-done">
   <div className="ds-done-inner">
    <p className="ds-tagline">{session.mode==='daily'?'DAILY CLIMB · '+session.date:'PRACTICE CLIMB'}</p>
    <h1 className="ds-done-total">{total.toLocaleString()}<small> M</small></h1>
    <p className="ds-sub">{total>=SUMMIT?'SUMMIT REACHED.':Math.round(total/SUMMIT*100)+'% OF THE WAY TO THE SUMMIT'}</p>
    {stats&&<Curve stats={stats}/>}
    <ol className="ds-results">{session.results.map((r,i)=>{const t=tier(r);return <li key={i} style={{'--tc':t.color} as CSSProperties}><span className="n">{String(i+1).padStart(2,'0')}</span><span className="a">{r.answer||'—'}<small>{r.question.teams.join(' × ')}</small></span><b>{r.points?'+'+r.points:'0'}</b></li>})}</ol>
    <div className="ds-done-actions">
     <button className="btn-descend" onClick={()=>start('practice')}>PRACTICE CLIMB ▲</button>
     <button className="btn-quiet" onClick={()=>setSession(null)}>HOME</button>
    </div>
    {session.mode==='daily'&&<p className="ds-sub">NEXT DAILY CLIMB AT 00:00 IST</p>}
   </div>
  </section>}

  {session&&session.phase!=='summary'&&<button className="ds-home" onClick={()=>setSession(null)} aria-label="Home">◂ HOME</button>}
  <div className="ds-crt" aria-hidden="true"/>
 </main>
}
