'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player = { id:string; first_name:string; last_name?:string; team?:string; flag?:string; phone?:string; points?:number };
type Match = { id:string; round?:string; kickoff?:string; team_a:string; team_b:string; flag_a?:string; flag_b?:string; score_a?:number; score_b?:number; winner?:string|null; status?:string; minute?:number|null };
type Chat = { id:string; player_name:string; message:string; created_at?:string };

const demoMatches: Match[] = [
  { id:'demo-1', round:'Opening Match', kickoff:'Today', team_a:'USA', team_b:'Canada', flag_a:'🇺🇸', flag_b:'🇨🇦', score_a:0, score_b:0, status:'live', minute:12 },
  { id:'demo-2', round:'Group Stage', kickoff:'Next Up', team_a:'Mexico', team_b:'Brazil', flag_a:'🇲🇽', flag_b:'🇧🇷', score_a:0, score_b:0, status:'scheduled' },
  { id:'demo-3', round:'Group Stage', kickoff:'Later', team_a:'France', team_b:'Argentina', flag_a:'🇫🇷', flag_b:'🇦🇷', score_a:0, score_b:0, status:'scheduled' }
];

const demoPlayers: Player[] = [
  { id:'p1', first_name:'Corby', team:'USA', flag:'🇺🇸', points:12 },
  { id:'p2', first_name:'Shannon', team:'Canada', flag:'🇨🇦', points:10 },
  { id:'p3', first_name:'Family', team:'Brazil', flag:'🇧🇷', points:8 }
];

