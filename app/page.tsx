'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, Participant, Match, AppSetting, GamePick, LiveEvent } from '@/lib/supabase';

const ADMIN_PHONE = '7209880163';
const ADMIN_PASSCODE = '3737';
const countries = [
  ['Argentina','🇦🇷'],['Brazil','🇧🇷'],['France','🇫🇷'],['England','🏴'],['Spain','🇪🇸'],['Germany','🇩🇪'],['Portugal','🇵🇹'],['USA','🇺🇸'],['Mexico','🇲🇽'],['Italy','🇮🇹'],['Netherlands','🇳🇱'],['Japan','🇯🇵'],['Uruguay','🇺🇾'],['Croatia','🇭🇷'],['Belgium','🇧🇪'],['Colombia','🇨🇴']
];
const gameOneTeams = [{team:'Canada' as const, flag:'🇨🇦'}, {team:'South Africa' as const, flag:'🇿🇦'}];

type GameOneTeam = 'Canada'|'South Africa';
function cleanPhone(v:string){ return v.replace(/\D/g,''); }
function smsPhone(v:string){ const d=cleanPhone(v); return d.length===10?`+1${d}`:d.startsWith('1')?`+${d}`:v; }
async function notify(phones:string[], message:string){ if(!phones.length) return; await fetch('/api/sms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phones:[...new Set(phones)].map(smsPhone),message})}); }
function flagFor(team?:string|null){ return countries.find(c=>c[0]===team)?.[1] || gameOneTeams.find(t=>t.team===team)?.flag || '⚽'; }

function playWhistle(ctx: AudioContext){
  const now = ctx.currentTime;
  const master = ctx.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(0.34, now+0.03); master.gain.exponentialRampToValueAtTime(0.0001, now+0.85); master.connect(ctx.destination);
  [0,0.08].forEach((offset,i)=>{ const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type='square'; osc.frequency.setValueAtTime(i?2550:2250, now+offset); osc.frequency.linearRampToValueAtTime(i?3150:2950, now+offset+0.28); gain.gain.setValueAtTime(i?0.2:0.35, now+offset); gain.gain.exponentialRampToValueAtTime(0.0001, now+offset+0.55); osc.connect(gain); gain.connect(master); osc.start(now+offset); osc.stop(now+offset+0.6); });
}
function playCheer(ctx: AudioContext){
  const now=ctx.currentTime; const buffer=ctx.createBuffer(1,ctx.sampleRate*1.2,ctx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i]=(Math.random()*2-1)*(1-i/data.length)*0.28; } const src=ctx.createBufferSource(); const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=900; src.buffer=buffer; src.connect(filter); filter.connect(ctx.destination); src.start(now);
}

export default function Home(){
 const [participants,setParticipants]=useState<Participant[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [picks,setPicks]=useState<GamePick[]>([]);
 const [settings,setSettings]=useState<AppSetting>({id:1,registration_locked:false,picks_locked:false,title:'Family World Cup Live',game_one_label:'Brazil vs Japan',updated_at:''});
 const [form,setForm]=useState({first_name:'',last_name:'',phone:'',player_code:'',team:'Argentina',flag:'🇦🇷',game_one_pick:'Canada' as GameOneTeam});
 const [admin,setAdmin]=useState({phone:'',passcode:''});
 const [isAdmin,setIsAdmin]=useState(false);
 const [status,setStatus]=useState('');
 const [broadcast,setBroadcast]=useState('');
 const [displayMode,setDisplayMode]=useState(false);
 const [soundOn,setSoundOn]=useState(false);
 const [lastEvent,setLastEvent]=useState<LiveEvent|null>(null);
 const audioRef=useRef<AudioContext|null>(null);
 const buildDate='2026-06-28';

 useEffect(()=>{ load(); const ch=supabase.channel('fifa-live-v13')
   .on('postgres_changes',{event:'*',schema:'public',table:'participants'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'matches'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'game_picks'},load)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'live_events'},payload=>handleLiveEvent(payload.new as LiveEvent))
   .subscribe(); return ()=>{ supabase.removeChannel(ch); } },[soundOn]);

 async function load(){
   const {data:p}=await supabase.from('participants').select('*').order('created_at',{ascending:true});
   const {data:m}=await supabase.from('matches').select('*').order('round').order('slot');
   const {data:g}=await supabase.from('game_picks').select('*').order('updated_at',{ascending:false});
   const {data:s}=await supabase.from('app_settings').select('*').eq('id',1).maybeSingle();
   setParticipants((p||[]) as Participant[]); setMatches((m||[]) as Match[]); setPicks((g||[]) as GamePick[]); if(s) setSettings(s as AppSetting);
 }
 function ensureAudio(){ const w=window as any; const ctx: AudioContext = audioRef.current ?? new (w.AudioContext||w.webkitAudioContext)(); audioRef.current = ctx; if(ctx.state==='suspended') ctx.resume(); setSoundOn(true); setStatus('Sound enabled on this device.'); playWhistle(ctx); }
 function handleLiveEvent(ev:LiveEvent){ setLastEvent(ev); if(!soundOn || !audioRef.current) return; if(ev.event_type==='whistle' || ev.event_type==='match_start' || ev.event_type==='final_whistle') playWhistle(audioRef.current); if(ev.event_type==='goal' || ev.event_type==='champion') playCheer(audioRef.current); }
 async function pushLiveEvent(event_type:string,title:string,message:string){ await supabase.from('live_events').insert({event_type,title,message}); }
 async function saveGamePick(participant:Participant, team:GameOneTeam, silent=false){
   // FAMILY FUN MODE: allow pick changes even after kickoff/final.
   const selected = gameOneTeams.find(t=>t.team===team)!;
   const {error}=await supabase.from('game_picks').upsert({participant_id:participant.id,game_id:'game-1-canada-south-africa',game_label:settings.game_one_label,selected_team:selected.team,selected_flag:selected.flag,updated_at:new Date().toISOString()},{onConflict:'participant_id,game_id'});
   if(error){ setStatus(error.message); return; }
   if(!silent){ await notify([participant.phone],`Your Current match pick is saved: ${selected.flag} ${selected.team}.`); setStatus(`Pick saved: ${selected.flag} ${selected.team}`); }
 }
 async function register(){
   if(settings.registration_locked){ setStatus('Registration is locked by Admin.'); return; }
   if(!form.first_name||!form.last_name||cleanPhone(form.phone).length<10||form.player_code.length!==4){ setStatus('Enter name, U.S. mobile, and any 4-digit player code. Duplicate codes are allowed.'); return; }
   const phone=cleanPhone(form.phone); const existing = participants.find(p=>cleanPhone(p.phone)===phone && p.player_code===form.player_code); let participant = existing;
   if(existing){ const patch={first_name:form.first_name,last_name:form.last_name,team:form.team,flag:form.flag}; await supabase.from('participants').update(patch).eq('id',existing.id); participant = {...existing,...patch}; }
   else { const row={first_name:form.first_name,last_name:form.last_name,phone,player_code:form.player_code,team:form.team,flag:form.flag,points:0,wins:0,losses:0,goals_for:0,goals_against:0}; const {data,error}=await supabase.from('participants').insert(row).select('*').single(); if(error){ setStatus(error.message); return; } participant = data as Participant; const fullList=[...participants,participant].map((p:any)=>`${p.flag} ${p.first_name} ${p.last_name} - ${p.team}`).join('\n'); await notify([participant.phone],`Welcome to Lytle Lemon FIFA. Current participants:\n${fullList}`); await notify(participants.map(p=>p.phone),`${participant.first_name} joined as ${participant.flag} ${participant.team}.`); }
   await saveGamePick(participant!,form.game_one_pick,true); await notify([participant!.phone],`Saved. Current match pick: ${flagFor(form.game_one_pick)} ${form.game_one_pick}.`); await pushLiveEvent('registration','New player joined',`${participant!.first_name} joined as ${participant!.flag} ${participant!.team}`);
   setForm({first_name:'',last_name:'',phone:'',player_code:'',team:'Argentina',flag:'🇦🇷',game_one_pick:'Canada'}); setStatus('Saved. Everyone updates live.');
 }
 function loginAdmin(){ const ok=cleanPhone(admin.phone)===ADMIN_PHONE && admin.passcode===ADMIN_PASSCODE; setIsAdmin(ok); setStatus(ok?'Admin portal opened.':'Admin login failed.'); }
 async function saveParticipant(p:Participant, patch:Partial<Participant>){ await supabase.from('participants').update(patch).eq('id',p.id); await notify(participants.map(x=>x.phone),`Player update: ${p.first_name} ${p.last_name} was updated.`); await pushLiveEvent('leaderboard','Leaderboard updated',`${p.first_name} ${p.last_name} was updated.`); }
 async function seedBracket(){ const seeds = countries.slice(0,8); const rows: any[] = [0,1,2,3].map(i=>({round:1,slot:i+1,team_a:seeds[i*2][0],team_b:seeds[i*2+1][0],score_a:0,score_b:0,winner:null})); rows.push({round:2,slot:1,team_a:null,team_b:null,score_a:0,score_b:0,winner:null},{round:2,slot:2,team_a:null,team_b:null,score_a:0,score_b:0,winner:null},{round:3,slot:1,team_a:null,team_b:null,score_a:0,score_b:0,winner:null}); await supabase.from('matches').delete().neq('id','00000000-0000-0000-0000-000000000000'); await supabase.from('matches').insert(rows); await notify(participants.map(p=>p.phone),'Tournament bracket has been reset.'); await pushLiveEvent('whistle','Bracket reset','Tournament bracket was reset.'); }
 async function updateMatch(match:Match, patch:Partial<Match>){ const next={...match,...patch}; const winner = next.score_a===next.score_b?null:(next.score_a>next.score_b?next.team_a:next.team_b); await supabase.from('matches').update({...patch,winner,updated_at:new Date().toISOString()}).eq('id',match.id); await advanceWinner(match,winner); await notify(participants.map(p=>p.phone),`Match update: ${next.team_a||'TBD'} ${next.score_a} - ${next.score_b} ${next.team_b||'TBD'}${winner?`. Winner: ${winner}`:''}`); await pushLiveEvent(winner&&match.round===3?'champion':'goal','Score update',`${next.team_a||'TBD'} ${next.score_a} - ${next.score_b} ${next.team_b||'TBD'}${winner?` • Winner: ${winner}`:''}`); }
 async function advanceWinner(match:Match,winner:string|null){ if(!winner) return; const targetRound=match.round+1; if(targetRound>3) return; const targetSlot=Math.ceil(match.slot/2); const field=match.slot%2===1?'team_a':'team_b'; await supabase.from('matches').update({[field]:winner,updated_at:new Date().toISOString()}).eq('round',targetRound).eq('slot',targetSlot); }
 async function toggleRegistration(){ await supabase.from('app_settings').upsert({id:1,registration_locked:!settings.registration_locked,picks_locked:settings.picks_locked,title:settings.title,game_one_label:settings.game_one_label,updated_at:new Date().toISOString()}); }
 async function togglePicks(){ await supabase.from('app_settings').upsert({id:1,registration_locked:settings.registration_locked,picks_locked:!settings.picks_locked,title:settings.title,game_one_label:settings.game_one_label,updated_at:new Date().toISOString()}); await notify(participants.map(p=>p.phone),`Current match picks are now ${settings.picks_locked?'open':'locked'}.`); await pushLiveEvent(settings.picks_locked?'whistle':'final_whistle','Current match picks changed',`Current match picks are now ${settings.picks_locked?'open':'locked'}.`); }
 async function sendBroadcast(){ if(!broadcast.trim()) return; await notify(participants.map(p=>p.phone),`Lytle Lemon FIFA: ${broadcast}`); await pushLiveEvent('announcement','Admin announcement',broadcast); setBroadcast(''); setStatus('Broadcast sent.'); }
 async function startGameOne(){ await pushLiveEvent('match_start','Kickoff!',`${settings.game_one_label} is starting. Good luck!`); await notify(participants.map(p=>p.phone),`${settings.game_one_label} is starting. Good luck!`); }
 async function finalWhistle(){ await pushLiveEvent('final_whistle','Final whistle!',`${settings.game_one_label} has ended. Leaderboard updates are coming.`); await notify(participants.map(p=>p.phone),`Final whistle: ${settings.game_one_label} has ended. Check the live leaderboard.`); }
 const leaderboard=useMemo(()=>[...participants].sort((a,b)=>b.points-a.points || b.wins-a.wins || (b.goals_for-b.goals_against)-(a.goals_for-a.goals_against)),[participants]);
 const pickCounts=useMemo(()=>({Canada:picks.filter(p=>p.selected_team==='Canada').length, SouthAfrica:picks.filter(p=>p.selected_team==='South Africa').length}),[picks]);
 const pickFor=(id:string)=>picks.find(p=>p.participant_id===id); const byRound=(r:number)=>matches.filter(m=>m.round===r); const champion=matches.find(m=>m.round===3)?.winner; const joinLink=typeof window==='undefined'?'':window.location.origin;
 return <main className={displayMode?'wrap tv':'wrap'}>
  <section className="hero"><div><h1>{settings.title}</h1><p className="muted">Live family picks, bracket board, leaderboard, admin updates, and SMS broadcasts.</p></div><div className="heroActions"><button className="ghost" onClick={ensureAudio}>{soundOn?'🔊 Sound On':'Enable Whistle Sound'}</button><button className="ghost" onClick={()=>setDisplayMode(!displayMode)}>{displayMode?'Exit TV Mode':'TV Display Mode'}</button><div className="badge">LIVE FAMILY EDITION</div></div></section>
  {lastEvent&&<section className="liveEvent"><b>{lastEvent.title}</b><span>{lastEvent.message}</span></section>}
  {champion&&<section className="champion">🏆 Current Champion: {flagFor(champion)} {champion}</section>}
  <section className="card pickBoard"><h2>Family Match Picks: 🇧🇷 Brazil vs 🇯🇵 Japan</h2><p className="muted">Family fun mode: picks stay open even after kickoff/final. Realtime totals update for everyone.</p><div className="pickTotals"><div><b>🇨🇦 Canada</b><span>{pickCounts.Canada}</span></div><div><b>🇿🇦 South Africa</b><span>{pickCounts.SouthAfrica}</span></div></div></section>
  <div className="grid">
   {!displayMode&&<section className="card"><h2>Player Registration & Current Pick</h2>{settings.registration_locked?<p className="locked">Registration is locked.</p>:<><div className="row"><input placeholder="First name" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/><input placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></div><br/><div className="row"><input placeholder="U.S. mobile number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input placeholder="4-digit player code" maxLength={4} value={form.player_code} onChange={e=>setForm({...form,player_code:e.target.value.replace(/\D/g,'')})}/></div><p className="hint">Duplicate player codes are OK. Same phone + code lets a player update their own pick.</p><label className="muted">Tournament team</label><select value={form.team} onChange={e=>{const c=countries.find(x=>x[0]===e.target.value)!;setForm({...form,team:c[0],flag:c[1]})}}>{countries.map(c=><option key={c[0]} value={c[0]}>{c[1]} {c[0]}</option>)}</select><br/><br/><label className="muted">Current match pick</label><div className="choiceRow">{gameOneTeams.map(t=><button key={t.team} className={form.game_one_pick===t.team?'selectedChoice':'ghost'} disabled={false} onClick={()=>setForm({...form,game_one_pick:t.team})}>{t.flag} {t.team}</button>)}</div><br/><button onClick={register}>Save / Update Picks</button></>}<p className="muted">{status}</p><div className="invite"><b>Join Link</b><span>{joinLink}</span></div></section>}
   <section className="card"><h2>Live Leaderboard</h2><div className="list">{leaderboard.map((p,i)=><div className="item" key={p.id}><span>#{i+1} {p.flag} {p.first_name} {p.last_name}<br/><span className="muted">{p.team} • Pick: {pickFor(p.id)?.selected_flag || '—'} {pickFor(p.id)?.selected_team || 'No pick yet'} • W {p.wins||0} L {p.losses||0}</span></span><b>{p.points}</b></div>)}</div></section>
  </div>
  <section className="card bracketCard"><h2>TV-Style Knockout Bracket</h2><div className="bracket">{[1,2,3].map(r=><div key={r} className="round"><h3>{r===1?'Quarterfinals':r===2?'Semifinals':'Final'}</h3>{byRound(r).map(m=><div className="match" key={m.id}><div className={`team ${m.winner===m.team_a?'winner':''}`}><span>{flagFor(m.team_a)} {m.team_a||'TBD'}</span><b>{m.score_a}</b></div><div className={`team ${m.winner===m.team_b?'winner':''}`}><span>{flagFor(m.team_b)} {m.team_b||'TBD'}</span><b>{m.score_b}</b></div></div>)}</div>)}</div></section>
  {!displayMode && (!isAdmin?<section className="card"><h2>Admin</h2><div className="row"><input placeholder="Admin mobile" value={admin.phone} onChange={e=>setAdmin({...admin,phone:e.target.value})}/><input placeholder="Passcode" type="password" value={admin.passcode} onChange={e=>setAdmin({...admin,passcode:e.target.value})}/><button onClick={loginAdmin}>Open Admin Portal</button></div></section>:
  <section className="card admin"><h2>Hidden Admin Portal</h2><div className="adminGrid"><button className="ghost" onClick={seedBracket}>Reset / Seed Bracket</button><button className="ghost" onClick={toggleRegistration}>{settings.registration_locked?'Unlock Registration':'Lock Registration'}</button><button className="ghost" onClick={togglePicks}>{settings.picks_locked?'Unlock Game 1 Picks':'Lock Game 1 Picks'}</button><button onClick={startGameOne}>▶️ Start Match + Whistle</button><button onClick={()=>pushLiveEvent('whistle','Referee whistle','Admin played the whistle.')}>🔊 Play Whistle</button><button onClick={finalWhistle}>🏁 Final Whistle</button></div><h3>Broadcast Text</h3><div className="row"><input placeholder="Message all participants" value={broadcast} onChange={e=>setBroadcast(e.target.value)}/><button onClick={sendBroadcast}>Send SMS</button></div><h3>Manual Game 1 Pick Overrides</h3><div className="list">{participants.map(p=><AdminPick key={p.id} p={p} current={pickFor(p.id)} save={saveGamePick}/>)}</div><h3>Manual Player Score / Stats</h3><div className="list">{participants.map(p=><AdminScore key={p.id} p={p} save={saveParticipant}/>)}</div><h3>Manual Match Score Overrides</h3><div className="list">{matches.map(m=><AdminMatch key={m.id} m={m} save={updateMatch}/>)}</div></section>)}
  <div className="footer">Created by C. Lemon • DECIDE • COMMIT • SWING • Realtime powered by Supabase • SMS powered by Twilio</div>
 </main>
}
function AdminPick({p,current,save}:{p:Participant;current?:GamePick;save:(p:Participant,team:GameOneTeam)=>void}){ const [team,setTeam]=useState<GameOneTeam>(current?.selected_team || 'Canada'); useEffect(()=>setTeam(current?.selected_team || 'Canada'),[current?.selected_team]); return <div className="item"><span>{p.flag} {p.first_name} {p.last_name}<br/><span className="muted">Current pick: {current?.selected_flag || '—'} {current?.selected_team || 'No pick yet'}</span></span><div className="row small"><select value={team} onChange={e=>setTeam(e.target.value as GameOneTeam)}><option value="Canada">🇨🇦 Canada</option><option value="South Africa">🇿🇦 South Africa</option></select><button onClick={()=>save(p,team)}>Submit Change</button></div></div> }
function AdminScore({p,save}:{p:Participant;save:(p:Participant,patch:Partial<Participant>)=>void}){ const [v,setV]=useState({points:p.points,wins:p.wins||0,losses:p.losses||0,goals_for:p.goals_for||0,goals_against:p.goals_against||0}); useEffect(()=>setV({points:p.points,wins:p.wins||0,losses:p.losses||0,goals_for:p.goals_for||0,goals_against:p.goals_against||0}),[p]); return <div className="item adminItem"><span>{p.flag} {p.first_name} {p.last_name}<br/><span className="muted">{p.team}</span></span><div className="statGrid"><input title="Points" type="number" value={v.points} onChange={e=>setV({...v,points:Number(e.target.value)})}/><input title="Wins" type="number" value={v.wins} onChange={e=>setV({...v,wins:Number(e.target.value)})}/><input title="Losses" type="number" value={v.losses} onChange={e=>setV({...v,losses:Number(e.target.value)})}/><input title="Goals For" type="number" value={v.goals_for} onChange={e=>setV({...v,goals_for:Number(e.target.value)})}/><input title="Goals Against" type="number" value={v.goals_against} onChange={e=>setV({...v,goals_against:Number(e.target.value)})}/><button onClick={()=>save(p,v)}>Submit Change</button></div></div> }
function AdminMatch({m,save}:{m:Match;save:(m:Match,patch:Partial<Match>)=>void}){ const [a,setA]=useState(m.score_a); const [b,setB]=useState(m.score_b); useEffect(()=>{setA(m.score_a);setB(m.score_b)},[m.score_a,m.score_b]); return <div className="item"><span>{flagFor(m.team_a)} {m.team_a||'TBD'} vs {flagFor(m.team_b)} {m.team_b||'TBD'}<br/><span className="muted">Round {m.round}, Match {m.slot}</span></span><div className="row small"><input type="number" value={a} onChange={e=>setA(Number(e.target.value))}/><input type="number" value={b} onChange={e=>setB(Number(e.target.value))}/><button onClick={()=>save(m,{score_a:a,score_b:b})}>Submit Change</button></div></div> }
