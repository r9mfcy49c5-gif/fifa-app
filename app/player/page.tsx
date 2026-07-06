'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Player={id:string;first_name:string;last_name:string;team:string;flag:string;points?:number};
type Match={id:string;round:string;kickoff:string;team_a:string;team_b:string;flag_a:string;flag_b:string;score_a:number;score_b:number;status:string;winner?:string|null};
type Pick={id?:string;participant_id:string;match_id:string;selected_team:string};

const TEAMS=[['Brazil','🇧🇷'],['Japan','🇯🇵'],['Canada','🇨🇦'],['South Africa','🇿🇦'],['USA','🇺🇸'],['Mexico','🇲🇽'],['France','🇫🇷'],['Germany','🇩🇪'],['Argentina','🇦🇷'],['England','🏴'],['Spain','🇪🇸'],['Portugal','🇵🇹'],['Morocco','🇲🇦'],['Netherlands','🇳🇱']];

export default function PlayerPortal(){
 const [players,setPlayers]=useState<Player[]>([]),[matches,setMatches]=useState<Match[]>([]),[picks,setPicks]=useState<Pick[]>([]);
 const [me,setMe]=useState<Player|null>(null),[status,setStatus]=useState('');
 const [form,setForm]=useState({first_name:'',last_name:'',team:'Brazil',flag:'🇧🇷'});
 async function load(){const {data:p}=await supabase.from('participants').select('*').order('first_name');const {data:m}=await supabase.from('wc_matches').select('*').order('kickoff');const {data:k}=await supabase.from('match_picks').select('*');setPlayers((p||[]) as Player[]);setMatches((m||[]) as Match[]);setPicks((k||[]) as Pick[])}
 useEffect(()=>{load();const saved=localStorage.getItem('player_id');const t=setInterval(load,1500);return()=>clearInterval(t)},[]);
 function login(id:string){const p=players.find(x=>x.id===id)||null;setMe(p);if(p){localStorage.setItem('player_id',p.id);setStatus(`Logged in as ${p.first_name}`)}}
 async function savePlayer(){const {data,error}=await supabase.from('participants').insert(form).select().single();if(error)return setStatus(error.message);setMe(data as Player);localStorage.setItem('player_id',data.id);setStatus('Player saved.')}
 async function pick(m:Match,team:string){if(!me)return setStatus('Log in first.');await supabase.from('match_picks').upsert({participant_id:me.id,match_id:m.id,selected_team:team},{onConflict:'participant_id,match_id'});setStatus(`Pick saved: ${team}`);await load()}
 return <main className="portal"><h1>🎯 Player Portal</h1><a href="/">← Broadcast</a><section className="card"><h2>Login / Join</h2><select onChange={e=>login(e.target.value)}><option value="">Existing player...</option>{players.map(p=><option key={p.id} value={p.id}>{p.flag} {p.first_name} {p.last_name}</option>)}</select><input placeholder="First name" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/><input placeholder="Last name" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/><select value={form.team} onChange={e=>{const t=TEAMS.find(x=>x[0]===e.target.value)!;setForm({...form,team:t[0],flag:t[1]})}}>{TEAMS.map(t=><option key={t[0]} value={t[0]}>{t[1]} {t[0]}</option>)}</select><button onClick={savePlayer}>Save Player</button><p>{status}</p></section><section className="card"><h2>My Picks {me?`• ${me.first_name}`:''}</h2>{matches.map(m=>{const mine=me?picks.find(p=>p.participant_id===me.id&&p.match_id===m.id):undefined;return <div className="pickLine" key={m.id}><span>{m.flag_a} {m.team_a} vs {m.flag_b} {m.team_b}<small>{m.round} • {m.kickoff} • {m.status}</small></span><button className={mine?.selected_team===m.team_a?'sel':''} onClick={()=>pick(m,m.team_a)}>{m.team_a}</button><button className={mine?.selected_team===m.team_b?'sel':''} onClick={()=>pick(m,m.team_b)}>{m.team_b}</button></div>})}</section></main>
}