export default function Home() {
  const [players,setPlayers]=useState<Player[]>([]);
  const [matches,setMatches]=useState<Match[]>([]);
  const [chat,setChat]=useState<Chat[]>([]);
  const [name,setName]=useState('');
  const [team,setTeam]=useState('USA');
  const [phone,setPhone]=useState('');
  const [chatText,setChatText]=useState('');
  const [admin,setAdmin]=useState(false);
  const [status,setStatus]=useState('Broadcast ready.');

  async function load(){
    try{
      const [p,m,c]=await Promise.all([
        supabase.from('participants').select('*').order('points',{ascending:false}),
        supabase.from('wc_matches').select('*').order('kickoff',{ascending:true}),
        supabase.from('fan_messages').select('*').order('created_at',{ascending:false}).limit(20)
      ]);
      setPlayers((p.data as Player[]) || []);
      setMatches((m.data as Match[]) || []);
      setChat((c.data as Chat[]) || []);
    }catch{
      setStatus('Demo mode active. Connect Supabase for live family data.');
    }
  }

  useEffect(()=>{
    load();
    const ch=supabase.channel('corbys-workshop-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'participants'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'wc_matches'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'fan_messages'},load)
      .subscribe();
    const t=setInterval(load,5000);
    return()=>{clearInterval(t);supabase.removeChannel(ch);};
  },[]);

  const liveData = matches.length ? matches : demoMatches;
  const playerData = players.length ? players : demoPlayers;
  const live = liveData.find(m=>m.status==='live') || liveData[0];
  const upcoming = liveData.filter(m=>m.id!==live?.id).slice(0,4);
  const leaderboard = [...playerData].sort((a,b)=>(b.points||0)-(a.points||0));

  async function join(){
    if(!name.trim()) return setStatus('Enter your name first.');
    const row={first_name:name.trim(),team,phone,flag:team==='USA'?'🇺🇸':team==='Canada'?'🇨🇦':'⚽',points:0};
    const {error}=await supabase.from('participants').insert(row);
    if(error){ setPlayers([{id:String(Date.now()),...row},...players]); setStatus(`${name} joined locally.`); }
    else { setStatus(`${name} joined the board.`); setName(''); setPhone(''); load(); }
  }

  async function sendChat(){
    if(!chatText.trim()) return;
    const row={player_name:name||'Family Fan',message:chatText.trim()};
    const {error}=await supabase.from('fan_messages').insert(row);
    if(error) setChat([{id:String(Date.now()),...row},...chat]);
    setChatText('');
  }

  async function score(match:Match,a:number,b:number){
    if(match.id.startsWith('demo-')){ setStatus('Demo match score changed locally.'); return; }
    const {error}=await supabase.from('wc_matches').update({score_a:a,score_b:b,status:'live'}).eq('id',match.id);
    setStatus(error?'Score update failed.':'Score updated live.');
    load();
  }

  return (
    <main className="cw">
      <section className="brandBar">
        <div className="flags">🇺🇸</div>
        <div>
          <b>CORBY&apos;S WORKSHOP LLC</b>
          <span>American born • Canadian roots • built for family</span>
        </div>
        <div className="flags">🇨🇦</div>
      </section>

      <section className="hero">
        <div>
          <p className="eyebrow">LIVE FROM THE FAMILY ROOM</p>
          <h1>Lytle Lemon FIFA World Cup Live</h1>
          <p className="sub">Vegas-style broadcast board • family picks • leaderboard • fan zone • live scoring</p>
        </div>
        <div className="heroBadge">
          <span>FINAL</span>
          <b>V1.5</b>
        </div>
      </section>

      <section className="ticker">
        <b>LIVE TICKER</b>
        <span>{live ? `${live.flag_a||''} ${live.team_a} ${live.score_a||0}-${live.score_b||0} ${live.flag_b||''} ${live.team_b} ${live.minute?`• ${live.minute}'`:''}` : 'Broadcast ready'}</span>
      </section>

      <section className="grid">
        <article className="panel mainEvent">
          <p className="eyebrow">FEATURED MATCH</p>
          <h2>{live?.round || 'Live Center'}</h2>
          <div className="scoreboard">
            <div><span>{live?.flag_a}</span><b>{live?.team_a}</b><strong>{live?.score_a||0}</strong></div>
            <em>VS</em>
            <div><span>{live?.flag_b}</span><b>{live?.team_b}</b><strong>{live?.score_b||0}</strong></div>
          </div>
          <p className="status">{live?.status?.toUpperCase() || 'READY'} {live?.minute ? `• ${live.minute}'` : ''}</p>
          {admin && live && <div className="adminScore">
            <button onClick={()=>score(live,(live.score_a||0)+1,live.score_b||0)}>+ {live.team_a}</button>
            <button onClick={()=>score(live,live.score_a||0,(live.score_b||0)+1)}>+ {live.team_b}</button>
          </div>}
        </article>

        <article className="panel">
          <h2>🏆 Leaderboard</h2>
          {leaderboard.map((p,i)=><div className="leader" key={p.id}><b>#{i+1} {p.flag} {p.first_name}</b><span>{p.points||0} pts</span></div>)}
        </article>

        <article className="panel">
          <h2>⚽ Upcoming</h2>
          {upcoming.map(m=><div className="matchRow" key={m.id}><b>{m.flag_a} {m.team_a}</b><span>{m.kickoff||m.round}</span><b>{m.flag_b} {m.team_b}</b></div>)}
        </article>

        <article className="panel join">
          <h2>Join / Update Player</h2>
          <input placeholder="First name" value={name} onChange={e=>setName(e.target.value)} />
          <select value={team} onChange={e=>setTeam(e.target.value)}>
            {['USA','Canada','Mexico','Brazil','France','Argentina','England','Spain','Germany','Portugal'].map(t=><option key={t}>{t}</option>)}
          </select>
          <input placeholder="Phone optional" value={phone} onChange={e=>setPhone(e.target.value)} />
          <button onClick={join}>Join The Board</button>
        </article>

        <article className="panel fan">
          <h2>💬 Fan Zone</h2>
          <div className="chat">
            {(chat.length?chat:[{id:'demo',player_name:'Corby’s Workshop',message:'Broadcast board is live. Let the family games begin.'}]).map(c=><p key={c.id}><b>{c.player_name}:</b> {c.message}</p>)}
          </div>
          <input placeholder="Talk friendly trash..." value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat();}}/>
          <button onClick={sendChat}>Send</button>
        </article>

        <article className="panel admin">
          <h2>🎛 Admin Studio</h2>
          <p>{status}</p>
          <button onClick={()=>setAdmin(!admin)}>{admin?'Admin On':'Unlock Admin'}</button>
        </article>
      </section>

      <footer>🇺🇸 Corby&apos;s Workshop LLC 🇨🇦 • Lytle Lemon FIFA World Cup Live • Family Edition</footer>
    </main>
  );
}
