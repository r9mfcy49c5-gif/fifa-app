'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player={id:string;first_name:string;last_name:string;team:string;flag:string;points?:number;wins?:number;losses?:number};
type Match={id:string;round:string;kickoff:string;team_a:string;team_b:string;flag_a:string;flag_b:string;score_a:number;score_b:number;status:string;winner?:string|null;minute?:number;extra_time?:number;venue?:string;highlights_url?:string};
type Pick={id?:string;participant_id:string;match_id:string;selected_team:string};

const TEAMS=[['Brazil','🇧🇷'],['Japan','🇯🇵'],['Canada','🇨🇦'],['South Africa','🇿🇦'],['USA','🇺🇸'],['Mexico','🇲🇽'],['France','🇫🇷'],['Germany','🇩🇪'],['Argentina','🇦🇷'],['England','🏴'],['Spain','🇪🇸'],['Portugal','🇵🇹'],['Morocco','🇲🇦'],['Netherlands','🇳🇱']];

export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [picks,setPicks]=useState<Pick[]>([]);
 const [chat,setChat]=useState<any[]>([]);
 const [me,setMe]=useState<Player|null>(null);
 const [msg,setMsg]=useState('');
 const [status,setStatus]=useState('');
 const [selectedPlayerId,setSelectedPlayerId]=useState('');
 const [notifications,setNotifications]=useState(false);
 const [form,setForm]=useState({first_name:'',last_name:'',team:'Brazil',flag:'🇧🇷'});

 async function load(){
  const {data:p}=await supabase.from('participants').select('*').order('points',{ascending:false});
  const {data:m}=await supabase.from('wc_matches').select('*').order('kickoff',{ascending:true});
  const {data:k}=await supabase.from('match_picks').select('*');
  const {data:c}=await supabase.from('fan_messages').select('*').order('created_at',{ascending:false}).limit(20);
  setPlayers((p||[]) as Player[]);
  setMatches((m||[]) as Match[]);
  setPicks((k||[]) as Pick[]);
  setChat((c||[]).reverse());
 }

 useEffect(()=>{
  load();
  const timer=setInterval(load,1500);
  const ch=supabase.channel('broadcast-edition')
   .on('postgres_changes',{event:'*',schema:'public',table:'participants'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'wc_matches'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'match_picks'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'fan_messages'},load)
   .subscribe();
  return()=>{clearInterval(timer);supabase.removeChannel(ch)}
 },[]);

 const live=matches.filter(m=>m.status==='live');
 const upcoming=matches.filter(m=>m.status==='scheduled');
 const featured=live[0]||upcoming[0]||matches[0];
 const board=useMemo(()=>[...players].sort((a,b)=>(b.points||0)-(a.points||0)),[players]);

 function loginExisting(id:string){
  setSelectedPlayerId(id);
  const found=players.find(p=>p.id===id)||null;
  setMe(found);
  if(found)setStatus(`Logged in as ${found.first_name}.`);
 }

 async function enableNotifications(){
  if(!('Notification' in window)){setStatus('Notifications are not supported on this browser.');return;}
  const permission=await Notification.requestPermission();
  setNotifications(permission==='granted');
  setStatus(permission==='granted'?'Notifications enabled.':'Notifications not enabled.');
 }

 async function savePlayer(){
  if(!form.first_name.trim())return setStatus('Enter first name.');
  const {data,error}=await supabase.from('participants').insert(form).select().single();
  if(error)return setStatus(error.message);
  setMe(data as Player); setStatus('Player saved. Make your picks.');
  await load();
 }

 async function savePick(team:string){
  if(!me||!featured)return setStatus('Save player first.');
  await supabase.from('match_picks').upsert({participant_id:me.id,match_id:featured.id,selected_team:team},{onConflict:'participant_id,match_id'});
  setStatus(`Pick saved: ${team}`);
  await load();
 }

 async function sendChat(){
  if(!msg.trim())return;
  await supabase.from('fan_messages').insert({player_id:me?.id||null,player_name:me?`${me.first_name} ${me.last_name}`:'Guest',message:msg.trim()});
  setMsg('');
  await load();
 }

 const myPick=me&&featured?picks.find(p=>p.participant_id===me.id&&p.match_id===featured.id):undefined;

 return <main className="screen">
  <header className="mast">
   <div className="workshop"><small>PRESENTED BY</small><b>CORBY’S WORKSHOP LLC</b><em>Workshop</em></div>
   <div className="title"><span>LYTLE LEMON</span><h1>FIFA WORLD CUP <i>LIVE</i></h1><p>FAMILY • COMPETITION • MEMORIES</p></div>
   <div className="vegas">VEGAS <i>LIVE</i><small>SERVICE • FAMILY • FOOTBALL</small></div>
  </header>

  <section className="ticker"><b>LIVE TICKER</b><span>{live.length?live.map(m=>`⚽ ${m.flag_a} ${m.team_a} ${m.score_a}-${m.score_b} ${m.flag_b} ${m.team_b} ${m.minute||''}'`).join('  ⚡  '):'⚡ No live match marked yet. Admin can set one live.'}</span></section>

  <div className="layout">
   <aside className="panel left">
    <h2>🏆 TOP OF THE TABLE</h2>
    <div className="head"><span>RANK</span><span>PLAYER</span><span>PTS</span></div>
    {board.slice(0,8).map((p,i)=><div className="rank" key={p.id}><b>{i+1}</b><span>{p.flag} {p.first_name}</span><strong>{p.points||0}</strong></div>)}
   </aside>

   <section className="mainEvent">
    <div className="liveTag">🔴 {featured?.status==='live'?'LIVE NOW':'NEXT UP'}</div>
    {featured ? <>
     <h2>{featured.round}</h2>
     <div className="score">
      <div><span>{featured.flag_a}</span><b>{featured.team_a}</b></div>
      <strong>{featured.score_a??0} - {featured.score_b??0}</strong>
      <div><span>{featured.flag_b}</span><b>{featured.team_b}</b></div>
     </div>
     <div className="clock">{featured.minute||0}:00 {featured.extra_time?<i>+{featured.extra_time}</i>:null}</div>
     <p className="venue">📍 {featured.venue||'World Cup Stadium'} • {featured.kickoff}</p>
     {featured.highlights_url&&<a className="highlight" href={featured.highlights_url} target="_blank">🎥 WATCH HIGHLIGHTS</a>}

     <div className="pickBox">
      <h3>⚡ MAKE YOUR PICKS</h3>
      <button className={myPick?.selected_team===featured.team_a?'sel':''} onClick={()=>savePick(featured.team_a)}>{featured.team_a}</button>
      <span>VS</span>
      <button className={myPick?.selected_team===featured.team_b?'sel':''} onClick={()=>savePick(featured.team_b)}>{featured.team_b}</button>
     </div>
    </> : <p>No matches loaded yet.</p>}
   </section>

   <aside className="panel right">
    <h2>💬 FAN ZONE</h2>
    <div className="chat">{chat.map(c=><p key={c.id}><b>{c.player_name}</b><span>{c.message}</span></p>)}</div>
    <div className="send"><input placeholder="Type a message..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}}/><button onClick={sendChat}>➤</button></div>
   </aside>

   <aside className="panel lowerLeft">
    <h2>⚽ LIVE & UPCOMING</h2>
    {[...live,...upcoming].slice(0,6).map(m=><div className="game" key={m.id}><b>{m.status==='live'?'LIVE':m.kickoff}</b><span>{m.flag_a} {m.team_a}</span><strong>{m.score_a}-{m.score_b}</strong><span>{m.flag_b} {m.team_b}</span></div>)}
   </aside>

   <section className="stats">
    <h2>VEGAS LIVE STATS</h2>
    <div><article><b>{matches.length}</b><span>Total Matches</span></article><article><b>{picks.length}</b><span>Total Picks</span></article><article><b>{players.length}</b><span>Players</span></article></div>
    <p>Stay Locked In! SERVICE • FAMILY • FOOTBALL</p>
   </section>

   <aside className="panel join">
    <h2>👤 LOGIN / JOIN</h2>
    <select value={selectedPlayerId} onChange={e=>loginExisting(e.target.value)}>
     <option value="">Log in as existing player...</option>
     {players.map(p=><option key={p.id} value={p.id}>{p.flag} {p.first_name} {p.last_name}</option>)}
    </select>
    <button onClick={enableNotifications}>{notifications?'🔔 Notifications On':'🔕 Enable Notifications'}</button>
    <div className="miniStatus">{me?`Active player: ${me.flag} ${me.first_name} ${me.last_name}`:'No active player yet.'}</div>
    <input placeholder="First name" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/>
    <input placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/>
    <select value={form.team} onChange={e=>{const t=TEAMS.find(x=>x[0]===e.target.value)!;setForm({...form,team:t[0],flag:t[1]})}}>{TEAMS.map(t=><option key={t[0]} value={t[0]}>{t[1]} {t[0]}</option>)}</select>
    <button onClick={savePlayer}>SAVE PLAYER</button>
    <small>{status}</small>
   </aside>
  </div>

  <footer>BUILT IN CORBY’S WORKSHOP LLC WORKSHOP • CW</footer>
 </main>
}
