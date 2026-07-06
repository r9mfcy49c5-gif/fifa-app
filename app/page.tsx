'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player={id:string;first_name:string;last_name:string;team:string;flag:string;points?:number;wins?:number;losses?:number};
type Match={id:string;round:string;kickoff:string;team_a:string;team_b:string;flag_a:string;flag_b:string;score_a:number;score_b:number;status:string;winner?:string|null;minute?:number;extra_time?:number;venue?:string;highlights_url?:string};
type Pick={id?:string;participant_id:string;match_id:string;selected_team:string};

export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [picks,setPicks]=useState<Pick[]>([]);
 const [chat,setChat]=useState<any[]>([]);
 const [msg,setMsg]=useState('');

 async function load(){
  const {data:p}=await supabase.from('participants').select('*').order('points',{ascending:false});
  const {data:m}=await supabase.from('wc_matches').select('*').order('kickoff',{ascending:true});
  const {data:k}=await supabase.from('match_picks').select('*');
  const {data:c}=await supabase.from('fan_messages').select('*').order('created_at',{ascending:false}).limit(25);
  setPlayers((p||[]) as Player[]); setMatches((m||[]) as Match[]); setPicks((k||[]) as Pick[]); setChat((c||[]).reverse());
 }
 useEffect(()=>{load();const t=setInterval(load,1500);const ch=supabase.channel('home-v2').on('postgres_changes',{event:'*',schema:'public',table:'participants'},load).on('postgres_changes',{event:'*',schema:'public',table:'wc_matches'},load).on('postgres_changes',{event:'*',schema:'public',table:'match_picks'},load).on('postgres_changes',{event:'*',schema:'public',table:'fan_messages'},load).subscribe();return()=>{clearInterval(t);supabase.removeChannel(ch)}},[]);

 const live=matches.filter(m=>m.status==='live');
 const next=matches.find(m=>m.status==='scheduled');
 const featured=live[0]||next||matches[0];
 const board=useMemo(()=>[...players].sort((a,b)=>(b.points||0)-(a.points||0)),[players]);

 async function sendChat(){
  if(!msg.trim())return;
  await supabase.from('fan_messages').insert({player_name:'Fan',message:msg.trim()});
  setMsg(''); await load();
 }

 return <main className="screen">
  <header className="mast">
   <div className="workshop"><small>PRESENTED BY</small><b>CORBY’S WORKSHOP LLC</b><em>Shannon Approved</em></div>
   <div className="title"><span>LYTLE LEMON</span><h1>FIFA WORLD CUP <i>LIVE</i></h1><p>FAMILY • COMPETITION • MEMORIES</p></div>
   <div className="vegas">VEGAS <i>LIVE</i><small>SERVICE • FAMILY • FOOTBALL</small></div>
  </header>

  <section className="ticker"><b>LIVE TICKER</b><span>{live.length?live.map(m=>`⚽ ${m.flag_a} ${m.team_a} ${m.score_a}-${m.score_b} ${m.flag_b} ${m.team_b} ${m.minute||0}'`).join('  ⚡  '):'⚡ No live match marked. Admin can set one live.'}</span></section>

  <div className="layout">
   <aside className="panel">
    <h2>🏆 Top of the Table</h2>
    {board.slice(0,8).map((p,i)=><div className="rank" key={p.id}><b>{i+1}</b><span>{p.flag} {p.first_name}</span><strong>{p.points||0}</strong></div>)}
   </aside>

   <section className="mainEvent">
    <div className="liveTag">🔴 {featured?.status==='live'?'LIVE NOW':'NEXT UP'}</div>
    {featured?<><h2>{featured.round}</h2><div className="score"><div><span>{featured.flag_a}</span><b>{featured.team_a}</b></div><strong>{featured.score_a}-{featured.score_b}</strong><div><span>{featured.flag_b}</span><b>{featured.team_b}</b></div></div><div className="clock">{featured.minute||0}:00 {featured.extra_time?<i>+{featured.extra_time}</i>:null}</div><p className="venue">📍 {featured.venue||'World Cup Stadium'} • {featured.kickoff}</p></>:<p>No matches loaded.</p>}
    <div className="quickLinks"><a href="/player">🎯 Player Portal</a><a href="/admin">🎛️ Admin Control Room</a></div>
   </section>

   <aside className="panel">
    <h2>💬 Fan Zone</h2>
    <div className="chat">{chat.map(c=><p key={c.id}><b>{c.player_name}</b><span>{c.message}</span></p>)}</div>
    <div className="send"><input placeholder="Type a message..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}}/><button onClick={sendChat}>➤</button></div>
   </aside>

   <aside className="panel">
    <h2>⚽ Live & Upcoming</h2>
    {[...live,...matches.filter(m=>m.status==='scheduled')].slice(0,6).map(m=><div className="game" key={m.id}><b>{m.status==='live'?'LIVE':m.kickoff}</b><span>{m.flag_a} {m.team_a}</span><strong>{m.score_a}-{m.score_b}</strong><span>{m.flag_b} {m.team_b}</span></div>)}
   </aside>

   <section className="stats"><h2>Vegas Live Stats</h2><div><article><b>{matches.length}</b><span>Matches</span></article><article><b>{picks.length}</b><span>Picks</span></article><article><b>{players.length}</b><span>Players</span></article></div><p>Stay Locked In!</p></section>

   <aside className="panel">
    <h2>🚀 Portals</h2>
    <a className="bigBtn" href="/player">Player Login / My Picks</a>
    <a className="bigBtn" href="/admin">Admin Control Room</a>
   </aside>
  </div>
  <footer>BUILT IN CORBY’S WORKSHOP LLC • SHANNON APPROVED • CW</footer>
 </main>
}
