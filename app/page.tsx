'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player={id:string;first_name:string;last_name:string;team:string;flag:string;points?:number;wins?:number;losses?:number;phone?:string};
type Match={id:string;round:string;kickoff:string;team_a:string;team_b:string;flag_a:string;flag_b:string;score_a:number;score_b:number;status:string;winner?:string|null;minute?:number;extra_time?:number;venue?:string;highlights_url?:string};
type Pick={id?:string;participant_id:string;match_id:string;selected_team:string};

const TEAMS=[['Brazil','🇧🇷'],['Japan','🇯🇵'],['Canada','🇨🇦'],['South Africa','🇿🇦'],['USA','🇺🇸'],['Mexico','🇲🇽'],['France','🇫🇷'],['Germany','🇩🇪'],['Argentina','🇦🇷'],['England','🏴'],['Spain','🇪🇸'],['Portugal','🇵🇹'],['Morocco','🇲🇦'],['Netherlands','🇳🇱']];

export default function Home(){
 const [players,setPlayers]=useState<Player[]>([]);
 const [matches,setMatches]=useState<Match[]>([]);
 const [picks,setPicks]=useState<Pick[]>([]);
 const [me,setMe]=useState<Player|null>(null);
 const [status,setStatus]=useState('');
 const [chat,setChat]=useState<any[]>([]);
 const [msg,setMsg]=useState('');
 const [form,setForm]=useState({first_name:'',last_name:'',phone:'',team:'Brazil',flag:'🇧🇷'});

 async function load(){
  const {data:p}=await supabase.from('participants').select('*').order('points',{ascending:false});
  const {data:m}=await supabase.from('wc_matches').select('*').order('kickoff',{ascending:true});
  const {data:k}=await supabase.from('match_picks').select('*');
  const {data:c}=await supabase.from('fan_messages').select('*').order('created_at',{ascending:false}).limit(30);
  setPlayers((p||[]) as Player[]);
  setMatches((m||[]) as Match[]);
  setPicks((k||[]) as Pick[]);
  setChat((c||[]).reverse());
 }

 useEffect(()=>{
  load();
  const timer=setInterval(load,1500);
  const ch=supabase.channel('lytle-lemon-live')
   .on('postgres_changes',{event:'*',schema:'public',table:'participants'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'wc_matches'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'match_picks'},load)
   .on('postgres_changes',{event:'*',schema:'public',table:'fan_messages'},load)
   .subscribe();
  return()=>{clearInterval(timer);supabase.removeChannel(ch)}
 },[]);

 const now=Date.now();
 const today=new Date().toISOString().slice(0,10);
 const isToday=(m:Match)=>String(m.kickoff||'').slice(0,10)===today;
 const isFuture=(m:Match)=>new Date(m.kickoff).getTime()>=now-1000*60*30;
 const live=matches.filter(m=>m.status==='live'&&isToday(m));
 const upcoming=matches.filter(m=>m.status==='scheduled'&&isFuture(m));
 const featured=live[0]||upcoming[0];
 const board=useMemo(()=>[...players].sort((a,b)=>(b.points||0)-(a.points||0)),[players]);

 async function savePlayer(){
  if(!form.first_name.trim())return setStatus('Enter first name.');
  const player_code=`${form.first_name.trim().toUpperCase()}-${Math.floor(1000+Math.random()*9000)}`;
  const {data,error}=await supabase.from('participants').insert({...form,player_code}).select().single();
  if(error)return setStatus(error.message);
  setMe(data as Player); setStatus('Player saved. Make your picks.');
  await load();
 }

 async function findPlayer(){
  let q=supabase.from('participants').select('*').limit(1);
  if(form.phone.trim()){
   q=q.eq('phone',form.phone.trim());
  }else{
   if(!form.first_name.trim())return setStatus('Enter phone or first name.');
   q=q.ilike('first_name',form.first_name.trim());
   if(form.last_name.trim())q=q.ilike('last_name',form.last_name.trim());
  }
  const {data,error}=await q;
  if(error)return setStatus(error.message);
  const found=data?.[0] as Player|undefined;
  if(!found)return setStatus('No existing player found. Check name or phone.');
  setMe(found);
  setForm({
   first_name:found.first_name||'',
   last_name:found.last_name||'',
   phone:found.phone||'',
   team:found.team||'Brazil',
   flag:found.flag||'🇧🇷'
  });
  setStatus(`Loaded ${found.first_name}. Your old picks are back.`);
  await load();
 }

 async function findPlayer(){
  let q=supabase.from('participants').select('*').limit(1);
  if(form.phone.trim()){
   q=q.eq('phone',form.phone.trim());
  }else{
   if(!form.first_name.trim())return setStatus('Enter phone or first name.');
   q=q.ilike('first_name',form.first_name.trim());
   if(form.last_name.trim())q=q.ilike('last_name',form.last_name.trim());
  }
  const {data,error}=await q;
  if(error)return setStatus(error.message);
  const found=data?.[0] as Player|undefined;
  if(!found)return setStatus('No existing player found. Check name or phone.');
  setMe(found);
  setForm({
   first_name:found.first_name||'',
   last_name:found.last_name||'',
   phone:found.phone||'',
   team:found.team||'Brazil',
   flag:found.flag||'🇧🇷'
  });
  setStatus(`Loaded ${found.first_name}. Your old picks are back.`);
  await load();
 }

 async function pick(m:Match,team:string){
  if(!me)return setStatus('Save player first.');
  await supabase.from('match_picks').upsert({participant_id:me.id,match_id:m.id,selected_team:team},{onConflict:'participant_id,match_id'});
  setStatus(`Pick saved: ${team}`);
  await load();
 }

 async function sendChat(){
  if(!msg.trim())return;
  await supabase.from('fan_messages').insert({player_id:me?.id||null,player_name:me?`${me.first_name} ${me.last_name}`:'Guest',message:msg.trim()});
  setMsg('');
  await load();
 }

 return <main className="stage">
  <header className="top">
   <div className="tiny">Corby&apos;s Workshop LLC Presents</div>
   <h1>Lytle Lemon FIFA World Cup Live</h1>
   <div className="sub">One screen. Live family picks. Big-game energy.</div>
  </header>

  <section className="live">
   <div className="tag">{featured?.status==='live'?'LIVE NOW':'NEXT UP'}</div>
   {featured?<>
    <div className="teams">
     <div><span>{featured.flag_a}</span><b>{featured.team_a}</b><strong>{featured.score_a??0}</strong></div>
     <em>VS</em>
     <div><span>{featured.flag_b}</span><b>{featured.team_b}</b><strong>{featured.score_b??0}</strong></div>
    </div>
    <div className="clock">⏱ {featured.minute||0}&apos; {featured.extra_time?<i>+{featured.extra_time}</i>:null}</div>
    <p>{featured.round} • {featured.kickoff} {featured.venue?`• ${featured.venue}`:''}</p>
    {featured.highlights_url&&<a href={featured.highlights_url} target="_blank">🎥 Highlights</a>}
   </>:<p>No matches loaded.</p>}
  </section>

  <section className="ticker">⚡ {live.length?live.map(m=>`${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}`).join('  •  '):upcoming.length?`Next: ${upcoming[0].team_a} vs ${upcoming[0].team_b} • ${upcoming[0].kickoff}`:'No live or upcoming match loaded.'}</section>

  <div className="grid">
   <section className="card">
    <h2>🏆 Leaderboard</h2>
    {board.map((p,i)=><div className="row" key={p.id}><span>#{i+1} {p.flag} {p.first_name} {p.last_name}<small>{p.team} • W {p.wins||0} L {p.losses||0}</small></span><b>{p.points||0}</b></div>)}
   </section>

   <section className="card">
    <h2>👤 Join / Update</h2>
    <input placeholder="First name" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/>
    <input placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/>
    <input placeholder="Phone optional" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
    <select value={form.team} onChange={e=>{const t=TEAMS.find(x=>x[0]===e.target.value)!;setForm({...form,team:t[0],flag:t[1]})}}>
     {TEAMS.map(t=><option key={t[0]} value={t[0]}>{t[1]} {t[0]}</option>)}
    </select>
    <button onClick={findPlayer}>Find My Picks</button>
    <button onClick={savePlayer}>Save New Player</button>
    <p className="status">{status}</p>
   </section>

   <section className="card wide">
    <h2>⚽ Make / Change Picks</h2>
    <div className="matches">{matches.map(m=>{
     const mine=me?picks.find(p=>p.participant_id===me.id&&p.match_id===m.id):undefined;
     return <div className="match" key={m.id}>
      <b>{m.flag_a} {m.team_a} {m.score_a}-{m.score_b} {m.flag_b} {m.team_b}</b>
      <small>{m.round} • {m.status} • {m.kickoff}</small>
      <div><button className={mine?.selected_team===m.team_a?'sel':''} onClick={()=>pick(m,m.team_a)}>{m.team_a}</button><button className={mine?.selected_team===m.team_b?'sel':''} onClick={()=>pick(m,m.team_b)}>{m.team_b}</button></div>
     </div>
    })}</div>
   </section>

   <section className="card wide">
    <h2>💬 Fan Zone</h2>
    <div className="chat">{chat.map(c=><p key={c.id}><b>{c.player_name}:</b> {c.message}</p>)}</div>
    <div className="chatSend"><input placeholder="Talk friendly trash..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}}/><button onClick={sendChat}>Send</button></div>
   </section>
  </div>

  <footer>Built by Corby&apos;s Workshop LLC • v1.5 Gold</footer>
 </main>
}
