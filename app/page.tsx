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
 const [me,setMe]=useState<Player|null>(null);

 async function load(){
  const {data:p}=await supabase.from('participants').select('*').order('points',{ascending:false});
  const {data:m}=await supabase.from('wc_matches').select('*').order('kickoff',{ascending:true});
  const {data:k}=await supabase.from('match_picks').select('*');
  setPlayers((p||[]) as Player[]);
  setMatches((m||[]) as Match[]);
  setPicks((k||[]) as Pick[]);
 }

 useEffect(()=>{load();const t=setInterval(load,1500);return()=>clearInterval(t)},[]);

 const live=matches.filter(m=>m.status==='live');
 const upcoming=matches.filter(m=>m.status==='scheduled');
 const featured=live[0]||upcoming[0]||matches[0];
 const board=useMemo(()=>[...players].sort((a,b)=>(b.points||0)-(a.points||0)),[players]);
 const myPicks=me?picks.filter(p=>p.participant_id===me.id):[];

 async function pick(m:Match,team:string){
  if(!me)return;
  await supabase.from('match_picks').upsert({participant_id:me.id,match_id:m.id,selected_team:team},{onConflict:'participant_id,match_id'});
  await load();
 }

 return <main className="site">
  <header className="nav">
   <div className="brand"><span>CORBY’S WORKSHOP LLC</span><b>Lytle Lemon FIFA World Cup Live</b></div>
   <nav><a href="#dashboard">Player Dashboard</a><a href="/admin">Admin</a></nav>
  </header>

  <section className="hero">
   <div>
    <p className="eyebrow">LIVE PRIVATE SPORTSBOOK EXPERIENCE</p>
    <h1>World Cup picks built for game day.</h1>
    <p className="lede">Live matches, standings, player dashboards, picks, chat, and tournament control.</p>
   </div>
   <aside className="scorecard">
    <span className="live">{featured?.status==='live'?'LIVE NOW':'NEXT MATCH'}</span>
    {featured?<><div className="teams"><div><b>{featured.team_a}</b><strong>{featured.score_a}</strong></div><em>{featured.minute||0}' {featured.extra_time?`+${featured.extra_time}`:''}</em><div><b>{featured.team_b}</b><strong>{featured.score_b}</strong></div></div><p>{featured.round} • {featured.kickoff}</p></>:<p>No match loaded.</p>}
   </aside>
  </section>

  <section className="ticker"><b>LIVE TICKER</b><span>{live.length?live.map(m=>`${m.flag_a} ${m.team_a} ${m.score_a}-${m.score_b} ${m.flag_b} ${m.team_b}`).join(' • '):'No match marked live yet.'}</span></section>

  <section id="dashboard" className="dashboard">
   <aside className="panel">
    <h2>Player Login</h2>
    <select onChange={e=>setMe(players.find(p=>p.id===e.target.value)||null)}>
     <option value="">Choose player...</option>
     {players.map(p=><option key={p.id} value={p.id}>{p.flag} {p.first_name} {p.last_name}</option>)}
    </select>
    {me&&<div className="profile"><b>{me.flag} {me.first_name}</b><span>{me.points||0} pts • {myPicks.length} picks</span></div>}
   </aside>

   <aside className="panel">
    <h2>Leaderboard</h2>
    {board.slice(0,6).map((p,i)=><div className="rank" key={p.id}><b>{i+1}</b><span>{p.flag} {p.first_name}</span><strong>{p.points||0}</strong></div>)}
   </aside>

   <section className="panel picks">
    <h2>{me?`${me.first_name}'s Draft Board`:'DraftKings-Style Pick Board'}</h2>
    {!me&&<p className="muted">Choose your player to view and update picks.</p>}
    {matches.map(m=>{
      const mine=me?picks.find(p=>p.participant_id===me.id&&p.match_id===m.id):undefined;
      return <div className="pickRow" key={m.id}>
       <div><b>{m.flag_a} {m.team_a} vs {m.flag_b} {m.team_b}</b><small>{m.round} • {m.kickoff} • {m.status}</small></div>
       <button disabled={!me} className={mine?.selected_team===m.team_a?'selected':''} onClick={()=>pick(m,m.team_a)}>{m.team_a}</button>
       <button disabled={!me} className={mine?.selected_team===m.team_b?'selected':''} onClick={()=>pick(m,m.team_b)}>{m.team_b}</button>
      </div>
    })}
   </section>
  </section>

  <footer>Powered by Corby’s Workshop LLC</footer>
 </main>
}
