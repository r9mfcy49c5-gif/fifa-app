'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Match={id:string;round:string;kickoff:string;team_a:string;team_b:string;flag_a:string;flag_b:string;score_a:number;score_b:number;status:string;winner?:string|null;minute?:number;extra_time?:number;venue?:string;highlights_url?:string};

export default function Admin(){
 const [matches,setMatches]=useState<Match[]>([]),[status,setStatus]=useState('');
 async function load(){const {data}=await supabase.from('wc_matches').select('*').order('kickoff');setMatches((data||[]) as Match[])}
 useEffect(()=>{load();const t=setInterval(load,1500);return()=>clearInterval(t)},[]);
 async function update(m:Match,patch:any){const winner=patch.status==='final'?(Number(patch.score_a)>Number(patch.score_b)?m.team_a:Number(patch.score_b)>Number(patch.score_a)?m.team_b:null):m.winner;const {error}=await supabase.from('wc_matches').update({...patch,winner,updated_at:new Date().toISOString()}).eq('id',m.id);setStatus(error?error.message:'Updated.');await load()}
 return <main className="portal"><h1>🎛️ Admin Control Room</h1><a href="/">← Broadcast</a><p>{status}</p>{matches.map(m=><AdminMatch key={m.id} m={m} save={update}/>)}</main>
}
function AdminMatch({m,save}:{m:Match;save:(m:Match,patch:any)=>void}){
 const [a,setA]=useState(m.score_a||0),[b,setB]=useState(m.score_b||0),[s,setS]=useState(m.status||'scheduled'),[min,setMin]=useState(m.minute||0),[ex,setEx]=useState(m.extra_time||0),[venue,setVenue]=useState(m.venue||''),[kick,setKick]=useState(m.kickoff||''),[hl,setHl]=useState(m.highlights_url||'');
 return <section className="card adminMatch"><h2>{m.flag_a} {m.team_a} vs {m.flag_b} {m.team_b}</h2><div className="adminGrid"><input value={kick} onChange={e=>setKick(e.target.value)}/><input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Venue"/><input type="number" value={a} onChange={e=>setA(Number(e.target.value))}/><input type="number" value={b} onChange={e=>setB(Number(e.target.value))}/><input type="number" value={min} onChange={e=>setMin(Number(e.target.value))}/><input type="number" value={ex} onChange={e=>setEx(Number(e.target.value))}/><select value={s} onChange={e=>setS(e.target.value)}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select><input value={hl} onChange={e=>setHl(e.target.value)} placeholder="Highlights URL"/><button onClick={()=>save(m,{score_a:a,score_b:b,status:s,minute:min,extra_time:ex,venue,kickoff:kick,highlights_url:hl})}>Update Match</button></div></section>
}
