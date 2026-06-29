'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Player={id:string;first_name:string;last_name:string;phone:string;player_code:string;team:string;flag:string;points:number;wins:number;losses:number;goals_for:number;goals_against:number};
type Match={id:string;round:string;kickoff:string;team_a:string;flag_a:string;team_b:string;flag_b:string;score_a:number;score_b:number;winner:string|null;status:string};
type Pick={id:string;participant_id:string;match_id:string;selected_team:string};

const ADMIN_PHONE='7209880163';
const ADMIN_PASSCODE='3737';
const teams=[['Argentina','🇦🇷'],['Brazil','🇧🇷'],['France','🇫🇷'],['England','🏴'],['Spain','🇪🇸'],['Germany','🇩🇪'],['Portugal','🇵🇹'],['USA','🇺🇸'],['Mexico','🇲🇽'],['Netherlands','🇳🇱'],['Japan','🇯🇵'],['Canada','🇨🇦'],['Morocco','🇲🇦'],['Belgium','🇧🇪'],['Colombia','🇨🇴'],['Germany','🇩🇪'],['Paraguay','🇵🇾'],['Norway','🇳🇴'],['Sweden','🇸🇪'],['Ecuador','🇪🇨'],['Senegal','🇸🇳']];

function clean(v:string){return v.replace(/\D/g,'')}
function smsPhone(v:string){const d=clean(v);return d.length===10?`+1${d}`:d.startsWith('1')?`+${d}`:v}
async function sendSMS(phones:string[],message:string){if(!phones.length)return;await fetch('/api/sms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phones:[...new Set(phones)].map(smsPhone),message})}).catch(()=>{})}

function teamPower(team:string){
 const power:Record<string,number>={Brazil:92,France:90,Spain:88,Germany:86,Argentina:86,England:84,Portugal:83,Netherlands:82,Belgium:80,Canada:74,Japan:76,Morocco:77,USA:76,Mexico:75,Colombia:78,Switzerland:76,Croatia:78,Senegal:75,Sweden:74,Norway:73,Paraguay:72,Ecuador:72};
 return power[team] ?? 65;
}
function teamChance(a:string,b:string){
 const pa=teamPower(a), pb=teamPower(b);
 const ca=Math.round((pa/(pa+pb))*100);
 return [ca,100-ca];
}
function pct(n:number,d:number){return d?Math.round((n/d)*100):0}
function playerChance(player:Player,players:Player[]){
 if(!players.length)return 0;
 const max=Math.max(...players.map(p=>p.points||0),0);
 const base=(player.points||0)+1;
 const total=players.reduce((sum,p)=>sum+(p.points||0)+1,0);
 const bonus=(player.points||0)===max?8:0;
 return Math.min(99,Math.max(1,Math.round((base/total)*100+bonus)));
}

function roadToVictory(player:Player,players:Player[],matches:Match[],picks:Pick[]){
 const playerPicks=picks.filter(p=>p.participant_id===player.id);
 const remaining=matches.filter(m=>m.status!=='final');
 const needs=remaining.slice(0,5).map(m=>{
  const pick=playerPicks.find(p=>p.match_id===m.id);
  return pick?`${pick.selected_team} over ${pick.selected_team===m.team_a?m.team_b:m.team_a}`:`Pick ${m.team_a} vs ${m.team_b}`;
 });
 const rivals=[...players].filter(p=>p.id!==player.id).sort((a,b)=>(b.points||0)-(a.points||0));
 const rival=rivals[0];
 const current=playerChance(player,players);
 const jump=Math.min(99,current+20);
 return {needs,rival,jump};
}

function needText(player:Player,matches:Match[],picks:Pick[]){
 const remaining=matches.find(m=>m.status!=='final');
 if(!remaining)return 'All listed games are final. Watch for admin updates.';
 const pick=picks.find(p=>p.participant_id===player.id&&p.match_id===remaining.id);
 return pick?`Next need: ${pick.selected_team} over ${pick.selected_team===remaining.team_a?remaining.team_b:remaining.team_a}`:`Needs a pick for ${remaining.team_a} vs ${remaining.team_b}`;
}


export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [picks,setPicks]=useState<Pick[]>([]);
 const [status,setStatus]=useState('');
 const [admin,setAdmin]=useState({phone:'',passcode:''});
 const [isAdmin,setIsAdmin]=useState(false);
 const [broadcast,setBroadcast]=useState('');
 const [selectedPlayer,setSelectedPlayer]=useState<Player|null>(null);
 const [form,setForm]=useState({first_name:'',last_name:'',phone:'',player_code:'',team:'Argentina',flag:'🇦🇷'});

 useEffect(()=>{load();const ch=supabase.channel('family-live-v2')
 .on('postgres_changes',{event:'*',schema:'public',table:'participants'},load)
 .on('postgres_changes',{event:'*',schema:'public',table:'wc_matches'},load)
 .on('postgres_changes',{event:'*',schema:'public',table:'match_picks'},load)
 .subscribe();return()=>{supabase.removeChannel(ch)}},[]);

 async function load(){
  const {data:p,error:pe}=await supabase.from('participants').select('*').order('created_at');
  const {data:m,error:me}=await supabase.from('wc_matches').select('*').order('id');
  const {data:k,error:ke}=await supabase.from('match_picks').select('*');
  if(pe||me||ke){setStatus(pe?.message||me?.message||ke?.message||'Database error');return}
  setPlayers((p||[]) as Player[]);setMatches((m||[]) as Match[]);setPicks((k||[]) as Pick[]);
 }

 const me=players.find(p=>clean(p.phone)===clean(form.phone)&&p.player_code===form.player_code);

 async function savePlayer(){
  if(!form.first_name||!form.last_name||clean(form.phone).length<10||form.player_code.length!==4){setStatus('Enter name, mobile number, and 4-digit code.');return}
  const phone=clean(form.phone);
  const existing=players.find(p=>clean(p.phone)===phone&&p.player_code===form.player_code);
  if(existing){
   const {error}=await supabase.from('participants').update({first_name:form.first_name,last_name:form.last_name,team:form.team,flag:form.flag}).eq('id',existing.id);
   if(error){setStatus(error.message);return}
   setStatus('Player updated. Make picks below.');
  }else{
   const {error}=await supabase.from('participants').insert({first_name:form.first_name,last_name:form.last_name,phone,player_code:form.player_code,team:form.team,flag:form.flag,points:0,wins:0,losses:0,goals_for:0,goals_against:0});
   if(error){setStatus(error.message);return}
   await sendSMS(players.map(p=>p.phone),`${form.first_name} joined Family World Cup Live as ${form.flag} ${form.team}!`);
   setStatus('Player saved. Make picks below.');
  }
  await load();
 }

 async function savePick(m:Match,team:string){
  const player=players.find(p=>clean(p.phone)===clean(form.phone)&&p.player_code===form.player_code);
  if(!player){setStatus('Save player first, or enter the same phone + 4-digit code.');return}
  const {error}=await supabase.from('match_picks').upsert({participant_id:player.id,match_id:m.id,selected_team:team,updated_at:new Date().toISOString()},{onConflict:'participant_id,match_id'});
  if(error){setStatus(error.message);return}
  setStatus(`Pick saved: ${team}`);
  await load();
 }

 async function recalc(){
  const finals=matches.filter(m=>m.status==='final'&&m.winner);
  for(const p of players){
   let points=0,wins=0,losses=0;
   for(const m of finals){
    const pick=picks.find(x=>x.participant_id===p.id&&x.match_id===m.id);
    if(!pick)continue;
    if(pick.selected_team===m.winner){points+=3;wins++}else{losses++}
   }
   await supabase.from('participants').update({points,wins,losses}).eq('id',p.id);
  }
  await load();
 }

 async function updateMatch(m:Match,a:number,b:number,st:string){
  const winner=a===b?null:(a>b?m.team_a:m.team_b);
  const {error}=await supabase.from('wc_matches').update({score_a:a,score_b:b,status:st,winner,updated_at:new Date().toISOString()}).eq('id',m.id);
  if(error){setStatus(error.message);return}
  await sendSMS(players.map(p=>p.phone),`Family World Cup update: ${m.flag_a} ${m.team_a} ${a}-${b} ${m.flag_b} ${m.team_b}${winner?`. Winner: ${winner}`:''}`);
  await recalc();
  setStatus('Match updated. Leaderboard recalculated.');
 }

 async function broadcastSMS(){
  if(!broadcast.trim())return;
  await sendSMS(players.map(p=>p.phone),`Family World Cup: ${broadcast}`);
  setBroadcast('');
  setStatus('Broadcast sent if Twilio is configured.');
 }

 function login(){const ok=clean(admin.phone)===ADMIN_PHONE&&admin.passcode===ADMIN_PASSCODE;setIsAdmin(ok);setStatus(ok?'Admin open.':'Admin login failed.');}

 const board=useMemo(()=>[...players].sort((a,b)=>(b.points||0)-(a.points||0)||(b.wins||0)-(a.wins||0)),[players]);
 const upset=matches.find(m=>m.status==='final'&&m.winner&&teamChance(m.team_a,m.team_b)[m.winner===m.team_a?0:1]<45);
 const live=matches.filter(m=>m.status==='live');
 const upcoming=matches.filter(m=>m.status==='scheduled');
 const finals=matches.filter(m=>m.status==='final');

 return <main className="wrap">
  <section className="hero"><div><h1>🏆 Family World Cup Live</h1><p className="muted">Live family picks, full match board, admin scoring, SMS broadcasts, and leaderboard updates.</p></div><div className="badge">V2 FAMILY LIVE</div></section>

  <section className="card pickBoard"><h2>🔥 Live Now</h2>{live.length?live.map(m=><ScoreCard key={m.id} m={m} picks={picks}/>):<p className="muted">No match marked live yet. Admin can set one live below.</p>}{upset&&<div className="locked">🚨 Upset alert: {upset.winner} beat the odds!</div>}</section>

  <div className="grid">
   <section className="card"><h2>Join / Update Player</h2><div className="row"><input placeholder="First name" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/><input placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></div><br/><div className="row"><input placeholder="U.S. mobile number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input placeholder="4-digit code" maxLength={4} value={form.player_code} onChange={e=>setForm({...form,player_code:e.target.value.replace(/\D/g,'')})}/></div><p className="hint">Same phone + code lets a player update picks anytime.</p><label className="muted">Tournament team</label><select value={form.team} onChange={e=>{const t=teams.find(x=>x[0]===e.target.value)!;setForm({...form,team:t[0],flag:t[1]})}}>{teams.map(t=><option key={`${t[0]}-${t[1]}`} value={t[0]}>{t[1]} {t[0]}</option>)}</select><br/><br/><button onClick={savePlayer}>Save Player</button><p className="muted">{status}</p><div className="invite"><b>Share Link</b><span>{typeof window==='undefined'?'':window.location.origin}</span></div></section>
   <section className="card"><h2>🏆 Live Leaderboard</h2><div className="list">{board.map((p,i)=><div className="item" key={p.id} onClick={()=>setSelectedPlayer(p)} style={{cursor:'pointer'}}><span>#{i+1} {p.flag} {p.first_name} {p.last_name}<br/><span className="muted">{p.team} • W {p.wins||0} L {p.losses||0} • Chance to win: {playerChance(p,players)}% • Tap to view picks</span><div className="meter"><i style={{width:`${playerChance(p,players)}%`}}></i></div></span><b>{p.points||0}</b></div>)}</div></section>
  </div>

  <section className="card"><h2>⚽ Make / Change Picks</h2><button onClick={()=>setStatus("Picks submitted / updated. You can change them anytime in family mode.")}>Submit / Update Picks</button><br/><br/>{!me&&<p className="locked">Save player first. Then pick every match here.</p>}<div className="bracket">{matches.map(m=>{const pick=me?picks.find(x=>x.participant_id===me.id&&x.match_id===m.id):undefined;return <div className="match" key={m.id}><div className="row"><b>{m.round}</b><span className="badge">{m.status}</span></div><p className="muted">{m.kickoff}</p><div className="team"><span>{m.flag_a} {m.team_a}</span><b>{m.score_a}</b></div><div className="team"><span>{m.flag_b} {m.team_b}</span><b>{m.score_b}</b></div>{m.winner&&<p className="winnerText">Winner: {m.winner}</p>}<div className="choiceRow"><button className={pick?.selected_team===m.team_a?'selectedChoice':'ghost'} onClick={()=>savePick(m,m.team_a)}>Submit / Update: {m.flag_a} {m.team_a}</button><button className={pick?.selected_team===m.team_b?'selectedChoice':'ghost'} onClick={()=>savePick(m,m.team_b)}>Submit / Update: {m.flag_b} {m.team_b}</button></div></div>})}</div></section>

  <section className="card bracketCard"><h2>📺 Match Board</h2><h3>Live</h3>{live.map(m=><ScoreCard key={`l-${m.id}`} m={m} picks={picks}/>)}<h3>Upcoming</h3>{upcoming.map(m=><ScoreCard key={`u-${m.id}`} m={m} picks={picks}/>)}<h3>Finals</h3>{finals.map(m=><ScoreCard key={`f-${m.id}`} m={m} picks={picks}/>)}</section>

  {!isAdmin?<section className="card"><h2>Admin</h2><div className="row"><input placeholder="Admin mobile" value={admin.phone} onChange={e=>setAdmin({...admin,phone:e.target.value})}/><input placeholder="Passcode" type="password" value={admin.passcode} onChange={e=>setAdmin({...admin,passcode:e.target.value})}/><button onClick={login}>Open Admin</button></div></section>:
  <section className="card admin"><h2>Admin Control Center</h2><h3>Broadcast SMS</h3><div className="row"><input placeholder="Message everyone" value={broadcast} onChange={e=>setBroadcast(e.target.value)}/><button onClick={broadcastSMS}>Send SMS</button></div><h3>Live Match Updates</h3><div className="list">{matches.map(m=><AdminMatch key={m.id} m={m} save={updateMatch}/>)}</div></section>}

  {selectedPlayer&&<div className="modalBackdrop" onClick={()=>setSelectedPlayer(null)}><div className="modalCard" onClick={e=>e.stopPropagation()}><button className="ghost" onClick={()=>setSelectedPlayer(null)}>Close</button><h2>{selectedPlayer.flag} {selectedPlayer.first_name} {selectedPlayer.last_name}'s Picks</h2><p className="muted">{selectedPlayer.team} • {selectedPlayer.points||0} pts • Chance to win: {playerChance(selectedPlayer,players)}%</p><div className="locked">🎯 {needText(selectedPlayer,matches,picks)}</div>{(()=>{const r=roadToVictory(selectedPlayer,players,matches,picks);return <div className="roadCard"><h3>🏆 Road to Victory</h3><p><b>If these happen...</b></p><ul>{r.needs.map((n,i)=><li key={i}>✅ {n}</li>)}</ul><p><b>Chance jumps to:</b> {r.jump}%</p><p><b>Most dangerous opponent:</b> {r.rival?`${r.rival.flag} ${r.rival.first_name}`:"Nobody yet"}</p></div>})()}<div className="list">{matches.map(m=>{const pick=picks.find(x=>x.participant_id===selectedPlayer.id&&x.match_id===m.id);const correct=m.winner&&pick?.selected_team===m.winner;const wrong=m.winner&&pick&&pick.selected_team!==m.winner;return <div className="item" key={m.id}><span><b>{m.flag_a} {m.team_a} {m.score_a} - {m.score_b} {m.flag_b} {m.team_b}</b><br/><span className="muted">{m.round} • {m.kickoff} • {m.status}</span><br/>Pick: {pick?pick.selected_team:'No pick yet'} {correct?'✅':wrong?'❌':''}</span><b>{m.winner?`Winner: ${m.winner}`:'TBD'}</b></div>})}</div></div></div>}
  <div className="footer">Family World Cup Live • Fun mode now • Pro version later</div>
 </main>
}

function ScoreCard({m,picks=[]}:{m:Match;picks?:Pick[]}){const [a,b]=teamChance(m.team_a,m.team_b);const total=picks.filter(p=>p.match_id===m.id).length;const pa=pct(picks.filter(p=>p.match_id===m.id&&p.selected_team===m.team_a).length,total);const pb=pct(picks.filter(p=>p.match_id===m.id&&p.selected_team===m.team_b).length,total);return <div className="match"><div className="row"><b>{m.round}</b><span className="badge">{m.status}</span></div><p className="muted">{m.kickoff}</p><div className="team"><span>{m.flag_a} {m.team_a}</span><b>{m.score_a}</b></div><div className="meter"><i style={{width:`${a}%`}}></i></div><p className="muted">Win chance: {m.team_a} {a}% • Family picks {pa}%</p><div className="team"><span>{m.flag_b} {m.team_b}</span><b>{m.score_b}</b></div><div className="meter"><i style={{width:`${b}%`}}></i></div><p className="muted">Win chance: {m.team_b} {b}% • Family picks {pb}%</p>{m.winner&&<p className="winnerText">Winner: {m.winner}</p>}</div>}

function AdminMatch({m,save}:{m:Match;save:(m:Match,a:number,b:number,s:string)=>void}){const[a,setA]=useState(m.score_a||0);const[b,setB]=useState(m.score_b||0);const[s,setS]=useState(m.status||'scheduled');useEffect(()=>{setA(m.score_a||0);setB(m.score_b||0);setS(m.status||'scheduled')},[m]);return <div className="item adminItem"><span>{m.flag_a} {m.team_a} vs {m.flag_b} {m.team_b}<br/><span className="muted">{m.kickoff}</span></span><div className="statGrid"><input type="number" value={a} onChange={e=>setA(Number(e.target.value))}/><input type="number" value={b} onChange={e=>setB(Number(e.target.value))}/><select value={s} onChange={e=>setS(e.target.value)}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select><button onClick={()=>save(m,a,b,s)}>Update</button></div></div>}
